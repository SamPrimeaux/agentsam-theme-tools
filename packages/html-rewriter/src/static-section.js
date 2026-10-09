import { parseHtml, walkHtml, attribute } from '@inneranimalmedia/theme-syntax-html';
import { applyPatches, validateRewriteUrl } from './index.js';

export const STATIC_SECTION_SCHEMA = 'agentsam.static-section.v1';
const uidPattern = /^[A-Za-z0-9_-]{1,64}$/;
const textTags = new Set(['h1','h2','h3','h4','h5','h6','p','small','figcaption','blockquote']);
function escapeText(v) {return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function escapeAttr(v) {return escapeText(v).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function nodesOf(source,fragment=false) {
  const result=[];walkHtml(parseHtml(source,{fragment}).document,n=>result.push(n));return result;
}
function patch(source,range,value,attr=false) {
  if(!range)throw Error('missing_source_location');
  const before=source.slice(range.startOffset,range.endOffset);
  if(!attr)return {start:range.startOffset,end:range.endOffset,before,after:escapeText(value)};
  const m=before.match(/^(\s*[^\s=/>]+\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))(\s*)$/s);
  if(!m)throw Error('unsupported_attribute_source_shape');
  const quote=m[2]!==undefined?'"':m[3]!==undefined?"'":'"';
  return {start:range.startOffset,end:range.endOffset,before,
    after:m[1]+quote+escapeAttr(value)+quote+m[5]};
}
function selectorList(value) {
  const selectors=[];let current='',paren=0,bracket=0,quote=null;
  for(let i=0;i<value.length;i++) {
    const c=value[i];
    if(quote){current+=c;if(c==='\\'){current+=value[++i]||'';}else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"){current+=c;quote=c;continue;}
    if(c==='(')paren++;if(c===')')paren--;
    if(c==='[')bracket++;if(c===']')bracket--;
    if(paren<0||bracket<0)throw Error('invalid_css_selector');
    if(c===','&&paren===0&&bracket===0){selectors.push(current.trim());current='';}else current+=c;
  }
  if(quote||paren||bracket)throw Error('invalid_css_selector');
  selectors.push(current.trim());
  if(selectors.some(x=>!x))throw Error('invalid_css_selector');
  return selectors;
}
/** CSS tokenizer that fails closed outside basic rules and nested conditional groups. */
export function scopeStaticCss(css) {
  if(typeof css!=='string')throw TypeError('css must be a string');
  let i=0;
  const prefix=':where([data-agent-section-instance="__UID__"])';
  const nested=new Set(['media','supports','container','layer']);
  function blank(){
    let out='';
    while(i<css.length){
      if(/\s/.test(css[i])){out+=css[i++];continue;}
      if(css.startsWith('/*',i)){const end=css.indexOf('*/',i+2);
        if(end<0)throw Error('css_unterminated_comment');out+=css.slice(i,end+2);i=end+2;continue;}
      break;
    }
    return out;
  }
  function head(){
    const begin=i;let quote=null,depth=0;
    while(i<css.length){
      const c=css[i];
      if(quote){if(c==='\\')i+=2;else{if(c===quote)quote=null;i++;}continue;}
      if(c==='"'||c==="'"){quote=c;i++;continue;}
      if(css.startsWith('/*',i)){const end=css.indexOf('*/',i+2);if(end<0)throw Error('css_unterminated_comment');i=end+2;continue;}
      if(c==='('||c==='[')depth++;
      if(c===')'||c===']')depth--;
      if(depth<0)throw Error('css_bad_header');
      if(depth===0&&c==='{'){const v=css.slice(begin,i).trim();i++;return v;}
      if(depth===0&&(c===';'||c==='}'))throw Error('unsupported_css_statement');
      i++;
    }
    throw Error('css_unterminated_rule');
  }
  function body() {
    const begin=i;let quote=null,depth=0;
    while(i<css.length){
      const c=css[i];
      if(quote){if(c==='\\')i+=2;else{if(c===quote)quote=null;i++;}continue;}
      if(c==='"'||c==="'"){quote=c;i++;continue;}
      if(css.startsWith('/*',i)){const end=css.indexOf('*/',i+2);if(end<0)throw Error('css_unterminated_comment');i=end+2;continue;}
      if(c==='(')depth++;if(c===')')depth--;
      if(depth<0)throw Error('css_bad_declaration');
      if(depth===0&&c==='{')throw Error('css_nested_rule_unverified');
      if(depth===0&&c==='}')return css.slice(begin,i++);
      i++;
    }
    throw Error('css_unterminated_rule');
  }
  function scan(isNested=false){
    let out='';
    while(i<css.length){
      out+=blank();
      if(isNested&&css[i]==='}'){i++;return out;}
      if(i===css.length)break;
      const prelude=head();
      if(prelude.startsWith('@')){
        const key=prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        if(!nested.has(key))throw Error('css_at_rule_requires_review:'+key);
        out+=prelude+'{'+scan(true)+'}';continue;
      }
      const sels=selectorList(prelude);
      for(const s of sels){
        if(/^(?:html|body|:root|:host|:global|\*)\b|^:root\b|:(?:global|host|host-context)\b/i.test(s))
          throw Error('css_global_selector_requires_review:'+s);
      }
      out+=sels.map(s=>prefix+' '+s).join(', ')+'{'+body()+'}';
    }
    if(isNested)throw Error('css_unterminated_group');
    return out;
  }
  return scan();
}
function inspectGlobal(source) {
  const nodes=nodesOf(source);const css=[],issues=[];
  for(const n of nodes){
    if(n.tagName==='script')issues.push('unexamined_javascript');
    if(n.tagName==='link'&&/\bstylesheet\b/i.test(attribute(n,'rel')||''))issues.push('external_css_dependency');
    if(n.tagName==='style'&&n.sourceCodeLocation?.startTag&&n.sourceCodeLocation?.endTag){
      css.push(source.slice(n.sourceCodeLocation.startTag.endOffset,n.sourceCodeLocation.endTag.startOffset));
    }
  }
  return {css:css.join('\n'),issues};
}
function extract(source,{marker,start}) {
  if(!marker&&!Number.isInteger(start))throw TypeError('section_marker_or_source_start_required');
  const matching=nodesOf(source).filter(n=>marker
    ? attribute(n,'data-cms-section')===marker
    : n.sourceCodeLocation?.startOffset===start&&
      ['section','article','header','footer','aside','main','nav'].includes(n.tagName));
  if(matching.length!==1)throw Error('section_selection_must_be_unique:'+matching.length);
  const r=matching[0].sourceCodeLocation;
  if(!r?.endTag||!r.startTag)throw Error('section_requires_end_tag');
  return source.slice(r.startOffset,r.endOffset);
}
/** Real normalized output for static scenes; refuses to certify unsafe donor behavior. */
export function compileStaticSection(source,{marker,start,sourceId='source.html',css,assets=[],strict=true}={}) {
  if(typeof source!=='string'||(!marker&&!Number.isInteger(start)))throw TypeError('source and marker/start are required');
  if(!Array.isArray(assets)||assets.some(v=>typeof v!=='string'))throw TypeError('assets must be an array of URLs');
  const fragment=extract(source,{marker,start}),global=inspectGlobal(source);
  const issues=[...global.issues],nodes=nodesOf(fragment,true);
  const stylesheet=css===undefined?global.css:css;
  for(const match of stylesheet.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)){
    const value=(match[1]??match[2]??match[3]??'').trim();
    if(!value||!assets.includes(value))issues.push('unresolved_css_asset:'+value.slice(0,100));
  }
  const fields=[],defaults={},counts={};
  const next=kind=>kind+'_'+(counts[kind]=(counts[kind]||0)+1);
  function field(kind,label,type,range,original,att=null){
    const id=next(kind);fields.push({id,label,type,range,original,attribute:att});defaults[id]=original;
  }
  for(const n of nodes){
    const tag=n.tagName,r=n.sourceCodeLocation;
    if(!r)continue;
    if(['script','iframe','form','object','embed','svg'].includes(tag))issues.push('unsafe_or_interactive_markup:'+tag);
    for(const a of n.attrs||[]){
      if(/^on[a-z]+$/i.test(a.name))issues.push('inline_event_handler:'+a.name);
      if(a.name==='style')issues.push('inline_style_requires_review');
      if(['src','poster','srcset'].includes(a.name)&&a.value&&!assets.includes(a.value))
        issues.push('unresolved_asset:'+a.value.slice(0,100));
    }
    if(textTags.has(tag)){
      const direct=(n.childNodes||[]).filter(c=>c.nodeName==='#text'&&c.value?.trim()&&c.sourceCodeLocation);
      if(direct.length===1 && (n.childNodes||[]).every(c=>c.nodeName==='#text')){
        const c=direct[0],kind=/^h[1-6]$/.test(tag)?'heading':'text';
        field(kind,tag+' text',kind==='heading'?'text':'textarea',
          {start:c.sourceCodeLocation.startOffset,end:c.sourceCodeLocation.endOffset},
          c.value.trim());
      }else if(direct.length>0)issues.push('mixed_text_not_editable:'+tag);
    }
    if(tag==='img'&&attribute(n,'alt')===null)issues.push('image_missing_alt');
    if(tag==='img')for(const att of ['src','alt']){
      if(r.attrs?.[att])field(att==='src'?'media':'alt','Image '+att,att==='src'?'media':'text',
        {start:r.attrs[att].startOffset,end:r.attrs[att].endOffset},attribute(n,att)||'',att);
    }
    if(tag==='a'&&r.attrs?.href)field('link','Link URL','url',
      {start:r.attrs.href.startOffset,end:r.attrs.href.endOffset},attribute(n,'href')||'','href');
  }
  let scoped='';
  try{scoped=scopeStaticCss(css===undefined?global.css:css);}catch(e){issues.push(e.message);}
  const blockers=[...new Set(issues)];
  // Preserve unescaped source slices for optimistic patch preconditions.
  const bindings=fields.map(f=>({...f,before:fragment.slice(f.range.start,f.range.end)}));
  const result={schema:STATIC_SECTION_SCHEMA,kind:'artifact-backed-static',
    type:'generated-static',source:{id:sourceId,marker},template:fragment,
    css:scoped,settingsSchema:fields.map(({id,label,type})=>({id,label,type})),
    bindings,defaults,blockers,
    state:blockers.length?'blocked':'compiled-static-candidate',
    cmsInstalled:false,visualVerified:false};
  if(strict&&blockers.length)throw Object.assign(new Error('static_section_blocked:'+blockers.join(';')),{blockers});
  return result;
}
function safeValue(binding,v){
  if(typeof v!=='string')throw TypeError('non_string_setting:'+binding.id);
  if(binding.type==='url'&&!/^(?:https?:\/\/|\/(?!\/)|#(?!#)|mailto:|tel:)/i.test(v))throw Error('unsafe_link_url');
  if(binding.type==='media'&&!/^(?:https?:\/\/|\/(?!\/))/i.test(v))throw Error('unsafe_media_url');
  if(binding.type==='url'||binding.type==='media')validateRewriteUrl(v);
  return v;
}
function namespaceIds(html,uid){
  const nodes=nodesOf(html,true);
  const ids=new Set(nodes.map(n=>attribute(n,'id')).filter(Boolean));
  const patches=[];
  for(const n of nodes){
    for(const att of ['id','for','aria-labelledby','aria-describedby','aria-controls','href']){
      const value=attribute(n,att),r=n.sourceCodeLocation?.attrs?.[att];
      if(!value||!r)continue;
      let changed=value;
      if(att==='id')changed=uid+'-'+value;
      else if(att==='href'&&value.startsWith('#')&&ids.has(value.slice(1)))changed='#'+uid+'-'+value.slice(1);
      else if(['for','aria-labelledby','aria-describedby','aria-controls'].includes(att))
        changed=value.split(/\s+/).map(x=>ids.has(x)?uid+'-'+x:x).join(' ');
      if(changed!==value)patches.push(patch(html,r,changed,true));
    }
  }
  return applyPatches(html,patches);
}
export function renderStaticSection(definition,{uid,settings={}}={}) {
  if(definition?.schema!==STATIC_SECTION_SCHEMA)throw TypeError('static_section_definition_required');
  if(definition.blockers.length)throw Error('blocked_static_section');
  if(!uidPattern.test(uid||'')||uid==='__UID__')throw Error('invalid_instance_uid');
  const known=new Set(definition.bindings.map(b=>b.id));
  if(Object.keys(settings).some(k=>!known.has(k)))throw Error('unknown_setting');
  const patches=[];
  for(const b of definition.bindings){
    const value=safeValue(b,settings[b.id]??definition.defaults[b.id]??'');
    const sourceRange={startOffset:b.range.start,endOffset:b.range.end};
    const original=definition.template.slice(b.range.start,b.range.end);
    if(original!==b.before)throw Error('source_binding_drift');
    patches.push(patch(definition.template,sourceRange,value,Boolean(b.attribute)));
  }
  const fragment=namespaceIds(applyPatches(definition.template,patches),uid);
  return {html:'<div data-agent-section-instance="'+uid+'">'+fragment+'</div>',
    css:definition.css.replaceAll('__UID__',uid),
    sectionInstance:{type:definition.type,layout:{width:'full',bleed:'background'},
      responsive:{mobileFirst:true},motion:{reducedMotionSafe:true},
      data:{artifactId:definition.source.id,settings:{...definition.defaults,...settings}}}};
}
