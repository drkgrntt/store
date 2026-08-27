package models

import "time"

// CurrentTaxRate/CurrentShippingCost match Order.currentTaxRate (a
// fraction) and Order.currentShippingCost (cents) in
// server/src/models/Order.ts.
const (
	CurrentTaxRate      = 0.08725
	CurrentShippingCost = 500
)

// Order carries both the raw FK scalars (userId/addressId — @Field() on
// the Node model, exposed directly) and the object-shaped associations
// (user/address/orderedProducts — Node FieldResolvers, forced to gqlgen
// resolvers despite the matching struct fields below since they're
// resolved on demand rather than eager-loaded).
type Order struct {
	Base

	UserID string `gorm:"not null;index" json:"userId"`
	User   *User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`

	AddressID string   `gorm:"index" json:"addressId"`
	Address   *Address `gorm:"foreignKey:AddressID" json:"-"`

	ShippedOn      *time.Time `json:"shippedOn,omitempty"`
	CompletedOn    *time.Time `json:"completedOn,omitempty"`
	TrackingNumber string     `json:"trackingNumber,omitempty"`
	// unique, not uniqueIndex — see the comment on User.Email for why.
	PaymentIntentID string  `gorm:"unique;not null" json:"paymentIntentId"`
	Notes           string  `gorm:"type:varchar(1000)" json:"notes,omitempty"`
	TaxRate         float64 `gorm:"not null;default:0" json:"taxRate"`
	ShippingCost    int     `gorm:"not null;default:0" json:"shippingCost"`

	OrderedProducts []OrderProduct `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"-"`
}
