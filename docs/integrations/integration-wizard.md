# Dashboard Integration Wizard

Route:

```text
/dashboard/integrations
```

The wizard lets a signed-in user:

- Select a platform.
- Select a project.
- Select an API key prefix.
- Copy environment variables.
- Copy server-side code snippets.
- Test the base URL health endpoint.
- Send a public analyzer test prompt.

The dashboard never retrieves stored raw API keys. Users must copy new keys at creation time and keep them server-side.
