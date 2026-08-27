package models

func init() {
	registerModel(&Content{})
}

// Content has no @Field() on createdAt/updatedAt in the Node model (unlike
// every other model), so those columns exist here for Base's bookkeeping
// but are never exposed over GraphQL.
type Content struct {
	Base

	Title  string `json:"title,omitempty"`
	Detail string `gorm:"type:varchar(3000);not null" json:"detail"`

	// Categories isn't a struct field on purpose — ContentResolver.categories
	// (graph/content.resolvers.go) looks it up through content_categories,
	// matching the Node model's FieldResolver-only "categories" field.
}
