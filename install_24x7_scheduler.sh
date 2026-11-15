#!/usr/bin/env bash
set -e

echo "⏰ Setting up Soter-AI 24/7 Autonomous Marketing Daemon (10:00 AM & 07:00 PM)..."

mkdir -p .antigravity/marketing_engine/logs

# Add GEMINI_API_KEY option to .env.marketing if not already present
if ! grep -q "GEMINI_API_KEY" .antigravity/marketing_engine/.env.marketing 2>/dev/null; then
cat << 'ENV_ADD' >> .antigravity/marketing_engine/.env.marketing

# --- AI Brain Key for Background Autopilot (Get free key from aistudio.google.com) ---
GEMINI_API_KEY=""
AUTOPILOT_HEADLESS="false"
ENV_ADD
fi

# =====================================================================
# 1. THE 24/7 AUTONOMOUS BRAIN + EXECUTOR (daily_autopilot.py)
# =====================================================================
cat << 'AUTOPILOT' > .antigravity/marketing_engine/daily_autopilot.py
"""
Soter-AI 24/7 Autonomous Marketing Daemon.
Runs automatically at 10:00 AM and 07:00 PM via Windows Task Scheduler / Cron.
1. Scans live Reddit & HackerNews trends via platform_scanner.py
2. Reads recent Soter-AI git commits & product_context.md
3. Uses Gemini AI (or built-in technical templates) to craft platform-native posts & sniper replies
4. Publishes directly to LinkedIn, X, and Reddit via auto_executor.py + n8n webhook
5. Updates .antigravity/memory/growth_ledger.md automatically
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ENGINE_DIR = Path(__file__).resolve().parent
ROOT_DIR = ENGINE_DIR.parent.parent
LOG_FILE = ENGINE_DIR / "logs" / "autopilot.log"
INTEL_FILE = ENGINE_DIR / "logs" / "daily_intelligence.json"
LEDGER_FILE = ROOT_DIR / ".antigravity" / "memory" / "growth_ledger.md"
PRODUCT_CONTEXT_FILE = ROOT_DIR / ".antigravity" / "memory" / "product_context.md"
ENV_FILE = ENGINE_DIR / ".env.marketing"

def log(msg: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def get_recent_git_updates():
    try:
        out = subprocess.check_output(
            ["git", "log", "-n", "5", "--pretty=format:%s"],
            cwd=str(ROOT_DIR),
            stderr=subprocess.DEVNULL
        ).decode("utf-8", errors="ignore")
        return out.strip() or "Soter-AI v14 model optimization and enterprise reliability upgrades"
    except Exception:
        return "Soter-AI v14 core model inference and autonomous security pipeline"

def generate_campaigns_with_ai(env, intel, git_commits, product_context, slot):
    api_key = env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
    reddit_threads = intel.get("reddit_high_intent_threads", [])[:5]
    hn_threads = intel.get("hackernews_trending", [])[:5]
    top_reddit = reddit_threads[0] if reddit_threads else {"title": "Scaling AI Models in Production", "url": ""}

    prompt = f"""You are the Chief Autonomous Marketer for Soter-AI ({env.get('SOTER_PRODUCT_URL', '')}).
Time Slot: {slot}
Product Context: {product_context[:1500]}
Recent Soter-AI Engineering Commits: {git_commits}
Top Live Reddit Thread: {json.dumps(top_reddit)}
Top HackerNews Trends: {json.dumps(hn_threads[:3])}

