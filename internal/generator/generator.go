// Package generator produces procedurally generated players, coaches and
// clubs. It contains no real-world names.
package generator

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	mrand "math/rand"
	"time"

	"github.com/matheusrrolim/ofc/internal/models"
)

// NewID returns a short opaque identifier suitable for primary keys.
func NewID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// Fallback: should never happen.
		return prefix + "_" + time.Now().Format("20060102150405.000")
	}
	return prefix + "_" + hex.EncodeToString(b)
}

// Generator wraps a math/rand source so callers can control determinism in
// tests.
type Generator struct {
	r *mrand.Rand
}

func New(seed int64) *Generator {
	if seed == 0 {
		// non-deterministic seed using crypto/rand for entropy
		max := big.NewInt(1<<62 - 1)
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			seed = time.Now().UnixNano()
		} else {
			seed = n.Int64()
		}
	}
	return &Generator{r: mrand.New(mrand.NewSource(seed))}
}

func (g *Generator) pick(s []string) string {
	return s[g.r.Intn(len(s))]
}

func (g *Generator) RandomName() string {
	return g.pick(firstNames) + " " + g.pick(lastNames)
}

func (g *Generator) RandomNationality() string {
	return g.pick(nationalities)
}

func (g *Generator) RandomClubName() string {
	return g.pick(clubPrefixes) + " " + g.pick(clubSuffixes)
}

// RollPercent returns true with probability pct/100. pct is clamped.
func (g *Generator) RollPercent(pct int) bool {
	if pct <= 0 {
		return false
	}
	if pct >= 100 {
		return true
	}
	return g.r.Intn(100) < pct
}

// IntRange returns an int in [lo, hi] inclusive.
func (g *Generator) IntRange(lo, hi int) int {
	if hi <= lo {
		return lo
	}
	return lo + g.r.Intn(hi-lo+1)
}

// rarityRange returns the inclusive [min,max] attribute range for a rarity.
func rarityRange(r models.Rarity) (int, int) {
	switch r {
	case models.RarityCommon:
		return 50, 65
	case models.RarityRare:
		return 60, 75
	case models.RarityEpic:
		return 70, 85
	case models.RarityLegendary:
		return 80, 95
	case models.RaritySpecial:
		return 85, 99
	default:
		return 50, 65
	}
}

func (g *Generator) attrInRange(min, max int) int {
	return min + g.r.Intn(max-min+1)
}

// GeneratePlayer creates a fresh player with attributes biased toward its
// position. The overall rating is a weighted average using the same weights.
func (g *Generator) GeneratePlayer(pos models.Position, rarity models.Rarity) *models.Player {
	min, max := rarityRange(rarity)
	a := models.Attributes{
		Speed:       g.attrInRange(min, max),
		Strength:    g.attrInRange(min, max),
		Stamina:     g.attrInRange(min, max),
		Passing:     g.attrInRange(min, max),
		BallControl: g.attrInRange(min, max),
		Finishing:   g.attrInRange(min, max),
		Tackling:    g.attrInRange(min, max),
		Positioning: g.attrInRange(min, max),
		TacticalIQ:  g.attrInRange(min, max),
	}

	// Bias attributes toward role to make positions feel distinct.
	bias := 6
	switch pos {
	case models.PosATT:
		a.Finishing = clamp(a.Finishing+bias, 0, 99)
		a.Speed = clamp(a.Speed+bias/2, 0, 99)
		a.BallControl = clamp(a.BallControl+bias/2, 0, 99)
		a.Tackling = clamp(a.Tackling-bias/2, 1, 99)
	case models.PosMID:
		a.Passing = clamp(a.Passing+bias, 0, 99)
		a.TacticalIQ = clamp(a.TacticalIQ+bias/2, 0, 99)
		a.Stamina = clamp(a.Stamina+bias/2, 0, 99)
	case models.PosDEF:
		a.Tackling = clamp(a.Tackling+bias, 0, 99)
		a.Strength = clamp(a.Strength+bias/2, 0, 99)
		a.Positioning = clamp(a.Positioning+bias/2, 0, 99)
	case models.PosGK:
		// Goalkeepers share the same range but get GK-only stats; outfield
		// stats remain meaningful for distribution but are penalized.
		a.Reflexes = g.attrInRange(min, max)
		a.Handling = g.attrInRange(min, max)
		a.Diving = g.attrInRange(min, max)
		a.Kicking = g.attrInRange(min, max)
		a.GKPosition = g.attrInRange(min, max)
		a.Finishing = clamp(a.Finishing-15, 1, 60)
		a.Tackling = clamp(a.Tackling-10, 1, 70)
	}

	p := &models.Player{
		ID:            NewID("ply"),
		Name:          g.RandomName(),
		Nationality:   g.RandomNationality(),
		Age:           18 + g.r.Intn(18), // 18..35
		Position:      pos,
		Rarity:        rarity,
		Attributes:    a,
		OverallRating: ComputeOverall(pos, a),
		CreatedAt:     time.Now().UTC(),
	}
	return p
}

