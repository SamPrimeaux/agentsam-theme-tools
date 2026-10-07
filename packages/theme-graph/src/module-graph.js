/**
 * Portable module/reference graph layered on the v1 HTML reference inventory.
 *
 * Deliberately exposes coverage gaps. A set of recognized HTML asset references
 * does not establish a runnable/copyable component; CSS/JS/Liquid semantics,
 * dynamic imports, globals, selectors, and runtime wiring still require analysis.
 *
 * No filesystem, network, brand, CMS or Worker dependencies.
 */
import { buildThemeGraph } from './index.js';
import { analyzeHtml } from '@inneranimalmedia/theme-syntax-html';

export const MODULE_GRAPH_SCHEMA = 'agentsam.theme-module-graph.v1';
export const CLOSURE_SCHEMA = 'agentsam.theme-closure.v1';
export const EXTRACTION_PLAN_SCHEMA = 'agentsam.theme-extraction-plan.v1';

const EXTENSIONS = Object.freeze({
  '.html': 'html', '.htm': 'html', '.liquid': 'liquid',
  '.css': 'css', '.scss': 'css', '.sass': 'css',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.json': 'json', '.jsonc': 'jsonc',
});
const SEGMENT_KIND = Object.freeze({
  templates: 'template', layouts: 'layout', layout: 'layout',
  sections: 'section', blocks: 'block', snippets: 'snippet',
  assets: 'asset', components: 'component', scenes: 'scene',
});
const HTML_ENTRIES = new Set(['html']);

function classify(path) {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  const extension = dot === -1 ? '' : file.slice(dot).toLowerCase();
  const language = EXTENSIONS[extension] ?? 'binary-or-unknown';
  const first = path.split('/')[0];
  const kind = SEGMENT_KIND[first] ?? (HTML_ENTRIES.has(language) ? 'page' : 'asset');
  return { language, kind };
}

function makeUri(rootUri, path) {
  return rootUri + path.split('/').map(encodeURIComponent).join('/');
}

function validateRootUri(rootUri) {
  if (typeof rootUri !== 'string' || !/^[a-z][a-z0-9+.-]*:\/\//i.test(rootUri) ||
      !rootUri.endsWith('/') || rootUri.includes('#') || rootUri.includes('?')) {
    throw new TypeError('rootUri must be an absolute URI ending in /');
  }
}

function coverageFor(file, path, language) {
  const skipped = [];
  let analyzed = [];
  if (language === 'html') {
    analyzed = ['html-elements', 'html-asset-references'];
    if (typeof file?.text !== 'string') skipped.push('html-source-unavailable');
    else {
      // Tag presence is a signal, not an assertion that embedded code was parsed.
      const tags = analyzeHtml(file.text).elements.map((node) => node.tag);
      if (tags.includes('script')) skipped.push('javascript-execution-and-inline-semantics');
      if (tags.includes('style')) skipped.push('inline-css-semantics');
      if (tags.includes('template')) skipped.push('embedded-template-semantics');
    }
  } else if (language === 'javascript' || language === 'typescript') {
    skipped.push('script-imports-selectors-and-runtime-semantics');
  } else if (language === 'css') {
    skipped.push('css-imports-urls-selectors-and-global-cascade');
  } else if (language === 'liquid') {
    skipped.push('liquid-tags-objects-renders-and-schema');
  } else if (language === 'json' || language === 'jsonc') {
    skipped.push('structured-template-and-preset-references');
  } else {
    // Non-text assets may be copied but are not semantically inspected.
    skipped.push('binary-or-unsupported-source');
  }
  return { analyzed, skipped };
}

/**
 * Construct indexed modules with inbound and outbound typed references.
 * The starting edges are deliberately limited to what buildThemeGraph(v1)
 * actually recognizes. No source is executed or loaded from outside files.
 */
