# Portable static-section refinery

This package provides a **working, bounded static-section compiler**, not arbitrary autonomous visual reconstruction.

\`compileStaticSection(html, {marker?, start?, css?, assets?, sourceId?, strict?})\`

- Select by unique \`data-cms-section\` marker or an exact source offset returned from \`planHtmlRebuild()\`.
- Preserve the actual fragment; detect scripts, interactive elements, event handlers, global CSS, external stylesheets and unresolved media.
- Extract direct heading/body copy, image src/alt and link URL into editable typed settings.
- Scope basic CSS and nested conditional queries to the per-instance namespace.
- Keep third-party JavaScript quarantined; unsupported material blocks compilation.

\`renderStaticSection(definition, {uid, settings})\`

- Accepts independent per-instance setting overrides, escapes text/attributes, validates URLs and namespaces HTML IDs/ARIA references.
- Returns renderable HTML/CSS and a CMS SiteContract-shaped \`sectionInstance\`, **not a persisted or installed CMS section**.

**Example:**

\`\`\`js
const plan = planHtmlRebuild(source,{filename:'historical.html'});
const region = plan.candidates.find(x=>x.tag==='section');
const compiled = compileStaticSection(source,{
  start:region.sourceRange.start,
  assets:['/assets/photo.webp']
});
const render = renderStaticSection(compiled,{
  uid:'section123',
  settings:{heading_1:'Updated title'}
});
\`\`\`

The runner is deliberately strict. Historical HTML with app-level scripts, global styles or unmatched images remains a catalog candidate requiring explicit normalization rather than quietly losing visual behavior. The stronger interactive/CMS pipeline still needs runtime verification and installation.
