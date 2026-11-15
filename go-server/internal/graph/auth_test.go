package graph_test

// Integration tests for register/login/me/logout/logoutEverywhere, auth
// cookie attributes and the token lifecycle. Node reference:
// server/src/resolvers/user.ts, middleware/handleTokens.ts, models/Token.ts,
// and the Apollo `context` function in server/src/index.ts.

import (
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"storeapi/internal/models"
)

func init() {
	// forgotPassword calls emails.Send (Mailgun) with no way to inject a
	// fake. Route outbound HTTPS to a dead local port so it fails fast and
	// never reaches the network. Must be set before net/http first reads the
	// proxy environment.
	for _, k := range []string{"NO_PROXY", "no_proxy"} {
		os.Unsetenv(k)
	}
	os.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
	os.Setenv("https_proxy", "http://127.0.0.1:1")
}

// authMint persists a valid 30-day token for u. Unlike e.TokenFor it adds a
// random jti claim, because Token.generate's claims are only {uid, iat, exp}
// (second resolution): two tokens for one user in the same second are
// byte-identical and violate the unique index, in Node as well as Go.
func authMint(e *Env, u *models.User) string {
	e.t.Helper()
	now := time.Now().UTC()
	exp := now.AddDate(0, 0, 30)
	val, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"uid": u.ID, "iat": now.Unix(), "exp": exp.Unix(), "jti": uuid.NewString(),
	}).SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		e.t.Fatal(err)
	}
	tok := &models.Token{Value: val, Expiry: exp, Issued: now, UserID: u.ID}
	if err := e.DB.Create(tok).Error; err != nil {
		e.t.Fatal(err)
	}
	return tok.Value
}

// authDo is e.Do with a collision-free token (see authMint). nil = anonymous.
func authDo(e *Env, q string, vars map[string]any, as *models.User) *Resp {
	e.t.Helper()
	tok := ""
	if as != nil {
		tok = authMint(e, as)
	}
	return e.DoWithToken(q, vars, tok)
}

// authNextSecond avoids the same-second token collision described above for
// tests that go through login/register's own Token.generate.
func authNextSecond() { time.Sleep(1100 * time.Millisecond) }

const authUserFields = `id email isAdmin createdAt updatedAt`

// authRawTokenValues returns the stored (unsigned) value column for a user.
func authRawTokenValues(t *testing.T, e *Env, userID string) []string {
	t.Helper()
	var vals []string
	if err := e.DB.Raw("SELECT value FROM tokens WHERE user_id = ?", userID).Scan(&vals).Error; err != nil {
		t.Fatal(err)
	}
	return vals
}

func authCountTokens(t *testing.T, e *Env, userID string) int {
	t.Helper()
	return len(authRawTokenValues(t, e, userID))
}

func authUserByEmail(t *testing.T, e *Env, email string) *models.User {
	t.Helper()
	var u models.User
	if err := e.DB.Where("email = ?", email).First(&u).Error; err != nil {
		t.Fatalf("user %s not found: %v", email, err)
	}
	return &u
}

// authAssertSetCookie checks the attributes handleTokens.ts res.setToken sets.
func authAssertSetCookie(t *testing.T, c *http.Cookie, prod bool) {
	t.Helper()
	if c == nil {
		t.Fatal("no token Set-Cookie")
	}
	if !c.HttpOnly {
		t.Error("cookie not HttpOnly")
	}
	if !c.Secure {
		t.Error("cookie not Secure")
	}
	if c.MaxAge != 60*60*24*30 {
		t.Errorf("MaxAge = %d, want 2592000", c.MaxAge)
	}
	wantSame, wantDomain := http.SameSiteLaxMode, ""
	if prod {
		wantSame, wantDomain = http.SameSiteNoneMode, "midwestdaisy.com"
	}
	if c.SameSite != wantSame {
		t.Errorf("SameSite = %v, want %v", c.SameSite, wantSame)
	}
	if c.Domain != wantDomain {
		t.Errorf("Domain = %q, want %q", c.Domain, wantDomain)
	}
	if c.Value == "" || strings.Count(c.Value, ".") != 2 {
		t.Errorf("cookie value is not a signed JWT: %q", c.Value)
	}
}

