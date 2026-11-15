package graph_test

import (
	"sync"
	"testing"
	"time"

	"gorm.io/gorm"

	"storeapi/internal/models"
)

// prodSpec describes a product fixture.
type prodSpec struct {
	Title    string
	Desc     string
	Price    int
	Qty      int
	MTO      bool
	Inactive bool
	Age      time.Duration // how long ago it was created (larger = older)
}

// prodNew inserts a product directly in the DB. It is active unless
// spec.Inactive.
func prodNew(t *testing.T, e *Env, s prodSpec) *models.Product {
	t.Helper()
	if s.Title == "" {
		s.Title = "Product"
	}
	p := &models.Product{
		Title: s.Title, Description: s.Desc, Price: s.Price, Quantity: s.Qty,
		IsMadeToOrder: s.MTO, IsActive: !s.Inactive,
	}
	if err := e.DB.Create(p).Error; err != nil {
		t.Fatalf("creating product: %v", err)
	}
	// Force a deterministic createdAt (list ordering is createdAt DESC).
	at := time.Now().UTC().Add(-s.Age)
	if err := e.DB.Model(p).UpdateColumn("created_at", at).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

// prodActive is the common case: an active, in-stock product.
func prodActive(t *testing.T, e *Env, title string, age time.Duration) *models.Product {
	t.Helper()
	return prodNew(t, e, prodSpec{Title: title, Qty: 5, Age: age})
}

// prodCategory finds-or-creates a category by exact name.
func prodCategory(t *testing.T, e *Env, name string) *models.Category {
	t.Helper()
	var c models.Category
	if err := e.DB.Where("name = ?", name).FirstOrCreate(&c, models.Category{Name: name}).Error; err != nil {
		t.Fatal(err)
	}
	return &c
}

// prodTag attaches categories (by name) to a product.
func prodTag(t *testing.T, e *Env, p *models.Product, names ...string) {
	t.Helper()
	for _, n := range names {
		c := prodCategory(t, e, n)
		if err := e.DB.Create(&models.ProductCategory{ProductID: p.ID, CategoryID: c.ID}).Error; err != nil {
			t.Fatal(err)
		}
	}
}

func prodHasTag(t *testing.T, e *Env, p *models.Product, name string) bool {
	t.Helper()
	var n int64
	e.DB.Table("product_categories").
		Joins("JOIN categories ON categories.id = product_categories.category_id").
		Where("product_categories.product_id = ? AND categories.name = ?", p.ID, name).
		Count(&n)
	return n > 0
}

// prodImage inserts a ProductImage row directly, bypassing hooks so tests
// can set up arbitrary primary flags.
func prodImage(t *testing.T, e *Env, p *models.Product, url string, primary bool) *models.ProductImage {
	t.Helper()
	img := &models.ProductImage{ProductID: p.ID, URL: url, Primary: primary}
	img.EnsureID()
	if err := e.DB.Session(&gorm.Session{SkipHooks: true}).Create(img).Error; err != nil {
		t.Fatal(err)
	}
	return img
}

var prodTokens sync.Map // user ID -> cached token

// prodDo is e.Do with a per-user cached token. Minting two tokens for the
// same user within the same second yields identical JWTs and violates the
// unique index on tokens.value, so repeated requests as one user must reuse
// a single token. Prefer it over e.Do in this domain's tests.
func prodDo(e *Env, query string, vars map[string]any, as *models.User) *Resp {
	e.t.Helper()
	tok := ""
	if as != nil {
		if v, ok := prodTokens.Load(as.ID); ok {
			tok = v.(string)
		} else {
			tok = e.TokenFor(as)
			prodTokens.Store(as.ID, tok)
		}
	}
	return e.DoWithToken(query, vars, tok)
}

// prodStrs extracts field `key` from every object in the list at path.
func prodStrs(r *Resp, path, key string) []string {
	arr, _ := r.Get(path).([]any)
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		m, _ := v.(map[string]any)
		s, _ := m[key].(string)
		out = append(out, s)
	}
	return out
}

func prodEq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
