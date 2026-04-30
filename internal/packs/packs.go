// Package packs implements pack/chest opening with rarity-driven drop tables.
// Packs are deliberately one of several progression paths, not the only one.
package packs

import (
	"errors"

	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

var ErrUnknownPack = errors.New("unknown pack")

type Pack struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	PriceSoft   int64  `json:"priceSoft"`
	PricePrem   int64  `json:"pricePremium"`
	PlayerCount int    `json:"playerCount"`
	CoachChance int    `json:"coachChance"` // % chance one of the slots is a coach
	Tier        string `json:"tier"`        // basic|premium|elite
}

func Catalog() []Pack {
	return []Pack{
		{ID: "basic", Name: "Basic Pack", PriceSoft: economy.BasicPackSoft, PlayerCount: 3, CoachChance: 5, Tier: "basic"},
		{ID: "premium", Name: "Premium Pack", PriceSoft: economy.PremiumPackSoft, PricePrem: economy.PremiumPackPrem, PlayerCount: 4, CoachChance: 15, Tier: "premium"},
		{ID: "elite", Name: "Elite Pack", PricePrem: economy.ElitePackPrem, PlayerCount: 5, CoachChance: 25, Tier: "elite"},
	}
}

func GetPack(id string) (Pack, error) {
	for _, p := range Catalog() {
		if p.ID == id {
			return p, nil
		}
	}
	return Pack{}, ErrUnknownPack
}

// Result is what the player sees after opening a pack.
type Result struct {
	Pack    Pack             `json:"pack"`
	Players []*models.Player `json:"players"`
	Coach   *models.Coach    `json:"coach,omitempty"`
}

// Service exposes pack-opening behavior.
type Service struct {
	Store store.Store
	Gen   *generator.Generator
}

func NewService(s store.Store, g *generator.Generator) *Service {
	return &Service{Store: s, Gen: g}
}

// Open charges the user, persists the new players/coach to the user's club,
// and returns the result. Currency rules are enforced atomically with respect
// to the in-memory store guarantees.
func (svc *Service) Open(user *models.User, club *models.Club, packID string, payCurrency string) (*Result, error) {
	pack, err := GetPack(packID)
	if err != nil {
		return nil, err
	}

	// Charge appropriate currency.
	switch payCurrency {
	case "soft":
		if pack.PriceSoft <= 0 {
			return nil, errors.New("pack does not accept soft currency")
		}
		if err := economy.SpendSoft(user, pack.PriceSoft); err != nil {
			return nil, err
		}
	case "premium":
		if pack.PricePrem <= 0 {
			return nil, errors.New("pack does not accept premium currency")
		}
		if err := economy.SpendPremium(user, pack.PricePrem); err != nil {
			return nil, err
		}
	default:
		return nil, errors.New("invalid currency")
	}

	res := &Result{Pack: pack}

	for i := 0; i < pack.PlayerCount; i++ {
		rarity := svc.Gen.RarityRoll(pack.Tier)
		pos := svc.Gen.RandomPosition()
		p := svc.Gen.GeneratePlayer(pos, rarity)
		p.OwnerClubID = club.ID
		if err := svc.Store.CreatePlayer(p); err != nil {
			return nil, err
		}
		club.Squad = append(club.Squad, p.ID)
		res.Players = append(res.Players, p)
	}

	// Coach roll. Some packs include a coach as a bonus.
	if svc.Gen.RollPercent(pack.CoachChance) {
		coach := svc.Gen.GenerateCoach(svc.Gen.RarityRoll(pack.Tier))
		coach.OwnerClubID = club.ID
		if err := svc.Store.CreateCoach(coach); err != nil {
			return nil, err
		}
		club.Roster = append(club.Roster, coach.ID)
		// Auto-assign as manager if club doesn't have one.
		if club.ManagerID == "" {
			club.ManagerID = coach.ID
		}
		res.Coach = coach
	}

	if err := svc.Store.UpdateUser(user); err != nil {
		return nil, err
	}
	if err := svc.Store.UpdateClub(club); err != nil {
		return nil, err
	}
	return res, nil
}

