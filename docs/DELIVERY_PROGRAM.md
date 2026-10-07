# Delivery program and acceptance gates

**Status: planning contract, NOT evidence of implementation.**  
**Primary intent:** Build one Shopify Theme Tools–class **developer tooling platform**, not isolated demonstrations, endless UI passes, or cloned CMS editors.  
**Authority:** [Product Charter](PRODUCT_CHARTER.md) → [Shopify Capability Map](SHOPIFY_CAPABILITY_MAP.md) → this delivery program → factual [Implementation Status](IMPLEMENTATION_STATUS.md).

## 1. Definition of finished (product-level)

A versioned Theme Tools release is **finished** only when a developer, the AgentSam CLI, and an independent application consumer can use the same source project to:

1. Select and read **only the requested source scope** (ZIP, single document, folder, or explicitly selected repository).
2. Obtain a versioned, inspectable source snapshot/receipt with hashes, language coverage, analysis limitations, file inventory and source ranges.
3. See accurate cross-file source graph edges and references across supported HTML/Liquid/CSS/JS/JSONC modules; unsupported cases are explicitly reported.
4. Run meaningful, documented Theme Check-style rules and reproduce the same diagnostics and fixes in the CLI, desktop, and browser consumer.
5. Format and edit supported source with deterministic diffs, syntax/semantic validation, safe fallback, and no unrequested execution/mutation.
6. Use a shared LSP service for completion, hover, diagnostics, navigation and code actions in at least a Node editor and a browser editor.
7. Compare an original isolated preview to an explicitly proposed transformed/packaged result; **no generic replacement of the original design or interactions**.
8. Verify one portable, reusable section/theme artifact through the **existing canonical CMS/site contracts** and another independent consumer.
9. Install published or packed packages in a clean project; pass compatibility/portability tests without private SDK paths or customer keys.
10. Reproduce end-to-end success through documented test commands, deterministic fixtures, release CI and clear fail/unsupported reports.

A passing archive count, Rust WebAssembly compilation, or clean CLI test is **one input to the release gate**, not completion of the above.

## 1A. Immediate engineering focus — reversible source-to-package extraction

This is the **next engineering focus**, not a new GUI or another CMS. A developer should turn a selected legacy ZIP/HTML/Liquid source into an inspectable candidate with a truthful dependency closure and reviewable portability proposal.

    Selected ZIP | directory | HTML | Liquid
      -> scoped virtual source and snapshots
      -> source-range ASTs (HTML, CSS, JS, JSONC, Liquid)
      -> cross-language graph: entry points, modules, direct/preset/indirect references
      -> closure(entry) + backlinks + missing/unknown dependency evidence
      -> candidate package (tokens, styles, behavior, media, renderer contract)
      -> opt-in source edits + versioned manifest
      -> original vs target isolated preview and cross-host verification
      -> approved portable section/theme/scene or explicit needs-review verdict

**Important:** A transitive closure of only recognized edges is NOT a verified portable package. Unknown dynamic selectors, shared global CSS, runtime side effects, external services/fonts, Liquid data objects, and scroll/reduced-motion behavior need explicit evidence/coverage and can block portability claims.

### Build-vs-adopt and package ownership

- Extend existing @inneranimalmedia/theme-graph, do not fork a new graph package. Add rootUri, entry points, typed module URIs/kinds, source/target ranges, inbound and outbound edges, direct/preset/indirect relationships, cycle-safe closure and change impact APIs. Incomplete coverage must travel with every result.
- Keep existing @inneranimalmedia/theme-syntax-html as the HTML analyzer. Add a parser-provider interface for CSS, JS, Liquid and embedded formats. Adopt maintained parsers; consider @shopify/liquid-html-parser as a well-scoped dependency after evaluating its license, public API and runtime cost. Do NOT copy its handwritten tokenizer/factories into our codebase.
- Liquid is an **input language** even if the existing CMS runtime does not evaluate Liquid. Donor Liquid must be parsed and safely converted into a target-specific renderer, with unsupported dynamic behavior disclosed.
- Inline CSS/JS and serialized bundles need nested source ranges. Never execute uploaded JavaScript to discover its internals; unsupported packed formats are flagged as unknown.
- Adopt Prettier and an optional compatible Liquid plugin for standalone formatting. Keep format-only edits separate from structural changes and never auto-format an imported design without approval.
- Build Theme Check-like rule/fix APIs and independently runnable diagnostics. Only call a check verified for its actual language coverage.
- Keep Rust/lol-html as an optional rewriting execution engine with conformance tests; the cross-language parser/graph and package contract remain runtime-neutral.

### Verified existing site/section authority

The actual Inner Animal CMS repository has multiple **related but distinct** contracts under packages/site-contracts:

