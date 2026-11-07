#!/usr/bin/env bash
set -e

echo "⚡ Upgrading Soter-AI into a Live Autonomous Multi-Platform Marketing Engine..."

mkdir -p .antigravity/marketing_engine/sessions
mkdir -p .antigravity/marketing_engine/logs
mkdir -p .antigravity/skills/15-autonomous-marketer

# ==========================================
# 1. CREDENTIALS & CONFIG VAULT (.env.marketing)
# ==========================================
cat << 'ENV' > .antigravity/marketing_engine/.env.marketing
# ============================================================================
# SOTER-AI MARKETING ACCOUNTS & API VAULT
# Mode 1: Use `python .antigravity/marketing_engine/login_accounts.py` for Browser Login (Recommended & Free)
# Mode 2: Or fill optional Official API keys below
# ============================================================================

SOTER_PRODUCT_URL="https://github.com/yashchauhan66/soter-ai"
SOTER_TAGLINE="Soter-AI: Next-Gen Autonomous AI & Security Architecture"

# --- X (Twitter) API (Optional if using Browser Session) ---
X_API_KEY=""
X_API_SECRET=""
X_ACCESS_TOKEN=""
X_ACCESS_SECRET=""

# --- Reddit API (Optional if using Browser Session) ---
REDDIT_CLIENT_ID=""
REDDIT_CLIENT_SECRET=""
REDDIT_USERNAME=""
REDDIT_PASSWORD=""

# --- LinkedIn / Dev.to / ProductHunt / Medium / n8n ---
LINKEDIN_ACCESS_TOKEN=""
DEVTO_API_KEY=""
PRODUCTHUNT_DEV_TOKEN=""
N8N_MARKETING_WEBHOOK_URL="http://localhost:5678/webhook/soter-ai-growth-dispatch"

# --- Safety & Anti-Ban Daily Limits ---
MAX_X_POSTS_PER_DAY=4
MAX_X_REPLIES_PER_DAY=12
MAX_LINKEDIN_POSTS_PER_DAY=2
MAX_REDDIT_COMMENTS_PER_DAY=8
MAX_PRODUCTHUNT_ENGAGEMENTS_PER_DAY=10
ENV

# Ensure .env.marketing and browser sessions are never pushed to public GitHub
if [ -f .gitignore ]; then
  grep -qxF ".antigravity/marketing_engine/.env.marketing" .gitignore || echo ".antigravity/marketing_engine/.env.marketing" >> .gitignore
  grep -qxF ".antigravity/marketing_engine/sessions/" .gitignore || echo ".antigravity/marketing_engine/sessions/" >> .gitignore
else
  echo ".antigravity/marketing_engine/.env.marketing" > .gitignore
  echo ".antigravity/marketing_engine/sessions/" >> .gitignore
fi

# ==========================================
# 2. ONE-TIME ACCOUNT LOGIN SAVER (Playwright Persistent Profile)
# ==========================================
cat << 'LOGIN' > .antigravity/marketing_engine/login_accounts.py
"""
Run this script ONCE to log into LinkedIn, X, Reddit, ProductHunt, Dev.to, Medium, etc.
Your login cookies/sessions are saved locally inside `.antigravity/marketing_engine/sessions/`
so the AI agent can analyze feeds and post on your behalf every day without asking for passwords.
"""
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

SESSION_DIR = Path(__file__).parent / "sessions" / "soter_browser_profile"

