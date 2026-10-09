import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runThemeCommand } from '../src/index.js';

async function run(...args) {
  let out = '', err = '';
  const code = await runThemeCommand(args, {
    stdout: { write(s) { out += s; } },
    stderr: { write(s) { err += s; } },
  });
  return {code,out,err};
}
const example = fileURLToPath(new URL('../../../examples/basic', import.meta.url));
test('plan command produces provenance and closure without pretending CMS is ready', async () => {
  const r=await run('plan',example,'--json');
  assert.equal(r.code,0,r.err);
  const result=JSON.parse(r.out);
  assert.equal(result.schema,'agentsam.theme-rebuild-plan-report.v1');
  assert.equal(result.readyForCms,false);
  assert.equal(result.verifiedPreview,false);
  assert.ok(result.candidates.length>=1);
  const item=result.candidates[0];
  assert.ok(item.html.candidates.length>0);
  assert.equal(item.extraction.portable,false);
  assert.ok(item.html.candidates.every(c=>c.sourceRange.start>=0));
});
test('plan supports a selected HTML entry, rejects unrelated entries', async () => {
  const valid=await run('plan',example,'--entry','index.html');
  assert.equal(valid.code,0,valid.err);
  assert.match(valid.out,/SOURCE_CANDIDATE_ONLY/);
  const invalid=await run('plan',example,'--entry','assets/site.css');
  assert.equal(invalid.code,2);
  assert.match(invalid.err,/invalid_html_entry_point/);
});
test('real archived design source is inspectable without installing it',async()=>{
  const donor=fileURLToPath(new URL('../../../intake/2026-10-09/sources/iam-services.html',import.meta.url));
  const r=await run('plan',donor,'--json');
  assert.equal(r.code,0,r.err);
  const data=JSON.parse(r.out);
  assert.equal(data.readyForCms,false);
  assert.ok(data.candidates[0].html.evidence.elementCount>30);
  assert.ok(data.candidates[0].html.evidence.scriptElements>0);
});
