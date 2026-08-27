package server

import (
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/lru"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"storeapi/internal/graph"
	"storeapi/internal/middleware"
)

// RegisterFiberRoutes wires up the same middleware chain as
// server/src/index.ts: sanitize -> cookies -> cors -> handleTokens -> the
// GraphQL endpoint. Fiber's cookie parsing is built in (c.Cookies(...)), so
// there's no separate cookie-parser middleware to mount.
//
// server/src/index.ts also mounts `sanitize.middleware` ahead of everything
// else, but there's nothing to port: that middleware only attaches opt-in
// helper methods (req.bodyInt, req.queryString, ...) onto `req` for route
// handlers to call — it doesn't transform anything on its own — and
// `grep -rn "sanitizer\.\|req\.body[A-Z]\|req\.query[A-Z]" src/` turns up
// zero call sites anywhere in the Node server. It's mounted but inert.
func (s *FiberServer) RegisterFiberRoutes() {
	s.App.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool { return true },
		AllowCredentials: true,
	}))

	s.App.Use(middleware.DeserializeToken(s.db.DB))
	s.App.Use(middleware.AttachDataLoaders(s.db.DB))

	resolver := &graph.Resolver{DB: s.db.DB}

	// Built by hand instead of handler.NewDefaultServer: that helper also
	// registers extension.AutomaticPersistedQuery, but the Node server
	// explicitly turns persisted queries off (`persistedQueries: false` in
	// server/src/index.ts) — the client never sends one, so APQ would sit
	// unused rather than actively break anything, but there's no reason to
	// carry a feature the original deliberately disabled.
	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})
	srv.SetQueryCache(lru.New(1000))

	// Matches Apollo Server's own default: introspection (and the
	// interactive Playground/Sandbox UI) is only enabled outside
	// production — see server/src/constants.ts's __prod__ — so a
	// production deploy doesn't hand out a full schema walkthrough.
	if !middleware.Prod() {
		srv.Use(extension.Introspection{})
		s.App.Get("/graphql", adaptor.HTTPHandler(playground.Handler("GraphQL Playground", "/graphql")))
	} else {
		s.App.Get("/graphql", func(c *fiber.Ctx) error {
			return c.Status(http.StatusOK).SendString("GraphQL endpoint. POST your queries here.")
		})
	}

	s.App.Post("/graphql", adaptor.HTTPHandler(srv))

	s.App.Get("/api/health", s.healthHandler)
}

func (s *FiberServer) healthHandler(c *fiber.Ctx) error {
	return c.Status(http.StatusOK).JSON(s.db.Health())
}
