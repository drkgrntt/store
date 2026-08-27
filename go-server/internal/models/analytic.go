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
	Modal     string
	ModalID   string
	Token     string
	UserID    string
	Query     datatypes.JSON `gorm:"type:jsonb"`
}
