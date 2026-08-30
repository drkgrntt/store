# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is an e-commerce monorepo with three top-level apps that are deployed independently (each has its own Dockerfile/docker-compose.yml, all using `network_mode: host` so they can reach the native Postgres instance and coexist behind nginx):

- **`go-server/`** — the active backend. Go (Fiber + gqlgen + GORM), serving GraphQL at `/graphql`. This is where new backend work happens.
- **`server/`** — the legacy backend being replaced by `go-server/`. Node/TypeScript, Apollo Server + type-graphql + Sequelize. Kept around as the reference implementation during the migration and still deployable side-by-side with `go-server` (see its docker-compose.yml comments), but not where new work goes.
- **`client/`** — Next.js 13 (pages router) + Apollo Client frontend. Talks to whichever backend `NEXT_PUBLIC_API_URL` points at over GraphQL.

**`go-server` is a line-by-line port of `server`, not a rewrite**, and its source comments constantly cite the exact Node file/line/behavior being matched (e.g. "matches `res.setToken` in `server/src/middleware/handleTokens.ts`"). When changing backend behavior or resolving an ambiguity in `go-server`, check the corresponding code in `server/src` first — the Go comments usually already explain the mapping and *why* the port sometimes deliberately diverges (e.g. connection pool sizing, dataloader batch-wait tuning, the `Base.ID` column being a plain string, not a Postgres `uuid`, because Sequelize's `@IsUUID` was only ever a validator). Don't "fix" a divergence from `server/src` without reading the comment explaining it first.

## go-server

### Commands
Run from `go-server/`:
```
make run        # go run ./cmd/api (regenerates GraphQL code first)
make build       # go build -o main ./cmd/api (regenerates GraphQL code first)
make generate    # regenerate internal/graph/generated.go + models_gen.go from internal/graph/schema/*.graphqls
make test        # go test ./... -v
make itest       # DB-backed tests only (internal/models) - needs TEST_DATABASE_URL
make watch       # live reload via air (internal/.air.toml)
```
Single test: `go test ./internal/models -run TestProductBeforeSavePositiveValidation -v` (swap the package path and `-run` pattern as needed).

DB-backed tests (files named `*_db_test.go`, e.g. `internal/models/db_test.go`) connect to a real Postgres via `TEST_DATABASE_URL` and skip (not fail) if it's unset. Plain `*_test.go` files (e.g. `internal/models/product_test.go`) don't need a database.

### Architecture
- **Schema-first GraphQL**: schemas live in `internal/graph/schema/*.graphqls`, one file per domain (address, cart, category, content, general, image, order, product, root, user). `make generate` (gqlgen) regenerates `internal/graph/generated.go` and `internal/graph/models_gen.go` from them — never hand-edit either file. Resolvers are hand-written in `internal/graph/*.resolvers.go`, one file per schema file (`follow-schema` layout).
- **Autobind to hand-written models**: `gqlgen.yml` autobinds GraphQL types directly to the structs in `internal/models/` instead of generating separate `model_gen` structs, so a GraphQL field usually *is* a Go struct field. Fields that are actually on-demand lookups rather than eager-loaded columns (e.g. `User.tokens`, `Order.user`/`address`/`orderedProducts`) are forced to generate a resolver via `gqlgen.yml`'s `fields: { resolver: true }` even where the struct happens to have a same-named field.
- **Models self-register**: every model in `internal/models/*.go` calls `registerModel(&Thing{})` in an `init()`. `models.GetModels()` returns that list, and `database.AutoMigrate()` (called on every boot in `cmd/api/main.go`, mirroring the Node server's `sequelize.sync()`) runs `db.AutoMigrate()` against it. Adding a new model means adding the `init()` registration, not touching a central list.
- **`models.Base`** (`internal/models/base.go`) is the id/createdAt/updatedAt embed every model uses. IDs are app-generated UUID strings assigned in `BeforeCreate`/`EnsureID`, not DB-generated — match this rather than switching to a DB-side default.
- **Dataloaders** (`internal/dataloaders/`) are per-request: `dataloaders.New(db)` is attached to the Fiber context by `middleware.AttachDataLoaders` and must never be shared or cached across requests. Generic `byIDFetch[T]`/`idsByParentFetch` helpers (`internal/dataloaders/fetch.go`) back most of the loaders in `Loaders` (`internal/dataloaders/dataloaders.go`); add a new one by calling one of those generics rather than writing a bespoke batch function.
- **Auth**: `middleware.DeserializeToken` reads the `token` cookie, resolves the user via `models.VerifyAndFindUser`, and stashes both the user and the raw fiber.Ctx into Fiber `Locals` (see the `Local*` constants in `internal/middleware/auth.go`) so GraphQL resolvers — which only see a `context.Context`, not a `*fiber.Ctx` — can still read the current user and set/clear the auth cookie via `SetToken`/`RemoveToken`.
- **Request flow** (`internal/server/routes.go`): CORS → `DeserializeToken` → `AttachDataLoaders` → gqlgen HTTP handler at `/graphql`. Introspection and the GraphQL Playground are only enabled when `NODE_ENV != production` (`middleware.Prod()`), matching Apollo Server's own default.
- **Config is env-only** (`internal/database/database.go` et al. read directly from `os.Getenv`, autoloaded via `godotenv/autoload`) — see `go-server/.env.example` for the full variable list (`DATABASE_URL`, `JWT_SECRET`, Cloudinary/Stripe/Mailgun/R2 keys, etc).
- **Emails**: HTML templates in `internal/emails/templates/` (mirrored from `server/emails/`) are rendered by `internal/emails/send.go`.
- **DB backups**: `internal/database/backup.go` ports the Node journal project's daily-backup-to-R2 strategy.

## server (legacy Node backend)

Reference-only for understanding existing behavior being ported; avoid adding new features here.
```
npm run build   # tsc -> dist/
npm run dev     # nodemon --inspect dist/index.js (requires build first)
npm run watch   # tsc -w + nodemon concurrently
```
Apollo Server (`apollo-server-express`) + type-graphql resolvers (`src/resolvers/`) + Sequelize/`sequelize-typescript` models (`src/models/`), migrations in `src/migrations/`. `src/constants.ts` defines `__prod__`, gating introspection/Playground the same way `go-server` gates them.

## client

```
npm run dev     # next dev -p 4444
npm run build
npm run lint    # next lint
```
Next.js 13 pages router. `NEXT_PUBLIC_API_URL` (baked into the build — see client/docker-compose.yml's build `args`) points at a backend's `/graphql` endpoint. `src/utils/createWithApollo.tsx` is the `withApollo` HOC wiring `ApolloClient`/`ApolloProvider` into pages, keeping a single client instance across page transitions (`globalApolloClient`) and supporting SSR via `getInitialProps`. Global client-side state (cart, notifications) lives in React context providers under `src/providers/`, not Apollo's cache.
