# F22h same-lineage design review (LOW)

Read-only review by checkpoint_tools, before implementation. No native execution or independent/human evidence.

- JSONC exceptions must use complete decoded structural paths: exact root servers/mcpServers labels and inputs[*].password/default context. Nested lookalikes must not inherit exemptions.
- MCP exact ${NAME} controls must not relax Editor's original finite reference grammar. Editor root token-color-map exemptions remain Editor-only.
- Finite TOML must distinguish quoted dotted names from dotted paths; refuse decoded duplicates, scalar/table collisions, table redefinitions, unsupported types and syntax before returning any plan.
- Preserve original offsets through multiline/CRLF/quoted material and comments; test masked reparse, idempotence, known-value residuals and exact checkpoint restoration.
- Validate marker/expression syntax before the common template exclusion policy. Reference-only env_vars/env_http_headers/bearer_token_env_var exceptions need exact server scope and identifier-only values; literal env/header lookalikes remain credential-bearing.
- Controller/flag withdrawal, malformed input, canonical encrypted custody and refusal of per-entry checkpoint recovery require integration assertions. No config execution or reference resolution is authorized.
