package simulator

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
)

func mkClub(name string) *models.Club {
	return &models.Club{ID: name, Name: name}
}

// TestRealisticScorelines checks that a sample of simulated matches stay
// within the documented 0-0 to 4-3 envelope (with rare extension up to 5).
func TestRealisticScorelines(t *testing.T) {
	g := generator.New(123)
	hSquad := g.StarterSquad()
	aSquad := g.StarterSquad()

	hClub := mkClub("Home")
	aClub := mkClub("Away")

	for i := 0; i < 50; i++ {
		m := Simulate(
			Side{Club: hClub, Squad: hSquad, IsHome: true},
			Side{Club: aClub, Squad: aSquad, IsHome: false},
			"quick",
		)
		if m.HomeGoals < 0 || m.AwayGoals < 0 {
			t.Fatalf("negative goals: %d-%d", m.HomeGoals, m.AwayGoals)
		}
		if m.HomeGoals > 5 || m.AwayGoals > 5 {
			t.Fatalf("scoreline too high to be realistic: %d-%d", m.HomeGoals, m.AwayGoals)
		}
		if m.HomeStats.Possession+m.AwayStats.Possession != 100 {
			t.Fatalf("possession does not sum to 100: %d/%d", m.HomeStats.Possession, m.AwayStats.Possession)
		}
	}
}

func TestMatchHasEvents(t *testing.T) {
	g := generator.New(7)
	hSquad := g.StarterSquad()
	aSquad := g.StarterSquad()
	m := Simulate(
		Side{Club: mkClub("H"), Squad: hSquad, IsHome: true},
		Side{Club: mkClub("A"), Squad: aSquad, IsHome: false},
		"quick",
	)
	if len(m.Events) == 0 {
		t.Fatal("expected match events")
	}
	// Events must be in non-decreasing minute order.
	for i := 1; i < len(m.Events); i++ {
		if m.Events[i].Minute < m.Events[i-1].Minute {
			t.Fatalf("events not sorted: %v", m.Events)
		}
	}
}
