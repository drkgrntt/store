package graph_test

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"storeapi/internal/models"
)

func catProduct(t *testing.T, e *Env, title string, active bool) *models.Product {
	t.Helper()
	p := &models.Product{Title: title, Description: "d", Price: 100, Quantity: 1, IsActive: active}
	if err := e.DB.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	e.DB.Model(p).Update("is_active", active)
	return p
}

func catCategory(t *testing.T, e *Env, name string) *models.Category {
	t.Helper()
	c := &models.Category{Name: name}
	if err := e.DB.Create(c).Error; err != nil {
		t.Fatal(err)
	}
	return c
}

func catLink(t *testing.T, e *Env, p *models.Product, c *models.Category) {
	t.Helper()
	if err := e.DB.Create(&models.ProductCategory{ProductID: p.ID, CategoryID: c.ID}).Error; err != nil {
		t.Fatal(err)
	}
}

func catCount(t *testing.T, e *Env, model any, where string, args ...any) int64 {
	t.Helper()
	var n int64
	if err := e.DB.Model(model).Where(where, args...).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func catNames(r *Resp, path string) []string {
	arr, _ := r.Get(path).([]any)
	out := []string{}
	for _, a := range arr {
		out = append(out, a.(map[string]any)["name"].(string))
	}
	return out
}

func TestCategoryAdminGates(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	user := e.NewUser("u@x.com", false)
	p := catProduct(t, e, "p", true)
	c := catCategory(t, e, "C")

	ops := map[string]string{
		"createCategory":  `mutation { createCategory(name:"X") { id } }`,
		"attachCategory":  fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", productId:"%s") }`, c.ID, p.ID),
		"detachCategory":  fmt.Sprintf(`mutation { detachCategory(categoryId:"%s", productId:"%s") }`, c.ID, p.ID),
		"clearFeatures":   `mutation { clearFeatures }`,
		"featureProducts": `mutation { featureProducts(tag:"C") }`,
	}
	for name, q := range ops {
		t.Run(name, func(t *testing.T) {
			catDo(e, q, nil, nil).HasError(t, "Not authenticated")
			catDo(e, q, nil, user).HasError(t, "Not allowed")
		})
	}
	if n := catCount(t, e, &models.ProductCategory{}, "1=1"); n != 0 {
		t.Fatalf("gated mutations wrote rows: %d", n)
	}
	catDo(e, ops["createCategory"], nil, admin).NoErrors(t)
}

func TestCategoryCreate(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)

	r := catDo(e, `mutation { createCategory(name:"Denim") { id name createdAt updatedAt } }`, nil, admin)
	r.NoErrors(t)
	if r.Str(t, "createCategory.name") != "Denim" || r.Str(t, "createCategory.id") == "" {
		t.Fatalf("bad: %s", r.Raw)
	}
	r.Str(t, "createCategory.createdAt")
	r.Str(t, "createCategory.updatedAt")

	// Deliberate divergence (see Go comment): duplicate names are not forked.
	r2 := catDo(e, `mutation { createCategory(name:"  denim ") { id name } }`, nil, admin)
	r2.NoErrors(t)
	if r2.Str(t, "createCategory.id") != r.Str(t, "createCategory.id") {
		t.Fatalf("expected existing category returned: %s", r2.Raw)
	}
	if n := catCount(t, e, &models.Category{}, "1=1"); n != 1 {
		t.Fatalf("want 1 category, got %d", n)
	}
	catDo(e, `mutation { createCategory { id } }`, nil, admin).HasError(t, "name")
}

