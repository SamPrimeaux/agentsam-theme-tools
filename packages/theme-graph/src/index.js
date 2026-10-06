import path from 'node:path';
import { analyzeHtml } from '@inneranimalmedia/theme-syntax-html';

export const THEME_GRAPH_SCHEMA = 'agentsam.theme-graph.v1';
const DEFAULT_DOC = new Set(['.html', '.htm']);
const SKIP_LOCAL = /^(?:data:|blob:|mailto:|tel:|javascript:|#|\/\/)/i;

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
    id, kind: DEFAULT_DOC.has(path.posix.extname(id).toLowerCase()) ? 'html' : 'resource',
    bytes: file.bytes ?? null, hash: file.sha256 ?? null
  }));
  const edges = [], diagnostics = [], pages = [];
  for (const [id, file] of identities) {
    if (!DEFAULT_DOC.has(path.posix.extname(id).toLowerCase()) || typeof file.text !== 'string') continue;
    const analysis = analyzeHtml(file.text, { filename: id });
    pages.push({ id, title: analysis.title, sections: analysis.sections });
    for (const error of analysis.errors) diagnostics.push({ severity: 'warning', code: 'HTML_PARSE', file: id, ...error });
    for (const ref of analysis.references) {
      if (SKIP_LOCAL.test(ref.value)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(ref.value)) {
        edges.push({ from: id, to: ref.value, kind: ref.kind, external: true });
        continue;
      }
      const pathname = ref.value.split(/[?#]/, 1)[0];
      if (!pathname) continue;
      const target = normalizePath(pathname.startsWith('/')
        ? pathname.slice(1) : path.posix.join(path.posix.dirname(id), pathname));
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

function normalizePath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('source path required');
  const posix = value.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const normalized = path.posix.normalize(posix);
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new Error('invalid_graph_path: ' + value);
  }
  return normalized;
}
