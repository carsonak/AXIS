package insights

import (
	"context"
	"encoding/json"
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
	result, err := provider.Generate(context.Background(), domain.InsightRequest{Question: "Why did rain reduce today's water?", Language: "en", History: []domain.InsightHistoryItem{{Date: "2026-08-20", RecommendedLitres: 2400}}})
	if err != nil {
		t.Fatal(err)
	}
	if result.Summary == "" || result.Label != "AI-generated explanation" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestCompatibleProviderIncludesDistinctQuestionsAndGuardrails(t *testing.T) {
	type providerPayload struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	var prompts []providerPayload
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var payload providerPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		prompts = append(prompts, payload)
		return &http.Response{StatusCode: http.StatusOK, Status: "200 OK", Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"Grounded answer."}}]}`)), Request: r}, nil
	})}
	provider := &CompatibleProvider{Endpoint: "https://provider.invalid", APIKey: "secret", Model: "insight-model", Client: client}
	cases := []struct {
		question string
		language string
		wantLang string
	}{
		{question: "Why did rain reduce today's water?", language: "en", wantLang: "plain English"},
		{question: "Zao langu liko katika hatua gani?", language: "sw", wantLang: "plain Kiswahili"},
	}
	for _, tc := range cases {
		if _, err := provider.Generate(context.Background(), domain.InsightRequest{Question: tc.question, Language: tc.language}); err != nil {
			t.Fatal(err)
		}
		prompt := prompts[len(prompts)-1]
		if len(prompt.Messages) != 2 {
			t.Fatalf("messages = %d, want 2", len(prompt.Messages))
		}
		if !strings.Contains(prompt.Messages[1].Content, tc.question) {
			t.Errorf("user prompt does not contain %q: %s", tc.question, prompt.Messages[1].Content)
		}
		for _, guardrail := range []string{"Use only the supplied deterministic", "Never calculate", "authoritative", tc.wantLang} {
			if !strings.Contains(prompt.Messages[0].Content, guardrail) {
				t.Errorf("system prompt missing %q: %s", guardrail, prompt.Messages[0].Content)
			}
		}
	}
	if prompts[0].Messages[1].Content == prompts[1].Messages[1].Content {
		t.Fatal("materially different questions produced identical user prompts")
	}
}

func TestCompatibleProviderLimitsHistory(t *testing.T) {
	history := make([]domain.InsightHistoryItem, 8)
	provider := &CompatibleProvider{Endpoint: "https://unused.invalid", APIKey: "secret", Model: "model"}
	if _, err := provider.Generate(context.Background(), domain.InsightRequest{History: history}); err == nil {
		t.Fatal("expected history validation error")
	}
}
