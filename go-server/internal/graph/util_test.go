package graph

import (
	"net/url"
	"testing"
)

func TestFloatOr(t *testing.T) {
	five := 5.0
	if got := floatOr(&five, 0); got != 5 {
		t.Errorf("floatOr(&5, 0) = %v, want 5", got)
	}
	if got := floatOr(nil, 20); got != 20 {
		t.Errorf("floatOr(nil, 20) = %v, want 20", got)
	}
}

func TestBoolOr(t *testing.T) {
	yes := true
	if got := boolOr(&yes, false); got != true {
		t.Errorf("boolOr(&true, false) = %v, want true", got)
	}
	if got := boolOr(nil, false); got != false {
		t.Errorf("boolOr(nil, false) = %v, want false", got)
	}
}

func TestFlattenQuery(t *testing.T) {
	q := url.Values{
		"modal":   {"detail"},
		"id":      {"abc-123"},
		"repeats": {"first", "second"},
	}
	flat := flattenQuery(q)

	if flat["modal"] != "detail" {
		t.Errorf(`flat["modal"] = %q, want "detail"`, flat["modal"])
	}
	if flat["id"] != "abc-123" {
		t.Errorf(`flat["id"] = %q, want "abc-123"`, flat["id"])
	}
	// Matches Object.fromEntries(searchParams): the last value for a
	// repeated key wins.
	if flat["repeats"] != "second" {
		t.Errorf(`flat["repeats"] = %q, want "second" (last value wins)`, flat["repeats"])
	}
	if len(flat) != 3 {
		t.Errorf("len(flat) = %d, want 3", len(flat))
	}
}
