package graph_test

// Tests for the paths that talk to Stripe and Mailgun, using the
// Resolver.Payments / Resolver.Mailer seams (internal/graph/services.go) so
// the success paths — which move money, stock and email — can run offline.

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v84"

	"storeapi/internal/emails"
	"storeapi/internal/models"
)

type fakePayments struct {
	status       stripe.PaymentIntentStatus
	retrieveErr  error
	retrieved    []string
	updated      []string
	updateParams []*stripe.PaymentIntentUpdateParams
	createParams []*stripe.PaymentIntentCreateParams
}

func (f *fakePayments) RetrieveIntent(_ context.Context, id string) (*stripe.PaymentIntent, error) {
	f.retrieved = append(f.retrieved, id)
	if f.retrieveErr != nil {
		return nil, f.retrieveErr
	}
	return &stripe.PaymentIntent{ID: id, Status: f.status, ClientSecret: id + "_secret_existing"}, nil
}

func (f *fakePayments) UpdateIntent(_ context.Context, id string, p *stripe.PaymentIntentUpdateParams) (*stripe.PaymentIntent, error) {
	f.updated = append(f.updated, id)
	f.updateParams = append(f.updateParams, p)
	return &stripe.PaymentIntent{ID: id, ClientSecret: id + "_secret_updated"}, nil
}

func (f *fakePayments) CreateIntent(_ context.Context, p *stripe.PaymentIntentCreateParams) (*stripe.PaymentIntent, error) {
	f.createParams = append(f.createParams, p)
	return &stripe.PaymentIntent{ID: "pi_new", ClientSecret: "pi_new_secret_abc"}, nil
}

type sentMail struct {
	Template  string
	Variables emails.Variables
	Recipient string
}

type fakeMailer struct {
	sent    []sentMail
	failFor map[string]error // template -> error to return
}

func (f *fakeMailer) Send(template string, v emails.Variables, recipient string) (string, error) {
	f.sent = append(f.sent, sentMail{template, v, recipient})
	if err := f.failFor[template]; err != nil {
		return "", err
	}
	return "msg-id", nil
}

func (f *fakeMailer) templates() []string {
	var out []string
	for _, m := range f.sent {
		out = append(out, m.Template)
	}
	return out
}

func svcSetup(t *testing.T) (*Env, *fakePayments, *fakeMailer) {
	t.Helper()
	e := newEnv(t)
	pay := &fakePayments{status: stripe.PaymentIntentStatusSucceeded}
	mail := &fakeMailer{failFor: map[string]error{}}
	e.Res.Payments = pay
	e.Res.Mailer = mail
	return e, pay, mail
}

const svcPlaceOrder = `mutation($a: String!, $s: String!, $n: String, $l: Boolean) {
  placeOrder(addressId: $a, clientSecret: $s, notes: $n, localDelivery: $l) {
    id userId paymentIntentId notes shippingCost taxRate subTotal totalCost
    orderedProducts { count price product { id } }
  }
}`

