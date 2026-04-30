package api

import (
	"net/http"

	"github.com/matheusrrolim/ofc/internal/chemistry"
	"github.com/matheusrrolim/ofc/internal/models"
)

func (s *Server) handleGetClub(w http.ResponseWriter, r *http.Request) {
	club, err := s.Store.GetClub(r.PathValue("id"))
	if err != nil {
		st, msg := mapStoreErr(err)
		writeError(w, st, msg)
		return
	}
	writeJSON(w, http.StatusOK, club)
}

type updateClubReq struct {
	Name         *string `json:"name,omitempty"`
	Logo         *string `json:"logo,omitempty"`
	StadiumLevel *int    `json:"stadiumLevel,omitempty"`
}

func (s *Server) handleUpdateClub(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	clubID := r.PathValue("id")
	if user.ClubID != clubID {
		writeError(w, http.StatusForbidden, "not your club")
		return
	}
	club, err := s.Store.GetClub(clubID)
	if err != nil {
		writeError(w, http.StatusNotFound, "club not found")
		return
	}
	var req updateClubReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Name != nil {
		club.Name = *req.Name
	}
	if req.Logo != nil {
		club.Logo = *req.Logo
	}
	if req.StadiumLevel != nil {
		club.StadiumLevel = *req.StadiumLevel
	}
	if err := s.Store.UpdateClub(club); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, club)
}

type squadResp struct {
	Club      *models.Club      `json:"club"`
	Players   []*models.Player  `json:"players"`
	Coach     *models.Coach     `json:"coach,omitempty"`
	Chemistry chemistry.Result  `json:"chemistry"`
}

func (s *Server) handleSquad(w http.ResponseWriter, r *http.Request) {
	clubID := r.PathValue("id")
	club, err := s.Store.GetClub(clubID)
	if err != nil {
		writeError(w, http.StatusNotFound, "club not found")
		return
	}
	players, err := s.Store.ListPlayersByClub(clubID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var coach *models.Coach
	if club.ManagerID != "" {
		coach, _ = s.Store.GetCoach(club.ManagerID)
	}
	// Chemistry is calculated over the on-pitch 11 (best by overall).
	starting := bestEleven(players)
	chem := chemistry.Compute(starting, coach)
	club.ChemistryScore = chem.TotalBonus
	_ = s.Store.UpdateClub(club)

	writeJSON(w, http.StatusOK, squadResp{
		Club:      club,
		Players:   players,
		Coach:     coach,
		Chemistry: chem,
	})
}

type setCoachReq struct {
	CoachID string `json:"coachId"`
}

func (s *Server) handleSetCoach(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	clubID := r.PathValue("id")
	if user.ClubID != clubID {
		writeError(w, http.StatusForbidden, "not your club")
		return
	}
	var req setCoachReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	coach, err := s.Store.GetCoach(req.CoachID)
	if err != nil {
		writeError(w, http.StatusNotFound, "coach not found")
		return
	}
	if coach.OwnerClubID != clubID {
		writeError(w, http.StatusForbidden, "coach not owned by this club")
		return
	}
	club, _ := s.Store.GetClub(clubID)
	club.ManagerID = coach.ID
	if err := s.Store.UpdateClub(club); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, club)
}

func (s *Server) handleListCoaches(w http.ResponseWriter, r *http.Request) {
	clubID := r.PathValue("id")
	out, err := s.Store.ListCoachesByClub(clubID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetPlayer(w http.ResponseWriter, r *http.Request) {
	p, err := s.Store.GetPlayer(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "player not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// bestEleven selects the strongest 1 GK + 4 DEF + 4 MID + 2 ATT, falling back
// to top-rated players when slots are unfilled.
func bestEleven(all []*models.Player) []*models.Player {
	byPos := map[models.Position][]*models.Player{}
	for _, p := range all {
		if p.OnMarket {
			continue
		}
		byPos[p.Position] = append(byPos[p.Position], p)
	}
	for _, list := range byPos {
		sortByRating(list)
	}
	picked := []*models.Player{}
	pick := func(pos models.Position, n int) {
		for i := 0; i < n && i < len(byPos[pos]); i++ {
			picked = append(picked, byPos[pos][i])
		}
	}
	pick(models.PosGK, 1)
	pick(models.PosDEF, 4)
	pick(models.PosMID, 4)
	pick(models.PosATT, 2)

	if len(picked) < 11 {
		// Fill from remaining outfielders.
		for _, pos := range []models.Position{models.PosMID, models.PosDEF, models.PosATT, models.PosGK} {
			start := 0
			if pos == models.PosGK {
				start = 1
			} else if pos == models.PosDEF {
				start = 4
			} else if pos == models.PosMID {
				start = 4
			} else if pos == models.PosATT {
				start = 2
			}
			for i := start; i < len(byPos[pos]) && len(picked) < 11; i++ {
				picked = append(picked, byPos[pos][i])
			}
		}
	}
	return picked
}

func sortByRating(p []*models.Player) {
	for i := 1; i < len(p); i++ {
		for j := i; j > 0 && p[j-1].OverallRating < p[j].OverallRating; j-- {
			p[j-1], p[j] = p[j], p[j-1]
		}
	}
}
