# Soter Guard — Langflow Integration Guide

## Overview

Python components for Langflow with zero external dependencies. Uses standard library `urllib` to call the Soter REST API.

## Quick Start

1. Copy `soter_guard_component.py` to your Langflow custom components directory
2. Restart Langflow
3. Drag Soter components into your flow

## Components

- **SoterInputGuard** — check user input before LLM
- **SoterOutputGuard** — check AI output before delivery
- **SoterPiiRedactor** — redact PII from any text
- **SoterRagScanner** — scan documents before vector DB indexing

See [Langflow README](../../packages/integrations/langflow/README.md) for details.
