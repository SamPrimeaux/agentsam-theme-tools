# @inneranimalmedia/theme-graph

Portable, read-only source-reference graph for Theme Tools, with an additive **module graph** built from verified HTML references.

This package does not execute uploaded code, read a filesystem, fetch URLs, persist CMS pages, or publish sites. Supply a bounded, selected virtual file tree from @inneranimalmedia/theme-source-ingest.

## Public exports

- buildThemeGraph(files) — existing v1 HTML reference graph. HTML edges now include source-backed attribute ranges.
- buildThemeModuleGraph(files, options) — v1 module graph with root URI, entry point identities, typed module kinds, inbound references and outbound dependencies.
- dependencyClosure(graph, entryId, options) — recursively collect recognized dependencies, reporting missing/external/indirect/unexamined evidence; cycle-safe.
- affectedModules(graph, changedId, options) — reverse-reference traversal for change impact.
- planModuleExtraction(graph, entryId, options) — **read-only** candidate manifest listing recognized files with hashes and unresolved requirements. It does NOT create an artifact or claim portability.

## Example

~~~js
import {
  buildThemeModuleGraph,
  dependencyClosure,
  affectedModules,
  planModuleExtraction,
} from '@inneranimalmedia/theme-graph';

const files = [
  {
    path: 'index.html',
    text: '<!doctype html><link rel="stylesheet" href="assets/site.css"><img src="assets/logo.svg">',
  },
  { path: 'assets/site.css', text: '.hero { color: red }' },
  { path: 'assets/logo.svg', text: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' },
];
const graph = buildThemeModuleGraph(files);
const closure = dependencyClosure(graph, 'index.html');
const impacted = affectedModules(graph, 'assets/site.css');
const candidate = planModuleExtraction(graph, 'index.html');
// closure.modules contains 3 *recognized* files.
// candidate.portable is false until missing semantic and fidelity gates pass.
~~~

Run the CLI against any isolated source:

~~~sh
agentsam-theme closure /path/to/donor.zip --json
agentsam-theme closure /path/to/donor.zip --entry site/index.html
~~~

## Analysis limits

The implemented traversal initially covers dependencies identified by the existing **HTML asset-reference analyzer**. It cannot yet follow CSS @imports and url() values, JavaScript imports/selectors, Liquid render/schema dependencies, dynamic assets, global CSS side effects or motion behavior.

Consequently **module closure is NOT equivalent to a verified self-contained component package**. Unanalyzed source semantics, missing references and external resources are carried as explicit warnings. Every candidate is marked portable=false and contains no write instructions. Sections inside a page are not separate source modules yet.

For test fixtures and readable unit tests, see tests/module-graph.test.mjs. Package-local verification:

~~~sh
npm run test -w @inneranimalmedia/theme-graph
npm run verify
~~~

Full cross-language analysis and transform/renderer fidelity verification are tracked under [Issue #5](https://github.com/SamPrimeaux/agentsam-theme-tools/issues/5). The original source is authoritative; this output does not mint a second CMS schema.
