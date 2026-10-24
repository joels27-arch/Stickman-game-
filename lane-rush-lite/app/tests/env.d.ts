/// <reference types="@cloudflare/vitest-pool-workers/types" />

// Brings in the `cloudflare:test` module types (SELF, env, …). Note the
// `/types` subpath — the bare package name resolves to the pool
// implementation, not the test-runtime declarations.
