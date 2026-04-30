package marketplace

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

func setupClubWithSquad(t *testing.T, s store.Store, ownerID string) *models.Club {
	t.Helper()
	g := generator.New(99)
	club := &models.Club{ID: generator.NewID("clb"), Name: "Test FC", OwnerUserID: ownerID}
	for _, p := range g.StarterSquad() {
		p.OwnerClubID = club.ID
		if err := s.CreatePlayer(p); err != nil {
			t.Fatal(err)
		}
		club.Squad = append(club.Squad, p.ID)
	}
	if err := s.CreateClub(club); err != nil {
		t.Fatal(err)
	}
	return club
}

func TestCreateListingTransfersOwnership(t *testing.T) {
	s := store.NewMemoryStore()
	buyer := &models.User{ID: generator.NewID("usr"), Username: "buyer", Email: "buyer@test", SoftCurrency: 100_000}
	seller := &models.User{ID: generator.NewID("usr"), Username: "seller", Email: "seller@test", SoftCurrency: 0}
	if err := s.CreateUser(buyer); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateUser(seller); err != nil {
		t.Fatal(err)
	}
	sellerClub := setupClubWithSquad(t, s, seller.ID)
	buyerClub := setupClubWithSquad(t, s, buyer.ID)
	buyer.ClubID = buyerClub.ID
	seller.ClubID = sellerClub.ID
	_ = s.UpdateUser(buyer)
	_ = s.UpdateUser(seller)

	svc := NewService(s)

	// Pick first squad player to sell.
	sellerClub, _ = s.GetClub(sellerClub.ID)
	playerID := sellerClub.Squad[0]

	listing, err := svc.Create(sellerClub, playerID, 5000)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if listing.Status != "active" {
		t.Fatalf("listing not active: %v", listing)
	}

	res, err := svc.Buy(buyer, buyerClub, listing.ID)
	if err != nil {
		t.Fatalf("buy: %v", err)
	}
	if res.Player.OwnerClubID != buyerClub.ID {
		t.Fatalf("ownership did not transfer")
	}
	updatedBuyer, _ := s.GetUser(buyer.ID)
	if updatedBuyer.SoftCurrency != 100_000-5_000 {
		t.Fatalf("buyer wallet wrong: %d", updatedBuyer.SoftCurrency)
	}
	updatedSeller, _ := s.GetUser(seller.ID)
	credit, tax := economy.MarketTax(5000)
	if updatedSeller.SoftCurrency != credit {
		t.Fatalf("seller credit wrong: got %d want %d (tax %d)", updatedSeller.SoftCurrency, credit, tax)
	}
	if res.Listing.Status != "sold" {
		t.Fatalf("listing not sold")
	}
}

func TestCannotBuyOwnListing(t *testing.T) {
	s := store.NewMemoryStore()
	user := &models.User{ID: generator.NewID("usr"), Username: "self", Email: "self@test", SoftCurrency: 100_000}
	_ = s.CreateUser(user)
	club := setupClubWithSquad(t, s, user.ID)
	user.ClubID = club.ID
	_ = s.UpdateUser(user)
	svc := NewService(s)
	pid := club.Squad[0]
	listing, err := svc.Create(club, pid, 1500)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Buy(user, club, listing.ID); err == nil {
		t.Fatal("expected self-buy to fail")
	}
}

func TestPriceBoundsEnforced(t *testing.T) {
	s := store.NewMemoryStore()
	user := &models.User{ID: generator.NewID("usr"), Username: "boundsu", Email: "bounds@test"}
	_ = s.CreateUser(user)
	club := setupClubWithSquad(t, s, user.ID)
	svc := NewService(s)
	if _, err := svc.Create(club, club.Squad[0], 0); err == nil {
		t.Fatal("expected zero price to be rejected")
	}
	if _, err := svc.Create(club, club.Squad[0], economy.MaxListingPrice+1); err == nil {
		t.Fatal("expected over-cap price to be rejected")
	}
}