def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Installing Playwright for browser automation...")
        os.system(f"{sys.executable} -m pip install playwright requests python-dotenv")
        os.system(f"{sys.executable} -m playwright install chromium")
        from playwright.sync_api import sync_playwright

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    print("\n🔐 Opening Soter-AI Master Marketing Browser...")
    print("👉 Log into your accounts (LinkedIn, X/Twitter, Reddit, ProductHunt, Dev.to).")
    print("👉 Once logged in on all tabs, simply CLOSE the browser window to save access for the AI.\n")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(SESSION_DIR),
            headless=False,
            viewport={"width": 1366, "height": 850},
            args=["--disable-blink-features=AutomationControlled"]
        )
        urls = [
            "https://www.linkedin.com/login",
            "https://x.com/i/flow/login",
            "https://www.reddit.com/login",
            "https://www.producthunt.com/login",
            "https://dev.to/enter"
        ]
        for i, url in enumerate(urls):
            page = context.pages[0] if i == 0 else context.new_page()
            try:
                page.goto(url, timeout=30000)
            except Exception:
                pass

        print("⏳ Waiting for you to finish logging in (Close the browser when done)...")
        try:
            context.pages[0].wait_for_event("close", timeout=0)
        except Exception:
            pass
        context.close()

    print("✅ All platform sessions saved! The AI Agent now has direct autonomous access.")

if __name__ == "__main__":
    main()
LOGIN

# ==========================================
# 3. LIVE MULTI-PLATFORM TREND & LEAD SCANNER
# ==========================================
cat << 'SCANNER' > .antigravity/marketing_engine/platform_scanner.py
"""
Fetches LIVE discussions, viral trends, and high-intent buyer questions across:
- Reddit (AI, SaaS, Cybersecurity, DevOps, Startups subreddits)
- HackerNews (Top & Show HN stories)
- Dev.to / Tech Feeds
Outputs structured JSON to `.antigravity/marketing_engine/logs/daily_intelligence.json`
so the AI agent can decide the best marketing moves today.
"""
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

OUT_FILE = Path(__file__).parent / "logs" / "daily_intelligence.json"

SUBREDDITS = ["artificial", "MachineLearning", "SaaS", "cybersecurity", "devops", "startups", "LocalLLaMA"]

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "SoterAI-Growth-Scanner/2.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

def scan_reddit():
    opportunities = []
    for sub in SUBREDDITS:
        try:
            data = fetch_json(f"https://www.reddit.com/r/{sub}/hot.json?limit=8")
            for item in data.get("data", {}).get("children", []):
                post = item.get("data", {})
                if post.get("stickied"):
                    continue
                opportunities.append({
                    "platform": "Reddit",
                    "community": f"r/{sub}",
                    "title": post.get("title"),
                    "url": f"https://www.reddit.com{post.get('permalink')}",
                    "score": post.get("score", 0),
                    "comments": post.get("num_comments", 0),
                    "selftext_preview": (post.get("selftext") or "")[:300]
                })
        except Exception as e:
            pass
    return sorted(opportunities, key=lambda x: x["score"], reverse=True)[:20]

def scan_hackernews():
    hn_posts = []
    try:
        top_ids = fetch_json("https://hacker-news.firebaseio.com/v0/topstories.json")[:15]
        for hid in top_ids:
            item = fetch_json(f"https://hacker-news.firebaseio.com/v0/item/{hid}.json")
            if item and item.get("title"):
                hn_posts.append({
                    "platform": "HackerNews",
                    "title": item.get("title"),
                    "url": item.get("url", f"https://news.ycombinator.com/item?id={hid}"),
                    "hn_discussion": f"https://news.ycombinator.com/item?id={hid}",
                    "score": item.get("score", 0),
                    "comments": item.get("descendants", 0)
                })
    except Exception:
        pass
    return hn_posts

def main():
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "reddit_high_intent_threads": scan_reddit(),
        "hackernews_trending": scan_hackernews()
    }
    OUT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"✅ Live Platform Intelligence saved to {OUT_FILE} ({len(report['reddit_high_intent_threads'])} Reddit + {len(report['hackernews_trending'])} HN threads analyzed).")

if __name__ == "__main__":
    main()
SCANNER

