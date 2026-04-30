// Package economy centralizes currency rules, rewards and sinks. It guards
// against negative balances and overflow at the boundary.
package economy

import (
	"errors"

	"github.com/matheusrrolim/ofc/internal/models"
)

var (
	ErrInsufficientSoft    = errors.New("insufficient soft currency")
	ErrInsufficientPremium = errors.New("insufficient premium currency")
)

// Tunables. Tweak these to rebalance the economy.
const (
	StarterSoft       int64 = 5000
	StarterPremium    int64 = 100
	WinReward         int64 = 500
	DrawReward        int64 = 200
	LossReward        int64 = 100
	MarketTaxBp             = 700 // 7% in basis points (5%–10% allowed)
	MinListingPrice   int64 = 100
	MaxListingPrice   int64 = 50_000_000
	MaintenanceWeekly int64 = 250
	DailyMissionRwd   int64 = 300
	WeeklyMissionRwd  int64 = 1500

	BasicPackSoft    int64 = 1000
	PremiumPackSoft  int64 = 5000
	PremiumPackPrem  int64 = 50
	ElitePackPrem    int64 = 200
)

// SpendSoft attempts to deduct soft currency. Returns ErrInsufficientSoft if
// the user does not have enough.
func SpendSoft(u *models.User, amount int64) error {
	if amount <= 0 {
		return nil
	}
	if u.SoftCurrency < amount {
		return ErrInsufficientSoft
	}
	u.SoftCurrency -= amount
	return nil
}

func SpendPremium(u *models.User, amount int64) error {
	if amount <= 0 {
		return nil
	}
	if u.PremiumCurrency < amount {
		return ErrInsufficientPremium
	}
	u.PremiumCurrency -= amount
	return nil
}

func GrantSoft(u *models.User, amount int64) {
	if amount <= 0 {
		return
	}
	u.SoftCurrency += amount
}

func GrantPremium(u *models.User, amount int64) {
	if amount <= 0 {
		return
	}
	u.PremiumCurrency += amount
}

// MatchReward returns the soft currency reward for a result.
func MatchReward(homeGoals, awayGoals int, isHome bool) int64 {
	if homeGoals == awayGoals {
		return DrawReward
	}
	homeWon := homeGoals > awayGoals
	if (isHome && homeWon) || (!isHome && !homeWon) {
		return WinReward
	}
	return LossReward
}

// MarketTax returns (sellerProceeds, taxAmount) for a sale price.
func MarketTax(price int64) (int64, int64) {
	tax := price * int64(MarketTaxBp) / 10000
	return price - tax, tax
}
