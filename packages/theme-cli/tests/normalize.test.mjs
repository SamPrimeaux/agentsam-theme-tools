import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runThemeCommand} from '../src/index.js';
const folder=fileURLToPath(new URL('../../../examples/refinery',import.meta.url));
const old=fileURLToPath(new URL('../../../intake/2026-10-09/sources/iam-services.html',import.meta.url));
async function run(...args){
  let out='',err='';
  const code=await runThemeCommand(args,{stdout:{write:s=>out+=s},stderr:{write:s=>err+=s}});
  return {code,out,err};
}
test('CLI compiles real HTML fixture from directory and local assets',async()=>{
  const r=await run('normalize',folder,'--marker','feature','--json');
  assert.equal(r.code,0,r.err);
  const report=JSON.parse(r.out);
  assert.equal(report.schema,'agentsam.theme-normalization-report.v1');
  assert.equal(report.status,'compiled-static-candidate');
  assert.equal(report.readyForCms,false);
  assert.equal(report.component.blockers.length,0);
  assert.ok(report.component.settingsSchema.some(x=>x.type==='media'));
  assert.match(report.component.css,/data-agent-section-instance/);
  assert.ok(!r.out.includes('script executed'));
});
test('CLI refuses publishing confidence for JavaScript-dependent real archived donor',async()=>{
  const plan=await run('plan',old,'--json');
  assert.equal(plan.code,0,plan.err);
  const first=JSON.parse(plan.out).candidates[0].html.candidates.find(x=>x.tag==='section');
  assert.ok(first,'real donor has structural section');
  const outcome=await run('normalize',old,'--start',String(first.sourceRange.start),'--json');
  assert.equal(outcome.code,1);
  const result=JSON.parse(outcome.out);
  assert.equal(result.status,'blocked');
  assert.ok(result.component.blockers.some(x=>x.includes('unexamined_javascript')||x.includes('external_css')));
  assert.equal(result.installed,false);
});
test('CLI checks selection arguments instead of inferring a section',async()=>{
  const missing=await run('normalize',folder,'--json');
  assert.equal(missing.code,2);
  assert.match(missing.err,/provide_exactly_one_of_marker_or_start/);
  const invalid=await run('normalize',folder,'--start','abc');
  assert.equal(invalid.code,2);
  assert.match(invalid.err,/invalid_source_start/);
});
