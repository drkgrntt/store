package graph_test

import (
	"fmt"
	"testing"
	"time"
)

const ordFields = `id userId addressId shippedOn completedOn trackingNumber paymentIntentId notes taxRate shippingCost
  isShipped isComplete subTotal totalCost createdAt updatedAt`

func TestOrdAuthGates(t *testing.T) {
	e := newEnv(t)
	user := e.NewUser("u@x.com", false)

	cases := []struct {
		name, query string
		anonErr     string
		userErr     string // "" = a plain user passes the auth gate
	}{
		{"allOrders", `{ allOrders { hasMore } }`, "Not authenticated", "Not allowed"},
		{"orders", `{ orders { id } }`, "Not authenticated", ""},
		{"order", `{ order(id: "x") { id } }`, "Not authenticated", ""},
		{"clientSecret", `{ clientSecret(totalCost: 100) }`, "Not authenticated", ""},
		{"paymentSucceeded", `{ paymentSucceeded(clientSecret: "pi_1_secret_x") }`, "Not authenticated", ""},
		{"placeOrder", `mutation { placeOrder(addressId: "a", clientSecret: "pi_1_secret_x", dryRun: true) { id } }`, "Not authenticated", ""},
		{"updateOrder", `mutation { updateOrder(id: "x") { id } }`, "Not authenticated", "Not allowed"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ordDo(e, c.query, nil, nil).HasError(t, c.anonErr)
			if c.userErr != "" {
				ordDo(e, c.query, nil, user).HasError(t, c.userErr)
			}
		})
	}
}

func TestOrdOrdersQuery(t *testing.T) {
	e := newEnv(t)
	alice := e.NewUser("alice@x.com", false)
	bob := e.NewUser("bob@x.com", false)
	addrA, addrB := ordAddress(t, e, alice), ordAddress(t, e, bob)
	p1 := ordProduct(t, e, "Mug", 1000, 10, true, false)
	p2 := ordProduct(t, e, "Plate", 250, 10, true, false)

	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	oldest := ordOrder(t, e, alice, addrA, base, ordLine{p1, 1, 1000})
	newest := ordOrder(t, e, alice, addrA, base.Add(48*time.Hour), ordLine{p1, 2, 1000}, ordLine{p2, 4, 250})
	middle := ordOrder(t, e, alice, addrA, base.Add(24*time.Hour))
	bobs := ordOrder(t, e, bob, addrB, base.Add(72*time.Hour), ordLine{p2, 1, 250})

	q := `{ orders { id user { email } address { id recipient } orderedProducts { count price product { title } } subTotal totalCost } }`
	r := ordDo(e, q, nil, alice)
	r.NoErrors(t)
	if r.Len(t, "orders") != 3 {
		t.Fatalf("alice should see only her 3 orders: %s", r.Raw)
	}
	for i, want := range []string{newest.ID, middle.ID, oldest.ID} {
		if got := r.Str(t, fmt.Sprintf("orders.%d.id", i)); got != want {
			t.Errorf("orders[%d] = %s, want %s (newest first)", i, got, want)
		}
	}
	if r.Str(t, "orders.0.user.email") != "alice@x.com" || r.Str(t, "orders.0.address.id") != addrA.ID {
		t.Errorf("nested user/address wrong: %s", r.Raw)
	}
	if r.Len(t, "orders.0.orderedProducts") != 2 || r.Len(t, "orders.1.orderedProducts") != 0 {
		t.Errorf("orderedProducts wrong: %s", r.Raw)
	}
	titles := map[string]float64{}
	for i := 0; i < 2; i++ {
		titles[r.Str(t, fmt.Sprintf("orders.0.orderedProducts.%d.product.title", i))] = r.Num(t, fmt.Sprintf("orders.0.orderedProducts.%d.count", i))
	}
	if titles["Mug"] != 2 || titles["Plate"] != 4 {
		t.Errorf("ordered product counts wrong: %v", titles)
	}

	rb := ordDo(e, q, nil, bob)
	rb.NoErrors(t)
	if rb.Len(t, "orders") != 1 || rb.Str(t, "orders.0.id") != bobs.ID {
		t.Errorf("bob should see only his order: %s", rb.Raw)
	}

	// An admin's `orders` is still only their own (Node uses me.id).
	admin := e.NewUser("admin@x.com", true)
	ra := ordDo(e, `{ orders { id } }`, nil, admin)
	ra.NoErrors(t)
	if ra.Len(t, "orders") != 0 {
		t.Errorf("admin `orders` must be scoped to the admin's own orders: %s", ra.Raw)
	}
}

