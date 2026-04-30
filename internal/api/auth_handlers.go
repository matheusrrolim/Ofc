package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/matheusrrolim/ofc/internal/auth"
	"github.com/matheusrrolim/ofc/internal/economy"
	"github.com/matheusrrolim/ofc/internal/generator"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	ClubName string `json:"clubName"`
}

type authResp struct {
	Token   string       `json:"token"`
	User    *models.User `json:"user"`
	Club    *models.Club `json:"club"`
	Expires time.Time    `json:"expires"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.ClubName = strings.TrimSpace(req.ClubName)
	if req.Username == "" || req.Email == "" || len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "username, email and 6+ char password required")
		return
	}
	if _, err := s.Store.GetUserByEmail(req.Email); err == nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}
	if _, err := s.Store.GetUserByUsername(req.Username); err == nil {
		writeError(w, http.StatusConflict, "username taken")
		return
	}
	hash, salt, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user := &models.User{
		ID:              generator.NewID("usr"),
		Username:        req.Username,
		Email:           req.Email,
		PasswordHash:    hash,
		PasswordSalt:    salt,
		SoftCurrency:    economy.StarterSoft,
		PremiumCurrency: economy.StarterPremium,
		Division:        models.DivBronze,
		CreatedAt:       time.Now().UTC(),
	}

	clubName := req.ClubName
	if clubName == "" {
		clubName = s.Gen.RandomClubName()
	}
	club := &models.Club{
		ID:           generator.NewID("clb"),
		Name:         clubName,
		Logo:         "default",
		StadiumLevel: 1,
		OwnerUserID:  user.ID,
		CreatedAt:    time.Now().UTC(),
	}

	// Generate starter squad and a starter coach.
	squad := s.Gen.StarterSquad()
	for _, p := range squad {
		p.OwnerClubID = club.ID
		if err := s.Store.CreatePlayer(p); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create players")
			return
		}
		club.Squad = append(club.Squad, p.ID)
	}
	coach := s.Gen.GenerateCoach(models.RarityCommon)
	coach.OwnerClubID = club.ID
	if err := s.Store.CreateCoach(coach); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create coach")
		return
	}
	club.Roster = append(club.Roster, coach.ID)
	club.ManagerID = coach.ID

	user.ClubID = club.ID
	if err := s.Store.CreateUser(user); err != nil {
		if errors.Is(err, store.ErrAlreadyExists) {
			writeError(w, http.StatusConflict, "user already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	if err := s.Store.CreateClub(club); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create club")
		return
	}

	sess, err := auth.IssueSession(s.Store, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to issue session")
		return
	}

	// Seed default missions.
	_, _ = s.Missions.Ensure(user.ID)

	writeJSON(w, http.StatusCreated, authResp{
		Token:   sess.Token,
		User:    user,
		Club:    club,
		Expires: sess.ExpiresAt,
	})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	user, sess, err := auth.LoginByEmail(s.Store, strings.ToLower(strings.TrimSpace(req.Email)), req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	club, _ := s.Store.GetClub(user.ClubID)
	writeJSON(w, http.StatusOK, authResp{
		Token:   sess.Token,
		User:    user,
		Club:    club,
		Expires: sess.ExpiresAt,
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	authH := r.Header.Get("Authorization")
	token := strings.TrimPrefix(authH, "Bearer ")
	_ = s.Store.DeleteSession(token)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, err := s.requireUser(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	club, _ := s.Store.GetClub(user.ClubID)
	writeJSON(w, http.StatusOK, map[string]any{
		"user": user,
		"club": club,
	})
}
