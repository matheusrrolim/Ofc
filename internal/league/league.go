// Package league computes division standings and handles promotion/relegation.
package league

import (
	"sort"

	"github.com/matheusrrolim/ofc/internal/models"
)

// Order divisions from lowest to highest.
var Divisions = []models.Division{models.DivBronze, models.DivSilver, models.DivGold, models.DivElite}

// Threshold points for season-end promotion/relegation.
const (
	PromotionThreshold = 30
	RelegationFloor    = 10
)

type StandingRow struct {
	ClubID       string `json:"clubId"`
	Name         string `json:"name"`
	Played       int    `json:"played"`
	Wins         int    `json:"wins"`
	Draws        int    `json:"draws"`
	Losses       int    `json:"losses"`
	GoalsFor     int    `json:"goalsFor"`
	GoalsAgainst int    `json:"goalsAgainst"`
	GoalDiff     int    `json:"goalDiff"`
	Points       int    `json:"points"`
	IsAI         bool   `json:"isAI"`
}

func BuildStandings(clubs []*models.Club) []StandingRow {
	rows := make([]StandingRow, 0, len(clubs))
	for _, c := range clubs {
		rows = append(rows, StandingRow{
			ClubID:       c.ID,
			Name:         c.Name,
			Played:       c.Wins + c.Draws + c.Losses,
			Wins:         c.Wins,
			Draws:        c.Draws,
			Losses:       c.Losses,
			GoalsFor:     c.GoalsFor,
			GoalsAgainst: c.GoalsAgainst,
			GoalDiff:     c.GoalsFor - c.GoalsAgainst,
			Points:       c.Points,
			IsAI:         c.IsAI,
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Points != rows[j].Points {
			return rows[i].Points > rows[j].Points
		}
		if rows[i].GoalDiff != rows[j].GoalDiff {
			return rows[i].GoalDiff > rows[j].GoalDiff
		}
		return rows[i].GoalsFor > rows[j].GoalsFor
	})
	return rows
}

// ApplyMatchResult updates points/goals fields on the two clubs in-place.
// Caller is responsible for persisting them.
func ApplyMatchResult(home, away *models.Club, homeGoals, awayGoals int) {
	home.GoalsFor += homeGoals
	home.GoalsAgainst += awayGoals
	away.GoalsFor += awayGoals
	away.GoalsAgainst += homeGoals
	switch {
	case homeGoals > awayGoals:
		home.Wins++
		home.Points += 3
		away.Losses++
	case homeGoals < awayGoals:
		away.Wins++
		away.Points += 3
		home.Losses++
	default:
		home.Draws++
		away.Draws++
		home.Points++
		away.Points++
	}
}

// PromoteOrRelegate returns the new division for the user based on points.
// Promotion is granted at PromotionThreshold; relegation if below RelegationFloor.
func PromoteOrRelegate(current models.Division, points int) models.Division {
	idx := -1
	for i, d := range Divisions {
		if d == current {
			idx = i
			break
		}
	}
	if idx == -1 {
		return models.DivBronze
	}
	if points >= PromotionThreshold && idx < len(Divisions)-1 {
		return Divisions[idx+1]
	}
	if points < RelegationFloor && idx > 0 {
		return Divisions[idx-1]
	}
	return current
}

// SeasonReset zeroes win/draw/loss/points/goals tallies on a club.
func SeasonReset(c *models.Club) {
	c.Wins, c.Draws, c.Losses = 0, 0, 0
	c.Points = 0
	c.GoalsFor, c.GoalsAgainst = 0, 0
}
