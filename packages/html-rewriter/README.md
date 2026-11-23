# @inneranimalmedia/theme-html-rewriter

A **portable, source-preserving** HTML patching and reconstruction-planning package for AgentSam Theme Tools. Node 22+, optional Cloudflare adapter. It does not own a CMS, browser preview, OAuth, BrandPack, or publishing.

## What it actually does

- \`rewriteAssetReferences(source, mapping)\`: exact \`href\`, \`src\`, \`poster\`, \`data-src\` rewriting. No unrelated source is serialized, and replacement URLs follow the Rust v1 unsafe-scheme baseline.
- \`rewriteAssetReferences(source, mapping, {includeSrcset:true})\`: opt-in rewriting for **simple** comma-separated responsive candidates. Complex data-URI/entity-bearing \`srcset\` is flagged, not modified; parity with Rust and Workers is not yet implemented.
- \`replaceSectionContent(source, {marker,html,trusted:true})\`: edit one unique, explicitly marked section. Raw HTML remains privileged and requires caller approval.
- \`applyPatches(source, patches)\`: rejects overlaps and stale precondition ranges.
- \`planHtmlRebuild(source, {filename,includeSource:false})\`: source-backed candidate sections, exact ranges, basic proposed fields, reference evidence and CSS/JS risk flags.
- \`rewriteResponseWithCloudflare(response, mapping)\`: optional streaming Worker adapter for the four exact attributes.

### Example

\`\`\`js
import { planHtmlRebuild, rewriteAssetReferences } from '@inneranimalmedia/theme-html-rewriter';

const plan = planHtmlRebuild(html, {filename:'legacy/index.html'});
console.log(plan.candidates.map(x => ({id:x.candidateId, hazards:x.hazards})));
console.log(plan.readyForCms); // always false until consumer proof

const result = rewriteAssetReferences(html, {'./image.png':'/assets/image.webp'});
console.log(result.changed, result.patches);
\`\`\`

The existing CLI gains \`agentsam-theme plan <path-or-archive> [--entry relative.html] --json\` to run this against real source files and include module dependency closure. It does not mutate the donor.

## Required next gates before stock/reusable

1. Parse deeper CSS imports/selector dependencies, JS modules/listeners, Liquid and schema blocks.
2. Extract/normalize typed settings, nested blocks, media roles, scoped CSS and approved interaction definitions.
3. Verify original and candidate in isolated browsers at mobile/desktop widths, including motion and keyboard accessibility.
4. Install through the **existing** CMS registry, then prove instance edit, clone, draft, reload, preview and publish on real D1/R2.
5. Emit a receipt with original hash, normalized revision, CMS ID, deployed SHA, and validation evidence.

A successful patch or rebuild *plan* is not a valid CMS section. Do not publish donor JavaScript or automatically assign source-derived brand colors to BrandPack. The Rust Theme Machine and Cloudflare HTMLRewriter remain low-level adapters, not separate brand or CMS authorities.

Extra npm dependencies are not an indicator of completeness; every added dependency needs an implemented, tested capability.
