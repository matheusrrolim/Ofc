package league

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/models"
)

func TestApplyMatchResultPoints(t *testing.T) {
	h := &models.Club{}
	a := &models.Club{}
	ApplyMatchResult(h, a, 2, 1)
	if h.Points != 3 || a.Points != 0 {
		t.Fatalf("home win points wrong: h=%d a=%d", h.Points, a.Points)
	}
	if h.Wins != 1 || a.Losses != 1 {
		t.Fatalf("W/L wrong")
	}
	ApplyMatchResult(h, a, 1, 1)
	if h.Points != 4 || a.Points != 1 {
		t.Fatalf("draw points wrong: h=%d a=%d", h.Points, a.Points)
	}
}

func TestPromoteOrRelegateLadder(t *testing.T) {
	if got := PromoteOrRelegate(models.DivBronze, PromotionThreshold); got != models.DivSilver {
		t.Fatalf("expected silver, got %s", got)
	}
	if got := PromoteOrRelegate(models.DivSilver, RelegationFloor-1); got != models.DivBronze {
		t.Fatalf("expected bronze, got %s", got)
	}
	if got := PromoteOrRelegate(models.DivElite, PromotionThreshold); got != models.DivElite {
		t.Fatalf("elite cannot promote further; got %s", got)
	}
	if got := PromoteOrRelegate(models.DivBronze, RelegationFloor-1); got != models.DivBronze {
		t.Fatalf("bronze cannot relegate further; got %s", got)
	}
}

func TestStandingsSortedByPointsThenGD(t *testing.T) {
	clubs := []*models.Club{
		{ID: "a", Name: "A", Points: 6, GoalsFor: 5, GoalsAgainst: 5},
		{ID: "b", Name: "B", Points: 6, GoalsFor: 7, GoalsAgainst: 3},
		{ID: "c", Name: "C", Points: 9, GoalsFor: 4, GoalsAgainst: 2},
	}
	rows := BuildStandings(clubs)
	if rows[0].ClubID != "c" || rows[1].ClubID != "b" || rows[2].ClubID != "a" {
		t.Fatalf("unexpected order: %v", rows)
	}
}
