package models

import "testing"

// TestProductImageEnsurePrimaryDemotesOthers matches ProductImage.ensurePrimary's
// first branch: saving an image as primary demotes every other image of
// the same product back to non-primary.
func TestProductImageEnsurePrimaryDemotesOthers(t *testing.T) {
	db := setupTestDB(t)
	product := createTestProduct(t, db, "Mug")

	first := &ProductImage{ProductID: product.ID, URL: "https://img/1.png", Primary: true}
	if err := db.Create(first).Error; err != nil {
		t.Fatalf("creating first image: %v", err)
	}

	second := &ProductImage{ProductID: product.ID, URL: "https://img/2.png", Primary: true}
	if err := db.Create(second).Error; err != nil {
		t.Fatalf("creating second image: %v", err)
	}

	var reloadedFirst ProductImage
	if err := db.Where("id = ?", first.ID).First(&reloadedFirst).Error; err != nil {
		t.Fatalf("reloading first image: %v", err)
	}
	if reloadedFirst.Primary {
		t.Error("first image should have been demoted once a second was saved as primary")
	}

	var primaryCount int64
	err := db.Model(&ProductImage{}).
		Where("product_id = ? AND \"primary\" = true", product.ID).
		Count(&primaryCount).Error
	if err != nil {
		t.Fatalf("counting primary images: %v", err)
	}
	if primaryCount != 1 {
		t.Errorf("primary image count for the product = %d, want exactly 1", primaryCount)
	}
}

// TestProductImageEnsurePrimaryRequiresOneWhenNoneExist matches the "must
// have at least one primary image" half of ensurePrimary: saving a
// non-primary image when there are no primary images anywhere fails.
func TestProductImageEnsurePrimaryRequiresOneWhenNoneExist(t *testing.T) {
	db := setupTestDB(t)
	product := createTestProduct(t, db, "Mug")

	img := &ProductImage{ProductID: product.ID, URL: "https://img/1.png", Primary: false}
	if err := db.Create(img).Error; err == nil {
		t.Error("expected an error saving a non-primary image with no primary images anywhere, got nil")
	}
}

// TestProductImageEnsurePrimaryGlobalCountIsProductAgnostic documents a bug
// in the Node model, replicated intentionally: the "at least one primary"
// check counts primary images across ALL products, not just this one (the
// query never filters by productId). So a second product's first image can
// be saved as non-primary — leaving that product with zero primary images
// of its own — as long as *some* product somewhere already has one.
func TestProductImageEnsurePrimaryGlobalCountIsProductAgnostic(t *testing.T) {
	db := setupTestDB(t)
	productA := createTestProduct(t, db, "Mug")
	productB := createTestProduct(t, db, "Plate")

	primaryForA := &ProductImage{ProductID: productA.ID, URL: "https://img/a1.png", Primary: true}
	if err := db.Create(primaryForA).Error; err != nil {
		t.Fatalf("creating product A's primary image: %v", err)
	}

	// Product B's first image, saved as non-primary — the Node model's
	// unscoped count sees product A's primary image and lets this through.
	nonPrimaryForB := &ProductImage{ProductID: productB.ID, URL: "https://img/b1.png", Primary: false}
	if err := db.Create(nonPrimaryForB).Error; err != nil {
		t.Fatalf("expected this to succeed (replicating the Node model's unscoped check), got error: %v", err)
	}

	var primaryCountForB int64
	err := db.Model(&ProductImage{}).
		Where("product_id = ? AND \"primary\" = true", productB.ID).
		Count(&primaryCountForB).Error
	if err != nil {
		t.Fatalf("counting product B's primary images: %v", err)
	}
	if primaryCountForB != 0 {
		t.Errorf("product B's primary image count = %d, want 0 (demonstrating the unscoped check let a product end up with none)", primaryCountForB)
	}
}
