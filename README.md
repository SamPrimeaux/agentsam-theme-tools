# AgentSam Theme Tools

**Portable developer infrastructure for understanding, transforming, validating, and packaging websites, themes, sections, scenes, and reusable presentation systems.**

AgentSam Theme Tools is a standalone, application-independent toolkit developed by Inner Animal Media.

Inspired by the modular developer-tooling architecture demonstrated by Shopify Theme Tools, this project establishes our own reusable foundation for source ingestion, language intelligence, structural analysis, theme interoperability, safe transformation, preview preparation, and package verification.

It is designed to serve **any compatible CMS, website, application, editor, CLI, or agent runtime** without requiring its consumers to inherit a particular customer's content, design, infrastructure, or implementation.

The objective is straightforward:

**Build powerful infrastructure once. Reuse it everywhere. Preserve the original design and behavior.**

## Project status

**Status: Foundation implementation underway · seven independently installable packages, source/archive/Git bundle intake, HTML analysis and rewriting, theme graphs, AgentSam JSONC, CLI, and automated verification.**

Track verified behavior and remaining full-product requirements in [Implementation Status](docs/IMPLEMENTATION_STATUS.md) and [SDK Reuse Boundaries](docs/SDK_REUSE_BOUNDARIES.md).

### Canonical product and delivery plan

- [Product Charter](docs/PRODUCT_CHARTER.md) — what Theme Tools **is**, the company-level outcomes, ownership laws, non-goals and definition of finished.
- [Shopify Capability Map](docs/SHOPIFY_CAPABILITY_MAP.md) — actual upstream package architecture mapped to our seven existing packages, SDK reuse targets, benefits and feature gaps (including JSONC).
- [Delivery Program](docs/DELIVERY_PROGRAM.md) — source-scope contract, portable review receipts, cohesive release gates, real user-source test fixtures and cross-CMS acceptance criteria.

**Avoid drift:** This project is a portable developer-tooling engine, not another CMS editor, Theme Gallery, or Website Builder. A CLI archive inventory, clean test suite, Rust build or Worker response is not yet a portable theme product. Feature status is maintained in the implementation-status document, not inferred from these plans.

The isolated [Rust HTML rewriting lab](rust/theme-rewriter-lab/README.md) uses the existing AgentSam Rust scaffolder and an independent `lol-html` core. It is a local test adapter, not a CMS or a deployed Worker.

This README establishes the complete intended implementation scope and release requirements.

Documented capabilities are not considered implemented or production-ready until source code, automated tests, packaged artifacts, and independent consumer verification demonstrate their behavior.

The project must not equate scaffolding, successful compilation, package publication, or passing isolated unit tests with a fully working product.

---

## 1. Mission

AgentSam Theme Tools exists to solve a fundamental problem:

Websites and application themes contain valuable reusable structure, but that structure is frequently trapped in individual repositories, frameworks, CMS implementations, or customer-specific code.

A theme may include HTML, CSS, JavaScript, React components, Liquid templates, JSON configuration, media assets, animations, layouts, typography, responsive behavior, and data bindings.

Simply copying files does not make these elements portable.

This toolkit must mechanically inspect and understand their relationships, preserve their implementation characteristics, identify reusable components, and prepare them for controlled integration into other systems.

Its responsibilities are:

1. **Ingest** existing websites, archives, themes, and source projects.
2. **Parse** their source code and configuration into inspectable representations.
3. **Analyze** structural, visual, behavioral, and dependency relationships.
4. **Validate** compatibility, references, schemas, and implementation requirements.
5. **Transform** source through controlled, reversible, source-preserving operations.
6. **Preview** genuine theme output through explicit runtime adapters.
7. **Package** reusable themes, sections, scenes, layouts, and related resources.
8. **Expose intelligence** through libraries, CLI commands, language servers, editors, and agents.
9. **Verify portability** across independent consuming applications.

Theme Tools is responsible for understanding and preparing software artifacts—not for owning a customer's website.

---

## 2. Architectural principles

### Customer neutrality is mandatory

No reusable library, parser, transform, renderer contract, language service, or package operation may depend on:

