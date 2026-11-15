package graph_test

import (
	"testing"
	"time"

	"storeapi/internal/models"
)

const imgAttachQ = `mutation($pid: String!, $url: String!, $primary: Boolean!, $title: String, $desc: String) {
  attachImage(productId: $pid, url: $url, primary: $primary, title: $title, description: $desc) {
    id url primary title description createdAt updatedAt
  }
}`

func imgVars(pid, url string, primary bool, extra map[string]any) map[string]any {
	v := map[string]any{"pid": pid, "url": url, "primary": primary}
	for k, x := range extra {
		v[k] = x
	}
	return v
}

func imgRows(t *testing.T, e *Env, p *models.Product) []models.ProductImage {
	t.Helper()
	var rows []models.ProductImage
	if err := e.DB.Where("product_id = ?", p.ID).Order("url").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	return rows
}

// Every image resolver is admin-only, and the gate must run before any
// Cloudinary or DB work.
func TestImgAdminGates(t *testing.T) {
	e := newEnv(t)
	shopper := e.NewUser("s@x.com", false)
	p := prodActive(t, e, "P", time.Hour)
	img := prodImage(t, e, p, "u", true)

	ops := []struct {
		name string
		q    string
		vars map[string]any
	}{
		{"imageUrls", `{ imageUrls }`, nil},
		{"images", `{ images { url id } }`, nil},
		{"imageUploadSignature", `{ imageUploadSignature { timestamp signature cloudname apikey } }`, nil},
		{"deleteImage", `mutation { deleteImage(id: "store/x") }`, nil},
		{"attachImage", imgAttachQ, imgVars(p.ID, "new", true, nil)},
		{"detachImage", `mutation($id: String!) { detachImage(id: $id) }`, map[string]any{"id": img.ID}},
	}
	for _, op := range ops {
		t.Run(op.name+"/anonymous", func(t *testing.T) {
			prodDo(e, op.q, op.vars, nil).HasError(t, "Not authenticated")
		})
		t.Run(op.name+"/non-admin", func(t *testing.T) {
			prodDo(e, op.q, op.vars, shopper).HasError(t, "Not allowed")
		})
	}
	if rows := imgRows(t, e, p); len(rows) != 1 || rows[0].ID != img.ID {
		t.Fatalf("gated mutations changed images: %+v", rows)
	}
}

func TestImgAttachImage(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	p := prodActive(t, e, "P", time.Hour)
	q := prodActive(t, e, "Q", time.Hour)

	t.Run("creates primary image with title/description", func(t *testing.T) {
		r := prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/1.jpg", true, map[string]any{"title": "T1", "desc": "D1"}), admin)
		r.NoErrors(t)
		if r.Str(t, "attachImage.url") != "https://c/1.jpg" || !r.Bool(t, "attachImage.primary") ||
			r.Str(t, "attachImage.title") != "T1" || r.Str(t, "attachImage.description") != "D1" ||
			r.Str(t, "attachImage.id") == "" {
			t.Fatalf("got %s", r.Raw)
		}
		r.Str(t, "attachImage.createdAt")
		rows := imgRows(t, e, p)
		if len(rows) != 1 || !rows[0].Primary || rows[0].Title != "T1" {
			t.Fatalf("db: %+v", rows)
		}
	})

	t.Run("second primary demotes the first (same product only)", func(t *testing.T) {
		prodDo(e, imgAttachQ, imgVars(q.ID, "q1", true, nil), admin).NoErrors(t)
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/2.jpg", true, nil), admin).NoErrors(t)
		for _, row := range imgRows(t, e, p) {
			want := row.URL == "https://c/2.jpg"
			if row.Primary != want {
				t.Fatalf("%s primary=%v want %v", row.URL, row.Primary, want)
			}
		}
		qrows := imgRows(t, e, q)
		if len(qrows) != 1 || !qrows[0].Primary {
			t.Fatalf("other product's primary image was demoted: %+v", qrows)
		}
	})

	t.Run("non-primary add keeps existing primary", func(t *testing.T) {
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/3.jpg", false, nil), admin).NoErrors(t)
		primaries := 0
		for _, row := range imgRows(t, e, p) {
			if row.Primary {
				primaries++
				if row.URL != "https://c/2.jpg" {
					t.Fatalf("wrong primary %s", row.URL)
				}
			}
		}
		if primaries != 1 {
			t.Fatalf("primaries = %d", primaries)
		}
	})

	t.Run("re-attaching same url updates in place", func(t *testing.T) {
		before := len(imgRows(t, e, p))
		r := prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/3.jpg", true, map[string]any{"title": "Renamed"}), admin)
		r.NoErrors(t)
		rows := imgRows(t, e, p)
		if len(rows) != before {
			t.Fatalf("duplicate row created: %d -> %d", before, len(rows))
		}
		if r.Str(t, "attachImage.title") != "Renamed" || !r.Bool(t, "attachImage.primary") {
			t.Fatalf("got %s", r.Raw)
		}
		for _, row := range rows {
			if row.Primary != (row.URL == "https://c/3.jpg") {
				t.Fatalf("primary flags wrong: %+v", rows)
			}
		}
	})

	t.Run("omitted title/description leave existing values", func(t *testing.T) {
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/4.jpg", false, map[string]any{"title": "Keep", "desc": "KeepD"}), admin).NoErrors(t)
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/4.jpg", false, nil), admin).NoErrors(t)
		for _, row := range imgRows(t, e, p) {
			if row.URL == "https://c/4.jpg" && (row.Title != "Keep" || row.Description != "KeepD") {
				t.Fatalf("title/description clobbered: %+v", row)
			}
		}
	})

	t.Run("explicit null title clears it (Node: title !== undefined)", func(t *testing.T) {
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/5.jpg", false, map[string]any{"title": "Gone"}), admin).NoErrors(t)
		prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/5.jpg", false, map[string]any{"title": nil}), admin).NoErrors(t)
		for _, row := range imgRows(t, e, p) {
			if row.URL == "https://c/5.jpg" && row.Title != "" {
				parityBug(t, "attachImage(title: null) should overwrite title with null like Node (image.ts:112 `!== undefined`); Go treats null as omitted (image.resolvers.go:49-54)")
			}
		}
	})

	t.Run("title/description are null (not empty string) when never set", func(t *testing.T) {
		r := prodDo(e, imgAttachQ, imgVars(p.ID, "https://c/6.jpg", false, nil), admin)
		r.NoErrors(t)
		if r.Get("attachImage.title") != nil || r.Get("attachImage.description") != nil {
			parityBug(t, "ProductImage.title/description are null in Node when unset; Go returns empty string (models/product_image.go:19-20)")
		}
	})

	t.Run("unknown product id fails (FK) and persists nothing", func(t *testing.T) {
		r := prodDo(e, imgAttachQ, imgVars("no-such", "https://c/x.jpg", true, nil), admin)
		if len(r.Errors) == 0 {
			t.Fatal("expected error")
		}
		var n int64
		e.DB.Model(&models.ProductImage{}).Where("url = ?", "https://c/x.jpg").Count(&n)
		if n != 0 {
			t.Fatal("row persisted")
		}
	})
}

