// Package soter is the official Go client for the SoterAI guard API.
//
// It mirrors the JavaScript and Python SDKs: a small client with GuardInput and
// GuardOutput methods that call POST /api/guard/input and POST /api/guard/output
// with the "x-api-key" header, returning a typed GuardResult or a typed error.
//
// Basic usage:
//
//	guard, err := soter.New(os.Getenv("SOTER_API_KEY"))
//	if err != nil {
//		log.Fatal(err)
//	}
//	res, err := guard.GuardInput(ctx, "Ignore previous instructions...")
//	if err != nil {
//		log.Fatal(err)
//	}
//	if res.ShouldCallLLM() {
//		// safe to forward to the model
//	}
package soter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// DefaultBaseURL is the production SoterAI endpoint used when no base URL is set.
const DefaultBaseURL = "https://api.soterai.in"

// DefaultTimeout is the per-request timeout applied when the caller does not
// supply a custom *http.Client.
const DefaultTimeout = 8 * time.Second

// userAgent identifies the SDK to the server, matching the other SDKs' style.
const userAgent = "soter-go/0.1.0"

// Action is a guard verdict. The server returns one of the five constants below.
type Action string

// Guard actions. These match the API contract shared across all SoterAI SDKs.
const (
	ActionAllow              Action = "ALLOW"
	ActionAllowWithRedaction Action = "ALLOW_WITH_REDACTION"
	ActionRewrite            Action = "REWRITE"
	ActionHumanReview        Action = "HUMAN_REVIEW"
	ActionBlock              Action = "BLOCK"
)

// llmSafeActions are the verdicts under which it is safe to call the LLM,
// mirroring LLM_SAFE_ACTIONS in the Python SDK.
var llmSafeActions = map[Action]bool{
	ActionAllow:              true,
	ActionAllowWithRedaction: true,
	ActionRewrite:            true,
}

// Finding is a single detector finding inside a GuardResult.
type Finding struct {
	Type     string  `json:"type"`
	Label    string  `json:"label,omitempty"`
	Severity string  `json:"severity,omitempty"`
	Score    float64 `json:"score,omitempty"`
	Message  string  `json:"message,omitempty"`
	Matched  string  `json:"matched,omitempty"`
}

// GuardResult is the normalized result of an input or output guard call. It
// mirrors the API GuardResult contract used by the JS and Python SDKs.
type GuardResult struct {
	Allowed      bool      `json:"allowed"`
	Action       Action    `json:"action"`
	RiskScore    float64   `json:"riskScore"`
	RiskTypes    []string  `json:"riskTypes"`
	Reason       string    `json:"reason"`
	Findings     []Finding `json:"findings"`
	RedactedText string    `json:"redactedText,omitempty"`
	SafeText     string    `json:"safeText,omitempty"`
}

// ShouldCallLLM reports whether the verdict permits forwarding to the LLM.
// It matches should_call_llm in the Python SDK.
func (r *GuardResult) ShouldCallLLM() bool {
	return r.Allowed && llmSafeActions[r.Action]
}

// Blocked reports whether the request was denied or held for review.
func (r *GuardResult) Blocked() bool {
	return !r.Allowed || r.Action == ActionBlock || r.Action == ActionHumanReview
}

// SafeTextOr returns the guard's safe or redacted text if present, else original.
func (r *GuardResult) SafeTextOr(original string) string {
	if r.SafeText != "" {
		return r.SafeText
	}
	if r.RedactedText != "" {
		return r.RedactedText
	}
	return original
}

// APIError is returned for any non-2xx response. It carries the HTTP status and
// the server-provided message. Use IsAuth, IsRateLimit, and IsValidation (or
// errors.As) to branch on the failure kind.
type APIError struct {
	// StatusCode is the HTTP status returned by the server.
	StatusCode int
	// Message is the server's "message" field, or a generated fallback.
	Message string
	// RetryAfter is the parsed Retry-After header (seconds) on 429 responses.
	// It is nil when the header is absent or unparseable.
	RetryAfter *int
	// Body is the raw response body, retained for debugging.
	Body string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return fmt.Sprintf("soter: request failed with status %d: %s", e.StatusCode, e.Message)
}

// IsAuth reports whether the error is an authentication/authorization failure.
func (e *APIError) IsAuth() bool { return e.StatusCode == http.StatusUnauthorized || e.StatusCode == http.StatusForbidden }

// IsRateLimit reports whether the error is a rate-limit failure (HTTP 429).
func (e *APIError) IsRateLimit() bool { return e.StatusCode == http.StatusTooManyRequests }

