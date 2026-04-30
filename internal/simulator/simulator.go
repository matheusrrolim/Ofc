// Package simulator runs lightweight football match simulations from team
// composition. The output stays in the realistic 0-0 to 4-3 envelope while
// still rewarding stronger squads, better chemistry and coach bonuses.
package simulator

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/matheusrrolim/ofc/internal/chemistry"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
)

// Side bundles a team's matchday inputs.
type Side struct {
	Club    *models.Club
	Squad   []*models.Player
	Coach   *models.Coach
	IsHome  bool
}

// Strength describes the rated input that drives chance generation.
type Strength struct {
	Attack    float64 `json:"attack"`
	Defense   float64 `json:"defense"`
	Chemistry int     `json:"chemistry"`
	Coach     string  `json:"coach,omitempty"`
}

// computeStrength produces attack & defense scores from squad ratings.
// Outfield ratings count for both, weighted by position.
func computeStrength(s Side) Strength {
	var atk, def float64
	for _, p := range s.Squad {
		if p == nil {
			continue
		}
		r := float64(p.OverallRating)
		switch p.Position {
		case models.PosGK:
			def += r * 1.10
		case models.PosDEF:
			def += r * 1.00
			atk += r * 0.20
		case models.PosMID:
			def += r * 0.55
			atk += r * 0.55
		case models.PosATT:
			atk += r * 1.00
			def += r * 0.15
		}
	}

	chem := chemistry.Compute(s.Squad, s.Coach)
	chemMult := 1.0 + float64(chem.TotalBonus)/100.0

	tactical := 0
	stamina := 0
	coachName := ""
	if s.Coach != nil {
		tactical = s.Coach.Bonuses.TacticalBoost
		stamina = s.Coach.Bonuses.StaminaBoost
		coachName = s.Coach.Name
	}
	tactMult := 1.0 + float64(tactical)/100.0
	stamMult := 1.0 + float64(stamina)/200.0 // half weight: stamina helps less directly

	atk = atk * chemMult * tactMult * stamMult
	def = def * chemMult * tactMult

	if s.IsHome {
		atk *= 1.05
		def *= 1.05
	}

	return Strength{
		Attack:    atk,
		Defense:   def,
		Chemistry: chem.TotalBonus,
		Coach:     coachName,
	}
}

// Simulate plays a single match between two sides and returns the result.
// Mode is recorded on the match and influences nothing else.
func Simulate(home, away Side, mode string) *models.Match {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	hs := computeStrength(home)
	as := computeStrength(away)

	// Number of chances scales with combined strength but is capped to keep
	// scorelines realistic.
	chancesH := chancesFor(r, hs.Attack, as.Defense)
	chancesA := chancesFor(r, as.Attack, hs.Defense)

	homeGoals, hStats, hEvents := convertChances(r, chancesH, hs.Attack, as.Defense, "home")
	awayGoals, aStats, aEvents := convertChances(r, chancesA, as.Attack, hs.Defense, "away")

	hStats.Possession, aStats.Possession = possessionSplit(hs.Attack+hs.Defense, as.Attack+as.Defense, r)

	events := mergeEvents(hEvents, aEvents)

	match := &models.Match{
		ID:         generator.NewID("mch"),
		HomeClubID: home.Club.ID,
		AwayClubID: away.Club.ID,
		HomeName:   home.Club.Name,
		AwayName:   away.Club.Name,
		HomeGoals:  homeGoals,
		AwayGoals:  awayGoals,
		HomeStats:  hStats,
		AwayStats:  aStats,
		Events:     events,
		Mode:       mode,
		PlayedAt:   time.Now().UTC(),
	}
	return match
}

func chancesFor(r *rand.Rand, attack, defense float64) int {
	// Base 8 chances, modulated by attack/(defense+jitter).
	jitter := 50 + r.Float64()*120
	ratio := attack / (defense + jitter)
	chances := 4 + int(ratio*5) + r.Intn(3)
	if chances < 2 {
		chances = 2
	}
	if chances > 14 {
		chances = 14
	}
	return chances
}

func convertChances(r *rand.Rand, chances int, attack, defense float64, team string) (int, models.MatchStats, []models.MatchEvent) {
	stats := models.MatchStats{Chances: chances}
	events := []models.MatchEvent{}
	goals := 0
	for i := 0; i < chances; i++ {
		// goalChance = attack / (defense + randomFactor), clamped to a sane band.
		randomFactor := 200 + r.Float64()*500
		goalChance := attack / (defense + randomFactor)
		if goalChance > 0.45 {
			goalChance = 0.45
		}
		if goalChance < 0.04 {
			goalChance = 0.04
		}

		minute := 1 + r.Intn(90)
		stats.Shots++

		// Three-way outcome: goal / on-target save / off-target.
		roll := r.Float64()
		switch {
		case roll < goalChance:
			goals++
			stats.OnTarget++
			events = append(events, models.MatchEvent{
				Minute: minute, Team: team, Type: "goal",
				Note: fmt.Sprintf("Goal at %d'", minute),
			})
		case roll < goalChance+0.25:
			stats.OnTarget++
			events = append(events, models.MatchEvent{
				Minute: minute, Team: team, Type: "save",
				Note: fmt.Sprintf("Saved shot at %d'", minute),
			})
		default:
			events = append(events, models.MatchEvent{
				Minute: minute, Team: team, Type: "shot",
				Note: fmt.Sprintf("Off target at %d'", minute),
			})
		}
	}
	// Cap goals to keep results realistic.
	if goals > 5 {
		goals = 5
	}
	return goals, stats, events
}

func possessionSplit(strA, strB float64, r *rand.Rand) (int, int) {
	total := strA + strB
	if total == 0 {
		return 50, 50
	}
	a := int((strA/total)*100) + r.Intn(5) - 2
	if a < 30 {
		a = 30
	}
	if a > 70 {
		a = 70
	}
	return a, 100 - a
}

func mergeEvents(a, b []models.MatchEvent) []models.MatchEvent {
	out := make([]models.MatchEvent, 0, len(a)+len(b))
	out = append(out, a...)
	out = append(out, b...)
	// Sort by minute (small set; insertion sort is fine).
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j-1].Minute > out[j].Minute; j-- {
			out[j-1], out[j] = out[j], out[j-1]
		}
	}
	return out
}
