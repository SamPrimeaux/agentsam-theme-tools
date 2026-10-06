# AgentSam Theme Tools / Rust HTML Rewriter Lab

Generated initially using the existing AgentSam SDK `agentsam rust new --template shared-core`.
The generated example normalizer has been replaced by a customer-neutral HTML rewriting core.

- `core/` is pure Rust + `lol-html` with **no Cloudflare or customer dependencies**.
- `worker/` exposes the core through a **local-only** Workers testing adapter.
- Deployment is not configured; `workers_dev = false` and no external routes.
- No CMS, page authority, brand asset state, merchant catalog, credentials, or third-party publishing.

## Tests

From the Theme Tools repository root:

```sh
cargo test --manifest-path rust/theme-rewriter-lab/Cargo.toml
node ~/agentsam-sdk/src/cli.js rust check --cwd rust/theme-rewriter-lab
node ~/agentsam-sdk/src/cli.js rust build --cwd rust/theme-rewriter-lab
node ~/agentsam-sdk/src/cli.js rust dev --cwd rust/theme-rewriter-lab
```

On a locally running Wrangler server:

```sh
curl -fsS http://127.0.0.1:8787/health
curl -fsS -X POST http://127.0.0.1:8787/v1/rewrite \
  -H 'content-type: application/json' \
  -d '{"html":"<img src=\"old.png\">","rules":[{"attribute":"src","from":"old.png","to":"new.png"}]}'
```

Only exact matches for the `href`, `src`, `poster`, and `data-src` attributes are supported.
Content transformations are never executed as JavaScript. Source provenance, streaming
large documents, cross-runtime result equivalence, and production authorization remain
separate acceptance gates. The core has independent tests; the Worker provides HTTP tests.

**Do not deploy this local-only lab.** Production authorization must be completed first.
