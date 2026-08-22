package main

import (
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestDurationEnv(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	t.Setenv("TEST_DURATION", "20s")
	if got := durationEnv("TEST_DURATION", 30*time.Second, logger); got != 20*time.Second {
		t.Fatalf("duration = %s, want 20s", got)
	}

	t.Setenv("TEST_DURATION", "not-a-duration")
	if got := durationEnv("TEST_DURATION", 30*time.Second, logger); got != 30*time.Second {
		t.Fatalf("invalid duration fallback = %s, want 30s", got)
	}

	t.Setenv("TEST_DURATION", "0s")
	if got := durationEnv("TEST_DURATION", 30*time.Second, logger); got != 30*time.Second {
		t.Fatalf("non-positive duration fallback = %s, want 30s", got)
	}
}
