# Agent Firewall Approvals

High-risk actions return:

```json
{
  "decision": "ASK_APPROVAL",
  "requiredApproval": {
    "message": "Human approval required...",
    "approvalToken": "af_..."
  }
}
```

Approval tokens are returned once and stored only as hashes. Raw secrets and API keys are not logged.

To resolve:

```http
POST /api/agent/approval/resolve
x-api-key: ck_test_...
```

```json
{
  "approvalToken": "af_...",
  "decision": "APPROVED"
}
```

If approved, execute only the exact reviewed action. If denied, expired, invalid, or rate-limited, do not execute.
