package emails

import (
	"strings"
	"testing"
)

// The variable sets the order resolvers pass (see placeOrder/updateOrder in
// graph/order.resolvers.go; same keys as server/src/utils/email.ts) must fill
// every {{placeholder}} in the order templates, including the product partial.
func TestOrderEmailTemplatesFullyRendered(t *testing.T) {
	row := []map[string]string{
		{"imageUrl": "https://img/1.png", "id": "p1", "title": "Mug", "cost": "$10.00", "quantity": "2"},
		{"imageUrl": "https://img/2.png", "id": "p2", "title": "Plate", "cost": "$2.50", "quantity": "3"},
	}
	common := func() Variables {
		return Variables{
			"orderId": "order-1", "address": "Jane 1 Main", "notes": "porch", "productList": row,
			"subTotal": "27.50", "shippingCost": "5.00", "tax": "2.39", "totalCost": "34.89",
		}
	}
	with := func(extra Variables) Variables {
		v := common()
		for k, x := range extra {
			v[k] = x
		}
		return v
	}
	cases := map[string]struct {
		vars Variables
		want []string
	}{
		AdminNewOrder: {with(Variables{"email": "c@x.com", "stripePaymentUrl": "https://dashboard.stripe.com/payments/pi_1", "localDelivery": "no"}),
			[]string{"c@x.com", "https://dashboard.stripe.com/payments/pi_1", "Mug", "Plate", "34.89"}},
		CustomerNewOrder: {with(Variables{"localDelivery": "yes"}), []string{"order-1", "Mug", "Plate", "$2.50"}},
		OrderHasShipped:  {with(Variables{"shippedDate": "3/5/2024", "trackingNumber": "TRK123"}), []string{"3/5/2024", "TRK123", "Mug", "Plate"}},
		ContactMessage:   {Variables{"email": "a@b.com", "message": "hello there"}, []string{"a@b.com", "hello there"}},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			html, err := parseEmail(name, c.vars)
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(html, "{{") {
				i := strings.Index(html, "{{")
				t.Errorf("unreplaced placeholder near %q", html[i:min(len(html), i+30)])
			}
			for _, w := range c.want {
				if !strings.Contains(html, w) {
					t.Errorf("rendered email missing %q", w)
				}
			}
			if strings.Count(html, "Mug") != strings.Count(html, "Plate") {
				t.Errorf("each product row should render once")
			}
		})
	}
}
