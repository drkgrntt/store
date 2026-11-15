package graph_test

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"storeapi/internal/models"
)

const prodListQ = `query($page: Float, $perPage: Float, $active: Boolean, $search: String, $tagSearch: Boolean) {
  products(page: $page, perPage: $perPage, active: $active, search: $search, tagSearch: $tagSearch) {
    hasMore nextPage edges { id title }
  }
}`

func prodSorted(s []string) []string {
	c := append([]string(nil), s...)
	sort.Strings(c)
	return c
}

func TestProdProductsVisibility(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	shopper := e.NewUser("shopper@x.com", false)

	prodNew(t, e, prodSpec{Title: "inStock", Qty: 3})
	prodNew(t, e, prodSpec{Title: "madeToOrderZero", Qty: 0, MTO: true})
	prodNew(t, e, prodSpec{Title: "soldOut", Qty: 0})
	prodNew(t, e, prodSpec{Title: "inactiveStocked", Qty: 3, Inactive: true})

	tests := []struct {
		name string
		as   interface{}
		vars map[string]any
		want []string
	}{
		{"anonymous", nil, nil, []string{"inStock", "madeToOrderZero"}},
		{"non-admin", shopper, nil, []string{"inStock", "madeToOrderZero"}},
		{"non-admin cannot override active=false", shopper, map[string]any{"active": false}, []string{"inStock", "madeToOrderZero"}},
		{"admin no filter sees everything", admin, nil, []string{"inStock", "inactiveStocked", "madeToOrderZero", "soldOut"}},
		{"admin active=true", admin, map[string]any{"active": true}, []string{"inStock", "madeToOrderZero"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var u *models.User
			if tc.as != nil {
				u = tc.as.(*models.User)
			}
			r := prodDo(e, prodListQ, tc.vars, u)
			r.NoErrors(t)
			got := prodSorted(prodStrs(r, "products.edges", "title"))
			if !prodEq(got, tc.want) {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestProdProductsAdminActiveFalseKeepsStockFilter(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	prodNew(t, e, prodSpec{Title: "inactiveStocked", Qty: 3, Inactive: true})
	prodNew(t, e, prodSpec{Title: "inactiveSoldOut", Qty: 0, Inactive: true})
	prodNew(t, e, prodSpec{Title: "activeStocked", Qty: 3})

	r := prodDo(e, prodListQ, map[string]any{"active": false}, admin)
	r.NoErrors(t)
	got := prodSorted(prodStrs(r, "products.edges", "title"))
	// Node: where = {isActive:false, [Op.or]:[mto, qty>0]} -> only inactiveStocked.
	if !prodEq(got, []string{"inactiveStocked"}) {
		t.Fatalf("got %v", got)
	}
}

func TestProdProductsPagination(t *testing.T) {
	e := newEnv(t)
	// Newest first: p0 newest ... p4 oldest.
	for i := 0; i < 5; i++ {
		prodActive(t, e, fmt.Sprintf("p%d", i), time.Duration(i+1)*time.Hour)
	}

	tests := []struct {
		name     string
		vars     map[string]any
		want     []string
		hasMore  bool
		nextPage any
	}{
		{"first page", map[string]any{"page": 0, "perPage": 2}, []string{"p0", "p1"}, true, float64(1)},
		{"second page", map[string]any{"page": 1, "perPage": 2}, []string{"p2", "p3"}, true, float64(2)},
		{"last page", map[string]any{"page": 2, "perPage": 2}, []string{"p4"}, false, nil},
		{"exactly full last page has no more", map[string]any{"page": 0, "perPage": 5}, []string{"p0", "p1", "p2", "p3", "p4"}, false, nil},
		{"past the end", map[string]any{"page": 9, "perPage": 2}, []string{}, false, nil},
		{"defaults (perPage 20)", nil, []string{"p0", "p1", "p2", "p3", "p4"}, false, nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := prodDo(e, prodListQ, tc.vars, nil)
			r.NoErrors(t)
			if got := prodStrs(r, "products.edges", "title"); !prodEq(got, tc.want) {
				t.Fatalf("edges got %v want %v", got, tc.want)
			}
			if got := r.Bool(t, "products.hasMore"); got != tc.hasMore {
				t.Fatalf("hasMore got %v want %v", got, tc.hasMore)
			}
			if got := r.Get("products.nextPage"); got != tc.nextPage {
				t.Fatalf("nextPage got %v want %v", got, tc.nextPage)
			}
		})
	}
}

func TestProdProductsOrdering(t *testing.T) {
	e := newEnv(t)
	oldPlain := prodActive(t, e, "oldPlain", 10*time.Hour)
	newPlain := prodActive(t, e, "newPlain", 1*time.Hour)
	viewedOnce := prodActive(t, e, "viewedOnce", 9*time.Hour)
	viewedTwice := prodActive(t, e, "viewedTwice", 8*time.Hour)
	featured := prodActive(t, e, "featured", 11*time.Hour)
	featuredViewed := prodActive(t, e, "featuredViewed", 12*time.Hour)
	_ = oldPlain
	_ = newPlain
	prodTag(t, e, featured, "Feature")
	prodTag(t, e, featuredViewed, "Feature")

	view := func(p *models.Product, modal string, n int) {
		for i := 0; i < n; i++ {
			if err := e.DB.Create(&models.Analytic{Modal: modal, ModalID: p.ID}).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	view(viewedOnce, "detail", 1)
	view(viewedTwice, "detail", 2)
	view(featuredViewed, "detail", 3)
	// Non-"detail" modals must not count.
	view(newPlain, "cart", 50)

	r := prodDo(e, prodListQ, nil, nil)
	r.NoErrors(t)
	want := []string{"featuredViewed", "featured", "viewedTwice", "viewedOnce", "newPlain", "oldPlain"}
	if got := prodStrs(r, "products.edges", "title"); !prodEq(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestProdProductsSearch(t *testing.T) {
	e := newEnv(t)
	denim := prodNew(t, e, prodSpec{Title: "Blue Jacket", Desc: "warm", Qty: 1})
	prodTag(t, e, denim, "Denim")
	shirt := prodNew(t, e, prodSpec{Title: "Plain Shirt", Desc: "Made of DENIM cotton", Qty: 1})
	_ = shirt
	cat := prodNew(t, e, prodSpec{Title: "Cat Toy", Desc: "fun", Qty: 1})
	prodTag(t, e, cat, "Pet Toys")
	prodNew(t, e, prodSpec{Title: "Unrelated", Desc: "nothing", Qty: 1})
	hidden := prodNew(t, e, prodSpec{Title: "Hidden Denim", Qty: 1, Inactive: true})
	prodTag(t, e, hidden, "Denim")

	tests := []struct {
		name string
		vars map[string]any
		want []string
	}{
		{"title ilike", map[string]any{"search": "jack"}, []string{"Blue Jacket"}},
		{"description ilike case-insensitive", map[string]any{"search": "denim"}, []string{"Blue Jacket", "Plain Shirt"}},
		{"words are ORed across title/desc/category", map[string]any{"search": "jacket cat"}, []string{"Blue Jacket", "Cat Toy"}},
		{"category name match (non-tag)", map[string]any{"search": "pet"}, []string{"Cat Toy"}},
		{"tagSearch matches category names only", map[string]any{"search": "denim", "tagSearch": true}, []string{"Blue Jacket"}},
		{"tagSearch uses whole string as one term", map[string]any{"search": "Pet Toys", "tagSearch": true}, []string{"Cat Toy"}},
		{"tagSearch does not split words", map[string]any{"search": "Denim Pet", "tagSearch": true}, []string{}},
		{"no match", map[string]any{"search": "zzz"}, []string{}},
		{"empty search is ignored", map[string]any{"search": ""}, []string{"Blue Jacket", "Cat Toy", "Plain Shirt", "Unrelated"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := prodDo(e, prodListQ, tc.vars, nil)
			r.NoErrors(t)
			if got := prodSorted(prodStrs(r, "products.edges", "title")); !prodEq(got, tc.want) {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}

	t.Run("admin search includes inactive", func(t *testing.T) {
		admin := e.NewUser("admin@x.com", true)
		r := prodDo(e, prodListQ, map[string]any{"search": "denim", "tagSearch": true}, admin)
		r.NoErrors(t)
		got := prodSorted(prodStrs(r, "products.edges", "title"))
		if !prodEq(got, []string{"Blue Jacket", "Hidden Denim"}) {
			t.Fatalf("got %v", got)
		}
	})
}

func TestProdProductQuery(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	shopper := e.NewUser("shopper@x.com", false)
	live := prodNew(t, e, prodSpec{Title: "Live", Desc: "d", Price: 1250, Qty: 4, MTO: true})
	// Single-product lookup does NOT apply the stock filter (only isActive).
	soldOut := prodNew(t, e, prodSpec{Title: "SoldOut", Qty: 0})
	off := prodNew(t, e, prodSpec{Title: "Off", Qty: 2, Inactive: true})

	const q = `query($id: String!, $active: Boolean) {
	  product(id: $id, active: $active) { id title description price quantity isMadeToOrder isActive createdAt updatedAt }
	}`

	t.Run("fields", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": live.ID}, nil)
		r.NoErrors(t)
		if r.Str(t, "product.id") != live.ID || r.Str(t, "product.title") != "Live" ||
			r.Str(t, "product.description") != "d" || r.Num(t, "product.price") != 1250 ||
			r.Num(t, "product.quantity") != 4 || !r.Bool(t, "product.isMadeToOrder") || !r.Bool(t, "product.isActive") {
			t.Fatalf("unexpected: %s", r.Raw)
		}
		r.Str(t, "product.createdAt")
		r.Str(t, "product.updatedAt")
	})
	t.Run("sold out active product still visible", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": soldOut.ID}, nil)
		r.NoErrors(t)
	})

	errCases := []struct {
		name string
		id   string
		vars map[string]any
		as   *models.User
	}{
		{"unknown id", "does-not-exist", nil, nil},
		{"anonymous inactive", off.ID, nil, nil},
		{"non-admin inactive", off.ID, nil, shopper},
		{"non-admin cannot override active", off.ID, map[string]any{"active": false}, shopper},
		{"admin active=true on inactive", off.ID, map[string]any{"active": true}, admin},
		{"admin active=false on active", live.ID, map[string]any{"active": false}, admin},
	}
	for _, tc := range errCases {
		t.Run(tc.name, func(t *testing.T) {
			v := map[string]any{"id": tc.id}
			for k, x := range tc.vars {
				v[k] = x
			}
			prodDo(e, q, v, tc.as).HasError(t, "Invalid id")
		})
	}

	okCases := []struct {
		name string
		id   string
		vars map[string]any
	}{
		{"admin sees inactive with no active arg", off.ID, nil},
		{"admin active=false on inactive", off.ID, map[string]any{"active": false}},
		{"admin active=true on active", live.ID, map[string]any{"active": true}},
	}
	for _, tc := range okCases {
		t.Run(tc.name, func(t *testing.T) {
			v := map[string]any{"id": tc.id}
			for k, x := range tc.vars {
				v[k] = x
			}
			r := prodDo(e, q, v, admin)
			r.NoErrors(t)
			if r.Str(t, "product.id") != tc.id {
				t.Fatalf("got %s", r.Raw)
			}
		})
	}
}

const prodCreateQ = `mutation($title: String!, $description: String!, $price: Float!, $quantity: Float!, $mto: Boolean!, $active: Boolean!) {
  createProduct(title: $title, description: $description, price: $price, quantity: $quantity, isMadeToOrder: $mto, isActive: $active) {
    id title description price quantity isMadeToOrder isActive
  }
}`

func prodCreateVars(price, qty float64) map[string]any {
	return map[string]any{"title": "Mug", "description": "A mug", "price": price, "quantity": qty, "mto": true, "active": false}
}

func TestProdCreateProduct(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	shopper := e.NewUser("shopper@x.com", false)

	t.Run("anonymous", func(t *testing.T) {
		prodDo(e, prodCreateQ, prodCreateVars(100, 1), nil).HasError(t, "Not authenticated")
	})
	t.Run("non-admin", func(t *testing.T) {
		prodDo(e, prodCreateQ, prodCreateVars(100, 1), shopper).HasError(t, "Not allowed")
	})
	var n int64
	e.DB.Model(&models.Product{}).Count(&n)
	if n != 0 {
		t.Fatalf("rejected requests created %d products", n)
	}

	t.Run("success persists all fields", func(t *testing.T) {
		r := prodDo(e, prodCreateQ, prodCreateVars(1999, 7), admin)
		r.NoErrors(t)
		id := r.Str(t, "createProduct.id")
		if id == "" || r.Str(t, "createProduct.title") != "Mug" || r.Num(t, "createProduct.price") != 1999 ||
			r.Num(t, "createProduct.quantity") != 7 || !r.Bool(t, "createProduct.isMadeToOrder") ||
			r.Bool(t, "createProduct.isActive") {
			t.Fatalf("unexpected: %s", r.Raw)
		}
		var p models.Product
		if err := e.DB.First(&p, "id = ?", id).Error; err != nil {
			t.Fatal(err)
		}
		if p.Price != 1999 || p.Quantity != 7 || p.Description != "A mug" || !p.IsMadeToOrder || p.IsActive {
			t.Fatalf("db row: %+v", p)
		}
	})

	t.Run("zero price and quantity allowed", func(t *testing.T) {
		prodDo(e, prodCreateQ, prodCreateVars(0, 0), admin).NoErrors(t)
	})

	for _, tc := range []struct {
		name       string
		price, qty float64
		msg        string
	}{
		{"negative price", -5, 1, `"-5" must be positive.`},
		{"negative quantity", 5, -3, `"-3" must be positive.`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var before int64
			e.DB.Model(&models.Product{}).Count(&before)
			r := prodDo(e, prodCreateQ, prodCreateVars(tc.price, tc.qty), admin)
			r.HasError(t, tc.msg)
			var after int64
			e.DB.Model(&models.Product{}).Count(&after)
			if after != before {
				t.Fatalf("invalid product was persisted")
			}
			// Sequelize wraps custom-validator failures as
			// "Validation error: <msg>".
			ok := false
			for _, m := range r.Errors {
				if m == "Validation error: "+tc.msg {
					ok = true
				}
			}
			if !ok {
				parityBug(t, "Sequelize ValidationError message is prefixed `Validation error: ` (Product.ts:41-44,52-55); Go returns bare message (models/product.go:36-43)")
			}
		})
	}

	t.Run("missing required arg", func(t *testing.T) {
		r := prodDo(e, `mutation { createProduct(title: "x") { id } }`, nil, admin)
		if len(r.Errors) == 0 {
			t.Fatal("expected validation error")
		}
	})
}

func TestProdUpdateProduct(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	shopper := e.NewUser("shopper@x.com", false)
	p := prodNew(t, e, prodSpec{Title: "Orig", Desc: "orig desc", Price: 500, Qty: 5})

	const q = `mutation($id: String!, $title: String, $description: String, $price: Float, $quantity: Float, $mto: Boolean, $active: Boolean) {
	  updateProduct(id: $id, title: $title, description: $description, price: $price, quantity: $quantity, isMadeToOrder: $mto, isActive: $active) {
	    id title description price quantity isMadeToOrder isActive
	  }
	}`
	reload := func() models.Product {
		var x models.Product
		if err := e.DB.First(&x, "id = ?", p.ID).Error; err != nil {
			t.Fatal(err)
		}
		return x
	}

	t.Run("anonymous", func(t *testing.T) {
		prodDo(e, q, map[string]any{"id": p.ID, "title": "X"}, nil).HasError(t, "Not authenticated")
	})
	t.Run("non-admin", func(t *testing.T) {
		prodDo(e, q, map[string]any{"id": p.ID, "title": "X"}, shopper).HasError(t, "Not allowed")
	})
	if reload().Title != "Orig" {
		t.Fatal("unauthorized update changed data")
	}
	t.Run("not found", func(t *testing.T) {
		prodDo(e, q, map[string]any{"id": "nope", "title": "X"}, admin).HasError(t, "Invalid id")
	})
	t.Run("only provided fields change", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": p.ID, "title": "New"}, admin)
		r.NoErrors(t)
		got := reload()
		if got.Title != "New" || got.Description != "orig desc" || got.Price != 500 || got.Quantity != 5 || !got.IsActive || got.IsMadeToOrder {
			t.Fatalf("row: %+v", got)
		}
		if r.Str(t, "updateProduct.title") != "New" || r.Num(t, "updateProduct.price") != 500 {
			t.Fatalf("resp: %s", r.Raw)
		}
	})
	t.Run("falsey values still apply (0, false)", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": p.ID, "price": 0, "quantity": 0, "active": false, "mto": true, "description": ""}, admin)
		r.NoErrors(t)
		got := reload()
		if got.Price != 0 || got.Quantity != 0 || got.IsActive || !got.IsMadeToOrder || got.Description != "" {
			t.Fatalf("row: %+v", got)
		}
	})
	t.Run("negative price rejected, row unchanged", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": p.ID, "price": -1, "title": "Bad"}, admin)
		r.HasError(t, `"-1" must be positive.`)
		if reload().Title == "Bad" {
			t.Fatal("invalid update persisted")
		}
	})
	t.Run("negative quantity rejected", func(t *testing.T) {
		prodDo(e, q, map[string]any{"id": p.ID, "quantity": -2}, admin).HasError(t, `"-2" must be positive.`)
	})
	t.Run("updatedAt advances", func(t *testing.T) {
		before := reload().UpdatedAt
		time.Sleep(5 * time.Millisecond)
		prodDo(e, q, map[string]any{"id": p.ID, "title": "Again"}, admin).NoErrors(t)
		if !reload().UpdatedAt.After(before) {
			t.Fatal("updatedAt not bumped")
		}
	})
}

func TestProdDeleteProduct(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)
	shopper := e.NewUser("shopper@x.com", false)
	const q = `mutation($id: String!) { deleteProduct(id: $id) }`

	p := prodActive(t, e, "Doomed", time.Hour)
	other := prodActive(t, e, "Survivor", time.Hour)
	prodTag(t, e, p, "Tag")
	prodTag(t, e, other, "Tag")
	prodImage(t, e, p, "u1", true)
	prodImage(t, e, other, "u2", true)
	e.DB.Create(&models.UserProduct{UserID: shopper.ID, ProductID: p.ID})

	prodDo(e, q, map[string]any{"id": p.ID}, nil).HasError(t, "Not authenticated")
	prodDo(e, q, map[string]any{"id": p.ID}, shopper).HasError(t, "Not allowed")
	var n int64
	e.DB.Model(&models.Product{}).Count(&n)
	if n != 2 {
		t.Fatalf("unauthorized delete removed rows: %d", n)
	}

	r := prodDo(e, q, map[string]any{"id": p.ID}, admin)
	r.NoErrors(t)
	if !r.Bool(t, "deleteProduct") {
		t.Fatal("expected true")
	}

	count := func(table, col, id string) int64 {
		var c int64
		e.DB.Table(table).Where(col+" = ?", id).Count(&c)
		return c
	}
	if count("products", "id", p.ID) != 0 || count("product_images", "product_id", p.ID) != 0 ||
		count("product_categories", "product_id", p.ID) != 0 || count("user_products", "product_id", p.ID) != 0 {
		t.Fatal("delete did not cascade to images/categories/cart rows")
	}
	if count("products", "id", other.ID) != 1 || count("product_images", "product_id", other.ID) != 1 ||
		count("product_categories", "product_id", other.ID) != 1 {
		t.Fatal("delete removed another product's rows")
	}
	var cat int64
	e.DB.Model(&models.Category{}).Count(&cat)
	if cat != 1 {
		t.Fatalf("category itself must survive, have %d", cat)
	}

	t.Run("missing id returns false, no error", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": p.ID}, admin)
		r.NoErrors(t)
		if r.Bool(t, "deleteProduct") {
			t.Fatal("expected false")
		}
	})
}

// Nested images/categories across several parents (batching through the
// dataloaders must keep each parent's children separate).
func TestProdNestedImagesAndCategories(t *testing.T) {
	e := newEnv(t)
	a := prodActive(t, e, "A", 3*time.Hour)
	b := prodActive(t, e, "B", 2*time.Hour)
	c := prodActive(t, e, "C", 1*time.Hour) // no children at all
	prodTag(t, e, a, "Red", "Blue", "Green")
	prodTag(t, e, b, "Blue")
	prodImage(t, e, a, "a1", true)
	prodImage(t, e, a, "a2", false)
	prodImage(t, e, b, "b1", true)
	_ = c

	r := prodDo(e, `{ products { edges { title
	  categories { id name }
	  images { id url primary title description createdAt updatedAt }
	} } }`, nil, nil)
	r.NoErrors(t)

	// Newest first: C, B, A.
	if got := prodStrs(r, "products.edges", "title"); !prodEq(got, []string{"C", "B", "A"}) {
		t.Fatalf("order %v", got)
	}
	if n := r.Len(t, "products.edges.0.categories"); n != 0 {
		t.Fatalf("C categories = %d", n)
	}
	if n := r.Len(t, "products.edges.0.images"); n != 0 {
		t.Fatalf("C images = %d", n)
	}
	if got := prodStrs(r, "products.edges.1.categories", "name"); !prodEq(got, []string{"Blue"}) {
		t.Fatalf("B categories %v", got)
	}
	if got := prodStrs(r, "products.edges.1.images", "url"); !prodEq(got, []string{"b1"}) {
		t.Fatalf("B images %v", got)
	}
	if got := prodSorted(prodStrs(r, "products.edges.2.categories", "name")); !prodEq(got, []string{"Blue", "Green", "Red"}) {
		t.Fatalf("A categories %v", got)
	}
	if got := prodSorted(prodStrs(r, "products.edges.2.images", "url")); !prodEq(got, []string{"a1", "a2"}) {
		t.Fatalf("A images %v", got)
	}
	// Image field shape: primary bool, title/description nullable, timestamps set.
	for i := 0; i < r.Len(t, "products.edges.2.images"); i++ {
		p := fmt.Sprintf("products.edges.2.images.%d.", i)
		r.Bool(t, p+"primary")
		r.Str(t, p+"id")
		r.Str(t, p+"createdAt")
	}
}

func TestProdNestedScalesToManyParents(t *testing.T) {
	e := newEnv(t)
	const n = 12
	want := map[string]int{}
	for i := 0; i < n; i++ {
		p := prodActive(t, e, fmt.Sprintf("P%02d", i), time.Duration(i+1)*time.Minute)
		for j := 0; j < i%4; j++ {
			prodImage(t, e, p, fmt.Sprintf("%s-img%d", p.Title, j), j == 0)
			prodTag(t, e, p, fmt.Sprintf("%s-cat%d", p.Title, j))
		}
		want[p.Title] = i % 4
	}
	r := prodDo(e, `{ products { edges { title images { url } categories { name } } } }`, nil, nil)
	r.NoErrors(t)
	if r.Len(t, "products.edges") != n {
		t.Fatalf("got %d", r.Len(t, "products.edges"))
	}
	for i := 0; i < n; i++ {
		title := r.Str(t, fmt.Sprintf("products.edges.%d.title", i))
		imgs := prodStrs(r, fmt.Sprintf("products.edges.%d.images", i), "url")
		cats := prodStrs(r, fmt.Sprintf("products.edges.%d.categories", i), "name")
		if len(imgs) != want[title] || len(cats) != want[title] {
			t.Fatalf("%s: images=%v cats=%v want %d", title, imgs, cats, want[title])
		}
		for _, u := range imgs {
			if len(u) < len(title) || u[:len(title)] != title {
				t.Fatalf("%s got foreign image %s", title, u)
			}
		}
		for _, c := range cats {
			if len(c) < len(title) || c[:len(title)] != title {
				t.Fatalf("%s got foreign category %s", title, c)
			}
		}
	}
}

func TestProdRelatedProducts(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("admin@x.com", true)

	base := prodActive(t, e, "Base", time.Hour)
	prodTag(t, e, base, "Mugs")
	var wantRelated []string
	for i := 0; i < 10; i++ {
		p := prodActive(t, e, fmt.Sprintf("Mug%d", i), time.Duration(i+2)*time.Hour)
		prodTag(t, e, p, "Mugs")
		wantRelated = append(wantRelated, p.Title)
	}
	off := prodNew(t, e, prodSpec{Title: "MugOff", Qty: 2, Inactive: true})
	prodTag(t, e, off, "Mugs")
	sold := prodNew(t, e, prodSpec{Title: "MugSoldOut", Qty: 0})
	prodTag(t, e, sold, "Mugs")
	other := prodActive(t, e, "Plate", time.Hour)
	prodTag(t, e, other, "Plates")

	const q = `query($id: String!) { product(id: $id) { relatedProducts { id title } } }`
	valid := map[string]bool{}
	for _, w := range wantRelated {
		valid[w] = true
	}

	seen := map[string]bool{}
	for i := 0; i < 15; i++ {
		r := prodDo(e, q, map[string]any{"id": base.ID}, nil)
		r.NoErrors(t)
		titles := prodStrs(r, "product.relatedProducts", "title")
		if len(titles) != 7 {
			t.Fatalf("expected 7 related, got %v", titles)
		}
		dup := map[string]bool{}
		for _, ti := range titles {
			if ti == "Base" {
				t.Fatal("product listed as related to itself")
			}
			if !valid[ti] {
				t.Fatalf("unexpected related product %q (inactive, sold out, or other category)", ti)
			}
			if dup[ti] {
				t.Fatalf("duplicate related %q", ti)
			}
			dup[ti] = true
			seen[ti] = true
		}
	}
	if len(seen) < 8 {
		t.Fatalf("related selection looks non-random/stuck: only saw %v", seen)
	}

	t.Run("fewer than 7 candidates", func(t *testing.T) {
		r := prodDo(e, q, map[string]any{"id": other.ID}, nil)
		r.NoErrors(t)
		// Only product tagged "Plates" is itself.
		if n := r.Len(t, "product.relatedProducts"); n != 0 {
			t.Fatalf("got %d", n)
		}
	})

	t.Run("multi-category product uses combined name as one tag term", func(t *testing.T) {
		// search = "Mugs Plates" with tagSearch -> ILIKE '%Mugs Plates%' matches
		// no category, so nothing is related (Node quirk, ported as-is).
		multi := prodActive(t, e, "Multi", time.Hour)
		prodTag(t, e, multi, "Mugs", "Plates")
		r := prodDo(e, q, map[string]any{"id": multi.ID}, nil)
		r.NoErrors(t)
		if n := r.Len(t, "product.relatedProducts"); n != 0 {
			t.Fatalf("got %d", n)
		}
	})

	t.Run("product without categories relates to arbitrary active products", func(t *testing.T) {
		// Empty search disables filtering in Node too.
		lone := prodActive(t, e, "Lone", time.Hour)
		r := prodDo(e, q, map[string]any{"id": lone.ID}, nil)
		r.NoErrors(t)
		if n := r.Len(t, "product.relatedProducts"); n != 7 {
			t.Fatalf("got %d", n)
		}
	})

	t.Run("works for several parents in one request", func(t *testing.T) {
		r := prodDo(e, `{ products(perPage: 50) { edges { title relatedProducts { title } } } }`, nil, admin)
		r.NoErrors(t)
	})
}
