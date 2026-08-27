package emails

import (
	"strings"
	"testing"
)

func TestParseEmailSubstitutesPlainVariables(t *testing.T) {
	html, err := parseEmail(ForgotPassword, Variables{
		"email": "person@example.com",
		"actionButton": []map[string]string{
			{"actionText": "Reset my password", "actionLink": "https://example.com/reset"},
		},
	})
	if err != nil {
		t.Fatalf("parseEmail: %v", err)
	}

	for _, want := range []string{
		"person@example.com",
		"https://example.com/reset",
		"Reset my password",
	} {
		if !strings.Contains(html, want) {
			t.Errorf("rendered forgot-password email missing %q\n---\n%s", want, html)
		}
	}
	if strings.Contains(html, "{{") {
		t.Errorf("rendered email still has an unreplaced placeholder:\n%s", html)
	}
}

func TestParseEmailExpandsPartialPerRow(t *testing.T) {
	html, err := parseEmail(AdminNewOrder, Variables{
		"email":            "admin@example.com",
		"orderId":          "order-1",
		"stripePaymentUrl": "https://dashboard.stripe.com/payments/pi_123",
		"address":          "123 Main St",
		"notes":            "",
		"subTotal":         "10.00",
		"shippingCost":     "5.00",
		"tax":              "0.87",
		"totalCost":        "15.87",
		"localDelivery":    "no",
		"productList": []map[string]string{
			{"imageUrl": "https://img/1.png", "id": "p1", "title": "Mug", "cost": "$10.00", "quantity": "1"},
			{"imageUrl": "https://img/2.png", "id": "p2", "title": "Plate", "cost": "$5.00", "quantity": "2"},
		},
	})
	if err != nil {
		t.Fatalf("parseEmail: %v", err)
	}

	for _, want := range []string{"Mug", "Plate", "https://img/1.png", "https://img/2.png"} {
		if !strings.Contains(html, want) {
			t.Errorf("rendered admin-new-order email missing %q", want)
		}
	}
}

func TestParseEmailUnknownTemplate(t *testing.T) {
	if _, err := parseEmail("nonexistent-template", Variables{}); err == nil {
		t.Error("expected an error for an unknown template, got nil")
	}
}
