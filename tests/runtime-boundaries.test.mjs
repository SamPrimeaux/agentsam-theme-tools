import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeSourceInput } from '@inneranimalmedia/theme-source-input';
import { rewriteResponseWithCloudflare } from '@inneranimalmedia/theme-html-rewriter';
import { buildThemeGraph } from '@inneranimalmedia/theme-graph';
import { ingestSourceInputs } from '@inneranimalmedia/theme-source-ingest';

test('core input, HTML syntax, graph and rewrite modules avoid Node built-ins',async()=>{
  for(const name of ['source-input','syntax-html','theme-graph','html-rewriter']){
    const source=await readFile(new URL('../packages/'+name+'/src/index.js',import.meta.url),'utf8');
    assert.doesNotMatch(source,/from ['"]node:/,name+' must not require Node at runtime');
  }
});

test('input URLs are validated and reject embedded credentials',()=>{
  assert.throws(()=>normalizeSourceInput('https://'),/Invalid URL/);
  assert.throws(()=>normalizeSourceInput('https://user:password@example.org/theme'),/credentials/);
  assert.equal(normalizeSourceInput('https://example.org/a').url,'https://example.org/a');
});

test('theme graph marks external references and rejects path escape',()=>{
  const text='<!doctype html><img src="//cdn.example.org/hero.svg"><script src="../../outside.js"></script>';
  const graph=buildThemeGraph([{path:'index.html',text}]);
  assert.ok(graph.edges.some(edge=>edge.external));
  assert.ok(graph.diagnostics.some(d=>d.code==='UNSAFE_REFERENCE_PATH'));
});

test('Worker HTMLRewriter adapter is optional and honors mapped replacements',()=>{
  let handlers=[];
  class StubRewriter{
    constructor(){this.handlers=[];}
    on(selector,handler){this.handlers.push({selector,handler});return this;}
    transform(response){handlers=this.handlers;return response;}
  }
  const response={status:200};
  assert.strictEqual(rewriteResponseWithCloudflare(response,{'old.png':'new.png'},StubRewriter),response);
  const changes=[];
  const rule=handlers.find(h=>h.selector==='[src]');
  rule.handler.element({getAttribute:()=> 'old.png',setAttribute:(key,value)=>changes.push({key,value})});
  assert.deepEqual(changes,[{key:'src',value:'new.png'}]);
  assert.throws(()=>rewriteResponseWithCloudflare(response,{},null),/unavailable/);
});

test('Git bundle intake validates history refs without claiming source extraction',async(t)=>{
  if(spawnSync('git',['--version']).status!==0){t.skip('git unavailable');return;}
  const dir=await mkdtemp(path.join(os.tmpdir(),'agentsam-theme-git-'));
  const repo=path.join(dir,'source'),bundle=path.join(dir,'snapshot.bundle');
  function git(args) {
    const r=spawnSync('git',args,{encoding:'utf8'});
    if(r.status!==0)throw new Error(r.stderr||r.stdout);
  }
  try{
    git(['init','-q',repo]);
    await writeFile(path.join(repo,'index.html'),'<!doctype html><title>Fixture</title>');
    git(['-C',repo,'add','index.html']);
    git(['-C',repo,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','seed']);
    git(['-C',repo,'bundle','create',bundle,'--all']);
    const result=await ingestSourceInputs(bundle);
    assert.equal(result.materials[0].origin,'git-bundle');
    assert.equal(result.materials[0].metadata.status,'history-inventory-only');
    assert.ok(result.materials[0].metadata.heads.length>0);
    assert.equal(result.materials[0].fileCount,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
