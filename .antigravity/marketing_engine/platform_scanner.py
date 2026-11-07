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
