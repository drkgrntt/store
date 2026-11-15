package graph_test

import (
	"testing"
	"time"

	"storeapi/internal/models"
)

const (
	cartAddQ    = `mutation($id: String!) { addToCart(productId: $id) { id count createdAt updatedAt product { id title price } } }`
	cartRemoveQ = `mutation($id: String!) { removeFromCart(productId: $id) { id count product { id title } } }`
)

func cartCount(t *testing.T, e *Env, u *models.User, p *models.Product) int {
	t.Helper()
	var up models.UserProduct
	if err := e.DB.Where("user_id = ? AND product_id = ?", u.ID, p.ID).First(&up).Error; err != nil {
		return 0
	}
	return up.Count
}

func TestCartAuthRequired(t *testing.T) {
	e := newEnv(t)
	p := prodActive(t, e, "P", time.Hour)
	for _, q := range []string{cartAddQ, cartRemoveQ} {
		prodDo(e, q, map[string]any{"id": p.ID}, nil).HasError(t, "Not authenticated")
	}
	var n int64
	e.DB.Model(&models.UserProduct{}).Count(&n)
	if n != 0 {
		t.Fatal("anonymous request created cart rows")
	}
}

func TestCartAddToCart(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	other := e.NewUser("o@x.com", false)
	p := prodNew(t, e, prodSpec{Title: "Stocked", Price: 300, Qty: 2})
	q := prodNew(t, e, prodSpec{Title: "Other", Price: 100, Qty: 9})

	r := prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
	r.NoErrors(t)
	if r.Len(t, "addToCart") != 1 || r.Num(t, "addToCart.0.count") != 1 ||
		r.Str(t, "addToCart.0.product.id") != p.ID || r.Str(t, "addToCart.0.product.title") != "Stocked" ||
		r.Num(t, "addToCart.0.product.price") != 300 {
		t.Fatalf("unexpected: %s", r.Raw)
	}
	r.Str(t, "addToCart.0.createdAt")

	// Second add increments count on the same row rather than creating a new one.
	r = prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
	r.NoErrors(t)
	if r.Len(t, "addToCart") != 1 || r.Num(t, "addToCart.0.count") != 2 {
		t.Fatalf("unexpected: %s", r.Raw)
	}

	// At the stock limit (count 2 >= quantity 2) for a non-made-to-order product.
	r = prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
	r.HasError(t, "You cannot add more than what is available unless it can be made to order.")
	if got := cartCount(t, e, u, p); got != 2 {
		t.Fatalf("count changed on rejected add: %d", got)
	}

	// A second product shows up in the returned cart alongside the first.
	r = prodDo(e, cartAddQ, map[string]any{"id": q.ID}, u)
	r.NoErrors(t)
	if r.Len(t, "addToCart") != 2 {
		t.Fatalf("unexpected: %s", r.Raw)
	}
	titles := prodSorted(prodStrs(r, "addToCart", "id"))
	if len(titles) != 2 {
		t.Fatal(titles)
	}

	// Carts are per-user.
	r = prodDo(e, cartAddQ, map[string]any{"id": p.ID}, other)
	r.NoErrors(t)
	if r.Len(t, "addToCart") != 1 || r.Num(t, "addToCart.0.count") != 1 {
		t.Fatalf("other user's cart leaked: %s", r.Raw)
	}
	if got := cartCount(t, e, u, p); got != 2 {
		t.Fatalf("first user's count changed: %d", got)
	}
}

func TestCartMadeToOrderAndEdgeProducts(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)

	t.Run("made to order exceeds stock", func(t *testing.T) {
		p := prodNew(t, e, prodSpec{Title: "MTO", Qty: 1, MTO: true})
		for want := 1; want <= 4; want++ {
			r := prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
			r.NoErrors(t)
		}
		if got := cartCount(t, e, u, p); got != 4 {
			t.Fatalf("count %d", got)
		}
	})
	t.Run("first add is never stock-checked (Node parity)", func(t *testing.T) {
		p := prodNew(t, e, prodSpec{Title: "SoldOut", Qty: 0})
		r := prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
		r.NoErrors(t)
		if cartCount(t, e, u, p) != 1 {
			t.Fatal("expected row")
		}
		// ...but the next add is, since quantity(0) <= count(1).
		prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u).HasError(t, "You cannot add more than what is available")
	})
	t.Run("inactive product can be added and its nested product resolves", func(t *testing.T) {
		p := prodNew(t, e, prodSpec{Title: "Inactive", Qty: 5, Inactive: true})
		r := prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u)
		r.NoErrors(t)
	})
	t.Run("unknown product id", func(t *testing.T) {
		var before int64
		e.DB.Model(&models.UserProduct{}).Count(&before)
		r := prodDo(e, cartAddQ, map[string]any{"id": "no-such-product"}, u)
		if len(r.Errors) == 0 {
			t.Fatal("expected an error (FK violation) for an unknown product")
		}
		var after int64
		e.DB.Model(&models.UserProduct{}).Count(&after)
		if after != before {
			t.Fatal("row created for unknown product")
		}
	})
}

