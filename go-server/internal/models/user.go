package models

import (
	"fmt"
	"regexp"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func init() {
	registerModel(&User{})
}

// Matches the EMAIL_REGEX in server/src/models/User.ts exactly, since that's
// what the Node server's `@Is("EmailAddress", ...)` validator enforces.
var emailRegex = regexp.MustCompile(
	`^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$`,
)

// bcryptCost matches the `bcrypt.hash(password, 13)` cost factor the Node
// resolvers (register/resetPassword/resetForgottenPassword) use.
const bcryptCost = 13

type User struct {
	Base

	// unique, not uniqueIndex: Sequelize's `@Unique` builds a real UNIQUE
	// constraint (Postgres names it "users_email_key" by default), not a
	// bare index. GORM tracks those as two different things — a
	// uniqueIndex-tagged field is invisible to its "is this column
	// actually unique" migration check, which then assumes any unique
	// constraint it finds must be a stale one of its own and tries to
	// drop it by its own naming convention ("uni_users_email"), which
	// never existed here. Matching Sequelize's actual mechanism avoids
	// that entirely — see internal/models/token.go and order.go for the
	// same fix.
	Email    string `gorm:"unique;not null" json:"email"`
	Password string `gorm:"not null" json:"-"`
	IsAdmin  bool   `gorm:"not null;default:false" json:"isAdmin"`

	Tokens []Token `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"tokens,omitempty"`

	// Addresses/BillingAddress/ShippingAddresses/Orders/Cart aren't struct
	// fields here on purpose: like Tokens, they're resolved on demand by
	// dedicated GraphQL resolvers (graph/user.resolvers.go), matching the
	// Node model's FieldResolver-only fields.

	// TODO(go-port): Products (many2many through UserProduct) — not exposed
	// by any Node resolver yet either, so left for whenever that's needed.
}

// BeforeSave mirrors the Node model's @Is("EmailAddress", ...) validator,
// which Sequelize runs on both create and update.
func (u *User) BeforeSave(tx *gorm.DB) error {
	if u.Email != "" && !emailRegex.MatchString(u.Email) {
		return fmt.Errorf("%q is not a valid email address", u.Email)
	}
	return nil
}

// SetPassword hashes and stores a plaintext password, matching
// `bcrypt.hash(password, 13)` in the Node resolvers.
func (u *User) SetPassword(plaintext string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcryptCost)
	if err != nil {
		return err
	}
	u.Password = string(hash)
	return nil
}

// ComparePassword matches `bcrypt.compare(password, user.password)`.
func (u *User) ComparePassword(plaintext string) error {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plaintext))
}
