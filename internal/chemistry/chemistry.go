// Package chemistry computes nationality synergy bonuses for a squad.
//
// The bonus follows a progressive ladder on the size of the largest
// nationality block in the squad:
//
//	2 players → +1%
//	4 players → +3%
//	6 players → +5%
//	8+ players → +7%
//
// A coach whose nationality matches the majority adds +3% (or +5% if the
// majority is 6+ players). Their ChemistryBoost stat adds further on top.
//
// The total bonus is capped at +10%.
package chemistry

import (
	"github.com/matheusrrolim/ofc/internal/models"
)

const MaxBonus = 10

// Result describes the chemistry computation output.
type Result struct {
	NationalityCounts map[string]int `json:"nationalityCounts"`
	MajorityNation    string         `json:"majorityNation"`
	MajoritySize      int            `json:"majoritySize"`
	BaseBonus         int            `json:"baseBonus"`
	CoachBonus        int            `json:"coachBonus"`
	TotalBonus        int            `json:"totalBonus"` // capped percentage
}

// Compute evaluates chemistry for a squad with an optional coach.
// `players` should be the active matchday squad (typically 11).
func Compute(players []*models.Player, coach *models.Coach) Result {
	counts := map[string]int{}
	for _, p := range players {
		if p == nil {
			continue
		}
		counts[p.Nationality]++
	}

	majority := ""
	majSize := 0
	for nat, c := range counts {
		if c > majSize {
			majority = nat
			majSize = c
		}
	}

	base := baseBonus(majSize)

	coachBonus := 0
	if coach != nil {
		if coach.Nationality == majority && majSize >= 2 {
			if majSize >= 6 {
				coachBonus = 5
			} else {
				coachBonus = 3
			}
		}
		coachBonus += coach.Bonuses.ChemistryBoost
	}

	total := base + coachBonus
	if total > MaxBonus {
		total = MaxBonus
	}
	if total < 0 {
		total = 0
	}

	return Result{
		NationalityCounts: counts,
		MajorityNation:    majority,
		MajoritySize:      majSize,
		BaseBonus:         base,
		CoachBonus:        coachBonus,
		TotalBonus:        total,
	}
}

func baseBonus(largest int) int {
	switch {
	case largest >= 8:
		return 7
	case largest >= 6:
		return 5
	case largest >= 4:
		return 3
	case largest >= 2:
		return 1
	default:
		return 0
	}
}
