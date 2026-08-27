package models

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	registerModel(&Address{})
}

// AddressType's two values. Note: the Node model never calls type-graphql's
// registerEnumType for this, and a TS *string* enum's emitted reflection
// metadata resolves to GraphQL String — so on the wire `type` has always
// been a plain string, not a real GraphQL enum. The schema matches that.
type AddressType string

const (
	AddressTypeBilling  AddressType = "billing"
	AddressTypeShipping AddressType = "shipping"
)

type Address struct {
	Base

	Recipient string      `gorm:"not null" json:"recipient"`
	LineOne   string      `gorm:"not null" json:"lineOne"`
	LineTwo   string      `json:"lineTwo,omitempty"`
	City      string      `gorm:"not null" json:"city"`
	State     string      `gorm:"not null" json:"state"`
	ZipCode   string      `gorm:"not null" json:"zipCode"`
	Country   string      `gorm:"not null;default:'United States'" json:"country"`
	Type      AddressType `gorm:"not null;default:'shipping'" json:"type"`

	UserID string `gorm:"not null;index" json:"userId"`
	User   *User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

// AfterSave mirrors Address.ensureOneBilling: at most one address per user
// may be the billing address, so saving one as billing demotes the rest.
func (a *Address) AfterSave(tx *gorm.DB) error {
	if a.Type != AddressTypeBilling {
		return nil
	}
	return tx.Model(&Address{}).
		Where("user_id = ? AND id <> ?", a.UserID, a.ID).
		Update("type", AddressTypeShipping).Error
}

// String matches addressToString in server/src/utils/index.ts.
func (a *Address) String() string {
	str := fmt.Sprintf("%s %s", a.Recipient, a.LineOne)
	if a.LineTwo != "" {
		str += " " + a.LineTwo
	}
	str += fmt.Sprintf(", %s, %s %s, %s", a.City, a.State, a.ZipCode, a.Country)
	return str
}