// GenerateCoach creates a coach with rarity-scaled bonuses.
func (g *Generator) GenerateCoach(rarity models.Rarity) *models.Coach {
	tactical, stamina, chem := coachBonusesFor(rarity, g)
	return &models.Coach{
		ID:          NewID("cch"),
		Name:        g.RandomName(),
		Nationality: g.RandomNationality(),
		Rarity:      rarity,
		Bonuses: models.CoachBonuses{
			TacticalBoost:  tactical,
			StaminaBoost:   stamina,
			ChemistryBoost: chem,
		},
		CreatedAt: time.Now().UTC(),
	}
}

func coachBonusesFor(r models.Rarity, g *Generator) (int, int, int) {
	switch r {
	case models.RarityCommon:
		return 1 + g.r.Intn(2), 1 + g.r.Intn(2), 0
	case models.RarityRare:
		return 2 + g.r.Intn(2), 2 + g.r.Intn(2), 0
	case models.RarityEpic:
		return 3 + g.r.Intn(2), 3 + g.r.Intn(2), 1
	case models.RarityLegendary:
		return 4 + g.r.Intn(3), 4 + g.r.Intn(2), 2
	case models.RaritySpecial:
		return 5 + g.r.Intn(3), 5 + g.r.Intn(2), 3
	}
	return 1, 1, 0
}

// ComputeOverall returns the weighted average of attributes for a position.
func ComputeOverall(pos models.Position, a models.Attributes) int {
	type w struct {
		v, weight int
	}
	var weights []w
	switch pos {
	case models.PosGK:
		weights = []w{
			{a.Reflexes, 5}, {a.Handling, 4}, {a.Diving, 4},
			{a.GKPosition, 4}, {a.Kicking, 2}, {a.Positioning, 2},
			{a.Strength, 1}, {a.TacticalIQ, 1},
		}
	case models.PosDEF:
		weights = []w{
			{a.Tackling, 5}, {a.Strength, 4}, {a.Positioning, 4},
			{a.Stamina, 3}, {a.Speed, 3}, {a.TacticalIQ, 3},
			{a.Passing, 2}, {a.BallControl, 1},
		}
	case models.PosMID:
		weights = []w{
			{a.Passing, 5}, {a.BallControl, 4}, {a.TacticalIQ, 4},
			{a.Stamina, 4}, {a.Positioning, 3}, {a.Tackling, 2},
			{a.Speed, 2}, {a.Finishing, 2},
		}
	case models.PosATT:
		weights = []w{
			{a.Finishing, 5}, {a.Speed, 4}, {a.BallControl, 4},
			{a.Positioning, 3}, {a.Passing, 2}, {a.Strength, 2},
			{a.TacticalIQ, 2}, {a.Stamina, 1},
		}
	}
	var sum, ws int
	for _, x := range weights {
		sum += x.v * x.weight
		ws += x.weight
	}
	if ws == 0 {
		return 0
	}
	return sum / ws
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// StarterPack produces a balanced 18-player squad for new clubs:
// 2 GKs, 6 DEF, 6 MID, 4 ATT.
func (g *Generator) StarterSquad() []*models.Player {
	type slot struct {
		pos    models.Position
		count  int
		rarity models.Rarity
	}
	plan := []slot{
		{models.PosGK, 2, models.RarityCommon},
		{models.PosDEF, 4, models.RarityCommon},
		{models.PosDEF, 2, models.RarityRare},
		{models.PosMID, 4, models.RarityCommon},
		{models.PosMID, 2, models.RarityRare},
		{models.PosATT, 3, models.RarityCommon},
		{models.PosATT, 1, models.RarityRare},
	}
	out := []*models.Player{}
	for _, s := range plan {
		for i := 0; i < s.count; i++ {
			out = append(out, g.GeneratePlayer(s.pos, s.rarity))
		}
	}
	return out
}

// RarityRoll returns a rarity for pack openings. Higher tier packs override
// the base distribution.
func (g *Generator) RarityRoll(tier string) models.Rarity {
	roll := g.r.Float64()
	switch tier {
	case "premium":
		switch {
		case roll < 0.45:
			return models.RarityRare
		case roll < 0.80:
			return models.RarityEpic
		case roll < 0.96:
			return models.RarityLegendary
		default:
			return models.RaritySpecial
		}
	case "elite":
		switch {
		case roll < 0.40:
			return models.RarityEpic
		case roll < 0.85:
			return models.RarityLegendary
		default:
			return models.RaritySpecial
		}
	default: // basic
		switch {
		case roll < 0.70:
			return models.RarityCommon
		case roll < 0.92:
			return models.RarityRare
		case roll < 0.99:
			return models.RarityEpic
		default:
			return models.RarityLegendary
		}
	}
}

// RandomPosition picks a position weighted toward outfield slots.
func (g *Generator) RandomPosition() models.Position {
	roll := g.r.Float64()
	switch {
	case roll < 0.10:
		return models.PosGK
	case roll < 0.40:
		return models.PosDEF
	case roll < 0.75:
		return models.PosMID
	default:
		return models.PosATT
	}
}
