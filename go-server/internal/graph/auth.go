package graph

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v2"

	"storeapi/internal/dataloaders"
	"storeapi/internal/middleware"
	"storeapi/internal/models"
)

// currentUser reads the user middleware.DeserializeToken already resolved
// for this request. See internal/middleware/auth.go for why a plain
// context.Value lookup works here despite gqlgen being handed a plain
// net/http context: Fiber's Locals and fasthttp's Value() share storage.
func currentUser(ctx context.Context) *models.User {
	user, _ := ctx.Value(middleware.LocalCurrentUser).(*models.User)
	return user
}

func tokenFromContext(ctx context.Context) string {
	token, _ := ctx.Value(middleware.LocalToken).(string)
	return token
}

// requireUser matches server/src/middleware/isAuth.ts.
func requireUser(ctx context.Context) (*models.User, error) {
	user := currentUser(ctx)
	if user == nil {
		return nil, errors.New("Not authenticated")
	}
	return user, nil
}

// requireAdmin matches server/src/middleware/isAdmin.ts.
func requireAdmin(ctx context.Context) (*models.User, error) {
	user, err := requireUser(ctx)
	if err != nil {
		return nil, err
	}
	if !user.IsAdmin {
		return nil, errors.New("Not allowed")
	}
	return user, nil
}

// loaders reads the request-scoped dataloaders.Loaders middleware.AttachDataLoaders
// built for this request. See internal/dataloaders for what each one does.
func loaders(ctx context.Context) *dataloaders.Loaders {
	l, _ := ctx.Value(middleware.LocalDataLoaders).(*dataloaders.Loaders)
	return l
}

func fiberCtx(ctx context.Context) *fiber.Ctx {
	c, _ := ctx.Value(middleware.LocalFiberCtx).(*fiber.Ctx)
	return c
}

// setToken/removeToken mirror res.setToken/res.removeToken from
// server/src/middleware/handleTokens.ts, reusing the same cookie helpers
// the DeserializeToken middleware uses.
func setToken(ctx context.Context, value string) {
	if c := fiberCtx(ctx); c != nil {
		middleware.SetToken(c, value)
	}
}

func removeToken(ctx context.Context) {
	if c := fiberCtx(ctx); c != nil {
		middleware.RemoveToken(c)
	}
}
