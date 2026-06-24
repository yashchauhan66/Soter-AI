# Chatbot Performance Report

This report evaluates guard latencies, mock LLM timings, and overall overhead.

## Latency Metrics

- **Average Latency for Blocked Prompts**: 3282.0 ms (LLM call skipped)
- **Average Latency for Safe Prompts**: 6613.8 ms (includes mock LLM execution and double guard overhead)

## Observations
- Blocked prompts return significantly faster because the LLM is not called.
- Guard API adds a small overhead of ~1-2ms for processing rules local to the server.
- Turbopack cold start compile times for endpoints are excluded from averages.
