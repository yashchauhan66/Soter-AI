"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

interface FeatureItem {
  label: string;
  href: string;
  group: string;
  keywords: string[];
}

const FEATURES: FeatureItem[] = [
  // Operate
  { label: "Overview", href: "/dashboard", group: "Operate", keywords: ["dashboard", "home", "main", "stats"] },
  { label: "Guard logs", href: "/dashboard/logs", group: "Operate", keywords: ["logs", "activity", "history", "requests"] },
  { label: "Reports", href: "/dashboard/reports", group: "Operate", keywords: ["reports", "analytics", "monthly", "pdf"] },
  { label: "Customer success", href: "/dashboard/customer-success", group: "Operate", keywords: ["customer", "success", "activation", "health"] },
  { label: "Detection feedback", href: "/dashboard/detection-feedback", group: "Operate", keywords: ["feedback", "detection", "false positive", "accuracy"] },
  // Configure
  { label: "Projects", href: "/dashboard/projects", group: "Configure", keywords: ["projects", "workspace"] },
  { label: "API keys", href: "/dashboard/api-keys", group: "Configure", keywords: ["api", "keys", "authentication", "credentials"] },
  { label: "Policy", href: "/dashboard/policy", group: "Configure", keywords: ["policy", "rules", "threshold", "risk"] },
  { label: "Webhooks", href: "/dashboard/webhooks", group: "Configure", keywords: ["webhooks", "events", "notifications", "alerts"] },
  { label: "RAG security", href: "/dashboard/rag", group: "Configure", keywords: ["rag", "retrieval", "knowledge base", "documents"] },
  { label: "Agent firewall", href: "/dashboard/agent-firewall", group: "Configure", keywords: ["firewall", "agent", "tools", "block"] },
  { label: "Security badges", href: "/dashboard/badges", group: "Configure", keywords: ["badge", "security", "embed", "status"] },
  { label: "Shadow AI", href: "/dashboard/shadow-ai", group: "Configure", keywords: ["shadow", "unauthorized", "discovery", "unsanctioned"] },
  { label: "Red team lab", href: "/dashboard/redteam/lab", group: "Configure", keywords: ["red team", "testing", "adversarial", "jailbreak"] },
  { label: "Cost firewall", href: "/dashboard/cost-firewall", group: "Configure", keywords: ["cost", "spending", "budget", "tokens"] },
  { label: "Credential vault", href: "/dashboard/credentials", group: "Configure", keywords: ["credentials", "vault", "secrets"] },
  { label: "Forensics", href: "/dashboard/forensics", group: "Configure", keywords: ["forensics", "investigation", "audit", "evidence"] },
  // Agent Security
  { label: "Agent passports", href: "/dashboard/agent-passports", group: "Agent security", keywords: ["passport", "identity", "agent", "signed"] },
  { label: "Intent guard", href: "/dashboard/intent-guard", group: "Agent security", keywords: ["intent", "verify", "action", "match"] },
  { label: "Tool chain", href: "/dashboard/tool-chain", group: "Agent security", keywords: ["tool", "chain", "sequence", "exfiltration"] },
  { label: "Transaction escrow", href: "/dashboard/escrow", group: "Agent security", keywords: ["escrow", "hold", "approval", "review"] },
  { label: "Sandbox dry-run", href: "/dashboard/dry-run", group: "Agent security", keywords: ["dry run", "simulate", "sandbox", "prediction"] },
  { label: "Semantic egress", href: "/dashboard/semantic-egress", group: "Agent security", keywords: ["egress", "leak", "confidential", "paraphrase"] },
  { label: "Evidence vault", href: "/dashboard/evidence-vault", group: "Agent security", keywords: ["evidence", "compliance", "audit", "soc2"] },
  { label: "Context lineage", href: "/dashboard/lineage", group: "Agent security", keywords: ["lineage", "context", "source", "flow"] },
  { label: "Blast radius", href: "/dashboard/blast-radius", group: "Agent security", keywords: ["blast", "radius", "damage", "risk score"] },
  { label: "Memory firewall", href: "/dashboard/memory-firewall", group: "Agent security", keywords: ["memory", "poisoning", "quarantine"] },
  { label: "MCP tool drift", href: "/dashboard/mcp-drift", group: "Agent security", keywords: ["mcp", "drift", "tool", "server"] },
  { label: "Legal boundary", href: "/dashboard/legal-boundary", group: "Agent security", keywords: ["legal", "boundary", "consent", "compliance"] },
  // Agency
  { label: "Partner program", href: "/dashboard/partner", group: "Agency", keywords: ["partner", "agency", "reseller"] },
  { label: "Agency overview", href: "/dashboard/agency", group: "Agency", keywords: ["agency", "overview", "clients"] },
  { label: "White-label report", href: "/dashboard/reports/white-label", group: "Agency", keywords: ["white label", "branded", "pdf", "client"] },
  // Account
  { label: "Onboarding", href: "/dashboard/onboarding", group: "Account", keywords: ["onboarding", "setup", "getting started"] },
  { label: "Support", href: "/dashboard/support", group: "Account", keywords: ["support", "help", "ticket"] },
  { label: "Billing & usage", href: "/dashboard/billing", group: "Account", keywords: ["billing", "plan", "usage", "pricing"] },
  { label: "Audit exports", href: "/dashboard/exports", group: "Account", keywords: ["export", "audit", "download", "data"] },
  { label: "Settings", href: "/dashboard/settings", group: "Account", keywords: ["settings", "profile", "preferences"] },
  // Docs
  { label: "Documentation", href: "/docs", group: "Resources", keywords: ["docs", "documentation", "guide", "api"] },
  { label: "Integration wizard", href: "/dashboard/integrations", group: "Resources", keywords: ["integration", "wizard", "setup", "code"] },
];

function matchScore(query: string, item: FeatureItem): number {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  for (const kw of item.keywords) {
    if (kw.includes(q)) return 40;
  }
  const group = item.group.toLowerCase();
  if (group.includes(q)) return 20;
  return 0;
}

export function FeatureSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FeatureItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      const timer = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      const scored = FEATURES
        .map((item) => ({ item, score: matchScore(query, item) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((s) => s.item);
      setResults(scored);
      setSelectedIndex(0);
    }, 100);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback((href: string) => {
    setQuery("");
    setResults([]);
    setFocused(false);
    router.push(href);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex].href);
    } else if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      inputRef.current?.blur();
    }
  };

  // Cmd+K to focus
  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search features... (⌘K)"
          className="input h-10 pl-10 pr-24 text-sm"
          aria-label="Search dashboard features"
          role="combobox"
          aria-expanded={results.length > 0 && focused}
          aria-controls="feature-search-results"
          aria-autocomplete="list"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          ⌘K
        </kbd>
      </div>

      {/* Results dropdown */}
      {results.length > 0 && focused && (
        <div
          ref={resultsRef}
          id="feature-search-results"
          className="card absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden p-2 shadow-xl"
          role="listbox"
        >
          {results.map((item, index) => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                index === selectedIndex
                  ? "bg-cyan/10 text-cyan"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 text-[11px] text-slate-500">
                  {item.group}
                </span>
              </div>
              <ArrowRight size={14} className="shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
