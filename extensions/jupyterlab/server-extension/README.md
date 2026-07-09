# Planned Jupyter server extension (token proxy)

Status: **PLANNED / UNBUILT note only.** No Python package is implemented here.

## Why it exists

The frontend adapter runs in the browser. Two problems make a browser-held
broker token unacceptable:

1. **Secret exposure.** Browser storage (localStorage / settings) is not a safe
   vault for a long-lived bearer token.
2. **Topology.** For remote or hosted Jupyter, the browser's `127.0.0.1` is the
   user's laptop, not the machine running the kernel/broker. Direct loopback
   calls do not work there.

## Design

A small `jupyter-server` extension running on the **same host as the broker**:

- Registers authenticated handlers under a base route, e.g. `/soterai/broker/*`.
  JupyterLab's own XSRF/token auth protects these routes.
- On each call, reads the broker token from `~/.soterai/broker/auth-token` (or
  the OS keyring), attaches `Authorization: Bearer <token>`, and forwards to the
  loopback broker `http://127.0.0.1:47321`. The token never reaches the browser.
- Passes through only the contract endpoints the frontend needs
  (`/v1/scan`, `/v1/redact`, `/v1/safe-mode/status`, `/health`) and forwards the
  broker's already-redacted JSON responses unchanged.
- Never logs the token or the request bodies.

The frontend selects this path with the default setting `useServerProxy: true`
and `ServerProxyTransport` (see `src/broker.ts`), which points at
`/soterai/broker` and lets the server attach the token.

## Minimal shape (to implement in the real build)

```
soterai_jupyterlab_guard/
  __init__.py            # _jupyter_server_extension_points()
  handlers.py            # ExtensionHandlerMixin + JupyterHandler subclasses
  proxy.py               # read token, forward to loopback broker, return JSON
```

Packaged together with the prebuilt labextension in one pip-installable
distribution (`pip install soterai-jupyterlab-guard`), so enabling the server
extension and shipping the frontend assets is a single install step.

## Acceptance before shipping

- Handlers require Jupyter auth; unauthenticated calls are rejected.
- The token appears in no log, no browser payload, and no error response.
- Remote-server smoke test confirms the browser makes no direct `127.0.0.1`
  broker call.
