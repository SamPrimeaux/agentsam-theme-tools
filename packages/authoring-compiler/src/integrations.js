/**
 * Optional, value-level adapters to existing *public* AgentSam contracts.
 * No SDK package dependency, tenant, Cloudflare, persistent store or media writes.
 */
export const AUTHORING_EVIDENCE_SCHEMA='agentsam.authoring-evidence.v1';
const HASH=/^[a-f0-9]{64}$/i;
const OWNED=/^[a-zA-Z0-9._:/-]{1,256}$/;
function record(value,label) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new TypeError('invalid_'+label);
  return value;
}
function nonblank(value,label) {
  if(typeof value!=='string'||!value.trim()||value.length>256) throw new TypeError('invalid_'+label);
  return value;
}
/**
 * Feed `sourceFile` directly from @inneranimalmedia/theme-source-ingest:
 * {path, text, sha256, bytes}. Never synthesize a second repository/asset ID.
 * Brand pack is an @inneranimalmedia/agentsam-brand BrandPack v2 document.
 * Assets use @inneranimalmedia/agentsam-assets-core AssetRecord IDs.
 * Scene kind is resolved with @inneranimalmedia/theme-scenes getSceneKind.
 */
export function assembleAuthoringEvidence({
  sourceFile, sourceRevision=null, brandPack=null, assetRecords=[],
  section=null, sceneKindLookup=null, repositoryEvidence=null,
}={}) {
  const source=record(sourceFile,'source_file');
  nonblank(source.path,'source_path');
  if(typeof source.text!=='string') throw new Error('source_file_text_required');
  if(!HASH.test(source.sha256||'')) throw new Error('canonical_source_sha256_required');
  if(sourceRevision!==null && !OWNED.test(String(sourceRevision))) throw new Error('invalid_source_revision');
  const diagnostics=[];
  let brand=null;
  if(brandPack!==null) {
    const pack=record(brandPack,'brand_pack');
    if(pack.schema!=='agentsam.brand-pack.v2'||!pack.tokens||!Array.isArray(pack.assets)) throw new Error('brand_pack_v2_required');
    brand={schema:pack.schema,brandId:pack.brand?.id??null,
      tokens:Object.fromEntries(['color','type','space','radius','motion'].map(group=>[group,Object.entries(pack.tokens[group]||{}).map(([name,value])=>({name,value}))])),
      assetRoles:pack.assets.filter(a=>a?.id&&a.role).map(({id,role})=>({id,role}))};
  }
  if(!Array.isArray(assetRecords)) throw new TypeError('invalid_asset_records');
  const assets=assetRecords.map(asset=>{
    record(asset,'asset_record');
    nonblank(asset.id,'asset_id');nonblank(asset.accountId,'asset_account');
    if(!Array.isArray(asset.representations)||!asset.provenance||typeof asset.provenance!=='object') throw new Error('asset_core_contract_required');
    return {id:asset.id,accountId:asset.accountId,kind:asset.kind,hash:asset.hashes?.sha256??null,
      representations:asset.representations.map(({provider,ref,role,verified})=>({provider,ref,role,verified:verified===true})),
      provenance:asset.provenance};
  });
  const scopes=new Set(assets.map(a=>a.accountId));
  if(scopes.size>1) throw new Error('cross_tenant_asset_references');
  let composition=null;
  if(section!==null) {
    const input=record(section,'section');
    if(!input.scene) throw new Error('section_scene_required');
    if(typeof sceneKindLookup!=='function') throw new Error('theme_scenes_public_lookup_required');
    const kind=sceneKindLookup(input.scene);
    if(!kind?.id) throw new Error('unrecognized_scene_kind:'+input.scene);
    const slots=new Set(kind.slots||[]);
    const blocks=(input.groups||[]).flatMap(group=>(group.blocks||[]).map(block=>({
      id:block.id??null,kind:block.kind,slot:slots.has(block.kind)?block.kind:null,
      mediaRef:block.media?.assetId??block.media?.id??null,
    })));
    for(const block of blocks) {
      if(!block.slot) diagnostics.push({code:'SCENE_BLOCK_UNMAPPED',block:block.id,kind:block.kind,severity:'warning'});
      if(block.mediaRef && !assets.some(asset=>asset.id===block.mediaRef)) {
        diagnostics.push({code:'MEDIA_REFERENCE_UNRESOLVED',severity:'warning',block:block.id,assetId:block.mediaRef});
      }
    }
    composition={id:input.id??null,scene:kind.id,slots:[...slots],motion:input.motion??null,
      scroll:input.scroll??null,visual:input.visual??null,blocks};
  }
  const references=assets.map(a=>a.id);
  if(brand) for(const r of brand.assetRoles) if(!references.includes(r.id)) diagnostics.push({
    code:'BRAND_ASSET_NOT_IN_RESOLVED_ASSETS',severity:'info',assetId:r.id});
  // Repository metadata must originate in the repository adapter; no synthetic Merkle hash.
  if(repositoryEvidence!==null) record(repositoryEvidence,'repository_evidence');
  return {schema:AUTHORING_EVIDENCE_SCHEMA,source:{path:source.path,sha256:source.sha256,
      bytes:source.bytes??null,revision:sourceRevision},
    repository:repositoryEvidence,brand,assets,composition,diagnostics};
}
export function verifySourceIdentity(evidence,sourceFile) {
  if(evidence?.schema!==AUTHORING_EVIDENCE_SCHEMA) throw new Error('authoring_evidence_required');
  if(evidence.source.path!==sourceFile?.path || evidence.source.sha256!==sourceFile?.sha256)
    throw new Error('authoring_source_revision_conflict');
  return true;
}
/** SAM operations belong to SDK PR #211; this seam calls the supplied public
 * AgentSamClient.invoke, not an SDK-internal implementation or a fake handler. */
export async function invokeSamAuthoring({client,operation,input}={}) {
  if(typeof client?.invoke!=='function') throw new Error('sam_client_invoke_required');
  if(!['inspect','previewStyles','saveDraftStyles','proposeSourcePatch','saveSourceDraft'].includes(operation))
    throw new Error('unsupported_sam_authoring_operation');
  const result=await client.invoke('sam.authoring.'+operation,input);
  if(!result || result.ok!==true) throw new Error('sam_authoring_operation_failed:'+(result?.error?.code||result?.error?.message||'unknown'));
  return result;
}
