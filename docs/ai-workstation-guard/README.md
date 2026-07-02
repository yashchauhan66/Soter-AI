# AI Workstation Guard

Soter uses four cooperating layers:

1. The browser extension activates only on enabled public AI, coding, local UI, and custom destinations.
2. Official IDE extensions protect editor-native AI workflows.
3. The transparent Local Agent/Proxy protects explicitly routed local LLM, CLI, and n8n traffic.
4. The Admin AI Destinations and policy builders publish tenant-scoped rules to every device.

See [Local Agent and Proxy architecture](./local-agent-proxy.md) and [IDE extensions and CLI Guard roadmap](./ide-and-cli-roadmap.md).

## Privacy and deployment boundaries

- Metadata-only logging is the default. Raw secrets are not stored by default.
- Browser listeners initialize only when the current URL matches an enabled organization destination and employee scope.
- Browser code cannot protect native desktop or direct API traffic. Those paths require an official plugin, wrapper, or Local Agent.
- Enterprise enforcement and non-removal must use documented browser/OS/MDM policies. All components remain visible, support health/status reporting, and provide a normal uninstall path.