// authAssertClearedCookie checks res.removeToken's cookie: value a.b.c,
// same flags, and already expired (Node: Max-Age=0).
func authAssertClearedCookie(t *testing.T, c *http.Cookie, prod bool) {
	t.Helper()
	if c == nil {
		t.Fatal("no token Set-Cookie (expected cleared cookie)")
	}
	if c.Value != "a.b.c" {
		t.Errorf("cleared value = %q, want a.b.c", c.Value)
	}
	if !c.HttpOnly || !c.Secure {
		t.Errorf("cleared cookie HttpOnly=%v Secure=%v", c.HttpOnly, c.Secure)
	}
	expired := c.MaxAge < 0 || (!c.Expires.IsZero() && c.Expires.Before(time.Now()))
	if !expired {
		t.Errorf("cleared cookie not expired: MaxAge=%d Expires=%v", c.MaxAge, c.Expires)
	}
	wantSame, wantDomain := http.SameSiteLaxMode, ""
	if prod {
		wantSame, wantDomain = http.SameSiteNoneMode, "midwestdaisy.com"
	}
	if c.SameSite != wantSame || c.Domain != wantDomain {
		t.Errorf("cleared cookie SameSite=%v Domain=%q", c.SameSite, c.Domain)
	}
}

func TestAuthRegister(t *testing.T) {
	e := newEnv(t)
	const q = `mutation($e:String!,$p:String!){ register(email:$e,password:$p){ ` + authUserFields + ` tokens{ id value userId } } }`

	r := e.Do(q, map[string]any{"e": "new@example.com", "p": "s3cretpw"}, nil)
	r.NoErrors(t)
	if r.Str(t, "register.email") != "new@example.com" || r.Bool(t, "register.isAdmin") {
		t.Fatalf("bad user: %s", r.Raw)
	}
	uid := r.Str(t, "register.id")
	if r.Len(t, "register.tokens") != 1 || r.Str(t, "register.tokens.0.userId") != uid {
		t.Fatalf("tokens: %s", r.Raw)
	}
	authAssertSetCookie(t, r.Cookie("token"), false)
	// The returned token value is exactly what went into the cookie.
	if r.Str(t, "register.tokens.0.value") != r.Cookie("token").Value {
		t.Error("tokens[0].value != cookie value")
	}

	u := authUserByEmail(t, e, "new@example.com")
	if u.IsAdmin {
		t.Error("registered user must not be admin")
	}
	if u.ComparePassword("s3cretpw") != nil {
		t.Error("password not stored as bcrypt hash of input")
	}
	if u.Password == "s3cretpw" || !strings.HasPrefix(u.Password, "$2") {
		t.Errorf("password not hashed: %q", u.Password)
	}

	// DB stores only the unsigned header.payload; cookie carries the signature.
	raw := authRawTokenValues(t, e, uid)
	if len(raw) != 1 || strings.Count(raw[0], ".") != 1 {
		t.Fatalf("stored token values = %v, want one unsigned value", raw)
	}
	if !strings.HasPrefix(r.Cookie("token").Value, raw[0]+".") {
		t.Error("cookie is not stored value + signature")
	}

	// Claims: uid, iat, exp = iat + 30d.
	claims := jwt.MapClaims{}
	if _, err := jwt.ParseWithClaims(r.Cookie("token").Value, claims, func(*jwt.Token) (any, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	}); err != nil {
		t.Fatalf("cookie JWT does not verify: %v", err)
	}
	if claims["uid"] != uid {
		t.Errorf("uid claim = %v", claims["uid"])
	}
	iat, exp := claims["iat"].(float64), claims["exp"].(float64)
	if d := exp - iat; d < 29*86400 || d > 31*86400 {
		t.Errorf("exp-iat = %vs, want ~30d", d)
	}

	// Cookie authenticates a follow-up request.
	me := e.DoWithToken(`{ me { email } }`, nil, r.Cookie("token").Value)
	me.NoErrors(t)
	if me.Str(t, "me.email") != "new@example.com" {
		t.Errorf("me = %s", me.Raw)
	}

	t.Run("duplicate email rolls back", func(t *testing.T) {
		before := authCountTokens(t, e, uid)
		r := e.Do(q, map[string]any{"e": "new@example.com", "p": "other"}, nil)
		if len(r.Errors) == 0 {
			t.Fatal("expected error for duplicate email")
		}
		if r.Cookie("token") != nil {
			t.Error("cookie set on failed register")
		}
		if authCountTokens(t, e, uid) != before {
			t.Error("token count changed")
		}
	})

	t.Run("invalid emails", func(t *testing.T) {
		for _, bad := range []string{"nope", "a@b", "a b@c.com", "@x.com", "a@x.c"} {
			r := e.Do(q, map[string]any{"e": bad, "p": "pw"}, nil)
			r.HasError(t, "is not a valid email address")
			var n int64
			e.DB.Model(&models.User{}).Where("email = ?", bad).Count(&n)
			if n != 0 {
				t.Errorf("%q persisted", bad)
			}
		}
	})
}