- src/site-document.ts: SiteDocument v1 with SiteSection (id, type, preset, settings, blocks, data).
- src/index.ts: SectionInstance, SectionPreset, LayoutManifest, responsive/motion policies and ThemeManifest for renderers.
- src/content-templates.ts: CmsPageTemplate, assignments, bindings, renderer locks.
- src/content-bindings.ts: ContentDefinition, ContentEntry, typed source bindings, RendererLock.
- packages/section-library owns registered section renderers; packages/revise-theme owns presentation character.

Theme Tools should emit a neutral source-backed candidate, plus a separate versioned **compatibility adapter** mapping its inspected component into those existing contracts. Do not serialize an inferred HTML section directly as a CMS section or add another persisted schema.

### Decisions for the four previously open questions

1. **Liquid vs HTML:** Current native CMS and AgentSam SDK sources examined use TypeScript/HTML and no checked-in Liquid templates were discovered; HOWEVER donor Liquid is expressly in scope. Support Liquid as an import language; native CMS output remains its actual typed site contracts.
2. **Editor:** Existing AgentSam Local Studio uses Monaco via the agentsam-ide package and monaco-pane.tsx. Do Monaco first. No current evidence makes CodeMirror the canonical CMS code editor. Keep LSP and editor API independent; CodeMirror becomes an optional client.
3. **Section contract:** Integrate with the source files above and preserve the distinction between persisted SiteSection, renderer-facing SectionInstance, template bindings, media identities and renderer locks.
4. **lang-jsonc:** Existing package supports jsonc-parser-backed analysis, location, formatting and source-safe edits, NOT CodeMirror/Lezer syntax support. Keep this stable semantic API; add a thin optional editor grammar bridge when needed.

### Package-local tests and neutral examples

Prefer colocated tests: packages/theme-graph/tests/closure.test.mjs, packages/syntax-html/tests/embedded.test.mjs, packages/lang-jsonc/tests/edit.test.mjs, packages/source-ingest/tests/archive-scope.test.mjs. Keep tests/integration for independent packed installs, real workflows and runtime parity. Root npm run verify must still run **both** all package-local tests and integration suites with no reductions in test coverage. Every package needs a documented public entrypoint and no customer-branded defaults. Names should identify generic roles; customer provenance belongs in receipts, never in source constants.

### First acceptance evidence

- Scroll FX ZIP: 19-file archive-only inventory, CSS/JS references and selector-linked indirect behavior, one scene extraction *candidate* with exact closure, globals and missing dependencies disclosed, not silently published.
- Gallery HTML: parse embedded CSS/JS and detect missing doctype; offer a source-range safe-fix diff with no implicit writes.
- Bundled dashboard HTML: detect and optionally statically decode known serialized manifest/template structures without evaluating scripts; declare remaining coverage gaps.
- Two distinct consumers must eventually verify the same neutral extracted artifact, preserving original style, responsive layout, behavior and scroll effects.

**Gate 1 cannot close at “19 files, 1 page, 10 references.”** It must yield an auditable component candidate and dependency report, with a safe extraction plan and explicit unknowns, without a new page builder or UI fork.

---

## 2. Source scope contract (fix the failure in the screenshot)

