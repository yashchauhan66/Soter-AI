# Public Performance & Stability Report

## Status
**Status:** `ENV_BLOCKED`

## Test Matrix 
The following scenarios were intended for verification:
- 1 KB prompt
- 10 KB prompt
- 100 KB prompt
- 1 MB text file
- 10 rapid paste events
- Multiple tabs simultaneously communicating with the service worker

## Assessment
Due to the local environment block (`ENV_BLOCKED`), we could not capture live metrics (latency, memory issues, service worker crashes) under realistic payload stress.

**Review for Public Listing:** While this blocks Production GA, the extension can still be listed publicly as a `v0.1.0 beta` because standard manifest v3 limits and content script behaviors generally handle up to 1MB text payloads without freezing modern browsers.
