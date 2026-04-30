// Package store defines the persistence interface used by all services.
// The in-memory implementation lives next to it; production deployments can
// swap in MongoDB / Firestore by satisfying the same interface.
package store

import (
	"errors"

	"github.com/matheusrrolim/ofc/internal/models"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
	ErrConflict      = errors.New("conflict")
)

type Store interface {
	// Users
	CreateUser(u *models.User) error
	GetUser(id string) (*models.User, error)
	GetUserByEmail(email string) (*models.User, error)
	GetUserByUsername(username string) (*models.User, error)
	UpdateUser(u *models.User) error
	ListUsers() ([]*models.User, error)

	// Sessions
	CreateSession(s *models.Session) error
	GetSession(token string) (*models.Session, error)
	DeleteSession(token string) error

	// Clubs
	CreateClub(c *models.Club) error
	GetClub(id string) (*models.Club, error)
	UpdateClub(c *models.Club) error
	ListClubs() ([]*models.Club, error)
	ListAIClubsByDivision(d models.Division) ([]*models.Club, error)

	// Players
	CreatePlayer(p *models.Player) error
	GetPlayer(id string) (*models.Player, error)
	UpdatePlayer(p *models.Player) error
	DeletePlayer(id string) error
	ListPlayersByClub(clubID string) ([]*models.Player, error)

	// Coaches
	CreateCoach(c *models.Coach) error
	GetCoach(id string) (*models.Coach, error)
	UpdateCoach(c *models.Coach) error
	ListCoachesByClub(clubID string) ([]*models.Coach, error)

	// Marketplace
	CreateListing(l *models.MarketListing) error
	GetListing(id string) (*models.MarketListing, error)
	UpdateListing(l *models.MarketListing) error
	ListActiveListings() ([]*models.MarketListing, error)
	ListListingsBySeller(clubID string) ([]*models.MarketListing, error)

	// Matches
	CreateMatch(m *models.Match) error
	GetMatch(id string) (*models.Match, error)
	ListMatchesByClub(clubID string, limit int) ([]*models.Match, error)

	// Missions
	CreateMission(m *models.Mission) error
	GetMission(id string) (*models.Mission, error)
	UpdateMission(m *models.Mission) error
	ListMissionsByUser(userID string) ([]*models.Mission, error)
}
