package middleware

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"storeapi/internal/dataloaders"
)

// LocalDataLoaders is the Fiber Locals key the GraphQL resolvers (see
// graph/auth.go's loaders helper) read a request's Loaders back out of.
const LocalDataLoaders = "dataloaders"

// AttachDataLoaders builds a fresh, request-scoped set of dataloaders and
// stashes them onto the request, matching the fresh `create*Loader()` calls
// in the Apollo `context` function in server/src/index.ts. Must run once
// per request — a Loaders instance must never be reused across requests.
func AttachDataLoaders(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Locals(LocalDataLoaders, dataloaders.New(db))
		return c.Next()
	}
}
