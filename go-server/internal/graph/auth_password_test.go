package graph_test

// changeEmail / resetPassword / forgotPassword / resetForgottenPassword.
// Node reference: server/src/resolvers/user.ts.

import (
	"testing"
	"time"

	"storeapi/internal/models"
)

func TestAuthChangeEmail(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("old@example.com", false)
	e.NewUser("taken@example.com", false)
	const q = `mutation($e:String!){ changeEmail(email:$e){ id email isAdmin } }`

	t.Run("anonymous", func(t *testing.T) {
		authDo(e,q, map[string]any{"e": "x@example.com"}, nil).HasError(t, "Not authenticated")
	})

	t.Run("invalid and duplicate leave DB unchanged", func(t *testing.T) {
		authDo(e,q, map[string]any{"e": "not-an-email"}, u).HasError(t, "is not a valid email address")
		if len(authDo(e,q, map[string]any{"e": "taken@example.com"}, u).Errors) == 0 {
			t.Error("duplicate email accepted")
		}
		if authUserByEmail(t, e, "old@example.com").ID != u.ID {
			t.Error("email changed")
		}
	})

	t.Run("success", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "new@example.com"}, u)
		r.NoErrors(t)
		if r.Str(t, "changeEmail.email") != "new@example.com" || r.Str(t, "changeEmail.id") != u.ID {
			t.Errorf("raw: %s", r.Raw)
		}
		if authUserByEmail(t, e, "new@example.com").ID != u.ID {
			t.Error("not persisted")
		}
	})
}

func TestAuthResetPassword(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("rp@example.com", false)
	const q = `mutation($o:String!,$n:String!){ resetPassword(old:$o,new:$n) }`

	t.Run("anonymous", func(t *testing.T) {
		authDo(e,q, map[string]any{"o": "password123", "n": "x"}, nil).HasError(t, "Not authenticated")
	})

	t.Run("wrong old password", func(t *testing.T) {
		authDo(e,q, map[string]any{"o": "bad", "n": "newpass"}, u).HasError(t, "Invalid old password")
		if authUserByEmail(t, e, "rp@example.com").ComparePassword("password123") != nil {
			t.Error("password changed on failure")
		}
	})

	t.Run("success", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"o": "password123", "n": "newpass"}, u)
		r.NoErrors(t)
		if !r.Bool(t, "resetPassword") {
			t.Error("want true")
		}
		got := authUserByEmail(t, e, "rp@example.com")
		if got.ComparePassword("newpass") != nil || got.ComparePassword("password123") == nil {
			t.Error("password not replaced")
		}
		// Existing sessions are NOT revoked (Node doesn't touch tokens).
		if authCountTokens(t, e, u.ID) == 0 {
			t.Error("tokens were deleted")
		}
	})
}

func TestAuthForgotPassword(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("fp@example.com", false)
	const q = `mutation($e:String!){ forgotPassword(email:$e) }`

	t.Run("unknown email returns true without side effects", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "ghost@example.com"}, nil)
		r.NoErrors(t)
		if !r.Bool(t, "forgotPassword") {
			t.Error("must not reveal whether the address exists")
		}
		var n int64
		e.DB.Model(&models.Token{}).Count(&n)
		if n != 0 {
			t.Errorf("%d tokens created for unknown email", n)
		}
	})

	t.Run("known email (any case) mints a 1-day token", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "FP@Example.com"}, nil)
		r.NoErrors(t)
		// Mailgun is unconfigured and HTTPS is routed to a dead proxy (see
		// init in auth_test.go), so the send fails; Node returns !!result.
		if r.Bool(t, "forgotPassword") {
			t.Error("expected false when the email could not be sent")
		}
		var toks []models.Token
		e.DB.Where("user_id = ?", u.ID).Find(&toks)
		if len(toks) != 1 {
			t.Fatalf("tokens = %d, want 1", len(toks))
		}
		if d := time.Until(toks[0].Expiry); d < 23*time.Hour || d > 25*time.Hour {
			t.Errorf("reset token expires in %v, want ~24h", d)
		}
		if r.Cookie("token") != nil {
			t.Error("forgotPassword must not set the auth cookie")
		}
	})
}

func TestAuthResetForgottenPassword(t *testing.T) {
	e := newEnv(t)
	u := e.NewUser("rfp@example.com", false)
	const q = `mutation($e:String!,$p:String!,$t:String!){ resetForgottenPassword(email:$e,password:$p,token:$t) }`
	const linkErr = "There is a problem with this link. Please try getting another link."
	const mismatchErr = "This email does not match any in our system. Please try again."

	mint := func(t *testing.T, days int) string {
		t.Helper()
		tok, err := models.GenerateToken(e.DB, u.ID, days)
		if err != nil {
			t.Fatal(err)
		}
		return tok.Value
	}
	pwOK := func(pw string) bool { return authUserByEmail(t, e, "rfp@example.com").ComparePassword(pw) == nil }

	t.Run("invalid tokens", func(t *testing.T) {
		for name, tok := range map[string]string{"empty": "", "garbage": "x.y.z", "no dots": "abc"} {
			r := authDo(e,q, map[string]any{"e": "rfp@example.com", "p": "new", "t": tok}, nil)
			if len(r.Errors) != 1 || r.Errors[0] != linkErr {
				t.Errorf("%s: errors = %v", name, r.Errors)
			}
		}
		if !pwOK("password123") {
			t.Error("password changed")
		}
	})

	t.Run("expired token", func(t *testing.T) {
		tok := mint(t, -1)
		r := authDo(e,q, map[string]any{"e": "rfp@example.com", "p": "new", "t": tok}, nil)
		if len(r.Errors) != 1 || r.Errors[0] != linkErr {
			t.Errorf("errors = %v", r.Errors)
		}
		if !pwOK("password123") {
			t.Error("password changed")
		}
	})

	tok := mint(t, 1)

	t.Run("email mismatch", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "someone@else.com", "p": "new", "t": tok}, nil)
		if len(r.Errors) != 1 || r.Errors[0] != mismatchErr {
			t.Errorf("errors = %v", r.Errors)
		}
		if !pwOK("password123") {
			t.Error("password changed")
		}
	})

	t.Run("success is case-insensitive on email and needs no session", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "RFP@EXAMPLE.com", "p": "brandnew", "t": tok}, nil)
		r.NoErrors(t)
		if !r.Bool(t, "resetForgottenPassword") {
			t.Error("want true")
		}
		if !pwOK("brandnew") {
			t.Error("password not updated")
		}
		if r.Cookie("token") != nil {
			t.Error("must not log the user in")
		}
	})

	// Node never deletes the reset token after use, so the link can be
	// replayed until it expires. Port keeps that (single-use is NOT Node
	// behavior); pin it so a "fix" is a conscious decision.
	t.Run("token is not consumed (matches Node)", func(t *testing.T) {
		r := authDo(e,q, map[string]any{"e": "rfp@example.com", "p": "again", "t": tok}, nil)
		r.NoErrors(t)
		if !pwOK("again") {
			t.Error("replay failed; Node allows it")
		}
		if authCountTokens(t, e, u.ID) == 0 {
			t.Error("token row deleted")
		}
	})

	t.Run("forged signature", func(t *testing.T) {
		forged := models.UnsignTokenValue(tok) + ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
		r := authDo(e,q, map[string]any{"e": "rfp@example.com", "p": "hax", "t": forged}, nil)
		if len(r.Errors) != 1 || r.Errors[0] != linkErr {
			t.Errorf("errors = %v", r.Errors)
		}
		if pwOK("hax") {
			t.Error("forged token changed password")
		}
	})
}
