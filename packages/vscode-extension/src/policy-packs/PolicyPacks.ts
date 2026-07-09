import * as vscode from "vscode";

export interface PolicyPack {
    id: string;
    name: string;
    description: string;
    protectedPatterns: string[];
    terminalRules: string[];
    mcpRules: string[];
    brokerRules: string[];
    memoryRules: string[];
    reportRetention: string;
    approvalBehavior: string;
    cloudEnabled: boolean;
}

export const POLICY_PACKS: PolicyPack[] = [
    {
        id: "personal",
        name: "Personal Developer",
        description: "Balanced protection for individual developers.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".aws/credentials"],
        terminalRules: ["warn_on_curl_pipe", "warn_on_rm_rf"],
        mcpRules: ["scan_all", "warn_shell"],
        brokerRules: ["local_only", "optional_cloud"],
        memoryRules: ["scan_instructions"],
        reportRetention: "30_days",
        approvalBehavior: "warn",
        cloudEnabled: false,
    },
    {
        id: "startup",
        name: "Startup",
        description: "Protection with team collaboration features.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".aws/credentials", "*.key"],
        terminalRules: ["warn_on_curl_pipe", "block_on_rm_rf", "warn_on_sudo"],
        mcpRules: ["scan_all", "warn_shell", "block_unknown"],
        brokerRules: ["local_only", "team_sync"],
        memoryRules: ["scan_instructions", "block_injection"],
        reportRetention: "90_days",
        approvalBehavior: "warn",
        cloudEnabled: true,
    },
    {
        id: "agency",
        name: "Agency",
        description: "Protection for client project work.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".aws/credentials", "*.key", "secrets.*"],
        terminalRules: ["warn_on_curl_pipe", "block_on_rm_rf", "block_on_sudo", "block_on_chmod"],
        mcpRules: ["scan_all", "block_shell", "block_unknown", "require_approval"],
        brokerRules: ["local_only", "audit_log"],
        memoryRules: ["scan_instructions", "block_injection", "block_unicode"],
        reportRetention: "180_days",
        approvalBehavior: "require_approval",
        cloudEnabled: false,
    },
    {
        id: "enterprise-strict",
        name: "Enterprise Strict",
        description: "Maximum protection for enterprise environments.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".pypirc", ".aws/credentials", "*.key", "*.p12", "secrets.*", "credentials.*", ".kube/config"],
        terminalRules: ["block_curl_pipe", "block_rm_rf", "block_sudo", "block_chmod", "require_approval"],
        mcpRules: ["scan_all", "block_shell", "block_unknown", "require_approval", "validate_schemas"],
        brokerRules: ["local_only", "enterprise_auth", "audit_log", "fail_closed"],
        memoryRules: ["scan_instructions", "block_injection", "block_unicode", "require_approval"],
        reportRetention: "1_year",
        approvalBehavior: "require_approval",
        cloudEnabled: true,
    },
    {
        id: "finance",
        name: "Finance",
        description: "Regulatory compliance for financial services.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".aws/credentials", "*.key", "secrets.*", "credentials.*", "*card*", "*account*"],
        terminalRules: ["block_curl_pipe", "block_rm_rf", "block_sudo", "require_approval"],
        mcpRules: ["scan_all", "block_shell", "require_approval"],
        brokerRules: ["local_only", "enterprise_auth", "audit_log", "fail_closed"],
        memoryRules: ["scan_instructions", "block_injection", "require_approval"],
        reportRetention: "7_years",
        approvalBehavior: "require_approval",
        cloudEnabled: true,
    },
    {
        id: "healthcare",
        name: "Healthcare",
        description: "HIPAA-aligned protection for healthcare data.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".aws/credentials", "*.key", "secrets.*", "credentials.*", "*patient*", "*phi*"],
        terminalRules: ["block_curl_pipe", "block_rm_rf", "block_sudo", "require_approval"],
        mcpRules: ["scan_all", "block_shell", "block_network", "require_approval"],
        brokerRules: ["local_only", "enterprise_auth", "audit_log", "fail_closed"],
        memoryRules: ["scan_instructions", "block_injection", "block_unicode", "require_approval"],
        reportRetention: "7_years",
        approvalBehavior: "require_approval",
        cloudEnabled: false,
    },
    {
        id: "india-dpdp",
        name: "India DPDP",
        description: "Digital Personal Data Protection Act compliance.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".aws/credentials", "*.key", "secrets.*", "*aadhaar*", "*pan*"],
        terminalRules: ["block_curl_pipe", "block_rm_rf", "block_sudo", "require_approval"],
        mcpRules: ["scan_all", "block_shell", "block_network", "require_approval"],
        brokerRules: ["local_only", "enterprise_auth", "audit_log", "fail_closed"],
        memoryRules: ["scan_instructions", "block_injection", "require_approval"],
        reportRetention: "5_years",
        approvalBehavior: "require_approval",
        cloudEnabled: false,
    },
    {
        id: "open-source",
        name: "Open Source Maintainer",
        description: "Protection for open source project maintainers.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc"],
        terminalRules: ["warn_on_curl_pipe", "warn_on_rm_rf"],
        mcpRules: ["scan_all", "warn_shell"],
        brokerRules: ["local_only"],
        memoryRules: ["scan_instructions"],
        reportRetention: "30_days",
        approvalBehavior: "warn",
        cloudEnabled: false,
    },
    {
        id: "ai-agent-dev",
        name: "AI Agent Developer",
        description: "Enhanced protection for AI agent and MCP tool development.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".aws/credentials", "*.key", ".cursorrules", "CLAUDE.md"],
        terminalRules: ["warn_on_curl_pipe", "warn_on_rm_rf", "block_on_sudo"],
        mcpRules: ["scan_all", "block_shell", "validate_schemas", "block_unknown"],
        brokerRules: ["local_only", "audit_log"],
        memoryRules: ["scan_instructions", "block_injection", "block_unicode"],
        reportRetention: "90_days",
        approvalBehavior: "warn",
        cloudEnabled: false,
    },
    {
        id: "max-privacy",
        name: "Local-only Max Privacy",
        description: "Maximum privacy — all data stays local, no cloud features.",
        protectedPatterns: [".env*", "*.pem", "id_rsa*", ".npmrc", ".pypirc", ".aws/credentials", "*.key", "*.p12", "secrets.*", "credentials.*"],
        terminalRules: ["block_curl_pipe", "block_rm_rf", "block_sudo", "block_chmod"],
        mcpRules: ["scan_all", "block_shell", "block_network", "block_unknown", "require_approval"],
        brokerRules: ["local_only", "fail_closed"],
        memoryRules: ["scan_instructions", "block_injection", "block_unicode", "require_approval"],
        reportRetention: "local_only",
        approvalBehavior: "require_approval",
        cloudEnabled: false,
    },
];

export function getPolicyPack(id: string): PolicyPack | undefined {
    return POLICY_PACKS.find((p) => p.id === id);
}
