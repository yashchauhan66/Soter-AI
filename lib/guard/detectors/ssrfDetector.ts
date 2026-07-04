import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── Private/internal IP requests ───────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|open|load|visit|browse|access|connect to|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:127\.0\.0\.\d{1,3}|localhost|0\.0\.0\.0)/i, label: "Localhost SSRF", message: "Request attempts to access localhost/loopback address.", severity: "HIGH", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|open|load|visit|browse|access|connect to|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3})/i, label: "Private network SSRF (10.x)", message: "Request attempts to access RFC 1918 private network (10.x.x.x).", severity: "HIGH", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|open|load|visit|browse|access|connect to|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/i, label: "Private network SSRF (172.16-31.x)", message: "Request attempts to access RFC 1918 private network (172.16-31.x.x).", severity: "HIGH", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|open|load|visit|browse|access|connect to|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:192\.168\.\d{1,3}\.\d{1,3})/i, label: "Private network SSRF (192.168.x)", message: "Request attempts to access RFC 1918 private network (192.168.x.x).", severity: "HIGH", score: 55 },

  // ── Cloud metadata endpoints ───────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?169\.254\.169\.254/i, label: "Cloud metadata SSRF", message: "Request targets cloud instance metadata endpoint (AWS/GCP/Azure).", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?metadata\.google\.internal/i, label: "GCP metadata SSRF", message: "Request targets Google Cloud metadata endpoint.", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:100\.100\.100\.200|instance-data)/i, label: "Cloud metadata variant SSRF", message: "Request targets cloud provider metadata endpoint variant.", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?169\.254\.170\.2/i, label: "ECS metadata SSRF", message: "Request targets AWS ECS task metadata endpoint.", severity: "CRITICAL", score: 55 },

  // ── Internal service discovery ─────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:kubernetes\.default|kube-dns|kube-system)/i, label: "Kubernetes internal SSRF", message: "Request targets Kubernetes internal services.", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?[a-z0-9-]+\.(?:internal|local|svc\.cluster\.local|consul|service)/i, label: "Internal service SSRF", message: "Request targets internal service discovery endpoints.", severity: "HIGH", score: 50 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:etcd|consul|vault|redis|elasticsearch|kibana|grafana|prometheus)(?::\d+|\.(?:internal|local|service))/i, label: "Infrastructure service SSRF", message: "Request targets internal infrastructure services.", severity: "CRITICAL", score: 55 },

  // ── IPv6 localhost ─────────────────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?\[?(?:::1|::ffff:127\.0\.0\.1|0:0:0:0:0:0:0:1)\]?/i, label: "IPv6 localhost SSRF", message: "Request uses IPv6 notation to access localhost.", severity: "HIGH", score: 55 },

  // ── IP obfuscation techniques ──────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:0x7f(?:0{6}|\.)|0177\.0+\.0+\.0*1|2130706433|017700000001)/i, label: "Obfuscated IP SSRF", message: "Request uses hex/octal/decimal IP encoding to obscure internal address.", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|access|curl|wget|http\.get)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:\d{8,10})\b/i, label: "Decimal IP SSRF", message: "Request uses decimal IP notation that may resolve to internal address.", severity: "HIGH", score: 45 },

  // ── File protocol ──────────────────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|navigate|open|load|access|read)\s*(?:the\s*)?(?:url\s*)?(?:file:\/\/)/i, label: "File protocol SSRF", message: "Request uses file:// protocol to access local filesystem.", severity: "CRITICAL", score: 55 },
  { pattern: /(?:fetch|get|call|request|navigate|open|load|access)\s*(?:the\s*)?(?:url\s*)?(?:gopher|dict|ldap|tftp|ftp):\/\//i, label: "Dangerous protocol SSRF", message: "Request uses a dangerous protocol (gopher/dict/ldap/tftp).", severity: "HIGH", score: 50 },

  // ── DNS rebinding patterns ─────────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|access)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:nip\.io|xip\.io|sslip\.io|localtest\.me|vcap\.me|lvh\.me)/i, label: "DNS rebinding SSRF", message: "Request uses a DNS rebinding service that may resolve to internal IPs.", severity: "HIGH", score: 50 },
  { pattern: /(?:fetch|get|call|request|access)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/)?(?:0\.0\.0\.0|127\.\d+\.\d+\.\d+|0177\.\d+)/i, label: "Zero/alternate localhost SSRF", message: "Request targets alternate localhost representations.", severity: "HIGH", score: 55 },

  // ── Redirect-based SSRF ────────────────────────────────────────────
  { pattern: /(?:fetch|get|call|request|access|follow)\s*(?:the\s*)?(?:url\s*)?(?:https?:\/\/[^\s]+)\s*(?:which (?:redirects?|forwards?) to|that (?:redirects?|points? to))\s*(?:https?:\/\/)?(?:127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|localhost|metadata)/i, label: "Redirect-based SSRF", message: "Request exploits URL redirects to access internal resources.", severity: "HIGH", score: 50 },

  // ── Webhook/callback to internal ───────────────────────────────────
  { pattern: /(?:webhook|callback|notify|ping|healthcheck)\s*(?:url|endpoint|address)\s*(?:=|:)\s*["']?(?:https?:\/\/)?(?:127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|localhost|0\.0\.0\.0|\[?::1\]?)/i, label: "Webhook internal SSRF", message: "Webhook/callback URL points to an internal address.", severity: "HIGH", score: 50 },

  // ── Import/include from internal ───────────────────────────────────
  { pattern: /(?:import|include|require|source|load)\s+(?:from\s+)?["'](?:https?:\/\/)?(?:127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|localhost)/i, label: "Import from internal SSRF", message: "Code import/include targets internal network resource.", severity: "HIGH", score: 50 },
];

export function ssrfDetector(text: string) {
  return detectPatterns(text, "SSRF_ATTEMPT", rules);
}
