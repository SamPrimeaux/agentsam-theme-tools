# Implementation status and authority boundaries

Initial milestone branch: feat/foundation-source-intake-html-20261006.

## Implemented in this milestone
- Customer-neutral SourceInput types with paths, bytes, Blob, stdin and explicit URL/provider adapters.
- HTML syntax analysis with parse errors, source ranges, declared/semantic section detection and resource references.
- Source-preserving HTML asset attribute rewrites and guarded named-section content patches.
- Optional Cloudflare Workers streaming HTMLRewriter adapter. Core analysis does not depend on it.
- Theme graph resolving local resources and reporting missing referenced assets.
- Node archive adapters for ZIP, TAR and TAR.GZ, reading in memory without archive extraction.
- CLI entrypoint for ingest, inspect, graph and check, with structured JSON output.
- Test fixtures exercising unrelated source contents and malformed archive handling.

## Incomplete; do not claim complete
- Git bundle intake currently verifies and inventories heads from local source; no history extraction or theme conversion.
- Browser File drag/drop and Local Studio terminal PTY upload/transfer bridges are not yet wired. The shared SourceInput contract is prepared.
- CodeMirror, Monaco, LSP, JSONC, Liquid, CSS semantic graph, full HTML transform planning and visual fidelity require full implementation.
- Source rewrites are targeted supported operations, not a generic WYSIWYG editor or complete HTMLRewrite parity.
- Package publication and hosted/site integrations are not enabled.
- No CMS schema or publisher is owned here; source interoperability is via explicit adapters.

## SDK integration decisions
- Consume versioned APIs from agentsam-brand, agentsam-content, agentsam-repository, agentsam-site-scrape, theme-scenes and cms-runtime where audited and available.
- Never vendor SDK private implementation or create a second CMS content authority.
- Existing SDK ingestion and archive tests are candidates for contract-equivalence tests, not an implicit runtime dependency.
- Customer fixtures must not be embedded as production defaults.

## Required next acceptance gates
- Consolidate archive policy and add tested Git bundle history inspection under isolated execution.
- Wire native and web dropzones through transferable bytes and a consented local/remote terminal staging adapter.
- Add source-preserving CSS/JS/Liquid analysis and a versioned neutral theme intermediate representation.
- Add browser/rust/cloudflare rewrite contract parity tests.
- Verify packaged-install operation and two distinct site consumers before release.
