package graph_test

import (
	"testing"
	"time"

	"storeapi/internal/models"
)

const ordPlaceDry = `mutation($a: String!, $s: String!, $notes: String, $local: Boolean) {
  placeOrder(addressId: $a, clientSecret: $s, notes: $notes, dryRun: true, localDelivery: $local) {
    id userId addressId notes paymentIntentId taxRate shippingCost isShipped isComplete subTotal totalCost
    user { email } address { id recipient } orderedProducts { id }
  }
}`

type ordShop struct {
	e          *Env
	user, bob  *models.User
	addr       *models.Address
	p1, p2, p3 *models.Product
}

// ordNewShop: user's cart = 2xp1 ($10, stock 10) + 3xp2 ($2.50, stock 3).
func ordNewShop(t *testing.T) *ordShop {
	e := newEnv(t)
	s := &ordShop{e: e}
	s.user = e.NewUser("u@x.com", false)
	s.bob = e.NewUser("bob@x.com", false)
	s.addr = ordAddress(t, e, s.user)
	s.p1 = ordProduct(t, e, "Mug", 1000, 10, true, false)
	s.p2 = ordProduct(t, e, "Plate", 250, 3, true, false)
	s.p3 = ordProduct(t, e, "Custom", 5000, 1, true, true)
	ordCart(t, e, s.user, s.p1, 2)
	ordCart(t, e, s.user, s.p2, 3)
	ordCart(t, e, s.bob, s.p1, 5)
	return s
}

func (s *ordShop) assertUntouched(t *testing.T) {
	t.Helper()
	if n := ordCount(t, s.e, &models.Order{}); n != 0 {
		t.Errorf("orders persisted: %d", n)
	}
	if n := ordCount(t, s.e, &models.OrderProduct{}); n != 0 {
		t.Errorf("order products persisted: %d", n)
	}
	if q := ordProductQty(t, s.e, s.p1.ID); q != 10 {
		t.Errorf("p1 stock changed to %d", q)
	}
	if q := ordProductQty(t, s.e, s.p2.ID); q != 3 {
		t.Errorf("p2 stock changed to %d", q)
	}
	var carts []models.UserProduct
	s.e.DB.Find(&carts)
	if len(carts) != 3 {
		t.Errorf("cart rows changed: %d", len(carts))
	}
	for _, c := range carts {
		if (c.UserID == s.bob.ID && c.Count != 5) || (c.UserID == s.user.ID && c.ProductID == s.p1.ID && c.Count != 2) {
			t.Errorf("cart counts changed: %+v", c)
		}
	}
}

func TestOrdPlaceOrderDryRun(t *testing.T) {
	s := ordNewShop(t)
	vars := map[string]any{"a": s.addr.ID, "s": "pi_abc123_secret_zzz", "notes": "leave on porch"}

	r := ordDo(s.e, ordPlaceDry, vars, s.user)
	r.NoErrors(t)
	if r.Str(t, "placeOrder.id") == "" || r.Str(t, "placeOrder.userId") != s.user.ID || r.Str(t, "placeOrder.addressId") != s.addr.ID {
		t.Errorf("identity fields: %s", r.Raw)
	}
	if r.Str(t, "placeOrder.paymentIntentId") != "pi_abc123" {
		t.Errorf("paymentIntentId must be clientSecret split at _secret: %s", r.Raw)
	}
	if r.Str(t, "placeOrder.notes") != "leave on porch" {
		t.Errorf("notes: %s", r.Raw)
	}
	if r.Num(t, "placeOrder.taxRate") != 0.08725 || r.Num(t, "placeOrder.shippingCost") != 500 {
		t.Errorf("tax/shipping: %s", r.Raw)
	}
	// 2*1000 + 3*250 = 2750; tax floor(239.9375)=239; + 500 shipping
	if r.Num(t, "placeOrder.subTotal") != 2750 || r.Num(t, "placeOrder.totalCost") != 3489 {
		t.Errorf("totals: %s", r.Raw)
	}
	if r.Bool(t, "placeOrder.isShipped") || r.Bool(t, "placeOrder.isComplete") {
		t.Errorf("new order flags: %s", r.Raw)
	}
	if r.Str(t, "placeOrder.user.email") != "u@x.com" || r.Str(t, "placeOrder.address.recipient") != "Jane Doe" {
		t.Errorf("nested: %s", r.Raw)
	}
	// Node's orderedProducts field resolver is loader-based, and a dry run is
	// rolled back, so it comes back empty.
	if r.Len(t, "placeOrder.orderedProducts") != 0 {
		t.Errorf("dry run orderedProducts should be empty: %s", r.Raw)
	}
	s.assertUntouched(t)

	t.Run("same clientSecret can be dry-run repeatedly (unique pi id rolled back)", func(t *testing.T) {
		r := ordDo(s.e, ordPlaceDry, vars, s.user)
		r.NoErrors(t)
		s.assertUntouched(t)
	})

	t.Run("localDelivery zeroes shipping", func(t *testing.T) {
		v := map[string]any{"a": s.addr.ID, "s": "pi_x_secret_y", "local": true}
		r := ordDo(s.e, ordPlaceDry, v, s.user)
		r.NoErrors(t)
		if r.Num(t, "placeOrder.shippingCost") != 0 || r.Num(t, "placeOrder.totalCost") != 2989 {
			t.Errorf("%s", r.Raw)
		}
		s.assertUntouched(t)
	})

	t.Run("secret without _secret suffix is used whole", func(t *testing.T) {
		v := map[string]any{"a": s.addr.ID, "s": "pi_plain"}
		r := ordDo(s.e, ordPlaceDry, v, s.user)
		r.NoErrors(t)
		if r.Str(t, "placeOrder.paymentIntentId") != "pi_plain" {
			t.Errorf("%s", r.Raw)
		}
	})
}

