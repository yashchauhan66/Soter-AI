# Kubernetes Deployment

The Helm chart in `helm/cyberrakshak` deploys the web app, worker, service, ingress, config map, secrets, and migration job.

Recommended production controls:

- Terminate TLS at ingress.
- Keep Postgres, Redis, vector DB, and object storage private.
- Use external managed Postgres and Redis when available.
- Store secrets in the cluster secret manager or external secrets operator.
- Run `helm template` and policy checks before deploy.

Example:

```sh
helm upgrade --install cyberrakshak ./helm/cyberrakshak \
  --namespace cyberrakshak --create-namespace \
  --set image.repository=registry.example/cyberrakshak \
  --set image.tag=2026.06.14
```

