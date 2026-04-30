package api

import (
	"net/http"
	"strconv"

	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/league"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/simulator"
)

type quickMatchReq struct {
	OpponentClubID string `json:"opponentClubId,omitempty"`
}

// pickAIClub returns a random AI club, generating one on the fly if none exists.
func (s *Server) pickAIClub() (*models.Club, error) {
	clubs, err := s.Store.ListAIClubsByDivision(models.DivBronze)
	if err != nil {
		return nil, err
	}
	if len(clubs) > 0 {
		return clubs[s.Gen.IntRange(0, len(clubs)-1)], nil
	}
	// Lazily build an AI club.
	return s.spawnAIClub(models.RarityCommon)
}

func (s *Server) spawnAIClub(rarity models.Rarity) (*models.Club, error) {
	club := &models.Club{
		ID:           generator.NewID("clb"),
		Name:         s.Gen.RandomClubName(),
		Logo:         "default",
		StadiumLevel: 1,
		IsAI:         true,
	}
	for _, p := range s.Gen.StarterSquad() {
		// Boost rarity for harder AI tiers.
		if rarity == models.RarityRare && s.Gen.RollPercent(40) {
			p = s.Gen.GeneratePlayer(p.Position, models.RarityRare)
		}
		p.OwnerClubID = club.ID
		if err := s.Store.CreatePlayer(p); err != nil {
			return nil, err
		}
		club.Squad = append(club.Squad, p.ID)
	}
	coach := s.Gen.GenerateCoach(models.RarityCommon)
	coach.OwnerClubID = club.ID
	if err := s.Store.CreateCoach(coach); err != nil {
		return nil, err
	}
	club.ManagerID = coach.ID
	club.Roster = append(club.Roster, coach.ID)
	if err := s.Store.CreateClub(club); err != nil {
		return nil, err
	}
	return club, nil
}

func (s *Server) handleQuickMatch(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req quickMatchReq
	_ = decodeJSON(r, &req)

	club, err := s.Store.GetClub(user.ClubID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "user has no club")
		return
	}

	var opp *models.Club
	if req.OpponentClubID != "" {
		opp, err = s.Store.GetClub(req.OpponentClubID)
		if err != nil {
			writeError(w, http.StatusNotFound, "opponent not found")
			return
		}
	} else {
		opp, err = s.pickAIClub()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load opponent")
			return
		}
	}

	homeSide, awaySide, err := s.buildSides(club, opp)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	match := simulator.Simulate(homeSide, awaySide, "quick")
	reward := economy.MatchReward(match.HomeGoals, match.AwayGoals, true)
	match.Reward = reward
	economy.GrantSoft(user, reward)
	_ = s.Store.UpdateUser(user)
	_ = s.Store.CreateMatch(match)

	// Mission tracking.
	if match.HomeGoals > match.AwayGoals {
		_, _ = s.Missions.Track(user.ID, "match_win", 1)
	}
	_, _ = s.Missions.Track(user.ID, "goal_scored", match.HomeGoals)

	writeJSON(w, http.StatusOK, match)
}

// handleLeagueMatch is identical to quick match, but updates standings.
func (s *Server) handleLeagueMatch(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req quickMatchReq
	_ = decodeJSON(r, &req)

	club, err := s.Store.GetClub(user.ClubID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "user has no club")
		return
	}

	var opp *models.Club
	if req.OpponentClubID != "" {
		opp, err = s.Store.GetClub(req.OpponentClubID)
		if err != nil {
			writeError(w, http.StatusNotFound, "opponent not found")
			return
		}
	} else {
		opp, err = s.pickAIClub()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load opponent")
			return
		}
	}

	homeSide, awaySide, err := s.buildSides(club, opp)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	match := simulator.Simulate(homeSide, awaySide, "league")
	reward := economy.MatchReward(match.HomeGoals, match.AwayGoals, true)
	match.Reward = reward

	// Update standings on both clubs.
	league.ApplyMatchResult(club, opp, match.HomeGoals, match.AwayGoals)
	_ = s.Store.UpdateClub(club)
	_ = s.Store.UpdateClub(opp)

	// Promotion check.
	user.Division = league.PromoteOrRelegate(user.Division, club.Points)

	economy.GrantSoft(user, reward)
	_ = s.Store.UpdateUser(user)
	_ = s.Store.CreateMatch(match)

	if match.HomeGoals > match.AwayGoals {
		_, _ = s.Missions.Track(user.ID, "match_win", 1)
	}
	_, _ = s.Missions.Track(user.ID, "goal_scored", match.HomeGoals)

	writeJSON(w, http.StatusOK, match)
}

func (s *Server) buildSides(home, away *models.Club) (simulator.Side, simulator.Side, error) {
	hp, err := s.Store.ListPlayersByClub(home.ID)
	if err != nil {
		return simulator.Side{}, simulator.Side{}, err
	}
	ap, err := s.Store.ListPlayersByClub(away.ID)
	if err != nil {
		return simulator.Side{}, simulator.Side{}, err
	}
	hSquad := bestEleven(hp)
	aSquad := bestEleven(ap)
	var hCoach, aCoach *models.Coach
	if home.ManagerID != "" {
		hCoach, _ = s.Store.GetCoach(home.ManagerID)
	}
	if away.ManagerID != "" {
		aCoach, _ = s.Store.GetCoach(away.ManagerID)
	}
	return simulator.Side{Club: home, Squad: hSquad, Coach: hCoach, IsHome: true},
		simulator.Side{Club: away, Squad: aSquad, Coach: aCoach, IsHome: false},
		nil
}

func (s *Server) handleGetMatch(w http.ResponseWriter, r *http.Request) {
	m, err := s.Store.GetMatch(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "match not found")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (s *Server) handleClubMatches(w http.ResponseWriter, r *http.Request) {
	clubID := r.PathValue("id")
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}
	out, err := s.Store.ListMatchesByClub(clubID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}