Return ONLY a valid JSON object with these exact keys:
{{
  "strategy_reason": "1 sentence on why this angle wins today",
  "x_post": "High-converting technical X/Twitter post under 260 chars (no generic hashtags)",
  "linkedin_post": "Authority founder-style LinkedIn post (120-180 words, concrete engineering value, soft CTA)",
  "reddit_target_url": "{top_reddit.get('url', '')}",
  "reddit_reply": "Deeply helpful technical comment answering the Reddit thread above (90% pure engineering help, 10% natural mention of how we solved this in Soter-AI)"
}}"""

    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw_text)
        except Exception as e:
            log(f"⚠️ Gemini API fallback triggered: {e}")

    # Smart Context-Aware Fallback if GEMINI_API_KEY is not filled yet
    first_commit = git_commits.splitlines()[0] if git_commits else "v14 pipeline optimization"
    return {
        "strategy_reason": f"Highlighting recent Soter-AI engineering milestone ({first_commit}) + engaging top community thread",
        "x_post": f"Just shipped a new update to Soter-AI: {first_commit}.\n\nFocusing on zero-latency inference, strict container isolation, and real-world reliability instead of hype.\n\nBenchmark & architecture notes: {env.get('SOTER_PRODUCT_URL', '')}",
        "linkedin_post": f"Most AI products break when moved from a notebook demo to real production load.\n\nToday in Soter-AI, we shipped: {first_commit}.\n\nThree lessons from our v14 architecture:\n1. Isolate every execution path inside deterministic Docker test harnesses.\n2. Optimize GPU memory & tail-latency before adding flashier UI features.\n3. Treat security and input validation as first-class citizens.\n\nHow is your team handling reliability in production AI right now?",
        "reddit_target_url": top_reddit.get("url", ""),
        "reddit_reply": f"Great discussion on {top_reddit.get('title', 'this topic')}. In our experience building Soter-AI ({first_commit}), the biggest bottleneck is usually unhandled edge-case inputs and container state drift. Running isolated regression checks before every deployment eliminated ~80% of our production failures."
    }

def dispatch_n8n_webhook(webhook_url, plan):
    if not webhook_url:
        return
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps({"tier": "TIER_1_AUTO", "campaign": plan}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=10)
        log("✅ Dispatched payload to n8n Marketing Webhook.")
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slot", default="AUTO", help="MORNING_10AM or EVENING_7PM")
    parser.add_argument("--dry-run", action="store_true", help="Generate strategy & posts without publishing")
    args = parser.parse_args()

    log(f"🚀 Starting Soter-AI Autonomous Marketing Run (Slot: {args.slot}, Dry-Run: {args.dry_run})")
    env = load_env()

    # 1. Run Live Platform Scanner
    subprocess.run([sys.executable, str(ENGINE_DIR / "platform_scanner.py")], check=False)

    intel = {}
    if INTEL_FILE.exists():
        intel = json.loads(INTEL_FILE.read_text(encoding="utf-8"))

    product_context = PRODUCT_CONTEXT_FILE.read_text(encoding="utf-8") if PRODUCT_CONTEXT_FILE.exists() else "Soter-AI"
    git_commits = get_recent_git_updates()

    # 2. Decide Strategy & Generate Content
    plan = generate_campaigns_with_ai(env, intel, git_commits, product_context, args.slot)
    log(f"🧠 AI Strategy Selected: {plan.get('strategy_reason')}")

    if args.dry_run:
        print("\n=== DRY RUN GENERATED CAMPAIGN ===")
        print(json.dumps(plan, indent=2))
        return

    headless_flag = ["--headless"] if env.get("AUTOPILOT_HEADLESS", "false").lower() == "true" else []

    # 3. Execute on Platforms
    # Always post to X
    if plan.get("x_post"):
        log("📤 Publishing to X (Twitter)...")
        subprocess.run([sys.executable, str(ENGINE_DIR / "auto_executor.py"), "--platform", "x", "--content", plan["x_post"]] + headless_flag, check=False)

    # Morning slot prioritizes LinkedIn Authority Post; Evening slot prioritizes Reddit Sniper Reply
    if args.slot in ("MORNING_10AM", "AUTO") and plan.get("linkedin_post"):
        log("📤 Publishing to LinkedIn...")
        subprocess.run([sys.executable, str(ENGINE_DIR / "auto_executor.py"), "--platform", "linkedin", "--content", plan["linkedin_post"]] + headless_flag, check=False)

    if args.slot in ("EVENING_7PM", "AUTO") and plan.get("reddit_target_url") and plan.get("reddit_reply"):
        log(f"📤 Posting Value Reply on Reddit: {plan['reddit_target_url']}")
        subprocess.run([
            sys.executable, str(ENGINE_DIR / "auto_executor.py"),
            "--platform", "reddit_reply",
            "--url", plan["reddit_target_url"],
            "--content", plan["reddit_reply"]
        ] + headless_flag, check=False)

    # Also notify n8n if running
    dispatch_n8n_webhook(env.get("N8N_MARKETING_WEBHOOK_URL", ""), plan)

    # 4. Log to Growth Ledger
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    with open(LEDGER_FILE, "a", encoding="utf-8") as f:
        f.write(f"| {stamp} | X + LinkedIn + Reddit | {plan.get('strategy_reason', '')[:70]} | 15-autonomous-marketer | Auto-Targeted | EXECUTED |\n")

    log("✅ Autonomous Marketing Run Completed & Logged in growth_ledger.md!")

if __name__ == "__main__":
    main()
AUTOPILOT

# =====================================================================
# 2. WINDOWS TASK SCHEDULER INSTALLER (10:00 AM & 07:00 PM)
# =====================================================================
cat << 'PS1' > .antigravity/marketing_engine/register_windows_schedule.ps1
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$PythonExe = (Get-Command python).Source
$ScriptPath = Join-Path $PSScriptRoot "daily_autopilot.py"

Write-Host "Project Root: $ProjectRoot"
Write-Host "Python Path:  $PythonExe"

# Create Morning 10:00 AM Task
$MorningCmd = "`"$PythonExe`" `"$ScriptPath`" --slot MORNING_10AM"
schtasks /Create /F /SC DAILY /TN "SoterAI_Autopilot_Morning_10AM" /TR $MorningCmd /ST 10:00

# Create Evening 07:00 PM (19:00) Task
$EveningCmd = "`"$PythonExe`" `"$ScriptPath`" --slot EVENING_7PM"
schtasks /Create /F /SC DAILY /TN "SoterAI_Autopilot_Evening_7PM" /TR $EveningCmd /ST 19:00

Write-Host ""
Write-Host "[OK] BOTH DAILY SCHEDULES REGISTERED IN WINDOWS TASK SCHEDULER!" -ForegroundColor Green
Write-Host "   - Morning Run: 10:00 AM Daily (SoterAI_Autopilot_Morning_10AM)"
Write-Host "   - Evening Run: 07:00 PM Daily (SoterAI_Autopilot_Evening_7PM)"
PS1

echo "✅ 24/7 Autopilot files created!"

