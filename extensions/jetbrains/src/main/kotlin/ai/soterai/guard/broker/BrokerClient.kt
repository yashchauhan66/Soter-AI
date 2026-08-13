package ai.soterai.guard.broker

import ai.soterai.guard.settings.BrokerSettings
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.components.service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

class BrokerClient(
    private val settings: BrokerSettings = service(),
    private val client: HttpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
) {
    fun health(): String = request("GET", "/health", null, authenticated = false)

    fun scan(content: String): ScanSummary {
        val json = request("POST", "/v1/scan", payload(content))
        val result = JsonParser.parseString(json).asJsonObject
        return ScanSummary(
            decision = result.string("decision"),
            riskScore = result.get("riskScore")?.asInt ?: 0,
            categories = result.getAsJsonArray("categories")?.map { it.asString }.orEmpty(),
            evidencePreview = result.string("evidencePreview"),
        )
    }

    fun redact(content: String): String {
        val result = JsonParser.parseString(request("POST", "/v1/redact", payload(content))).asJsonObject
        return result.string("redacted")
    }

    fun safeModeStatus(): Boolean {
        val result = JsonParser.parseString(request("GET", "/v1/safe-mode/status")).asJsonObject
        return result.get("enabled")?.asBoolean ?: false
    }

    fun setSafeMode(enabled: Boolean): Boolean {
        val path = if (enabled) "/v1/safe-mode/enable" else "/v1/safe-mode/disable"
        val body = if (enabled) "{\"level\":\"developer\"}" else "{}"
        val result = JsonParser.parseString(request("POST", path, body)).asJsonObject
        return result.get("enabled")?.asBoolean ?: false
    }

    fun recentEvents(): String = request("GET", "/v1/events/recent")

    /**
     * Pre-send egress check. [payloadPreview] is the text about to be
     * transmitted, not a path to it — the broker scans it for secrets.
     */
    fun checkEgress(url: String, payloadPreview: String): EgressDecision {
        val body = JsonObject()
        body.addProperty("url", url)
        body.addProperty("method", "POST")
        body.addProperty("payloadPreview", payloadPreview)
        val result = JsonParser.parseString(request("POST", "/v1/preflight/network-egress", body.toString())).asJsonObject
        return EgressDecision(
            action = result.string("action"),
            riskScore = result.get("riskScore")?.asInt ?: 0,
            host = result.string("host"),
            explanation = result.string("explanation"),
            reasonCodes = result.getAsJsonArray("reasonCodes")?.map { it.asString }.orEmpty(),
        )
    }

    private fun payload(content: String): String {
        val objectValue = JsonObject()
        objectValue.addProperty("content", content)
        return objectValue.toString()
    }

    private fun request(method: String, path: String, body: String?, authenticated: Boolean = true): String {
        val builder = HttpRequest.newBuilder(URI.create(settings.brokerUrl() + path))
            .timeout(Duration.ofSeconds(10))
            .header("Accept", "application/json")
        if (authenticated) {
            val token = settings.token()
            if (token.isBlank()) throw BrokerException("Configure the Local AI Broker token in Settings | SoterAI IDE Guard")
            builder.header("Authorization", "Bearer $token")
        }
        if (body == null) builder.method(method, HttpRequest.BodyPublishers.noBody())
        else builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body))
        val response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            throw BrokerException("Local broker returned HTTP ${response.statusCode()}")
        }
        return response.body()
    }

    private fun JsonObject.string(name: String): String = get(name)?.takeUnless { it.isJsonNull }?.asString.orEmpty()
}

data class ScanSummary(
    val decision: String,
    val riskScore: Int,
    val categories: List<String>,
    val evidencePreview: String,
) {
    fun displayText(): String = buildString {
        append("Decision: ").append(decision.ifBlank { "unknown" })
        append(" | Risk: ").append(riskScore)
        if (categories.isNotEmpty()) append(" | Categories: ").append(categories.joinToString(", "))
        if (evidencePreview.isNotBlank()) append("\nRedacted evidence: ").append(evidencePreview)
    }
}

class BrokerException(message: String) : RuntimeException(message)

/**
 * Result of the pre-send egress preflight.
 *
 * [allowsSend] excludes ASK on purpose: ASK means the user has not answered
 * yet, so treating it as clearance would turn a confirmation prompt into a
 * silent send. Mirrors `egressAllowsSend()` in @soterai/ide-protocol.
 */
data class EgressDecision(
    val action: String,
    val riskScore: Int,
    val host: String,
    val explanation: String,
    val reasonCodes: List<String>,
) {
    fun allowsSend(): Boolean = action in SEND_OK

    fun displayText(): String = buildString {
        append(if (allowsSend()) "Cleared to send" else "NOT cleared to send")
        append(" — ").append(action.ifBlank { "UNKNOWN" })
        if (host.isNotBlank()) append(" → ").append(host)
        append(" | Risk: ").append(riskScore)
        if (explanation.isNotBlank()) append("\n").append(explanation)
        if (reasonCodes.isNotEmpty()) append("\nReasons: ").append(reasonCodes.joinToString(", "))
    }

    companion object {
        private val SEND_OK = setOf("ALLOW", "ALLOW_ONCE", "ALLOW_WITH_TRANSFORMATION")
    }
}