export function buildThemeModuleGraph(files, { rootUri = 'theme://source/', entryPoints } = {}) {
  validateRootUri(rootUri);
  const legacy = buildThemeGraph(files);
  const inputs = new Map(files.map((f) => [f.path.replace(/\\/g, '/'), f]));
  const modules = Object.create(null);
  for (const node of [...legacy.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const { language, kind } = classify(node.id);
    modules[node.id] = {
      id: node.id,
      uri: makeUri(rootUri, node.id),
      type: language, kind,
      bytes: node.bytes, hash: node.hash,
      dependencies: [], references: [],
      coverage: coverageFor(inputs.get(node.id), node.id, language),
    };
  }
  for (const edge of legacy.edges) {
    const parent = modules[edge.from];
    if (!parent) throw new Error('missing_graph_source: ' + edge.from);
    const target = modules[edge.to];
    const reference = {
      type: edge.kind === 'navigation' || edge.attribute === 'data-src' ? 'indirect' : 'direct',
      kind: edge.kind,
      source: { uri: parent.uri, path: parent.id, range: edge.range ?? null },
      target: { uri: target?.uri ?? (edge.external ? edge.to : makeUri(rootUri, edge.to)), path: edge.to },
      resolved: Boolean(target),
      external: Boolean(edge.external),
      attribute: edge.attribute ?? null,
      original: edge.original ?? null,
    };
    parent.dependencies.push(reference);
    if (target) target.references.push(reference);
  }
  const ids = entryPoints === undefined
    ? legacy.pages.map((p) => p.id).sort()
    : entryPoints;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !modules[id])) {
    throw new Error('invalid_graph_entry_point');
  }
  if (new Set(ids).size !== ids.length) throw new Error('duplicate_graph_entry_point');
  return {
    schema: MODULE_GRAPH_SCHEMA,
    rootUri,
    entryPoints: [...ids],
    modules,
    diagnostics: legacy.diagnostics,
    sourceCoverage: {
      recognized: ['html-elements', 'html-asset-references'],
      unsupported: ['liquid-dependencies', 'css-dependencies', 'js-dependencies',
        'selectors', 'global-styles', 'dynamic-runtime-behavior'],
    },
  };
}

function requireModule(graph, id) {
  if (!graph || graph.schema !== MODULE_GRAPH_SCHEMA) throw new TypeError('module graph required');
  if (!Object.prototype.hasOwnProperty.call(graph.modules, id)) throw new Error('unknown_graph_module: ' + id);
  return graph.modules[id];
}

/**
 * Traverse exact, known references. All indirect, external and unresolved
 * requirements stay visible even when they cannot be automatically collected.
 */
export function dependencyClosure(graph, entryId, { includeIndirect = true } = {}) {
  requireModule(graph, entryId);
  const seen = new Set();
  const queue = [entryId];
  const references = [];
  const unresolved = [], external = [], omittedIndirect = [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const module = graph.modules[id];
    for (const ref of module.dependencies) {
      references.push(ref);
      if (ref.external) {
        external.push(ref);
      } else if (!ref.resolved) {
        unresolved.push(ref);
      } else if (ref.type === 'indirect' && !includeIndirect) {
        omittedIndirect.push(ref);
      } else if (!seen.has(ref.target.path)) {
        queue.push(ref.target.path);
      }
    }
  }
  const moduleIds = [...seen].sort();
  const unexamined = moduleIds.flatMap((id) =>
    graph.modules[id].coverage.skipped.map((reason) => ({ module: id, reason })));
  return {
    schema: CLOSURE_SCHEMA,
    entryPoint: entryId,
    modules: moduleIds,
    references,
    unresolved,
    external,
    omittedIndirect,
    unexamined,
    coverage: 'partial',
    portability: 'unverified',
    blockers: [
      ...(unresolved.length ? ['unresolved-references'] : []),
      ...(external.length ? ['external-dependencies'] : []),
      ...(omittedIndirect.length ? ['excluded-indirect-references'] : []),
      ...(unexamined.length ? ['unexamined-source-semantics'] : []),
      'render-and-behavior-fidelity-not-verified',
    ],
  };
}

/** Reverse dependency traversal; useful before deleting or replacing a module. */
export function affectedModules(graph, changedId, { includeIndirect = true } = {}) {
  requireModule(graph, changedId);
  const seen = new Set([changedId]);
  const queue = [changedId];
  while (queue.length) {
    const current = graph.modules[queue.shift()];
    for (const ref of current.references) {
      if (ref.type === 'indirect' && !includeIndirect) continue;
      const parent = ref.source.path;
      if (!seen.has(parent)) {
        seen.add(parent);
        queue.push(parent);
      }
    }
  }
  seen.delete(changedId);
  return [...seen].sort();
}

/**
 * No writes, source copies, compilation, design conversion or CMS assertions.
 * The plan exposes what could be copied alongside missing dependencies.
 */
export function planModuleExtraction(graph, entryId, options = {}) {
  const closure = dependencyClosure(graph, entryId, options);
  return {
    schema: EXTRACTION_PLAN_SCHEMA,
    status: 'candidate-needs-verification',
    sourceRootUri: graph.rootUri,
    entryPoint: entryId,
    files: closure.modules.map((id) => {
      const m = graph.modules[id];
      return { path: m.id, uri: m.uri, type: m.type, kind: m.kind, bytes: m.bytes, hash: m.hash };
    }),
    dependencyClosure: closure,
    writes: [],
    portable: false,
    targetCmsContract: null,
    notes: [
      'No source files were modified.',
      'The graph currently discovers HTML references only.',
      'This plan is not a runnable package or a verified CMS section.',
    ],
  };
}
