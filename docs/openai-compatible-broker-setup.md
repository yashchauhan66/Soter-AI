# OpenAI-Compatible Broker Setup

1. In a trusted VS Code workspace, run `SoterAI: Configure AI Broker`.
2. Keep the default port or choose a local port from 1024–65535.
3. Set the full upstream chat-completions endpoint, for example `https://api.openai.com/v1/chat/completions`.
4. Enter the provider key. It is stored in VS Code SecretStorage.
5. Run `SoterAI: Start Local AI Broker` and then `SoterAI: Test Broker Protection`.
6. Run `SoterAI: Copy OpenAI-Compatible Broker URL`. Configure the AI tool's base URL as:

```text
http://127.0.0.1:47321/v1/ai/openai-compatible
```

The resulting chat endpoint is `/v1/ai/openai-compatible/chat/completions`. The tool must send the local broker bearer token; the extension does not display that token. For standalone integrations, use a separately generated token from your local secure configuration and pass a provider key through `x-soterai-provider-key` or broker environment configuration.

The MVP accepts non-streaming JSON chat completions. `stream: true` is rejected. System, developer, user, assistant, tool, and function text is scanned. Secret-bearing content is redacted or blocked; provider responses are scanned before return.

Changing only a tool's base URL is not enough if it cannot attach the broker authorization header. Use a supported wrapper/integration in that case.
