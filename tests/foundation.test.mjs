import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSourceInput } from '@inneranimalmedia/theme-source-input';
import { analyzeHtml } from '@inneranimalmedia/theme-syntax-html';
import { rewriteAssetReferences, replaceSectionContent, applyPatches } from '@inneranimalmedia/theme-html-rewriter';
import { buildThemeGraph } from '@inneranimalmedia/theme-graph';
const page='<!doctype html><html><head><title>Example</title><link href="./site.css" rel="stylesheet"></head><body><section data-cms-section="hero"><h1>Independent site</h1><img src="./logo.png"></section></body></html>';

test('transport-neutral source normalization',()=>{
  assert.equal(normalizeSourceInput('/tmp/a.zip').kind,'local-path');
  assert.equal(normalizeSourceInput('-').kind,'stdin');
  assert.equal(normalizeSourceInput(new Uint8Array([1,2])).kind,'bytes');
  assert.equal(normalizeSourceInput({kind:'url',url:'https://example.org/a'}).kind,'url');
  assert.throws(()=>normalizeSourceInput({kind:'url',url:'file:///etc/passwd'}),/HTTP/);
});

test('HTML sections and dependency references are source-backed',()=>{
  const analysis=analyzeHtml(page);
  assert.equal(analysis.title,'Example');
  assert.equal(analysis.sections.find(s=>s.name==='hero').kind,'declared');
  assert.ok(analysis.sections.every(s=>Number.isInteger(s.start)));
  assert.equal(analysis.references.find(r=>r.value==='./site.css').kind,'stylesheet');
  assert.equal(analysis.references.find(r=>r.value==='./logo.png').kind,'asset');
});

test('rewrites only targeted attributes and leaves unrelated markup unchanged',()=>{
  const updated=rewriteAssetReferences(page,{'./logo.png':'./brand-new.png'});
  assert.equal(updated.changed,1);
  assert.equal(updated.html,page.replace('./logo.png','./brand-new.png'));
  assert.deepEqual(rewriteAssetReferences(page,{}).html,page);
  assert.equal(rewriteAssetReferences(page,{'./logo.png':'a"onerror="b'}).html.includes('&quot;'),true);
});

test('section edit is explicit, marker-scoped, and requires trust',()=>{
  assert.throws(()=>replaceSectionContent(page,{marker:'hero',html:'<p>A</p>'}),/requires_explicit_trust/);
  const revised=replaceSectionContent(page,{marker:'hero',html:'<p>Replacement</p>',trusted:true});
  assert.match(revised.html,/data-cms-section="hero"><p>Replacement<\/p><\/section>/);
  assert.match(revised.html,/site.css/);
  assert.throws(()=>replaceSectionContent(page,{marker:'absent',html:'X',trusted:true}),/must_be_unique/);
});

test('patch engine rejects ambiguous overlap and stale source',()=>{
  assert.throws(()=>applyPatches('abc',[{start:0,end:2,before:'ab',after:'x'},{start:1,end:3,before:'bc',after:'y'}]),/overlapping/);
  assert.throws(()=>applyPatches('abc',[{start:0,end:2,before:'zz',after:'x'}]),/precondition/);
});

test('graph links local resources and reports unresolved dependencies without inventing content',()=>{
  const g=buildThemeGraph([{path:'index.html',text:page},{path:'site.css',bytes:12},{path:'logo.png',bytes:50}]);
  assert.equal(g.pages.length,1);
  assert.ok(g.edges.some(e=>e.to==='site.css'&&e.resolved));
  assert.equal(g.diagnostics.filter(d=>d.code==='UNRESOLVED_RESOURCE').length,0);
  const missing=buildThemeGraph([{path:'index.html',text:page}]);
  assert.equal(missing.diagnostics.filter(d=>d.code==='UNRESOLVED_RESOURCE').length,2);
  assert.throws(()=>buildThemeGraph([{path:'../unsafe.html',text:page}]),/invalid_graph_path/);
});