The existing SDK \`agentsam codebaseindex\` command is for **knowledge/repository indexing**. In the SDK checkout inspected on 2026-10-07, \`src/commands/codebaseindex.js\` stages a dropped archive, but calls \`buildInventory({ root, materials: staged })\`. \`src/indexing/ingest/inventory.js\` then walks the repository root irrespective of the archive. This **explains** an SDK inventory showing thousands of repository files after supplying a single ZIP. The defect is tracked in [AgentSam SDK issue #167](https://github.com/SamPrimeaux/agentsam-sdk/issues/167).

Do not duplicate the full knowledge indexer in Theme Tools. Provide the reusable source-scoped inventory API, then make a separate, explicitly coordinated SDK fix.

### Required input modes

| User action | Root/scope | Invariant |
|---|---|---|
| Inspect a ZIP/TAR/Git bundle | Only selected archive's safe virtual file tree | No ambient repository listing, scripts, index mutations or implicit network access |
| Inspect an HTML/JSONC/CSS/JS/Liquid file | Only selected file and explicitly authorized local dependency context | Zero discovered refs is **not** evidence no embedded/bundled dependencies exist |
| Inspect a directory | Only selected subtree | Symlinks, path boundaries, ignored directories and size limits are enforced/reported |
| Index a repository | Chosen repository root | Separately named purpose; do not silently infer it from cwd when an explicit file/archive is present |
| Compare/combine inputs | Explicitly selected source IDs | Never silently merge a dropped ZIP into the current repository index |

### Proposed versioned report contract

\`SourceReviewReceipt v1\` **(PROPOSED; not implemented yet)** should contain:

- \`source\`: ID, kind, selected scope, origin, immutable raw/expanded hashes, storage reference, provenance/trust.
- \`inventory\`: all accepted files, sizes, MIME/extension evidence, archive hierarchy, safety limits, excluded/rejected entries.
- \`analysis\`: discovered pages/modules/regions, typed AST source ranges, parser versions, language coverage, unsupported embedded formats.
- \`graph\`: nodes, source/target ranges, dependency types, resolved/unresolved state, direct/indirect links, backlinks when verified.
- \`checks\`: rule ID, severity, file/range, evidence, confidence, proposed safe fix, explicit not-analyzed reasons.
- \`candidates\`: **proposed** components and needed assets/behaviors/settings, not automatically declared CMS sections.
- \`actions\`: inspect, format, check, plan edit, request preview, package proposal, approve/reject (each capability gated).
- \`receipts\`: test provenance, transform diff, rollback data, renderer/runtime verdict and consumer compatibility; **written only with explicit output request**.

The default \`ingest <path>\` can remain a compact read-only summary for scripts. An explicit \`inspect --review\`, \`--output\`, or GUI action can render/store the same receipt (flags are proposed). Headless \`--json\` must remain stable. Do not launch a TUI automatically in noninteractive sessions or make visual UI a dependency of core parsing.

### UX principles borrowed from the SDK inventory screenshot

The current terminal screenshot has useful ingredients: a tree, language totals, categories, provenance clues and scope selection. Preserve these as a **presentation** of the selected source receipt. Improve the decision hierarchy:

    Selected source  →  Inventory  →  What we know / cannot know
           →  Diagnostics + dependency map
           →  Reviewable proposed changes
           →  Optional original preview / section compatibility
           →  Explicit save/export/approve

A wireframe is **an optional visualization of verified structure**, never the source, never a substitute for preview fidelity, and not our first product milestone.

## 3. Parallel workstreams, integrated release slices

To avoid endlessly polishing one package while the product stays unusable, manage these workstreams together and only mark a milestone done when its **full user journey** passes.

| Workstream | Responsibility | Release evidence |
|---|---|---|
| A. Source intake/scope | Selected input → immutable virtual file tree; bounded archive/dependency policy; report receipt | Drop ZIP in a foreign cwd: zero unrelated repository files appear; user can retrieve the same report |
| B. Language intelligence | Shared source snapshots and ASTs; HTML+Liquid, CSS/JS, JSONC; embedded-format detection | Ranged syntax reports and supported/unsupported coverage against representative source |
| C. Theme graph/check | Multi-language direct/indirect dependency graph, documented lint rules and fixes | CLI/editor agreement on missing deps, invalid settings, risky performance and source errors |
| D. Edits/formatting | Formatting, safe transforms, stable diffs, parse+check after edits, engine parity | Comments/design preserved, reviewable changes, rollback; JS/Rust/browser semantic contract tests |
| E. Language server/editor | LSP common core and browser/Node hosts; existing AgentSam editor adapters | Live hover/completion/navigation/diagnostics from identical source rules, no duplicate editor |
| F. Consumer fidelity | Source-preserving packaging, existing CMS adapter, optional sandbox original preview | One portable interactive section through two independent consumers, no visual/interaction regression |
| G. Distribution/security | Semver APIs, independent installs, source trust, limits, fuzz/malformed tests, releases | CI, signed/versioned artifacts where applicable, version compatibility and security acceptance |

Language-level claims are scoped per implemented grammar: **HTML support does not imply Liquid, TSX, React, or arbitrary bundled app support**.

## 4. Release milestones (each includes an observable vertical slice)

### Gate 0 — Architecture and inventory authority (docs and test design)

**Deliver:** Product charter; Shopify package map; SDK ownership audit; one stable language/graph/diagnostic API convention; the three user supplied samples documented as *local-only* evaluation sources.

**Pass:** An engineer can identify one owner for each state model; the \`agentsam codebaseindex\` scoped-material behavior has a separate SDK defect/reconciliation work item; the Theme Tools \`check\` command no longer gets described as complete linting.

### Gate 1 — Source understanding as a coherent experience

**Deliver:** Explicit source root semantics; source receipt/export; inspect report showing languages, pages, modules, regions, graph, diagnostics and unsupported surfaces; source-aware fixture tests; Node CLI and one GUI or TUI *consumer adapter*, not a standalone editor.

**Pass examples:** ZIP contains 19 files → 19-file inventory only. Missing doctype is pinpointed. Large embedded-script SPA reports “bundled manifest detected; internal view structure not statically analyzed” until supported. No repo leakage.

### Gate 2 — First editor-intelligence slice

**Deliver:** Common check API; working documented rule set; source-aware JSONC setting/HTML edit; formatter policy; thin LSP with synchronized document versions, hover and diagnostics; basic browser and Node adapter.

**Pass:** Same stored file yields matching diagnostics and reversible safe edit from CLI and existing CMS/Local Studio editor. The user can change a valid typed setting without losing unrelated comments.

### Gate 3 — Theme/section intelligence across languages

**Deliver:** Liquid+HTML source model, CSS and JS import and selector evidence, schema extraction/mapping and full direct/indirect graph, preview/behavior dependency reports; fixes and LSP capabilities extended.

**Pass:** Scroll FX demo names correct CSS/JS dependencies and motion-related elements; changes to a shared asset show affected modules. Packed UI retains working scroll behavior in original preview and an independent fixture consumer.

### Gate 4 — Two real consumers and product distribution

**Deliver:** Compatibility adapter to existing canonical CMS \`SiteDocument\`/section definitions, one additional independent consumer, package versioning/release docs, matrix CI, security/fidelity/performance tests.

**Pass:** A selected real section can be inspected, changed, checked, independently installed, previewed and used without a customer-specific fork. Desktop/browser and Node share diagnostics. No newly created CMS content authority.

These are **outcome gates, not calendar promises**. No gate passes merely because its tests are green without end-to-end observations.

## 5. Real-world acceptance sources and expected findings

| Fixture | Why it is valuable | Evidence required (not currently implied) |
|---|---|---|
| \`3page-spa-dashboard-analytics-views.html\` (local, ~1.6 MB) | Embedded bundler manifest/template; demonstrates limitations of outer HTML parsing | Identify embedded \`__bundler/manifest\` / template as distinct data; report unexpanded contents with reason; only unpack validated formats, no script execution |
| \`scroll-fx-library.zip\` (19 files) | HTML, JS scroll engines, CSS motion rules, tokens | Tree of 19 files, HTML structure, CSS/JS dependency graph, reduced-motion signals, original-preview behavior checks |
| \`template_gallery_agentsam.html\` (~21 KB) | Single HTML document with inline CSS/JS | Missing-doctype diagnostic, inline script/style coverage and explicit component candidates; do not claim fully editable gallery |
| SDK \`theme-resolve\` | Real commerce layout and interactions | Extract/port components while preserving original visual and functional implementation |
| Current Inner Animal editorial scene library | Complex real motion, section schemas and editor integration | Canonical section field mapping; no separate scene model or hardcoded theme redesign |
| Two unrelated customer/test sites | Cross-brand robustness | Cross-runtime install and edit tests with no leaked brand strings, credentials, URLs or dedicated code branches |

Keep user sample files **local**; do not commit them to public fixtures without explicit approval and rights confirmation. Add small deterministic, independently authored test fixtures that reproduce their structures.

## 6. Accuracy rules for status reporting

Use these exact maturity classes per capability and per consumer:

- **PROPOSED:** specification; no executable implementation.
- **IMPLEMENTED / UNINTEGRATED:** code works in isolation, not wired into the final use case.
- **VERIFIED SUBSET:** named tests and actual input classes pass; limits documented.
- **INTEGRATED:** public API is exercised from one real consumer with end-to-end tests.
- **PORTABLE:** at least two independent consumers and runtime parity (where applicable) verified.
- **RELEASED:** published/versioned artifacts, security/compatibility gates and customer acceptance complete.

Do not collapse “Node 23/23, Rust 6/6, standalone tarballs install” into “theme tools product finished.” Report specific tests, source fixture, consumer, and release SHA.

## 7. Work management laws that prevent drift

- Keep **one feature board/roadmap** for the engine, with explicit downstream SDK/CMS integration issues, instead of launching a parallel editor, browser host or rewriter each sprint.
- Define feature edges by **public interfaces and acceptance fixtures**, not by project directory or chosen language.
- Do not add a new permanent package without identifying upstream Shopify-equivalent role, authority boundary, public API, downstream consumer, and necessity beyond existing SDK packages.
- Any Rust feature must have a clear workload advantage and shared semantic contract; adding a Worker is not a product milestone by itself.
- Every finished PR lists: existing capability reused, new capability, real input used, commands/results, what remains unsupported, and consumer acceptance.
- Preserve original site design/style/scroll depth as an acceptance constraint. Source-backed section conversion may fail visibly; it must not silently produce generic replacements.
- Fix \`agentsam codebaseindex\` ZIP-vs-repository scope **in the SDK**, reusing the Theme Tools intake contract where compatible. Do not rename or overwrite the SDK's general knowledge-indexing authority.

## 8. Next decision, not another prototype

Prioritize **Gate 1 as a full vertical slice**, while defining the interfaces needed by Gate 2 and 3 upfront. This avoids coding a new TUI or polishing Rust while leaving users with “19 files, 1 HTML page, 0 diagnostics.” The visible output should be a trustworthy, typed report that can later drive both a TUI and an existing CMS editor.

No production publishing, customer code mutation, or new Cloudflare deployment is required to satisfy Gate 1.
