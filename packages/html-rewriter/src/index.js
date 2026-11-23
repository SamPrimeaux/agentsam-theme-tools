import { parseHtml, walkHtml, attribute } from '@inneranimalmedia/theme-syntax-html';
export { planHtmlRebuild, HTML_REBUILD_PLAN_SCHEMA } from './plan.js';
export { compileStaticSection, renderStaticSection, scopeStaticCss, STATIC_SECTION_SCHEMA } from './static-section.js';

export const HTML_REWRITE_SCHEMA = 'agentsam.html-rewrite.v1';
const REFERENCE_ATTRS = ['src', 'href', 'poster', 'data-src'];
const TARGET_ATTRIBUTES = new Set(REFERENCE_ATTRS);
const MAX_RULES = 500;
const MAX_REFERENCE_BYTES = 8192;

/** Rust theme-machine v1 safety baseline; never treat rewritten donor HTML as trusted. */
export function validateRewriteUrl(value) {
  if (typeof value !== 'string' || !value ||
      new TextEncoder().encode(value).length > MAX_REFERENCE_BYTES ||
      /[\u0000\r\n]/.test(value) ||
      /^(?:javascript|vbscript|data|file):/i.test(value.trimStart())) {
    throw new Error('unsafe_replacement_url');
  }
  return value;
}
function normalizeReplacements(replacements) {
  if (replacements != null && !(replacements instanceof Map) &&
      (typeof replacements !== 'object' || Array.isArray(replacements))) {
    throw new TypeError('replacements must be a Map or object');
  }
  const lookup = replacements instanceof Map ? new Map(replacements)
    : new Map(Object.entries(replacements || {}));
  if (lookup.size > MAX_RULES) throw new Error('rewrite_rule_count_limit_exceeded');
  for (const [from, to] of lookup) {
    if (typeof from !== 'string' || !from ||
        new TextEncoder().encode(from).length > MAX_REFERENCE_BYTES) {
      throw new Error('invalid_rewrite_reference');
    }
    validateRewriteUrl(to);
  }
  return lookup;
}
function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/** Preserve original attribute name/case/whitespace and existing quote choice. */
function attributePatch(source, location, replacement, metadata) {
  const before = source.slice(location.startOffset, location.endOffset);
  const match = before.match(/^(\s*[^\s=/>]+\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))(\s*)$/s);
  if (!match) throw new Error('unsupported_attribute_source_shape');
  const quote = match[2] !== undefined ? '"' : match[3] !== undefined ? "'" : '"';
  return { start: location.startOffset, end: location.endOffset, before,
    after: match[1] + quote + escapeAttribute(replacement) + quote + match[5],
    kind: 'attribute', ...metadata };
}

/**
 * Exact source-range attribute rewrites. No HTML reserialization or script execution.
 * Extra opt-in srcset lane is conservative and NOT a claim of Rust/Workers parity.
 */
export function rewriteAssetReferences(source, replacements, { includeSrcset = false } = {}) {
  if (typeof source !== 'string') throw new TypeError('HTML source must be a string');
  const lookup = normalizeReplacements(replacements);
  const { document, errors } = parseHtml(source);
  const patches = [], diagnostics = [...errors];
  walkHtml(document, node => {
    for (const name of TARGET_ATTRIBUTES) {
      const value = attribute(node, name);
      if (value == null || !lookup.has(value)) continue;
      const location = node.sourceCodeLocation?.attrs?.[name];
      if (!location) continue;
      patches.push(attributePatch(source, location, lookup.get(value), {
        tag:node.tagName, attribute:name, original:value, replacement:lookup.get(value),
      }));
    }
    if (!includeSrcset) return;
    const value = attribute(node, 'srcset');
    if (value == null || ![...lookup.keys()].some(key => value.includes(key))) return;
    const location = node.sourceCodeLocation?.attrs?.srcset;
    if (!location) return;
    // Do not guess complex srcset parsing or rewrite data URIs, commas inside URLs,
    // or HTML entities. Only straightforward comma-separated candidates are supported.
    if (/\bdata:/i.test(value) ||
        /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(source.slice(location.startOffset, location.endOffset))) {
      diagnostics.push({code:'complex_srcset_unhandled',severity:'warning',start:location.startOffset});
      return;
    }
    let changed = 0;
    const next = value.split(',').map(item => {
      const match = item.match(/^(\s*)([^\s,]+)([\s\S]*)$/);
      if (!match || !lookup.has(match[2])) return item;
      changed++;
      return match[1] + lookup.get(match[2]) + match[3];
    }).join(',');
    if (changed) patches.push(attributePatch(source, location, next, {
      tag:node.tagName, attribute:'srcset', original:value, replacement:next, referencesChanged:changed,
    }));
  });
  return { schema:HTML_REWRITE_SCHEMA, html:applyPatches(source, patches),
    changed:patches.length, patches, diagnostics };
}

export function replaceSectionContent(source, { marker, html, trusted = false }) {
  if (!trusted) throw new Error('raw_html_requires_explicit_trust');
  if (!marker || typeof marker !== 'string' || typeof html !== 'string') throw new TypeError('marker and html are required');
  const { document, errors } = parseHtml(source);
  const hits = [];
  walkHtml(document, node => {
    if (attribute(node, 'data-cms-section') !== marker) return;
    const loc = node.sourceCodeLocation;
    if (!loc?.startTag || !loc?.endTag) throw new Error('section_has_no_explicit_end_tag');
    hits.push({ start:loc.startTag.endOffset, end:loc.endTag.startOffset,
      before:source.slice(loc.startTag.endOffset,loc.endTag.startOffset),
      after:html, kind:'section-content' });
  });
  if (hits.length !== 1) throw new Error('section_marker_must_be_unique: ' + marker + ' (' + hits.length + ')');
  return { schema:HTML_REWRITE_SCHEMA, html:applyPatches(source, hits),
    changed:hits.length, patches:hits, diagnostics:errors };
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

/** Optional Cloudflare Workers runtime; exact URL policy matches the source patcher. */
export function rewriteResponseWithCloudflare(response, replacements, Rewriter = globalThis.HTMLRewriter) {
  if (typeof Rewriter !== 'function') throw new Error('cloudflare_htmlrewriter_unavailable');
  const lookup = normalizeReplacements(replacements);
  const writer = new Rewriter();
  for (const name of REFERENCE_ATTRS) {
    writer.on('[' + name + ']', { element(element) {
      const original = element.getAttribute(name);
      if (original != null && lookup.has(original)) element.setAttribute(name, lookup.get(original));
    } });
  }
  return writer.transform(response);
}
