package models

func init() {
	registerModel(&ProductCategory{})
}

// ProductCategory is the join table for Product<->Category. Neither
// category/product association nor even categoryId/productId carry @Field()
// in the Node model, so it's never returned directly over GraphQL — it's
// only ever written to via attachCategory/detachCategory.
type ProductCategory struct {
	Base

	CategoryID string    `gorm:"not null;index"`
	Category   *Category `gorm:"foreignKey:CategoryID;constraint:OnDelete:CASCADE"`

	ProductID string   `gorm:"not null;index"`
	Product   *Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE"`
}