func TestOrdOrderQuery(t *testing.T) {
	e := newEnv(t)
	alice := e.NewUser("alice@x.com", false)
	bob := e.NewUser("bob@x.com", false)
	admin := e.NewUser("admin@x.com", true)
	addr := ordAddress(t, e, alice)
	p := ordProduct(t, e, "Mug", 1000, 10, true, false)
	o := ordOrder(t, e, alice, addr, time.Now(), ordLine{p, 1, 1000})

	q := `query($id: String!) { order(id: $id) { id user { id } } }`
	vars := map[string]any{"id": o.ID}

	r := ordDo(e, q, vars, alice)
	r.NoErrors(t)
	if r.Str(t, "order.id") != o.ID {
		t.Errorf("owner should see own order: %s", r.Raw)
	}
	r = ordDo(e, q, vars, admin)
	r.NoErrors(t)
	if r.Str(t, "order.id") != o.ID || r.Str(t, "order.user.id") != alice.ID {
		t.Errorf("admin should see any order: %s", r.Raw)
	}
	r = ordDo(e, q, vars, bob)
	r.NoErrors(t)
	if r.Get("order") != nil {
		t.Errorf("non-owner must get null, got %s", r.Raw)
	}
	r = ordDo(e, q, map[string]any{"id": "does-not-exist"}, admin)
	r.NoErrors(t)
	if r.Get("order") != nil {
		t.Errorf("unknown id must be null: %s", r.Raw)
	}
}

// Order fields as stored, with nothing optional set. Node returns null for
// unset notes/trackingNumber/shippedOn/completedOn (columns are NULL).
func TestOrdFreshOrderFields(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	a := ordAddress(t, e, u)
	o := ordOrder(t, e, u, a, time.Now())

	r := ordDo(e, `query($id: String!) { order(id: $id) { `+ordFields+` } }`, map[string]any{"id": o.ID}, u)
	r.NoErrors(t)
	if r.Str(t, "order.userId") != u.ID || r.Str(t, "order.addressId") != a.ID {
		t.Errorf("fk scalars wrong: %s", r.Raw)
	}
	if r.Num(t, "order.taxRate") != 0.08725 || r.Num(t, "order.shippingCost") != 500 {
		t.Errorf("tax/shipping wrong: %s", r.Raw)
	}
	if r.Bool(t, "order.isShipped") || r.Bool(t, "order.isComplete") {
		t.Errorf("fresh order must not be shipped/complete")
	}
	if r.Get("order.shippedOn") != nil || r.Get("order.completedOn") != nil {
		t.Errorf("dates must be null: %s", r.Raw)
	}
	if r.Num(t, "order.subTotal") != 0 || r.Num(t, "order.totalCost") != 500 {
		t.Errorf("empty order totals: %s", r.Raw)
	}
}

// Node columns are NULL when unset, so notes/trackingNumber are null on the wire.
func TestOrdUnsetNullableStringsAreNull(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	a := ordAddress(t, e, u)
	o := ordOrder(t, e, u, a, time.Now())
	r := ordDo(e, `query($id: String!) { order(id: $id) { notes trackingNumber } }`, map[string]any{"id": o.ID}, u)
	r.NoErrors(t)
	if r.Get("order.notes") != nil || r.Get("order.trackingNumber") != nil {
		t.Errorf("want nulls: %s", r.Raw)
	}
}

func TestOrdTotals(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	a := ordAddress(t, e, u)
	p1 := ordProduct(t, e, "A", 1, 100, true, false)
	p2 := ordProduct(t, e, "B", 1, 100, true, false)

	cases := []struct {
		name               string
		lines              []ordLine
		sub, shipping, tot float64
		tax                float64 // floor(sub*0.08725)
	}{
		{"one line", []ordLine{{p1, 1, 1000}}, 1000, 500, 1587, 87},
		{"multi line uses snapshot price not product price", []ordLine{{p1, 3, 1999}, {p2, 2, 250}}, 6497, 500, 6497 + 500 + 566, 566},
		{"tax floors, not rounds", []ordLine{{p1, 1, 99}}, 99, 500, 99 + 500 + 8, 8}, // 8.63 -> 8
		{"free item", []ordLine{{p1, 5, 0}}, 0, 500, 500, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			o := ordOrder(t, e, u, a, time.Now(), c.lines...)
			// Product price changing later must not affect the order.
			e.DB.Model(p1).Update("price", 99999)
			defer e.DB.Model(p1).Update("price", 1)
			r := ordDo(e, `query($id: String!) { order(id: $id) { subTotal totalCost shippingCost } }`, map[string]any{"id": o.ID}, u)
			r.NoErrors(t)
			if got := r.Num(t, "order.subTotal"); got != c.sub {
				t.Errorf("subTotal = %v, want %v", got, c.sub)
			}
			if got := r.Num(t, "order.totalCost"); got != c.tot {
				t.Errorf("totalCost = %v, want %v (tax %v)", got, c.tot, c.tax)
			}
		})
	}

	t.Run("local delivery order (shipping 0)", func(t *testing.T) {
		o := ordOrder(t, e, u, a, time.Now(), ordLine{p1, 1, 1000})
		e.DB.Model(o).Update("shipping_cost", 0)
		r := ordDo(e, `query($id: String!) { order(id: $id) { totalCost } }`, map[string]any{"id": o.ID}, u)
		r.NoErrors(t)
		if r.Num(t, "order.totalCost") != 1087 {
			t.Errorf("got %s", r.Raw)
		}
	})
}