func TestCategoryQuery(t *testing.T) {
	e := newEnv(t)
	active := catProduct(t, e, "active", true)
	inactive := catProduct(t, e, "inactive", false)
	zebra := catCategory(t, e, "Zebra")
	apple := catCategory(t, e, "apple")
	banana := catCategory(t, e, "Banana")
	catCategory(t, e, "Empty")
	catLink(t, e, active, zebra)
	catLink(t, e, active, apple)
	catLink(t, e, inactive, banana) // only inactive products

	var dbOrder []string
	e.DB.Model(&models.Category{}).Order("name ASC").Pluck("name", &dbOrder)

	tests := []struct {
		name   string
		q      string
		want   []string
		sorted bool // compare as sets
	}{
		{"all ordered by name ASC", `{ categories { name } }`, dbOrder, false},
		{"search ilike", `{ categories(search:"AN") { name } }`, []string{"Banana"}, false},
		{"search empty string = no filter", `{ categories(search:"") { name } }`, dbOrder, false},
		{"search no match", `{ categories(search:"zzz") { name } }`, []string{}, false},
		{"list true only with active products", `{ categories(list:true) { name } }`, []string{"Zebra", "apple"}, true},
		{"list false = all", `{ categories(list:false) { name } }`, dbOrder, false},
		{"list + search", `{ categories(list:true, search:"z") { name } }`, []string{"Zebra"}, false},
		{"list + search excluding inactive-only", `{ categories(list:true, search:"banana") { name } }`, []string{}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := catDo(e, tc.q, nil, nil) // public
			r.NoErrors(t)
			got := catNames(r, "categories")
			if tc.sorted {
				sort.Strings(got)
				sort.Strings(tc.want)
			}
			if strings.Join(got, ",") != strings.Join(tc.want, ",") {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}

	// A category with several active products appears once.
	p2 := catProduct(t, e, "p2", true)
	catLink(t, e, p2, zebra)
	r := catDo(e, `{ categories(list:true) { name } }`, nil, nil)
	r.NoErrors(t)
	if got := catNames(r, "categories"); len(got) != 2 {
		t.Fatalf("duplicates in list: %v", got)
	}
}

func TestCategoryProductsField(t *testing.T) {
	e := newEnv(t)
	a := catProduct(t, e, "a", true)
	b := catProduct(t, e, "b", false)
	c := catCategory(t, e, "C")
	catCategory(t, e, "D")
	catLink(t, e, a, c)
	catLink(t, e, b, c)

	r := catDo(e, `{ categories(search:"C") { name products { id title isActive } } }`, nil, nil)
	r.NoErrors(t)
	// Node's field resolver returns ALL linked products (active or not).
	if n := r.Len(t, "categories.0.products"); n != 2 {
		t.Fatalf("want 2 products, got %d: %s", n, r.Raw)
	}
	r = catDo(e, `{ categories(search:"D") { products { id } } }`, nil, nil)
	r.NoErrors(t)
	if r.Len(t, "categories.0.products") != 0 {
		t.Fatalf("expected empty list: %s", r.Raw)
	}
}

func TestCategoryAttachDetachProduct(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	p := catProduct(t, e, "p", true)
	c := catCategory(t, e, "C")

	att := fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", productId:"%s") }`, c.ID, p.ID)
	r := catDo(e, att, nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "attachCategory") {
		t.Fatal("want true")
	}
	if n := catCount(t, e, &models.ProductCategory{}, "product_id=? AND category_id=?", p.ID, c.ID); n != 1 {
		t.Fatalf("link rows %d", n)
	}
	// Node join model is unique:false -> attaching twice is allowed.
	catDo(e, att, nil, admin).NoErrors(t)
	if n := catCount(t, e, &models.ProductCategory{}, "product_id=?", p.ID); n != 2 {
		t.Fatalf("expected duplicate link allowed, got %d", n)
	}

	r = catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"%s") }`, c.ID), nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "attachCategory") {
		t.Fatal("want false")
	}

	// Nonexistent product / category -> FK error.
	if len(catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", productId:"nope") }`, c.ID), nil, admin).Errors) == 0 {
		t.Fatal("expected FK error for unknown product")
	}
	if len(catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"nope", productId:"%s") }`, p.ID), nil, admin).Errors) == 0 {
		t.Fatal("expected FK error for unknown category")
	}

	det := fmt.Sprintf(`mutation { detachCategory(categoryId:"%s", productId:"%s") }`, c.ID, p.ID)
	r = catDo(e, det, nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "detachCategory") {
		t.Fatal("want true")
	}
	if n := catCount(t, e, &models.ProductCategory{}, "1=1"); n != 0 {
		t.Fatalf("rows left %d", n)
	}
	r = catDo(e, det, nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "detachCategory") {
		t.Fatal("want false when nothing detached")
	}
	r = catDo(e, fmt.Sprintf(`mutation { detachCategory(categoryId:"%s") }`, c.ID), nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "detachCategory") {
		t.Fatal("want false")
	}
}

func TestCategoryDetachOnlyMatchingPair(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	p1 := catProduct(t, e, "p1", true)
	p2 := catProduct(t, e, "p2", true)
	c1 := catCategory(t, e, "C1")
	c2 := catCategory(t, e, "C2")
	catLink(t, e, p1, c1)
	catLink(t, e, p2, c1)
	catLink(t, e, p1, c2)
	catDo(e, fmt.Sprintf(`mutation { detachCategory(categoryId:"%s", productId:"%s") }`, c1.ID, p1.ID), nil, admin).NoErrors(t)
	if n := catCount(t, e, &models.ProductCategory{}, "1=1"); n != 2 {
		t.Fatalf("want 2 remaining, got %d", n)
	}
}

func TestCategoryAttachDetachContent(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	c := catCategory(t, e, "C")
	ct := &models.Content{Detail: "d"}
	e.DB.Create(ct)

	r := catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", contentId:"%s") }`, c.ID, ct.ID), nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "attachCategory") {
		t.Fatal("want true")
	}
	if n := catCount(t, e, &models.ContentCategory{}, "content_id=? AND category_id=?", ct.ID, c.ID); n != 1 {
		t.Fatalf("rows %d", n)
	}
	// productId takes precedence when both are provided.
	p := catProduct(t, e, "p", true)
	catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", productId:"%s", contentId:"%s") }`, c.ID, p.ID, ct.ID), nil, admin).NoErrors(t)
	if catCount(t, e, &models.ProductCategory{}, "1=1") != 1 || catCount(t, e, &models.ContentCategory{}, "1=1") != 1 {
		t.Fatal("productId should win and only create product link")
	}
	if len(catDo(e, fmt.Sprintf(`mutation { attachCategory(categoryId:"%s", contentId:"nope") }`, c.ID), nil, admin).Errors) == 0 {
		t.Fatal("expected FK error")
	}

	// Node quirk preserved: detach by contentId filters contentId = categoryId,
	// so passing the real content id deletes nothing.
	r = catDo(e, fmt.Sprintf(`mutation { detachCategory(categoryId:"%s", contentId:"%s") }`, c.ID, ct.ID), nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "detachCategory") {
		t.Fatal("Node quirk: expected false")
	}
	if catCount(t, e, &models.ContentCategory{}, "1=1") != 1 {
		t.Fatal("row should remain")
	}
	// ...and passing the content id AS categoryId deletes that content's links.
	r = catDo(e, fmt.Sprintf(`mutation { detachCategory(categoryId:"%s", contentId:"whatever") }`, ct.ID), nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "detachCategory") {
		t.Fatal("Node quirk: expected true")
	}
	if catCount(t, e, &models.ContentCategory{}, "1=1") != 0 {
		t.Fatal("row should be gone")
	}
}

