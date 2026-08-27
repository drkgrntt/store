// Package dataloaders ports server/src/dataloaders/*.ts: one batching,
// per-request loader per entity ("load by its own id") plus one per
// parent->children relationship ("load the child ids for a parent id"),
// used together by the GraphQL field resolvers that used to N+1 without
// them (see graph/*.resolvers.go).
//
// Each request gets a fresh Loaders (see New in dataloaders.go), matching
// the Apollo `context: async ({req, res}) => {... fresh loaders ...}`
// pattern in the Node server.
package dataloaders

import (
	"context"

	"gorm.io/gorm"
)

// idModel is satisfied by any model embedding models.Base, which is every
// model here — its GetID() lets byIDFetch map query results back onto the
// requested key order without per-entity boilerplate.
type idModel[T any] interface {
	*T
	GetID() string
}

// byIDFetch matches the create*Loader family (e.g. createProductLoader):
// look up every requested id in one query, then return results in the same
// order as the keys, with a nil entry for anything not found — mirroring
// `productIds.map(id => productMap[id])` returning `undefined` for misses.
func byIDFetch[T any, PT idModel[T]](db *gorm.DB) func(ctx context.Context, ids []string) ([]*T, []error) {
	return func(ctx context.Context, ids []string) ([]*T, []error) {
		errs := make([]error, len(ids))

		var rows []*T
		if err := db.WithContext(ctx).Where("id IN ?", ids).Find(&rows).Error; err != nil {
			for i := range errs {
				errs[i] = err
			}
			return make([]*T, len(ids)), errs
		}

		byID := make(map[string]*T, len(rows))
		for _, row := range rows {
			byID[PT(row).GetID()] = row
		}

		out := make([]*T, len(ids))
		for i, id := range ids {
			out[i] = byID[id]
		}
		return out, errs
	}
}

// idsByParentFetch matches the create*IdsBy*Loader family (e.g.
// createAddressIdsByUserLoader / createCategoryIdsByProductLoader): for
// each requested parent id, collect the `valueColumn` of every `table` row
// whose `parentColumn` matches. A parent with no matches resolves to an
// empty slice (not an error), matching the Node loaders' `|| []` fallback.
func idsByParentFetch(db *gorm.DB, table, parentColumn, valueColumn string) func(ctx context.Context, parentIDs []string) ([][]string, []error) {
	return func(ctx context.Context, parentIDs []string) ([][]string, []error) {
		type row struct {
			ParentID string
			Value    string
		}

		errs := make([]error, len(parentIDs))

		var rows []row
		err := db.WithContext(ctx).
			Table(table).
			Select(parentColumn+" AS parent_id", valueColumn+" AS value").
			Where(parentColumn+" IN ?", parentIDs).
			Find(&rows).Error
		if err != nil {
			for i := range errs {
				errs[i] = err
			}
			return make([][]string, len(parentIDs)), errs
		}

		byParent := make(map[string][]string, len(parentIDs))
		for _, r := range rows {
			byParent[r.ParentID] = append(byParent[r.ParentID], r.Value)
		}

		out := make([][]string, len(parentIDs))
		for i, id := range parentIDs {
			out[i] = byParent[id]
		}
		return out, errs
	}
}
