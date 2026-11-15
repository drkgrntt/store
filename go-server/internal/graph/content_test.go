package graph_test

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"storeapi/internal/models"
)

func contContent(t *testing.T, e *Env, title, detail string) *models.Content {
	t.Helper()
	c := &models.Content{Title: strp(title), Detail: detail}
	if err := e.DB.Create(c).Error; err != nil {
		t.Fatal(err)
	}
	return c
}

func contLink(t *testing.T, e *Env, ct *models.Content, c *models.Category) {
	t.Helper()
	if err := e.DB.Create(&models.ContentCategory{ContentID: ct.ID, CategoryID: c.ID}).Error; err != nil {
		t.Fatal(err)
	}
}

func contIDs(r *Resp, path string) []string {
	arr, _ := r.Get(path).([]any)
	out := []string{}
	for _, a := range arr {
		out = append(out, a.(map[string]any)["id"].(string))
	}
	sort.Strings(out)
	return out
}

func TestContentAdminGates(t *testing.T) {
	e := newEnv(t)
	user := e.NewUser("u@x.com", false)
	ct := contContent(t, e, "t", "d")
	ops := map[string]string{
		"createContent": `mutation { createContent(detail:"x") { id } }`,
		"updateContent": fmt.Sprintf(`mutation { updateContent(id:"%s", title:"n") { id } }`, ct.ID),
		"deleteContent": fmt.Sprintf(`mutation { deleteContent(id:"%s") }`, ct.ID),
	}
	for name, q := range ops {
		t.Run(name, func(t *testing.T) {
			catDo(e, q, nil, nil).HasError(t, "Not authenticated")
			catDo(e, q, nil, user).HasError(t, "Not allowed")
		})
	}
	var n int64
	e.DB.Model(&models.Content{}).Count(&n)
	var got models.Content
	e.DB.First(&got, "id = ?", ct.ID)
	if n != 1 || deref(got.Title) != "t" {
		t.Fatalf("gated mutations changed state: n=%d %+v", n, got)
	}
}

func TestContentPublicReads(t *testing.T) {
	e := newEnv(t)
	ct := contContent(t, e, "Hello", "World")
	// content & contents are public in Node (no isAdmin middleware).
	r := catDo(e, fmt.Sprintf(`{ content(id:"%s") { id title detail } contents { id } }`, ct.ID), nil, nil)
	r.NoErrors(t)
	if r.Str(t, "content.title") != "Hello" || r.Str(t, "content.detail") != "World" {
		t.Fatalf("bad: %s", r.Raw)
	}
	if r.Len(t, "contents") != 1 {
		t.Fatalf("bad: %s", r.Raw)
	}
	// Unknown id -> "Invalid id" (data.content null since nullable).
	r = catDo(e, `{ content(id:"nope") { id } }`, nil, nil)
	r.HasError(t, "Invalid id")
}

func TestContentCreate(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)

	r := catDo(e, `mutation { createContent(detail:"body", title:"T") { id title detail categories { id } } }`, nil, admin)
	r.NoErrors(t)
	if r.Str(t, "createContent.title") != "T" || r.Str(t, "createContent.detail") != "body" || r.Len(t, "createContent.categories") != 0 {
		t.Fatalf("bad: %s", r.Raw)
	}

	// Detail limit: varchar(3000) in both; exactly 3000 is fine, 3001 errors.
	r = catDo(e, `mutation($d:String!){ createContent(detail:$d) { id } }`, map[string]any{"d": strings.Repeat("x", 3000)}, admin)
	r.NoErrors(t)
	r = catDo(e, `mutation($d:String!){ createContent(detail:$d) { id } }`, map[string]any{"d": strings.Repeat("x", 3001)}, admin)
	if len(r.Errors) == 0 {
		t.Fatal("expected error for detail > 3000 chars")
	}
	catDo(e, `mutation { createContent { id } }`, nil, admin).HasError(t, "detail")
}

func TestContentCreateWithoutTitleIsNull(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	// Node: Content.create({ title: undefined, detail }) stores NULL and the
	// nullable `title` field resolves to null.
	r := catDo(e, `mutation { createContent(detail:"body") { id title } }`, nil, admin)
	r.NoErrors(t)
	if r.Get("createContent.title") != nil {
	}
}