- A specific customer, company, brand, or website.
- Hardcoded domains, Cloudflare account IDs, bucket names, or database identifiers.
- Customer product catalogs, provider credentials, or inventory records.
- Local developer filesystem paths.
- One CMS editor, storefront, desktop application, or hosting provider.
- A particular theme's default colors, typography, content, or visual identity.
- Undocumented assumptions about available files, routes, APIs, or infrastructure.

Every required external capability must be declared and supplied through an explicit contract or adapter.

Customer-specific configurations belong to consuming applications and installations.

Customer examples belong in isolated test fixtures and must never become production defaults.

### Preserve the original design

Portability does not mean visually normalizing every theme.

A reusable section must retain its intended structure, styles, responsive behavior, animation, interaction, accessibility characteristics, and resource dependencies.

Theme Tools may identify compatibility issues and propose changes, but it must not silently redesign an imported theme.

**One renderer may support many brands without forcing those brands to share one appearance.**

### Deterministic machinery first

Parsing, validation, dependency analysis, transformations, and packaging must remain testable without an AI model.

AI assistance may propose classifications, mappings, edits, or transformations, but proposals must be distinguishable from deterministic results.

Every applied transformation must have inspectable inputs, outputs, diagnostics, and provenance.

### One authority per responsibility

Theme Tools must not establish another competing:

- CMS database or content model.
- Page-authoring authority.
- Merchant dashboard.
- Product catalog.
- Media library.
- Identity or permissions system.
- Publication control plane.
- General-purpose repository indexer.

It may define its own neutral intermediate representation for source analysis, but integration with persisted CMS content must use explicit, versioned adapters to the selected authoritative contracts.

### Portability must be demonstrated

A package is not portable simply because it contains no obvious customer names.

It must demonstrate independent installation, explicit dependency boundaries, compatible runtime behavior, and successful integration with unrelated consumers.

---

## 3. Complete implementation scope

The following capability families are part of the intended initial product specification. They are not optional architectural placeholders.

### A. Source ingestion and inventory

Support:

- Local HTML, CSS, JavaScript, TypeScript, and configuration files.
- Complete website source directories.
- ZIP and TAR-based source archives.
- Structured theme packages and manifests.
- Remote website acquisition through an explicitly authorized network adapter.
- Source snapshots supplied by external crawlers or browser tools.
- Shopify-style theme source, including Liquid templates.
- Existing AgentSam section, scene, and theme packages.

The ingestion pipeline must produce an inventory containing file identity, content hashes, source origin, entrypoints, detected formats, resource references, and ingestion diagnostics.

Untrusted source must be inspected without automatically executing embedded code.

### B. Language and syntax infrastructure

Provide independent language modules for:

- HTML and HTML fragments.
- CSS and stylesheets.
- JavaScript and TypeScript.
- Strict JSON.
- JSON with comments and trailing commas (JSONC).
- Liquid and mixed Liquid/HTML templates.
- Theme manifests, section definitions, and other registered structured formats.

**AgentSam JSONC must be our own reusable implementation and API.**

It must support syntax analysis, comments, trailing commas, source locations, useful diagnostics, and controlled editing.

Language modules should expose structured syntax information independently of CodeMirror, Monaco, React, and the CMS.

Complex languages may use established low-level parser dependencies while retaining AgentSam-owned public contracts and behavior.

### C. Source and theme graphs

Build a reusable dependency graph connecting:

- Files and entrypoints.
- Pages and templates.
- Layouts and global regions.
- Sections and nested blocks.
- Components and scenes.
- JavaScript modules and behavior dependencies.
- Stylesheets and design tokens.
- Fonts, images, video, and other media.
- Reusable presets.
- Structured content bindings.
- Theme and package dependencies.

Graph edges must preserve their type, source location, target, and resolution status.

Support forward dependency queries, reverse references, unused-resource analysis, missing references, impact assessment, and compatibility inspection.

### D. Theme diagnostics and validation

Provide configurable checks for:

- Syntax errors.
- Invalid or incompatible schemas.
- Missing or unresolved resources.
- Unsupported sections or blocks.
- Broken data bindings.
- Circular or invalid dependencies.
- Accessibility concerns.
- Responsive implementation issues.
- Potential security risks.
- Duplicate and conflicting design tokens.
- Package integrity.
- Unsupported runtime requirements.
- Publication readiness requirements supplied by an authorized host.

