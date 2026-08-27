package models

import (
	"testing"

	"gorm.io/gorm"
)

// TestOrderProductCanOrderQuantity matches OrderProduct.canOrderQuantity:
// an inactive product can't be ordered at all, and an active,
// not-made-to-order product can't be ordered past what's on hand.
func TestOrderProductCanOrderQuantity(t *testing.T) {
	db := setupTestDB(t)
	user := createTestUser(t, db, "orderer@example.com")
	order := createTestOrder(t, db, user)

	t.Run("inactive product rejected", func(t *testing.T) {
		product := createTestProduct(t, db, "Inactive Mug")
		product.IsActive = false
		if err := db.Save(product).Error; err != nil {
			t.Fatalf("deactivating product: %v", err)
		}

		op := &OrderProduct{OrderID: order.ID, ProductID: product.ID, Count: 1, Price: product.Price}
		if err := db.Create(op).Error; err == nil {
			t.Error("expected an error ordering an inactive product, got nil")
		}
	})

	t.Run("over quantity rejected unless made to order", func(t *testing.T) {
		product := createTestProduct(t, db, "Limited Mug")
		product.Quantity = 2
		if err := db.Save(product).Error; err != nil {
			t.Fatalf("setting quantity: %v", err)
		}

		op := &OrderProduct{OrderID: order.ID, ProductID: product.ID, Count: 3, Price: product.Price}
		if err := db.Create(op).Error; err == nil {
			t.Error("expected an error ordering more than what's available, got nil")
		}
	})

	t.Run("over quantity allowed when made to order", func(t *testing.T) {
		product := createTestProduct(t, db, "Made To Order Mug")
		product.Quantity = 2
		product.IsMadeToOrder = true
		if err := db.Save(product).Error; err != nil {
			t.Fatalf("setting quantity/isMadeToOrder: %v", err)
		}

		op := &OrderProduct{OrderID: order.ID, ProductID: product.ID, Count: 3, Price: product.Price}
		if err := db.Create(op).Error; err != nil {
			t.Errorf("expected a made-to-order product to allow ordering past quantity, got error: %v", err)
		}
	})
}

// TestOrderProductReduceAvailability matches OrderProduct.reduceAvailability:
// placing an order shrinks (or removes) every cart line for that product
// across all users by however much was just ordered.
func TestOrderProductReduceAvailability(t *testing.T) {
	db := setupTestDB(t)
	buyer := createTestUser(t, db, "buyer@example.com")
	shopper := createTestUser(t, db, "shopper@example.com")
	order := createTestOrder(t, db, buyer)
	product := createTestProduct(t, db, "Popular Mug")
	product.Quantity = 100
	if err := db.Save(product).Error; err != nil {
		t.Fatalf("setting quantity: %v", err)
	}

	// buyer has 5 in their cart, shopper has 2.
	buyerCart := &UserProduct{UserID: buyer.ID, ProductID: product.ID, Count: 5}
	if err := db.Create(buyerCart).Error; err != nil {
		t.Fatalf("creating buyer's cart line: %v", err)
	}
	shopperCart := &UserProduct{UserID: shopper.ID, ProductID: product.ID, Count: 2}
	if err := db.Create(shopperCart).Error; err != nil {
		t.Fatalf("creating shopper's cart line: %v", err)
	}

	// buyer orders 3 — their own cart line should shrink to 2, and
	// shopper's line (count 2) should shrink to 0 and be deleted entirely.
	op := &OrderProduct{OrderID: order.ID, ProductID: product.ID, Count: 3, Price: product.Price}
	if err := db.Create(op).Error; err != nil {
		t.Fatalf("creating order product: %v", err)
	}

	var reloadedBuyerCart UserProduct
	if err := db.Where("id = ?", buyerCart.ID).First(&reloadedBuyerCart).Error; err != nil {
		t.Fatalf("reloading buyer's cart line: %v", err)
	}
	if reloadedBuyerCart.Count != 2 {
		t.Errorf("buyer's cart count = %d, want 2 (5 - 3 ordered)", reloadedBuyerCart.Count)
	}

	var shopperCartCount int64
	err := db.Model(&UserProduct{}).Where("id = ?", shopperCart.ID).Count(&shopperCartCount).Error
	if err != nil {
		t.Fatalf("counting shopper's cart line: %v", err)
	}
	if shopperCartCount != 0 {
		t.Error("shopper's cart line should have been deleted once availability dropped to 0")
	}
}

func createTestOrder(t *testing.T, db *gorm.DB, user *User) *Order {
	t.Helper()

	// Every real order has an address — placeOrder's addressId arg is
	// required (see internal/graph/order.resolvers.go) — so build one
	// here rather than leaving Order.AddressID unset.
	address := &Address{
		UserID: user.ID, Recipient: "Test", LineOne: "1 Test St",
		City: "KC", State: "MO", ZipCode: "64111",
	}
	if err := db.Create(address).Error; err != nil {
		t.Fatalf("creating address for test order: %v", err)
	}

	order := &Order{
		UserID:          user.ID,
		AddressID:       address.ID,
		PaymentIntentID: "pi_test_" + user.ID,
		TaxRate:         CurrentTaxRate,
		ShippingCost:    CurrentShippingCost,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("creating order: %v", err)
	}
	return order
}
