# AgentSam Theme Tools / Rust Theme Machine

This workspace was generated with the existing AgentSam SDK command `agentsam rust new --template shared-core`.

The original lab path is retained to avoid creating another parallel Rust project, but the core is now organized around four portable capabilities:

- **harvest** — bounded, read-only extraction of resource references, semantic/declared section candidates, metadata, duplicate IDs, and basic HTML evidence.
- **inspect** — harvest plus truthful static diagnostics. It does not execute JavaScript or pretend to understand CSS/JS/Liquid semantics.
- **rewrite** — exact, allowlisted HTML resource-reference replacement.
- **verify** — structural HTML verification that catches element/marker/text/resource-shape drift after a proposed rewrite.

## Workspace

~~~text
rust/theme-rewriter-lab/
├── core/      # pure Rust + lol-html, no Cloudflare/customer dependency
└── worker/    # local-only Cloudflare Workers/WASM HTTP adapter
~~~

The architecture is:

~~~text
AgentSam Rust shared-core scaffold
        |
        v
portable theme-machine core
        |
        +-- lol-html parser/rewriter engine
        |
        +-- local Worker/WASM adapter
~~~

`lol-html` is a dependency inside the AgentSam Rust core. It is not a replacement for AgentSam Rust and it is not a second CMS or theme authority.

## Core limits and truthfulness

- Input HTML is bounded to 8 MiB per document.
- Harvest output is bounded to 4,096 unique findings.
- Exact rewrite rules are bounded to 500 entries.
- Harvesting does not make network requests.
- Uploaded/incoming JavaScript is never executed.
- The current Worker HTTP adapter buffers a bounded request body before calling the Rust core. The parser itself uses `lol-html`, but this endpoint is not yet a true chunk-by-chunk remote upload pipeline.
- Verification is explicitly `structural-html-only`; it is not visual-fidelity proof, JavaScript behavior proof, or CSS semantic proof.
- Source-aware byte ranges remain the responsibility of the Theme Tools syntax/parser layer. The streaming Rust pass is complementary evidence, not the canonical source editor.

## Local commands

From the Theme Tools repository root:

~~~sh
cargo test --locked --manifest-path rust/theme-rewriter-lab/Cargo.toml
node ~/agentsam-sdk/src/cli.js rust check --cwd rust/theme-rewriter-lab
node ~/agentsam-sdk/src/cli.js rust build --cwd rust/theme-rewriter-lab
node ~/agentsam-sdk/src/cli.js rust dev --cwd rust/theme-rewriter-lab
~~~

When Wrangler is running locally:

~~~sh
node scripts/smoke-rust-rewriter.mjs
~~~

The smoke verifies the complete local HTTP contract:

~~~text
harvest -> inspect -> rewrite -> verify
~~~

## HTTP endpoints

All mutation/analysis POST endpoints are local-only in this adapter.

- `GET /health`
- `POST /v1/harvest`
- `POST /v1/inspect`
- `POST /v1/rewrite`
- `POST /v1/verify`

Example harvest request:

~~~json
{
  "html": "<section data-cms-section=\"hero\"><img src=\"/hero.webp\"></section>",
  "source_url": "https://example.test/"
}
~~~

Example exact rewrite request:

~~~json
{
  "html": "<img src=\"old.png\">",
  "rules": [
    {
      "attribute": "src",
      "from": "old.png",
      "to": "new.png"
    }
  ]
}
~~~

## What this does not own

This Rust core does **not** own:

- CMS persistence or page authority
- canonical section/site contracts
- network crawling or SSRF policy
- browser rendering
- CSS/JS/Liquid AST semantics
- theme publication
- customer-specific configuration
- production Worker ingress/authentication

Those remain separate versioned boundaries in AgentSam Theme Tools and the existing SDK/CMS packages.

## Production status

This Worker remains intentionally local-only: `workers_dev = false` and no custom routes are configured.

Do not deploy this adapter as production ingress until authentication, request accounting, streamed upload handling, cross-runtime parity, and visual/runtime verification gates are complete.
