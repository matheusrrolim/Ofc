package store

import (
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/matheusrrolim/ofc/internal/models"
)

type memoryStore struct {
	mu       sync.RWMutex
	users    map[string]*models.User
	sessions map[string]*models.Session
	clubs    map[string]*models.Club
	players  map[string]*models.Player
	coaches  map[string]*models.Coach
	listings map[string]*models.MarketListing
	matches  map[string]*models.Match
	missions map[string]*models.Mission
}

func NewMemoryStore() Store {
	return &memoryStore{
		users:    map[string]*models.User{},
		sessions: map[string]*models.Session{},
		clubs:    map[string]*models.Club{},
		players:  map[string]*models.Player{},
		coaches:  map[string]*models.Coach{},
		listings: map[string]*models.MarketListing{},
		matches:  map[string]*models.Match{},
		missions: map[string]*models.Mission{},
	}
}

// --- Users ---

func (s *memoryStore) CreateUser(u *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[u.ID]; ok {
		return ErrAlreadyExists
	}
	for _, ex := range s.users {
		if strings.EqualFold(ex.Email, u.Email) || strings.EqualFold(ex.Username, u.Username) {
			return ErrAlreadyExists
		}
	}
	cp := *u
	s.users[u.ID] = &cp
	return nil
}

func (s *memoryStore) GetUser(id string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *u
	return &cp, nil
}

func (s *memoryStore) GetUserByEmail(email string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if strings.EqualFold(u.Email, email) {
			cp := *u
			return &cp, nil
		}
	}
	return nil, ErrNotFound
}

func (s *memoryStore) GetUserByUsername(username string) (*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if strings.EqualFold(u.Username, username) {
			cp := *u
			return &cp, nil
		}
	}
	return nil, ErrNotFound
}

func (s *memoryStore) UpdateUser(u *models.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[u.ID]; !ok {
		return ErrNotFound
	}
	cp := *u
	s.users[u.ID] = &cp
	return nil
}

func (s *memoryStore) ListUsers() ([]*models.User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.User, 0, len(s.users))
	for _, u := range s.users {
		cp := *u
		out = append(out, &cp)
	}
	return out, nil
}

// --- Sessions ---

func (s *memoryStore) CreateSession(sess *models.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *sess
	s.sessions[sess.Token] = &cp
	return nil
}

func (s *memoryStore) GetSession(token string) (*models.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[token]
	if !ok {
		return nil, ErrNotFound
	}
	if time.Now().After(sess.ExpiresAt) {
		return nil, ErrNotFound
	}
	cp := *sess
	return &cp, nil
}

func (s *memoryStore) DeleteSession(token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
	return nil
}

// --- Clubs ---

func (s *memoryStore) CreateClub(c *models.Club) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.clubs[c.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *c
	s.clubs[c.ID] = &cp
	return nil
}

func (s *memoryStore) GetClub(id string) (*models.Club, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.clubs[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *c
	cp.Squad = append([]string(nil), c.Squad...)
	cp.Roster = append([]string(nil), c.Roster...)
	return &cp, nil
}

func (s *memoryStore) UpdateClub(c *models.Club) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.clubs[c.ID]; !ok {
		return ErrNotFound
	}
	cp := *c
	cp.Squad = append([]string(nil), c.Squad...)
	cp.Roster = append([]string(nil), c.Roster...)
	s.clubs[c.ID] = &cp
	return nil
}

func (s *memoryStore) ListClubs() ([]*models.Club, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*models.Club, 0, len(s.clubs))
	for _, c := range s.clubs {
		cp := *c
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Points > out[j].Points })
	return out, nil
}

func (s *memoryStore) ListAIClubsByDivision(d models.Division) ([]*models.Club, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.Club{}
	for _, c := range s.clubs {
		if !c.IsAI {
			continue
		}
		// AI clubs share a virtual division with the user; we keep all AI for any division.
		_ = d
		cp := *c
		out = append(out, &cp)
	}
	return out, nil
}

// --- Players ---