// IsValidation reports whether the error is a request validation failure (HTTP 400).
func (e *APIError) IsValidation() bool { return e.StatusCode == http.StatusBadRequest }

// Option configures a Client. Pass options to New.
type Option func(*Client)

// WithBaseURL overrides the API base URL (trailing slashes are trimmed).
func WithBaseURL(baseURL string) Option {
	return func(c *Client) {
		if baseURL != "" {
			c.baseURL = strings.TrimRight(baseURL, "/")
		}
	}
}

// WithHTTPClient sets a custom *http.Client. When provided, WithTimeout is
// ignored (configure the timeout on your own client instead).
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
			c.ownClient = false
		}
	}
}

// WithTimeout sets the per-request timeout on the default HTTP client. It has no
// effect when combined with WithHTTPClient.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.timeout = d
	}
}

// WithHeader adds an extra header sent on every request. The x-api-key header is
// always managed by the client and cannot be overridden here.
func WithHeader(key, value string) Option {
	return func(c *Client) {
		c.extraHeaders[key] = value
	}
}

// Client is a SoterAI guard client. Create one with New and reuse it; it is safe
// for concurrent use by multiple goroutines.
type Client struct {
	apiKey       string
	baseURL      string
	timeout      time.Duration
	httpClient   *http.Client
	ownClient    bool
	extraHeaders map[string]string
}

// New creates a Client. apiKey is required; the key is sent only in the
// x-api-key header and never embedded elsewhere. Configure the base URL, HTTP
// client, timeout, and extra headers via options.
func New(apiKey string, opts ...Option) (*Client, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("soter: missing API key (pass it to New or read it from an env var; never embed it in client code)")
	}
	c := &Client{
		apiKey:       apiKey,
		baseURL:      DefaultBaseURL,
		timeout:      DefaultTimeout,
		ownClient:    true,
		extraHeaders: make(map[string]string),
	}
	for _, opt := range opts {
		opt(c)
	}
	if c.httpClient == nil {
		c.httpClient = &http.Client{Timeout: c.timeout}
	} else if c.ownClient {
		c.httpClient.Timeout = c.timeout
	}
	return c, nil
}

// GuardInput screens a user/inbound message before it reaches the model.
// It calls POST /api/guard/input with {"message": text}.
func (c *Client) GuardInput(ctx context.Context, text string) (*GuardResult, error) {
	return c.post(ctx, "/api/guard/input", map[string]any{"message": text})
}

// GuardOutput screens a model/outbound response before it reaches the user.
// It calls POST /api/guard/output with {"aiResponse": text}.
func (c *Client) GuardOutput(ctx context.Context, text string) (*GuardResult, error) {
	return c.post(ctx, "/api/guard/output", map[string]any{"aiResponse": text})
}

func (c *Client) post(ctx context.Context, path string, payload map[string]any) (*GuardResult, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("soter: encode request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("soter: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	for k, v := range c.extraHeaders {
		req.Header.Set(k, v)
	}
	// The API key only ever goes in x-api-key, set last so it cannot be overridden.
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("soter: request to %s failed: %w", path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("soter: read response body: %w", err)
	}

	return parseResponse(resp.StatusCode, resp.Header, respBody)
}

// parseResponse turns an HTTP response into a GuardResult or a typed *APIError.
func parseResponse(status int, header http.Header, body []byte) (*GuardResult, error) {
	if status >= 400 {
		return nil, newAPIError(status, header, body)
	}

	var result GuardResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("soter: decode response (status %d): %w", status, err)
	}
	return &result, nil
}

func newAPIError(status int, header http.Header, body []byte) *APIError {
	apiErr := &APIError{
		StatusCode: status,
		Body:       string(body),
		Message:    fmt.Sprintf("request failed with status %d", status),
	}

	// Prefer the server's "message" field when the body is JSON.
	var envelope struct {
		Message string `json:"message"`
		Error   string `json:"error"`
	}
	if len(body) > 0 && json.Unmarshal(body, &envelope) == nil {
		if envelope.Message != "" {
			apiErr.Message = envelope.Message
		} else if envelope.Error != "" {
			apiErr.Message = envelope.Error
		}
	}

	if status == http.StatusTooManyRequests {
		if ra := header.Get("Retry-After"); ra != "" {
			if secs, err := strconv.Atoi(strings.TrimSpace(ra)); err == nil {
				apiErr.RetryAfter = &secs
			}
		}
	}

	return apiErr
}