Diagnostics must include stable identifiers, severity, location, explanation, and optional proposed repairs.

The same validation engine must be usable by the CLI, browser editor, desktop application, and automated test runner.

### E. Structural extraction and transformation

Support mechanical operations for:

- Discovering candidate sections in existing HTML.
- Extracting reusable page regions and components.
- Identifying global headers, footers, layouts, and shared resources.
- Separating content fields from presentation implementations.
- Mapping extracted sections to registered contracts.
- Detecting responsive and interactive dependencies.
- Rewriting resource references through explicit mappings.
- Producing controlled source patches.
- Migrating between supported theme schema versions.
- Preparing reusable section, scene, and theme packages.

Transformations must preserve source provenance and produce reviewable change plans.

A successful extraction does not automatically establish functional equivalence. Browser verification is required for rendering and interaction claims.

Unsupported Liquid constructs and dynamic behavior must remain explicitly identified rather than silently converted into incorrect static output.

### F. Language Server Protocol and editor integration

Implement a shared language-intelligence layer providing:

- Document synchronization.
- Syntax and semantic diagnostics.
- Completions.
- Hover information.
- Definition and reference navigation.
- Document symbols.
- Formatting.
- Code actions.
- Controlled rename and workspace edits where supported.

Provide runtime adapters for:

- Browser/Web Worker execution.
- Node.js execution.
- AgentSam desktop and native runtime integration.
- CodeMirror 6.
- Monaco and other standards-compliant LSP clients.

CodeMirror and Monaco are **editor integrations**, not authorities over source analysis or CMS data.

One language-intelligence engine must serve multiple editor surfaces.

### G. Preview and rendering verification

Provide a runtime-neutral preview preparation API supporting:

- Source-backed preview manifests.
- Resource URL resolution.
- Desktop, tablet, and mobile viewport configurations.
- Original versus transformed comparison.
- Isolated rendering environments.
- Visual regression evidence.
- Interaction and responsive checks.
- Missing-resource diagnostics.
- Preview provenance and build identity.

Executing untrusted JavaScript requires a separately controlled sandbox with explicit security and resource limits.

A successful generated preview must never be presented as evidence of production publication.

### H. Package compilation and distribution

Compile reusable theme artifacts with:

- Versioned manifests.
- Declared compatibility requirements.
- Dependency inventories.
- Integrity hashes.
- Source and transformation provenance.
- Runtime requirements.
- Asset manifests.
- Preview metadata.
- Diagnostics and verification receipts.

Packages must be consumable without the original source repository checkout.

Package compilation must not embed customer credentials, private state, or environment-specific deployment bindings.

### I. CLI and AgentSam integration

Expose a standalone CLI and integrate its capabilities into the existing AgentSam command system.

Planned command surface:

- `agentsam theme ingest`
- `agentsam theme inspect`
- `agentsam theme graph`
- `agentsam theme check`
- `agentsam theme format`
- `agentsam theme plan`
- `agentsam theme transform`
- `agentsam theme preview`
- `agentsam theme package`
- `agentsam theme verify`
- `agentsam theme doctor`
- `agentsam theme language-server`

Commands must invoke reusable library operations rather than containing independent implementations.

Support structured JSON output, machine-readable diagnostics, noninteractive execution, and explicit approval for mutating operations.

Command names and arguments become stable only after their contracts and integration tests are approved.

---

## 4. Repository structure

The intended repository organization is:

```text
agentsam-theme-tools/
├── packages/
│   ├── lang-jsonc/
│   ├── source-ingest/
│   ├── syntax-html/
│   ├── syntax-css/
│   ├── syntax-scripts/
│   ├── syntax-liquid/
│   ├── theme-ir/
│   ├── theme-graph/
│   ├── theme-check/
│   ├── theme-transform/
│   ├── theme-language-server/
│   ├── theme-preview/
│   ├── theme-package/
│   └── theme-cli/
│       ├── bin/
│       └── src/
├── adapters/
│   ├── node/
│   ├── browser/
│   ├── cloudflare/
│   ├── agentsam/
│   ├── codemirror/
│   └── monaco/
├── fixtures/
│   ├── generic-html/
│   ├── theme-archives/
│   ├── section-packages/
│   ├── liquid-themes/
│   └── cross-customer/
├── tests/
│   ├── contracts/
│   ├── integration/
│   ├── portability/
│   ├── security/
│   ├── visual/
│   └── release/
├── docs/
│   ├── architecture/
│   ├── contracts/
│   ├── integrations/
│   └── verification/
├── scripts/
├── README.md
├── package.json
└── LICENSE
```