func TestSvcPlaceOrderSuccess(t *testing.T) {
	e, pay, mail := svcSetup(t)
	u := e.NewUser("buyer@example.com", false)
	other := e.NewUser("other@example.com", false)
	addr := ordAddress(t, e, u)
	a := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	b := ordProduct(t, e, "Beta", 2500, 1, true, false)
	ordCart(t, e, u, a, 2)
	ordCart(t, e, u, b, 1)
	ordCart(t, e, other, a, 4) // someone else's cart line must shrink (reduceAvailability)

	resp := e.Do(svcPlaceOrder, map[string]any{"a": addr.ID, "s": "pi_123_secret_xyz", "n": "leave on porch", "l": false}, u)
	resp.NoErrors(t)

	// Stripe was asked about the intent id with the secret suffix stripped.
	if len(pay.retrieved) != 1 || pay.retrieved[0] != "pi_123" {
		t.Fatalf("Stripe retrieve calls = %v, want [pi_123]", pay.retrieved)
	}

	// Returned order: 1000*2 + 2500 = 4500; tax floor(4500*0.08725)=392; +500 shipping.
	if got := resp.Str(t, "placeOrder.paymentIntentId"); got != "pi_123" {
		t.Errorf("paymentIntentId = %q", got)
	}
	if got := resp.Num(t, "placeOrder.subTotal"); got != 4500 {
		t.Errorf("subTotal = %v, want 4500", got)
	}
	if got := resp.Num(t, "placeOrder.totalCost"); got != 5392 {
		t.Errorf("totalCost = %v, want 5392", got)
	}
	if got := resp.Num(t, "placeOrder.shippingCost"); got != 500 {
		t.Errorf("shippingCost = %v, want 500", got)
	}

	// Committed rows.
	var orders []models.Order
	e.DB.Find(&orders)
	if len(orders) != 1 || orders[0].UserID != u.ID || orders[0].AddressID != addr.ID || deref(orders[0].Notes) != "leave on porch" {
		t.Fatalf("orders = %+v", orders)
	}
	var lines []models.OrderProduct
	e.DB.Where("order_id = ?", orders[0].ID).Find(&lines)
	if len(lines) != 2 {
		t.Fatalf("order lines = %d, want 2", len(lines))
	}
	prices := map[string]int{}
	for _, l := range lines {
		prices[l.ProductID] = l.Price
	}
	if prices[a.ID] != 1000 || prices[b.ID] != 2500 {
		t.Errorf("snapshot prices = %v", prices)
	}

	// Stock decremented (clamped at 0).
	if got := ordProductQty(t, e, a.ID); got != 3 {
		t.Errorf("Alpha stock = %d, want 3", got)
	}
	if got := ordProductQty(t, e, b.ID); got != 0 {
		t.Errorf("Beta stock = %d, want 0", got)
	}

	// Buyer's cart is emptied; the other user's Alpha line shrinks 4 -> 2.
	var mine, theirs []models.UserProduct
	e.DB.Where("user_id = ?", u.ID).Find(&mine)
	e.DB.Where("user_id = ?", other.ID).Find(&theirs)
	if len(mine) != 0 {
		t.Errorf("buyer cart not cleared: %+v", mine)
	}
	if len(theirs) != 1 || theirs[0].Count != 2 {
		t.Errorf("other user's cart = %+v, want one line with count 2", theirs)
	}

	// Emails: admin (recipient "" -> ADMIN_EMAIL) then customer.
	if got := mail.templates(); len(got) != 2 || got[0] != emails.AdminNewOrder || got[1] != emails.CustomerNewOrder {
		t.Fatalf("emails sent = %v", got)
	}
	if mail.sent[0].Recipient != "" || mail.sent[1].Recipient != "buyer@example.com" {
		t.Errorf("recipients = %q, %q", mail.sent[0].Recipient, mail.sent[1].Recipient)
	}
	v := mail.sent[1].Variables
	for k, want := range map[string]string{
		"subTotal": "45.00", "shippingCost": "5.00", "tax": "3.92", "totalCost": "53.92",
		"localDelivery": "no", "notes": "leave on porch", "email": "buyer@example.com",
	} {
		if v[k] != want {
			t.Errorf("email variable %s = %v, want %q", k, v[k], want)
		}
	}
	if !strings.HasSuffix(v["stripePaymentUrl"].(string), "/pi_123") {
		t.Errorf("stripePaymentUrl = %v", v["stripePaymentUrl"])
	}
	if list, _ := v["productList"].([]map[string]string); len(list) != 2 {
		t.Errorf("productList = %v", v["productList"])
	}
}

func TestSvcPlaceOrderLocalDeliveryHasNoShipping(t *testing.T) {
	e, _, mail := svcSetup(t)
	u := e.NewUser("buyer@example.com", false)
	addr := ordAddress(t, e, u)
	p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	ordCart(t, e, u, p, 1)

	resp := e.Do(svcPlaceOrder, map[string]any{"a": addr.ID, "s": "pi_1_secret_x", "n": nil, "l": true}, u)
	resp.NoErrors(t)
	if got := resp.Num(t, "placeOrder.totalCost"); got != 1087 { // 1000 + floor(87.25)
		t.Errorf("totalCost = %v, want 1087", got)
	}
	if mail.sent[0].Variables["localDelivery"] != "yes" {
		t.Errorf("localDelivery = %v", mail.sent[0].Variables["localDelivery"])
	}
}

