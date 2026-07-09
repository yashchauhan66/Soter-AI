# Vendor Risk Register

**Date:** 2026-07-09

## Overview

This document tracks third-party vendors and their associated risks.

## Vendors

### Infrastructure

| Vendor | Service | Risk Level | Mitigation |
|---|---|---|---|
| Neon | PostgreSQL hosting | MEDIUM | SSL connections, backup strategy |
| Qdrant | Vector database | MEDIUM | Self-hosted option, namespace isolation |
| Vercel | Deployment platform | LOW | Standard SLA, SOC2 compliant |
| Docker | Container runtime | LOW | Local deployment, no cloud dependency |

### Payment

| Vendor | Service | Risk Level | Mitigation |
|---|---|---|---|
| Razorpay | Payment processing | MEDIUM | HMAC verification, no card data stored |

### Communication

| Vendor | Service | Risk Level | Mitigation |
|---|---|---|---|
| Resend | Transactional email | LOW | Minimal data, no secrets in emails |

### Development

| Vendor | Service | Risk Level | Mitigation |
|---|---|---|---|
| GitHub | Source control | LOW | Branch protection, code review |
| npm | Package registry | LOW | 2FA, package signing |

## Risk Assessment Criteria

| Level | Description | Action |
|---|---|---|
| LOW | Standard vendor, minimal data access | Monitor annually |
| MEDIUM | Handles sensitive data or critical service | Review quarterly |
| HIGH | Core to security or handles RESTRICTED data | Review monthly |

## Vendor Requirements

All vendors must:
- Have SOC2 or equivalent certification (or be evaluated for alternatives)
- Support TLS 1.2+ for all connections
- Provide data processing agreements
- Notify within 72 hours of security incidents
- Support data deletion requests
