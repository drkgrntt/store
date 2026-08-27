package models

func init() {
	registerModel(&Category{})
}

type Category struct {
	Base

	Name string `gorm:"not null" json:"name"`

	// Products isn't a struct field on purpose — CategoryResolver.products
	// (graph/category.resolvers.go) looks it up through product_categories,
	// matching the Node model's FieldResolver-only "products" field.
}
