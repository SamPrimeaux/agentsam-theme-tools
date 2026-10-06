import { parseHtml, walkHtml, attribute } from '@inneranimalmedia/theme-syntax-html';

export const HTML_REWRITE_SCHEMA = 'agentsam.html-rewrite.v1';
const REFERENCE_ATTRS = ['src', 'href', 'poster', 'data-src'];
const TARGET_ATTRIBUTES = new Set(REFERENCE_ATTRS);

/**
 * Minimal, source-preserving HTML attribute patching. Uses parse5 source ranges
 * rather than HTML serialization so untouched markup/CSS/JS stays byte-identical.
 * A map lookup is exact; URLs are never silently normalized.
 */
export function rewriteAssetReferences(source, replacements) {
  if (typeof source !== 'string') throw new TypeError('HTML source must be a string');
  const lookup = replacements instanceof Map ? replacements : new Map(Object.entries(replacements || {}));
  const { document, errors } = parseHtml(source);
  const patches = [];
  walkHtml(document, (node) => {
    for (const name of TARGET_ATTRIBUTES) {
      const value = attribute(node, name);
      if (value == null || !lookup.has(value)) continue;
      const location = node.sourceCodeLocation?.attrs?.[name];
      if (!location) continue;
      const replacement = lookup.get(value);
      if (typeof replacement !== 'string') throw new TypeError('replacement URLs must be strings');
      const before = source.slice(location.startOffset, location.endOffset);
      const match = before.match(/^([^=]+=\s*)(["'])([\s\S]*)(["'])$/);
      const content = escapeAttribute(replacement);
      const after = match && match[2] === match[4]
        ? match[1] + match[2] + content + match[4]
        : name + '="' + content + '"';
      patches.push({ start: location.startOffset, end: location.endOffset, before, after,
        kind: 'attribute', tag: node.tagName, attribute: name });
    }
  });
  return { schema: HTML_REWRITE_SCHEMA, html: applyPatches(source, patches),
    changed: patches.length, patches, diagnostics: errors };
}

export function replaceSectionContent(source, { marker, html, trusted = false }) {
  if (!trusted) throw new Error('raw_html_requires_explicit_trust');
  if (!marker || typeof marker !== 'string' || typeof html !== 'string') throw new TypeError('marker and html are required');
  const { document, errors } = parseHtml(source);
  const hits = [];
  walkHtml(document, (node) => {
    if (attribute(node, 'data-cms-section') !== marker) return;
    const loc = node.sourceCodeLocation;
    if (!loc?.startTag || !loc?.endTag) throw new Error('section_has_no_explicit_end_tag');
    hits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset,
      before: source.slice(loc.startTag.endOffset, loc.endTag.startOffset),
      after: html, kind: 'section-content' });
  });
  if (hits.length !== 1) throw new Error('section_marker_must_be_unique: ' + marker + ' (' + hits.length + ')');
  return { schema: HTML_REWRITE_SCHEMA, html: applyPatches(source, hits),
    changed: hits.length, patches: hits, diagnostics: errors };
}

export function applyPatches(source, patches) {
  const ordered = [...patches].sort((a,b) => b.start - a.start || b.end - a.end);
  let highWater = source.length, result = source;
  for (const patch of ordered) {
    if (!Number.isInteger(patch.start) || !Number.isInteger(patch.end) ||
        patch.start < 0 || patch.end > source.length || patch.end > highWater || patch.start > patch.end) {
      throw new Error('overlapping_or_invalid_source_patch');
    }
    if (source.slice(patch.start, patch.end) !== patch.before) throw new Error('source_patch_precondition_failed');
    result = result.slice(0, patch.start) + patch.after + result.slice(patch.end);
    highWater = patch.start;
  }
  return result;
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

/** Optional Cloudflare Workers streaming runtime. Not used by the portable source patcher. */
export function rewriteResponseWithCloudflare(response, replacements, Rewriter = globalThis.HTMLRewriter) {
  if (typeof Rewriter !== 'function') throw new Error('cloudflare_htmlrewriter_unavailable');
  const lookup = replacements instanceof Map ? replacements : new Map(Object.entries(replacements || {}));
  const writer = new Rewriter();
  for (const name of REFERENCE_ATTRS) {
    writer.on('[' + name + ']', { element(element) {
      const original = element.getAttribute(name);
      if (original != null && lookup.has(original)) element.setAttribute(name, lookup.get(original));
    } });
  }
  return writer.transform(response);
}