func TestSvcPlaceOrderPaymentNotSucceeded(t *testing.T) {
	e, pay, mail := svcSetup(t)
	pay.status = stripe.PaymentIntentStatusRequiresPaymentMethod
	u := e.NewUser("buyer@example.com", false)
	addr := ordAddress(t, e, u)
	p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	ordCart(t, e, u, p, 2)

	resp := e.Do(svcPlaceOrder, map[string]any{"a": addr.ID, "s": "pi_1_secret_x", "n": nil, "l": false}, u)
	resp.HasError(t, "The payment for this order did not succeed.")

	if n := ordCount(t, e, &models.Order{}); n != 0 {
		t.Errorf("orders created = %d, want 0", n)
	}
	if got := ordProductQty(t, e, p.ID); got != 5 {
		t.Errorf("stock changed to %d", got)
	}
	if n := ordCount(t, e, &models.UserProduct{}); n != 1 {
		t.Errorf("cart lines = %d, want 1 (untouched)", n)
	}
	if len(mail.sent) != 0 {
		t.Errorf("emails sent = %v, want none", mail.templates())
	}
}

func TestSvcPlaceOrderStripeErrorLeavesStateUntouched(t *testing.T) {
	e, pay, mail := svcSetup(t)
	pay.retrieveErr = errors.New("stripe is down")
	u := e.NewUser("buyer@example.com", false)
	addr := ordAddress(t, e, u)
	p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	ordCart(t, e, u, p, 1)

	e.Do(svcPlaceOrder, map[string]any{"a": addr.ID, "s": "pi_1_secret_x", "n": nil, "l": false}, u).HasError(t, "stripe is down")
	if ordCount(t, e, &models.Order{}) != 0 || ordProductQty(t, e, p.ID) != 5 || len(mail.sent) != 0 {
		t.Error("state changed despite Stripe failure")
	}
}

// Matches Node: the emails are awaited inline after commit, so a mail failure
// surfaces as a placeOrder error even though the order (and the charge) stand.
func TestSvcPlaceOrderMailFailureAfterCommit(t *testing.T) {
	e, _, mail := svcSetup(t)
	mail.failFor[emails.AdminNewOrder] = errors.New("mailgun down")
	u := e.NewUser("buyer@example.com", false)
	addr := ordAddress(t, e, u)
	p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	ordCart(t, e, u, p, 2)

	e.Do(svcPlaceOrder, map[string]any{"a": addr.ID, "s": "pi_1_secret_x", "n": nil, "l": false}, u).HasError(t, "mailgun down")
	if ordCount(t, e, &models.Order{}) != 1 {
		t.Error("order should remain committed")
	}
	if got := ordProductQty(t, e, p.ID); got != 3 {
		t.Errorf("stock = %d, want 3 (decrement committed)", got)
	}
	if len(mail.sent) != 1 {
		t.Errorf("emails attempted = %v, want only the failing admin one", mail.templates())
	}
}

func TestSvcPlaceOrderDryRunDoesNotCallStripeOrMail(t *testing.T) {
	e, pay, mail := svcSetup(t)
	u := e.NewUser("buyer@example.com", false)
	addr := ordAddress(t, e, u)
	p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
	ordCart(t, e, u, p, 1)

	e.Do(`mutation($a:String!){ placeOrder(addressId:$a, clientSecret:"pi_1_secret_x", dryRun:true){ id } }`,
		map[string]any{"a": addr.ID}, u).NoErrors(t)
	if len(pay.retrieved) != 0 || len(mail.sent) != 0 {
		t.Errorf("dry run touched externals: stripe=%v mail=%v", pay.retrieved, mail.templates())
	}
	if ordCount(t, e, &models.Order{}) != 0 || ordProductQty(t, e, p.ID) != 5 {
		t.Error("dry run persisted state")
	}
}

