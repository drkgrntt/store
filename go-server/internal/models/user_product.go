package models

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	registerModel(&UserProduct{})
}

// UserProduct is a cart line item: one row per (user, product) pair. Only
// count/createdAt/updatedAt carry @Field() on the Node model — userId and
// productId are DB-only, and "product" is a FieldResolver
// (CartResolver.Product in graph/cart.resolvers.go), so this struct field
// exists for the foreign key/cascade constraint, not for GraphQL autobind
// (product is forced to a resolver in gqlgen.yml).
type UserProduct struct {
	Base

	UserID string `gorm:"not null;index" json:"-"`
	User   *User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`

	ProductID string   `gorm:"not null;index" json:"-"`
	Product   *Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`

	Count int `gorm:"not null;default:1" json:"count"`
}

// BeforeSave mirrors the `@Default(1)` + `@Is("Positive", ...)` pair on
// count. Sequelize applies a declared default to the instance before
// running validators, so an unset count becomes 1 first, then passes
// validation — applying only the GORM column default (which only takes
// effect in the SQL GORM emits) would leave the in-memory zero value to
// fail this check first.
func (up *UserProduct) BeforeSave(tx *gorm.DB) error {
	if up.Count == 0 {
		up.Count = 1
	}
	if up.Count <= 0 {
		return fmt.Errorf(`"%d" must be greater than 0.`, up.Count)
	}
	return nil
}