func TestAuthLogin(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("Login.User@Example.com", false)
	const q = `mutation($e:String!,$p:String!){ login(email:$e,password:$p){ id email tokens{ value userId } } }`

	t.Run("success sets cookie and new token", func(t *testing.T) {
		before := authCountTokens(t, e, u.ID)
		authNextSecond()
		r := e.Do(q, map[string]any{"e": "Login.User@Example.com", "p": "password123"}, nil)
		r.NoErrors(t)
		if r.Str(t, "login.id") != u.ID || r.Len(t, "login.tokens") != 1 {
			t.Fatalf("raw: %s", r.Raw)
		}
		authAssertSetCookie(t, r.Cookie("token"), false)
		if r.Str(t, "login.tokens.0.value") != r.Cookie("token").Value {
			t.Error("token value != cookie")
		}
		if authCountTokens(t, e, u.ID) != before+1 {
			t.Error("login should add (not replace) a token")
		}
	})

	t.Run("email is case-insensitive", func(t *testing.T) {
		authNextSecond()
		r := e.Do(q, map[string]any{"e": "login.user@example.COM", "p": "password123"}, nil)
		r.NoErrors(t)
		if r.Str(t, "login.id") != u.ID {
			t.Error("wrong user")
		}
	})

	t.Run("bad credentials share one message and set no cookie", func(t *testing.T) {
		before := authCountTokens(t, e, u.ID)
		for name, vars := range map[string]map[string]any{
			"wrong password": {"e": "Login.User@Example.com", "p": "nope"},
			"unknown email":  {"e": "ghost@example.com", "p": "password123"},
		} {
			r := e.Do(q, vars, nil)
			if len(r.Errors) != 1 || r.Errors[0] != "Invalid email or password" {
				t.Errorf("%s: errors = %v", name, r.Errors)
			}
			if r.Cookie("token") != nil {
				t.Errorf("%s: cookie set", name)
			}
		}
		if authCountTokens(t, e, u.ID) != before {
			t.Error("failed login created a token")
		}
	})

	t.Run("production cookie attrs", func(t *testing.T) {
		t.Setenv("NODE_ENV", "production")
		authNextSecond()
		r := e.Do(q, map[string]any{"e": "Login.User@Example.com", "p": "password123"}, nil)
		r.NoErrors(t)
		authAssertSetCookie(t, r.Cookie("token"), true)
	})
}

