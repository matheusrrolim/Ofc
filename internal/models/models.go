// Package models defines the core data types shared across the game services.
package models

import "time"

type Position string

const (
	PosGK  Position = "GK"
	PosDEF Position = "DEF"
	PosMID Position = "MID"
	PosATT Position = "ATT"
)

type Rarity string

const (
	RarityCommon    Rarity = "common"
	RarityRare      Rarity = "rare"
	RarityEpic      Rarity = "epic"
	RarityLegendary Rarity = "legendary"
	RaritySpecial   Rarity = "special"
)

type Division string

const (
	DivBronze Division = "Bronze"
	DivSilver Division = "Silver"
	DivGold   Division = "Gold"
	DivElite  Division = "Elite"
)

// Attributes is the per-player rating breakdown. All values are 0-99.
type Attributes struct {
	Speed       int `json:"speed"`
	Strength    int `json:"strength"`
	Stamina     int `json:"stamina"`
	Passing     int `json:"passing"`
	BallControl int `json:"ballControl"`
	Finishing   int `json:"finishing"`
	Tackling    int `json:"tackling"`
	Positioning int `json:"positioning"`
	TacticalIQ  int `json:"tacticalIQ"`
	// Goalkeeper-only stats; zero for outfield players.
	Reflexes   int `json:"reflexes,omitempty"`
	Handling   int `json:"handling,omitempty"`
	Diving     int `json:"diving,omitempty"`
	Kicking    int `json:"kicking,omitempty"`
	GKPosition int `json:"gkPositioning,omitempty"`
}

type Player struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Nationality   string     `json:"nationality"`
	Age           int        `json:"age"`
	Position      Position   `json:"position"`
	Rarity        Rarity     `json:"rarity"`
	Attributes    Attributes `json:"attributes"`
	OverallRating int        `json:"overallRating"`
	OwnerClubID   string     `json:"ownerClubId,omitempty"`
	OnMarket      bool       `json:"onMarket"`
	CreatedAt     time.Time  `json:"createdAt"`
}

type CoachBonuses struct {
	TacticalBoost  int `json:"tacticalBoost"`  // % boost to attack/defense
	StaminaBoost   int `json:"staminaBoost"`   // % boost to stamina-driven outcomes
	ChemistryBoost int `json:"chemistryBoost"` // additive % to chemistry
}

type Coach struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Nationality  string       `json:"nationality"`
	Rarity       Rarity       `json:"rarity"`
	Bonuses      CoachBonuses `json:"bonuses"`
	OwnerClubID  string       `json:"ownerClubId,omitempty"`
	CreatedAt    time.Time    `json:"createdAt"`
}

type Club struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Logo           string    `json:"logo"`
	StadiumLevel   int       `json:"stadiumLevel"`
	ManagerID      string    `json:"managerId"` // active coach id
	Squad          []string  `json:"squad"`     // playerIds
	Roster         []string  `json:"roster"`    // all owned coach ids
	ChemistryScore int       `json:"chemistryScore"`
	OwnerUserID    string    `json:"ownerUserId"`
	IsAI           bool      `json:"isAI"`
	Wins           int       `json:"wins"`
	Draws          int       `json:"draws"`
	Losses         int       `json:"losses"`
	Points         int       `json:"points"`
	GoalsFor       int       `json:"goalsFor"`
	GoalsAgainst   int       `json:"goalsAgainst"`
	CreatedAt      time.Time `json:"createdAt"`
}

type User struct {
	ID              string    `json:"id"`
	Username        string    `json:"username"`
	Email           string    `json:"email"`
	PasswordHash    string    `json:"-"`
	PasswordSalt    string    `json:"-"`
	ClubID          string    `json:"clubId"`
	SoftCurrency    int64     `json:"softCurrency"`
	PremiumCurrency int64     `json:"premiumCurrency"`
	Division        Division  `json:"division"`
	CreatedAt       time.Time `json:"createdAt"`
}

type MarketListing struct {
	ID        string    `json:"id"`
	PlayerID  string    `json:"playerId"`
	SellerID  string    `json:"sellerId"` // club id
	Price     int64     `json:"price"`
	CreatedAt time.Time `json:"createdAt"`
	Status    string    `json:"status"` // active|sold|cancelled
	BuyerID   string    `json:"buyerId,omitempty"`
}

type MatchEvent struct {
	Minute int    `json:"minute"`
	Team   string `json:"team"` // home|away
	Type   string `json:"type"` // goal|shot|save
	Note   string `json:"note,omitempty"`
}

type MatchStats struct {
	Shots      int `json:"shots"`
	OnTarget   int `json:"onTarget"`
	Possession int `json:"possession"`
	Chances    int `json:"chances"`
}

type Match struct {
	ID         string       `json:"id"`
	HomeClubID string       `json:"homeClubId"`
	AwayClubID string       `json:"awayClubId"`
	HomeName   string       `json:"homeName"`
	AwayName   string       `json:"awayName"`
	HomeGoals  int          `json:"homeGoals"`
	AwayGoals  int          `json:"awayGoals"`
	HomeStats  MatchStats   `json:"homeStats"`
	AwayStats  MatchStats   `json:"awayStats"`
	Events     []MatchEvent `json:"events"`
	Mode       string       `json:"mode"` // quick|league|tournament
	PlayedAt   time.Time    `json:"playedAt"`
	Reward     int64        `json:"reward"`
}

type Mission struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Description string    `json:"description"`
	Goal        int       `json:"goal"`
	Progress    int       `json:"progress"`
	Reward      int64     `json:"reward"`
	Period      string    `json:"period"` // daily|weekly
	Completed   bool      `json:"completed"`
	Claimed     bool      `json:"claimed"`
	ResetAt     time.Time `json:"resetAt"`
}

type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
}
