package graph_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"storeapi/internal/models"
)

// genPing sends `mutation { ping(path) }` with arbitrary headers/cookie.
func genPing(t *testing.T, e *Env, path string, headers map[string]string, token string) (string, []string) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{
		"query":     `mutation($p:String!){ ping(path:$p) }`,
		"variables": map[string]any{"p": path},
	})
	req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "token", Value: token})
	}
	res, err := e.App.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out struct {
		Data struct {
			Ping string `json:"ping"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("%s", raw)
	}
	var errs []string
	for _, er := range out.Errors {
		errs = append(errs, er.Message)
	}
	return out.Data.Ping, errs
}

func genAnalytics(t *testing.T, e *Env) []models.Analytic {
	t.Helper()
	var rows []models.Analytic
	if err := e.DB.Order("created_at ASC").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestPingRecordsAnalytic(t *testing.T) {
	e := newEnv(t)
	pong, errs := genPing(t, e, "/products?modal=detail&id=abc-123&x=1&x=2",
		map[string]string{"User-Agent": "Mozilla/5.0 test", "Origin": "https://shop.example", "X-Forwarded-For": "1.2.3.4"}, "")
	if len(errs) > 0 || pong != "pong" {
		t.Fatalf("pong=%q errs=%v", pong, errs)
	}
	rows := genAnalytics(t, e)
	if len(rows) != 1 {
		t.Fatalf("want 1 analytic, got %d", len(rows))
	}
	a := rows[0]
	if a.IP != "1.2.3.4" || a.UserAgent != "Mozilla/5.0 test" || a.Page != "/products" ||
		a.Modal != "detail" || a.ModalID != "abc-123" || a.UserID != "" {
		t.Fatalf("bad row: %+v", a)
	}
	var q map[string]string
	if err := json.Unmarshal(a.Query, &q); err != nil {
		t.Fatal(err)
	}
	// Object.fromEntries: last duplicate wins.
	if q["modal"] != "detail" || q["id"] != "abc-123" || q["x"] != "2" || len(q) != 3 {
		t.Fatalf("query json: %v", q)
	}
}

func TestPingIPFallbackAndNoQuery(t *testing.T) {
	e := newEnv(t)
	pong, errs := genPing(t, e, "/", map[string]string{"User-Agent": "ua"}, "")
	if len(errs) > 0 || pong != "pong" {
		t.Fatal(errs)
	}
	rows := genAnalytics(t, e)
	if len(rows) != 1 || rows[0].IP == "" || rows[0].Page != "/" {
		t.Fatalf("bad: %+v", rows)
	}
	if string(rows[0].Query) != "{}" {
		t.Fatalf("query = %s", rows[0].Query)
	}
}

func TestPingBotsAreSkipped(t *testing.T) {
	e := newEnv(t)
	for _, ua := range []string{
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"Mozilla/5.0 Vercelbot/0.1 (+https://vercel.com)",
	} {
		pong, errs := genPing(t, e, "/x", map[string]string{"User-Agent": ua}, "")
		if len(errs) > 0 || pong != "pong" {
			t.Fatalf("bot ping: %q %v", pong, errs)
		}
	}
	if n := len(genAnalytics(t, e)); n != 0 {
		t.Fatalf("bots logged %d rows", n)
	}
}

func TestPingAuthenticatedRecordsUserAndToken(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("u@x.com", false)
	tok := e.TokenFor(u)
	pong, errs := genPing(t, e, "/cart", map[string]string{"User-Agent": "ua"}, tok)
	if len(errs) > 0 || pong != "pong" {
		t.Fatal(errs)
	}
	rows := genAnalytics(t, e)
	if len(rows) != 1 || rows[0].UserID != u.ID || rows[0].Token == "" {
		t.Fatalf("bad: %+v", rows)
	}
}

func TestPingNeverFailsOnBadInput(t *testing.T) {
	e := newEnv(t)
	// Public mutation, and a malformed path must still return pong.
	for _, p := range []string{"", "%zz", "/a b?c=%"} {
		pong, errs := genPing(t, e, p, map[string]string{"User-Agent": "ua"}, "")
		if len(errs) > 0 || pong != "pong" {
			t.Fatalf("path %q: pong=%q errs=%v", p, pong, errs)
		}
	}
	// Garbage token: still anonymous, still pong.
	pong, errs := genPing(t, e, "/", map[string]string{"User-Agent": "ua"}, "garbage")
	if len(errs) > 0 || pong != "pong" {
		t.Fatalf("garbage token: %q %v", pong, errs)
	}
}

func TestAnalyticColumnNamesMatchNode(t *testing.T) {
	e := newEnv(t)
	// Node's Analytic.useragent (underscored:true) -> column "useragent". The
	// live table already holds ~57k rows there, so Go must write to the same
	// column rather than letting AutoMigrate add a parallel "user_agent".
	req := httptest.NewRequest(http.MethodPost, "/graphql", strings.NewReader(
		`{"query":"mutation { ping(path: \"/products\") }"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 column-test")
	if _, err := e.App.Test(req, -1); err != nil {
		t.Fatal(err)
	}

	var got string
	if err := e.DB.Raw(`SELECT useragent FROM analytics WHERE page = '/products'`).Scan(&got).Error; err != nil {
		t.Fatalf("reading useragent column: %v", err)
	}
	if got != "Mozilla/5.0 column-test" {
		t.Fatalf("useragent column = %q, want the pinged user agent", got)
	}

	var hasUnderscored int64
	e.DB.Raw(`SELECT count(*) FROM information_schema.columns WHERE table_name='analytics' AND column_name='user_agent'`).Scan(&hasUnderscored)
	if hasUnderscored != 0 {
		// A leftover from an earlier migration of this scratch DB is harmless
		// as long as nothing was written to it.
		var wrote int64
		e.DB.Raw(`SELECT count(*) FROM analytics WHERE user_agent IS NOT NULL`).Scan(&wrote)
		if wrote != 0 {
			t.Fatalf("%d row(s) written to user_agent; Go must write only to useragent", wrote)
		}
	}
}
