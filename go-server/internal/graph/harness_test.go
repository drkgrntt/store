package graph_test

// Shared integration-test harness for the GraphQL layer. It wires the same
// middleware chain + gqlgen handler as internal/server/routes.go (minus CORS
// and the playground) onto an in-process Fiber app, backed by a REAL Postgres
// pointed at by TEST_DATABASE_URL. Tests skip (not fail) if it is unset.
//
// Usage:
//
//	e := newEnv(t)
//	admin := e.NewUser("a@x.com", true)
//	resp := e.Do(`{ me { id email } }`, nil, admin)
//	resp.NoErrors(t)
//	resp.Str(t, "me.email") // dotted path into data; ints index arrays
//
// Pass nil as the user for an anonymous request. Do NOT put domain fixtures
// in this file; put them in your own *_test.go file with a domain prefix.

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"storeapi/internal/graph"
	"storeapi/internal/middleware"
	"storeapi/internal/models"
)

type Env struct {
	t   *testing.T
	DB  *gorm.DB
	App *fiber.App

	tokens map[string]string // user ID -> token, minted once per user
}

func newEnv(t *testing.T) *Env {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping DB-backed test")
	}
	if os.Getenv("JWT_SECRET") == "" {
		t.Setenv("JWT_SECRET", "test-secret")
	}
	// Never let a test accidentally hit real third parties with prod creds
	// that happen to be in the developer's shell/.env.
	for _, k := range []string{"STRIPE_SECRET_KEY", "MAILGUN_SECRET_KEY", "CLOUDINARY_API_SECRET", "R2_SECRET_ACCESS_KEY"} {
		t.Setenv(k, "")
	}
	t.Setenv("NODE_ENV", "test")

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:  logger.Default.LogMode(logger.Silent),
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		t.Fatalf("connecting to test database: %v", err)
	}
	if err := db.AutoMigrate(models.GetModels()...); err != nil {
		t.Fatalf("migrating test database: %v", err)
	}
	for _, table := range []string{
		"tokens", "user_products", "order_products", "orders",
		"product_images", "product_categories", "content_categories",
		"addresses", "analytics", "contents", "categories", "products", "users",
	} {
		if err := db.Exec("TRUNCATE TABLE " + table + " CASCADE").Error; err != nil {
			t.Fatalf("truncating %s: %v", table, err)
		}
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})

	app := fiber.New()
	app.Use(middleware.DeserializeToken(db))
	app.Use(middleware.AttachDataLoaders(db))
	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &graph.Resolver{DB: db}}))
	srv.AddTransport(transport.POST{})
	app.Post("/graphql", adaptor.HTTPHandler(srv))

	return &Env{t: t, DB: db, App: app, tokens: map[string]string{}}
}

// NewUser inserts a user (password "password123") and returns it.
func (e *Env) NewUser(email string, admin bool) *models.User {
	e.t.Helper()
	u := &models.User{Email: email, IsAdmin: admin}
	if err := u.SetPassword("password123"); err != nil {
		e.t.Fatal(err)
	}
	if err := e.DB.Create(u).Error; err != nil {
		e.t.Fatalf("creating user: %v", err)
	}
	return u
}

// TokenFor mints a valid signed auth token (and persists it) for the user.
func (e *Env) TokenFor(u *models.User) string {
	e.t.Helper()
	// Cached: the JWT is deterministic within one second, so minting twice for
	// the same user would violate the unique constraint on tokens.value.
	if v, ok := e.tokens[u.ID]; ok {
		return v
	}
	tok, err := models.GenerateToken(e.DB, u.ID, 30)
	if err != nil {
		e.t.Fatalf("generating token: %v", err)
	}
	e.tokens[u.ID] = tok.Value
	return tok.Value
}

// Do POSTs a GraphQL operation. as==nil means anonymous.
func (e *Env) Do(query string, vars map[string]any, as *models.User) *Resp {
	e.t.Helper()
	cookie := ""
	if as != nil {
		cookie = e.TokenFor(as)
	}
	return e.DoWithToken(query, vars, cookie)
}

