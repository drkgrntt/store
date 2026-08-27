package models

func init() {
	registerModel(&Category{})
}

type Category struct {
	Base

	// unique, not uniqueIndex — see the comment on User.Email for why.
	// Unlike Email/Token.Value/Order.PaymentIntentID, this isn't matching
	// a pre-existing Sequelize constraint: the Node model never had one,
	// which is exactly how production ended up with several exact-duplicate
	// categories (Denim x3, plus several others) before this got noticed
	// and merged. CreateCategory (graph/category.resolvers.go) already
	// does a case-insensitive lookup-before-create, but that check isn't
	// atomic — this constraint is the real backstop against a race
	// producing the same duplicate again.
	Name string `gorm:"unique;not null" json:"name"`

	// Products isn't a struct field on purpose — CategoryResolver.products
	// (graph/category.resolvers.go) looks it up through product_categories,
	// matching the Node model's FieldResolver-only "products" field.
}
