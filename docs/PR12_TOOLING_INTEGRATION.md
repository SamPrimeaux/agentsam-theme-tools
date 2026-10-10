# Universal Component Authoring — PR #12 integration receipt (2026-10-10)

Status: **draft integration**, **not** published/merchant-ready. Reusable Theme Tools packages own parser/bindings/patch intents only. No new CMS tables, Cloudflare resources, IAM permissions, media IDs, imported JS execution or changes to FNF authored source.

## Source of truth and reuse ledger

| Existing capability | Owner and **public API verified** | This branch uses | Evidence | Gap / responsibility |
|---|---|---|---|---|
| Source ingest, SHA-256 and archive guard | Theme Tools `@inneranimalmedia/theme-source-ingest`: `ingestSourceInputs` | Exact `sourceFile.{path,text,sha256,bytes}` in CLI, evidence and receipt | CLI + receipt integration tests | No second source/archive engine |
| HTML source locations / safe rewrite | Theme Tools `@inneranimalmedia/theme-syntax-html`: `parseHtml`, `walkHtml`, `attribute`; `@inneranimalmedia/theme-html-rewriter`: `applyPatches` | Source-preserving annotations, reviewed source edits | Compiler tests, original HTML unchanged | CSS/JS/TSX/Liquid semantics not fully parsed |
| Dependency graph | Theme Tools `@inneranimalmedia/theme-graph`: `buildThemeModuleGraph`, `planModuleExtraction` | Existing CLI `closure` retained; authoring accepts selected ingest entry | CLI smoke, independent distribution test | CSS import/runtime graph incomplete |
| Canonical repository provenance | SDK `@inneranimalmedia/agentsam-repository/merkle`: `buildMerkleTree`, `validateSnapshot` | Optional externally computed `repositoryEvidence` preserved; no alternate Merkle identity generated | Adapter validation; SDK public exports inspected | Merkle snapshots not automatically resolved; host must inject evidence |
| BrandPack and tokens | SDK `@inneranimalmedia/agentsam-brand`: `createEmptyBrandPack`, `normalizeBrandPack`, `BRAND_PACK_SCHEMA`; `@inneranimalmedia/agentsam-brand/public` | Validated BrandPack v2 token names/values, asset roles, brand ID; retains pack provenance | Actual package import contract test | CSS variable naming/application remains host-defined; no invented palette |
| Canonical AssetRecord | SDK `@inneranimalmedia/agentsam-assets-core`: `createEmptyAssetRecord` (typed package export) | Carries exact IDs, hashes, provider representations, provenance; rejects mixed account IDs | Actual package import and cross-tenant test | Host must authorize every asset and resolve URLs |
| Media lifecycle | SDK `@inneranimalmedia/agentsam-content`: `./core`, `./contracts`, `./runtime`; optional `agentsam-cloudflare-images` | Data-only AssetRecord/MediaRef seam; media never modified or reuploaded by compiler | Asset Core and unresolved-ref diagnostics | Provider/Content runtime and R2/Images writes remain host responsibility |
| Scene / block composition | SDK `@inneranimalmedia/theme-scenes`: `getSceneKind`, `normalizeSection` | Validates scene kind, maps allowed block slots, carries motion, scroll and visual metadata unchanged | Actual SDK public exports test | `agentsam-sections` is a React renderer; no source authoring contract exposed |
| CMS Runtime | SDK `@inneranimalmedia/cms-runtime`: exported manifest/sqlite schemas | Not imported into offline compiler | Package export audit | No authoring JS API; Ecommerce CMS D1/R2 stays sole state authority |
| SAM OS | SDK `@inneranimalmedia/agentsam-sdk/sam`: `createSamOS`, `AgentSamClient`; PR #211 `sam.authoring.*` | Calls real executable `client.invoke` with restricted operation list; host injects authorized repository | Actual public SDK executable operation test | Real CMS adapter still needed in PR #95 |
| IDE / acquisition | SDK `@inneranimalmedia/agentsam-ide/lsp`, `agentsam-site-scrape` Node acquisition runtime | No private API imports or autonomous fetches | Public export audit | Optional host integration; screenshot/LSP/crawler verification remains blocked |
| FNF consumer | PR #95, Ecommerce CMS | Frozen Shop Hero fixture + crossrepo contract tests only | 7 tests passed after compiler update | D1/R2 drafts, real editor selection, publish/restore not implemented by this PR |

## APIs added — no product-specific implementation

- `@inneranimalmedia/theme-authoring-compiler`: `compileHtmlAuthoring`, `compileScopedStyles`, `inspectRenderedElement`, `compileSourcePatch`. Compile returns original HTML and editor-only annotated derivative; stylesheet changes never mutate the original bytes. Source identity uses supplied canonical SHA-256 plus semantic bindings, with ambiguous clone identities disclosed.
- `@inneranimalmedia/theme-authoring-compiler/consumer`: `assembleAuthoringEvidence`, `verifySourceIdentity`, `invokeSamAuthoring`, `verifyAuthoringSource`. Strict data contracts for BrandPack v2, AssetRecord, scene lookup, source provenance and SAM client. No account, registry or persistence construction.
- Existing `@inneranimalmedia/theme-cli`: `agentsam-theme analyze|authoring|verify <source> --entry <relative-html> --scope <scope> [--edits <json-file>] [--expected-sha <sha256>] [--json]`. Uses existing `ingestSourceInputs`. JSON results include canonical SHA-256, binding IDs, scoped CSS, parser/identity diagnostics, and truthful verification flags. Requires an explicit HTML entry when importing a multi-file site.
- `verifyAuthoringSource` returns a read-only, machine-verifiable `agentsam.authoring-verification.v1` receipt. No published/rendered claims.

## Verify locally

```sh
cd /Users/samprimeaux/agentsam-theme-tools
AGENTSAM_SDK_ROOT=/Users/samprimeaux/agentsam-sdk npm run verify
node packages/theme-cli/bin/agentsam-theme.mjs analyze fixtures/fnf/shop-original.html --scope hero --json
node packages/theme-cli/bin/agentsam-theme.mjs verify examples/basic --entry index.html --scope hero --json
```

The local Git bundle intake test now opts out of *only the temporary fixture commit's* machine-wide SSH signing setting via `git -c commit.gpgsign=false` while leaving all actual code commits/signing untouched. Independent installation uses local packed tarballs with `npm install --offline` so a network/DNS outage cannot disguise correctness.

## Mandatory host acceptance not yet done

SDK PR #211 must retain the authorization and expected-revision checks in all SAM authoring handlers. Ecommerce PR #95 must wire its **real** CMS D1/R2 adapter to `getSource`, `saveDraftStyles`, `saveSourceDraft` and preexisting publish/restore; connect browser canvas selection and a computed-style probe to compiled bindings; confirm its draft/live renderer uses the same CSS and source; provide visual responsive screenshot/diff proof. No promotion to stable/release or production deploy before those gates pass.

Source intelligence and identity are still **partial**: ambiguous structurally identical nodes require a durable owner key; reordering with no durable key can change a binding ID. Browser computed styles are only populated by `inspectRenderedElement` when a real DOM and browser computed-style engine are provided. Arbitrary behavior/JS/TSX/Liquid requires a validated language adapter and reviewed SAM source patch. A JSON receipt is not proof of pixel fidelity.
