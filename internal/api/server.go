// Package api wires HTTP handlers to the underlying domain services.
package api

import (
	"net/http"

	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/marketplace"
	"github.com/matheusrrolim/ofc/internal/missions"
	"github.com/matheusrrolim/ofc/internal/packs"
	"github.com/matheusrrolim/ofc/internal/store"
)

type Server struct {
	Store    store.Store
	Gen      *generator.Generator
	Packs    *packs.Service
	Market   *marketplace.Service
	Missions *missions.Service
}

func New(s store.Store) *Server {
	g := generator.New(0)
	return &Server{
		Store:    s,
		Gen:      g,
		Packs:    packs.NewService(s, g),
		Market:   marketplace.NewService(s),
		Missions: missions.NewService(s),
	}
}

// Routes builds the HTTP handler with all endpoints and middleware applied.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Auth
	mux.HandleFunc("POST /api/v1/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/v1/auth/logout", s.handleLogout)

	// User / club
	mux.HandleFunc("GET /api/v1/me", s.handleMe)
	mux.HandleFunc("GET /api/v1/clubs/{id}", s.handleGetClub)
	mux.HandleFunc("PATCH /api/v1/clubs/{id}", s.handleUpdateClub)
	mux.HandleFunc("GET /api/v1/clubs/{id}/squad", s.handleSquad)
	mux.HandleFunc("PUT /api/v1/clubs/{id}/coach", s.handleSetCoach)
	mux.HandleFunc("GET /api/v1/clubs/{id}/coaches", s.handleListCoaches)

	// Players
	mux.HandleFunc("GET /api/v1/players/{id}", s.handleGetPlayer)

	// Packs
	mux.HandleFunc("GET /api/v1/packs", s.handleListPacks)
	mux.HandleFunc("POST /api/v1/packs/open", s.handleOpenPack)

	// Marketplace
	mux.HandleFunc("GET /api/v1/market", s.handleListMarket)
	mux.HandleFunc("POST /api/v1/market", s.handleCreateListing)
	mux.HandleFunc("DELETE /api/v1/market/{id}", s.handleCancelListing)
	mux.HandleFunc("POST /api/v1/market/{id}/buy", s.handleBuyListing)

	// Matches
	mux.HandleFunc("POST /api/v1/matches/quick", s.handleQuickMatch)
	mux.HandleFunc("POST /api/v1/matches/league", s.handleLeagueMatch)
	mux.HandleFunc("GET /api/v1/matches/{id}", s.handleGetMatch)
	mux.HandleFunc("GET /api/v1/clubs/{id}/matches", s.handleClubMatches)

	// League
	mux.HandleFunc("GET /api/v1/league", s.handleStandings)

	// Missions
	mux.HandleFunc("GET /api/v1/missions", s.handleListMissions)
	mux.HandleFunc("POST /api/v1/missions/{id}/claim", s.handleClaimMission)

	// Health
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Static frontend.
	mux.Handle("/", http.FileServer(http.Dir("web")))

	return withMiddleware(mux)
}

// withMiddleware applies CORS, logging, and recovery.
func withMiddleware(h http.Handler) http.Handler {
	return cors(recoverPanic(h))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
