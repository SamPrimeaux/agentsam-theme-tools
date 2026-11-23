import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runThemeCommand} from '../src/index.js';

const run=async(args)=>{
 let stdout='',stderr='';
 const code=await runThemeCommand(args,{stdout:{write:s=>stdout+=s},stderr:{write:s=>stderr+=s}});
 return {code,stdout,stderr};
};
test('CLI analyze, authoring and verify produce actual receipts from ingestion SHA-256',async()=>{
 const source=new URL('../../../fixtures/fnf/shop-original.html',import.meta.url).pathname;
 const analyzed=await run(['analyze',source,'--scope','hero','--json']);
 assert.equal(analyzed.code,0,analyzed.stderr);
 const parsed=JSON.parse(analyzed.stdout);
 assert.match(parsed.evidence.source.sha256,/^[a-f0-9]{64}$/);
 assert.equal(parsed.verification.sourcePreserved,true);
 const title=parsed.compilation.bindings.find(b=>b.authored.cmsField==='headline');
 assert.ok(title);
 const dir=await mkdtemp(path.join(os.tmpdir(),'sam-authoring-cli-'));
 try{
   const edit=path.join(dir,'edits.json');
   await writeFile(edit,JSON.stringify([{nodeId:title.id,property:'color',value:'#112233'}]));
   const applied=await run(['authoring',source,'--scope','hero','--edits',edit,'--json']);
   assert.equal(applied.code,0,applied.stderr);
   assert.match(JSON.parse(applied.stdout).transformations.css,/color:#112233 !important/);
   const verified=await run(['verify',source,'--scope','hero','--expected-sha',parsed.evidence.source.sha256,'--json']);
   assert.equal(verified.code,0,verified.stderr);
   const stale=await run(['verify',source,'--expected-sha','f'.repeat(64)]);
   assert.equal(stale.code,1);
   assert.match(stale.stderr,/revision_conflict/);
   const malicious=path.join(dir,'malicious.json');
   await writeFile(malicious,JSON.stringify([{nodeId:title.id,property:'color',value:'red;body{color:red}'}]));
   const rejected=await run(['authoring',source,'--scope','hero','--edits',malicious]);
   assert.equal(rejected.code,1);
   assert.match(rejected.stderr,/css_value/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('CLI does not falsely accept unsupported Liquid as interpreted HTML',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'sam-liquid-'));
 try{
  const file=path.join(dir,'section.liquid');
  await writeFile(file,'<div>{{ section.settings.title }}</div>');
  const result=await run(['verify',file,'--json']);
  assert.equal(result.code,1);
  assert.match(result.stderr,/requires_source_adapter/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
