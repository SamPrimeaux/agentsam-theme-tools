import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runThemeCommand } from '../src/index.js';

const basic = fileURLToPath(new URL('../../../examples/basic', import.meta.url));

async function run(...argv) {
  let out = '', err = '';
  const code = await runThemeCommand(argv, {
    stdout: { write: (str) => { out += str; } },
    stderr: { write: (str) => { err += str; } },
  });
  return { code, out, err };
}

test('closure reports a selected source and no write plan as human output', async () => {
  const r = await run('closure', basic);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /recognized module closure: 3 files/);
  assert.match(r.out, /assets\/site\.css/);
  assert.match(r.out, /status: candidate-needs-verification/);
  assert.match(r.out, /no files copied or modified/);
  assert.match(r.out, /not analyzed: assets\/site\.css/);
});

test('closure --json is a standalone machine-readable report with path-only modules', async () => {
  const r = await run('closure', basic, '--json');
  assert.equal(r.code, 0, r.err);
  const parsed = JSON.parse(r.out);
  assert.equal(parsed.schema, 'agentsam.theme-closure-report.v1');
  assert.equal(parsed.plan.portable, false);
  assert.equal(parsed.plan.files.length, 3);
  assert.deepEqual(parsed.graph.entryPoints, ['index.html']);
  assert.equal(r.err, '');
});

test('closure rejects wrong/missing entry without falling back to ambient cwd', async () => {
  const missing = await run('closure', basic, '--entry');
  assert.equal(missing.code, 2);
  assert.match(missing.err, /missing_entry_point/);
  const wrong = await run('closure', basic, '--entry', 'unknown.html');
  assert.equal(wrong.code, 2);
  assert.match(wrong.err, /unknown_entry_point/);
  const noSource = await run('closure');
  assert.equal(noSource.code, 2);
  assert.match(noSource.err, /source_required/);
});
