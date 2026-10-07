# @inneranimalmedia/theme-source-ingest

Read-only, source-scoped intake for HTML files, directories, ZIP/TAR archives, and selected Git-bundle snapshots. Results can be consumed by the Theme Tools graph and CLI without requiring a customer CMS, application, or Cloudflare Worker.

## Actual output

The importer has two separate responsibilities:

1. **Inventory**: report accepted source files, languages, top-level folders, original/source format, likely framework/theme structure and explicit unsupported analysis.
2. **Analysis**: currently parses **HTML files and their HTML asset references only**. It does **not** interpret Liquid templates, CSS/JS semantics, React components or embedded app bundlers yet. A zero-diagnostic result is not a site validation.

Use the CLI:

~~~sh
agentsam-theme inventory /path/to/legacy-theme
agentsam-theme inventory /path/to/legacy-theme.zip
agentsam-theme inventory /path/to/legacy-theme.zip --json
agentsam-theme inspect /path/to/legacy-theme
agentsam-theme closure /path/to/legacy-theme.zip --entry website/index.html
~~~

The default ingest and inspect human outputs also print the compact inventory; the inventory --json command returns only the small, machine-readable summary (without embedding source code or media bytes).

The source-inventory contract is exported through the public package entry point:

~~~js
import {
  ingestSourceInputs, buildSourceInventory,
  shouldIgnoreSourcePath, SOURCE_INVENTORY_SCHEMA,
} from '@inneranimalmedia/theme-source-ingest';

const report = await ingestSourceInputs('/path/to/donor-directory');
const material = report.materials[0];
console.log(material.inventory);
~~~

The source path is selected explicitly. No operation reads an ambient repository root unless that root is the **chosen** source path.

## Scope and safety

- Directory ingestion excludes dependency/cached internal folders including node_modules, .git, .agentsam, .next, .vercel, .turbo and coverage; it excludes macOS AppleDouble sidecar files, .DS_Store and __MACOSX.
- **dist/** is intentionally not excluded: pre-built static websites can be legitimate source donors.
- Archive input validates entry paths and sizes. Generated folders and metadata are filtered from the exposed source snapshot.
- No scripts are executed, no files are modified by inventory, and remote access requires a caller-provided explicit acquisition adapter.
- The human summary and the JSON output distinguish **detected file-layout evidence** (Shopify Liquid theme, Next.js application) from AST parsing. Shopify+Next.js donor trees are supported in the inventory, but the Liquid and TSX semantics remain unparsed until those parsers are integrated.
- A ZIP whose files share a single enclosing directory is displayed relative to that archive root **without rewriting the original stored paths**. This makes a nested ZIP human-readable while keeping graph source identifiers stable.
- Security and size limits from source-ingest continue to apply. Excluded source directories are rules, not guaranteed skip-count statistics; skips outside already loaded archive entries are not counted.

## Local testing

~~~sh
npm run test -w @inneranimalmedia/theme-source-ingest
npm run verify
~~~

Unit tests live in tests/inventory.test.mjs. End-to-end independent packaged-install tests live in root scripts/verify-distribution.mjs.

See Issue #5 for the remaining cross-language parsing, semantic graph and portable-section extraction work. This package owns **source intake**, not CMS persistence, editor controls, visual rendering or deploys.
