package models

import "testing"

func TestProductBeforeSavePositiveValidation(t *testing.T) {
	cases := []struct {
		name     string
		price    int
		quantity int
		wantErr  bool
	}{
		{"both zero, valid", 0, 0, false},
		{"both positive, valid", 1500, 10, false},
		{"negative price", -1, 0, true},
		{"negative quantity", 0, -1, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := &Product{Price: c.price, Quantity: c.quantity}
			err := p.BeforeSave(nil)
			if c.wantErr && err == nil {
				t.Error("expected an error, got nil")
			}
			if !c.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