// ProductImage.ensurePrimary: with primary=false and no primary image
// anywhere, Node throws "One image must be primary.".
func TestImgEnsurePrimary(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	p := prodActive(t, e, "P", time.Hour)
	q := prodActive(t, e, "Q", time.Hour)

	r := prodDo(e, imgAttachQ, imgVars(p.ID, "first", false, nil), admin)
	r.HasError(t, "One image must be primary.")

	// Node runs the AfterSave hook outside of a transaction, so the row
	// created by the failing save() is already committed.
	if n := len(imgRows(t, e, p)); n != 1 {
		parityBug(t, "failed attachImage(primary:false) leaves the committed row behind in Node (no transaction around save+AfterSave); Go's GORM Save rolls it back (image.resolvers.go:56-60, models/product_image.go:26)")
	}

	t.Run("check counts primaries across ALL products (ported quirk)", func(t *testing.T) {
		prodDo(e, imgAttachQ, imgVars(q.ID, "q-primary", true, nil), admin).NoErrors(t)
		// p has no primary of its own, but q does, so Node's unscoped count
		// lets a non-primary image through for p.
		prodDo(e, imgAttachQ, imgVars(p.ID, "p-nonprimary", false, nil), admin).NoErrors(t)
	})
}

func TestImgDetachImage(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	p := prodActive(t, e, "P", time.Hour)
	a := prodImage(t, e, p, "a", true)
	b := prodImage(t, e, p, "b", false)
	const q = `mutation($id: String!) { detachImage(id: $id) }`

	r := prodDo(e, q, map[string]any{"id": a.ID}, admin)
	r.NoErrors(t)
	if !r.Bool(t, "detachImage") {
		t.Fatal("expected true")
	}
	rows := imgRows(t, e, p)
	if len(rows) != 1 || rows[0].ID != b.ID {
		t.Fatalf("rows: %+v", rows)
	}
	// Detaching the primary does not promote another (Node has no such hook).
	if rows[0].Primary {
		t.Fatal("remaining image was auto-promoted")
	}
	r = prodDo(e, q, map[string]any{"id": a.ID}, admin)
	r.NoErrors(t)
	if r.Bool(t, "detachImage") {
		t.Fatal("expected false for already-detached id")
	}
	r = prodDo(e, q, map[string]any{"id": "nope"}, admin)
	r.NoErrors(t)
	if r.Bool(t, "detachImage") {
		t.Fatal("expected false for unknown id")
	}
	// Product itself is untouched.
	var n int64
	e.DB.Model(&models.Product{}).Where("id = ?", p.ID).Count(&n)
	if n != 1 {
		t.Fatal("product deleted")
	}
}

// The remaining image resolvers talk to Cloudinary with env credentials the
// harness blanked. They must fail with an error (not panic or return data).
func TestImgCloudinaryWithoutCredentials(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	for name, q := range map[string]string{
		"imageUrls":            `{ imageUrls }`,
		"images":               `{ images { url id } }`,
		"deleteImage":          `mutation { deleteImage(id: "store/x") }`,
		"imageUploadSignature": `{ imageUploadSignature { timestamp signature cloudname apikey } }`,
	} {
		t.Run(name, func(t *testing.T) {
			r := prodDo(e, q, nil, admin)
			if r.Status >= 500 {
				t.Fatalf("server error status %d: %s", r.Status, r.Raw)
			}
			// Outcomes vary by call (blank creds may error, or yield an
			// empty listing); the contract here is only "no panic / 5xx".
			// deleteImage must never report success without Cloudinary.
			if name == "deleteImage" && len(r.Errors) == 0 {
				t.Fatalf("deleteImage succeeded without credentials: %s", r.Raw)
			}
		})
	}
}
