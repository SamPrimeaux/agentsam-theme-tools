import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileHtmlAuthoring,compileScopedStyles,compileSourcePatch} from '../src/index.js';

const page=readFileSync(new URL('../../../fixtures/fnf/shop-original.html',import.meta.url),'utf8');

test('actual frozen FNF Shop Hero: source preserved, selected headline bindings independent of field name',()=>{
  const result=compileHtmlAuthoring({html:page,filename:'shop.html',scope:'hero'});
  assert.equal(result.originalHtml,page);
  assert.ok(result.annotatedHtml.includes('data-sam-authoring-scope="hero"'));
  assert.ok(result.bindings.length>20);
  const title=result.bindings.find(b=>b.authored.cmsField==='headline');
  assert.ok(title);
  assert.equal(title.tag,'h1');
  assert.ok(title.controls.some(c=>c.key==='fontSize'));
  assert.ok(title.controls.some(c=>c.key==='color'));
  assert.ok(result.annotatedHtml.includes('<h1 class="h-display" data-cms="headline"'));
  const changed=compileScopedStyles({compiled:result,edits:[
    {nodeId:title.id,property:'fontSize',value:'68px'},
    {nodeId:title.id,property:'color',value:'#f0ece2'},
    {nodeId:title.id,property:'fontSize',value:'42px',breakpoint:'mobile'}]});
  assert.match(changed.css,/font-size:68px !important/);
  assert.match(changed.css,/@media \(max-width: 767px\)/);
  assert.doesNotMatch(result.originalHtml,/data-sam-node=/);
  assert.equal(compileScopedStyles({compiled:result,edits:[]}).css,'');
  assert.equal(compileHtmlAuthoring({html:result.annotatedHtml,filename:'shop.html',scope:'hero'}).bindings.find(b=>b.authored.cmsField==='headline').id,title.id);
});
test('unseen HTML and renamed CMS fields get fully functional typography and container controls',()=>{
  const source='<section class="atlas"><div><h2 data-cms="introCopy">Unexpected</h2><p>Another</p></div></section>';
  const result=compileHtmlAuthoring({html:source,filename:'outside.html',scope:'surprise',fragment:true});
  const title=result.bindings.find(b=>b.authored.cmsField==='introCopy');
  assert.ok(title.controls.find(c=>c.key==='fontSize'));
  assert.ok(result.bindings.find(b=>b.tag==='div').controls.find(c=>c.key==='gap'));
  const resultCss=compileScopedStyles({compiled:result,edits:[{nodeId:title.id,property:'fontSize',value:'2rem'}]});
  assert.match(resultCss.css,/data-sam-authoring-scope="surprise"/);
  assert.ok(result.annotatedHtml.startsWith('<section'));
});
test('CSS rejection and unknown bindings fail closed',()=>{
  const compiled=compileHtmlAuthoring({html:'<section><h2>Hello</h2></section>',scope:'site',fragment:true});
  const nodeId=compiled.bindings[1].id;
  for(const value of ['red};body{display:none','url(javascript:alert(1))','65px;']) {
    assert.throws(()=>compileScopedStyles({compiled,edits:[{nodeId,property:'color',value}]}),/css_value/);
  }
  assert.throws(()=>compileScopedStyles({compiled,edits:[{nodeId:'missing',property:'color',value:'#fff'}]}),/unknown_authoring_node/);
  assert.throws(()=>compileScopedStyles({compiled,edits:[{nodeId,property:'color',value:'#fff',breakpoint:'ultrawide'}]}),/breakpoint/);
});
test('reviewable exact-match source patch preserves all surrounding code',()=>{
  const original='<section><h2>Old</h2><script>const keep=1;</script></section>';
  const start=original.indexOf('Old');
  const result=compileSourcePatch({source:original,patches:[{start,end:start+3,before:'Old',after:'New'}]});
  assert.equal(result.source,original.replace('Old','New'));
  assert.throws(()=>compileSourcePatch({source:original,patches:[{start,end:start+3,before:'Else',after:'X'}]}),/precondition/);
});
