package dataloaders

import (
	"context"
	"fmt"
	"os"
	"sort"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"storeapi/internal/models"
)

func dlSetup(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models.GetModels()...); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{
		"tokens", "user_products", "order_products", "orders",
		"product_images", "product_categories", "content_categories",
		"addresses", "analytics", "contents", "categories", "products", "users",
	} {
		if err := db.Exec("TRUNCATE TABLE " + table + " CASCADE").Error; err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		if s, err := db.DB(); err == nil {
			s.Close()
		}
	})
	return db
}

func dlProduct(t *testing.T, db *gorm.DB, title string) *models.Product {
	t.Helper()
	p := &models.Product{Title: title, Description: "d", Price: 1, Quantity: 1, IsActive: true}
	if err := db.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func dlCategory(t *testing.T, db *gorm.DB, name string) *models.Category {
	t.Helper()
	c := &models.Category{Name: name}
	if err := db.Create(c).Error; err != nil {
		t.Fatal(err)
	}
	return c
}

func dlEq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	a = append([]string(nil), a...)
	b = append([]string(nil), b...)
	sort.Strings(a)
	sort.Strings(b)
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// TestDLByIDLoaders: results come back in key order, a missing key yields nil
// (Node: `undefined`) without an error, duplicates resolve to the same row,
// and one bad key doesn't poison the rest.
func TestDLByIDLoaders(t *testing.T) {
	db := dlSetup(t)
	ctx := context.Background()
	p1, p2, p3 := dlProduct(t, db, "1"), dlProduct(t, db, "2"), dlProduct(t, db, "3")
	c1, c2 := dlCategory(t, db, "c1"), dlCategory(t, db, "c2")

	t.Run("product order, missing, duplicates", func(t *testing.T) {
		l := New(db)
		keys := []string{p3.ID, "missing", p1.ID, p3.ID, p2.ID}
		got, err := l.Product.LoadAll(ctx, keys)
		if err != nil {
			t.Fatal(err)
		}
		want := []*models.Product{p3, nil, p1, p3, p2}
		for i := range keys {
			if (got[i] == nil) != (want[i] == nil) || (got[i] != nil && got[i].ID != want[i].ID) {
				t.Fatalf("idx %d: got %+v want %+v", i, got[i], want[i])
			}
		}
	})
	t.Run("single missing is nil not error", func(t *testing.T) {
		l := New(db)
		got, err := l.Product.Load(ctx, "nope")
		if err != nil || got != nil {
			t.Fatalf("got %v err %v", got, err)
		}
	})
	t.Run("empty input", func(t *testing.T) {
		l := New(db)
		got, err := l.Product.LoadAll(ctx, nil)
		if err != nil || len(got) != 0 {
			t.Fatalf("got %v err %v", got, err)
		}
	})
	t.Run("category loader", func(t *testing.T) {
		l := New(db)
		got, err := l.Category.LoadAll(ctx, []string{c2.ID, "x", c1.ID})
		if err != nil {
			t.Fatal(err)
		}
		if got[0].ID != c2.ID || got[1] != nil || got[2].ID != c1.ID {
			t.Fatalf("bad order: %+v", got)
		}
	})
	t.Run("concurrent loads batch correctly", func(t *testing.T) {
		l := New(db)
		var wg sync.WaitGroup
		for _, p := range []*models.Product{p1, p2, p3} {
			wg.Add(1)
			go func() {
				defer wg.Done()
				got, err := l.Product.Load(ctx, p.ID)
				if err != nil || got == nil || got.ID != p.ID {
					t.Errorf("want %s got %+v err %v", p.ID, got, err)
				}
			}()
		}
		wg.Wait()
	})
}

// TestDLCategoryIDsByProduct matches createCategoryIdsByProductLoader: value
// is the join row's category_id; productless/unknown keys give [] not nil
// errors; keys keep their order.
func TestDLCategoryIDsByProduct(t *testing.T) {
	db := dlSetup(t)
	ctx := context.Background()
	p1, p2, p3 := dlProduct(t, db, "1"), dlProduct(t, db, "2"), dlProduct(t, db, "3")
	c1, c2, c3 := dlCategory(t, db, "c1"), dlCategory(t, db, "c2"), dlCategory(t, db, "c3")
	for _, pc := range []models.ProductCategory{
		{ProductID: p1.ID, CategoryID: c1.ID},
		{ProductID: p1.ID, CategoryID: c2.ID},
		{ProductID: p2.ID, CategoryID: c3.ID},
	} {
		pc := pc
		if err := db.Create(&pc).Error; err != nil {
			t.Fatal(err)
		}
	}

	l := New(db)
	keys := []string{p2.ID, p3.ID, "ghost", p1.ID, p2.ID}
	got, err := l.CategoryIDsByProduct.LoadAll(ctx, keys)
	if err != nil {
		t.Fatal(err)
	}
	want := [][]string{{c3.ID}, {}, {}, {c1.ID, c2.ID}, {c3.ID}}
	for i := range keys {
		if !dlEq(got[i], want[i]) {
			t.Fatalf("key %d (%s): got %v want %v", i, keys[i], got[i], want[i])
		}
	}
	// Empty input.
	if r, err := l.CategoryIDsByProduct.LoadAll(ctx, nil); err != nil || len(r) != 0 {
		t.Fatalf("empty: %v %v", r, err)
	}
}

// TestDLIDsByParentLoaders covers the id-returning loaders that collect the
// child's own id (Node: createImageIdsByProductLoader, etc.). Uses images and
// order products via raw rows to avoid unrelated model hooks.
func TestDLIDsByParentLoaders(t *testing.T) {
	db := dlSetup(t)
	ctx := context.Background()
	p1, p2 := dlProduct(t, db, "1"), dlProduct(t, db, "2")

	var img1, img2 []string
	for i := 0; i < 2; i++ {
		im := &models.ProductImage{ProductID: p1.ID, URL: fmt.Sprint("http://i/", i), Primary: i == 0}
		if err := db.Create(im).Error; err != nil {
			t.Fatal(err)
		}
		img1 = append(img1, im.ID)
	}
	_ = img2

	u := &models.User{Email: "dl@x.com"}
	_ = u.SetPassword("password123")
	if err := db.Create(u).Error; err != nil {
		t.Fatal(err)
	}
	u2 := &models.User{Email: "dl2@x.com"}
	_ = u2.SetPassword("password123")
	if err := db.Create(u2).Error; err != nil {
		t.Fatal(err)
	}
	var addrIDs []string
	for i := 0; i < 2; i++ {
		a := &models.Address{UserID: u.ID, Recipient: "r", LineOne: "1", City: "c", State: "s", ZipCode: "z"}
		if err := db.Create(a).Error; err != nil {
			t.Fatal(err)
		}
		addrIDs = append(addrIDs, a.ID)
	}

	l := New(db)

	gotImgs, err := l.ImageIDsByProduct.LoadAll(ctx, []string{p2.ID, p1.ID, "ghost"})
	if err != nil {
		t.Fatal(err)
	}
	if len(gotImgs[0]) != 0 || !dlEq(gotImgs[1], img1) || len(gotImgs[2]) != 0 {
		t.Fatalf("images: %v (want %v at idx1)", gotImgs, img1)
	}

	gotAddr, err := l.AddressIDsByUser.LoadAll(ctx, []string{u2.ID, u.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(gotAddr[0]) != 0 || !dlEq(gotAddr[1], addrIDs) {
		t.Fatalf("addresses: %v want %v", gotAddr, addrIDs)
	}

	// Parent loaders with no rows at all return empty slices for every key.
	for name, f := range map[string]func() ([][]string, error){
		"OrderIDsByUser":         func() ([][]string, error) { return l.OrderIDsByUser.LoadAll(ctx, []string{u.ID, "x"}) },
		"UserProductIDsByUser":   func() ([][]string, error) { return l.UserProductIDsByUser.LoadAll(ctx, []string{u.ID}) },
		"OrderProductIDsByOrder": func() ([][]string, error) { return l.OrderProductIDsByOrder.LoadAll(ctx, []string{"o"}) },
	} {
		r, err := f()
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for i, ids := range r {
			if len(ids) != 0 {
				t.Fatalf("%s[%d] = %v", name, i, ids)
			}
		}
	}

	// Entity loaders for images/addresses resolve the ids found above, in order.
	im, err := l.Image.LoadAll(ctx, []string{img1[1], "ghost", img1[0]})
	if err != nil || im[0].ID != img1[1] || im[1] != nil || im[2].ID != img1[0] {
		t.Fatalf("image loader: %+v %v", im, err)
	}
	ad, err := l.Address.LoadAll(ctx, []string{addrIDs[1], addrIDs[0]})
	if err != nil || ad[0].ID != addrIDs[1] || ad[1].ID != addrIDs[0] {
		t.Fatalf("address loader: %+v %v", ad, err)
	}
	if o, err := l.Order.Load(ctx, "ghost"); err != nil || o != nil {
		t.Fatalf("order: %v %v", o, err)
	}
	if o, err := l.OrderProduct.Load(ctx, "ghost"); err != nil || o != nil {
		t.Fatalf("orderproduct: %v %v", o, err)
	}
	if o, err := l.UserProduct.Load(ctx, "ghost"); err != nil || o != nil {
		t.Fatalf("userproduct: %v %v", o, err)
	}
}

// TestDLPerRequestIsolation: New builds independent Loaders, and a loader
// caches within its own lifetime only (so data changes are visible to a
// fresh Loaders but not to the old one — hence never share across requests).
func TestDLPerRequestIsolation(t *testing.T) {
	db := dlSetup(t)
	ctx := context.Background()
	p := dlProduct(t, db, "orig")

	a, b := New(db), New(db)
	if a == b || a.Product == b.Product {
		t.Fatal("New returned shared state")
	}
	got, _ := a.Product.Load(ctx, p.ID)
	if got.Title != "orig" {
		t.Fatal("bad load")
	}
	if err := db.Model(&models.Product{}).Where("id = ?", p.ID).Update("title", "changed").Error; err != nil {
		t.Fatal(err)
	}
	cached, _ := a.Product.Load(ctx, p.ID)
	if cached.Title != "orig" {
		t.Fatalf("expected per-instance cache hit, got %q", cached.Title)
	}
	fresh, _ := b.Product.Load(ctx, p.ID)
	if fresh.Title != "changed" {
		t.Fatalf("second request must not see first's cache, got %q", fresh.Title)
	}
}

// TestDLQueryErrorsPropagate: a DB failure surfaces as an error per key
// rather than a panic or silent empty result.
func TestDLQueryErrorsPropagate(t *testing.T) {
	db := dlSetup(t)
	ctx := context.Background()
	l := New(db)
	if s, err := db.DB(); err == nil {
		s.Close()
	}
	if _, err := l.Product.Load(ctx, "x"); err == nil {
		t.Fatal("expected error from closed DB")
	}
	if _, err := l.CategoryIDsByProduct.Load(ctx, "x"); err == nil {
		t.Fatal("expected error from closed DB")
	}
}
