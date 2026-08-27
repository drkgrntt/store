package models

import "testing"

// TestOrderProductBeforeSaveDefaultsCount mirrors
// TestUserProductBeforeSaveDefaultsCount for OrderProduct's identical
// `@Default(1)` + `@Is("Positive", ...)` pair on count.
func TestOrderProductBeforeSaveDefaultsCount(t *testing.T) {
	op := &OrderProduct{Price: 100}
	if err := op.BeforeSave(nil); err != nil {
		t.Fatalf("BeforeSave() on a zero-value count: unexpected error: %v", err)
	}
	if op.Count != 1 {
		t.Errorf("Count = %d, want 1 (the default)", op.Count)
	}
}

func TestOrderProductBeforeSaveValidation(t *testing.T) {
	cases := []struct {
		name    string
		count   int
		price   int
		wantErr bool
	}{
		{"valid", 2, 0, false},
		{"negative count", -1, 0, true},
		{"negative price", 1, -1, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			op := &OrderProduct{Count: c.count, Price: c.price}
			err := op.BeforeSave(nil)
			if c.wantErr && err == nil {
				t.Error("expected an error, got nil")
			}
			if !c.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
