package insights

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"axis/backend/internal/domain"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return fn(request) }

func TestCompatibleProviderIsDisabledWithoutConfiguration(t *testing.T) {
	_, err := (&CompatibleProvider{}).Generate(context.Background(), domain.InsightRequest{})
	if err != ErrDisabled {
		t.Fatalf("error = %v, want disabled", err)
	}
}

func TestCompatibleProviderReturnsTextOnly(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Error("missing backend authorization")
		}
		return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"Rain explains most of today's reduction. Your logged applications have stayed close to AXIS advice."}}]}`)), Request: r}, nil
	})}
	provider := &CompatibleProvider{Endpoint: "https://provider.invalid", APIKey: "secret", Model: "insight-model", Client: client}
	result, err := provider.Generate(context.Background(), domain.InsightRequest{Language: "en", History: []domain.InsightHistoryItem{{Date: "2026-08-20", RecommendedLitres: 2400}}})
	if err != nil {
		t.Fatal(err)
	}
	if result.Summary == "" || result.Label != "AI-generated explanation" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestCompatibleProviderLimitsHistory(t *testing.T) {
	history := make([]domain.InsightHistoryItem, 8)
	provider := &CompatibleProvider{Endpoint: "https://unused.invalid", APIKey: "secret", Model: "model"}
	if _, err := provider.Generate(context.Background(), domain.InsightRequest{History: history}); err == nil {
		t.Fatal("expected history validation error")
	}
}
