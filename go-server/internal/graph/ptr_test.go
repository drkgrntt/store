package graph_test

// strp returns a pointer to s (nil for ""), for the optional string columns
// that are *string on the models so that "unset" is NULL, not "".
func strp(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// deref returns *p, or "" for nil.
func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
