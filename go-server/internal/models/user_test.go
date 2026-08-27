package models

import "testing"

func TestUserBeforeSaveEmailValidation(t *testing.T) {
	cases := []struct {
		email   string
		wantErr bool
	}{
		{"person@example.com", false},
		{"first.last+tag@sub.example.co", false},
		{"", false}, // matches the Node validator: only runs when a value is present
		{"not-an-email", true},
		{"missing-domain@", true},
		{"@missing-local.com", true},
	}
	for _, c := range cases {
		u := &User{Email: c.email}
		err := u.BeforeSave(nil)
		if c.wantErr && err == nil {
			t.Errorf("BeforeSave() with email %q: expected an error, got nil", c.email)
		}
		if !c.wantErr && err != nil {
			t.Errorf("BeforeSave() with email %q: unexpected error: %v", c.email, err)
		}
	}
}

func TestUserPasswordRoundTrip(t *testing.T) {
	u := &User{}
	if err := u.SetPassword("correct horse battery staple"); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	if u.Password == "correct horse battery staple" {
		t.Fatal("SetPassword should hash the password, not store it verbatim")
	}
	if err := u.ComparePassword("correct horse battery staple"); err != nil {
		t.Errorf("ComparePassword with the correct password: %v", err)
	}
	if err := u.ComparePassword("wrong password"); err == nil {
		t.Error("ComparePassword with the wrong password: expected an error, got nil")
	}
}
