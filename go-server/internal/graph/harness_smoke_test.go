package graph_test

import "testing"

func TestHarnessSmoke(t *testing.T) {
	e := newEnv(t)

	anon := e.Do(`{ me { id } }`, nil, nil)
	anon.NoErrors(t)
	if anon.Get("me") != nil {
		t.Fatalf("anonymous me should be null, got %v", anon.Get("me"))
	}

	u := e.NewUser("smoke@example.com", false)
	resp := e.Do(`{ me { id email } }`, nil, u)
	resp.NoErrors(t)
	if got := resp.Str(t, "me.email"); got != "smoke@example.com" {
		t.Fatalf("me.email = %q", got)
	}
}
