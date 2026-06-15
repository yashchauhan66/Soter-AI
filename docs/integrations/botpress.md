# Botpress Integration Guide

Add CyberRakshak Guard as a pre-processing and post-processing HTTP step in owned Botpress workflows.

- Input step: call `/api/guard/input`.
- Output step: call `/api/guard/output`.
- Block or human-review responses when the guard action is `BLOCK` or `HUMAN_REVIEW`.
- Store only the public guard result in Botpress logs.

This is a defensive integration guide and does not claim complete protection.

