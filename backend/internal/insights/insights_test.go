package insights

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

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
		{question: "Why did rain reduce today's water?", language: "en", wantLang: "fallback (English)"},
		{question: "Zao langu liko katika hatua gani?", language: "sw", wantLang: "fallback (Kiswahili)"},
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
		if !strings.Contains(prompt.Messages[0].Content, "same language as the farmer's question") || !strings.Contains(prompt.Messages[0].Content, "supplied UI language") {
			t.Errorf("system prompt does not prioritize the question language: %s", prompt.Messages[0].Content)
		}
	}
	if prompts[0].Messages[1].Content == prompts[1].Messages[1].Content {
		t.Fatal("materially different questions produced identical user prompts")
	}
}

func TestCompatibleProviderUsesConfiguredTimeoutAndClassifiesIt(t *testing.T) {
	clientTransport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	provider := &CompatibleProvider{
		Endpoint: "https://provider.invalid", APIKey: "secret", Model: "model",
		Client: &http.Client{Transport: clientTransport, Timeout: 10 * time.Millisecond},
	}
	_, err := provider.Generate(context.Background(), domain.InsightRequest{Question: "Explain this"})
	var providerError *ProviderError
	if !errors.As(err, &providerError) || providerError.Kind != FailureTimeout {
		t.Fatalf("error = %v, want timeout ProviderError", err)
	}
	if providerError.Duration <= 0 || providerError.Duration > time.Second {
		t.Fatalf("duration = %s, want a short measured timeout", providerError.Duration)
	}
}

func TestCompatibleProviderBuildsClientWithConfiguredOrDefaultTimeout(t *testing.T) {
	if got := (&CompatibleProvider{Timeout: 20 * time.Second}).httpClient().Timeout; got != 20*time.Second {
		t.Fatalf("configured timeout = %s, want 20s", got)
	}
	if got := (&CompatibleProvider{}).httpClient().Timeout; got != DefaultTimeout {
		t.Fatalf("default timeout = %s, want %s", got, DefaultTimeout)
	}
}

func TestCompatibleProviderClassifiesHTTPAndResponseFailures(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       FailureKind
	}{
		{name: "provider HTTP", statusCode: http.StatusTooManyRequests, body: `rate limited`, want: FailureProviderHTTP},
		{name: "invalid response", statusCode: http.StatusOK, body: `{`, want: FailureResponseDecode},
		{name: "empty response", statusCode: http.StatusOK, body: `{"choices":[]}`, want: FailureEmptyResponse},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				header := make(http.Header)
				header.Set("X-Request-Id", "provider-request-123")
				return &http.Response{StatusCode: tc.statusCode, Header: header, Body: io.NopCloser(strings.NewReader(tc.body)), Request: r}, nil
			})}
			provider := &CompatibleProvider{Endpoint: "https://provider.invalid", APIKey: "secret", Model: "model", Client: client}
			_, err := provider.Generate(context.Background(), domain.InsightRequest{Question: "Explain this"})
			var providerError *ProviderError
			if !errors.As(err, &providerError) || providerError.Kind != tc.want {
				t.Fatalf("error = %v, want %s ProviderError", err, tc.want)
			}
			if providerError.StatusCode != tc.statusCode || providerError.RequestID != "provider-request-123" {
				t.Fatalf("provider error metadata = %+v", providerError)
			}
		})
	}
}

func TestCompatibleProviderLimitsHistory(t *testing.T) {
	history := make([]domain.InsightHistoryItem, 8)
	provider := &CompatibleProvider{Endpoint: "https://unused.invalid", APIKey: "secret", Model: "model"}
	if _, err := provider.Generate(context.Background(), domain.InsightRequest{History: history}); err == nil {
		t.Fatal("expected history validation error")
	}
}
