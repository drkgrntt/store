package models

import (
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupTestDB connects to a real Postgres database for hook-behavior tests
// that need actual multi-row side effects (AfterSave/BeforeCreate/AfterCreate
// touching other rows) — the kind of thing that's easy to get subtly wrong
// and that a mock can't catch. Point TEST_DATABASE_URL at a throwaway
// database; tests skip (not fail) if it's unset, since a Go module wouldn't
// normally ship with a live Postgres available in every environment.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed test")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("connecting to test database: %v", err)
	}

	if err := db.AutoMigrate(GetModels()...); err != nil {
		t.Fatalf("migrating test database: %v", err)
	}

	// Start every test from a clean slate rather than relying on cleanup
	// from whatever ran last (including a previous failed run).
	tables := []string{
		"tokens", "user_products", "order_products", "orders",
		"product_images", "product_categories", "content_categories",
		"addresses", "analytics", "contents", "categories", "products", "users",
	}
	for _, table := range tables {
		if err := db.Exec("TRUNCATE TABLE " + table + " CASCADE").Error; err != nil {
			t.Fatalf("truncating %s: %v", table, err)
		}
	}

	return db
}

func createTestUser(t *testing.T, db *gorm.DB, email string) *User {
	t.Helper()
	u := &User{Email: email}
	if err := u.SetPassword("password123"); err != nil {
		t.Fatalf("hashing password: %v", err)
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("creating user: %v", err)
	}
	return u
}

func createTestProduct(t *testing.T, db *gorm.DB, title string) *Product {
	t.Helper()
	p := &Product{
		Title:       title,
		Description: "test product",
		Price:       1000,
		Quantity:    10,
		IsActive:    true,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("creating product: %v", err)
	}
	return p
}
