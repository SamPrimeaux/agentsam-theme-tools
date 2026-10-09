# Design Mining Zone: Required Working Contract

This directory is the **intake/refinement/catalog** workspace in agentsam-theme-tools. It is not the CMS stock library, BrandPack authority, or a place to publish customer pages.

## Non-negotiable definition of done

When a user shares HTML, a screenshot, a generator script, archive, scene, or component:
1. Inspect the **actual uploaded bytes**, not just the chat summary.
2. Archive the original, unmodified bytes to a durable, content-addressed R2 key. Never delete originals.
3. Record source filename, original hash, source role, dependencies, owner, user's actual keep/maybe/reject choice, and R2 key in the intake catalog. Unreviewed means **unreviewed**, not keep.
4. Deduplicate by exact source hash while preserving all incoming submission provenance.
5. Where appropriate create a recovered/normalized *candidate* fixture. Never call legacy HTML or JS a stock CMS component.
6. Store actual source files in the dedicated GitHub branch when appropriate; ensure private material is not published in a public repository.
7. Register a truthful private draft in the existing D1 artifact inventory if available. Do not create competing tables or fake an install.
8. **Read back** R2 object, GitHub branch source and D1 row; record the result in a machine-readable receipt.
9. Only after a verified safe renderer + typed settings/blocks + editor roundtrip + responsive/a11y browser proof + production CMS install may an item become stock/ready.

## Ownership and boundaries

- Theme Tools: mining, extraction, donor intel, cross-source matching, provenance, review queues, candidate definitions.
- SDK BrandPack: brand meaning, approved logo/token roles, policies and versions. Ingested colors/typography are **proposals**, not authoritative changes.
- Asset Core: canonical ast_* asset identity. R2 and CDN URLs are representations.
- 3D Studio: produces approved master media and scene source; this repo indexes them and their SHA/ref.
- CMS: sections, blocks, templates, pages, draft/publish/preview and real installation receipts.
- Interactive donor JS is quarantined and never executed inside privileged CMS/editor/runtime without an approved artifact-interactive contract.

## Explicitly prohibited shortcuts

- A markdown plan alone is not a source upload.
- A source R2 object is not a normalized reusable section.
- A code-unit test is not live browser or actual customer proof.
- Do not invent media filenames, hardcode guessed brand colors, copy demos into stock, create a new one-off scaffold CLI, or delete/recolor original renders.
- Do not silently reclassify the 32 existing 3D sources as uploaded media: catalog-only means catalog-only.
- Do not force theme/presentation findings into the SDK brand root without human approval.
- No emojis in editorial/admin deliverables unless the original user's requested design requires them.

## Batch entry point

Start at intake/2026-10-09/catalog.json, then intake/2026-10-09/verification.receipt.json.
A batch can expand by adding a new dated folder; do not overwrite a previous batch or collapse its proof.