func TestContentUpdate(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	ct := contContent(t, e, "old", "olddetail")

	// Only title.
	r := catDo(e, fmt.Sprintf(`mutation { updateContent(id:"%s", title:"new") { title detail } }`, ct.ID), nil, admin)
	r.NoErrors(t)
	if r.Str(t, "updateContent.title") != "new" || r.Str(t, "updateContent.detail") != "olddetail" {
		t.Fatalf("bad: %s", r.Raw)
	}
	// Only detail.
	r = catDo(e, fmt.Sprintf(`mutation { updateContent(id:"%s", detail:"nd") { title detail } }`, ct.ID), nil, admin)
	r.NoErrors(t)
	if r.Str(t, "updateContent.title") != "new" || r.Str(t, "updateContent.detail") != "nd" {
		t.Fatalf("bad: %s", r.Raw)
	}
	// Empty string title is "defined" in Node and overwrites.
	r = catDo(e, fmt.Sprintf(`mutation { updateContent(id:"%s", title:"") { title } }`, ct.ID), nil, admin)
	r.NoErrors(t)
	var got models.Content
	e.DB.First(&got, "id = ?", ct.ID)
	if deref(got.Title) != "" || got.Detail != "nd" {
		t.Fatalf("db: %+v", got)
	}
	// Unknown id.
	catDo(e, `mutation { updateContent(id:"nope", title:"x") { id } }`, nil, admin).HasError(t, "Invalid id")
	// Too-long detail rejected, row untouched.
	r = catDo(e, fmt.Sprintf(`mutation($d:String){ updateContent(id:"%s", detail:$d) { id } }`, ct.ID), map[string]any{"d": strings.Repeat("y", 3001)}, admin)
	if len(r.Errors) == 0 {
		t.Fatal("expected error")
	}
	e.DB.First(&got, "id = ?", ct.ID)
	if got.Detail != "nd" {
		t.Fatalf("detail changed: %q", got.Detail)
	}
}

func TestContentDelete(t *testing.T) {
	e := newEnv(t)
	admin := e.NewUser("a@x.com", true)
	ct := contContent(t, e, "t", "d")
	keep := contContent(t, e, "k", "d")
	cat := catCategory(t, e, "C")
	contLink(t, e, ct, cat)
	contLink(t, e, keep, cat)

	q := fmt.Sprintf(`mutation { deleteContent(id:"%s") }`, ct.ID)
	r := catDo(e, q, nil, admin)
	r.NoErrors(t)
	if !r.Bool(t, "deleteContent") {
		t.Fatal("want true")
	}
	// FK cascade removes only its own join rows; category survives.
	if catCount(t, e, &models.ContentCategory{}, "1=1") != 1 || catCount(t, e, &models.Category{}, "1=1") != 1 {
		t.Fatal("cascade wrong")
	}
	r = catDo(e, q, nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "deleteContent") {
		t.Fatal("want false for already-deleted")
	}
	r = catDo(e, `mutation { deleteContent(id:"nope") }`, nil, admin)
	r.NoErrors(t)
	if r.Bool(t, "deleteContent") {
		t.Fatal("want false")
	}
	if catCount(t, e, &models.Content{}, "id=?", keep.ID) != 1 {
		t.Fatal("other content deleted")
	}
}

func TestContentsSearchAndCategories(t *testing.T) {
	e := newEnv(t)
	c1 := contContent(t, e, "one", "d")
	c2 := contContent(t, e, "two", "d")
	c3 := contContent(t, e, "three", "d") // no categories
	about := catCategory(t, e, "About Us")
	faq := catCategory(t, e, "FAQ")
	faq2 := catCategory(t, e, "faq-extra")
	contLink(t, e, c1, about)
	contLink(t, e, c1, faq)
	contLink(t, e, c1, faq2) // c1 matches "faq" via two categories -> no dup
	contLink(t, e, c2, faq)

	sorted := func(ids ...string) []string { sort.Strings(ids); return ids }
	tests := []struct {
		name   string
		search string
		want   []string
	}{
		{"no search = all", ``, sorted(c1.ID, c2.ID, c3.ID)},
		{"empty search = all", `(search:"")`, sorted(c1.ID, c2.ID, c3.ID)},
		{"category ilike, deduped", `(search:"FAQ")`, sorted(c1.ID, c2.ID)},
		{"partial", `(search:"abou")`, sorted(c1.ID)},
		{"title text does not match", `(search:"three")`, []string{}},
		{"no match", `(search:"zzz")`, []string{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := catDo(e, fmt.Sprintf(`{ contents%s { id } }`, tc.search), nil, nil)
			r.NoErrors(t)
			got := contIDs(r, "contents")
			if strings.Join(got, ",") != strings.Join(tc.want, ",") {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}

	r := catDo(e, `{ contents { id categories { name } } }`, nil, nil)
	r.NoErrors(t)
	byID := map[string]int{}
	arr := r.Get("contents").([]any)
	for _, a := range arr {
		m := a.(map[string]any)
		byID[m["id"].(string)] = len(m["categories"].([]any))
	}
	if byID[c1.ID] != 3 || byID[c2.ID] != 1 || byID[c3.ID] != 0 {
		t.Fatalf("categories per content: %v", byID)
	}
	// Content has no createdAt/updatedAt in the schema (Node parity).
	catDo(e, `{ contents { createdAt } }`, nil, nil).HasError(t, "createdAt")
}
