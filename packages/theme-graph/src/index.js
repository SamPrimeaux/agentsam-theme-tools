import { analyzeHtml } from '@inneranimalmedia/theme-syntax-html';

export { buildThemeModuleGraph, dependencyClosure, affectedModules, planModuleExtraction,
  MODULE_GRAPH_SCHEMA, CLOSURE_SCHEMA, EXTRACTION_PLAN_SCHEMA } from './module-graph.js';

export const THEME_GRAPH_SCHEMA = 'agentsam.theme-graph.v1';
const DEFAULT_DOC = new Set(['.html', '.htm']);
const SKIP_LOCAL = /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i;

/** Build a source-backed graph; no CMS models, customer identity, persistence or network. */
export function buildThemeGraph(files) {
  if (!Array.isArray(files)) throw new TypeError('files array required');
  const identities = new Map();
  for (const file of files) {
    const id = normalizePath(file.path);
    if (identities.has(id)) throw new Error('duplicate_source_path: ' + id);
    identities.set(id, file);
  }
  const nodes = [...identities].map(([id, file]) => ({
    id, kind: DEFAULT_DOC.has(extname(id)) ? 'html' : 'resource',
    bytes: file.bytes ?? null, hash: file.sha256 ?? null
  }));
  const edges = [], diagnostics = [], pages = [];
  for (const [id, file] of identities) {
    if (!DEFAULT_DOC.has(extname(id)) || typeof file.text !== 'string') continue;
    const analysis = analyzeHtml(file.text, { filename: id });
    pages.push({ id, title: analysis.title, sections: analysis.sections });
    for (const error of analysis.errors) diagnostics.push({ severity: 'warning', code: 'HTML_PARSE', file: id, ...error });
    for (const ref of analysis.references) {
      if (SKIP_LOCAL.test(ref.value)) continue;
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref.value)) {
        edges.push({ from: id, to: ref.value, kind: ref.kind, external: true,
          attribute: ref.attr, original: ref.value,
          range: ref.start == null ? null : { start: ref.start, end: ref.end } });
        continue;
      }
      const pathname = ref.value.split(/[?#]/, 1)[0];
      if (!pathname) continue;
      let target;
      try {
        target = normalizePath(pathname.startsWith('/')
          ? pathname.slice(1) : join(dirname(id), pathname));
      } catch (error) {
        diagnostics.push({ severity: 'error', code: 'UNSAFE_REFERENCE_PATH',
          file: id, reference: ref.value, message: error.message });
        continue;
      }
      const resolved = identities.has(target);
      edges.push({ from: id, to: target, kind: ref.kind, external: false, resolved,
        attribute: ref.attr, original: ref.value });
      if (!resolved && ref.kind !== 'navigation') {
        diagnostics.push({ severity: 'warning', code: 'UNRESOLVED_RESOURCE',
          file: id, target, reference: ref.value });
      }
    }
  }
  return { schema: THEME_GRAPH_SCHEMA, nodes, edges, pages, diagnostics };
}

function extname(value) {
  const part = value.slice(value.lastIndexOf('/') + 1);
  const dot = part.lastIndexOf('.');
  return dot < 0 ? '' : part.slice(dot).toLowerCase();
}
function dirname(value) {
  const slash = value.lastIndexOf('/');
  return slash < 0 ? '.' : value.slice(0, slash);
}
function join(parent, child) {
  return parent === '.' ? child : parent + '/' + child;
}
function normalizePath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('source path required');
  const raw = value.replace(/\\/g, '/');
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw) || raw.includes('\0')) {
    throw new Error('invalid_graph_path: ' + value);
  }
  const segments = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!segments.length) throw new Error('invalid_graph_path: ' + value);
      segments.pop();
    } else segments.push(part);
  }
  return segments.join('/') || '.';
}