func TestOrdAllOrders(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	u := e.NewUser("u@x.com", false)
	a := ordAddress(t, e, u)
	base := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	var ids []string // ids[0] is oldest
	for i := 0; i < 5; i++ {
		o := ordOrder(t, e, u, a, base.Add(time.Duration(i)*time.Hour))
		ids = append(ids, o.ID)
	}
	// ids[4] shipped, ids[3] shipped+complete, ids[2] complete only.
	now := time.Now()
	e.DB.Exec("UPDATE orders SET shipped_on = ? WHERE id IN (?, ?)", now, ids[4], ids[3])
	e.DB.Exec("UPDATE orders SET completed_on = ? WHERE id IN (?, ?)", now, ids[3], ids[2])

	list := func(args string) *Resp {
		r := ordDo(e, `{ allOrders`+args+` { hasMore nextPage edges { id } } }`, nil, admin)
		r.NoErrors(t)
		return r
	}
	edgeIDs := func(r *Resp) []string {
		var out []string
		for i := 0; i < r.Len(t, "allOrders.edges"); i++ {
			out = append(out, r.Str(t, fmt.Sprintf("allOrders.edges.%d.id", i)))
		}
		return out
	}
	eq := func(got, want []string) bool {
		if len(got) != len(want) {
			return false
		}
		for i := range got {
			if got[i] != want[i] {
				return false
			}
		}
		return true
	}

	t.Run("defaults: newest first, all rows, no next page", func(t *testing.T) {
		r := list("")
		if got := edgeIDs(r); !eq(got, []string{ids[4], ids[3], ids[2], ids[1], ids[0]}) {
			t.Errorf("order wrong: %v", got)
		}
		if r.Bool(t, "allOrders.hasMore") || r.Get("allOrders.nextPage") != nil {
			t.Errorf("hasMore/nextPage wrong: %s", r.Raw)
		}
	})
	t.Run("pagination", func(t *testing.T) {
		r := list("(perPage: 2)")
		if got := edgeIDs(r); !eq(got, []string{ids[4], ids[3]}) || !r.Bool(t, "allOrders.hasMore") || r.Num(t, "allOrders.nextPage") != 1 {
			t.Errorf("page 0: %s", r.Raw)
		}
		r = list("(page: 1, perPage: 2)")
		if got := edgeIDs(r); !eq(got, []string{ids[2], ids[1]}) || !r.Bool(t, "allOrders.hasMore") || r.Num(t, "allOrders.nextPage") != 2 {
			t.Errorf("page 1: %s", r.Raw)
		}
		r = list("(page: 2, perPage: 2)")
		if got := edgeIDs(r); !eq(got, []string{ids[0]}) || r.Bool(t, "allOrders.hasMore") || r.Get("allOrders.nextPage") != nil {
			t.Errorf("last page: %s", r.Raw)
		}
		r = list("(page: 9, perPage: 2)")
		if got := edgeIDs(r); len(got) != 0 || r.Bool(t, "allOrders.hasMore") {
			t.Errorf("past the end: %s", r.Raw)
		}
		// exact multiple: no phantom next page
		r = list("(perPage: 5)")
		if r.Bool(t, "allOrders.hasMore") {
			t.Errorf("perPage == total must not have more: %s", r.Raw)
		}
	})
	t.Run("filters", func(t *testing.T) {
		for _, c := range []struct {
			args string
			want []string
		}{
			{"(isShipped: true)", []string{ids[4], ids[3]}},
			{"(isShipped: false)", []string{ids[2], ids[1], ids[0]}},
			{"(isComplete: true)", []string{ids[3], ids[2]}},
			{"(isComplete: false)", []string{ids[4], ids[1], ids[0]}},
			{"(isShipped: true, isComplete: true)", []string{ids[3]}},
			{"(isShipped: true, isComplete: false)", []string{ids[4]}},
			{"(isShipped: false, isComplete: true)", []string{ids[2]}},
			{"(isShipped: false, isComplete: false)", []string{ids[1], ids[0]}},
		} {
			if got := edgeIDs(list(c.args)); !eq(got, c.want) {
				t.Errorf("%s = %v, want %v", c.args, got, c.want)
			}
		}
	})
	t.Run("default perPage is 30", func(t *testing.T) {
		for i := 0; i < 27; i++ { // 32 total
			ordOrder(t, e, u, a, base.Add(time.Duration(100+i)*time.Hour))
		}
		r := list("")
		if r.Len(t, "allOrders.edges") != 30 || !r.Bool(t, "allOrders.hasMore") || r.Num(t, "allOrders.nextPage") != 1 {
			t.Errorf("default page size: len=%d %s", r.Len(t, "allOrders.edges"), r.Raw[:80])
		}
	})
	t.Run("admin sees other users' orders with nested user", func(t *testing.T) {
		r := ordDo(e, `{ allOrders(perPage: 1) { edges { user { email } address { city } } } }`, nil, admin)
		r.NoErrors(t)
		if r.Str(t, "allOrders.edges.0.user.email") != "u@x.com" || r.Str(t, "allOrders.edges.0.address.city") != "Dayton" {
			t.Errorf("%s", r.Raw)
		}
	})
}
