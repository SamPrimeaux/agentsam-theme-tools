# FNF Revise source-mining handoff — 2026-10-09

Canonical public build at local preview `http://127.0.0.1:4319/` is a **native SiteDocument**, not a generated legacy HTML page.

The five-page fixture contains **23 native section instances**. Stories and Campaigns each contain four authoritative sections. The section-library renderers and Revise presets are the source of truth; do not recreate them as new stock components.

| Page | Native sections | Source types |
| --- | ---: | --- |
| Home | 6 | media hero, gallery, statement, teaser, film, newsletter |
| Products | 5 | collection, product, lookbook, bundle, trust row |
| Stories | 4 | campaign teaser, editorial posts, social gallery, brand film |
| Campaigns | 4 | editorial grid, pinned split media, before/after, testimonials |
| Ideas | 4 | offers, marquee, FAQ, CTA |

## Executed tooling

The local source-backed exporter rendered all five SiteDocument pages into 35 artifacts (five HTML page snapshots, 23 typed section JSON records, five CSS files, manifest and SiteDocument) and an exactly hashed ZIP; this **ZIP has not reached R2** because the Mac terminal tunnel became unavailable. The export explicitly excludes browser-local drafts stored in `localStorage`.

On that output, actual `agentsam-theme ingest/inventory/graph/check/plan` commands found five HTML pages, 99 HTML references and no parser-level diagnostics; CSS/JS/Liquid semantic coverage is incomplete. With the improved `planHtmlRebuild` classifier:

- **Stories**: four authoritative native CMS sections; nine nested visual candidates.
- **Campaigns**: four authoritative native CMS sections; seventeen nested visual candidates.

Nested items are **not stock sections**. The authoritative section marker is `data-site-preset` plus the instance ID. Existing `SiteDocument`, section-library renderers, typed blocks and media keys must remain canonical.

## Persistent artifacts

R2 bucket `cms`:

- `design-library/v1/site-source/2026-10-09/fnf-revise/source-inventory.json` — five-page metadata, 23 section identities, source/proof state
- `design-library/v1/site-source/2026-10-09/fnf-revise/github-main/` — 14 actual GitHub-main source files independently archived, including page data, renderers, presets, contracts and styles

D1 `inneranimalmedia-business`: private draft `agentsam_artifacts.id=art_fivepage_revise_20261009`. This is a source inventory record, not a CMS publication.

The locally created 35-file ZIP has SHA-256 `e55b914ad19067e9f1ced41da84ddb6f38f9d01ad7848ec30224db930fad60bc`, size 69,882 bytes. It was **not uploaded**. Uploaded GitHub-main files are a separate proven source mirror; they must not be misrepresented as the exact local export.

## Promotion checklist

1. Restore Mac tunnel, upload and read back ZIP and two actual rendered HTML snapshots.
2. Compare browser-local draft versus `initialSite`; user-authored modifications must be preserved.
3. Asset Core provenance and licensing review for remote FNF and Supabase assets; don't automatically rehost third-party source media.
4. Run browser visual and scroll/hover/interaction checks at 360/390/768/1440.
5. Prove editor Add Section, instance edit, draft, reload, preview and publish against the actual hosted CMS; record build SHA and D1/R2 identities.

Current readiness: **source cataloged; not production-installed or browser verified**.