func TestOrdPlaceOrderDryRunEdgeCases(t *testing.T) {
	t.Run("empty cart still yields an order with shipping only", func(t *testing.T) {
		s := ordNewShop(t)
		carol := s.e.NewUser("c@x.com", false)
		addr := ordAddress(t, s.e, carol)
		r := ordDo(s.e, ordPlaceDry, map[string]any{"a": addr.ID, "s": "pi_1_secret_a"}, carol)
		r.NoErrors(t)
		if r.Num(t, "placeOrder.subTotal") != 0 || r.Num(t, "placeOrder.totalCost") != 500 {
			t.Errorf("%s", r.Raw)
		}
	})

	t.Run("inactive product", func(t *testing.T) {
		s := ordNewShop(t)
		s.e.DB.Model(s.p1).Update("is_active", false)
		r := ordDo(s.e, ordPlaceDry, map[string]any{"a": s.addr.ID, "s": "pi_1_secret_a"}, s.user)
		r.HasError(t, "This product is inactive.")
	})

	t.Run("insufficient stock", func(t *testing.T) {
		s := ordNewShop(t)
		s.e.DB.Model(s.p2).Update("quantity", 2) // cart wants 3
		r := ordDo(s.e, ordPlaceDry, map[string]any{"a": s.addr.ID, "s": "pi_1_secret_a"}, s.user)
		r.HasError(t, "You cannot order more than what is available unless it can be made to order.")
		if n := ordCount(t, s.e, &models.Order{}); n != 0 {
			t.Errorf("partial order persisted")
		}
		if q := ordProductQty(t, s.e, s.p1.ID); q != 10 {
			t.Errorf("p1 stock mutated despite failure: %d", q)
		}
	})

	t.Run("made-to-order may exceed stock", func(t *testing.T) {
		s := ordNewShop(t)
		ordCart(t, s.e, s.user, s.p3, 4) // stock 1
		r := ordDo(s.e, ordPlaceDry, map[string]any{"a": s.addr.ID, "s": "pi_1_secret_a"}, s.user)
		r.NoErrors(t)
		if r.Num(t, "placeOrder.subTotal") != 2750+4*5000 {
			t.Errorf("%s", r.Raw)
		}
		if q := ordProductQty(t, s.e, s.p3.ID); q != 1 {
			t.Errorf("dry run mutated made-to-order stock: %d", q)
		}
	})

	t.Run("unknown address id is rejected (FK)", func(t *testing.T) {
		s := ordNewShop(t)
		r := ordDo(s.e, ordPlaceDry, map[string]any{"a": "nope", "s": "pi_1_secret_a"}, s.user)
		if len(r.Errors) == 0 {
			t.Fatalf("expected an error: %s", r.Raw)
		}
		s.assertUntouched(t)
	})
}

// A non-dry-run placeOrder first asks Stripe whether the payment succeeded.
// With no reachable Stripe the call errors, and Node rolls the transaction
// back and rethrows: no order, stock and carts untouched.
func TestOrdPlaceOrderPaymentFailureLeavesStateUntouched(t *testing.T) {
	s := ordNewShop(t)
	r := ordDo(s.e, `mutation($a: String!, $s: String!) { placeOrder(addressId: $a, clientSecret: $s) { id } }`,
		map[string]any{"a": s.addr.ID, "s": "pi_abc_secret_def"}, s.user)
	if len(r.Errors) == 0 {
		t.Fatalf("expected an error when payment cannot be verified: %s", r.Raw)
	}
	s.assertUntouched(t)
}

func TestOrdStripeQueriesRequireReachableStripe(t *testing.T) {
	s := ordNewShop(t)
	for name, q := range map[string]string{
		"clientSecret (create)": `{ clientSecret(totalCost: 3489) }`,
		"clientSecret (update)": `{ clientSecret(totalCost: 3489, clientSecret: "pi_1_secret_x") }`,
		"paymentSucceeded":      `{ paymentSucceeded(clientSecret: "pi_1_secret_x") }`,
	} {
		t.Run(name, func(t *testing.T) {
			r := ordDo(s.e, q, nil, s.user)
			if len(r.Errors) == 0 {
				t.Fatalf("expected error with Stripe unavailable: %s", r.Raw)
			}
		})
	}
}