// DoWithToken is Do with an explicit raw token cookie value ("" = none).
func (e *Env) DoWithToken(query string, vars map[string]any, token string) *Resp {
	e.t.Helper()
	body, _ := json.Marshal(map[string]any{"query": query, "variables": vars})
	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "token", Value: token})
	}
	res, err := e.App.Test(req, -1)
	if err != nil {
		e.t.Fatalf("request failed: %v", err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)

	out := &Resp{Status: res.StatusCode, Cookies: res.Cookies(), Raw: string(raw)}
	var env struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		e.t.Fatalf("decoding response %q: %v", raw, err)
	}
	if len(env.Data) > 0 {
		_ = json.Unmarshal(env.Data, &out.Data)
	}
	for _, er := range env.Errors {
		out.Errors = append(out.Errors, er.Message)
	}
	return out
}

type Resp struct {
	Status  int
	Data    any // decoded "data" (map[string]any) or nil
	Errors  []string
	Cookies []*http.Cookie
	Raw     string
}

func (r *Resp) NoErrors(t *testing.T) {
	t.Helper()
	if len(r.Errors) > 0 {
		t.Fatalf("unexpected GraphQL errors: %v\nraw: %s", r.Errors, r.Raw)
	}
}

// HasError asserts some error message contains substr (exact Node messages
// matter: the client may display them).
func (r *Resp) HasError(t *testing.T, substr string) {
	t.Helper()
	for _, m := range r.Errors {
		if strings.Contains(m, substr) {
			return
		}
	}
	t.Fatalf("expected an error containing %q, got %v\nraw: %s", substr, r.Errors, r.Raw)
}

// Get walks a dotted path ("orders.0.user.email") through Data.
func (r *Resp) Get(path string) any {
	cur := r.Data
	for _, seg := range strings.Split(path, ".") {
		switch v := cur.(type) {
		case map[string]any:
			cur = v[seg]
		case []any:
			i, err := strconv.Atoi(seg)
			if err != nil || i < 0 || i >= len(v) {
				return nil
			}
			cur = v[i]
		default:
			return nil
		}
	}
	return cur
}

func (r *Resp) Str(t *testing.T, path string) string {
	t.Helper()
	s, ok := r.Get(path).(string)
	if !ok {
		t.Fatalf("path %q is not a string: %#v\nraw: %s", path, r.Get(path), r.Raw)
	}
	return s
}

func (r *Resp) Num(t *testing.T, path string) float64 {
	t.Helper()
	n, ok := r.Get(path).(float64)
	if !ok {
		t.Fatalf("path %q is not a number: %#v\nraw: %s", path, r.Get(path), r.Raw)
	}
	return n
}

func (r *Resp) Bool(t *testing.T, path string) bool {
	t.Helper()
	b, ok := r.Get(path).(bool)
	if !ok {
		t.Fatalf("path %q is not a bool: %#v\nraw: %s", path, r.Get(path), r.Raw)
	}
	return b
}

func (r *Resp) Len(t *testing.T, path string) int {
	t.Helper()
	a, ok := r.Get(path).([]any)
	if !ok {
		t.Fatalf("path %q is not a list: %#v\nraw: %s", path, r.Get(path), r.Raw)
	}
	return len(a)
}

// Cookie returns the named Set-Cookie from the response, or nil.
func (r *Resp) Cookie(name string) *http.Cookie {
	for _, c := range r.Cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// parityBug records a confirmed divergence between go-server and the Node
// reference implementation. The test body above it should assert the NODE
// behavior; calling parityBug right before that assertion skips the test with
// a greppable "PARITY-BUG" marker (`go test ./internal/graph -v | grep PARITY-BUG`)
// so a known bug doesn't turn the suite red. Delete the call once fixed.
func parityBug(t *testing.T, desc string) {
	t.Helper()
	t.Skip("PARITY-BUG: " + desc)
}
