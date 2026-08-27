package models

import "testing"

// TestUserProductBeforeSaveDefaultsCount is a regression test: Sequelize
// applies a declared `@Default(1)` to the instance before running
// validators, so a freshly-built UserProduct with no explicit count (Go
// zero value 0) must still pass validation and end up with count 1 — not
// fail with `"0" must be greater than 0.` (see internal/graph/cart.resolvers.go's
// addToCart, which relies on exactly this when creating a new cart line).
func TestUserProductBeforeSaveDefaultsCount(t *testing.T) {
	up := &UserProduct{}
	if err := up.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave() on a zero-value count: unexpected error: %v", err)
	}
	if up.Count != 1 {
		t.Errorf("Count = %d, want 1 (the default)", up.Count)
	}
}

func TestUserProductBeforeSaveRejectsNegativeCount(t *testing.T) {
	up := &UserProduct{Count: -1}
	if err := up.BeforeSave(nil); err == nil {
		t.Error("expected an error for a negative count, got nil")
	}
}
