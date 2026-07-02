import type { AdminPolicyTemplate } from "./types";

export const AI_DESTINATION_PRESETS = [
  { key: "all_ai_tools", label: "All AI tools", domains: ["*"] },
  { key: "chatgpt", label: "ChatGPT", domains: ["chatgpt.com", "chat.openai.com"] },
  { key: "claude", label: "Claude", domains: ["claude.ai"] },
  { key: "gemini", label: "Gemini", domains: ["gemini.google.com", "bard.google.com"] },
  { key: "perplexity", label: "Perplexity", domains: ["perplexity.ai"] },
  { key: "poe", label: "Poe", domains: ["poe.com"] },
  { key: "openrouter", label: "OpenRouter", domains: ["openrouter.ai"] },
  { key: "unknown_ai", label: "Unknown AI websites", domains: ["unknown"] },
  { key: "enterprise_ai_only", label: "Approved enterprise AI only", domains: ["enterprise-approved"] },
];

export const DEFAULT_FILE_NAME_KEYWORDS = ["salary", "payroll", "contract", "investor", "roadmap", "database", "export", "customer-list"];

export const POLICY_TEMPLATES: AdminPolicyTemplate[] = [
  template("block-api-keys-secrets", "Block API keys and secrets", "Stops generic API keys, access tokens, and secret assignments from leaving the organization.", "Secrets", "critical", "block", ["api_key", "secret"]),
  template("block-passwords-private-keys", "Block passwords and private keys", "Blocks password values and private key material.", "Secrets", "critical", "block", ["password", "private_key"]),
  template("block-jwt-tokens", "Block JWT tokens", "Blocks bearer-style JWTs that may grant application access.", "Secrets", "high", "block", ["jwt"]),
  template("block-aws-keys", "Block AWS keys", "Blocks AWS access key IDs and related cloud credentials.", "Secrets", "critical", "block", ["aws_access_key"]),
  template("block-github-tokens", "Block GitHub tokens", "Blocks GitHub personal, app, and workflow tokens.", "Secrets", "critical", "block", ["github_token"]),
  template("block-slack-tokens", "Block Slack tokens", "Blocks Slack bot, user, and app tokens.", "Secrets", "critical", "block", ["slack_token"]),
  template("block-database-urls", "Block database URLs", "Blocks database connection strings and embedded credentials.", "Secrets", "critical", "block", ["database_url"]),
  template("redact-email-addresses", "Redact email addresses", "Replaces email addresses before prompts are sent.", "PII", "medium", "redact", ["email"]),
  template("redact-phone-numbers", "Redact phone numbers", "Replaces phone numbers before prompts are sent.", "PII", "medium", "redact", ["phone_number"]),
  template("block-aadhaar", "Block Aadhaar-like numbers", "Blocks Aadhaar-like identifiers.", "India PII", "critical", "block", ["aadhaar"]),
  template("block-pan", "Block PAN numbers", "Blocks Indian PAN identifiers.", "India PII", "high", "block", ["pan"]),
  template("block-gstin", "Block GSTIN", "Blocks GST registration identifiers.", "India PII", "high", "block", ["gstin"]),
  template("block-upi", "Block UPI IDs", "Blocks UPI payment identifiers.", "India PII", "medium", "block", ["upi_id"]),
  template("block-ifsc", "Block IFSC codes", "Blocks Indian bank IFSC codes.", "India PII", "medium", "block", ["ifsc"]),
  template("warn-source-code", "Warn on source code sharing", "Warns when code-like snippets are shared with AI tools.", "Code", "medium", "warn", ["source_code"]),
  template("approval-source-code", "Require approval for source code sharing", "Requires approval before source code can be sent.", "Code", "high", "require_approval", ["source_code"], false),
  template("block-database-exports", "Block database exports", "Blocks prompts or files that look like database exports.", "Business Data", "critical", "block", ["database_export", "database", "export"]),
  template("block-production-logs", "Block production logs", "Blocks production logs and stack traces.", "Operations", "high", "block", ["production_logs"]),
  template("block-customer-data", "Block customer data", "Blocks customer records, account lists, and customer identifiers.", "Customer Data", "critical", "block", ["customer_data"]),
  template("approval-customer-data", "Require approval for customer data", "Requires approval when customer data is detected.", "Customer Data", "high", "require_approval", ["customer_data"], false),
  template("rewrite-legal-contracts", "Rewrite legal/contract text safely", "Rewrites legal or contract excerpts into safer summaries.", "Legal", "medium", "rewrite", ["legal_contract"]),
  template("block-hr-salary", "Block HR and salary data", "Blocks salary, compensation, and employee review content.", "HR", "critical", "block", ["hr_salary"]),
  template("block-finance-accounting", "Block finance/accounting data", "Blocks finance, accounting, budget, and revenue data.", "Finance", "critical", "block", ["financial_text"]),
  template("block-roadmap-strategy", "Block internal roadmap or strategy data", "Blocks roadmap, launch, and strategy material.", "Strategy", "high", "block", ["internal_roadmap", "strategy"]),
  template("block-investor-fundraising", "Block investor/fundraising data", "Blocks fundraising, valuation, investor, and cap table data.", "Finance", "critical", "block", ["investor_data", "fundraising"]),
  template("detect-prompt-injection", "Detect prompt injection in pasted/uploaded content", "Detects hostile instructions embedded in text or uploaded content.", "Prompt Security", "high", "warn", ["prompt_injection"]),
  template("detect-jailbreaks", "Detect jailbreak attempts", "Detects jailbreak attempts and safety bypass wording.", "Prompt Security", "high", "block", ["jailbreak", "prompt_injection"]),
  template("scan-llm-responses", "Scan LLM responses", "Scans responses from AI websites for risky content.", "Response Security", "medium", "warn", ["llm_response"], false),
  template("block-unknown-ai", "Block unknown AI websites", "Blocks destinations that are not approved or recognized.", "Destination", "high", "block", ["unknown_ai"]),
  template("allow-enterprise-ai-only", "Allow approved enterprise AI tools only", "Allows only approved enterprise AI destinations.", "Destination", "critical", "block", ["unapproved_destination"], false),
];

function template(
  key: string,
  name: string,
  description: string,
  category: string,
  defaultSeverity: AdminPolicyTemplate["defaultSeverity"],
  defaultAction: AdminPolicyTemplate["defaultAction"],
  detectorKeys: string[],
  enabledByDefault = true,
): AdminPolicyTemplate {
  return {
    id: key,
    key,
    name,
    description,
    category,
    defaultSeverity,
    defaultAction,
    detectorKeys,
    enabledByDefault,
  };
}
