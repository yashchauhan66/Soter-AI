// BrokerClient.cs
//
// Thin HTTP client for the SoterAI Local AI Broker (loopback only). This is the
// ONLY networking surface of the Visual Studio adapter. It adds no detection,
// redaction, or policy logic of its own -- those live entirely in the broker.
//
// STATUS: PLANNED / UNBUILT. This file is written to be idiomatic and
// compilable-looking, but it has NOT been compiled in this environment (no
// Visual Studio SDK / MSBuild available here). See docs/visual-studio-test-report.md.

using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace SoterAI.Guard.Broker
{
    /// <summary>
    /// Minimal authenticated client for the loopback Local AI Broker.
    /// The broker enforces auth, redacts its ledger, and is the trust boundary.
    /// </summary>
    public sealed class BrokerClient : IDisposable
    {
        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };

        private readonly HttpClient _http;
        private readonly Func<string> _tokenProvider;

        public BrokerClient(string baseUrl, Func<string> tokenProvider)
        {
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                baseUrl = "http://127.0.0.1:47321";
            }

            _http = new HttpClient
            {
                BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"),
                Timeout = TimeSpan.FromSeconds(20),
            };
            _http.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            _tokenProvider = tokenProvider ?? throw new ArgumentNullException(nameof(tokenProvider));
        }

        /// <summary>GET /health -- the only unauthenticated endpoint.</summary>
        public async Task<HealthResponse> GetHealthAsync(CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "health");
            return await SendAsync<HealthResponse>(request, authenticated: false, ct).ConfigureAwait(false);
        }

        /// <summary>GET /version.</summary>
        public async Task<VersionResponse> GetVersionAsync(CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "version");
            return await SendAsync<VersionResponse>(request, authenticated: true, ct).ConfigureAwait(false);
        }

        /// <summary>GET /v1/safe-mode/status.</summary>
        public async Task<SafeModeResponse> GetSafeModeAsync(CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "v1/safe-mode/status");
            return await SendAsync<SafeModeResponse>(request, authenticated: true, ct).ConfigureAwait(false);
        }

        /// <summary>POST /v1/scan { content } -> decision/riskScore/categories/...</summary>
        public async Task<ScanResponse> ScanAsync(string content, CancellationToken ct = default)
        {
            using var request = JsonRequest(HttpMethod.Post, "v1/scan", new ContentRequest { Content = content });
            return await SendAsync<ScanResponse>(request, authenticated: true, ct).ConfigureAwait(false);
        }

        /// <summary>POST /v1/redact { content } -> { redacted }. Redaction happens in the broker.</summary>
        public async Task<string> RedactAsync(string content, CancellationToken ct = default)
        {
            using var request = JsonRequest(HttpMethod.Post, "v1/redact", new ContentRequest { Content = content });
            var response = await SendAsync<RedactResponse>(request, authenticated: true, ct).ConfigureAwait(false);
            return response?.Redacted ?? string.Empty;
        }

        private HttpRequestMessage JsonRequest(HttpMethod method, string path, object body)
        {
            var json = JsonSerializer.Serialize(body, JsonOptions);
            return new HttpRequestMessage(method, path)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }

        private async Task<T> SendAsync<T>(HttpRequestMessage request, bool authenticated, CancellationToken ct)
        {
            if (authenticated)
            {
                var token = _tokenProvider();
                if (string.IsNullOrWhiteSpace(token))
                {
                    throw new BrokerException(
                        "No broker token configured. Set it in Tools > SoterAI IDE Guard or write the token file.");
                }

                // The token is attached only as a request header; never logged.
                request.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            }

            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, ct).ConfigureAwait(false);
            }
            catch (HttpRequestException ex)
            {
                throw new BrokerException(
                    $"Local AI Broker is unreachable at {_http.BaseAddress}. Is it running?", ex);
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    throw new BrokerException($"Broker returned HTTP {(int)response.StatusCode}.");
                }

                var payload = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (string.IsNullOrEmpty(payload))
                {
                    return default;
                }

                try
                {
                    return JsonSerializer.Deserialize<T>(payload, JsonOptions);
                }
                catch (JsonException ex)
                {
                    throw new BrokerException("Could not parse broker response as JSON.", ex);
                }
            }
        }

        public void Dispose() => _http.Dispose();
    }

    /// <summary>
    /// Resolves the broker token from the token file. The Visual Studio host has
    /// no single extension-scoped secret store, so by design the broker/OS owns
    /// the token; plaintext editor settings are not an accepted fallback.
    /// </summary>
    public static class BrokerToken
    {
        public static string ReadFromFile(string overridePath = null)
        {
            var path = string.IsNullOrWhiteSpace(overridePath)
                ? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    ".soterai", "broker", "auth-token")
                : overridePath;

            if (!File.Exists(path))
            {
                return string.Empty;
            }

            foreach (var line in File.ReadAllLines(path))
            {
                var trimmed = line.Trim();
                if (trimmed.Length > 0)
                {
                    return trimmed;
                }
            }

            return string.Empty;
        }
    }

    public sealed class ContentRequest
    {
        [JsonPropertyName("content")]
        public string Content { get; set; }
    }

    public sealed class ScanResponse
    {
        [JsonPropertyName("decision")]
        public string Decision { get; set; }

        [JsonPropertyName("riskScore")]
        public int RiskScore { get; set; }

        [JsonPropertyName("categories")]
        public string[] Categories { get; set; }

        [JsonPropertyName("redacted")]
        public bool Redacted { get; set; }

        [JsonPropertyName("contentHash")]
        public string ContentHash { get; set; }

        [JsonPropertyName("safe")]
        public bool Safe { get; set; }

        [JsonPropertyName("evidencePreview")]
        public string EvidencePreview { get; set; }

        public string DisplayText()
        {
            var sb = new StringBuilder();
            sb.Append("Decision: ").Append(string.IsNullOrWhiteSpace(Decision) ? "unknown" : Decision);
            sb.Append(" | Risk: ").Append(RiskScore);
            if (Categories != null && Categories.Length > 0)
            {
                sb.Append(" | Findings: ").Append(string.Join(", ", Categories));
            }

            if (!string.IsNullOrWhiteSpace(EvidencePreview))
            {
                sb.Append(Environment.NewLine).Append("Redacted evidence: ").Append(EvidencePreview);
            }

            return sb.ToString();
        }
    }

    public sealed class RedactResponse
    {
        [JsonPropertyName("redacted")]
        public string Redacted { get; set; }
    }

    public sealed class HealthResponse
    {
        [JsonPropertyName("status")]
        public string Status { get; set; }
    }

    public sealed class VersionResponse
    {
        [JsonPropertyName("version")]
        public string Version { get; set; }
    }

    public sealed class SafeModeResponse
    {
        [JsonPropertyName("enabled")]
        public bool Enabled { get; set; }

        [JsonPropertyName("level")]
        public string Level { get; set; }
    }

    public sealed class BrokerException : Exception
    {
        public BrokerException(string message) : base(message)
        {
        }

        public BrokerException(string message, Exception inner) : base(message, inner)
        {
        }
    }
}
