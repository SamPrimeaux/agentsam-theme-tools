import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {assembleAuthoringEvidence,verifySourceIdentity,invokeSamAuthoring} from '../src/consumer.js';
import {verifyAuthoringSource} from '../src/receipts.js';
import {compileHtmlAuthoring,compileScopedStyles} from '../src/index.js';
import {ingestSourceInputs} from '@inneranimalmedia/theme-source-ingest';

const source=(await ingestSourceInputs([new URL('../../../fixtures/fnf/shop-original.html',import.meta.url).pathname])).materials[0].files[0];
test('canonical ingestion SHA-256 is preserved in compiler verification receipt',()=>{
  const compiled=compileHtmlAuthoring({html:source.text,filename:source.path,scope:'hero',sourceHash:source.sha256});
  const receipt=verifyAuthoringSource({sourceFile:source,scope:'hero'});
  assert.equal(receipt.evidence.source.sha256,source.sha256);
  assert.ok(receipt.compilation.bindings.some(b=>b.authored.cmsField==='headline'));
  assert.equal(receipt.verification.sourcePreserved,true);
  assert.equal(receipt.verification.cmsPersisted,false);
  const headline=compiled.bindings.find(b=>b.authored.cmsField==='headline');
  assert.throws(()=>compileScopedStyles({compiled,expectedSourceHash:'0'.repeat(64),edits:[{nodeId:headline.id,property:'color',value:'#fff'}]}),/revision_conflict/);
  assert.throws(()=>verifySourceIdentity(receipt.evidence,{...source,sha256:'f'.repeat(64)}),/revision_conflict/);
});

test('semantic identity survives unrelated sibling insert/reorder; duplicates warn without pretending durability',()=>{
  const a='<section data-cms-section="hero"><h2 data-cms="introCopy">Hello</h2><p>Copy</p></section>';
  const b='<section data-cms-section="hero"><p>Copy</p><div></div><h2 data-cms="introCopy">Hello</h2></section>';
  const get=(html)=>compileHtmlAuthoring({html,filename:'any.html',scope:'hero',fragment:true}).bindings.find(b=>b.authored.cmsField==='introCopy').id;
  assert.equal(get(a),get(b));
  const duplicate=compileHtmlAuthoring({html:'<section><i></i><i></i></section>',scope:'x',fragment:true});
  assert.ok(duplicate.diagnostics.some(d=>d.code==='AMBIGUOUS_SOURCE_IDENTITY'));
  assert.notEqual(duplicate.bindings[1].id,duplicate.bindings[2].id);
});

test('source preservation: CSS token, GLB/video reference, motion, authored markup and link remain intact',()=>{
  const html='<section class="animated" data-cms-section="scene"><model-viewer src="/assets/stage.glb" data-motion="orbit"></model-viewer><video src="/media/loop.mp4"></video><a href="/shop"><h2 data-cms="heroTitle">Title</h2></a></section>';
  const compiled=compileHtmlAuthoring({html,filename:'unknown.html',scope:'scene',fragment:true});
  const title=compiled.bindings.find(b=>b.authored.cmsField==='heroTitle');
  const css=compileScopedStyles({compiled,edits:[{nodeId:title.id,property:'color',value:'var(--brand-accent)'}]});
  assert.match(css.css,/var\(--brand-accent\)/);
  assert.equal(compiled.originalHtml,html);
  for(const original of ['stage.glb','loop.mp4','data-motion="orbit"','href="/shop"','class="animated"']) assert.ok(compiled.annotatedHtml.includes(original));
  assert.throws(()=>compileScopedStyles({compiled,edits:[{nodeId:title.id,property:'color',value:'var(--evil);body{display:none}'}]}),/css_value/);
  assert.ok(compiled.bindings.some(b=>b.tag==='model-viewer'));
});

