package api

import (
	"net/http"

	"github.com/matheusrrolim/ofc/internal/packs"
)

func (s *Server) handleListPacks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, packs.Catalog())
}

type openPackReq struct {
	PackID   string `json:"packId"`
	Currency string `json:"currency"` // soft|premium
}

func (s *Server) handleOpenPack(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req openPackReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	club, err := s.Store.GetClub(user.ClubID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "no club")
		return
	}
	res, err := s.Packs.Open(user, club, req.PackID, req.Currency)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_, _ = s.Missions.Track(user.ID, "pack_open", 1)
	writeJSON(w, http.StatusOK, res)
}