func TestCategoryClearFeatures(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	feature := catCategory(t, e, "Feature")
	other := catCategory(t, e, "Other")
	halloween := catCategory(t, e, "Halloween")
	p1 := catProduct(t, e, "p1", true)
	p2 := catProduct(t, e, "p2", true)
	catLink(t, e, p1, feature)
	catLink(t, e, p2, feature)
	catLink(t, e, p1, other)
	catLink(t, e, p1, halloween)

	// Tag-scoped (deliberate extension): only p1 de-featured.
	r := catDo(e, `mutation { clearFeatures(tag:"halloween") }`, nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "clearFeatures") {
		t.Fatal("want true")
	}
	if catCount(t, e, &models.ProductCategory{}, "category_id=?", feature.ID) != 1 {
		t.Fatal("only p1 should lose Feature")
	}
	catDo(e, `mutation { clearFeatures(tag:"nope") }`, nil, admin).HasError(t, "not found")

	// No tag: Node behavior - remove all Feature links, leave others alone.
	r = catDo(e, `mutation { clearFeatures }`, nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "clearFeatures") {
		t.Fatal("want true")
	}
	if catCount(t, e, &models.ProductCategory{}, "category_id=?", feature.ID) != 0 {
		t.Fatal("features remain")
	}
	if catCount(t, e, &models.ProductCategory{}, "category_id IN ?", []string{other.ID, halloween.ID}) != 2 {
		t.Fatal("non-feature links must stay")
	}
	r = catDo(e, `mutation { clearFeatures }`, nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "clearFeatures") {
		t.Fatal("want false")
	}
}

func TestCategoryFeatureProducts(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	tag := catCategory(t, e, "Fall")
	p1 := catProduct(t, e, "p1", true)
	p2 := catProduct(t, e, "p2", true)
	p3 := catProduct(t, e, "p3", true)
	catLink(t, e, p1, tag)
	catLink(t, e, p2, tag)
	catLink(t, e, p3, catCategory(t, e, "Unrelated"))

	r := catDo(e, `mutation { featureProducts(tag:"fall") }`, nil, admin)
	r.NoErrors(t)
	if r.Num(t, "featureProducts") != 2 {
		t.Fatalf("want 2: %s", r.Raw)
	}
	if catCount(t, e, &models.Category{}, "name=?", "Feature") != 1 {
		t.Fatal("Feature category not created")
	}
	r = catDo(e, `mutation { featureProducts(tag:"Fall") }`, nil, admin)
	r.NoErrors(t)
	if r.Num(t, "featureProducts") != 0 {
		t.Fatalf("want 0: %s", r.Raw)
	}
	if catCount(t, e, &models.Category{}, "name=?", "Feature") != 1 {
		t.Fatal("Feature category duplicated")
	}
	catDo(e, `mutation { featureProducts(tag:"missing") }`, nil, admin).HasError(t, "not found")
}
