package api

import (
	"errors"
	"net/http"

	"github.com/matheusrrolim/ofc/internal/marketplace"
)

type listingReq struct {
	PlayerID string `json:"playerId"`
	Price    int64  `json:"price"`
}

func (s *Server) handleListMarket(w http.ResponseWriter, r *http.Request) {
	out, err := s.Store.ListActiveListings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Hydrate with player info for convenience.
	type hydrated struct {
		ListingID string `json:"listingId"`
		PlayerID  string `json:"playerId"`
		SellerID  string `json:"sellerId"`
		Price     int64  `json:"price"`
		Player    any    `json:"player"`
	}
	resp := make([]hydrated, 0, len(out))
	for _, l := range out {
		p, _ := s.Store.GetPlayer(l.PlayerID)
		resp = append(resp, hydrated{
			ListingID: l.ID,
			PlayerID:  l.PlayerID,
			SellerID:  l.SellerID,
			Price:     l.Price,
			Player:    p,
		})
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleCreateListing(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req listingReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	club, err := s.Store.GetClub(user.ClubID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "no club")
		return
	}
	listing, err := s.Market.Create(club, req.PlayerID, req.Price)
	if err != nil {
		writeError(w, marketStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, listing)
}

func (s *Server) handleCancelListing(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := s.Market.Cancel(user.ClubID, r.PathValue("id")); err != nil {
		writeError(w, marketStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

func (s *Server) handleBuyListing(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	club, err := s.Store.GetClub(user.ClubID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "no club")
		return
	}
	res, err := s.Market.Buy(user, club, r.PathValue("id"))
	if err != nil {
		writeError(w, marketStatus(err), err.Error())
		return
	}
	_, _ = s.Missions.Track(user.ID, "player_sold", 1)
	writeJSON(w, http.StatusOK, res)
}

func marketStatus(err error) int {
	switch {
	case errors.Is(err, marketplace.ErrPlayerNotOwned),
		errors.Is(err, marketplace.ErrSelfBuy),
		errors.Is(err, marketplace.ErrPriceOutOfRange),
		errors.Is(err, marketplace.ErrSquadEmpty),
		errors.Is(err, marketplace.ErrPlayerAlreadyListed),
		errors.Is(err, marketplace.ErrListingClosed):
		return http.StatusBadRequest
	}
	return http.StatusInternalServerError
}
