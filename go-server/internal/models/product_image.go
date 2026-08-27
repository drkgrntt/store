package models

import (
	"errors"

	"gorm.io/gorm"
)

func init() {
	registerModel(&ProductImage{})
}

type ProductImage struct {
	Base

	URL         string `gorm:"not null" json:"url"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Primary     bool   `gorm:"column:primary;not null;default:false" json:"primary"`

	ProductID string   `gorm:"not null;index" json:"-"`
	Product   *Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`
}

// AfterSave mirrors ProductImage.ensurePrimary exactly, apparent bug and
// all: the "at least one primary" check on the else branch counts *every*
// primary image across all products, not just this one's, because the
// Node query never filters by productId either.
func (pi *ProductImage) AfterSave(tx *gorm.DB) error {
	if pi.Primary {
		return tx.Model(&ProductImage{}).
			Where("product_id = ? AND id <> ?", pi.ProductID, pi.ID).
			Update("primary", false).Error
	}

	var count int64
	if err := tx.Model(&ProductImage{}).
		Where(map[string]any{"primary": true}).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("One image must be primary.")
	}
	return nil
}
