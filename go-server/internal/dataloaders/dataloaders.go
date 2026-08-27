package dataloaders

import (
	"time"

	"github.com/vikstrous/dataloadgen"
	"gorm.io/gorm"

	"storeapi/internal/models"
)

// batchWait bounds how long a loader waits to see if more Load() calls will
// join the same batch before firing its query. dataloadgen defaults to
// 16ms, tuned for a Node-style server where many requests share one
// process; the Node `dataloader` package itself batches within the current
// event-loop tick instead — effectively near-zero delay — which is why a
// single object's field resolvers (e.g. one product's images+categories,
// with nothing else to batch with) benchmarked meaningfully slower here
// than against the Node server before this was added. A short, fixed wait
// still lets concurrent requests for the same keys batch together, without
// taxing every request that has no batch partner.
const batchWait = 1 * time.Millisecond

// Loaders bundles every batching loader used by graph/*.resolvers.go, one
// field of which corresponds to one entry in the Node server's
// server/src/types.ts Context interface.
type Loaders struct {
	Product *dataloadgen.Loader[string, *models.Product]

	Order          *dataloadgen.Loader[string, *models.Order]
	OrderIDsByUser *dataloadgen.Loader[string, []string]

	Address          *dataloadgen.Loader[string, *models.Address]
	AddressIDsByUser *dataloadgen.Loader[string, []string]

	UserProduct          *dataloadgen.Loader[string, *models.UserProduct]
	UserProductIDsByUser *dataloadgen.Loader[string, []string]

	OrderProduct           *dataloadgen.Loader[string, *models.OrderProduct]
	OrderProductIDsByOrder *dataloadgen.Loader[string, []string]

	Image             *dataloadgen.Loader[string, *models.ProductImage]
	ImageIDsByProduct *dataloadgen.Loader[string, []string]

	Category             *dataloadgen.Loader[string, *models.Category]
	CategoryIDsByProduct *dataloadgen.Loader[string, []string]
}

// New builds a fresh set of loaders, scoped to a single request — matching
// the fresh `create*Loader()` calls in the Apollo `context` function in
// server/src/index.ts. Never share a Loaders across requests: each one
// caches for as long as it lives.
func New(db *gorm.DB) *Loaders {
	wait := dataloadgen.WithWait(batchWait)
	return &Loaders{
		Product: dataloadgen.NewLoader(byIDFetch[models.Product](db), wait),

		Order:          dataloadgen.NewLoader(byIDFetch[models.Order](db), wait),
		OrderIDsByUser: dataloadgen.NewLoader(idsByParentFetch(db, "orders", "user_id", "id"), wait),

		Address:          dataloadgen.NewLoader(byIDFetch[models.Address](db), wait),
		AddressIDsByUser: dataloadgen.NewLoader(idsByParentFetch(db, "addresses", "user_id", "id"), wait),

		UserProduct:          dataloadgen.NewLoader(byIDFetch[models.UserProduct](db), wait),
		UserProductIDsByUser: dataloadgen.NewLoader(idsByParentFetch(db, "user_products", "user_id", "id"), wait),

		OrderProduct:           dataloadgen.NewLoader(byIDFetch[models.OrderProduct](db), wait),
		OrderProductIDsByOrder: dataloadgen.NewLoader(idsByParentFetch(db, "order_products", "order_id", "id"), wait),

		Image:             dataloadgen.NewLoader(byIDFetch[models.ProductImage](db), wait),
		ImageIDsByProduct: dataloadgen.NewLoader(idsByParentFetch(db, "product_images", "product_id", "id"), wait),

		// Unlike the other idsByParent loaders, this one collects the join
		// row's category_id, not its own id — matches
		// createCategoryIdsByProductLoader's `.map(pc => pc.categoryId)`.
		Category:             dataloadgen.NewLoader(byIDFetch[models.Category](db), wait),
		CategoryIDsByProduct: dataloadgen.NewLoader(idsByParentFetch(db, "product_categories", "product_id", "category_id"), wait),
	}
}
