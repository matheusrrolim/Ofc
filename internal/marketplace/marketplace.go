// Package marketplace mediates player listings between clubs.
//
// Validation:
//   - Sellers cannot list players they don't own.
//   - Sellers cannot list players already on the market.
//   - Prices are bounded (anti-abuse).
//   - Buyers cannot buy their own listings.
//   - A flat tax is applied to seller proceeds (5%–10% configurable).
package marketplace

import (
	"errors"
	"time"

	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

var (
	ErrPlayerNotOwned     = errors.New("player not owned by seller")
	ErrPlayerAlreadyListed = errors.New("player already on market")
	ErrPriceOutOfRange    = errors.New("price out of allowed range")
	ErrSelfBuy            = errors.New("cannot buy your own listing")
	ErrListingClosed      = errors.New("listing not active")
	ErrSquadEmpty         = errors.New("cannot list last 11 players of squad")
)

type Service struct {
	Store store.Store
}

func NewService(s store.Store) *Service { return &Service{Store: s} }

// Create lists a player on the market. Sellers must keep at least 11 players.
func (svc *Service) Create(sellerClub *models.Club, playerID string, price int64) (*models.MarketListing, error) {
	if price < economy.MinListingPrice || price > economy.MaxListingPrice {
		return nil, ErrPriceOutOfRange
	}
	player, err := svc.Store.GetPlayer(playerID)
	if err != nil {
		return nil, err
	}
	if player.OwnerClubID != sellerClub.ID {
		return nil, ErrPlayerNotOwned
	}
	if player.OnMarket {
		return nil, ErrPlayerAlreadyListed
	}
	// Squad-size guard.
	owned, err := svc.Store.ListPlayersByClub(sellerClub.ID)
	if err != nil {
		return nil, err
	}
	available := 0
	for _, p := range owned {
		if !p.OnMarket {
			available++
		}
	}
	if available <= 11 {
		return nil, ErrSquadEmpty
	}

	listing := &models.MarketListing{
		ID:        generator.NewID("lst"),
		PlayerID:  playerID,
		SellerID:  sellerClub.ID,
		Price:     price,
		Status:    "active",
		CreatedAt: time.Now().UTC(),
	}
	player.OnMarket = true
	if err := svc.Store.UpdatePlayer(player); err != nil {
		return nil, err
	}
	if err := svc.Store.CreateListing(listing); err != nil {
		return nil, err
	}
	return listing, nil
}

// Cancel returns a listing to the seller without proceeds.
func (svc *Service) Cancel(sellerClubID, listingID string) error {
	listing, err := svc.Store.GetListing(listingID)
	if err != nil {
		return err
	}
	if listing.SellerID != sellerClubID {
		return ErrPlayerNotOwned
	}
	if listing.Status != "active" {
		return ErrListingClosed
	}
	listing.Status = "cancelled"
	if err := svc.Store.UpdateListing(listing); err != nil {
		return err
	}
	player, err := svc.Store.GetPlayer(listing.PlayerID)
	if err != nil {
		return err
	}
	player.OnMarket = false
	return svc.Store.UpdatePlayer(player)
}

// Buy executes the purchase: buyer pays, seller receives proceeds minus tax,
// and the player transfers clubs.
type BuyResult struct {
	Listing      *models.MarketListing `json:"listing"`
	Player       *models.Player        `json:"player"`
	Tax          int64                 `json:"tax"`
	SellerCredit int64                 `json:"sellerCredit"`
}

func (svc *Service) Buy(buyerUser *models.User, buyerClub *models.Club, listingID string) (*BuyResult, error) {
	listing, err := svc.Store.GetListing(listingID)
	if err != nil {
		return nil, err
	}
	if listing.Status != "active" {
		return nil, ErrListingClosed
	}
	if listing.SellerID == buyerClub.ID {
		return nil, ErrSelfBuy
	}
	if buyerUser.SoftCurrency < listing.Price {
		return nil, economy.ErrInsufficientSoft
	}

	// Resolve seller user (clubs owned by users only; AI clubs aren't sellers).
	sellerClub, err := svc.Store.GetClub(listing.SellerID)
	if err != nil {
		return nil, err
	}
	var sellerUser *models.User
	if sellerClub.OwnerUserID != "" {
		sellerUser, err = svc.Store.GetUser(sellerClub.OwnerUserID)
		if err != nil {
			return nil, err
		}
	}

	player, err := svc.Store.GetPlayer(listing.PlayerID)
	if err != nil {
		return nil, err
	}

	// Charge buyer first.
	if err := economy.SpendSoft(buyerUser, listing.Price); err != nil {
		return nil, err
	}
	credit, tax := economy.MarketTax(listing.Price)
	if sellerUser != nil {
		economy.GrantSoft(sellerUser, credit)
		if err := svc.Store.UpdateUser(sellerUser); err != nil {
			return nil, err
		}
	}

	// Move the player.
	removeFromSquad := func(c *models.Club, pid string) {
		out := c.Squad[:0]
		for _, id := range c.Squad {
			if id != pid {
				out = append(out, id)
			}
		}
		c.Squad = out
	}
	removeFromSquad(sellerClub, player.ID)
	if err := svc.Store.UpdateClub(sellerClub); err != nil {
		return nil, err
	}
	player.OwnerClubID = buyerClub.ID
	player.OnMarket = false
	if err := svc.Store.UpdatePlayer(player); err != nil {
		return nil, err
	}
	buyerClub.Squad = append(buyerClub.Squad, player.ID)
	if err := svc.Store.UpdateClub(buyerClub); err != nil {
		return nil, err
	}

	// Close listing.
	listing.Status = "sold"
	listing.BuyerID = buyerClub.ID
	if err := svc.Store.UpdateListing(listing); err != nil {
		return nil, err
	}
	if err := svc.Store.UpdateUser(buyerUser); err != nil {
		return nil, err
	}

	return &BuyResult{
		Listing:      listing,
		Player:       player,
		Tax:          tax,
		SellerCredit: credit,
	}, nil
}
