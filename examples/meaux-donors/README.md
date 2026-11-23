# Meaux source intake — preserved, not rewritten

**Source owner:** Founder-provided Meauxbility / Meaux / MEAUXX design code (October 15, 2026). Meaux prefixes and color families are intentional brand history, not noise to normalize away.

## Immutable donors

| File | SHA-256 of exact uploaded HTML | Purpose |
| --- | --- | --- |
| `original/partners.html` | `c8ce535da35782ea9dc3d94fd309f75b157654444071c4db9225b36a6ddc8d1c` | Partner-card glass, tier glows, sweep, underline, entrance and logo motion |
| `original/enhanced-brand.html` | `25fea00d39ebdbbb636cea96c105c64f88181994ebfb5ab5185a96b89470e328` | Original Meaux and Enhanced Teal Steel identity/presentation |
| `original/help-links.html` | Inline manually transcribed snippet (not byte-identical original attachment) | Meaux link inversion, hover scale, Montserrat |

The first two archived files have been transferred and **verified byte-for-byte** against the uploaded HTML files. The help file is a faithful, reformatted source capture from the chat; it is not claimed to be original bytes.

## Source mining

Run:

```sh
node scripts/harvest-meaux.mjs
node --test tests/meaux-source-preservation.test.mjs
```

`candidates.json` is a machine-readable *evidence document* with selectors, declaration maps, source-line positions, hashes, motion hints and unresolved gates. A candidate does not become a stock SKU or installed CMS artifact just because a selector was recognized. No HTML is executed during harvesting, no original source is edited and no cloud infrastructure is used.

The `mineStyleCandidates` API in `@inneranimalmedia/theme-graph` is generic: callers supply source files and selectors, rather than a new Meaux-specific registry.

## Ownership / handoff

- **Theme Tools:** read-only original capture, parsing, provenance and reusable CSS candidate identification.
- **Existing `@inneranimalmedia/section-library`:** real candidate renderers, independent hover/motion CSS, browser demonstration in `examples/meaux-specimens/`.
- **Existing CMS:** `cms_definitions` + `cms_artifacts` is the only approval/installation authority. Inspector typing, persistence, account scope, rollback and second-site installation need proof before stock promotion.
- **AgentSam Brand:** brand ingestion/analysis/optimization and provenance pipelines only; does not own a canned UI template catalog.
- **`theme-scenes`:** compositions only, does not own cards/buttons/typography primitives.

Fonts in examples include Inter and Montserrat; Bison, Masterday and Futura are *references*, not packaged font binaries or limited font selections. Do not redistribute font files without a license.

No FNF tenant copy or demo partner data is permitted in the reusable renderer. The customer site supplies actual media/URL/copy.