func TestCartRemoveFromCart(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	other := e.NewUser("o@x.com", false)
	p := prodNew(t, e, prodSpec{Title: "P", Qty: 10})
	q := prodNew(t, e, prodSpec{Title: "Q", Qty: 10})
	for i := 0; i < 3; i++ {
		prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u).NoErrors(t)
	}
	prodDo(e, cartAddQ, map[string]any{"id": q.ID}, u).NoErrors(t)
	prodDo(e, cartAddQ, map[string]any{"id": p.ID}, other).NoErrors(t)

	r := prodDo(e, cartRemoveQ, map[string]any{"id": p.ID}, u)
	r.NoErrors(t)
	if cartCount(t, e, u, p) != 2 || r.Len(t, "removeFromCart") != 2 {
		t.Fatalf("decrement failed: %s", r.Raw)
	}
	prodDo(e, cartRemoveQ, map[string]any{"id": p.ID}, u).NoErrors(t)
	r = prodDo(e, cartRemoveQ, map[string]any{"id": p.ID}, u) // count 1 -> row deleted
	r.NoErrors(t)
	if cartCount(t, e, u, p) != 0 {
		t.Fatal("row should be deleted when count hits 0")
	}
	if r.Len(t, "removeFromCart") != 1 || r.Str(t, "removeFromCart.0.product.id") != q.ID {
		t.Fatalf("remaining cart wrong: %s", r.Raw)
	}
	var n int64
	e.DB.Model(&models.UserProduct{}).Where("user_id = ? AND product_id = ?", u.ID, p.ID).Count(&n)
	if n != 0 {
		t.Fatal("row still exists")
	}

	t.Run("removing something not in the cart is a no-op", func(t *testing.T) {
		r := prodDo(e, cartRemoveQ, map[string]any{"id": p.ID}, u)
		r.NoErrors(t)
		if r.Len(t, "removeFromCart") != 1 {
			t.Fatalf("got %s", r.Raw)
		}
	})
	t.Run("unknown product id is a no-op, not an error", func(t *testing.T) {
		r := prodDo(e, cartRemoveQ, map[string]any{"id": "nope"}, u)
		r.NoErrors(t)
	})
	t.Run("other user's cart untouched", func(t *testing.T) {
		if cartCount(t, e, other, p) != 1 {
			t.Fatal("other user's row changed")
		}
	})
	t.Run("empty cart returns empty list not null", func(t *testing.T) {
		r := prodDo(e, cartRemoveQ, map[string]any{"id": q.ID}, u)
		r.NoErrors(t)
		if r.Len(t, "removeFromCart") != 0 {
			t.Fatalf("got %s", r.Raw)
		}
	})
}

// me.cart goes through UserProductIDsByUser + UserProduct + Product dataloaders.
func TestCartNestedViaMe(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	p1 := prodNew(t, e, prodSpec{Title: "One", Qty: 5})
	p2 := prodNew(t, e, prodSpec{Title: "Two", Qty: 5})
	p3 := prodNew(t, e, prodSpec{Title: "Three", Qty: 5})
	prodTag(t, e, p1, "Cat1")
	prodImage(t, e, p2, "img2", true)
	prodDo(e, cartAddQ, map[string]any{"id": p1.ID}, u).NoErrors(t)
	prodDo(e, cartAddQ, map[string]any{"id": p2.ID}, u).NoErrors(t)
	prodDo(e, cartAddQ, map[string]any{"id": p2.ID}, u).NoErrors(t)
	prodDo(e, cartAddQ, map[string]any{"id": p3.ID}, u).NoErrors(t)

	r := prodDo(e, `{ me { cart { count product { title categories { name } images { url } } } } }`, nil, u)
	r.NoErrors(t)
	if r.Len(t, "me.cart") != 3 {
		t.Fatalf("got %s", r.Raw)
	}
	byTitle := map[string]int{}
	for i := 0; i < 3; i++ {
		base := "me.cart." + string(rune('0'+i))
		byTitle[r.Str(t, base+".product.title")] = int(r.Num(t, base+".count"))
	}
	if byTitle["One"] != 1 || byTitle["Two"] != 2 || byTitle["Three"] != 1 {
		t.Fatalf("counts by product: %v", byTitle)
	}
}

func TestCartDeletedProductDisappears(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	p := prodNew(t, e, prodSpec{Title: "P", Qty: 5})
	q := prodNew(t, e, prodSpec{Title: "Q", Qty: 5})
	prodDo(e, cartAddQ, map[string]any{"id": p.ID}, u).NoErrors(t)
	prodDo(e, cartAddQ, map[string]any{"id": q.ID}, u).NoErrors(t)
	e.DB.Delete(&models.Product{}, "id = ?", p.ID)

	r := prodDo(e, `{ me { cart { count product { title } } } }`, nil, u)
	r.NoErrors(t)
	if r.Len(t, "me.cart") != 1 || r.Str(t, "me.cart.0.product.title") != "Q" {
		t.Fatalf("got %s", r.Raw)
	}
}

// Direct check of the UserProduct model hook (Node: @Default(1) + @Is positive).
func TestCartModelCountValidation(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	p := prodNew(t, e, prodSpec{Qty: 5})

	up := &models.UserProduct{UserID: u.ID, ProductID: p.ID}
	if err := e.DB.Create(up).Error; err != nil || up.Count != 1 {
		t.Fatalf("default count: %v %d", err, up.Count)
	}
	neg := &models.UserProduct{UserID: u.ID, ProductID: p.ID, Count: -1}
	if err := e.DB.Create(neg).Error; err == nil || err.Error() != `"-1" must be greater than 0.` {
		t.Fatalf("expected positive-count error, got %v", err)
	}
}
