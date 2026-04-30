// Package missions provides daily and weekly mission templates and tracks
// per-user progress.
package missions

import (
	"time"

	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

type Service struct {
	Store store.Store
}

func NewService(s store.Store) *Service { return &Service{Store: s} }

func (svc *Service) Ensure(userID string) ([]*models.Mission, error) {
	existing, err := svc.Store.ListMissionsByUser(userID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	// Refresh expired missions in place.
	for _, m := range existing {
		if now.After(m.ResetAt) {
			m.Progress = 0
			m.Completed = false
			m.Claimed = false
			m.ResetAt = nextReset(m.Period, now)
			_ = svc.Store.UpdateMission(m)
		}
	}
	if len(existing) >= 4 {
		return svc.Store.ListMissionsByUser(userID)
	}
	// Seed defaults.
	defaults := []*models.Mission{
		{
			ID: generator.NewID("msn"), UserID: userID,
			Description: "Win 3 matches today", Goal: 3, Reward: economy.DailyMissionRwd,
			Period: "daily", ResetAt: nextReset("daily", now),
		},
		{
			ID: generator.NewID("msn"), UserID: userID,
			Description: "Score 5 goals today", Goal: 5, Reward: economy.DailyMissionRwd,
			Period: "daily", ResetAt: nextReset("daily", now),
		},
		{
			ID: generator.NewID("msn"), UserID: userID,
			Description: "Open 5 packs this week", Goal: 5, Reward: economy.WeeklyMissionRwd,
			Period: "weekly", ResetAt: nextReset("weekly", now),
		},
		{
			ID: generator.NewID("msn"), UserID: userID,
			Description: "Sell 3 players this week", Goal: 3, Reward: economy.WeeklyMissionRwd,
			Period: "weekly", ResetAt: nextReset("weekly", now),
		},
	}
	for _, m := range defaults {
		_ = svc.Store.CreateMission(m)
	}
	return svc.Store.ListMissionsByUser(userID)
}

// Track increments mission progress matching a key, returning any missions
// that just completed.
func (svc *Service) Track(userID, key string, amount int) ([]*models.Mission, error) {
	all, err := svc.Ensure(userID)
	if err != nil {
		return nil, err
	}
	var completed []*models.Mission
	for _, m := range all {
		if !matches(m, key) || m.Completed {
			continue
		}
		m.Progress += amount
		if m.Progress >= m.Goal {
			m.Progress = m.Goal
			m.Completed = true
			completed = append(completed, m)
		}
		_ = svc.Store.UpdateMission(m)
	}
	return completed, nil
}

func matches(m *models.Mission, key string) bool {
	switch key {
	case "match_win":
		return contains(m.Description, "Win")
	case "goal_scored":
		return contains(m.Description, "Score")
	case "pack_open":
		return contains(m.Description, "pack")
	case "player_sold":
		return contains(m.Description, "Sell")
	}
	return false
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func nextReset(period string, now time.Time) time.Time {
	switch period {
	case "weekly":
		return now.Add(7 * 24 * time.Hour)
	default:
		return time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	}
}

// Claim grants the reward for a completed mission, marking it claimed.
func (svc *Service) Claim(user *models.User, missionID string) (*models.Mission, error) {
	m, err := svc.Store.GetMission(missionID)
	if err != nil {
		return nil, err
	}
	if m.UserID != user.ID || !m.Completed || m.Claimed {
		return m, nil
	}
	economy.GrantSoft(user, m.Reward)
	m.Claimed = true
	if err := svc.Store.UpdateMission(m); err != nil {
		return nil, err
	}
	if err := svc.Store.UpdateUser(user); err != nil {
		return nil, err
	}
	return m, nil
}
