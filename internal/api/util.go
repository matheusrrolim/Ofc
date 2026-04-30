package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/matheusrrolim/ofc/internal/auth"
	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

// requireUser extracts the bearer token and resolves the current user.
func (s *Server) requireUser(r *http.Request) (*models.User, error) {
	auth_h := r.Header.Get("Authorization")
	token := ""
	if strings.HasPrefix(auth_h, "Bearer ") {
		token = strings.TrimPrefix(auth_h, "Bearer ")
	} else {
		token = r.URL.Query().Get("token")
	}
	u, err := auth.Authenticate(s.Store, token)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func mapStoreErr(err error) (int, string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		return http.StatusNotFound, "not found"
	case errors.Is(err, store.ErrAlreadyExists):
		return http.StatusConflict, "already exists"
	case errors.Is(err, store.ErrConflict):
		return http.StatusConflict, "conflict"
	default:
		return http.StatusInternalServerError, err.Error()
	}
}
