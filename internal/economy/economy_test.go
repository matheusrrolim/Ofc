package economy

import (
	"testing"

	"github.com/matheusrrolim/ofc/internal/models"
)

func TestSpendSoftRespectsBalance(t *testing.T) {
	u := &models.User{SoftCurrency: 100}
	if err := SpendSoft(u, 50); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if u.SoftCurrency != 50 {
		t.Fatalf("expected 50, got %d", u.SoftCurrency)
	}
	if err := SpendSoft(u, 1000); err == nil {
		t.Fatal("expected insufficient funds error")
	}
	if u.SoftCurrency != 50 {
		t.Fatalf("balance changed despite error: %d", u.SoftCurrency)
	}
}

func TestMarketTaxBracket(t *testing.T) {
	credit, tax := MarketTax(10000)
	if credit+tax != 10000 {
		t.Fatalf("credit+tax should equal price: %d + %d", credit, tax)
	}
	if tax < 500 || tax > 1000 { // 5%–10% range
		t.Fatalf("tax out of allowed band: %d", tax)
	}
}

func TestMatchReward(t *testing.T) {
	if r := MatchReward(2, 1, true); r != WinReward {
		t.Fatalf("home win reward: %d", r)
	}
	if r := MatchReward(2, 1, false); r != LossReward {
		t.Fatalf("away loss reward: %d", r)
	}
	if r := MatchReward(2, 2, true); r != DrawReward {
		t.Fatalf("draw reward: %d", r)
	}
}
