"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Loader2, Sparkles, Trash2, Compass, ShieldAlert } from "lucide-react";
import { ChatMarkdown } from "./ChatMarkdown";

type Message = {
  role: "user" | "assistant";
  content: string;
  variant?: "warning";
};

const STORAGE_KEY = "soterai-assistant-history";
const MAX_STORED_MESSAGES = 50;

type QuickAction = { label: string; prompt: string };

type PageContext = {
  welcome: string;
  section?: string;
  actions: QuickAction[];
};

// ── Default fallback context ──────────────────────────────────────────────
const DEFAULT_CONTEXT: PageContext = {
  welcome:
    "👋 Hi! I'm your SoterAI security assistant. I can help you understand features, troubleshoot issues, and optimize your security setup. What would you like to know?",
  actions: [
    { label: "How do I create an API key?", prompt: "How do I create an API key?" },
    { label: "What is prompt injection?", prompt: "What is prompt injection and how can I protect against it?" },
    { label: "Check security status", prompt: "Give me a quick summary of my security posture and any issues I should address." },
    { label: "How does Agent Firewall work?", prompt: "How does the Agent Firewall work step by step?" },
  ],
};

// ── Page-specific contexts keyed by pathname prefix ────────────────────────
const PAGE_CONTEXTS: Record<string, PageContext> = {
  // ═══ Landing & Marketing Pages ═══════════════════════════════════════════
  "/": {
    welcome: "👋 Welcome to SoterAI! I'm here to help you understand how we secure AI agents. What would you like to explore?",
    section: "Home",
    actions: [
      { label: "What is SoterAI?", prompt: "What is SoterAI and how does it help secure AI agents?" },
      { label: "Key features overview", prompt: "What are the key features of SoterAI?" },
      { label: "How does it work?", prompt: "How does SoterAI work to protect AI agents from security threats?" },
      { label: "Pricing information", prompt: "What are the pricing plans for SoterAI?" },
    ],
  },
  "/pricing": {
    welcome: "💳 Need help choosing a plan? I can explain the differences and help you pick the right tier.",
    section: "Pricing",
    actions: [
      { label: "Compare plans", prompt: "What are the differences between SoterAI pricing plans?" },
      { label: "Free tier features", prompt: "What's included in the free tier?" },
      { label: "Enterprise plan", prompt: "Tell me about the enterprise plan and custom pricing." },
      { label: "Cost savings", prompt: "How much can I save with SoterAI's cost firewall?" },
    ],
  },
  "/playground": {
    welcome: "🧪 Welcome to the Playground! Try different attack scenarios and see how SoterAI's Guard responds in real time.",
    section: "Playground",
    actions: [
      { label: "Try prompt injection", prompt: "Show me a prompt injection example in the playground." },
      { label: "Test PII detection", prompt: "Test how SoterAI detects and redacts PII." },
      { label: "Jailbreak example", prompt: "Show me a jailbreak attempt example." },
      { label: "How scoring works", prompt: "Explain the risk scoring system (0-100)." },
    ],
  },
  "/signin": {
    welcome: "🔑 Need help signing in? I can help with SSO setup, account issues, and more.",
    section: "Sign In",
    actions: [
      { label: "SSO setup help", prompt: "How do I set up SSO for my team?" },
      { label: "Forgot password", prompt: "I forgot my password, how do I reset it?" },
      { label: "Create an account", prompt: "How do I create a new SoterAI account?" },
      { label: "Need an invite", prompt: "How do I join an existing organization?" },
    ],
  },

  // ═══ Docs Pages ══════════════════════════════════════════════════════════
  "/docs": {
    welcome: "📚 Welcome to the docs! I can help you find the right guide, understand concepts, and integrate SoterAI.",
    section: "Documentation",
    actions: [
      { label: "Quickstart guide", prompt: "How do I get started with SoterAI quickly?" },
      { label: "Available integrations", prompt: "What frameworks and platforms does SoterAI integrate with?" },
      { label: "Service overview", prompt: "What security services does SoterAI offer?" },
      { label: "Best practices", prompt: "What are the best practices for AI agent security?" },
    ],
  },
  "/docs/quickstart": {
    welcome: "🚀 Getting started! I can walk you through the setup process step by step.",
    section: "Quickstart",
    actions: [
      { label: "Quickstart steps", prompt: "Walk me through the SoterAI quickstart step by step." },
      { label: "Install SDK", prompt: "How do I install the SoterAI SDK?" },
      { label: "First Guard setup", prompt: "How do I set up my first Guard rule?" },
      { label: "Next steps", prompt: "What should I do after the quickstart?" },
    ],
  },
  "/docs/services": {
    welcome: "🛡️ Browse our security services. I can help you understand each one and choose the right protection for your needs.",
    section: "Services",
    actions: [
      { label: "Which service do I need?", prompt: "I'm not sure which security service to use. Can you help me choose?" },
      { label: "Compare detect services", prompt: "Compare the detection services: Shadow AI, Red Team, Forensics, and Canary Network." },
      { label: "Protection overview", prompt: "What protection services does SoterAI offer?" },
      { label: "Compliance services", prompt: "What compliance and governance services are available?" },
    ],
  },
  "/docs/nextjs": {
    welcome: "⚛️ Next.js integration guide. I can help you set up the SoterAI SDK in your Next.js app.",
    section: "Next.js",
    actions: [
      { label: "Next.js setup", prompt: "How do I integrate SoterAI with Next.js?" },
      { label: "App Router setup", prompt: "How do I set up SoterAI with Next.js App Router?" },
      { label: "Middleware config", prompt: "How do I configure SoterAI middleware in Next.js?" },
      { label: "Server vs client", prompt: "How do SoterAI guards work with server and client components?" },
    ],
  },
  "/docs/express": {
    welcome: "🟢 Express.js integration. I'll help you add AI security middleware to your Express app.",
    section: "Express",
    actions: [
      { label: "Express setup", prompt: "How do I integrate SoterAI with Express.js?" },
      { label: "Middleware setup", prompt: "How do I add SoterAI as Express middleware?" },
      { label: "Route protection", prompt: "How do I protect specific Express routes with SoterAI?" },
      { label: "Error handling", prompt: "How does SoterAI handle errors in Express?" },
    ],
  },
  "/docs/python": {
    welcome: "🐍 Python SDK docs. I can help you integrate SoterAI into your Python AI applications.",
    section: "Python",
    actions: [
      { label: "Python setup", prompt: "How do I install and use the SoterAI Python SDK?" },
      { label: "FastAPI integration", prompt: "How do I integrate SoterAI with FastAPI?" },
      { label: "Async support", prompt: "Does the Python SDK support async operations?" },
      { label: "CLI usage", prompt: "How do I use the SoterAI CLI tool?" },
    ],
  },
  "/docs/rest-api": {
    welcome: "🔌 REST API reference. I can help you understand endpoints, authentication, and rate limits.",
    section: "REST API",
    actions: [
      { label: "Authentication", prompt: "How do I authenticate with the SoterAI REST API?" },
      { label: "Rate limits", prompt: "What are the SoterAI API rate limits?" },
      { label: "Guard endpoints", prompt: "What are the main Guard API endpoints?" },
      { label: "Webhook API", prompt: "How do I set up webhooks with the REST API?" },
    ],
  },
  "/docs/best-practices": {
    welcome: "⭐ Security best practices. I can help you harden your AI agent deployment.",
    section: "Best Practices",
    actions: [
      { label: "Production hardening", prompt: "What are the best practices for production AI security?" },
      { label: "Least privilege", prompt: "How do I implement least privilege for AI agents?" },
      { label: "Monitoring tips", prompt: "What should I monitor for AI security incidents?" },
      { label: "Incident response", prompt: "How should I respond to an AI security incident?" },
    ],
  },

  // ═══ Dashboard Pages ═════════════════════════════════════════════════════
  "/dashboard": {
    welcome: "👋 Welcome to your security dashboard! I can help you understand your posture, top threats, and recent activity at a glance.",
    section: "Dashboard",
    actions: [
      { label: "Summarize my posture", prompt: "Give me a quick summary of my security posture and any issues I should address." },
      { label: "Top threats detected", prompt: "What are the top threats detected recently in my environment?" },
      { label: "Recent activity", prompt: "Show me recent blocked requests and what triggered them." },
      { label: "Compliance status", prompt: "What is my current compliance status and what needs attention?" },
    ],
  },
  "/dashboard/agent-firewall": {
    welcome: "🛡️ Agent Firewall — controlling every tool call your AI agents make. How can I help?",
    section: "Agent Firewall",
    actions: [
      { label: "How it works", prompt: "How does the Agent Firewall work step by step?" },
      { label: "Approval workflow", prompt: "How do I set up human approval for high-risk actions?" },
      { label: "MONITOR vs BLOCK", prompt: "What's the difference between MONITOR and BLOCK mode?" },
      { label: "Best practices", prompt: "What are the best practices for configuring the Agent Firewall?" },
    ],
  },
  "/dashboard/rag": {
    welcome: "📚 RAG Security — protecting your document retrieval pipeline. What would you like to know?",
    section: "RAG Security",
    actions: [
      { label: "How RAG security works", prompt: "How does RAG Security scan and protect documents?" },
      { label: "Document scanning", prompt: "What types of threats does document scanning detect?" },
      { label: "Chunk-level guard", prompt: "How does the chunk-level guard work?" },
      { label: "Poisoning prevention", prompt: "How do I protect against RAG poisoning attacks?" },
    ],
  },
  "/dashboard/logs": {
    welcome: "📋 Guard Logs — complete audit trail of every security decision. Need help filtering or exporting?",
    section: "Guard Logs",
    actions: [
      { label: "How to filter logs", prompt: "How do I filter guard logs effectively?" },
      { label: "Export logs", prompt: "How do I export logs for SIEM integration?" },
      { label: "Retention settings", prompt: "How long are logs retained and how do I change it?" },
      { label: "Real-time streaming", prompt: "How do I set up real-time log streaming?" },
    ],
  },
  "/dashboard/policy": {
    welcome: "⚙️ Policy Engine — configure risk thresholds, actions, and modes for your security rules.",
    section: "Policy",
    actions: [
      { label: "Risk thresholds", prompt: "How do I configure risk thresholds for different threat types?" },
      { label: "MONITOR vs STRICT", prompt: "What's the difference between MONITOR, BALANCED, and STRICT modes?" },
      { label: "Allowlists", prompt: "How do I set up allowlists and blocklists?" },
      { label: "Time-based policies", prompt: "Can I set different policies for business hours?" },
    ],
  },
  "/dashboard/api-keys": {
    welcome: "🔑 API Keys management. I can help you create, rotate, and secure your keys.",
    section: "API Keys",
    actions: [
      { label: "Create an API key", prompt: "How do I create an API key?" },
      { label: "Rate limiting", prompt: "How do I set rate limits on API keys?" },
      { label: "Key rotation", prompt: "How do I rotate API keys securely?" },
      { label: "Best practices", prompt: "What are the best practices for API key security?" },
    ],
  },
  "/dashboard/settings": {
    welcome: "🔧 Settings — manage your organization, team members, and security preferences.",
    section: "Settings",
    actions: [
      { label: "SSO setup", prompt: "How do I set up SSO for my team?" },
      { label: "SCIM provisioning", prompt: "How does SCIM provisioning work?" },
      { label: "Team roles", prompt: "What team roles are available and what permissions do they have?" },
      { label: "Data retention", prompt: "How do I configure data retention settings?" },
    ],
  },
  "/dashboard/billing": {
    welcome: "💳 Billing & Plans. Need help understanding your bill or choosing a plan?",
    section: "Billing",
    actions: [
      { label: "Current plan", prompt: "What plan am I on and what features are included?" },
      { label: "Usage this month", prompt: "How much have I used this billing cycle?" },
      { label: "Upgrade plan", prompt: "How do I upgrade my plan?" },
      { label: "Invoice history", prompt: "How do I view past invoices?" },
    ],
  },
  "/dashboard/cost-firewall": {
    welcome: "💰 Cost Firewall — prevent runaway AI spending with budget controls and alerts.",
    section: "Cost Firewall",
    actions: [
      { label: "Set budgets", prompt: "How do I set monthly budgets for my projects?" },
      { label: "Hard limit mode", prompt: "How does hard limit mode work to block overspending?" },
      { label: "Anomaly alerts", prompt: "How do cost anomaly alerts work?" },
      { label: "Per-request costing", prompt: "How does per-request costing work?" },
    ],
  },
  "/dashboard/webhooks": {
    welcome: "🔔 Webhooks — send real-time security alerts to your Slack, PagerDuty, or custom endpoints.",
    section: "Webhooks",
    actions: [
      { label: "Setup webhook", prompt: "How do I set up a webhook?" },
      { label: "Available events", prompt: "What webhook events are available?" },
      { label: "HMAC verification", prompt: "How does HMAC-SHA256 webhook signing work?" },
      { label: "Retry policy", prompt: "How does webhook retry and delivery work?" },
    ],
  },
  "/dashboard/reports": {
    welcome: "📊 Reports & Compliance. I can help you generate reports and prepare for audits.",
    section: "Reports",
    actions: [
      { label: "Monthly report", prompt: "How do I generate a monthly security report?" },
      { label: "Schedule reports", prompt: "How do I schedule automated reports?" },
      { label: "White-label reports", prompt: "Can I generate white-label reports with my branding?" },
      { label: "Compliance overview", prompt: "What compliance standards does SoterAI support?" },
    ],
  },
  "/dashboard/evidence-vault": {
    welcome: "🏛️ Evidence Vault — automated evidence collection for SOC 2, ISO 27001, and custom audits.",
    section: "Evidence Vault",
    actions: [
      { label: "How it works", prompt: "How does the Evidence Vault collect audit evidence?" },
      { label: "SOC 2 mapping", prompt: "How is evidence mapped to SOC 2 controls?" },
      { label: "ISO 27001 mapping", prompt: "How is evidence mapped to ISO 27001 controls?" },
      { label: "Download evidence", prompt: "How do I download evidence packages?" },
    ],
  },
  "/dashboard/forensics": {
    welcome: "🔍 Forensics — investigate security incidents with session reconstruction and evidence packaging.",
    section: "Forensics",
    actions: [
      { label: "Session replay", prompt: "How do I replay a security incident session?" },
      { label: "Timeline view", prompt: "How does the forensic timeline view work?" },
      { label: "Export evidence", prompt: "How do I export forensic evidence for legal teams?" },
      { label: "Root cause analysis", prompt: "How does root cause analysis work in forensics?" },
    ],
  },
  "/dashboard/redteam": {
    welcome: "🎯 Red Team Lab — proactively test your defenses with 200+ attack scenarios.",
    section: "Red Team",
    actions: [
      { label: "Run a test", prompt: "How do I run a red team security test?" },
      { label: "Attack scenarios", prompt: "What attack scenarios are available in the Red Team Lab?" },
      { label: "Schedule campaigns", prompt: "How do I schedule automated red team campaigns?" },
      { label: "Review results", prompt: "How do I review and fix red team test results?" },
    ],
  },
  "/dashboard/shadow-ai": {
    welcome: "👻 Shadow AI — detect unauthorized AI tool usage across your organization.",
    section: "Shadow AI",
    actions: [
      { label: "How detection works", prompt: "How does Shadow AI detect unauthorized tools?" },
      { label: "Top tools found", prompt: "What are the most common shadow AI tools detected?" },
      { label: "Block tools", prompt: "How do I block unauthorized AI tools?" },
      { label: "Browser extension", prompt: "How does the Shadow AI browser extension work?" },
    ],
  },
  "/dashboard/canary-network": {
    welcome: "🕊️ Canary Network — deploy decoy tokens to detect data breaches early.",
    section: "Canary Network",
    actions: [
      { label: "Create a canary", prompt: "How do I create a canary token?" },
      { label: "How tokens work", prompt: "How do canary tokens help detect data breaches?" },
      { label: "Alert setup", prompt: "How do I get notified when a canary token is triggered?" },
      { label: "Deployment tips", prompt: "Where should I deploy canary tokens?" },
    ],
  },
  "/dashboard/semantic-egress": {
    welcome: "🚫 Semantic Egress — prevent AI agents from exfiltrating data through any output channel.",
    section: "Semantic Egress",
    actions: [
      { label: "How it works", prompt: "How does Semantic Egress prevent data exfiltration?" },
      { label: "Detection methods", prompt: "What types of data exfiltration can Semantic Egress detect?" },
      { label: "Encoded content", prompt: "Can it detect base64 or encoded data leakage?" },
      { label: "Configuration", prompt: "How do I configure Semantic Egress policies?" },
    ],
  },
  "/dashboard/intent-guard": {
    welcome: "🎯 Intent Guard — ensure your AI agents only take actions aligned with their intended purpose.",
    section: "Intent Guard",
    actions: [
      { label: "How it works", prompt: "How does Intent Guard classify agent actions?" },
      { label: "Set up policies", prompt: "How do I configure intent policies for my agents?" },
      { label: "Learning mode", prompt: "What is learning mode in Intent Guard?" },
      { label: "Example policies", prompt: "Can you give me examples of Intent Guard policies?" },
    ],
  },
  "/dashboard/memory-firewall": {
    welcome: "🧠 Memory Firewall — protect AI agent memory from corruption and data leakage.",
    section: "Memory Firewall",
    actions: [
      { label: "How it works", prompt: "How does the Memory Firewall protect agent memories?" },
      { label: "PII redaction", prompt: "How does it redact PII from agent memory?" },
      { label: "Poisoning detection", prompt: "How does it detect memory poisoning attacks?" },
      { label: "Isolation modes", prompt: "How does memory isolation work per session?" },
    ],
  },
  "/dashboard/mcp-drift": {
    welcome: "🔄 MCP Drift — monitor your Model Context Protocol servers for unauthorized changes.",
    section: "MCP Drift",
    actions: [
      { label: "How it works", prompt: "How does MCP Drift monitor server changes?" },
      { label: "Server fingerprinting", prompt: "How does MCP server fingerprinting work?" },
      { label: "Rollback support", prompt: "How do I roll back to a known-good server configuration?" },
      { label: "Supply chain risks", prompt: "How does MCP Drift protect against supply chain attacks?" },
    ],
  },
  "/dashboard/escrow": {
    welcome: "🔐 Transaction Escrow — require human approval before critical agent actions are executed.",
    section: "Transaction Escrow",
    actions: [
      { label: "How it works", prompt: "How does Transaction Escrow work?" },
      { label: "Approval rules", prompt: "How do I set up conditional approval rules?" },
      { label: "Timeout behavior", prompt: "What happens when an escrow request times out?" },
      { label: "Audit trail", prompt: "How are escrow decisions logged for audits?" },
    ],
  },
  "/dashboard/blast-radius": {
    welcome: "💥 Blast Radius — analyze the potential impact of a compromised AI agent.",
    section: "Blast Radius",
    actions: [
      { label: "How it works", prompt: "How does Blast Radius analysis work?" },
      { label: "Dependency mapping", prompt: "How does it map agent dependencies?" },
      { label: "Reduce risk", prompt: "How can I reduce my blast radius?" },
      { label: "Run analysis", prompt: "How do I run a blast radius analysis?" },
    ],
  },
  "/dashboard/lineage": {
    welcome: "🔗 Context Lineage — track where every piece of information in an AI response came from.",
    section: "Context Lineage",
    actions: [
      { label: "How it works", prompt: "How does Context Lineage track source attribution?" },
      { label: "Trust scoring", prompt: "How does source trust scoring work?" },
      { label: "Citation badges", prompt: "How do citation and verification badges work?" },
      { label: "Compliance exports", prompt: "How do I export lineage data for compliance?" },
    ],
  },
  "/dashboard/evaluations": {
    welcome: "🔬 SLM Evaluations — evaluate LLM output quality and safety. Need help running or interpreting evaluations?",
    section: "Evaluations",
    actions: [
      { label: "Run evaluation", prompt: "How do I run an SLM evaluation?" },
      { label: "Metrics explained", prompt: "What evaluation metrics does SoterAI measure?" },
      { label: "Hallucination detection", prompt: "How does hallucination detection work?" },
      { label: "Improve scores", prompt: "How can I improve my evaluation scores?" },
    ],
  },
  "/dashboard/badges": {
    welcome: "🏅 Security Badges — embed trust indicators in your product to show users your AI is protected.",
    section: "Badges",
    actions: [
      { label: "Get badge snippet", prompt: "How do I get the embed code for a security badge?" },
      { label: "Badge customization", prompt: "Can I customize the badge size and theme?" },
      { label: "Real-time status", prompt: "Does the badge show real-time protection status?" },
      { label: "Open source usage", prompt: "Can I use the badge in my open source project?" },
    ],
  },
  "/dashboard/dry-run": {
    welcome: "🧪 Dry Run Sandbox — test security policies safely before enforcing them in production.",
    section: "Dry Run Sandbox",
    actions: [
      { label: "How it works", prompt: "How does the Dry Run Sandbox work?" },
      { label: "Side-by-side compare", prompt: "How do I compare MONITOR vs BLOCK mode results?" },
      { label: "False positive review", prompt: "How do I review false positives in dry run?" },
      { label: "Gradual rollout", prompt: "How do I gradually roll out new policies?" },
    ],
  },
  "/dashboard/detection-feedback": {
    welcome: "📝 Detection Feedback — help improve threat detection by flagging incorrect decisions.",
    section: "Detection Feedback",
    actions: [
      { label: "Submit feedback", prompt: "How do I submit detection feedback?" },
      { label: "False positive", prompt: "How do I report a false positive?" },
      { label: "False negative", prompt: "How do I report a missed detection?" },
      { label: "Track progress", prompt: "How do I track my submitted feedback?" },
    ],
  },
  "/dashboard/onboarding": {
    welcome: "🎉 Welcome to SoterAI! Let me help you get set up and running in no time.",
    section: "Onboarding",
    actions: [
      { label: "Quickstart", prompt: "Walk me through the SoterAI setup process." },
      { label: "First guard", prompt: "How do I set up my first security guard?" },
      { label: "SDK installation", prompt: "How do I install the SoterAI SDK?" },
      { label: "Dashboard tour", prompt: "Give me a tour of the dashboard features." },
    ],
  },
  "/dashboard/get-started": {
    welcome: "🚀 Let's get you started! I can help you set up your first guard, install the SDK, or explore the dashboard.",
    section: "Get Started",
    actions: [
      { label: "Quickstart guide", prompt: "Walk me through the SoterAI setup process." },
      { label: "First guard", prompt: "How do I set up my first security guard?" },
      { label: "SDK installation", prompt: "How do I install the SoterAI SDK?" },
      { label: "Next steps", prompt: "What should I do after setting up SoterAI?" },
    ],
  },
  "/dashboard/integrations": {
    welcome: "🔌 Integrations — connect SoterAI with your existing tools and workflows.",
    section: "Integrations",
    actions: [
      { label: "Slack setup", prompt: "How do I integrate SoterAI with Slack?" },
      { label: "PagerDuty setup", prompt: "How do I set up PagerDuty alerts?" },
      { label: "Datadog setup", prompt: "How do I send metrics to Datadog?" },
      { label: "SIEM integration", prompt: "How do I export logs to my SIEM?" },
    ],
  },
  "/dashboard/privacy": {
    welcome: "🔐 Privacy (DPDP) — manage data subject requests, consent records, and privacy incidents.",
    section: "Privacy",
    actions: [
      { label: "DPDP compliance", prompt: "How does SoterAI help with DPDP compliance?" },
      { label: "Data subject requests", prompt: "How do I handle data subject access requests?" },
      { label: "Consent management", prompt: "How does consent recording work?" },
      { label: "Privacy incidents", prompt: "How do I manage privacy incidents?" },
    ],
  },
  "/dashboard/credentials": {
    welcome: "🔐 Credential Vault — securely store and manage credentials used by your AI agents.",
    section: "Credential Vault",
    actions: [
      { label: "Add credential", prompt: "How do I add a credential to the vault?" },
      { label: "Rotation policies", prompt: "How does credential rotation work?" },
      { label: "Access control", prompt: "How do I control who can access credentials?" },
      { label: "Audit logging", prompt: "How are credential accesses audited?" },
    ],
  },
  "/dashboard/exports": {
    welcome: "📦 Audit Exports — download security data in JSON, CSV, or NDJSON for external analysis.",
    section: "Audit Exports",
    actions: [
      { label: "Export format", prompt: "What export formats are available?" },
      { label: "Schedule exports", prompt: "Can I schedule automated exports?" },
      { label: "Data included", prompt: "What data is included in audit exports?" },
      { label: "Cryptographic signatures", prompt: "How does cryptographic signing of exports work?" },
    ],
  },
  "/dashboard/projects": {
    welcome: "📁 Projects — organize your security configuration across different projects and environments.",
    section: "Projects",
    actions: [
      { label: "Create project", prompt: "How do I create a new project?" },
      { label: "Environments", prompt: "How do I set up test and production environments?" },
      { label: "Project settings", prompt: "How do I configure project-level settings?" },
      { label: "Team access", prompt: "How do I manage team access per project?" },
    ],
  },
  "/dashboard/support": {
    welcome: "🎫 Support — submit tickets, check status, and get help from our team.",
    section: "Support",
    actions: [
      { label: "Submit a ticket", prompt: "How do I submit a support ticket?" },
      { label: "Ticket status", prompt: "How do I check my support ticket status?" },
      { label: "Response times", prompt: "What are the support response times?" },
      { label: "Knowledge base", prompt: "Where can I find more help resources?" },
    ],
  },
  "/dashboard/security": {
    welcome: "🛡️ Supply Chain Security — track AI bill of materials, plugin inventory, and supply chain risks.",
    section: "Supply Chain Security",
    actions: [
      { label: "AI BOM", prompt: "What is an AI Bill of Materials?" },
      { label: "Plugin inventory", prompt: "How does plugin inventory tracking work?" },
      { label: "Risk findings", prompt: "How do I review supply chain risk findings?" },
      { label: "Agent tools audit", prompt: "How do I audit agent tools and dependencies?" },
    ],
  },
  "/dashboard/agent-passports": {
    welcome: "🪪 Agent Passports — manage AI agent identities and authentication across your organization.",
    section: "Agent Passports",
    actions: [
      { label: "What are they?", prompt: "What are Agent Passports and how do they work?" },
      { label: "Create passport", prompt: "How do I create an agent passport?" },
      { label: "Rotation policy", prompt: "How do I configure passport rotation?" },
      { label: "Verification", prompt: "How are agent passports verified?" },
    ],
  },
  "/dashboard/legal-boundary": {
    welcome: "⚖️ Legal Boundary — enforce legal and regulatory constraints on AI agent behavior.",
    section: "Legal Boundary",
    actions: [
      { label: "How it works", prompt: "How does Legal Boundary constrain AI agents?" },
      { label: "Configure rules", prompt: "How do I configure legal boundary rules?" },
      { label: "Jurisdiction support", prompt: "What jurisdictions does Legal Boundary support?" },
      { label: "Audit trail", prompt: "How are legal boundary decisions audited?" },
    ],
  },
  "/dashboard/tool-chain": {
    welcome: "🔗 Tool Chain — monitor and control the chain of tool calls your AI agents make.",
    section: "Tool Chain",
    actions: [
      { label: "How it works", prompt: "How does Tool Chain monitoring work?" },
      { label: "Chain analysis", prompt: "How do I analyze tool call chains?" },
      { label: "Anomaly detection", prompt: "How are anomalous tool chains detected?" },
      { label: "Configuration", prompt: "How do I configure Tool Chain policies?" },
    ],
  },
  "/dashboard/customer-success": {
    welcome: "⭐ Customer Success — track usage metrics, health scores, and get recommendations.",
    section: "Customer Success",
    actions: [
      { label: "Usage metrics", prompt: "How do I view my usage metrics?" },
      { label: "Health score", prompt: "How is my account health score calculated?" },
      { label: "Recommendations", prompt: "What security improvements do you recommend?" },
      { label: "Adoption tips", prompt: "How can I get more value from SoterAI?" },
    ],
  },
  "/dashboard/enterprise": {
    welcome: "🏢 Enterprise — SSO, SCIM, data retention, and advanced security controls for large organizations.",
    section: "Enterprise",
    actions: [
      { label: "SSO setup", prompt: "How do I set up enterprise SSO with SAML?" },
      { label: "SCIM provisioning", prompt: "How does SCIM user provisioning work?" },
      { label: "Data retention", prompt: "How do I configure enterprise data retention?" },
      { label: "Security controls", prompt: "What enterprise security controls are available?" },
    ],
  },
  "/dashboard/partner": {
    welcome: "🤝 Partner Portal — manage your partnership, co-selling opportunities, and partner resources.",
    section: "Partner",
    actions: [
      { label: "Partner benefits", prompt: "What are the benefits of the SoterAI partner program?" },
      { label: "Co-selling", prompt: "How does co-selling with SoterAI work?" },
      { label: "Resources", prompt: "What partner resources and training are available?" },
      { label: "Support", prompt: "How do I get partner support?" },
    ],
  },
  "/dashboard/agency": {
    welcome: "🏢 Agency Portal — manage clients, white-label reports, and agency-specific settings.",
    section: "Agency",
    actions: [
      { label: "Client management", prompt: "How do I manage my agency's clients?" },
      { label: "White-label reports", prompt: "How do I generate white-label reports for clients?" },
      { label: "Multi-tenant setup", prompt: "How does multi-tenancy work for agencies?" },
      { label: "Billing", prompt: "How does agency billing work?" },
    ],
  },
};

