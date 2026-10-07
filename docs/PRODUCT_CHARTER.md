# Product charter — AgentSam Theme Tools

**Status:** Product direction and release criteria, not a claim of completed capabilities.  
**Canonical purpose:** Portable developer infrastructure for understanding, validating, editing, transforming, and verifying website/theme source across independent runtime environments.  
**Reference architecture:** [Shopify/theme-tools](https://github.com/Shopify/theme-tools). We borrow *modular developer-tooling principles*, not Shopify's brand, proprietary service assumptions, or CMS persistence model.

## The one-sentence product

A developer should be able to supply a website/theme source project, have AgentSam explain **what is actually present**, identify and safely edit its dependencies and typed configuration, receive actionable diagnostics and language assistance, and verify that a modified version still preserves the original experience—without being tied to one customer, editor, CMS, or cloud runtime.

Theme Tools is an SDK/toolchain. It is **not** another CMS application, a template gallery, a site builder, a synthetic wireframe generator, or a deployment authority. Those are potential **consumers** of its APIs.

## The business outcomes

| Company outcome | What Theme Tools makes reusable | Evidence of success |
|---|---|---|
| Ship websites faster without rebuilding internal tooling | Common parser, config editing, graph, checks, formatter, transforms | Same tools work against distinct customer/codebases without forks |
| Consistent CMS editor quality | Diagnostics, schema-aware fields, LSP, typed references | A source edit made from a GUI matches the CLI edit and validates against the same rules |
| Safely reuse purchased/created designs | Source-backed regions, dependencies, assets, styles, behavior manifests | Extraction keeps original markup, CSS, JS, responsive and scroll behaviors, with verified preview differences |
| Catch problems before delivery | Theme Check-equivalent validations with documented fixes | CI and local/editor diagnostics agree, with file/range/rule/fix information |
| Reduce AI-agent guesswork | Deterministic structural reports and edit plans | Agent sees grounded references and proposed diffs, never substitutes inferred code for absent source |
| Sell reproducible infrastructure | Versioned standalone packages, CLI, Node/browser/native adapters | Fresh independent consumer installs the published/packed APIs and passes contract tests |

## Product rules (non-negotiable)

1. **One source model:** Input snapshots, source positions, file identities, dependencies, diagnostics, edits, and reports must have versioned contracts consumed by all adapters.
2. **No duplicate authority:** General repository identities/Merkle are owned by the existing SDK; brand by BrandPack; content/media by their SDK services; CMS state and publication by canonical CMS contracts. Theme Tools owns *theme source intelligence* only.
3. **Parsing is not rendering:** HTML sections and JSON settings do not prove CMS editability. A discovered candidate is not a portable component until dependencies, behaviors, schemas, preview, and consumer mapping pass.
4. **Preserve originals:** Never run submitted scripts during static inspection; never modify a donor without explicit write intent; source provenance and reversible diffs accompany transformations.
5. **Runtime-neutral libraries:** Cloudflare HTMLRewriter and Rust/Wasm are adapters/engines, not mandatory hosting or separate product authorities. Test equivalence where two engines overlap.
6. **Trust must be earned:** No diagnostic is not the same as “validated”; every report states analyzed languages, skipped files, limits, confidence, and unsupported modes.
7. **Portable distribution:** npm packages should be installable outside either monorepo; browser-safe common libraries cannot depend on Node or private SDK checkout paths.
8. **Every release closes an end-to-end user journey:** No milestone passes simply because a parser compiles, a Worker responds 200, CI is green, or a documentation file exists.

## Source-to-consumer architecture

    Independent inputs (directory | archive | HTML | Git bundle | authorized acquisition)
            |
    Theme Tools source snapshot (scope, files, provenance, hashes, trust)
            |
    Syntax and semantic services (HTML/Liquid/CSS/JS/JSONC, typed schemas)
            |
    Theme graph + Theme Check + formatter + safe edit plans
            |
    One language server + versioned machine-readable reports
            |
    CLI | AgentSam SDK | Local Studio | Monaco/CodeMirror | CMS adapter | optional preview host

The source snapshot and graph are **not** a second customer-content database. The consumer chooses storage, authorization, previews, and publication.

## Supported experiences at product completion

- **Source inspection:** A developer supplies a ZIP, folder, or site bundle and sees exactly the selected source's files, technology signals, pages, structured regions, references, warnings, and missing/unsupported analysis. “Inspect my ZIP” never silently means “index the CLI's current repository.”
- **Theme checks:** A developer checks both single files and entire site trees; checks identify broken references, invalid/unknown settings, missing/incompatible dependencies, accessibility/performance concerns and unsafe edits with actionable evidence.
- **Code editing intelligence:** A developer can format, navigate definitions/references, see diagnostics, hover recognized schema fields, and complete valid settings using a common language server, whether in desktop or browser.
- **Safe transformation:** A developer proposes a controlled edit, reviews source ranges/diff/affected dependencies, previews the original and candidate in isolation, and accepts or rejects. Failed safety/behavior gates prevent packaging.
- **Cross-consumer portability:** Existing AgentSam CMS and a second independent consumer accept the same source-aware package or manifest without source forks, duplicate media IDs, or hardcoded customer metadata.

## What the first release does not promise

- An autonomous AI rewrite of arbitrary React/CSS/JS into universally editable CMS sections.
- Full runtime simulation of every framework or animation system.
- Production deployment of uploaded source by a public Worker.
- A new page builder, content database, media library, theme gallery, or proprietary version of CodeMirror.
- Visual fidelity inferred from parsing alone.

These may be future consumer capabilities; they are not proof of Theme Tools core completion.

## Documentation hierarchy

1. **This charter:** Purpose, ownership laws, outcomes, and definition of the product.
2. [Shopify capability map](SHOPIFY_CAPABILITY_MAP.md): Reference package role → AgentSam implementation → customer/business value → verified gaps.
3. [Delivery and acceptance program](DELIVERY_PROGRAM.md): Workstreams, source-scope contract, milestones, artifacts and release gates.
4. [Implementation status](IMPLEMENTATION_STATUS.md): *Evidence only*; separate existing functionality from roadmap.
5. [SDK reuse boundaries](SDK_REUSE_BOUNDARIES.md): Detailed existing-package integration candidates.

Do not create competing roadmaps for each customer theme, CMS editor, or runtime. Changes to scope require updating these documents and tests together.
