package models

import "gorm.io/datatypes"

func init() {
	registerModel(&Analytic{})
}

// Analytic isn't a GraphQL type at all on the Node side — no @ObjectType(),
// no @Field() anywhere on the model. It's purely an internal event log
// written by GeneralResolver.ping (graph/general.resolvers.go).
type Analytic struct {
	Base

	IP        string
	UserAgent string `gorm:"type:varchar(510)"`
	Page      string
	// Composite index backs the correlated COUNT(*) subquery that
	// product_helpers.go's findProducts uses to sort by view count
	// (WHERE modal = 'detail' AND modal_id = products.id). Sequelize's
	// model never declared this either, so it's not something the port
	// dropped — but with the analytics table now at 50k+ rows, that
	// subquery was doing a full sequential scan per product row (~4s for
	// the homepage query). Composite, not two single-column indexes,
	// since both columns are always filtered together here.
	Modal   string `gorm:"index:idx_analytics_modal_lookup,priority:1"`
	ModalID string `gorm:"index:idx_analytics_modal_lookup,priority:2"`
	Token   string
	UserID  string
	Query   datatypes.JSON `gorm:"type:jsonb"`
}
