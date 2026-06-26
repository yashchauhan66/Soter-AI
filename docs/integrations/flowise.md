# Soter Guard — Flowise Integration Guide

## Overview

Custom Flowise tool nodes that protect your chatbot flows. Drop them before and after your LLM node to guard against prompt injection, PII leakage, and unsafe AI outputs.

## Quick Start

1. Copy `packages/integrations/flowise/src/SoterInputGuard.ts` to your Flowise custom nodes
2. Restart Flowise
3. Drag nodes from the **Security** category into your flow

## Protected Flow Pattern

```
[Chat Input] → [Soter Input Guard] → [ChatOpenAI] → [Soter Output Guard] → [Chat Output]
```

See [Flowise README](../../packages/integrations/flowise/README.md) for details.
