package graph_test

import (
	"testing"
	"time"

	"storeapi/internal/models"
)

const (
	prodClearQ   = `mutation($tag: String) { clearFeatures(tag: $tag) }`
	prodFeatureQ = `mutation($tag: String!) { featureProducts(tag: $tag) }`
)

func TestProdFeatureAuth(t *testing.T) {
	e := newEnv(t)
	shopper := e.NewUser("s@x.com", false)
	p := prodActive(t, e, "P", time.Hour)
	prodTag(t, e, p, "Halloween", "Feature")

	for name, q := range map[string]string{"clearFeatures": prodClearQ, "featureProducts": prodFeatureQ} {
		vars := map[string]any{"tag": "Halloween"}
		prodDo(e, q, vars, nil).HasError(t, "Not authenticated")
		prodDo(e, q, vars, shopper).HasError(t, "Not allowed")
		if !prodHasTag(t, e, p, "Feature") {
			t.Fatalf("%s: unauthorized call modified features", name)
		}
	}
}

func TestProdClearFeatures(t *testing.T) {
	setup := func(t *testing.T) (*Env, map[string]*models.Product) {
		e := newEnv(t)
		ps := map[string]*models.Product{}
		// halloween+featured, christmas+featured, plain featured, halloween only, nothing.
		ps["hf"] = prodActive(t, e, "hf", 1*time.Hour)
		prodTag(t, e, ps["hf"], "Halloween", "Feature", "Extra")
		ps["cf"] = prodActive(t, e, "cf", 2*time.Hour)
		prodTag(t, e, ps["cf"], "Christmas", "Feature")
		ps["f"] = prodActive(t, e, "f", 3*time.Hour)
		prodTag(t, e, ps["f"], "Feature")
		ps["h"] = prodActive(t, e, "h", 4*time.Hour)
		prodTag(t, e, ps["h"], "Halloween")
		ps["none"] = prodActive(t, e, "none", 5*time.Hour)
		return e, ps
	}
	featured := func(t *testing.T, e *Env, ps map[string]*models.Product) map[string]bool {
		out := map[string]bool{}
		for k, p := range ps {
			out[k] = prodHasTag(t, e, p, "Feature")
		}
		return out
	}

	t.Run("no tag clears every feature", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		r := prodDo(e, `mutation { clearFeatures }`, nil, admin)
		r.NoErrors(t)
		if !r.Bool(t, "clearFeatures") {
			t.Fatal("expected true")
		}
		for k, v := range featured(t, e, ps) {
			if v {
				t.Fatalf("%s still featured", k)
			}
		}
		// Other tags survive; the Feature category itself survives.
		if !prodHasTag(t, e, ps["hf"], "Halloween") || !prodHasTag(t, e, ps["hf"], "Extra") || !prodHasTag(t, e, ps["cf"], "Christmas") {
			t.Fatal("non-Feature tags were removed")
		}
		var n int64
		e.DB.Model(&models.Category{}).Where("name = ?", "Feature").Count(&n)
		if n != 1 {
			t.Fatal("Feature category deleted")
		}
		// Nothing left to clear -> false.
		r = prodDo(e, `mutation { clearFeatures }`, nil, admin)
		r.NoErrors(t)
		if r.Bool(t, "clearFeatures") {
			t.Fatal("expected false when nothing to clear")
		}
	})

	t.Run("explicit null tag behaves like no tag", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		prodDo(e, prodClearQ, map[string]any{"tag": nil}, admin).NoErrors(t)
		for k, v := range featured(t, e, ps) {
			if v {
				t.Fatalf("%s still featured", k)
			}
		}
	})

	t.Run("blank tag behaves like no tag", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		prodDo(e, prodClearQ, map[string]any{"tag": "   "}, admin).NoErrors(t)
		for k, v := range featured(t, e, ps) {
			if v {
				t.Fatalf("%s still featured", k)
			}
		}
	})

	t.Run("tag scopes the sweep", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		r := prodDo(e, prodClearQ, map[string]any{"tag": "Halloween"}, admin)
		r.NoErrors(t)
		if !r.Bool(t, "clearFeatures") {
			t.Fatal("expected true")
		}
		got := featured(t, e, ps)
		want := map[string]bool{"hf": false, "cf": true, "f": true, "h": false, "none": false}
		for k, w := range want {
			if got[k] != w {
				t.Fatalf("featured state %v want %v", got, want)
			}
		}
		// The tag itself stays on the product.
		if !prodHasTag(t, e, ps["hf"], "Halloween") || !prodHasTag(t, e, ps["h"], "Halloween") {
			t.Fatal("tag category links removed")
		}
		// Repeat: nothing left under that tag -> false.
		r = prodDo(e, prodClearQ, map[string]any{"tag": "Halloween"}, admin)
		r.NoErrors(t)
		if r.Bool(t, "clearFeatures") {
			t.Fatal("expected false on repeat")
		}
	})

	t.Run("tag lookup is case/space-insensitive", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		prodDo(e, prodClearQ, map[string]any{"tag": "  hALLOWEEN "}, admin).NoErrors(t)
		if prodHasTag(t, e, ps["hf"], "Feature") || !prodHasTag(t, e, ps["cf"], "Feature") {
			t.Fatal("scoped clear with differently-cased tag misbehaved")
		}
	})

	t.Run("unknown tag errors and changes nothing", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		r := prodDo(e, prodClearQ, map[string]any{"tag": "Easter"}, admin)
		r.HasError(t, `tag "Easter" not found`)
		for k, v := range featured(t, e, ps) {
			want := k == "hf" || k == "cf" || k == "f"
			if v != want {
				t.Fatalf("%s featured=%v", k, v)
			}
		}
	})

	t.Run("tag with no featured products returns false", func(t *testing.T) {
		e, ps := setup(t)
		admin := e.NewUser("a@x.com", true)
		prodTag(t, e, ps["none"], "Spring")
		r := prodDo(e, prodClearQ, map[string]any{"tag": "Spring"}, admin)
		r.NoErrors(t)
		if r.Bool(t, "clearFeatures") {
			t.Fatal("expected false")
		}
	})

	t.Run("no Feature category at all returns false", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		r := prodDo(e, `mutation { clearFeatures }`, nil, admin)
		r.NoErrors(t)
		if r.Bool(t, "clearFeatures") {
			t.Fatal("expected false")
		}
	})

	t.Run("cleared products drop in the products() ordering", func(t *testing.T) {
		e, _ := setup(t)
		admin := e.NewUser("a@x.com", true)
		list := func() []string {
			r := prodDo(e, prodListQ, nil, nil)
			r.NoErrors(t)
			return prodStrs(r, "products.edges", "title")
		}
		if got := list()[:3]; !prodEq(prodSorted(got), []string{"cf", "f", "hf"}) {
			t.Fatalf("featured should lead: %v", list())
		}
		prodDo(e, `mutation { clearFeatures }`, nil, admin).NoErrors(t)
		if got := list(); !prodEq(got, []string{"hf", "cf", "f", "h", "none"}) {
			t.Fatalf("after clear should be newest-first: %v", got)
		}
	})
}

