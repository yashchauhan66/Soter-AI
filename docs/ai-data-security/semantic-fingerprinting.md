# Semantic Fingerprinting

**Status: DEFERRED WITH CLEAR LIMITATION in v0.1.0 beta**

## Current Implementation
In v0.1.0 beta, "fingerprinting" relies on exact hash matching, regex rules, and literal text lineage tracking (via clipboard). We do not currently use embedding models or vector similarity to detect semantically similar text.

## Limitations
- Variations of sensitive text (e.g., rephrasing) may not be caught if they evade regex or exact hash matching.
- Vectors are not stored or queried.

## Future Plans (GA Readiness)
We plan to introduce local-only embedding extraction (using a lightweight ONNX model in the browser via WASM) to generate vectors of prompts. These vectors will be compared against a tenant-scoped database of known sensitive vectors (stored in the extension's local storage or queried via a privacy-preserving homomorphic encryption technique). 
Until this is implemented safely without exposing data to third-party embedding APIs, it is deferred.
