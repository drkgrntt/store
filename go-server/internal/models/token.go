package models

import (
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

func init() {
	registerModel(&Token{})
}

// Token replicates server/src/models/Token.ts's split design: the row's
// `value` column only ever holds the unsigned "header.payload" half of the
// JWT (BeforeCreate strips the signature before INSERT), while every time a
// Token is created or loaded, AfterCreate/AfterFind hand back a freshly
// resigned, fully usable JWT in memory. A DB leak alone can't hand out valid
// cookies; forging one still requires JWT_SECRET.
type Token struct {
	Base

	// unique, not uniqueIndex — see the comment on User.Email for why.
	Value  string    `gorm:"unique;not null" json:"value"`
	Expiry time.Time `gorm:"index" json:"-"`
	Issued time.Time `json:"-"`

	UserID string `gorm:"not null;index" json:"userId"`
	User   *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (t *Token) BeforeCreate(tx *gorm.DB) error {
	t.EnsureID()
	t.Value = UnsignTokenValue(t.Value)
	return nil
}

func (t *Token) AfterCreate(tx *gorm.DB) error {
	signed, err := SignTokenValue(t.Value)
	if err != nil {
		// Mirrors the Node model's @AfterCreate: if we can't re-sign it,
		// the row is useless, so throw it away instead of leaving an
		// unsigned value that could never be validated.
		return tx.Delete(t).Error
	}
	t.Value = signed
	return nil
}

func (t *Token) AfterFind(tx *gorm.DB) error {
	signed, err := SignTokenValue(t.Value)
	if err != nil {
		return nil
	}
	t.Value = signed
	return nil
}

// UnsignTokenValue drops the signature segment of a JWT, leaving
// "header.payload". Matches Token.unsign in the Node model.
func UnsignTokenValue(value string) string {
	parts := strings.SplitN(value, ".", 3)
	if len(parts) < 2 {
		return value
	}
	return parts[0] + "." + parts[1]
}

// SignTokenValue takes an unsigned "header.payload" string, decodes its
// claims without verifying anything, and re-signs them with the current
// JWT_SECRET. Matches Token.sign in the Node model.
func SignTokenValue(value string) (string, error) {
	claims := jwt.MapClaims{}
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	if _, _, err := parser.ParseUnverified(value+".", &claims); err != nil {
		return "", err
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}

// GenerateTokenValue computes a fresh, fully-signed JWT for userID — the
// pure, DB-free half of Token.generate(uid, transaction, daysValid). Split
// out from GenerateToken so it's testable without a database.
func GenerateTokenValue(userID string, daysValid int) (value string, expiry, issued time.Time, err error) {
	issued = time.Now().UTC()
	expiry = issued.AddDate(0, 0, daysValid)

	claims := jwt.MapClaims{
		"uid": userID,
		"iat": issued.Unix(),
		"exp": expiry.Unix(),
	}
	value, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).
		SignedString([]byte(os.Getenv("JWT_SECRET")))
	return value, expiry, issued, err
}

// GenerateToken creates and persists a new token for the given user,
// matching Token.generate(uid, transaction, daysValid).
func GenerateToken(tx *gorm.DB, userID string, daysValid int) (*Token, error) {
	value, expiry, issued, err := GenerateTokenValue(userID, daysValid)
	if err != nil {
		return nil, err
	}

	token := &Token{
		Value:  value,
		Expiry: expiry,
		Issued: issued,
		UserID: userID,
	}
	if err := tx.Create(token).Error; err != nil {
		return nil, err
	}

	return token, nil
}

// VerifyAndFindUser looks up the token by its unsigned value, then verifies
// the *original, fully-signed* value's signature and expiry against the
// current JWT_SECRET before returning the associated user. Matches
// Token.verifyAndFindUser.
func VerifyAndFindUser(tx *gorm.DB, value string) (*User, error) {
	if value == "" {
		return nil, nil
	}

	unsigned := UnsignTokenValue(value)

	var token Token
	err := tx.Where("value = ?", unsigned).Preload("User").First(&token).Error
	if err != nil {
		return nil, nil //nolint:nilerr // not-found is a normal "no user" case, not an error
	}

	_, err = jwt.Parse(value, func(t *jwt.Token) (any, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil {
		tx.Delete(&Token{}, "id = ?", token.ID)
		return nil, nil
	}

	return token.User, nil
}
