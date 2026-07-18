package soter

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newTestClient points a Client at the given test server URL.
func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()
	c, err := New("ck_test_key", WithBaseURL(baseURL), WithTimeout(2*time.Second))
	if err != nil {
		t.Fatalf("New: unexpected error: %v", err)
	}
	return c
}

func TestNewRequiresAPIKey(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("expected error for empty API key, got nil")
	}
	if _, err := New("   "); err == nil {
		t.Fatal("expected error for whitespace API key, got nil")
	}
}

func TestGuardCalls(t *testing.T) {
	type tc struct {
		name         string
		method       string // "input" or "output"
		status       int
		respBody     any
		respHeaders  map[string]string
		wantPath     string
		wantBodyKey  string // JSON key the request body must contain
		wantErr      bool
		wantAllowed  bool
		wantAction   Action
		checkErr     func(t *testing.T, err error)
		wantCallLLM  bool
	}

	tests := []tc{
		{
			name:        "allow input",
			method:      "input",
			status:      200,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody: GuardResult{
				Allowed: true, Action: ActionAllow, RiskScore: 3,
				RiskTypes: []string{}, Reason: "clean",
			},
			wantAllowed: true, wantAction: ActionAllow, wantCallLLM: true,
		},
		{
			name:        "allow with redaction exposes safe text",
			method:      "output",
			status:      200,
			wantPath:    "/api/guard/output",
			wantBodyKey: "aiResponse",
			respBody: GuardResult{
				Allowed: true, Action: ActionAllowWithRedaction, RiskScore: 40,
				RiskTypes: []string{"PII"}, SafeText: "my ssn is [REDACTED]",
			},
			wantAllowed: true, wantAction: ActionAllowWithRedaction, wantCallLLM: true,
		},
		{
			name:        "block input",
			method:      "input",
			status:      200,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody: GuardResult{
				Allowed: false, Action: ActionBlock, RiskScore: 95,
				RiskTypes: []string{"PROMPT_INJECTION"}, Reason: "injection detected",
				Findings: []Finding{{Type: "PROMPT_INJECTION", Severity: "CRITICAL", Score: 95}},
			},
			wantAllowed: false, wantAction: ActionBlock, wantCallLLM: false,
		},
		{
			name:        "auth error 401",
			method:      "input",
			status:      401,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody:    map[string]any{"message": "invalid api key"},
			wantErr:     true,
			checkErr: func(t *testing.T, err error) {
				var apiErr *APIError
				if !errors.As(err, &apiErr) {
					t.Fatalf("expected *APIError, got %T (%v)", err, err)
				}
				if !apiErr.IsAuth() {
					t.Errorf("expected IsAuth() true, got false")
				}
				if apiErr.Message != "invalid api key" {
					t.Errorf("expected server message, got %q", apiErr.Message)
				}
			},
		},
		{
			name:        "forbidden 403 is auth",
			method:      "input",
			status:      403,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody:    map[string]any{"message": "forbidden"},
			wantErr:     true,
			checkErr: func(t *testing.T, err error) {
				var apiErr *APIError
				if !errors.As(err, &apiErr) || !apiErr.IsAuth() {
					t.Fatalf("expected auth APIError, got %v", err)
				}
			},
		},
		{
			name:        "rate limit 429 exposes retry-after",
			method:      "input",
			status:      429,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody:    map[string]any{"message": "slow down"},
			respHeaders: map[string]string{"Retry-After": "12"},
			wantErr:     true,
			checkErr: func(t *testing.T, err error) {
				var apiErr *APIError
				if !errors.As(err, &apiErr) {
					t.Fatalf("expected *APIError, got %T", err)
				}
				if !apiErr.IsRateLimit() {
					t.Errorf("expected IsRateLimit() true")
				}
				if apiErr.RetryAfter == nil || *apiErr.RetryAfter != 12 {
					t.Errorf("expected RetryAfter=12, got %v", apiErr.RetryAfter)
				}
			},
		},
		{
			name:        "validation 400",
			method:      "input",
			status:      400,
			wantPath:    "/api/guard/input",
			wantBodyKey: "message",
			respBody:    map[string]any{"message": "message is required"},
			wantErr:     true,
			checkErr: func(t *testing.T, err error) {
				var apiErr *APIError
				if !errors.As(err, &apiErr) || !apiErr.IsValidation() {
					t.Fatalf("expected validation APIError, got %v", err)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost {
					t.Errorf("expected POST, got %s", r.Method)
				}
				if r.URL.Path != tt.wantPath {
					t.Errorf("expected path %s, got %s", tt.wantPath, r.URL.Path)
				}
				if got := r.Header.Get("x-api-key"); got != "ck_test_key" {
					t.Errorf("expected x-api-key header, got %q", got)
				}
				if ct := r.Header.Get("Content-Type"); ct != "application/json" {
					t.Errorf("expected JSON content-type, got %q", ct)
				}
				var reqBody map[string]any
				if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
					t.Errorf("decode request body: %v", err)
				}
				if _, ok := reqBody[tt.wantBodyKey]; !ok {
					t.Errorf("expected request body key %q, body=%v", tt.wantBodyKey, reqBody)
				}
				for k, v := range tt.respHeaders {
					w.Header().Set(k, v)
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.status)
				_ = json.NewEncoder(w).Encode(tt.respBody)
			}))
			defer srv.Close()

			c := newTestClient(t, srv.URL)

			var (
				res *GuardResult
				err error
			)
			switch tt.method {
			case "input":
				res, err = c.GuardInput(context.Background(), "hello")
			case "output":
				res, err = c.GuardOutput(context.Background(), "hi there")
			default:
				t.Fatalf("unknown method %q", tt.method)
			}

			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got result %+v", res)
				}
				if tt.checkErr != nil {
					tt.checkErr(t, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Allowed != tt.wantAllowed {
				t.Errorf("Allowed: want %v, got %v", tt.wantAllowed, res.Allowed)
			}
			if res.Action != tt.wantAction {
				t.Errorf("Action: want %s, got %s", tt.wantAction, res.Action)
			}
			if res.ShouldCallLLM() != tt.wantCallLLM {
				t.Errorf("ShouldCallLLM: want %v, got %v", tt.wantCallLLM, res.ShouldCallLLM())
			}
		})
	}
}

func TestContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"allowed":true,"action":"ALLOW"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	if _, err := c.GuardInput(ctx, "hello"); err == nil {
		t.Fatal("expected context deadline error, got nil")
	}
}

func TestSafeTextOr(t *testing.T) {
	r := &GuardResult{SafeText: "safe"}
	if got := r.SafeTextOr("orig"); got != "safe" {
		t.Errorf("want safe, got %q", got)
	}
	r = &GuardResult{RedactedText: "redacted"}
	if got := r.SafeTextOr("orig"); got != "redacted" {
		t.Errorf("want redacted, got %q", got)
	}
	r = &GuardResult{}
	if got := r.SafeTextOr("orig"); got != "orig" {
		t.Errorf("want orig, got %q", got)
	}
}
