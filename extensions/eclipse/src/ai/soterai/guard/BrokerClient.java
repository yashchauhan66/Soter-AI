package ai.soterai.guard;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Thin HTTP client for the authenticated loopback Local AI Broker.
 *
 * <p>PLANNED / UNBUILT. Enforces the contract boundaries only: loopback base
 * URL, bearer auth on every path except {@code GET /health}, short timeouts.
 * All detection, redaction, and policy decisions come from the broker; this
 * class never inspects or classifies content itself, and it never logs the
 * bearer token.</p>
 */
public final class BrokerClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient http;
    private final String baseUrl;
    private final TokenSource tokenSource;

    public BrokerClient() {
        this(defaultBaseUrl(), TokenSource.defaultSource());
    }

    public BrokerClient(String baseUrl, TokenSource tokenSource) {
        this.http = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
        this.baseUrl = baseUrl;
        this.tokenSource = tokenSource;
    }

    private static String defaultBaseUrl() {
        String port = System.getenv().getOrDefault("SOTERAI_BROKER_PORT", "47321");
        return "http://127.0.0.1:" + port;
    }

    /** GET /health — the only unauthenticated endpoint. */
    public boolean health() {
        try {
            HttpResponse<String> response = send("GET", "/health", null, false);
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (BrokerException e) {
            return false;
        }
    }

    /** GET /v1/safe-mode/status. */
    public boolean safeModeEnabled() {
        Map<String, Object> body = getJson("/v1/safe-mode/status");
        return Json.bool(body, "enabled");
    }

    /** POST /v1/scan {content}. */
    public ScanResult scan(String content) {
        Map<String, Object> body = postJson("/v1/scan", Json.object("content", content));
        return new ScanResult(
                Json.string(body, "decision"),
                Json.integer(body, "riskScore"),
                Json.stringList(body, "categories"),
                Json.bool(body, "safe"),
                Json.string(body, "contentHash"),
                Json.string(body, "evidencePreview"));
    }

    /** POST /v1/redact {content} -> {redacted}. */
    public String redact(String content) {
        Map<String, Object> body = postJson("/v1/redact", Json.object("content", content));
        return Json.string(body, "redacted");
    }

    /**
     * POST /v1/preflight/network-egress — pre-send check against a destination.
     * {@code payloadPreview} is the text about to be sent, not a path to it.
     */
    public EgressDecision checkEgress(String url, String payloadPreview) {
        Map<String, Object> body = postJson(
                "/v1/preflight/network-egress",
                Json.object("url", url, "method", "POST", "payloadPreview", payloadPreview));
        return new EgressDecision(
                Json.string(body, "action"),
                Json.integer(body, "riskScore"),
                Json.string(body, "host"),
                Json.string(body, "explanation"),
                Json.stringList(body, "reasonCodes"));
    }

    private Map<String, Object> getJson(String path) {
        BrokerException failure;
        try {
            HttpResponse<String> response = send("GET", path, null, true);
            ensureOk(response);
            return Json.parseObject(response.body());
        } catch (BrokerException e) {
            failure = e;
        }
        throw failure;
    }

    private Map<String, Object> postJson(String path, String jsonBody) {
        HttpResponse<String> response = send("POST", path, jsonBody, true);
        ensureOk(response);
        return Json.parseObject(response.body());
    }

    private void ensureOk(HttpResponse<String> response) {
        int code = response.statusCode();
        if (code < 200 || code >= 300) {
            throw new BrokerException("Local broker returned HTTP " + code);
        }
    }

    private HttpResponse<String> send(String method, String path, String jsonBody, boolean authenticated) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "application/json");
            if (authenticated) {
                String token = tokenSource.token();
                if (token == null || token.isBlank()) {
                    throw new BrokerException(
                            "Local AI Broker token not found. Start the broker or set the token in "
                                    + "Eclipse Secure Storage / ~/.soterai/broker/auth-token.");
                }
                builder.header("Authorization", "Bearer " + token);
            }
            if (jsonBody == null) {
                builder.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                builder.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8));
            }
            return http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new BrokerException("Cannot reach Local AI Broker at " + baseUrl + " (is it running?)");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BrokerException("Local AI Broker request interrupted");
        }
    }

    /** Redacted, display-safe scan summary. Carries no raw content. */
    public record ScanResult(
            String decision,
            int riskScore,
            List<String> categories,
            boolean safe,
            String contentHash,
            String evidencePreview) {

        public String display() {
            StringBuilder sb = new StringBuilder();
            sb.append("Decision: ").append(decision.isBlank() ? "unknown" : decision);
            sb.append("  |  Risk: ").append(riskScore);
            sb.append("  |  Safe: ").append(safe);
            if (!categories.isEmpty()) {
                sb.append("\nCategories: ").append(String.join(", ", categories));
            }
            if (!contentHash.isBlank()) {
                sb.append("\nContent hash: ").append(contentHash);
            }
            if (!evidencePreview.isBlank()) {
                sb.append("\nRedacted evidence: ").append(evidencePreview);
            }
            return sb.toString();
        }
    }

    /**
     * Result of the pre-send egress preflight.
     *
     * <p>{@link #allowsSend()} excludes {@code ASK} on purpose: ASK means the
     * user has not answered yet, so treating it as clearance would turn a
     * confirmation prompt into a silent send. Mirrors {@code egressAllowsSend()}
     * in {@code @soterai/ide-protocol}.
     */
    public record EgressDecision(
            String action,
            int riskScore,
            String host,
            String explanation,
            List<String> reasonCodes) {

        private static final Set<String> SEND_OK =
                Set.of("ALLOW", "ALLOW_ONCE", "ALLOW_WITH_TRANSFORMATION");

        public boolean allowsSend() {
            return SEND_OK.contains(action);
        }

        public String display() {
            StringBuilder sb = new StringBuilder();
            sb.append(allowsSend() ? "Cleared to send" : "NOT cleared to send");
            sb.append("  |  Action: ").append(action.isBlank() ? "UNKNOWN" : action);
            if (!host.isBlank()) {
                sb.append("  |  Destination: ").append(host);
            }
            sb.append("  |  Risk: ").append(riskScore);
            if (!explanation.isBlank()) {
                sb.append("\n").append(explanation);
            }
            if (!reasonCodes.isEmpty()) {
                sb.append("\nReasons: ").append(String.join(", ", reasonCodes));
            }
            return sb.toString();
        }
    }

    /**
     * Resolves the broker bearer token. Preference order:
     * <ol>
     *   <li>Eclipse Secure Storage (wired in the real build via
     *       {@code org.eclipse.equinox.security}); the scaffold hands that in
     *       through a {@link TokenSource}.</li>
     *   <li>The broker's on-disk token file at
     *       {@code ~/.soterai/broker/auth-token}, which the broker writes.</li>
     * </ol>
     * The token is never written to the Eclipse log.
     */
    public interface TokenSource {
        String token();

        static TokenSource defaultSource() {
            return BrokerClient::readTokenFile;
        }
    }

    static String readTokenFile() {
        try {
            Path path = Paths.get(System.getProperty("user.home"), ".soterai", "broker", "auth-token");
            if (Files.isReadable(path)) {
                return Files.readString(path, StandardCharsets.UTF_8).trim();
            }
        } catch (IOException ignored) {
            // Fall through: treated as "no token configured".
        }
        return "";
    }

    public static final class BrokerException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public BrokerException(String message) {
            super(message);
        }
    }
}