Each package must have an explicit purpose, supported runtime environments, public exports, and independent tests.

A directory or package declaration does not establish implementation completeness.

---

## 5. Core operating model

The canonical processing flow is:

**Acquire → Inventory → Parse → Analyze → Graph → Validate → Plan → Transform → Verify → Package**

Operations should be independently callable through a stable programmatic API.

The input boundary accepts source content and declared adapters.

The output boundary returns structured results, diagnostics, provenance, and artifacts.

CMS persistence, authentication, customer resources, and publication remain the responsibility of authorized consuming applications.

Theme Tools must not silently create or mutate external infrastructure.

### Source preservation

Every structural change must retain traceable source references.

A transformation plan should describe:

- Original source identity and hash.
- Proposed target resources.
- Required dependencies.
- Intended edits and affected ranges.
- Compatibility assumptions.
- Potentially unsupported behavior.
- Expected output artifacts.
- Verification requirements.

A plan is not an applied transformation.

An applied transformation is not a verified publication.

---

## 6. Relationship to the AgentSam ecosystem

### AgentSam SDK

The SDK provides general-purpose repository intelligence, indexing, brand processing, machine capabilities, installation, orchestration, and application distribution.

Theme Tools should integrate with those capabilities through stable exported interfaces.

Candidate integrations include:

- `agentsam-repository` for repository identity, snapshots, and provenance.
- `agentsam-site-scrape` for authorized site acquisition.
- `agentsam-brand` for brand assets and semantic token intelligence.
- `agentsam-ide` for desktop language tooling.
- AgentSam indexing and machine inspection for broader source intelligence.

Existing source must be audited before reuse.

A package being present in the SDK is not evidence that it is sufficiently portable or verified.

Do not duplicate its implementation merely to avoid defining a dependency.

### Inner Animal CMS

`inneranimalmedia-cms` provides existing section contracts, rendering experiments, editorial references, and HTML ingestion implementations.

These are candidates for integration, extraction, or adapter development.

Theme Tools must not establish a second incompatible page, template, section, or content persistence authority.

### Ecommerce CMS AgentSam

`apps/ecommerce-cms-agentsam` is a consuming application.

It may expose Theme Tools through its existing editing surfaces, theme library, draft workflow, and application CLI.

Theme Tools must not become an alternative ecommerce backend, product catalog, or merchant administration application.

### Fuel & Free Time

Fuel & Free Time is an important real-world integration and acceptance consumer.

It must not become a source of customer-specific defaults inside Theme Tools.

Theme tooling must also succeed with unrelated customer content and distinct visual identities.

---

## 7. Development and release workstreams

**All workstreams below are within the first complete product target. None is an untracked future enhancement.**

### Workstream 1 — Contracts and package boundaries

- [ ] Establish public APIs, package ownership, and supported runtimes.
- [ ] Define the neutral source-analysis intermediate representation.
- [ ] Reconcile integration with existing canonical CMS contracts.
- [ ] Establish versioning, diagnostics, errors, and provenance formats.
- [ ] Add customer-neutrality and dependency-boundary enforcement.

### Workstream 2 — Language infrastructure

- [ ] Implement AgentSam JSONC.
- [ ] Implement HTML, CSS, and script parsing interfaces.
- [ ] Implement Liquid parsing and compatibility diagnostics.
- [ ] Preserve source locations and provide stable syntax results.
- [ ] Add parser fixtures, malformed-input tests, and round-trip tests.

### Workstream 3 — Source ingestion and graph

- [ ] Implement filesystem, archive, and authorized remote-source adapters.
- [ ] Inventory source files and dependencies.
- [ ] Build theme and resource graphs.
- [ ] Detect sections, layouts, components, and asset references.
- [ ] Prove deterministic results with independent source projects.