func TestSvcClientSecret(t *testing.T) {
	const q = `query($t: Float!, $s: String){ clientSecret(totalCost: $t, clientSecret: $s) }`

	t.Run("creates a new intent when no secret is given", func(t *testing.T) {
		e, pay, _ := svcSetup(t)
		u := e.NewUser("buyer@example.com", false)
		p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
		ordCart(t, e, u, p, 2)

		resp := e.Do(q, map[string]any{"t": 2587, "s": nil}, u)
		resp.NoErrors(t)
		if got := resp.Str(t, "clientSecret"); got != "pi_new_secret_abc" {
			t.Errorf("clientSecret = %q", got)
		}
		if len(pay.createParams) != 1 {
			t.Fatalf("create calls = %d", len(pay.createParams))
		}
		c := pay.createParams[0]
		if *c.Amount != 2587 || *c.Currency != "usd" || !*c.AutomaticPaymentMethods.Enabled {
			t.Errorf("create params = amount %d currency %s", *c.Amount, *c.Currency)
		}
		for _, want := range []string{"Alpha - $10.00 x2", "Shipping - $5.00", "Tax - $1.74"} {
			if !strings.Contains(*c.Description, want) {
				t.Errorf("description %q missing %q", *c.Description, want)
			}
		}
	})

	t.Run("updates an unfinished intent", func(t *testing.T) {
		e, pay, _ := svcSetup(t)
		pay.status = stripe.PaymentIntentStatusRequiresPaymentMethod
		u := e.NewUser("buyer@example.com", false)
		resp := e.Do(q, map[string]any{"t": 999, "s": "pi_old_secret_zzz"}, u)
		resp.NoErrors(t)
		if len(pay.updated) != 1 || pay.updated[0] != "pi_old" || *pay.updateParams[0].Amount != 999 {
			t.Errorf("update calls = %v", pay.updated)
		}
		if got := resp.Str(t, "clientSecret"); got != "pi_old_secret_updated" {
			t.Errorf("clientSecret = %q", got)
		}
		if len(pay.createParams) != 0 {
			t.Error("should not create a second intent")
		}
	})

	t.Run("leaves an already-succeeded intent alone", func(t *testing.T) {
		e, pay, _ := svcSetup(t)
		u := e.NewUser("buyer@example.com", false)
		resp := e.Do(q, map[string]any{"t": 999, "s": "pi_done_secret_zzz"}, u)
		resp.NoErrors(t)
		if len(pay.updated) != 0 || len(pay.createParams) != 0 {
			t.Error("succeeded intent must not be modified or recreated")
		}
		if got := resp.Str(t, "clientSecret"); got != "pi_done_secret_existing" {
			t.Errorf("clientSecret = %q", got)
		}
	})
}

func TestSvcPaymentSucceeded(t *testing.T) {
	const q = `query($s: String!){ paymentSucceeded(clientSecret: $s) }`
	e, pay, _ := svcSetup(t)
	u := e.NewUser("buyer@example.com", false)

	r := e.Do(q, map[string]any{"s": "pi_9_secret_x"}, u)
	r.NoErrors(t)
	if !r.Bool(t, "paymentSucceeded") || pay.retrieved[0] != "pi_9" {
		t.Errorf("succeeded=%v retrieved=%v", r.Get("paymentSucceeded"), pay.retrieved)
	}

	pay.status = stripe.PaymentIntentStatusCanceled
	r = e.Do(q, map[string]any{"s": "pi_9_secret_x"}, u)
	r.NoErrors(t)
	if r.Bool(t, "paymentSucceeded") {
		t.Error("canceled intent reported as succeeded")
	}
}