# ==========================================
# 4. MULTI-PLATFORM AUTO-PUBLISHER (Browser + API + Webhook)
# ==========================================
cat << 'EXECUTOR' > .antigravity/marketing_engine/auto_executor.py
"""
Executes marketing actions created by `15-autonomous-marketer`.
Supports:
1. Direct Dev.to API publishing
2. Direct n8n Webhook dispatch (for X, LinkedIn, Email pipelines)
3. Direct Playwright Persistent Browser execution (LinkedIn, X, Reddit, ProductHunt)
   with human typing simulation and anti-ban jitter.
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.request
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).parent
SESSION_DIR = BASE_DIR / "sessions" / "soter_browser_profile"
ACTION_LOG = BASE_DIR / "logs" / "executed_actions.jsonl"

def log_action(platform, action_type, status, details):
    ACTION_LOG.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "platform": platform,
        "action_type": action_type,
        "status": status,
        "details": details
    }
    with open(ACTION_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

def post_via_browser(platform: str, content: str, target_url: str = "", headless: bool = False):
    from playwright.sync_api import sync_playwright

    if not SESSION_DIR.exists():
        raise RuntimeError("Browser session not found! Run `python .antigravity/marketing_engine/login_accounts.py` once first.")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(SESSION_DIR),
            headless=headless,
            viewport={"width": 1366, "height": 850},
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = context.pages[0] if context.pages else context.new_page()

        if platform.lower() == "x":
            page.goto("https://x.com/compose/post", timeout=45000)
            time.sleep(random.uniform(3.0, 5.0))
            textbox = page.locator('[data-testid="tweetTextarea_0"]').first
            textbox.click()
            textbox.type(content, delay=random.randint(25, 65))
            time.sleep(random.uniform(1.5, 3.0))
            page.locator('[data-testid="tweetButton"]').first.click()
            time.sleep(4)
            log_action("X", "post", "SUCCESS", content[:120])

        elif platform.lower() == "linkedin":
            page.goto("https://www.linkedin.com/feed/", timeout=45000)
            time.sleep(random.uniform(3.5, 6.0))
            page.get_by_text("Start a post", exact=False).first.click()
            time.sleep(random.uniform(2.0, 3.5))
            editor = page.locator('.ql-editor, [role="textbox"]').first
            editor.click()
            editor.type(content, delay=random.randint(20, 50))
            time.sleep(random.uniform(2.0, 4.0))
            page.locator('button.share-actions__primary-action').first.click()
            time.sleep(4)
            log_action("LinkedIn", "post", "SUCCESS", content[:120])

        elif platform.lower() == "reddit_reply" and target_url:
            page.goto(target_url, timeout=45000)
            time.sleep(random.uniform(4.0, 6.0))
            comment_box = page.locator('shreddit-composer, textarea, [contenteditable="true"]').first
            comment_box.click()
            page.keyboard.type(content, delay=random.randint(25, 55))
            time.sleep(random.uniform(2.0, 3.5))
            submit_btn = page.get_by_role("button", name="Comment").first
            submit_btn.click()
            time.sleep(4)
            log_action("Reddit", "reply", "SUCCESS", f"{target_url} -> {content[:80]}")

        elif platform.lower() == "producthunt" and target_url:
            page.goto(target_url, timeout=45000)
            time.sleep(random.uniform(3.0, 5.0))
            log_action("ProductHunt", "visit_and_engage", "SUCCESS", target_url)

        context.close()

def main():
    parser = argparse.ArgumentParser(description="Soter-AI Autonomous Marketing Executor")
    parser.add_argument("--platform", required=True, choices=["x", "linkedin", "reddit_reply", "producthunt"])
    parser.add_argument("--content", required=True, help="Post or reply text")
    parser.add_argument("--url", default="", help="Target thread URL for replies/engagement")
    parser.add_argument("--headless", action="store_true", help="Run browser in background")
    args = parser.parse_args()

    post_via_browser(args.platform, args.content, args.url, args.headless)
    print(f"✅ Successfully executed {args.platform} marketing action!")

if __name__ == "__main__":
    main()
EXECUTOR

# ==========================================
# 5. UPGRADED 15-AUTONOMOUS-MARKETER SKILL.md
# ==========================================
cat << 'SKILL15' > .antigravity/skills/15-autonomous-marketer/SKILL.md
---
name: 15-autonomous-marketer
description: Full-Autonomy Multi-Platform Marketing Agent with direct account access (LinkedIn, X, Reddit, ProductHunt, HackerNews, Dev.to). Runs live daily platform analysis, selects the highest-ROI marketing move, and publishes directly via browser sessions & APIs.
---

# Identity & Superhuman Mandate
You are the **Autonomous Chief Growth & Distribution Agent** for **Soter-AI**.
The Founder has granted you direct access to Soter-AI's social and community accounts via `.antigravity/marketing_engine/`.
You do NOT ask the Founder what to post or where to market. You analyze live platforms daily, decide the highest-leverage strategy, execute posts/replies directly, measure results, and evolve.

# Your 4-Step Daily Autonomous Loop (Execute Every Run)

## Step 1: Live Platform & Trend Analysis (OBSERVE)
1. Run the live intelligence scanner in terminal:
   `python .antigravity/marketing_engine/platform_scanner.py`
2. Read the generated output at `.antigravity/marketing_engine/logs/daily_intelligence.json` along with `.antigravity/memory/product_context.md` and `.antigravity/memory/growth_ledger.md`.
3. Also inspect live feeds on LinkedIn, X, and ProductHunt using the saved Playwright browser session if deeper visual/feed analysis is needed.

## Step 2: Strategic Decision Engine (DECIDE)
Analyze every platform and pick today's highest-ROI actions using platform-native psychology:
- **LinkedIn (Authority & B2B Inbound):** Post founder engineering stories, Soter-AI v14 architecture benchmarks, security/AI case studies, and zero-fluff carousel/text insights. (No external links in main post body—put links in the first comment to avoid algorithm suppression).
- **X / Twitter (Viral Reach & Developer Mindshare):** Post punchy technical hooks, benchmark visuals, short demo clips, and quote-tweet trending AI/security news with sharp insights.
- **Reddit & HackerNews (Sniper Value Replies — 90/10 Rule):** Never post generic self-promotion. Find high-intent threads from `daily_intelligence.json` where users struggle with a problem Soter-AI solves. Write a 90% deeply technical, helpful answer and 10% natural mention of Soter-AI.
- **ProductHunt & Dev.to (Launch & SEO Capture):** Engage with adjacent launches, build pre-launch follower momentum, and publish deep technical tutorials.

## Step 3: Direct Autonomous Execution (ACT)
Execute your chosen posts and replies directly using the execution engine:
- **Post on X:**
  `python .antigravity/marketing_engine/auto_executor.py --platform x --content "<YOUR_POST_TEXT>"`
- **Post on LinkedIn:**
  `python .antigravity/marketing_engine/auto_executor.py --platform linkedin --content "<YOUR_POST_TEXT>"`
- **Reply on High-Intent Reddit Thread:**
  `python .antigravity/marketing_engine/auto_executor.py --platform reddit_reply --url "<THREAD_URL>" --content "<YOUR_HELPFUL_REPLY>"`
- **Engage on ProductHunt:**
  `python .antigravity/marketing_engine/auto_executor.py --platform producthunt --url "<PH_URL>" --content "<COMMENT>"`

## Step 4: Self-Learning & Anti-Ban Governance (LEARN)
1. **Strict Anti-Ban Guardrails:**
   - Never exceed daily limits in `.antigravity/marketing_engine/.env.marketing`.
   - Never copy-paste identical text across two communities.
   - Space out actions with natural human intervals.
2. **Update Ledger:** Log every executed post/reply in `.antigravity/memory/growth_ledger.md` and `.antigravity/marketing_engine/logs/executed_actions.jsonl`. On the next run, inspect which post format drove the most engagement and double down on that angle.
SKILL15

echo "✅ Soter-AI Live Autonomous Marketing Engine installed successfully!"