### Workstream 4 — Diagnostics and transformation

- [ ] Implement theme validation rules and diagnostics.
- [ ] Implement reviewable transformation plans.
- [ ] Build safe source-edit operations.
- [ ] Produce reusable section/theme package candidates.
- [ ] Verify preservation of source, resources, and declared dependencies.

### Workstream 5 — Language services and editing

- [ ] Implement the shared language server.
- [ ] Implement browser and Node.js runtime adapters.
- [ ] Integrate CodeMirror and Monaco clients.
- [ ] Provide completion, diagnostics, navigation, formatting, and supported refactoring operations.
- [ ] Verify the same language results across editor clients.

### Workstream 6 — Preview, CLI, and distribution

- [ ] Implement preview manifests and isolated preview adapters.
- [ ] Implement standalone CLI commands.
- [ ] Integrate commands with the AgentSam SDK.
- [ ] Package independent libraries with explicit exports.
- [ ] Verify installation outside the development monorepo.
- [ ] Complete browser, desktop, and Cloudflare compatibility tests where declared.

### Workstream 7 — Independent consumer acceptance

- [ ] Verify integration with the existing CMS.
- [ ] Verify integration with `apps/ecommerce-cms-agentsam`.
- [ ] Verify an actual FNF theme without importing customer-specific defaults.
- [ ] Verify a second unrelated customer/theme fixture.
- [ ] Confirm no implementation copying is required between consumers.
- [ ] Produce complete release evidence and document remaining limitations.

These workstreams may be developed in parallel when their contracts are stable. Dependency order and integration gates determine release readiness.

---

## 8. Security and portability requirements

All imported source is untrusted.

Required protections include:

- Archive extraction path validation.
- Size and resource limits.
- Safe URL acquisition and SSRF protection.
- Filesystem scope isolation.
- Sandboxed execution of untrusted scripts.
- Strict separation of credentials and source artifacts.
- No implicit network access in deterministic core operations.
- Explicit authorization for external writes.
- Rejection of unknown or unsafe mutation targets.
- Dependency and package integrity checks.
- Licensing and source-provenance preservation.

Generic functionality must not depend on developer-specific environment variables or paths unless supplied through a documented adapter.

Cloudflare support is an adapter, not a universal runtime requirement.

---

## 9. Definition of done

A capability is complete only when:

1. Its public contract is defined and tested.
2. Its implementation is present and independently executable.
3. Its runtime dependencies are declared.
4. Its tests exercise real behavior rather than only package metadata.
5. Its packaged distribution works outside the source monorepo.
6. Its inputs and outputs are deterministic where promised.
7. Its security and failure behavior are tested.
8. Its diagnostics identify unsupported behavior accurately.
9. Its integration works through public APIs without copying implementation source.
10. Its results are verified against at least two independent consumers where portability is claimed.

For theme ingestion and transformation, additionally require:

- Preservation of source and asset relationships.
- Accurate reporting of unsupported constructs.
- Actual rendering and interaction checks.
- No unintended design changes.
- Provenance linking transformed artifacts to their original sources.

For publication integrations, the consuming host must separately prove authorization, versioning, rollback, and release safety.

**A green build is a checkpoint, not the definition of a finished product.**

---

## 10. Non-goals

AgentSam Theme Tools will not become:

- Another merchant-facing CMS editor.
- A replacement for AgentSam SDK.
- A second content persistence system.
- An ecommerce platform.
- A customer-specific website builder.
- A collection of copied client projects.
- A mandatory AI-powered transformation service.
- A system that silently converts or publishes unsupported source formats.

The goal is to make existing applications more capable—not duplicate their responsibilities.

---

## Long-term architectural invariant

**Source is evidence. Contracts define meaning. Parsers establish structure. Graphs establish relationships. Validators establish compatibility. Transformations produce controlled changes. Renderers preserve presentation. Applications own customer state. Publishers control deployment.**

These boundaries must remain intact as the repository grows.

The desired end result is a dependable, reusable developer-tooling foundation that allows AgentSam and compatible products to inspect, understand, edit, migrate, verify, and package complex presentation systems without reinventing tooling for every customer or application.

**Build once. Verify independently. Integrate everywhere.**
