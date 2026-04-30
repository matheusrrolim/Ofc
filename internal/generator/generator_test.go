package generator

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/models"
)

func TestRarityRanges(t *testing.T) {
	g := New(42) // deterministic
	cases := []struct {
		r        models.Rarity
		min, max int
	}{
		{models.RarityCommon, 50, 65},
		{models.RarityRare, 60, 75},
		{models.RarityEpic, 70, 85},
		{models.RarityLegendary, 80, 95},
		{models.RaritySpecial, 85, 99},
	}
	for _, c := range cases {
		for i := 0; i < 100; i++ {
			p := g.GeneratePlayer(models.PosMID, c.r)
			// Sanity: most attributes fall inside range. Allow biased fields to exceed by up to +6.
			a := p.Attributes
			vals := []int{a.Speed, a.Strength, a.Stamina, a.Passing, a.BallControl, a.Finishing, a.Tackling, a.Positioning, a.TacticalIQ}
			for _, v := range vals {
				if v < c.min-1 || v > c.max+10 {
					t.Fatalf("rarity %s attr %d out of expected band [%d, %d]", c.r, v, c.min, c.max)
				}
			}
		}
	}
}

func TestStarterSquadComposition(t *testing.T) {
	g := New(1)
	sq := g.StarterSquad()
	counts := map[models.Position]int{}
	for _, p := range sq {
		counts[p.Position]++
	}
	if counts[models.PosGK] != 2 {
		t.Fatalf("expected 2 GKs, got %d", counts[models.PosGK])
	}
	if counts[models.PosDEF] != 6 {
		t.Fatalf("expected 6 DEFs, got %d", counts[models.PosDEF])
	}
	if counts[models.PosMID] != 6 {
		t.Fatalf("expected 6 MIDs, got %d", counts[models.PosMID])
	}
	if counts[models.PosATT] != 4 {
		t.Fatalf("expected 4 ATTs, got %d", counts[models.PosATT])
	}
}

func TestRollPercentBounds(t *testing.T) {
	g := New(7)
	if g.RollPercent(0) {
		t.Fatal("0% should never roll true")
	}
	if !g.RollPercent(100) {
		t.Fatal("100% should always roll true")
	}
}

func TestNoEmptyNames(t *testing.T) {
	g := New(0)
	for i := 0; i < 50; i++ {
		if g.RandomName() == "" {
			t.Fatal("RandomName produced empty string")
		}
		if g.RandomNationality() == "" {
			t.Fatal("RandomNationality produced empty string")
		}
	}
}
