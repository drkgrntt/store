package middleware

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"storeapi/internal/models"
)

// Prod mirrors server/src/constants.ts's __prod__.
func Prod() bool {
	return os.Getenv("NODE_ENV") == "production"
}

const cookieName = "token"

// Fiber Locals keys, mirrored into the request's context.Context for the
// GraphQL resolvers (see graph/resolver.go) since Fiber v2's Locals is
// backed by the same fasthttp.RequestCtx that adaptor.HTTPHandler hands to
// gqlgen as the http.Request's context.
const (
	LocalCurrentUser = "currentUser"
	LocalToken       = "token"
	// LocalFiberCtx stashes the *fiber.Ctx itself so GraphQL resolvers (which
	// only ever see a context.Context) can still set/clear the auth cookie
	// through the same SetToken/RemoveToken helpers below.
	LocalFiberCtx = "fiberCtx"
)

// SetToken sets the auth cookie, matching res.setToken in
// server/src/middleware/handleTokens.ts.
func SetToken(c *fiber.Ctx, value string) {
	sameSite := "Lax"
	var domain string
	if Prod() {
		sameSite = "None"
		domain = "midwestdaisy.com"
	}
	c.Cookie(&fiber.Cookie{
		Name:     cookieName,
		Value:    value,
		SameSite: sameSite,
		Secure:   true,
		Domain:   domain,
		HTTPOnly: true,
		MaxAge:   60 * 60 * 24 * 30,
	})
}

// RemoveToken clears the auth cookie, matching res.removeToken.
func RemoveToken(c *fiber.Ctx) {
	sameSite := "Lax"
	var domain string
	if Prod() {
		sameSite = "None"
		domain = "midwestdaisy.com"
	}
	c.Cookie(&fiber.Cookie{
		Name:     cookieName,
		Value:    "a.b.c",
		SameSite: sameSite,
		Secure:   true,
		Domain:   domain,
		HTTPOnly: true,
		MaxAge:   0,
		Expires:  time.Unix(0, 0),
	})
}

// DeserializeToken reads the auth cookie, resolves the current user, and
// stashes both onto the request so the GraphQL context (see
// graph/resolver.go) can read them back out. Matches the `me`/`token`
// resolution that used to happen inline in the Apollo `context` function in
// server/src/index.ts.
func DeserializeToken(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Locals(LocalFiberCtx, c)

		token := c.Cookies(cookieName)
		c.Locals(LocalToken, token)

		if token == "" {
			return c.Next()
		}

		user, err := models.VerifyAndFindUser(db, token)
		if err != nil || user == nil {
			RemoveToken(c)
			return c.Next()
		}

		c.Locals(LocalCurrentUser, user)
		return c.Next()
	}
}
