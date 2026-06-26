# SoterAI — Support Information

> For marketplace listings, app review submissions, and help pages.

---

## Support channels

| Channel | Contact | Response time |
|---------|---------|---------------|
| Email | support@soterai.dev | 24-48 hours |
| Security issues | security@soterai.dev | 24 hours |
| Privacy questions | privacy@soterai.dev | 48 hours |
| GitHub Issues | github.com/SoterAI | Community response |
| Documentation | docs.soterai.dev | Self-service |

## Documentation

- **Getting started**: docs.soterai.dev/quickstart
- **API reference**: docs.soterai.dev/api
- **Integration guides**: docs.soterai.dev/integrations
- **Dashboard guide**: docs.soterai.dev/dashboard
- **Security best practices**: docs.soterai.dev/security

## Common issues

### "Invalid API key" error
- Verify your API key starts with `sk_`
- Check the key hasn't been revoked in the dashboard
- Ensure the key is for the correct project

### "Request timed out" error
- Check your network connectivity
- The default timeout is 8 seconds — increase if on a slow connection
- Check the SoterAI status page for outages

### "Rate limit exceeded" error
- Free tier: 100 requests/month
- Check your current usage on the dashboard
- Upgrade your plan or wait for the rate limit to reset

### Integration node not appearing
- n8n: Restart n8n after installing the community node
- Flowise: Restart Flowise after copying custom nodes
- Langflow: Restart Langflow after adding components

## Pricing

- **Free tier**: 100 checks/month, 1 project, community support
- **Pro tier**: Higher limits, priority support, advanced analytics
- **Enterprise**: Custom limits, SLA, dedicated support, self-hosted option
- See soterai.dev/pricing for current plans
