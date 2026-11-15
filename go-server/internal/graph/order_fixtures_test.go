package graph_test

import (
	"fmt"
	"testing"
	"time"

	"gorm.io/gorm"

	"storeapi/internal/models"
)

// ordProduct inserts a product directly.
func ordProduct(t *testing.T, e *Env, title string, price, qty int, active, madeToOrder bool) *models.Product {
	t.Helper()
	p := &models.Product{Title: title, Description: "d", Price: price, Quantity: qty, IsActive: active, IsMadeToOrder: madeToOrder}
	if err := e.DB.Create(p).Error; err != nil {
		t.Fatalf("creating product: %v", err)
	}
	if err := e.DB.Model(p).Updates(map[string]any{"is_active": active, "is_made_to_order": madeToOrder}).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func ordAddress(t *testing.T, e *Env, u *models.User) *models.Address {
	t.Helper()
	a := &models.Address{Recipient: "Jane Doe", LineOne: "1 Main St", City: "Dayton", State: "OH", ZipCode: "45402", Country: "United States", Type: models.AddressTypeShipping, UserID: u.ID}
	if err := e.DB.Create(a).Error; err != nil {
		t.Fatalf("creating address: %v", err)
	}
	return a
}

func ordCart(t *testing.T, e *Env, u *models.User, p *models.Product, count int) {
	t.Helper()
	if err := e.DB.Create(&models.UserProduct{UserID: u.ID, ProductID: p.ID, Count: count}).Error; err != nil {
		t.Fatalf("creating cart line: %v", err)
	}
}

type ordLine struct {
	P     *models.Product
	Count int
	Price int
}

var ordSeq int

// ordOrder inserts an order (bypassing Stripe) with line items directly in
// the DB, skipping OrderProduct's stock hooks.
func ordOrder(t *testing.T, e *Env, u *models.User, a *models.Address, created time.Time, lines ...ordLine) *models.Order {
	t.Helper()
	ordSeq++
	o := &models.Order{
		UserID: u.ID, AddressID: a.ID,
		PaymentIntentID: fmt.Sprintf("pi_test_%d_%d", time.Now().UnixNano(), ordSeq),
		TaxRate:         models.CurrentTaxRate, ShippingCost: models.CurrentShippingCost,
	}
	o.CreatedAt = created
	if err := e.DB.Create(o).Error; err != nil {
		t.Fatalf("creating order: %v", err)
	}
	for _, l := range lines {
		op := &models.OrderProduct{OrderID: o.ID, ProductID: l.P.ID, Count: l.Count, Price: l.Price}
		op.EnsureID()
		if err := e.DB.Session(&gorm.Session{SkipHooks: true}).Create(op).Error; err != nil {
			t.Fatalf("creating order line: %v", err)
		}
	}
	return o
}

func ordProductQty(t *testing.T, e *Env, id string) int {
	t.Helper()
	var p models.Product
	if err := e.DB.Where("id = ?", id).First(&p).Error; err != nil {
		t.Fatal(err)
	}
	return p.Quantity
}

var ordTokens = map[string]string{}

// ordDo is e.Do but reuses one token per user: the harness mints a JWT whose
// value is identical for the same user within the same second, and tokens.value
// is unique, so repeated e.Do calls as one user inside a second collide.
func ordDo(e *Env, query string, vars map[string]any, as *models.User) *Resp {
	e.t.Helper()
	if as == nil {
		return e.DoWithToken(query, vars, "")
	}
	tok, ok := ordTokens[as.ID]
	if !ok {
		tok = e.TokenFor(as)
		ordTokens[as.ID] = tok
	}
	return e.DoWithToken(query, vars, tok)
}

func ordCount(t *testing.T, e *Env, model any) int64 {
	t.Helper()
	var n int64
	if err := e.DB.Model(model).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}