func TestAuthMe(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("me@example.com", true)
	other := e.NewUser("other@example.com", false)

	t.Run("anonymous is null, no cookie touched", func(t *testing.T) {
		r := e.Do(`{ me { id } }`, nil, nil)
		r.NoErrors(t)
		if r.Get("me") != nil {
			t.Errorf("me = %v", r.Get("me"))
		}
		if r.Cookie("token") != nil {
			t.Error("cookie touched for anonymous request")
		}
	})

	t.Run("authenticated returns own fields", func(t *testing.T) {
		r := e.Do(`{ me { id email isAdmin createdAt updatedAt addresses{id} billingAddress{id} shippingAddresses{id} } }`, nil, u)
		r.NoErrors(t)
		if r.Str(t, "me.id") != u.ID || r.Str(t, "me.email") != "me@example.com" || !r.Bool(t, "me.isAdmin") {
			t.Errorf("raw: %s", r.Raw)
		}
		if r.Cookie("token") != nil {
			t.Error("valid token must not reset cookie")
		}
	})

	t.Run("me.tokens are signed values of own tokens only", func(t *testing.T) {
		tok := authMint(e, u)
		authMint(e, other)
		r := e.DoWithToken(`{ me { tokens { id value userId } } }`, nil, tok)
		r.NoErrors(t)
		n := r.Len(t, "me.tokens")
		if n != authCountTokens(t, e, u.ID) {
			t.Errorf("tokens = %d", n)
		}
		found := false
		for i := 0; i < n; i++ {
			p := "me.tokens." + string(rune('0'+i))
			if r.Str(t, p+".userId") != u.ID {
				t.Error("foreign token leaked")
			}
			v := r.Str(t, p+".value")
			if strings.Count(v, ".") != 2 {
				t.Errorf("token value not signed: %q", v)
			}
			if v == tok {
				found = true
			}
		}
		if !found {
			t.Error("caller's own token missing from me.tokens")
		}
	})

	// Every rejected-token case: me is null, the cookie is cleared
	// (index.ts: `if (!me) res.removeToken()`), and the request still succeeds.
	rejected := func(t *testing.T, tok string) {
		t.Helper()
		r := e.DoWithToken(`{ me { id } }`, nil, tok)
		r.NoErrors(t)
		if r.Get("me") != nil {
			t.Fatalf("me should be null: %s", r.Raw)
		}
		authAssertClearedCookie(t, r.Cookie("token"), false)
	}

	t.Run("garbage cookie", func(t *testing.T) { rejected(t, "garbage") })
	t.Run("a.b.c cookie", func(t *testing.T) { rejected(t, "a.b.c") })

	t.Run("signed but not persisted", func(t *testing.T) {
		v, _, _, err := models.GenerateTokenValue(u.ID, 31) // 31d: differs from any persisted 30d token
		if err != nil {
			t.Fatal(err)
		}
		rejected(t, v)
	})

	t.Run("bad signature is rejected and the row destroyed", func(t *testing.T) {
		tok := authMint(e, u)
		parts := strings.Split(tok, ".")
		forged := parts[0] + "." + parts[1] + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		rejected(t, forged)
		// token.destroy() in Token.verifyAndFindUser's catch.
		var n int64
		e.DB.Model(&models.Token{}).Where("value = ?", parts[0]+"."+parts[1]).Count(&n)
		if n != 0 {
			t.Error("forged-signature token row not deleted")
		}
		// The genuine token's row is gone too, so the real token also fails.
		rejected(t, tok)
	})

	t.Run("expired token is rejected and destroyed", func(t *testing.T) {
		tok, err := models.GenerateToken(e.DB, u.ID, -1)
		if err != nil {
			t.Fatal(err)
		}
		unsigned := models.UnsignTokenValue(tok.Value)
		rejected(t, tok.Value)
		var n int64
		e.DB.Model(&models.Token{}).Where("value = ?", unsigned).Count(&n)
		if n != 0 {
			t.Error("expired token row not deleted")
		}
	})

	t.Run("token signed with another secret", func(t *testing.T) {
		tok := authMint(e, u)
		claims := jwt.MapClaims{}
		if _, _, err := jwt.NewParser().ParseUnverified(tok, claims); err != nil {
			t.Fatal(err)
		}
		bad, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("wrong-secret"))
		rejected(t, bad)
	})

	t.Run("production clears with prod attrs", func(t *testing.T) {
		t.Setenv("NODE_ENV", "production")
		r := e.DoWithToken(`{ me { id } }`, nil, "garbage")
		r.NoErrors(t)
		authAssertClearedCookie(t, r.Cookie("token"), true)
	})
}

