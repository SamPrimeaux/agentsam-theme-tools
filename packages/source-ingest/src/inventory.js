/**
 * Portable, deterministic, read-only inventory over an explicit virtual source tree.
 * No ambient filesystem, network requests, content execution, or CMS assumptions.
 */
export const SOURCE_INVENTORY_SCHEMA = 'agentsam.theme-source-inventory.v1';

export const SOURCE_IGNORE_DIRS = Object.freeze([
  '.git', 'node_modules', '.agentsam', '.next', '.vercel', '.turbo',
  '.cache', '.parcel-cache', '.output', 'dist', 'coverage',
]);
const IGNORE = new Set(SOURCE_IGNORE_DIRS);
const LANGUAGE_EXT = Object.freeze({
  liquid: 'Liquid',
  html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'SCSS', sass: 'Sass',
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JSX',
  ts: 'TypeScript', tsx: 'TSX',
  json: 'JSON', jsonc: 'JSONC',
  md: 'Markdown', mdx: 'MDX',
  svg: 'SVG', png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', webp: 'WebP',
  gif: 'GIF', avif: 'AVIF', ico: 'ICO', mp4: 'MP4', webm: 'WebM',
  woff: 'WOFF', woff2: 'WOFF2', ttf: 'TTF',
  yaml: 'YAML', yml: 'YAML', toml: 'TOML',
});

export function shouldIgnoreSourcePath(path) {
  if (typeof path !== 'string') throw new TypeError('source path must be a string');
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (!parts.length) return false;
  return parts.some((part) => IGNORE.has(part) || part === '.DS_Store' ||
    part === '__MACOSX' || part.startsWith('._'));
}

function extensionOf(path) {
  const basename = path.split('/').at(-1) || '';
  const dot = basename.lastIndexOf('.');
  return dot > 0 ? basename.slice(dot + 1).toLowerCase() : '(none)';
}

function sortedCounts(map, nameKey) {
  return [...map].map(([name, count]) => ({ [nameKey]: name, count }))
    .sort((a, b) => b.count - a.count || String(a[nameKey]).localeCompare(String(b[nameKey])));
}

/**
 * @param {{label:string,origin:string,files:Array<{path:string,bytes?:number}>,graph?:object}} material
 */
export function buildSourceInventory(material) {
  if (!material || !Array.isArray(material.files)) throw new TypeError('material.files required');
  const files = material.files;
  const byExtension = new Map(), byFolder = new Map();
  let bytes = 0;
  const paths = new Set();
  for (const file of files) {
    if (!file || typeof file.path !== 'string') throw new TypeError('invalid inventory file');
    if (shouldIgnoreSourcePath(file.path)) {
      throw new Error('unfiltered_generated_metadata: ' + file.path);
    }
    if (paths.has(file.path)) throw new Error('duplicate_inventory_path: ' + file.path);
    paths.add(file.path);
    const ext = extensionOf(file.path);
    const folder = file.path.includes('/') ? file.path.split('/')[0] + '/' : '(root)';
    byExtension.set(ext, (byExtension.get(ext) || 0) + 1);
    byFolder.set(folder, (byFolder.get(folder) || 0) + 1);
    bytes += file.bytes ?? 0;
  }
  const extensionCounts = sortedCounts(byExtension, 'extension');
  const languageCounts = new Map();
  for (const { extension, count } of extensionCounts) {
    const language = LANGUAGE_EXT[extension] ?? 'Other / unclassified';
    languageCounts.set(language, (languageCounts.get(language) || 0) + count);
  }
  const languages = sortedCounts(languageCounts, 'language');
  const folders = sortedCounts(byFolder, 'folder');
  const detected = [];
  const shopifyEvidence = [
    ...['layout/theme.liquid', 'config/settings_schema.json', 'config/settings_data.json']
      .filter((path) => paths.has(path)),
    ...folders.filter((f) => ['sections/', 'templates/', 'snippets/', 'blocks/'].includes(f.folder))
      .map((f) => f.folder),
  ];
  if (shopifyEvidence.length && byExtension.has('liquid')) {
    detected.push({ system: 'Shopify Liquid theme', basis: 'file structure', evidence: shopifyEvidence });
  }
  const nextEvidence = ['next.config.js', 'next.config.mjs', 'next.config.ts']
    .filter((path) => paths.has(path));
  if (nextEvidence.length && (byFolder.has('app/') || byFolder.has('pages/'))) {
    detected.push({ system: 'Next.js application', basis: 'file structure',
      evidence: [...nextEvidence, byFolder.has('app/') ? 'app/' : 'pages/'] });
  }
  const pages = material.graph?.pages?.length ?? 0;
  const references = material.graph?.edges?.length ?? 0;
  const diagnostics = material.graph?.diagnostics?.length ?? 0;
  const unparsed = languages
    .filter((item) => ['Liquid', 'CSS', 'JavaScript', 'TypeScript', 'TSX', 'JSX', 'SCSS',
      'Sass', 'JSON', 'JSONC'].includes(item.language));
  const coverage = {
    scope: 'HTML documents and HTML attribute references only',
    htmlPagesAnalyzed: pages,
    htmlReferencesDiscovered: references,
    diagnostics,
    notSemanticallyAnalyzed: unparsed,
    status: 'partial',
    note: 'No diagnostics or references is NOT proof that imported Liquid, CSS, JS or a theme is valid.',
  };
  return {
    schema: SOURCE_INVENTORY_SCHEMA,
    source: { label: material.label, origin: material.origin },
    totals: { files: files.length, bytes },
    detected,
    languages,
    extensions: extensionCounts,
    folders,
    coverage,
    excludedByDefault: {
      directories: SOURCE_IGNORE_DIRS,
      filePatterns: ['._*', '.DS_Store', '__MACOSX/'],
      note: 'This list shows exclusion rules, not a count of skipped files.',
    },
  };
}