func TestSvcUpdateOrderShippedEmail(t *testing.T) {
	const q = `mutation($id:String!, $s: DateTime, $tn: String){ updateOrder(id:$id, shippedOn:$s, trackingNumber:$tn){ id isShipped } }`

	t.Run("sends the shipped email to the order's owner", func(t *testing.T) {
		e, _, mail := svcSetup(t)
		admin := e.NewUser("admin@example.com", true)
		buyer := e.NewUser("buyer@example.com", false)
		p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
		o := ordOrder(t, e, buyer, ordAddress(t, e, buyer), time.Now(), ordLine{P: p, Count: 2, Price: 1000})

		e.Do(q, map[string]any{"id": o.ID, "s": "2026-11-10T12:00:00Z", "tn": "TRACK123"}, admin).NoErrors(t)
		if len(mail.sent) != 1 || mail.sent[0].Template != emails.OrderHasShipped || mail.sent[0].Recipient != "buyer@example.com" {
			t.Fatalf("emails = %+v", mail.sent)
		}
		v := mail.sent[0].Variables
		if v["trackingNumber"] != "TRACK123" || v["subTotal"] != "20.00" || v["orderId"] != o.ID {
			t.Errorf("variables = %v", v)
		}
	})

	t.Run("a mail failure is logged, not surfaced", func(t *testing.T) {
		e, _, mail := svcSetup(t)
		mail.failFor[emails.OrderHasShipped] = errors.New("mailgun down")
		admin := e.NewUser("admin@example.com", true)
		buyer := e.NewUser("buyer@example.com", false)
		p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
		o := ordOrder(t, e, buyer, ordAddress(t, e, buyer), time.Now(), ordLine{P: p, Count: 1, Price: 1000})

		resp := e.Do(q, map[string]any{"id": o.ID, "s": "2026-11-10T12:00:00Z", "tn": "T"}, admin)
		resp.NoErrors(t)
		if !resp.Bool(t, "updateOrder.isShipped") {
			t.Error("order should still be saved as shipped")
		}
	})

	t.Run("no email for an empty tracking number (Node truthiness check)", func(t *testing.T) {
		e, _, mail := svcSetup(t)
		admin := e.NewUser("admin@example.com", true)
		buyer := e.NewUser("buyer@example.com", false)
		p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
		o := ordOrder(t, e, buyer, ordAddress(t, e, buyer), time.Now(), ordLine{P: p, Count: 1, Price: 1000})

		e.Do(q, map[string]any{"id": o.ID, "s": "2026-11-10T12:00:00Z", "tn": ""}, admin).NoErrors(t)
		if len(mail.sent) != 0 {
			t.Errorf("unexpected emails: %v", mail.templates())
		}
	})

	t.Run("no email without a tracking number", func(t *testing.T) {
		e, _, mail := svcSetup(t)
		admin := e.NewUser("admin@example.com", true)
		buyer := e.NewUser("buyer@example.com", false)
		p := ordProduct(t, e, "Alpha", 1000, 5, true, false)
		o := ordOrder(t, e, buyer, ordAddress(t, e, buyer), time.Now(), ordLine{P: p, Count: 1, Price: 1000})

		e.Do(q, map[string]any{"id": o.ID, "s": "2026-11-10T12:00:00Z", "tn": nil}, admin).NoErrors(t)
		if len(mail.sent) != 0 {
			t.Errorf("unexpected emails: %v", mail.templates())
		}
	})
}

func TestSvcSendMessage(t *testing.T) {
	e, _, mail := svcSetup(t)
	resp := e.Do(`mutation{ sendMessage(email:"a@b.com", message:"hello") }`, nil, nil)
	resp.NoErrors(t)
	if !resp.Bool(t, "sendMessage") {
		t.Error("sendMessage = false")
	}
	if len(mail.sent) != 1 || mail.sent[0].Template != emails.ContactMessage || mail.sent[0].Recipient != "" ||
		mail.sent[0].Variables["email"] != "a@b.com" || mail.sent[0].Variables["message"] != "hello" {
		t.Errorf("emails = %+v", mail.sent)
	}
}

func TestSvcForgotPasswordEmail(t *testing.T) {
	t.Setenv("APP_BASE_URL", "https://shop.example.com")
	e, _, mail := svcSetup(t)
	u := e.NewUser("buyer@example.com", false)

	resp := e.Do(`mutation{ forgotPassword(email:"buyer@example.com") }`, nil, nil)
	resp.NoErrors(t)
	if !resp.Bool(t, "forgotPassword") {
		t.Fatal("forgotPassword = false")
	}
	if len(mail.sent) != 1 || mail.sent[0].Template != emails.ForgotPassword || mail.sent[0].Recipient != u.Email {
		t.Fatalf("emails = %+v", mail.sent)
	}
	btn, _ := mail.sent[0].Variables["actionButton"].([]map[string]string)
	if len(btn) != 1 || !strings.HasPrefix(btn[0]["actionLink"], "https://shop.example.com/?modal=reset-forgotten-password&modal-params=token&token=") {
		t.Errorf("actionButton = %v", mail.sent[0].Variables["actionButton"])
	}
	// The token in the link must actually be the one stored for this user.
	tok := btn[0]["actionLink"][strings.LastIndex(btn[0]["actionLink"], "token=")+len("token="):]
	got, err := models.VerifyAndFindUser(e.DB, tok)
	if err != nil || got == nil || got.ID != u.ID {
		t.Errorf("link token does not resolve to the user: %v %v", got, err)
	}
}