func TestOrdUpdateOrder(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	u := e.NewUser("u@x.com", false)
	a := ordAddress(t, e, u)
	p := ordProduct(t, e, "Mug", 1000, 10, true, false)

	fresh := func() *models.Order {
		return ordOrder(t, e, u, a, time.Now(), ordLine{p, 1, 1000})
	}
	reload := func(id string) models.Order {
		var o models.Order
		if err := e.DB.Where("id = ?", id).First(&o).Error; err != nil {
			t.Fatal(err)
		}
		return o
	}
	const sel = `{ id isShipped isComplete shippedOn completedOn trackingNumber notes user { email } address { id } orderedProducts { count } }`

	t.Run("unknown id", func(t *testing.T) {
		ordDo(e, `mutation { updateOrder(id: "nope", notes: "x") { id } }`, nil, admin).HasError(t, "Invalid id")
	})

	t.Run("notes and completedOn only (no shipped email path)", func(t *testing.T) {
		o := fresh()
		r := ordDo(e, `mutation($id: String!) { updateOrder(id: $id, notes: "hi", completedOn: "2024-03-05T10:00:00Z") `+sel+` }`, map[string]any{"id": o.ID}, admin)
		r.NoErrors(t)
		if r.Str(t, "updateOrder.notes") != "hi" || !r.Bool(t, "updateOrder.isComplete") || r.Bool(t, "updateOrder.isShipped") {
			t.Errorf("%s", r.Raw)
		}
		if r.Str(t, "updateOrder.user.email") != "u@x.com" || r.Len(t, "updateOrder.orderedProducts") != 1 || r.Str(t, "updateOrder.address.id") != a.ID {
			t.Errorf("nested fields: %s", r.Raw)
		}
		got := reload(o.ID)
		if deref(got.Notes) != "hi" || got.CompletedOn == nil || !got.CompletedOn.Equal(time.Date(2024, 3, 5, 10, 0, 0, 0, time.UTC)) || got.ShippedOn != nil {
			t.Errorf("db state: %+v", got)
		}
	})

	t.Run("omitted args leave existing values alone", func(t *testing.T) {
		o := fresh()
		e.DB.Model(o).Updates(map[string]any{"notes": "keep", "tracking_number": "TRK1"})
		r := ordDo(e, `mutation($id: String!) { updateOrder(id: $id, completedOn: "2024-03-05T10:00:00Z") { id } }`, map[string]any{"id": o.ID}, admin)
		r.NoErrors(t)
		got := reload(o.ID)
		if deref(got.Notes) != "keep" || deref(got.TrackingNumber) != "TRK1" {
			t.Errorf("clobbered: %+v", got)
		}
	})

	t.Run("tracking number alone does not ship", func(t *testing.T) {
		o := fresh()
		r := ordDo(e, `mutation($id: String!) { updateOrder(id: $id, trackingNumber: "TRK9") { trackingNumber isShipped } }`, map[string]any{"id": o.ID}, admin)
		r.NoErrors(t)
		if r.Str(t, "updateOrder.trackingNumber") != "TRK9" || r.Bool(t, "updateOrder.isShipped") {
			t.Errorf("%s", r.Raw)
		}
	})

	// Shipping with a tracking number triggers the customer email. Mailgun is
	// unreachable here; whatever happens to the response, Node has already
	// saved the order before sending, so the DB must hold the new state.
	t.Run("shipping persists before the email is attempted", func(t *testing.T) {
		o := fresh()
		ordDo(e, `mutation($id: String!) { updateOrder(id: $id, shippedOn: "2024-03-05T00:00:00Z", trackingNumber: "TRK123") { id } }`, map[string]any{"id": o.ID}, admin)
		got := reload(o.ID)
		if got.ShippedOn == nil || deref(got.TrackingNumber) != "TRK123" {
			t.Errorf("shipment not saved: %+v", got)
		}
	})

	t.Run("explicit null clears a field (Node assigns when !== undefined)", func(t *testing.T) {
		o := fresh()
		e.DB.Model(o).Updates(map[string]any{"shipped_on": time.Now(), "completed_on": time.Now()})
		r := ordDo(e, `mutation($id: String!) { updateOrder(id: $id, shippedOn: null, completedOn: null) { isShipped isComplete } }`, map[string]any{"id": o.ID}, admin)
		r.NoErrors(t)
		if r.Bool(t, "updateOrder.isShipped") || r.Bool(t, "updateOrder.isComplete") {
			t.Errorf("explicit null did not clear: %s", r.Raw)
		}
	})
}

// Node's sendMessage awaits Mailgun and lets a failure reject the mutation.
func TestOrdSendMessage(t *testing.T) {
	e := newEnv(t)
	// No auth required in Node (no middleware) - anonymous callers reach the
	// mailer, so with Mailgun unreachable the failure is what we observe.
	r := ordDo(e, `mutation { sendMessage(email: "a@b.com", message: "hello") }`, nil, nil)
	if len(r.Errors) == 0 {
		parityBug(t, "sendMessage swallows Mailgun failure and returns false; Node propagates the error (resolver `return !!(await sendEmail(...))`)")
		t.Errorf("expected an error when sending fails: %s", r.Raw)
	}
}
