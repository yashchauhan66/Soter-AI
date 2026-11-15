"""Exact guide literals + real in-tree SDK; only HTTP/application IO is synthetic."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import types

payload = json.load(sys.stdin)
root = Path(payload["root"])
sys.path.insert(0, str(root / "packages/python-sdk"))
os.environ["SOTER_API_KEY"] = "synthetic-safety-test-key"
os.environ["SOTER_BASE_URL"] = "https://guard.example.test"

# Windows asyncio needs its private socketpair; prohibit all other networking.
original_connect = socket.socket.connect

def no_network(*args, **kwargs):
    raise AssertionError("Network forbidden in documentation safety regression")

def guarded_connect(sock, address):
    caller = sys._getframe(1)
    if caller.f_globals.get("__name__") == "socket" and caller.f_code.co_name == "_fallback_socketpair":
        return original_connect(sock, address)
    return no_network(sock, address)

socket.create_connection = no_network
socket.socket.connect = guarded_connect
import requests
import httpx
import soter
from fastapi.testclient import TestClient

assert Path(soter.__file__).resolve().is_relative_to((root / "packages/python-sdk").resolve())
original, safe = payload["original"], payload["safe"]
scenario = None
calls, retrieval, requests_seen = [], [], []

def answer(url):
    path = str(url).split("guard.example.test")[-1]
    assert path in ("/api/guard/input", "/api/guard/output", "/api/guard/analyze"), path
    requests_seen.append(path)
    role = "output" if path.endswith("/output") else "chunk" if path.endswith("/analyze") else "input"
    result = {"allowed": True, "action": "REWRITE", "riskScore": 0, "riskTypes": [], "findings": [], "safeText": safe[role]}
    if scenario.get("valid") == "allow-original":
        result["action"] = "ALLOW"
        del result["safeText"]
    elif scenario.get("valid"):
        action, field = scenario["valid"].split("/")
        result["action"] = action
        del result["safeText"]
        result[field] = safe[role]
    elif role == scenario["role"]:
        result = scenario["raw"]
    return result

# Patch the underlying HTTP method, not the SDK constructor or its parser.
# A published StrictSession/StrictAsyncClient override must still run normally.
def sync_post(self, url, **kwargs):
    response = requests.Response()
    response.status_code = 200
    response.url = url
    response.headers["Content-Type"] = "application/json"
    response._content = json.dumps(answer(url)).encode("utf-8")
    return response

async def async_post(self, url, **kwargs):
    return httpx.Response(200, json=answer(url), request=httpx.Request("POST", url))

requests.Session.post = sync_post
httpx.AsyncClient.post = async_post

llm = types.ModuleType("your_app.llm")
def my_llm_call(prompt):
    calls.append(prompt)
    return original["output"]

async def my_async_llm_call(prompt):
    return my_llm_call(prompt)

llm.my_llm_call, llm.my_async_llm_call = my_llm_call, my_async_llm_call
sys.modules["your_app"] = types.ModuleType("your_app")
sys.modules["your_app.llm"] = llm

class Chain:
    def invoke(self, value, config=None):
        calls.append(value)
        return original["output"]

class Engine:
    def query(self, query):
        calls.append(query)
        return types.SimpleNamespace(response=original["output"], source_nodes=[types.SimpleNamespace(text=original["chunk"])])

def retrieve_authorized(query, principal):
    assert principal == "trusted-principal"
    retrieval.append(query)
    return [{"id": "synthetic-source", "text": original["chunk"], "url": "https://example.test/source"}]

def generate_answer(query, context):
    calls.append({"query": query, "context": context})
    return original["output"]

rag = types.ModuleType("your_app.rag")
rag.my_chain, rag.query_engine = Chain(), Engine()
rag.retrieve_authorized, rag.generate_answer = retrieve_authorized, generate_answer
sys.modules["your_app.rag"] = rag
surface = payload["surface"]
rows = []
for scenario in payload["scenarios"]:
    calls.clear()
    retrieval.clear()
    requests_seen.clear()
    namespace = {}
    # No source repair or inherited future-annotations semantics.
    exec(compile(payload["code"], surface["page"] + "-" + surface["name"] + ".published.py", "exec", dont_inherit=True), namespace)
    if surface["page"] == "fastapi":
        with TestClient(namespace["app"], raise_server_exceptions=True) as client:
            response = client.post("/chat", json={"message": original["input"]})
            result = response.json()
    elif surface["name"] == "ragCode":
        result = namespace["answer_rag"](original["input"], "trusted-principal")
    elif surface["name"] == "langchainCode":
        result = namespace["ask_chain"](original["input"])
    else:
        result = namespace["ask_index"](original["input"])
    assert isinstance(result, dict), "example must return an application response"
    rows.append({"id": scenario["id"], "surface": surface["page"] + "." + surface["name"],
                 "blocked": result.get("blocked"), "reply": result.get("reply"),
                 "calls": list(calls), "retrieval": list(retrieval), "requests": list(requests_seen),
                 "public": json.dumps(result)})
    for value in namespace.values():
        if isinstance(value, httpx.AsyncClient):
            asyncio.run(value.aclose())
        elif isinstance(value, requests.Session):
            value.close()
    guard = namespace.get("guard")
    if isinstance(guard, soter.AsyncSoter):
        asyncio.run(guard.aclose())

pins = []
for name, module in sorted(sys.modules.items()):
    if name == "soter" or name.startswith("soter."):
        file = getattr(module, "__file__", None)
        if file:
            file = Path(file).resolve()
            assert file.is_relative_to((root / "packages/python-sdk").resolve())
            pins.append({"path": str(file), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
print(json.dumps({"pins": pins, "rows": rows}))
