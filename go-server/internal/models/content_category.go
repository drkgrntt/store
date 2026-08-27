package models

func init() {
	registerModel(&ContentCategory{})
}

// ContentCategory is the join table for Content<->Category. It does carry
// @Field() on id/categoryId/contentId/createdAt/updatedAt in the Node
// model, but nothing ever returns a ContentCategory (or [ContentCategory])
// over GraphQL — attachCategory/detachCategory return Boolean — so
// type-graphql's schema builder drops it as unreachable, and there's no
// GraphQL type for it here either.
type ContentCategory struct {
	Base

	CategoryID string    `gorm:"not null;index"`
	Category   *Category `gorm:"foreignKey:CategoryID;constraint:OnDelete:CASCADE"`

	ContentID string   `gorm:"not null;index"`
	Content   *Content `gorm:"foreignKey:ContentID;constraint:OnDelete:CASCADE"`
}
