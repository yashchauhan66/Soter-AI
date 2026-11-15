"""Run exact published Python snippets using real SDK + requests transport.

Only requests.Session.send (the network edge) and the application model IO are
synthetic. Do not replace Soter, GuardResult.from_dict, factories or helpers.
"""
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import threading
import types

payload = json.load(sys.stdin)
repo = Path(payload["repo"]).resolve()
sys.path.insert(0, str(repo / "packages/python-sdk"))
os.environ["SOTER_API_KEY"] = "synthetic-api-safety-key"
os.environ["SOTER_BASE_URL"] = "https://api-safety.invalid"

# No real sockets, including if a snippet bypasses the injected HTTP edge.
# Windows asyncio uses its local private socketpair to drive the ASGI client.
original_connect = socket.socket.connect

def no_network(*args, **kwargs):
    raise AssertionError("Live networking is forbidden in API docs regression")

def guarded_connect(sock, address):
    caller = sys._getframe(1)
    if caller.f_globals.get("__name__") == "socket" and caller.f_code.co_name == "_fallback_socketpair":
        return original_connect(sock, address)
    return no_network(sock, address)

socket.create_connection = no_network
socket.socket.connect = guarded_connect
import requests
import soter  # pyright: ignore[reportMissingImports] -- loaded from pinned repo
from fastapi.testclient import TestClient

scenario = {}
sent, llm_inputs = [], []
original = payload["original"]
filename = payload["title"] + ".published.py"

def send(self, request, **kwargs):
    assert request.url in ("https://api-safety.invalid/api/guard/input", "https://api-safety.invalid/api/guard/output"), request.url
    assert request.method == "POST"
    assert request.headers["x-api-key"] == "synthetic-api-safety-key"
    sent.append({"url": request.url, "body": json.loads(request.body)})
    fixtures = scenario["fixtures"]
    item = fixtures[0] if request.url.endswith("/input") else fixtures[1]
    if item.get("networkError"):
        raise requests.ConnectionError("Synthetic transport error containing " + payload["diagnostic"])
    response = requests.Response()
    response.status_code = item.get("status", 200)
    response.url = request.url
    response.request = request
    response.headers.update({"Content-Type": "application/json", "Retry-After": "1"})
    response._content = (item["text"] if "text" in item else json.dumps(item.get("body"))).encode("utf-8")
    return response

requests.Session.send = send

def call_llm(text):
    llm_inputs.append(text)
    return original["output"]

adapter = types.ModuleType("llm")
setattr(adapter, "call_llm", call_llm)
sys.modules["llm"] = adapter

# Observe the factory example's published local model stub without replacing it
# or modifying any copied byte. FastAPI executes a sync endpoint in a worker.
def profile(frame, event, arg):
    if event == "call" and frame.f_code.co_filename == filename and frame.f_code.co_name == "my_llm_call":
        llm_inputs.append(frame.f_locals["prompt"])

threading.setprofile(profile)
sys.setprofile(profile)
rows = []
compiled = compile(payload["code"], filename, "exec", dont_inherit=True)
for scenario in payload["scenarios"]:
    sent.clear()
    llm_inputs.clear()
    namespace = {}
    exec(compiled, namespace)
    row = {"id": scenario["id"]}
    if payload["mode"] == "fastapi":
        with TestClient(namespace["app"], raise_server_exceptions=False) as client:
            response = client.post("/chat", json={"message": original["input"]})
            row["status"] = response.status_code
            try:
                row["result"] = response.json()
            except ValueError:
                row["result"] = {"unparsed_http_body": response.text}
    else:
        try:
            row["result"] = namespace["handle_chat_message"](original["input"])
        except Exception as error:
            row["raised"] = type(error).__name__
            row["errorMessage"] = str(error)
    row.update(sent=list(sent), llmInputs=list(llm_inputs))
    rows.append(row)
    namespace["guard"]._session.close()

sys.setprofile(None)
threading.setprofile(None)
pins = []
for name, module in sorted(sys.modules.items()):
    if name == "soter" or name.startswith("soter."):
        file = getattr(module, "__file__", None)
        if file:
            file = Path(file).resolve()
            assert file.is_relative_to(repo / "packages/python-sdk"), file
            pins.append({"path": str(file), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
print(json.dumps({"rows": rows, "pins": pins, "python": sys.executable,
                  "codeSha256": hashlib.sha256(payload["code"].encode("utf-8")).hexdigest()}))