func TestProdFeatureProducts(t *testing.T) {
	t.Run("features every product carrying the tag and returns the count", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		var tagged []*models.Product
		for _, title := range []string{"h1", "h2", "h3"} {
			p := prodActive(t, e, title, time.Hour)
			prodTag(t, e, p, "Halloween")
			tagged = append(tagged, p)
		}
		untagged := prodActive(t, e, "x", time.Hour)
		prodTag(t, e, untagged, "Christmas")

		// No Feature category exists yet; it should be created.
		var n int64
		e.DB.Model(&models.Category{}).Where("name = ?", "Feature").Count(&n)
		if n != 0 {
			t.Fatal("precondition")
		}

		r := prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin)
		r.NoErrors(t)
		if r.Num(t, "featureProducts") != 3 {
			t.Fatalf("got %s", r.Raw)
		}
		for _, p := range tagged {
			if !prodHasTag(t, e, p, "Feature") || !prodHasTag(t, e, p, "Halloween") {
				t.Fatalf("%s missing Feature or lost its tag", p.Title)
			}
		}
		if prodHasTag(t, e, untagged, "Feature") {
			t.Fatal("untagged product featured")
		}
		e.DB.Model(&models.Category{}).Where("name = ?", "Feature").Count(&n)
		if n != 1 {
			t.Fatalf("Feature categories = %d", n)
		}

		// Idempotent: already-featured products are skipped, no duplicate links.
		r = prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin)
		r.NoErrors(t)
		if r.Num(t, "featureProducts") != 0 {
			t.Fatalf("second call got %s", r.Raw)
		}
		var links int64
		e.DB.Table("product_categories").
			Joins("JOIN categories ON categories.id = product_categories.category_id").
			Where("categories.name = ?", "Feature").Count(&links)
		if links != 3 {
			t.Fatalf("feature links = %d", links)
		}
	})

	t.Run("only newly featured products are counted", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		already := prodActive(t, e, "already", time.Hour)
		prodTag(t, e, already, "Halloween", "Feature")
		fresh := prodActive(t, e, "fresh", time.Hour)
		prodTag(t, e, fresh, "Halloween")
		r := prodDo(e, prodFeatureQ, map[string]any{"tag": "halloween"}, admin) // case-insensitive
		r.NoErrors(t)
		if r.Num(t, "featureProducts") != 1 || !prodHasTag(t, e, fresh, "Feature") {
			t.Fatalf("got %s", r.Raw)
		}
	})

	t.Run("reuses an existing Feature category", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		feat := prodCategory(t, e, "Feature")
		p := prodActive(t, e, "p", time.Hour)
		prodTag(t, e, p, "Halloween")
		prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin).NoErrors(t)
		var pc models.ProductCategory
		if err := e.DB.Where("product_id = ? AND category_id = ?", p.ID, feat.ID).First(&pc).Error; err != nil {
			t.Fatalf("link to pre-existing Feature category missing: %v", err)
		}
	})

	t.Run("featured products sort first and show Feature category", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		newest := prodActive(t, e, "newest", 1*time.Hour)
		old := prodActive(t, e, "oldSeasonal", 9*time.Hour)
		prodTag(t, e, old, "Halloween")
		prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin).NoErrors(t)
		_ = newest
		r := prodDo(e, `{ products { edges { title categories { name } } } }`, nil, nil)
		r.NoErrors(t)
		if r.Str(t, "products.edges.0.title") != "oldSeasonal" {
			t.Fatalf("got %s", r.Raw)
		}
		names := prodSorted(prodStrs(r, "products.edges.0.categories", "name"))
		if !prodEq(names, []string{"Feature", "Halloween"}) {
			t.Fatalf("categories %v", names)
		}
	})

	t.Run("features inactive tagged products too", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		p := prodNew(t, e, prodSpec{Title: "off", Inactive: true})
		prodTag(t, e, p, "Halloween")
		r := prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin)
		r.NoErrors(t)
		if r.Num(t, "featureProducts") != 1 {
			t.Fatalf("got %s", r.Raw)
		}
	})

	t.Run("unknown tag errors and creates nothing", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		r := prodDo(e, prodFeatureQ, map[string]any{"tag": "Nope"}, admin)
		r.HasError(t, `tag "Nope" not found`)
		var n int64
		e.DB.Model(&models.Category{}).Where("name = ?", "Feature").Count(&n)
		if n != 0 {
			t.Fatal("Feature category created despite error")
		}
	})

	t.Run("tag with no products returns 0", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		prodCategory(t, e, "Empty")
		r := prodDo(e, prodFeatureQ, map[string]any{"tag": "Empty"}, admin)
		r.NoErrors(t)
		if r.Num(t, "featureProducts") != 0 {
			t.Fatalf("got %s", r.Raw)
		}
	})

	t.Run("round trip with clearFeatures(tag)", func(t *testing.T) {
		e := newEnv(t)
		admin := e.NewUser("a@x.com", true)
		h := prodActive(t, e, "h", time.Hour)
		prodTag(t, e, h, "Halloween")
		x := prodActive(t, e, "x", time.Hour)
		prodTag(t, e, x, "Christmas")
		prodDo(e, prodFeatureQ, map[string]any{"tag": "Halloween"}, admin).NoErrors(t)
		prodDo(e, prodFeatureQ, map[string]any{"tag": "Christmas"}, admin).NoErrors(t)
		prodDo(e, prodClearQ, map[string]any{"tag": "Halloween"}, admin).NoErrors(t)
		if prodHasTag(t, e, h, "Feature") || !prodHasTag(t, e, x, "Feature") {
			t.Fatal("seasonal sweep leaked into another season")
		}
	})
}
