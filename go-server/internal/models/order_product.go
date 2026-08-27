package models

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
)

func init() {
	registerModel(&OrderProduct{})
}

// OrderProduct is a line item on a placed Order: a snapshot of one product,
// its price at the time of purchase, and the quantity ordered. Only
// count/price/createdAt/updatedAt carry @Field() on the Node model —
// orderId/productId are DB-only, "product" is a FieldResolver
// (OrderedProductResolver.Product), so it's forced to a resolver in
// gqlgen.yml despite the matching struct field below.
type OrderProduct struct {
	Base

	OrderID string `gorm:"not null;index" json:"-"`
	Order   *Order `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"-"`

	ProductID string   `gorm:"not null;index" json:"-"`
	Product   *Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`

	Count int `gorm:"not null;default:1" json:"count"`
	Price int `json:"price"`
}

// BeforeSave mirrors the `@Default(1)` + `@Is("Positive", ...)` on count
// (see UserProduct.BeforeSave for why the default is applied here too) and
// the plain `@Is("Positive", ...)` on price (no default — 0 is a valid
// price, so unlike count there's nothing to backfill).
func (op *OrderProduct) BeforeSave(tx *gorm.DB) error {
	if op.Count == 0 {
		op.Count = 1
	}
	if op.Count <= 0 {
		return fmt.Errorf(`"%d" must be greater than 0.`, op.Count)
	}
	if op.Price < 0 {
		return fmt.Errorf(`"%d" must be positive.`, op.Price)
	}
	return nil
}

// BeforeCreate mirrors OrderProduct.canOrderQuantity: the product must be
// active, and can't be ordered past what's on hand unless it's
// made-to-order.
func (op *OrderProduct) BeforeCreate(tx *gorm.DB) error {
	op.EnsureID()

	var product Product
	if err := tx.Where("id = ?", op.ProductID).First(&product).Error; err != nil {
		return err
	}
	if !product.IsActive {
		return errors.New("This product is inactive.")
	}
	if !product.IsMadeToOrder && product.Quantity < op.Count {
		return errors.New("You cannot order more than what is available unless it can be made to order.")
	}
	return nil
}

// AfterCreate mirrors OrderProduct.reduceAvailability: every cart line for
// this product across all users shrinks (or disappears) by the amount just
// ordered, since that much is no longer available.
func (op *OrderProduct) AfterCreate(tx *gorm.DB) error {
	var userProducts []UserProduct
	if err := tx.Where("product_id = ?", op.ProductID).Find(&userProducts).Error; err != nil {
		return err
	}

	for i := range userProducts {
		up := &userProducts[i]
		if up.Count-op.Count > 0 {
			up.Count -= op.Count
			if err := tx.Save(up).Error; err != nil {
				return err
			}
		} else if err := tx.Delete(up).Error; err != nil {
			return err
		}
	}
	return nil
}
