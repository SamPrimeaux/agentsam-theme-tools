# BrandPack / CMS Boundary for Design Mining

**Status:** desired integration target, not an additional brand schema.

## Authority

AgentSam already has two related contracts:
- inneranimalmedia / app/protocol/brand/contract.v1.json: agentsam.contract/v1 — authoritative identity, positioning, voice, brand rules, inherited overrides, approvals.
- agentsam-sdk / packages/agentsam-brand/src/core/v2/schema.js: agentsam.brand-pack.v2 — materialized brand assets, semantic asset roles, token groups, delivery projections and provenance.

Never create a third authoritative BrandPack or write user-discovered palette tokens straight into production brand identity. Proposed **brand findings** are tracked separately, reviewed and validated before making an approved contract revision.

## Target mapping from mined sources

| Discovered material | Proposed candidate | Authority after approval |
| --- | --- | --- |
| CSS colors, fonts, motion timings | Token proposal with exact source spans, visual sample and confidence | BrandPack semantic tokens and Theme projections |
| Logos, images, backgrounds | Source asset + role suggestion + master/derivative decision | Asset Core ast_* identity + BrandPack role references |
| Cards, grid, narrative chapters | Native semantic section/block or artifact-backed static component | CMS site/section registry |
| Sticky, WebGL, canvas, specialized effects | Interactive candidate with dependency and permissions audit | Reviewed artifact-interactive runtime, not raw donor scripts |
| Brand copy or design principle | Identity/voice proposal, never silent root rewrite | BrandContract after owner approval |
| Glass shapes and rendered 3D stills | Master media and layered-scene relationships | 3D Studio masters; Asset Core and R2 deliverable refs |

## Minimal promotion receipt contract

Source intake receipts need:
source_sha256, source_r2_key, provenance, original_filename, group/duplicate relationship, candidate_type, dependence graph, user_review and quality state.

Normalization receipts additionally need:
normalizer version, normalized sha, typed settings/blocks, CSS namespace, JS policy, accessibility/mobile evidence, preview media and approved host target.

Installation receipts additionally need:
CMS component/template id, page instance id, D1 persistence, R2 object refs, branch and deployed SHA, tested customer route, draft/preview/publish proof and approval.

## Presentation relationship

INNERANIMALMEDIA: editorial, light/luminous, spacious, blue/white/graphite family.
AGENTSAM: product/workspace, deep navy controlled luminosity, technical controls.
These are **design intentions** from planning, not a frozen token table. IA and AgentSam may share authoritative symbol, typography roles, UI quality constraints and an explicit brand-family relationship while retaining separate color and experience variants.

The three HTML donors in this batch are not exact production designs. The interactive Brand Kit should eventually edit a real resolved BrandPack, the Services and Create pages should supply reusable sections, and the glass scenes should remain independently cataloged until inspected and rendered.