test('real SDK public BrandPack v2, Asset Core and Theme Scenes contracts work through portable adapters',async(t)=>{
  const root=process.env.AGENTSAM_SDK_ROOT;
  if(!root) {t.skip('Set AGENTSAM_SDK_ROOT to run cross-repository public API verification');return;}
  const requireFromSdk=createRequire(path.join(root,'package.json'));
  const publicImport=async(specifier)=>import(pathToFileURL(requireFromSdk.resolve(specifier)).href);
  const brand=await publicImport('@inneranimalmedia/agentsam-brand');
  const assetCore=await publicImport('@inneranimalmedia/agentsam-assets-core');
  const scenes=await publicImport('@inneranimalmedia/theme-scenes');
  const pack=brand.createEmptyBrandPack({brandId:'independent',brandName:'Independent'});
  pack.tokens.color.primary='#3322aa';
  pack.assets.push({id:'canonical-asset',role:'hero.landscape',provenance:{sources:[]}});
  const asset=assetCore.createEmptyAssetRecord({id:'canonical-asset',accountId:'customer',kind:'image'});
  const section=scenes.normalizeSection({id:'scene-1',scene:'hero.editorial',
    groups:[{blocks:[{id:'headline',kind:'copy',text:'Hello'}]}]});
  const evidence=assembleAuthoringEvidence({sourceFile:source,brandPack:pack,assetRecords:[asset],
    section,sceneKindLookup:scenes.getSceneKind,sourceRevision:'v1'});
  assert.equal(evidence.brand.schema,brand.BRAND_PACK_SCHEMA);
  assert.equal(evidence.brand.tokens.color[0].name,'primary');
  assert.equal(evidence.assets[0].id,asset.id);
  assert.equal(evidence.composition.scene,'hero.editorial');
  assert.equal(evidence.composition.blocks[0].slot,'copy');
});

test('SAM bridge dispatches only executable pack operation and rejects failure receipts',async()=>{
  const calls=[];
  const client={invoke:async(id,input)=>{calls.push([id,input]);return {ok:true,data:{bindings:[]}};}};
  await invokeSamAuthoring({client,operation:'inspect',input:{artifactId:'x'}});
  assert.deepEqual(calls[0],['sam.authoring.inspect',{artifactId:'x'}]);
  await assert.rejects(()=>invokeSamAuthoring({client,operation:'unknown',input:{}}),/unsupported/);
  await assert.rejects(()=>invokeSamAuthoring({client:{invoke:async()=>({ok:false,error:{code:'denied'}})},operation:'saveSourceDraft',input:{}}),/denied/);
});

test('real public SDK SAM OS consumes compiled Theme Tools bindings and invokes authorized draft adapter',async(t)=>{
 const root=process.env.AGENTSAM_SDK_ROOT;
 if(!root){t.skip('Set AGENTSAM_SDK_ROOT for executable cross-repo acceptance');return;}
 const sdkRequire=createRequire(path.join(root,'package.json'));
 const {createSamOS,AgentSamClient}=await import(pathToFileURL(sdkRequire.resolve('@inneranimalmedia/agentsam-sdk/sam')).href);
 const compiler=await import('../src/index.js');
 const writes=[];
 const repository={
   async getSource(){return {source:source.text,filename:source.path,fragment:false,revision:4,contentHash:source.sha256};},
   async saveDraftStyles(value){writes.push(value);return {ok:true,revisionId:'existing-cms-revision-5'};},
   async saveSourceDraft(){throw Error('not_authorized_for_source_patch');}
 };
 const os=createSamOS({core:false,authoring:{
   compiler,repository,
   resolveTrustedContext:async()=>({accountId:'test-tenant',actorId:'test-owner'}),
   authorize:async({principal})=>principal.accountId==='test-tenant'
 }});
 const client=new AgentSamClient({os});
 const inspected=await invokeSamAuthoring({client,operation:'inspect',input:{artifactId:'fixture',scope:'hero'}});
 const title=inspected.data.bindings.find(b=>b.authored.cmsField==='headline');
 assert.ok(title);
 const preview=await invokeSamAuthoring({client,operation:'previewStyles',input:{artifactId:'fixture',
   scope:'hero',expectedRevision:4,expectedHash:source.sha256,
   edits:[{nodeId:title.id,property:'fontSize',value:'3rem'}]}});
 assert.match(preview.data.css,/font-size:3rem !important/);
 const draft=await invokeSamAuthoring({client,operation:'saveDraftStyles',input:{artifactId:'fixture',
   pageId:'shop',sectionId:'hero',scope:'hero',expectedRevision:4,expectedHash:source.sha256,expectedCmsRevision:3,
   edits:[{nodeId:title.id,property:'fontSize',value:'3rem'}]}});
 assert.equal(draft.data.published,false);
 assert.equal(writes[0].principal.accountId,'test-tenant');
 assert.equal(writes[0].expectedHash,source.sha256);
});

test('cross-tenant canonical media records are not silently combined',()=>{
 const base={representations:[],provenance:{history:[]}};
 assert.throws(()=>assembleAuthoringEvidence({sourceFile:source,assetRecords:[
  {id:'a',accountId:'tenant-a',...base},{id:'b',accountId:'tenant-b',...base}
 ]}),/cross_tenant_asset_references/);
});