// ── Context matcher ───────────────────────────────────────────────────────
function matchPageContext(pathname: string): PageContext {
  // Exact match first
  if (PAGE_CONTEXTS[pathname]) return PAGE_CONTEXTS[pathname];

  // Check /dashboard/* pages
  if (pathname.startsWith("/dashboard/")) {
    const dashSegment = "/dashboard/" + pathname.split("/")[2];
    if (PAGE_CONTEXTS[dashSegment]) return PAGE_CONTEXTS[dashSegment];
  }

  // Check /docs/* pages
  if (pathname.startsWith("/docs/")) {
    const docSegment = "/docs/" + pathname.split("/")[2];
    if (PAGE_CONTEXTS[docSegment]) return PAGE_CONTEXTS[docSegment];
  }

  // Check nested dashboard pages (e.g. /dashboard/rag/settings)
  if (pathname.startsWith("/dashboard/")) {
    for (const [prefix, ctx] of Object.entries(PAGE_CONTEXTS)) {
      if (prefix.startsWith("/dashboard/") && pathname.startsWith(prefix + "/")) {
        return ctx;
      }
    }
  }

  return DEFAULT_CONTEXT;
}

// ── Component ─────────────────────────────────────────────────────────────
export function AiAssistant() {
  const pathname = usePathname();
  const pageContext = matchPageContext(pathname);

  const [isOpen, setIsOpen] = useState(false);
  // Lazy initializer: read persisted messages from localStorage on first render.
  // Using a lazy initializer (function passed to useState) avoids calling setState
  // inside an effect, which causes cascading renders and a build error.
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Corrupt / unavailable storage — fall through to default.
    }
    return [{ role: "assistant", content: pageContext.welcome }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);


  // Persist conversation whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
      );
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    // Snapshot history (before adding the new user turn) for the request.
    const historyForRequest = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyForRequest,
          section: pageContext.section,
        }),
      });

      const isBlockedResponse =
        response.headers.get("X-Assistant-Blocked") === "true" ||
        response.status === 403;

      if (!response.ok) {
        if (isBlockedResponse) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              variant: "warning",
              content:
                "SoterAI blocked this prompt because it may contain unsafe instructions. Please rephrase your request and try again.",
            },
          ]);
          return;
        }
        throw new Error("Failed to get response");
      }

      if (!response.body) throw new Error("Response body is missing");

      // Open an empty assistant bubble, then stream tokens into it.
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          variant: isBlockedResponse ? "warning" : undefined,
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: "assistant",
            content: accumulated,
            variant: isBlockedResponse ? "warning" : undefined,
          };
          return next;
        });
      }

      if (!accumulated.trim()) {
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: "assistant",
            content: "Sorry, I couldn't generate a response. Please try again.",
          };
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickAction(prompt: string) {
    sendMessage(prompt);
  }

  function resetConversation() {
    const ctx = matchPageContext(pathname);
    setMessages([{ role: "assistant", content: ctx.welcome }]);
    setInput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  const activeActions = pageContext.actions;

  if (!isMounted) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[72px] right-5 z-30 flex items-center gap-2 rounded-full bg-cyan p-4 text-ink shadow-lg shadow-cyan/20 transition hover:bg-cyan/90 hover:scale-105 hover:shadow-xl hover:shadow-cyan/30 lg:right-8"
          aria-label="Open AI assistant"
        >
          <Bot size={22} />
          <span className="hidden text-sm font-semibold sm:inline">AI Help</span>
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-[400px] flex-col rounded-2xl border border-slate-700 bg-panel shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-6 sm:right-6">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-700 bg-slate-900/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-cyan/10 p-1.5 text-cyan">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">SoterAI Assistant</p>
                <p className="text-[10px] text-slate-500">AI Security Help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetConversation}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-red-400"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close AI assistant"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Page context indicator */}
          {pageContext.section && messages.length <= 1 && (
            <div className="flex items-center gap-1.5 border-b border-slate-800/50 px-4 py-2">
              <Compass size={11} className="text-cyan" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-cyan/70">
                {pageContext.section}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "min(60vh, 500px)" }}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-cyan text-ink"
                        : msg.variant === "warning"
                          ? "border border-amber-500/40 bg-amber-950/40 text-amber-100"
                        : "border border-slate-700 bg-slate-900/60 text-slate-200"
                    }`}
                  >
                    {msg.variant === "warning" && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <ShieldAlert size={14} aria-hidden="true" />
                        <span>Security warning</span>
                      </div>
                    )}
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.content ? (
                      <ChatMarkdown content={msg.content} />
                    ) : (
                      <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-cyan/70 align-middle" />
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator — only until the first streamed token arrives */}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spinner" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick actions (shown only at start) */}
          {messages.length === 1 && !loading && (
            <div className="border-t border-slate-800 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Quick actions for this page
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan/30 hover:bg-cyan/5 hover:text-cyan"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="input flex-1 rounded-xl py-2.5 text-sm"
                disabled={loading}
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-xl bg-cyan p-2.5 text-ink transition hover:bg-cyan/90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spinner" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
