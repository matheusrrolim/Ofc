// Package auth handles password hashing and bearer-token sessions.
//
// Passwords are hashed with PBKDF2-HMAC-SHA256 using a per-user salt.
// Sessions are opaque random tokens stored in the persistence layer.
package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"time"

	"github.com/matheusrrolim/ofc/internal/models"
	"github.com/matheusrrolim/ofc/internal/store"
)

const (
	pbkdfIter   = 60_000
	pbkdfKeyLen = 32
	tokenBytes  = 24
	sessionTTL  = 14 * 24 * time.Hour
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidSession     = errors.New("invalid or expired session")
)

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func HashPassword(password string) (hash, salt string, err error) {
	salt, err = randomHex(16)
	if err != nil {
		return "", "", err
	}
	dk, err := pbkdf2.Key(sha256.New, password, []byte(salt), pbkdfIter, pbkdfKeyLen)
	if err != nil {
		return "", "", err
	}
	return hex.EncodeToString(dk), salt, nil
}

func VerifyPassword(password, salt, expectedHash string) bool {
	dk, err := pbkdf2.Key(sha256.New, password, []byte(salt), pbkdfIter, pbkdfKeyLen)
	if err != nil {
		return false
	}
	got := hex.EncodeToString(dk)
	return subtle.ConstantTimeCompare([]byte(got), []byte(expectedHash)) == 1
}

// IssueSession creates and persists a new session for a user.
func IssueSession(s store.Store, userID string) (*models.Session, error) {
	tok, err := randomHex(tokenBytes)
	if err != nil {
		return nil, err
	}
	sess := &models.Session{
		Token:     tok,
		UserID:    userID,
		ExpiresAt: time.Now().UTC().Add(sessionTTL),
	}
	if err := s.CreateSession(sess); err != nil {
		return nil, err
	}
	return sess, nil
}

// Authenticate resolves a bearer token to a user.
func Authenticate(s store.Store, token string) (*models.User, error) {
	if token == "" {
		return nil, ErrInvalidSession
	}
	sess, err := s.GetSession(token)
	if err != nil {
		return nil, ErrInvalidSession
	}
	user, err := s.GetUser(sess.UserID)
	if err != nil {
		return nil, ErrInvalidSession
	}
	return user, nil
}

// LoginByEmail returns a session for matching credentials.
func LoginByEmail(s store.Store, email, password string) (*models.User, *models.Session, error) {
	user, err := s.GetUserByEmail(email)
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}
	if !VerifyPassword(password, user.PasswordSalt, user.PasswordHash) {
		return nil, nil, ErrInvalidCredentials
	}
	sess, err := IssueSession(s, user.ID)
	if err != nil {
		return nil, nil, err
	}
	return user, sess, nil
}
