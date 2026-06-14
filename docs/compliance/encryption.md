# Encryption

- API keys, webhook secrets, one-time auth tokens, and SCIM tokens are never stored raw.
- Secret material can use Vault, AWS KMS, GCP KMS, or the local development provider.
- Local development secret storage is not allowed for production deployments.
- TLS termination should happen at a trusted reverse proxy, ingress, or cloud load balancer.

