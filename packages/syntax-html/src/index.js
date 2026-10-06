import { parse, parseFragment } from 'parse5';

export const HTML_ANALYSIS_SCHEMA = 'agentsam.html-analysis.v1';
const SEMANTIC = new Set(['header', 'footer', 'main', 'nav', 'section', 'article', 'aside']);
const ASSET_TAGS = new Set(['img', 'source', 'script', 'link', 'video', 'audio', 'iframe', 'embed', 'object', 'track']);
const RESOURCE_ATTRS = new Set(['src', 'href', 'poster', 'srcset', 'data-src']);
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function parseHtml(source, { fragment = false } = {}) {
  if (typeof source !== 'string') throw new TypeError('HTML source must be a string');
  const errors = [];
  const options = { sourceCodeLocationInfo: true, onParseError: (error) => errors.push({
    code: error.code, line: error.startLine, column: error.startCol,
  }) };
  const document = fragment ? parseFragment(source, options) : parse(source, options);
  return { document, errors };
}

export function walkHtml(root, visit, parent = null) {
  if (!root) return;
  if (root.tagName) visit(root, parent);
  for (const child of root.childNodes || []) walkHtml(child, visit, root);
  if (root.content) walkHtml(root.content, visit, root);
}

export function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value ?? null;
}

export function analyzeHtml(source, { filename = 'input.html', fragment = false } = {}) {
  const { document, errors } = parseHtml(source, { fragment });
  const sections = [], references = [], elements = [];
  let title = null;
  walkHtml(document, (node, parent) => {
    const tag = node.tagName;
    const loc = node.sourceCodeLocation;
    const attrs = Object.fromEntries((node.attrs || []).map((a) => [a.name, a.value]));
    elements.push({ tag, id: attrs.id || null, start: loc?.startOffset ?? null, end: loc?.endOffset ?? null });
    if (tag === 'title') title = (node.childNodes || []).map((n) => n.value || '').join('').trim();
    const cmsSlot = attrs['data-cms-section'] || null;
    if (SEMANTIC.has(tag) || cmsSlot) {
      sections.push({ kind: cmsSlot ? 'declared' : 'semantic', name: cmsSlot || attrs.id || tag,
        tag, id: attrs.id || null, start: loc?.startOffset ?? null, end: loc?.endOffset ?? null,
        startTagEnd: loc?.startTag?.endOffset ?? null, endTagStart: loc?.endTag?.startOffset ?? null,
        parentTag: parent?.tagName || null });
    }
    for (const entry of node.attrs || []) {
      if (!RESOURCE_ATTRS.has(entry.name)) continue;
      if (entry.name === 'href' && !['a', 'link', 'area'].includes(tag)) continue;
      if (entry.name !== 'href' && !ASSET_TAGS.has(tag) && entry.name !== 'data-src') continue;
      const location = loc?.attrs?.[entry.name] || null;
      const kind = tag === 'a' || tag === 'area' ? 'navigation'
        : tag === 'link' && attrs.rel?.split(/\s+/).includes('stylesheet') ? 'stylesheet'
          : tag === 'script' ? 'script' : 'asset';
      const values = entry.name === 'srcset' ? parseSrcset(entry.value) : [entry.value];
      for (const value of values) {
        if (!value) continue;
        references.push({ tag, attr: entry.name, value, kind,
          external: EXTERNAL_RE.test(value), start: location?.startOffset ?? null,
          end: location?.endOffset ?? null });
      }
    }
  });
  return {
    schema: HTML_ANALYSIS_SCHEMA, filename, title, errors, elementCount: elements.length,
    sections, references, elements,
  };
}

/** A conservative srcset tokenizer: recognizes source URLs, never rewrites them implicitly. */
function parseSrcset(value) {
  return String(value).split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
}
