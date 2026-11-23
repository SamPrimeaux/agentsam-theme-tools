# Rust theme machine contract

The Rust theme machine is the portable execution layer inside AgentSam Theme Tools. It was scaffolded by AgentSam Rust using the existing `shared-core` template and currently lives under `rust/theme-rewriter-lab` while the contract is proven.

## Ownership

The Rust core owns bounded HTML streaming-parser operations:

1. **Harvest** — collect static HTML evidence without executing source code.
2. **Inspect** — derive truthful diagnostics from that evidence.
3. **Rewrite** — perform exact allowlisted resource-reference rewrites.
4. **Verify** — check structural HTML invariants after a proposed rewrite.

The Rust core does not own source acquisition, CMS persistence, theme publication, canonical SiteDocument/section schemas, browser rendering, or cross-language AST semantics.

## Why lol-html

`lol-html` is the HTML engine used by the portable Rust core. It provides low-buffering selector-driven HTML parsing/rewriting and is also the engine behind Cloudflare's HTML rewriting model. It is a dependency of AgentSam Rust, not a competing scaffold.

Theme Tools still keeps source-aware parsers for precise file/range edits. The Rust pass is optimized for fast evidence collection, bounded transforms, and cross-runtime execution.

## v1 contracts

### Harvest

Input:

~~~json
{
  "html": "<html>...</html>",
  "source_url": "https://example.test/"
}
~~~

Output schema: `agentsam.theme-harvest.v1`.

Current evidence includes:

- doctype presence
- element count
- title, description, canonical URL, language
- links, scripts, stylesheets, media and responsive image candidates
- inline style URL references
- semantic and declared section candidates
- duplicate IDs
- images missing an alt attribute
- inline script/style counts
- structural and text fingerprints
- explicit truncation state

Raw resource values are preserved. URL normalization/base resolution belongs to the acquisition/source layer so this core does not silently rewrite provenance.

### Inspect

Output schema: `agentsam.theme-inspect.v1`.

Inspection wraps the harvest receipt and adds bounded diagnostics such as missing doctype/title/description, duplicate IDs, missing image alt attributes, inline scripts/styles requiring deeper language analysis, and truncated evidence.

A clean inspection result is not equivalent to a portable theme verdict.

### Rewrite

Output schema: `agentsam.theme-html-rewriter.v1`.

Current rewrite support is intentionally narrow:

- exact `href`
- exact `src`
- exact `poster`
- exact `data-src`

Replacement rules reject dangerous URL schemes and oversized requests. No uploaded JavaScript is executed.

### Verify

Output schema: `agentsam.theme-verify.v1`.

The current scope is explicitly `structural-html-only`. It compares:

- element structure fingerprint
- text fingerprint
- section-candidate shape
- resource-reference shape
- page metadata

Resource values may change while the surrounding resource shape remains stable. This is useful for validating exact asset/link rewrites, but it does not prove CSS, JavaScript, Liquid, responsive, animation, or visual equivalence.

## Runtime adapters

~~~text
AgentSam Rust shared-core
        |
        v
theme machine core (Rust + lol-html)
        |
        +-- native CLI/desktop consumer (planned)
        +-- local Worker/WASM adapter (implemented)
        +-- browser/WASM consumer (planned)
~~~

All consumers should eventually emit equivalent versioned receipts for the same fixture. Runtime-specific features must not silently change the meaning of the core contracts.

## Release gates

The Rust theme machine is not production-ready until all of the following are demonstrated:

- true chunked input/output streaming through public runtime adapters
- Cloudflare/Rust/browser contract parity
- explicit URL/base-resolution policy with acquisition provenance
- CSS/JS/Liquid semantic integration through Theme Tools parser providers
- isolated original/transformed preview comparison
- two independent site consumers
- authenticated/accounted production ingress if a hosted Worker is ever exposed

Until those gates pass, the Worker stays local-only and the Rust result is one evidence layer inside Theme Tools, not a standalone CMS or deployment service.
