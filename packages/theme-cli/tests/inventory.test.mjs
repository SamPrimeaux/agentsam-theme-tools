import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runThemeCommand } from '../src/index.js';

const example = fileURLToPath(new URL('../../../examples/basic', import.meta.url));

async function invoke(...args) {
  let out = '', err = '';
  const status = await runThemeCommand(args, {
    stdout: { write(text) { out += text; } },
    stderr: { write(text) { err += text; } },
  });
  return { status, out, err };
}

test('inventory command shows a short file hierarchy and language breakdown', async () => {
  const result = await invoke('inventory', example);
  assert.equal(result.status, 0, result.err);
  assert.match(result.out, /Source files: 3/);
  assert.match(result.out, /assets\/\s+2 files/);
  assert.match(result.out, /HTML 1/);
  assert.match(result.out, /CSS 1/);
  assert.match(result.out, /Coverage: partial/);
  assert.match(result.out, /zero diagnostics does not mean the source is validated/);
});

test('ingest and inspect both show the same source inventory, not a misleading HTML-only total', async () => {
  const ingest = await invoke('ingest', example);
  const inspect = await invoke('inspect', example);
  assert.equal(ingest.status, 0, ingest.err);
  assert.equal(inspect.status, 0, inspect.err);
  assert.match(ingest.out, /Source files: 3/);
  assert.match(inspect.out, /Source files: 3/);
  assert.match(inspect.out, /Page: index\.html/);
});

test('inventory --json returns only the structured, scoped summary, never source text', async () => {
  const result = await invoke('inventory', example, '--json');
  assert.equal(result.status, 0, result.err);
  const report = JSON.parse(result.out);
  assert.equal(report.schema, 'agentsam.theme-inventory-report.v1');
  assert.equal(report.materials.length, 1);
  assert.equal(report.materials[0].source.virtualRoot, '.');
  assert.equal(report.materials[0].totals.files, 3);
  assert.ok(report.materials[0].languages.some((item) => item.language === 'CSS'));
  assert.ok(!result.out.includes('<!doctype html>'));
  assert.equal(result.err, '');
});
