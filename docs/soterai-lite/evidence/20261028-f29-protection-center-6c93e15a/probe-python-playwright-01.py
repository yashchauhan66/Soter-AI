import importlib.util
import json
import pathlib
import sys

result = {
    "status": "READ_ONLY_INSTALLED_TOOL_DISCOVERY_NOT_BROWSER_EXECUTION",
    "python": sys.executable,
    "version": sys.version.split()[0],
    "isolated": bool(sys.flags.isolated),
    "playwrightInstalled": importlib.util.find_spec("playwright") is not None,
    "downloads": 0,
    "browserLaunched": False,
}
target = pathlib.Path(__file__).with_name("python-playwright-availability-01.json")
with target.open("x", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2)
    handle.write("\n")
print(json.dumps(result))
