package models

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	registerModel(&Product{})
}

// Prices, quantities, and everything derived from them (order line prices,
// cart counts, shipping cost, totals) are plain integers on both sides of
// the port. The Node side stores them as un-annotated TS `number` fields,
// which type-graphql exposes over GraphQL as Float — but every value that
// ever flows through is a whole number (cents, item counts), and Float vs
// Int serializes identically on the wire for integer values, so this port
// uses GraphQL Int (and Go int) throughout instead of carrying float64 into
// business logic that never needs a fractional value.
type Product struct {
	Base

	Title         string `gorm:"not null" json:"title"`
	Description   string `gorm:"type:varchar(1000);not null" json:"description"`
	Price         int    `gorm:"not null" json:"price"`
	Quantity      int    `gorm:"not null" json:"quantity"`
	IsMadeToOrder bool   `gorm:"not null;default:false" json:"isMadeToOrder"`
	IsActive      bool   `gorm:"not null;default:false" json:"isActive"`

	// Categories/Images/RelatedProducts aren't struct fields on purpose —
	// ProductResolver (graph/product.resolvers.go) resolves them on demand,
	// matching the Node model's FieldResolver-only fields.
}

// BeforeSave mirrors the two `@Is("Positive", ...)` validators on price and
// quantity in server/src/models/Product.ts.
func (p *Product) BeforeSave(tx *gorm.DB) error {
	if p.Price < 0 {
		return fmt.Errorf(`"%d" must be positive.`, p.Price)
	}
	if p.Quantity < 0 {
		return fmt.Errorf(`"%d" must be positive.`, p.Quantity)
	}
	return nil
}
