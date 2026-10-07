import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  ingestSourceInputs, buildSourceInventory, shouldIgnoreSourcePath,
  SOURCE_INVENTORY_SCHEMA,
} from '../src/index.js';

const require = createRequire(import.meta.url);
const yazl = require('yazl');

async function archive(entries) {
  const zip = new yazl.ZipFile();
  for (const [name, value] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(value), name);
  }
  zip.end();
  const chunks = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function withFiles(source, callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-intake-inventory-'));
  try {
    for (const [name, content] of Object.entries(source)) {
      const dest = path.join(root, name);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content);
    }
    return await callback(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('directory inventory excludes cache and macOS sidecars, but keeps a real dist website', async () => {
  const files = {
    'layout/theme.liquid': '<html>{{ content_for_layout }}</html>',
    'sections/hero.liquid': '<section>Hero</section>',
    'templates/index.json': '{"sections":{}}',
    'config/settings_schema.json': '[]',
    'app/page.tsx': 'export default function Page() { return <main />; }',
    'next.config.js': 'export default {};',
    'dist/index.html': '<!doctype html><html><title>Published</title></html>',
    '._README.md': 'macOS metadata',
    '.DS_Store': 'macOS metadata',
    '.next/server/build.js': 'generated cache',
    '.vercel/output.json': 'generated metadata',
    'node_modules/dependency/index.js': 'not theme source',
  };
  await withFiles(files, async (root) => {
    const report = await ingestSourceInputs(root);
    const material = report.materials[0];
    assert.equal(material.fileCount, 7);
    assert.ok(material.files.some((f) => f.path === 'dist/index.html'));
    assert.ok(material.files.every((f) => !shouldIgnoreSourcePath(f.path)));
    const inventory = material.inventory;
    assert.equal(inventory.schema, SOURCE_INVENTORY_SCHEMA);
    assert.deepEqual(inventory.detected.map((s) => s.system),
      ['Shopify Liquid theme', 'Next.js application']);
    assert.equal(inventory.coverage.htmlPagesAnalyzed, 1);
    assert.ok(inventory.keyFiles.includes('layout/theme.liquid'));
    assert.ok(inventory.keyFiles.includes('app/page.tsx'));
    assert.deepEqual(inventory.languages.find((v) => v.language === 'Liquid'),
      { language: 'Liquid', count: 2 });
    assert.equal(inventory.folders.reduce((total, entry) => total + entry.count, 0), 7);
  });
});

test('wrapped ZIP inventory exposes internal Shopify folders rather than one opaque wrapper', async () => {
  const bytes = await archive({
    'donor-theme/layout/theme.liquid': '<html>{{ content_for_layout }}</html>',
    'donor-theme/sections/hero.liquid': '<section>Hero</section>',
    'donor-theme/config/settings_schema.json': '[]',
    'donor-theme/templates/index.json': '{"sections":{}}',
    'donor-theme/._README.md': 'macOS metadata',
    '__MACOSX/._theme.liquid': 'macOS metadata',
    'donor-theme/.next/server/render.js': 'generated cache',
  });
  const report = await ingestSourceInputs({ kind: 'bytes', bytes, name: 'donor.zip' });
  const material = report.materials[0];
  assert.equal(material.fileCount, 4);
  assert.equal(material.excludedFileCount, 3);
  assert.equal(material.inventory.source.virtualRoot, 'donor-theme/');
  assert.deepEqual(material.inventory.detected.map((item) => item.system),
    ['Shopify Liquid theme']);
  assert.deepEqual(material.inventory.folders.map((f) => [f.folder, f.count]),
    [['config/', 1], ['layout/', 1], ['sections/', 1], ['templates/', 1]]);
  assert.ok(material.files.every((file) => file.path.startsWith('donor-theme/')));
  assert.equal(material.inventory.coverage.htmlPagesAnalyzed, 0);
  assert.equal(material.inventory.coverage.status, 'partial');
});

test('inventory classification is customer-neutral and deterministic over file order', () => {
  const files = [
    { path: 'assets/logo.svg', bytes: 10 },
    { path: 'index.html', bytes: 20 },
    { path: 'assets/site.css', bytes: 15 },
  ];
  const first = buildSourceInventory({ label: 'demo', origin: 'directory', files });
  const second = buildSourceInventory({ label: 'demo', origin: 'directory', files: [...files].reverse() });
  assert.deepEqual(first, second);
  assert.equal(first.totals.bytes, 45);
  assert.deepEqual(first.detected, []);
  assert.equal(first.source.virtualRoot, '.');
  assert.ok(!JSON.stringify(first).includes('/Volumes/Expansion'));
});

test('source ignore policy rejects generated paths without rejecting legitimate distributable sites', () => {
  for (const file of ['._theme.liquid', 'assets/._logo.svg', '.next/server/chunk.js',
    'node_modules/a/index.js', '__MACOSX/._cache', 'assets/.DS_Store', '.vercel/project.json']) {
    assert.equal(shouldIgnoreSourcePath(file), true, file);
  }
  for (const file of ['dist/index.html', 'assets/theme.liquid', 'templates/index.json',
    'app/page.tsx', 'public/favicon.ico']) {
    assert.equal(shouldIgnoreSourcePath(file), false, file);
  }
});
