package chemistry

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/models"
)

func mkPlayers(nationalities ...string) []*models.Player {
	out := make([]*models.Player, 0, len(nationalities))
	for _, n := range nationalities {
		out = append(out, &models.Player{Nationality: n})
	}
	return out
}

func TestBaseBonusLadder(t *testing.T) {
	tests := []struct {
		name string
		nats []string
		want int
	}{
		{"no synergy", []string{"A", "B", "C"}, 0},
		{"two same", []string{"A", "A", "B"}, 1},
		{"four same", []string{"A", "A", "A", "A"}, 3},
		{"six same", []string{"A", "A", "A", "A", "A", "A"}, 5},
		{"eight same", []string{"A", "A", "A", "A", "A", "A", "A", "A"}, 7},
		{"eleven same", []string{"A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A"}, 7},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Compute(mkPlayers(tt.nats...), nil)
			if got.BaseBonus != tt.want {
				t.Fatalf("BaseBonus=%d want %d", got.BaseBonus, tt.want)
			}
		})
	}
}

func TestCoachMatchBoost(t *testing.T) {
	players := mkPlayers("Brazil", "Brazil", "Brazil", "Brazil", "Spain")
	coach := &models.Coach{Nationality: "Brazil"}
	r := Compute(players, coach)
	if r.CoachBonus < 3 {
		t.Fatalf("expected coach bonus >=3 when nationality matches, got %d", r.CoachBonus)
	}
}

func TestCoachMismatchNoBoost(t *testing.T) {
	players := mkPlayers("Brazil", "Brazil", "Brazil", "Brazil")
	coach := &models.Coach{Nationality: "Spain"}
	r := Compute(players, coach)
	if r.CoachBonus != 0 {
		t.Fatalf("expected no coach bonus on mismatch, got %d", r.CoachBonus)
	}
}

func TestMaxBonusCapped(t *testing.T) {
	players := mkPlayers("A", "A", "A", "A", "A", "A", "A", "A") // base +7
	coach := &models.Coach{
		Nationality: "A",
		Bonuses:     models.CoachBonuses{ChemistryBoost: 99},
	}
	r := Compute(players, coach)
	if r.TotalBonus != MaxBonus {
		t.Fatalf("expected total capped at %d, got %d", MaxBonus, r.TotalBonus)
	}
}
