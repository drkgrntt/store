package graph_test

import (
	"sync"

	"storeapi/internal/models"
)

var catTokens sync.Map // user id -> token

// catDo is e.Do with the user's token minted once and reused: tokens are
// deterministic per second, so minting twice in one second for one user
// violates the unique index on tokens.value.
func catDo(e *Env, query string, vars map[string]any, as *models.User) *Resp {
	e.t.Helper()
	if as == nil {
		return e.DoWithToken(query, vars, "")
	}
	tok, ok := catTokens.Load(as.ID)
	if !ok {
		tok = e.TokenFor(as)
		catTokens.Store(as.ID, tok)
	}
	return e.DoWithToken(query, vars, tok.(string))
}
