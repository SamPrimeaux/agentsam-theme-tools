import { parseHtml, walkHtml, attribute, analyzeHtml } from '@inneranimalmedia/theme-syntax-html';

export const HTML_REBUILD_PLAN_SCHEMA = 'agentsam.html-rebuild-plan.v1';
const CANDIDATE_TAGS = new Set(['header', 'footer', 'nav', 'main', 'section', 'article', 'aside']);
const HEADING_TAGS = new Set(['h1','h2','h3','h4','h5','h6']);

/**
 * Builds source-backed extraction candidates, never a "ready" CMS component.
 * Does not execute scripts, resolve remote dependencies, or change source.
 */
export function planHtmlRebuild(source, { filename = 'index.html', includeSource = false } = {}) {
  if (typeof source !== 'string') throw new TypeError('HTML source must be a string');
  const { document, errors } = parseHtml(source);
  const analyzed = analyzeHtml(source, { filename });
  const nodes = [], ids = new Map();
  let scriptElements = 0, styleElements = 0, inlineHandlers = 0, inlineStyles = 0;
  walkHtml(document, node => {
    nodes.push(node);
    const id = attribute(node, 'id');
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    if (node.tagName === 'script') scriptElements++;
    if (node.tagName === 'style') styleElements++;
    for (const a of node.attrs || []) {
      if (/^on[a-z]+$/i.test(a.name)) inlineHandlers++;
      if (a.name === 'style') inlineStyles++;
    }
  });
  const duplicateIds = [...ids].filter(([_, count]) => count > 1).map(([id]) => id);
  const candidates = [];
  for (const node of nodes) {
    const loc = node.sourceCodeLocation;
    const tag = node.tagName;
    const marker = attribute(node, 'data-cms-section');
    if (!CANDIDATE_TAGS.has(tag) && !marker) continue;
    if (!loc || !Number.isInteger(loc.startOffset) || !Number.isInteger(loc.endOffset)) continue;
    const original = source.slice(loc.startOffset, loc.endOffset);
    // Walk this actual subtree rather than scanning the entire document per candidate.
    // This keeps rebuild planning proportional to each section's tree depth.
    const nested = [];
    walkHtml(node, descendant => nested.push(descendant));
    const deps = analyzed.references.filter(ref => ref.start != null && ref.end != null &&
      ref.start >= loc.startOffset && ref.end <= loc.endOffset).map(ref => ({
        tag:ref.tag, attribute:ref.attr, value:ref.value, kind:ref.kind, external:ref.external,
        range:{start:ref.start,end:ref.end}
      }));
    const hazards = [
      ...(nested.some(n => n.tagName === 'script') ? ['script-needs-isolation'] : []),
      ...(nested.some(n => n.tagName === 'style') ? ['css-needs-scoping'] : []),
      ...(nested.some(n => (n.attrs || []).some(a => /^on[a-z]+$/i.test(a.name))) ? ['inline-handlers-needs-review'] : []),
      ...(nested.some(n => (n.attrs || []).some(a => a.name === 'style')) ? ['inline-styles-needs-review'] : []),
      ...(deps.some(d => d.external) ? ['external-dependencies'] : []),
      ...(!loc.endTag ? ['no-explicit-end-tag'] : []),
    ];
    const headings = [], paragraphs = [], media = [], links = [];
    for (const child of nested) {
      const value = (child.childNodes || []).filter(n => n.nodeName === '#text')
        .map(n => n.value || '').join(' ').trim();
      if (HEADING_TAGS.has(child.tagName) && value) headings.push({tag:child.tagName,value});
      if (child.tagName === 'p' && value) paragraphs.push({value});
      if (child.tagName === 'img') media.push({role:'media.image',src:attribute(child,'src'),alt:attribute(child,'alt')});
      if (child.tagName === 'a') links.push({href:attribute(child,'href'),label:value});
    }
    const type = tag === 'header' || tag === 'footer' ? 'global-region'
      : tag === 'nav' ? 'navigation'
      : tag === 'main' ? 'page-shell' : 'section';
    const entry = {
      candidateId: filename + '#' + (marker || attribute(node,'id') || tag + '@' + loc.startOffset),
      type, marker: marker || null, tag, id: attribute(node,'id'),
      sourceRange:{start:loc.startOffset,end:loc.endOffset,
        contentStart:loc.startTag?.endOffset ?? loc.startOffset,
        contentEnd:loc.endTag?.startOffset ?? loc.endOffset},
      length:original.length, dependencies:deps,
      proposedFields:{headings,paragraphs,media,links},
      hazards:[...new Set(hazards)],
      state:'requires-normalization',
    };
    if (includeSource) entry.sourceHtml = original;
    candidates.push(entry);
  }
  return {
    schema:HTML_REBUILD_PLAN_SCHEMA,
    source:{filename,length:source.length},
    coverage:{analyzed:['html-structure','html-attribute-references','basic-copy-signals'],
      notAnalyzed:['css-cascade','javascript-behavior','liquid-semantics','runtime-dependencies','visual-fidelity']},
    evidence:{title:analyzed.title,elementCount:analyzed.elementCount,
      scriptElements,styleElements,inlineHandlers,inlineStyles,duplicateIds,
      parseErrors:errors,references:analyzed.references},
    candidates,state:'source-backed-candidates-only',
    readyForCms:false,verifiedPreview:false,approved:false,
  };
}
