# Design Mining Intake — 2026-10-09

## What actually landed

All five uploaded message attachments are stored as **original source text** in private R2 bucket `cms`, prefix `design-library/v1/intake/2026-10-09/raw/`. There are **four logical submissions**: three historical HTML designs and a glass/3D pipeline and QA log. Two Brand Kit pasted files are byte-identical, so they are one logical candidate with both originals preserved.

Three **recovered HTML** source fixtures are also uploaded to `design-library/v1/intake/2026-10-09/normalized/` in R2 and versioned in this branch under `sources/`. Recovery only reverses Markdown encoding (escaped angle brackets and numeric space entities). These fixtures include legacy inline scripts and third-party CDN links: **they are not approved stock, trusted runtime JS, or deployed sites**.

The attached 3D project note includes a runnable-looking Blender/OpenSCAD generator. Its extracted script is saved in `experiments/glass-shapes/build.py` **as a draft**; the pipeline is not executed or visually verified by this import. A distinct R2 catalog already records 32 3D items (23 stills, 9 scenes) in `design-library/v1/curation/3d-studio-catalog.json`. This batch references that inventory. It does **not** claim the stills/scenes have been uploaded; their original source repo is `agentsam-3d-studio`.

## Classification

| Candidate | Classification | Refinement destination |
|---|---|---|
| IAM Services | Historical page donor | Split into typed editorial sections, text filter, scene, nav and cards |
| Interactive Brand Kit | Brand Studio donor | Semantic token editor; read/write BrandPack through SDK resolver only |
| AgentSam Create | Historical page donor | Split into sections, marquees, bento cards and backdrop; isolate JavaScript |
| Glass shapes / 3D | Offline asset-generation experiment | Verify rendered media masters and scene manifests, then catalog each asset individually |
| Previous Meaux HTML findings (7) | Existing archived intake | Cross-reference source IDs; do not duplicate or call installed |

## Zone ownership

- **Theme Tools**: ingest, extract, deduplicate, quality findings, normalized candidate catalog and source provenance.
- **AgentSam SDK BrandPack**: authoritative brand rules, asset roles, token schema and compiler.
- **Asset Core**: canonical ast_* identity. R2/Images are delivery representations, not separate asset owners.
- **CMS**: installation, typed sections/blocks, instance edits, revisions, draft/preview/publish.
- **3D Studio**: source generation and master renders. Theme Tools only references and catalogs them.

No new CLI or competing asset tables; `scripts/recover-pasted-html.py` is a narrow encoding-recovery utility for this archival batch, **not** a product importer.

## Release state and required proof

1. Source hash + R2 readback: archive PASS.
2. Recovery of 3 HTML pages: source fixture only. Needs local browser snapshots at 360/390/768/1440 and JS dependency sandbox/permission review.
3. Clean extraction: introduce typed settings, semantic blocks, logical media roles and scoped CSS.
4. Cross-brand: reference canonical BrandPack, no copying a donor's brand as a customer default.
5. Install: register appropriate CMS definitions, edit clone/reload/reorder independently and prove D1/R2-backed draft → preview → publish on actual deployment.
6. Promote only when an explicit approval and quality receipt lists artifact id, normalized revision, source sha, release sha, and tested route.

**All items remain unreviewed/archived; nothing in this branch is shipped to a site.** Do not confuse candidate HTML with reusable CMS sections.

## Start reviewing

Inspect `catalog.json` first; preserve source IDs and do not change user choices. The prior curation gallery is at `http://127.0.0.1:4322/` on the Mac when running; this batch is not automatically imported into its SQLite decisions.
