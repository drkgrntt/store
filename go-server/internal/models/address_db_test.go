package models

import "testing"

// TestAddressEnsureOneBilling matches Address.ensureOneBilling: creating a
// second billing address for the same user must demote the first one back
// to shipping, so a user never ends up with two billing addresses.
func TestAddressEnsureOneBilling(t *testing.T) {
	db := setupTestDB(t)
	user := createTestUser(t, db, "billing-test@example.com")

	first := &Address{
		UserID: user.ID, Recipient: "A", LineOne: "1 St",
		City: "KC", State: "MO", ZipCode: "64111", Type: AddressTypeBilling,
	}
	if err := db.Create(first).Error; err != nil {
		t.Fatalf("creating first billing address: %v", err)
	}

	second := &Address{
		UserID: user.ID, Recipient: "B", LineOne: "2 St",
		City: "KC", State: "MO", ZipCode: "64111", Type: AddressTypeBilling,
	}
	if err := db.Create(second).Error; err != nil {
		t.Fatalf("creating second billing address: %v", err)
	}

	var reloadedFirst Address
	if err := db.Where("id = ?", first.ID).First(&reloadedFirst).Error; err != nil {
		t.Fatalf("reloading first address: %v", err)
	}
	if reloadedFirst.Type != AddressTypeShipping {
		t.Errorf("first billing address Type = %q, want %q (demoted)", reloadedFirst.Type, AddressTypeShipping)
	}

	var billingCount int64
	err := db.Model(&Address{}).
		Where("user_id = ? AND type = ?", user.ID, AddressTypeBilling).
		Count(&billingCount).Error
	if err != nil {
		t.Fatalf("counting billing addresses: %v", err)
	}
	if billingCount != 1 {
		t.Errorf("billing address count = %d, want exactly 1", billingCount)
	}

	// A second user's billing address must be untouched by the first
	// user's — the demotion is scoped to `user_id`.
	other := createTestUser(t, db, "other-billing@example.com")
	otherBilling := &Address{
		UserID: other.ID, Recipient: "C", LineOne: "3 St",
		City: "KC", State: "MO", ZipCode: "64111", Type: AddressTypeBilling,
	}
	if err := db.Create(otherBilling).Error; err != nil {
		t.Fatalf("creating other user's billing address: %v", err)
	}

	var reloadedSecond Address
	if err := db.Where("id = ?", second.ID).First(&reloadedSecond).Error; err != nil {
		t.Fatalf("reloading second address: %v", err)
	}
	if reloadedSecond.Type != AddressTypeBilling {
		t.Errorf("second user's billing address must not affect the first user's; Type = %q, want %q", reloadedSecond.Type, AddressTypeBilling)
	}
}