func TestAuthLogout(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("lo@example.com", false)
	other := e.NewUser("lo2@example.com", false)

	t.Run("anonymous", func(t *testing.T) {
		r := e.Do(`mutation{ logout }`, nil, nil)
		r.HasError(t, "Not authenticated")
	})

	t.Run("deletes only the presented token and clears cookie", func(t *testing.T) {
		tokA := authMint(e, u)
		tokB := authMint(e, u)
		otherTok := authMint(e, other)
		before := authCountTokens(t, e, u.ID)

		r := e.DoWithToken(`mutation{ logout }`, nil, tokA)
		r.NoErrors(t)
		if !r.Bool(t, "logout") {
			t.Error("logout should be true")
		}
		authAssertClearedCookie(t, r.Cookie("token"), false)
		if authCountTokens(t, e, u.ID) != before-1 {
			t.Error("exactly one token should be deleted")
		}
		if e.DoWithToken(`{me{id}}`, nil, tokA).Get("me") != nil {
			t.Error("logged-out token still works")
		}
		if e.DoWithToken(`{me{id}}`, nil, tokB).Get("me") == nil {
			t.Error("other session of same user was logged out")
		}
		if e.DoWithToken(`{me{id}}`, nil, otherTok).Get("me") == nil {
			t.Error("other user's session was logged out")
		}
	})

	t.Run("production cookie attrs", func(t *testing.T) {
		t.Setenv("NODE_ENV", "production")
		tok := authMint(e, u)
		r := e.DoWithToken(`mutation{ logout }`, nil, tok)
		r.NoErrors(t)
		authAssertClearedCookie(t, r.Cookie("token"), true)
	})
}

func TestAuthLogoutEverywhere(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("le@example.com", false)
	other := e.NewUser("le2@example.com", false)

	t.Run("anonymous", func(t *testing.T) {
		e.Do(`mutation{ logoutEverywhere{ id } }`, nil, nil).HasError(t, "Not authenticated")
	})

	old1, old2 := authMint(e, u), authMint(e, u)
	otherTok := authMint(e, other)

	r := e.DoWithToken(`mutation{ logoutEverywhere{ id value userId createdAt updatedAt } }`, nil, old1)
	r.NoErrors(t)
	if r.Str(t, "logoutEverywhere.userId") != u.ID {
		t.Errorf("raw: %s", r.Raw)
	}
	newTok := r.Str(t, "logoutEverywhere.value")
	authAssertSetCookie(t, r.Cookie("token"), false)
	if r.Cookie("token").Value != newTok {
		t.Error("cookie != returned token")
	}
	if n := authCountTokens(t, e, u.ID); n != 1 {
		t.Errorf("user has %d tokens after logoutEverywhere, want 1", n)
	}
	for name, old := range map[string]string{"caller's old token": old1, "other session": old2} {
		if e.DoWithToken(`{me{id}}`, nil, old).Get("me") != nil {
			t.Errorf("%s still valid", name)
		}
	}
	if e.DoWithToken(`{me{id}}`, nil, newTok).Get("me") == nil {
		t.Error("new token not valid")
	}
	if e.DoWithToken(`{me{id}}`, nil, otherTok).Get("me") == nil {
		t.Error("another user's token was revoked")
	}
}
