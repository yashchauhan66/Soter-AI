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
        print("Installing Playwright for browser automation...", flush=True)
        os.system(f"{sys.executable} -m pip install playwright requests python-dotenv")
        os.system(f"{sys.executable} -m playwright install chromium")
        from playwright.sync_api import sync_playwright

    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    print("\n🔐 Opening Soter-AI Master Marketing Browser...", flush=True)
    print("👉 Log into your accounts (LinkedIn, X/Twitter, Reddit, ProductHunt, Dev.to).", flush=True)
    print("👉 Once logged in on all tabs, simply CLOSE the browser window to save access for the AI.\n", flush=True)

    chrome_system_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    launch_kwargs = {
        "user_data_dir": str(SESSION_DIR),
        "headless": False,
        "no_viewport": True,
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--start-maximized"
        ]
    }
    if os.path.exists(chrome_system_path):
        launch_kwargs["channel"] = "chrome"

    urls = [
        ("LinkedIn", "https://www.linkedin.com/login"),
        ("X (Twitter)", "https://x.com/i/flow/login"),
        ("Reddit", "https://www.reddit.com/login"),
        ("ProductHunt", "https://www.producthunt.com/login"),
        ("Dev.to", "https://dev.to/enter")
    ]

    with sync_playwright() as p:
        try:
            context = p.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as err:
            if "channel" in launch_kwargs:
                launch_kwargs.pop("channel", None)
                context = p.chromium.launch_persistent_context(**launch_kwargs)
            else:
                raise err

        for i, (name, url) in enumerate(urls):
            print(f"🌐 Opening tab {i+1}/5 [{name}]: {url}", flush=True)
            page = context.pages[0] if i == 0 else context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
            except Exception as e:
                print(f"⚠️ Note: {name} loading continued in background ({e})", flush=True)

        print("\n⏳ Browser is open! Log into your accounts across the tabs.", flush=True)
        print("👉 When you are completely done, simply CLOSE the browser window.\n", flush=True)

        while context.pages:
            try:
                context.pages[0].wait_for_event("close", timeout=2000)
            except Exception:
                pass

        try:
            context.close()
        except Exception:
            pass

    print("\n✅ All platform sessions saved! The AI Agent now has direct autonomous access.", flush=True)

if __name__ == "__main__":
    main()
