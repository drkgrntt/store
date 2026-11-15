package graph

import (
	"os"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"storeapi/internal/models"
)

func TestOrdOrderProductsSubTotal(t *testing.T) {
	cases := []struct {
		name string
		ops  []models.OrderProduct
		want int
	}{
		{"empty", nil, 0},
		{"single", []models.OrderProduct{{Price: 1000, Count: 2}}, 2000},
		{"many", []models.OrderProduct{{Price: 1999, Count: 3}, {Price: 250, Count: 2}, {Price: 0, Count: 9}}, 6497},
	}
	for _, c := range cases {
		if got := orderProductsSubTotal(c.ops); got != c.want {
			t.Errorf("%s: got %d want %d", c.name, got, c.want)
		}
	}
}

// buildOrderEmailProductList: primary image wins, else the first image
// (images[0]), price formatted as "$x.xx", quantity as a string.
func TestOrdBuildOrderEmailProductList(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models.GetModels()...); err != nil {
		t.Fatal(err)
	}
	mk := func(title string) *models.Product {
		p := &models.Product{Title: title, Description: "d", Price: 1, Quantity: 1}
		if err := db.Create(p).Error; err != nil {
			t.Fatal(err)
		}
		return p
	}
	img := func(p *models.Product, url string, primary bool, at time.Time) {
		i := &models.ProductImage{ProductID: p.ID, URL: url, Primary: primary}
		i.EnsureID()
		i.CreatedAt = at
		// Hooks (one-primary rule) are not under test here.
		if err := db.Session(&gorm.Session{SkipHooks: true}).Omit("Product").Create(i).Error; err != nil {
			t.Fatal(err)
		}
	}
	t0 := time.Now().Add(-time.Hour)
	withPrimary, noPrimary := mk("WithPrimary"), mk("NoPrimary")
	img(withPrimary, "https://x/first.png", false, t0)
	img(withPrimary, "https://x/primary.png", true, t0.Add(time.Minute))
	img(noPrimary, "https://x/a.png", false, t0)
	img(noPrimary, "https://x/b.png", false, t0.Add(time.Minute))
	// ProductImage hooks force one primary; strip it to exercise the images[0] fallback.
	if err := db.Exec("UPDATE product_images SET \"primary\" = false WHERE product_id = ?", noPrimary.ID).Error; err != nil {
		t.Fatal(err)
	}

	r := &Resolver{DB: db}
	list, err := r.buildOrderEmailProductList([]models.OrderProduct{
		{ProductID: withPrimary.ID, Price: 1999, Count: 3},
		{ProductID: noPrimary.ID, Price: 5, Count: 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []map[string]string{
		{"imageUrl": "https://x/primary.png", "id": withPrimary.ID, "title": "WithPrimary", "cost": "$19.99", "quantity": "3"},
		{"imageUrl": "https://x/a.png", "id": noPrimary.ID, "title": "NoPrimary", "cost": "$0.05", "quantity": "1"},
	}
	for i := range want {
		for k, v := range want[i] {
			if list[i][k] != v {
				t.Errorf("row %d %s = %q, want %q", i, k, list[i][k], v)
			}
		}
	}
}
