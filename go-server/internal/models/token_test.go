package models

import (
	"strings"
	"testing"
)

func TestUnsignTokenValue(t *testing.T) {
	cases := []struct {
		name  string
		value string
		want  string
	}{
		{"three segments", "header.payload.signature", "header.payload"},
		{"already unsigned", "header.payload", "header.payload"},
		{"empty", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := UnsignTokenValue(c.value); got != c.want {
				t.Errorf("UnsignTokenValue(%q) = %q, want %q", c.value, got, c.want)
			}
		})
	}
}

func TestSignTokenValueRoundTrip(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")

	userID := "11111111-1111-1111-1111-111111111111"
	token, _, _, err := GenerateTokenValue(userID, 30)
	if err != nil {
		t.Fatalf("generating token: %v", err)
	}
	if strings.Count(token, ".") != 2 {
		t.Fatalf("expected a 3-segment JWT, got %q", token)
	}

	// Matches BeforeCreate: the DB only ever stores the unsigned half.
	unsigned := UnsignTokenValue(token)
	if strings.Count(unsigned, ".") != 1 {
		t.Fatalf("expected a 2-segment unsigned value, got %q", unsigned)
	}

	// Matches AfterCreate/AfterFind: re-signing the unsigned half with the
	// same secret must reproduce a usable, verifiable token. HS256 signing
	// is deterministic, so it should exactly reproduce the original.
	resigned, err := SignTokenValue(unsigned)
	if err != nil {
		t.Fatalf("re-signing: %v", err)
	}
	if resigned != token {
		t.Errorf("resigned value %q does not match original %q", resigned, token)
	}
}

func TestSignTokenValueDifferentSecretFails(t *testing.T) {
	t.Setenv("JWT_SECRET", "secret-a")
	token, _, _, err := GenerateTokenValue("some-user-id", 30)
	if err != nil {
		t.Fatalf("generating token: %v", err)
	}

	// A DB leak alone shouldn't be enough to forge a usable token: signing
	// the same unsigned payload under a different secret must not match
	// what the original secret would have produced.
	t.Setenv("JWT_SECRET", "secret-b")
	resigned, err := SignTokenValue(UnsignTokenValue(token))
	if err != nil {
		t.Fatalf("re-signing: %v", err)
	}
	if resigned == token {
		t.Error("resigning under a different secret should not reproduce the original token")
	}
}