func (s *memoryStore) CreatePlayer(p *models.Player) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.players[p.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *p
	s.players[p.ID] = &cp
	return nil
}

func (s *memoryStore) GetPlayer(id string) (*models.Player, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.players[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *p
	return &cp, nil
}

func (s *memoryStore) UpdatePlayer(p *models.Player) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.players[p.ID]; !ok {
		return ErrNotFound
	}
	cp := *p
	s.players[p.ID] = &cp
	return nil
}

func (s *memoryStore) DeletePlayer(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.players, id)
	return nil
}

func (s *memoryStore) ListPlayersByClub(clubID string) ([]*models.Player, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.Player{}
	for _, p := range s.players {
		if p.OwnerClubID == clubID {
			cp := *p
			out = append(out, &cp)
		}
	}
	return out, nil
}

// --- Coaches ---

func (s *memoryStore) CreateCoach(c *models.Coach) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.coaches[c.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *c
	s.coaches[c.ID] = &cp
	return nil
}

func (s *memoryStore) GetCoach(id string) (*models.Coach, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.coaches[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *c
	return &cp, nil
}

func (s *memoryStore) UpdateCoach(c *models.Coach) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.coaches[c.ID]; !ok {
		return ErrNotFound
	}
	cp := *c
	s.coaches[c.ID] = &cp
	return nil
}

func (s *memoryStore) ListCoachesByClub(clubID string) ([]*models.Coach, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.Coach{}
	for _, c := range s.coaches {
		if c.OwnerClubID == clubID {
			cp := *c
			out = append(out, &cp)
		}
	}
	return out, nil
}

// --- Listings ---

func (s *memoryStore) CreateListing(l *models.MarketListing) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.listings[l.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *l
	s.listings[l.ID] = &cp
	return nil
}

func (s *memoryStore) GetListing(id string) (*models.MarketListing, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	l, ok := s.listings[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *l
	return &cp, nil
}

func (s *memoryStore) UpdateListing(l *models.MarketListing) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.listings[l.ID]; !ok {
		return ErrNotFound
	}
	cp := *l
	s.listings[l.ID] = &cp
	return nil
}

func (s *memoryStore) ListActiveListings() ([]*models.MarketListing, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.MarketListing{}
	for _, l := range s.listings {
		if l.Status == "active" {
			cp := *l
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (s *memoryStore) ListListingsBySeller(clubID string) ([]*models.MarketListing, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.MarketListing{}
	for _, l := range s.listings {
		if l.SellerID == clubID {
			cp := *l
			out = append(out, &cp)
		}
	}
	return out, nil
}

// --- Matches ---

func (s *memoryStore) CreateMatch(m *models.Match) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.matches[m.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *m
	s.matches[m.ID] = &cp
	return nil
}

func (s *memoryStore) GetMatch(id string) (*models.Match, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, ok := s.matches[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *m
	return &cp, nil
}

func (s *memoryStore) ListMatchesByClub(clubID string, limit int) ([]*models.Match, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.Match{}
	for _, m := range s.matches {
		if m.HomeClubID == clubID || m.AwayClubID == clubID {
			cp := *m
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PlayedAt.After(out[j].PlayedAt) })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

// --- Missions ---

func (s *memoryStore) CreateMission(m *models.Mission) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.missions[m.ID]; ok {
		return ErrAlreadyExists
	}
	cp := *m
	s.missions[m.ID] = &cp
	return nil
}

func (s *memoryStore) GetMission(id string) (*models.Mission, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m, ok := s.missions[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *m
	return &cp, nil
}

func (s *memoryStore) UpdateMission(m *models.Mission) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.missions[m.ID]; !ok {
		return ErrNotFound
	}
	cp := *m
	s.missions[m.ID] = &cp
	return nil
}

func (s *memoryStore) ListMissionsByUser(userID string) ([]*models.Mission, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []*models.Mission{}
	for _, m := range s.missions {
		if m.UserID == userID {
			cp := *m
			out = append(out, &cp)
		}
	}
	return out, nil
}
