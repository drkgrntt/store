package graph

import "net/url"

// flattenQuery matches `Object.fromEntries(query)` on a URLSearchParams:
// where a key repeats, the last value wins.
func flattenQuery(query url.Values) map[string]string {
	flat := make(map[string]string, len(query))
	for key, values := range query {
		if len(values) > 0 {
			flat[key] = values[len(values)-1]
		}
	}
	return flat
}

// floatOr/boolOr apply a default for a nullable GraphQL arg, matching TS
// default parameter values (e.g. `@Arg("page") page: number = 0`), which
// only apply when the argument is omitted entirely. page/perPage-style args
// are Float on the wire (see schema/product.graphqls for why), so this
// takes float64 rather than int even though callers immediately truncate
// to int for use as an offset/limit.
func floatOr(v *float64, def float64) float64 {
	if v == nil {
		return def
	}
	return *v
}

func boolOr(v *bool, def bool) bool {
	if v == nil {
		return def
	}
	return *v
}
