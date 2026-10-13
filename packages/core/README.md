# SoterAI local core

Host-free source exports for the Lite/Full bundlers and TypeScript consumers.
This private package keeps the existing `@soterai/guard-core` ABI; it is named
`@soterai/local-core` because the existing SDK already uses `@soterai/core`.

`main` is TypeScript source, not a standalone Node runtime entry. Lite inlines
the actual reachable implementation during its build and needs no additional
runtime package installation. Plain-Node consumers must bundle or compile it.
