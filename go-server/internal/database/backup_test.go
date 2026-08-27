package database

import (
	"testing"
	"time"
)

func TestParseBackupTime(t *testing.T) {
	cases := []struct {
		key     string
		want    time.Time
		wantErr bool
	}{
		{"backups/backup-2026-08-27-20-00-30.tar", time.Date(2026, 8, 27, 20, 0, 30, 0, time.UTC), false},
		{"backups/backup-2026-01-01-00-00-00.tar", time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), false},
		{"backups/not-a-backup.tar", time.Time{}, true},
	}
	for _, c := range cases {
		got, err := parseBackupTime(c.key)
		if c.wantErr {
			if err == nil {
				t.Errorf("parseBackupTime(%q): expected an error, got %v", c.key, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseBackupTime(%q): unexpected error: %v", c.key, err)
			continue
		}
		if !got.Equal(c.want) {
			t.Errorf("parseBackupTime(%q) = %v, want %v", c.key, got, c.want)
		}
	}
}

func TestBackupsToPrune(t *testing.T) {
	now := time.Date(2026, 8, 27, 12, 0, 0, 0, time.UTC)

	mk := func(daysAgo int) backupObject {
		t := now.AddDate(0, 0, -daysAgo)
		return backupObject{key: t.Format("backup-2006-01-02-15-04-05"), t: t}
	}

	t.Run("keeps everything within the daily window", func(t *testing.T) {
		backups := []backupObject{mk(0), mk(1), mk(29)}
		got := backupsToPrune(backups, now)
		if len(got) != 0 {
			t.Errorf("expected nothing pruned, got %v", got)
		}
	})

	t.Run("thins the weekly window to one per ISO week", func(t *testing.T) {
		// Two backups 40 and 41 days ago land in the same ISO week
		// (both past the 30-day daily window, both within 6 months) -
		// only the older of the pair should be pruned.
		older := mk(41)
		newer := mk(40)
		if y1, w1 := older.t.ISOWeek(); true {
			if y2, w2 := newer.t.ISOWeek(); y1 != y2 || w1 != w2 {
				t.Skip("test backups didn't land in the same ISO week, adjust offsets")
			}
		}
		got := backupsToPrune([]backupObject{older, newer}, now)
		if len(got) != 1 || got[0] != older.key {
			t.Errorf("expected only the older weekly duplicate pruned, got %v", got)
		}
	})

	t.Run("thins the monthly window to one per calendar month", func(t *testing.T) {
		older := time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC)
		newer := time.Date(2025, 1, 25, 0, 0, 0, 0, time.UTC)
		a := backupObject{key: "a", t: older}
		b := backupObject{key: "b", t: newer}
		got := backupsToPrune([]backupObject{a, b}, now)
		if len(got) != 1 || got[0] != a.key {
			t.Errorf("expected only the older monthly duplicate pruned, got %v", got)
		}
	})
}
