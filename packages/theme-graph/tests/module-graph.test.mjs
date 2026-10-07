import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildThemeGraph, buildThemeModuleGraph, dependencyClosure,
  affectedModules, planModuleExtraction, MODULE_GRAPH_SCHEMA,
} from '../src/index.js';

const indexHtml = [
  '<!doctype html><html><head>',
  '<link href="styles/theme.css" rel="stylesheet">',
  '<script src="scripts/scene.js"></script>',
  '</head><body><main><section data-cms-section="hero">',
  '<img src="assets/scene.svg" alt="Scene">',
  '<img src="assets/missing.svg" alt="Missing">',
  '</section><a href="other.html">Other page</a>',
  '</main></body></html>',
].join('');
const files = [
  { path: 'index.html', text: indexHtml, sha256: 'index' },
  { path: 'other.html', text: '<!doctype html><a href="index.html">Home</a>' },
  { path: 'styles/theme.css', text: '.hero { background: url("../assets/scene.svg") }' },
  { path: 'scripts/scene.js', text: 'document.querySelector(".hero")?.animate([]);' },
  { path: 'assets/scene.svg', bytes: 12, sha256: 'svg' },
];

test('new graph preserves existing v1 behavior and adds bidirectional typed module references', () => {
  const old = buildThemeGraph(files);
  assert.ok(old.edges.some((edge) => edge.to === 'styles/theme.css'));
  const graph = buildThemeModuleGraph(files);
  assert.equal(graph.schema, MODULE_GRAPH_SCHEMA);
  assert.deepEqual(graph.entryPoints, ['index.html', 'other.html']);
  assert.equal(Object.keys(graph.modules).length, 5);
  assert.equal(graph.modules['styles/theme.css'].type, 'css');
  assert.equal(graph.modules['styles/theme.css'].kind, 'asset');
  const stylesheet = graph.modules['index.html'].dependencies.find((edge) => edge.target.path === 'styles/theme.css');
  assert.equal(stylesheet.type, 'direct');
  assert.equal(stylesheet.kind, 'stylesheet');
  assert.equal(stylesheet.resolved, true);
  assert.deepEqual(graph.modules['styles/theme.css'].references, [stylesheet]);
  assert.equal(stylesheet.source.path, 'index.html');
  assert.equal(indexHtml.slice(stylesheet.source.range.start, stylesheet.source.range.end).includes('styles/theme.css'), true);
});

test('closure includes known direct dependencies, optional indirect navigation and terminates cycles', () => {
  const graph = buildThemeModuleGraph(files);
  const direct = dependencyClosure(graph, 'index.html', { includeIndirect: false });
  assert.deepEqual(direct.modules, ['assets/scene.svg', 'index.html', 'scripts/scene.js', 'styles/theme.css']);
  assert.equal(direct.omittedIndirect.length, 1);
  assert.equal(direct.unresolved.length, 1);
  const full = dependencyClosure(graph, 'index.html');
  assert.ok(full.modules.includes('other.html'));
  assert.equal(full.modules.length, 5);
  assert.equal(full.references.filter((ref) => ref.kind === 'navigation').length, 2);
  assert.equal(full.portability, 'unverified');
});

test('all unresolved and unanalyzed semantics are carried into an extraction proposal', () => {
  const graph = buildThemeModuleGraph(files);
  const result = planModuleExtraction(graph, 'index.html');
  assert.equal(result.portable, false);
  assert.equal(result.status, 'candidate-needs-verification');
  assert.equal(result.writes.length, 0);
  assert.equal(result.files.length, 5);
  assert.ok(result.dependencyClosure.blockers.includes('unresolved-references'));
  assert.ok(result.dependencyClosure.blockers.includes('unexamined-source-semantics'));
  assert.ok(result.dependencyClosure.blockers.includes('render-and-behavior-fidelity-not-verified'));
  assert.ok(result.dependencyClosure.unexamined.some((note) =>
    note.module === 'scripts/scene.js' && note.reason.includes('script-imports')));
  assert.ok(result.dependencyClosure.unexamined.some((note) =>
    note.module === 'styles/theme.css' && note.reason.includes('css-imports')));
  assert.equal(result.targetCmsContract, null);
});

test('reverse impact follows inbound references without infinite cycles', () => {
  const graph = buildThemeModuleGraph(files);
  assert.deepEqual(affectedModules(graph, 'assets/scene.svg'), ['index.html', 'other.html']);
  assert.deepEqual(affectedModules(graph, 'index.html'), ['other.html']);
  assert.deepEqual(affectedModules(graph, 'styles/theme.css', { includeIndirect: false }), ['index.html']);
});

test('external references stay outside copy closure, with explicit unresolved dependencies', () => {
  const graph = buildThemeModuleGraph([
    { path: 'index.html', text: '<!doctype html><script src="https://cdn.example.org/runtime.js"></script><img src="assets/lost.png">' },
  ]);
  const result = dependencyClosure(graph, 'index.html');
  assert.deepEqual(result.modules, ['index.html']);
  assert.equal(result.external.length, 1);
  assert.equal(result.unresolved.length, 1);
  assert.ok(result.blockers.includes('external-dependencies'));
  assert.ok(result.blockers.includes('unresolved-references'));
});

test('a chosen input scope does not acquire ambient repo modules or extra entry points', () => {
  const graph = buildThemeModuleGraph(files.slice(0, 2), { entryPoints: ['index.html'], rootUri: 'theme://picked-zip/' });
  assert.deepEqual(graph.entryPoints, ['index.html']);
  assert.equal(Object.keys(graph.modules).length, 2);
  assert.equal(graph.modules['index.html'].uri, 'theme://picked-zip/index.html');
  assert.ok(!graph.modules['styles/theme.css']);
  assert.throws(() => buildThemeModuleGraph(files, { entryPoints: ['../different-repo/index.html'] }), /invalid_graph_entry_point/);
  assert.throws(() => buildThemeModuleGraph(files, { rootUri: '/Users/private/path' }), /rootUri/);
});

test('deterministic JSON output contains source-backed modules, no executable sources or host paths', () => {
  const first = buildThemeModuleGraph(files);
  const second = buildThemeModuleGraph([...files].reverse());
  assert.deepEqual(Object.keys(first.modules), Object.keys(second.modules));
  const out = JSON.stringify(planModuleExtraction(first, 'index.html'));
  assert.ok(!out.includes('document.querySelector'));
  assert.ok(!out.includes('/Users/'));
  assert.ok(out.includes('theme://source/index.html'));
});

test('legacy v1 HTML graph retains source ranges without modifying existing edge schema', () => {
  const graph = buildThemeGraph(files);
  const stylesheet = graph.edges.find((edge) => edge.to === 'styles/theme.css');
  assert.ok(Number.isInteger(stylesheet.range.start));
  assert.equal(indexHtml.slice(stylesheet.range.start, stylesheet.range.end).includes('styles/theme.css'), true);
  assert.ok(graph.pages[0].sections.some((section) => section.name === 'hero'));
});
