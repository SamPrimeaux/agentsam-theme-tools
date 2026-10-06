# SDK reuse boundaries for Theme Tools

Owner of HTML parsing, theme source ingestion, source-aware rewrites, dependency graphs and diagnostics: agentsam-theme-tools.
Owner of general repository identity, orchestration, brand/media records and CMS persistence: existing AgentSam SDK, brand/content packages and CMS runtime.

| Existing SDK source | Proposed integration | Gate |
|---|---|---|
| packages/agentsam-assets-core/src/input.ts | Map SDK AssetInput to SourceInput without creating new asset identities | Published API and contract tests |
| src/indexing/ingest/materials.js | Align archive staging policies and security | Portability tests, no private-path import |
| packages/agentsam-brand | Consume BrandPack v2, tokens and media roles | Independent package installation |
| packages/agentsam-content | Consume media asset references and metadata | Stable exported API |
| packages/theme-scenes | Interpret scenes, sections, blocks and presets | Reconcile with canonical CMS contracts |
| packages/agentsam-repository | Reuse hashes, Merkle identity and repository graphs | Stable exported API |
| packages/agentsam-site-scrape | Authorized site acquisition provider | Network and SSRF checks |
| packages/agentsam-ide | Desktop and browser LSP integration | Runtime contract acceptance |
| packages/cms-runtime | Map content/section/template contracts | No competing persistence authority |
| packages/agentsam-abs | Optional preview host | Execution isolation and fidelity |

SourceInput is an ingestion request envelope, not a new AssetId or media library. Cloudflare is an optional adapter, not a core runtime dependency.

The existing SDK capabilities are integration candidates. Their code presence or package test success alone does not certify independently packaged operation.

Core packages must not import customer-specific code, domains, credentials, bucket names, account identifiers or absolute developer paths. Fixtures can contain isolated examples but may not become production defaults.

Release gates: independent installation, malformed-source tests, archive safety, original design/interaction verification, two unrelated site consumers, and cross-runtime compatibility.
