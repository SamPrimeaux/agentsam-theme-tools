# Shopify Theme Tools → AgentSam capability map

**Research baseline (2026-10-07):** Reviewed [Shopify/theme-tools README](https://github.com/Shopify/theme-tools), package manifests and README files for Liquid/HTML parser, Prettier plugin, Theme Check, language server, graph, JSONC CodeMirror support, and CodeMirror client. This document describes **conceptual equivalents, not API compatibility**. See [Product Charter](PRODUCT_CHARTER.md).

Shopify's model is a monorepo of modular developer experience packages, with a runtime-independent engine separated from Node/browser integrations and editing clients. It is not a mandate to reconstruct Shopify's whole commerce platform. Its editor and CLI are consumers of developer tooling.

## Reference package map

| Shopify package / responsibility | AgentSam owner / intended equivalent | Status 2026-10-07 | High-level company benefit / next proof |
|---|---|---|---|
| [liquid-html-parser](https://github.com/Shopify/theme-tools/tree/main/packages/liquid-html-parser): shared Liquid+HTML source AST | \`theme-syntax-html\` plus planned Liquid-aware syntax package | **HTML subset verified; Liquid absent** | One source/range model reused by formatter, checker, LSP and sections; parse mixed Liquid/HTML without two incompatible ASTs |
| [prettier-plugin-liquid](https://github.com/Shopify/theme-tools/tree/main/packages/prettier-plugin-liquid): formatting | Theme formatter/plugin and source edit core, preferably existing Prettier ecosystem | **Missing** | Developers can format real templates predictably; format-on-save/diff is consistent across editors |
| [theme-check-common](https://github.com/Shopify/theme-tools/tree/main/packages/theme-check-common): portable diagnostics | Planned \`theme-check-core\` composed from syntax/graph/schema rules | **Missing** | One diagnostic rule engine shared by CI, AgentSam agents, and the editors |
| [theme-check-node](https://github.com/Shopify/theme-tools/tree/main/packages/theme-check-node): Node adapter | CLI/Node checker wrapper over common rule engine | **Missing** | Real deterministic local + CI theme checking |
| [theme-check-browser](https://github.com/Shopify/theme-tools/tree/main/packages/theme-check-browser): browser adapter | Browser Worker/SPA adapter using injected file/schema providers | **Missing** | CMS catches errors without a server-side parser fork |
| [theme-graph](https://github.com/Shopify/theme-tools/tree/main/packages/theme-graph): cross-language dependencies/references | \`theme-graph\` | **Basic HTML references verified; semantic graph missing** | Make hidden CSS, JS, Liquid, blocks and media dependencies visible before extracting/reusing components |
| [theme-language-server-common](https://github.com/Shopify/theme-tools/tree/main/packages/theme-language-server-common): LSP | Planned \`theme-language-server-core\` | **Missing** | Completion, hover, references, navigation, fixes, diagnostics reuse one intelligence engine |
| [theme-language-server-node](https://github.com/Shopify/theme-tools/tree/main/packages/theme-language-server-node): Node LSP host | AgentSam CLI/desktop process or daemon transport | **Missing** | Agents and local code editors consume the same LSP contracts |
| [theme-language-server-browser](https://github.com/Shopify/theme-tools/tree/main/packages/theme-language-server-browser): browser LSP host | Worker/Web Worker browser host | **Missing** | Hosted CMS/editor parity with desktop without a Node runtime |
| [codemirror-language-client](https://github.com/Shopify/theme-tools/tree/main/packages/codemirror-language-client): editor LSP client | Reuse existing editor bridge, probably via \`agentsam-ide\`, not a new editor app | **Not integrated** | Language features directly inside existing CMS/Local Studio editing surfaces |
| [lang-jsonc](https://github.com/Shopify/theme-tools/tree/main/packages/lang-jsonc): CodeMirror JSONC language support | \`@inneranimalmedia/lang-jsonc\` semantic JSONC API **plus future CodeMirror adapter** | **Syntax, format, source edits verified; CodeMirror adapter missing** | Safely read/update theme settings, section configuration and manifests while preserving comments |
| [vscode-extension](https://github.com/Shopify/theme-tools/tree/main/packages/vscode-extension): end-user editor integration | AgentSam Local Studio, existing CMS editors, optional IDE extension | **Missing** | A polished developer experience without requiring a second AgentSam CMS |

Shopify's graph includes **dependencies and backlinks across Liquid, JSON, JavaScript and CSS**; ours currently reports primarily HTML references. Shopify's JSONC package is **CodeMirror grammar support**; ours is **syntax/semantic JSONC editing**. Those similarly named packages are not feature-equivalent yet.

Shopify's linter identifies syntax/semantic errors and best-practice issues rather than simply summarizing parser diagnostics; see [official Theme Check documentation](https://shopify.dev/docs/storefronts/themes/tools/theme-check). That is a critical difference from our current \`agentsam-theme check\` command.

## Our seven currently implemented npm workspaces

| Our package | Why it exists (architectural decision) | Benefit when finished | Current proven behavior; what it does **not** do |
|---|---|---|---|
| \`@inneranimalmedia/theme-source-input\` | Transport-neutral entrypoint for paths/bytes/Blob/stdin/external provider refs | One source adapter for Mac CLI, Desktop, web drag-drop, SDK and approved connectors | Normalizes source inputs; does not provide GUI drop zones, PTY file transfer, or authorized web acquisition by itself |
| \`@inneranimalmedia/theme-source-ingest\` | Recognize/read ZIP, TAR, TAR.GZ, directory, HTML, selected Git bundle snapshot with limits | Inspect arbitrary development artifacts safely and independently of a customer app | Inventory/archive bounds and single Git snapshot; no permanent import receipt, full Git history or complete bundle analysis |
| \`@inneranimalmedia/theme-syntax-html\` | HTML parse/locations/semantic tags and explicit section markers | Shared source navigation and editable-region detection | Reports real locations, references and candidates; cannot infer full component behavior or bundled SPA contents |
| \`@inneranimalmedia/lang-jsonc\` | Normalize JSONC parse, diagnostics, locations, edit and formatting API over \`jsonc-parser\` | Source-safe settings editing in GUI, CLI, IDE and agent automation | Comment/trailing comma parse; targeted edits; *not* a schema validator, language server or CodeMirror syntax extension |
| \`@inneranimalmedia/theme-graph\` | Portable file/HTML reference graph with hashes and missing-resource diagnostics | Impact analysis, portable dependency packaging, safe delete/extract plans | HTML asset graph subset; not a complete CSS/JS/Liquid import graph, reverse references or semantic entry points |
| \`@inneranimalmedia/theme-html-rewriter\` | Targeted original-source HTML asset/section changes + optional Workers HTMLRewriter | Reversible asset remaps and explicitly approved section edits | Narrow safe operations, not an arbitrary visual page conversion engine |
| \`@inneranimalmedia/theme-cli\` | Deterministic human + JSON access to shared ingest operations | One command surface for local users, CI and agents | \`ingest/inspect/graph/check\`; only a summary/report today, no stored artifact, TUI or real Theme Check rule catalog |

The seven packages have passed an external npm tarball install smoke test and 23 Node tests. This **proves packaging and tested subsets**, not an integrated product.

## Rust adapter, deliberately outside the seven npm packages

\`rust/theme-rewriter-lab/core\` uses \`lol-html\` to perform exact \`href\`/\`src\`/\`poster\`/\`data-src\` rewrites with rule/size bounds. Its Worker adapter has passed Rust tests, a Wasm check, and local HTTP smoke tests against a small JavaScript reference fixture. It is **not** deployed, and it does not replace the JavaScript source-patch engine or Shopify-like language tooling. Before general reuse, both rewrite engines need canonical semantics and cross-runtime conformance tests.

## Existing AgentSam infrastructure we must consume, not reimplement

| Existing authority | Integration target | Reuse boundary |
|---|---|---|
| \`agentsam-brand\` BrandPack | Semantic style tokens and brand asset roles | Theme Tools reads/validates/references versions; BrandPack owns identity |
| \`agentsam-content\`, \`agentsam-assets-core\`, ecommerce media-kit | Media identity, processing, lifecycle | Theme Tools links source references to media authorities; no second media database |
| \`agentsam-repository\` | Repository fingerprints, change detection/provenance | Reuse its exported revision identities rather than competing Git/Merkle provenance |
| \`theme-scenes\`, \`agentsam-sections\` | Existing scene/motion/section implementations | Treat as source and render-contract candidates; not automatically the canonical persisted schema |
| \`cms-runtime\`, \`inneranimalmedia-cms/packages/site-contracts\`, \`section-library\` | Canonical site document, typed section definitions, publication | Theme Tools creates compatibility proposals/adapters; CMS owns drafts, pages and publishing |
| \`agentsam-ide\`, AgentSam Local Studio | Existing IDE and desktop surfaces | Add language clients/adapters to existing UI, never create another isolated editor |
| \`agentsam-site-scrape\`, \`agentsam-abs\` | Authorized acquisition and optional original preview | Neither network access nor untrusted script execution is a core parser side effect |

Check each existing API on its own current main branch before importing; a package name or an isolated test does not establish packaged consumer readiness.

## Guardrails for naming and implementations

- Existing \`check\` and \`graph\` commands must explicitly describe **which** checks/edges exist. No empty-diagnostics = ready-to-ship claims.
- Keep \`lang-jsonc\` as a neutral *semantic service*, add optional CodeMirror grammar and schema-completion adapters rather than presenting the current interface as a full editor.
- Do not rename API packages for aesthetics or ship parallel “v2” editors. Prefer documented stable API evolution + semver deprecation.
- Do not take dependencies on private absolute SDK paths or deep imports into customer applications. Test independently packed artifacts.
- For each proposed capability, require: real source, runnable test, independent consumer, versioned output shape, and documented limitations. Otherwise label **proposed**.

Reference dates and links are a comparative baseline, not a claim to track future Shopify upstream changes automatically.
