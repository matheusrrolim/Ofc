package api

import (
	"net/http"

	"github.com/matheusrrolim/ofc/internal/league"
)

func (s *Server) handleStandings(w http.ResponseWriter, r *http.Request) {
	clubs, err := s.Store.ListClubs()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	rows := league.BuildStandings(clubs)
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) handleListMissions(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	out, err := s.Missions.Ensure(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleClaimMission(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	m, err := s.Missions.Claim(user, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, m)
}
