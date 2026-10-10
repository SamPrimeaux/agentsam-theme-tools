/**
 * Source-preserving authoring compiler. Never serializes HTML or runs imported code.
 * The input is immutable. Annotation is an editor-only derivative; publisher must
 * explicitly choose which compiled artifact to use.
 */
import { parseHtml, walkHtml, attribute } from '@inneranimalmedia/theme-syntax-html';
import { applyPatches } from '@inneranimalmedia/theme-html-rewriter';

export const AUTHORING_SCHEMA = 'agentsam.authoring-bindings.v1';
const TEXT_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','span','strong','em','small','label','blockquote','li','button','a','figcaption']);
const MEDIA_TAGS = new Set(['img','video','iframe','source','picture','svg']);
const EXCLUDED = new Set(['html','head','meta','base','link','title','script','style','noscript','template','path','br','source']);
const BREAKPOINTS = Object.freeze({ base: null, mobile: '(max-width: 767px)', tablet: '(min-width: 768px) and (max-width: 1023px)' });
const SPEC = Object.freeze({
  color: { group: 'color', kind: 'color', css: 'color' },
  backgroundColor: { group: 'background', kind: 'color', css: 'background-color' },
  fontFamily: { group: 'typography', kind: 'font', css: 'font-family' },
  fontSize: { group: 'typography', kind: 'length', css: 'font-size' },
  fontWeight: { group: 'typography', kind: 'weight', css: 'font-weight' },
  lineHeight: { group: 'typography', kind: 'line', css: 'line-height' },
  letterSpacing: { group: 'typography', kind: 'length', css: 'letter-spacing' },
  textAlign: { group: 'typography', kind: 'align', css: 'text-align' },
  paddingTop: { group: 'spacing', kind: 'length', css: 'padding-top' },
  paddingRight: { group: 'spacing', kind: 'length', css: 'padding-right' },
  paddingBottom: { group: 'spacing', kind: 'length', css: 'padding-bottom' },
  paddingLeft: { group: 'spacing', kind: 'length', css: 'padding-left' },
  marginTop: { group: 'spacing', kind: 'length', css: 'margin-top' },
  marginBottom: { group: 'spacing', kind: 'length', css: 'margin-bottom' },
  width: { group: 'sizing', kind: 'dimension', css: 'width' },
  maxWidth: { group: 'sizing', kind: 'dimension', css: 'max-width' },
  minHeight: { group: 'sizing', kind: 'dimension', css: 'min-height' },
  display: { group: 'layout', kind: 'display', css: 'display' },
  gap: { group: 'layout', kind: 'length', css: 'gap' },
  borderRadius: { group: 'border', kind: 'length', css: 'border-radius' },
  opacity: { group: 'effects', kind: 'opacity', css: 'opacity' },
  objectFit: { group: 'media', kind: 'fit', css: 'object-fit' }
});
const COMMON = ['backgroundColor','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','width','maxWidth','minHeight','borderRadius','opacity'];
const TYPO = ['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign'];
const LAYOUT = ['display','gap'];
const MEDIA = ['objectFit'];
const SIMPLE_LENGTH = /^(?:-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vw|vh)|0|auto)$/;
const COLOR = /^(?:#[a-fA-F0-9]{3,8}|(?:transparent|currentColor|inherit)|(?:rgb|rgba|hsl|hsla)\([\d.,%\s/+-]+\)|var\(--[a-zA-Z0-9_-]+\))$/;
const FONT = /^(?:[\w\s-]+|["'][a-zA-Z0-9\s-]+["'])(?:\s*,\s*(?:[\w\s-]+|["'][a-zA-Z0-9\s-]+["']))*$/;

function hexHash(value) {
  let hash = 2166136261;
  for (let i=0; i<value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash>>>0).toString(36);
}
function safeToken(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw new Error('invalid_' + label);
  return value;
}
function assertCssValue(kind, value) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('invalid_css_value');
  const str = String(value).trim();
  if (!str || str.length>160 || /[;{}<>\\\r\n]/.test(str) || /url\s*\(/i.test(str)) throw new Error('unsafe_css_value');
  const valid = kind === 'color' ? COLOR.test(str)
    : kind === 'font' ? FONT.test(str)
    : kind === 'length' ? SIMPLE_LENGTH.test(str)
    : kind === 'dimension' ? SIMPLE_LENGTH.test(str) || /^(min-content|max-content|fit-content)$/.test(str)
    : kind === 'weight' ? /^(?:[1-9]00|normal|bold|bolder|lighter)$/.test(str)
    : kind === 'line' ? SIMPLE_LENGTH.test(str) || /^(?:\d+(?:\.\d+)?|normal)$/.test(str)
    : kind === 'align' ? /^(left|right|center|justify|start|end)$/.test(str)
    : kind === 'display' ? /^(block|inline|inline-block|flex|inline-flex|grid|none)$/.test(str)
    : kind === 'fit' ? /^(cover|contain|fill|none|scale-down)$/.test(str)
    : kind === 'opacity' ? Number.isFinite(Number(str)) && Number(str)>=0 && Number(str)<=1
    : false;
  if (!valid) throw new Error('invalid_css_value_for_' + kind);
  return str;
}
function controlTypes(node) {
  const keys = [...COMMON];
  if (TEXT_TAGS.has(node.tagName) || node.childNodes?.some(child=>child.nodeName==='#text' && child.value.trim())) keys.push(...TYPO);
  if (!MEDIA_TAGS.has(node.tagName)) keys.push(...LAYOUT);
  if (MEDIA_TAGS.has(node.tagName)) keys.push(...MEDIA);
  return [...new Set(keys)].map(key=>({key,...SPEC[key],responsive: Object.keys(BREAKPOINTS)}));
}
/**
 * Binds previously unseen HTML by AST source ranges, not by field-name heuristics.
 * Scope and stable editor IDs live only in annotatedHtml; original source untouched.
 */
export function compileHtmlAuthoring({ html, filename='component.html', scope='component', fragment=false }={}) {
  if (typeof html!=='string') throw new TypeError('html_required');
  safeToken(scope,'scope');
  const parsed=parseHtml(html,{fragment});
  const bindings=[],patches=[],used=new Set(),scopeNodes=[];
  walkHtml(parsed.document,node=>{
    if (EXCLUDED.has(node.tagName)) return;
    const loc=node.sourceCodeLocation;
    if (!loc?.startTag || !loc?.endOffset) return;
    const explicit=attribute(node,'data-sam-node');
    const id=explicit ? safeToken(explicit,'node_id') : 'n_'+hexHash(filename+':'+node.tagName+':'+loc.startOffset+':'+html.slice(loc.startOffset,loc.startTag.endOffset));
    if (used.has(id)) throw new Error('duplicate_authoring_node:'+id);
    used.add(id);
    const controls=controlTypes(node);
    const binding={id,tag:node.tagName,source:{filename,start:loc.startOffset,end:loc.endOffset},
      authored:{cmsField:attribute(node,'data-cms'),cmsSection:attribute(node,'data-cms-section'),domId:attribute(node,'id')},
      selector:'[data-sam-node="'+id+'"]',controls};
    bindings.push(binding);
    if (!explicit) {
      const insert=loc.startTag.endOffset-(html[loc.startTag.endOffset-2]==='/'?2:1);
      patches.push({start:insert,end:insert,before:'',after:' data-sam-node="'+id+'" '});
    }
    if (attribute(node,'data-cms-section')===scope || attribute(node,'data-sam-authoring-scope')===scope) scopeNodes.push(id);
  });
  // A scope must exist in the supplied source; for a standalone component mark its
  // first eligible element. The scope is not shared across component instances.
  if (!scopeNodes.length && bindings.length) {
    const first=bindings[0];
    const { document }=parsed;
    let root=null;
    walkHtml(document,node=>{ if (!root && node.sourceCodeLocation?.startOffset===first.source.start && node.tagName===first.tag) root=node; });
    const offset=root.sourceCodeLocation.startTag.endOffset-(html[root.sourceCodeLocation.startTag.endOffset-2]==='/'?2:1);
    patches.push({start:offset,end:offset,before:'',after:' data-sam-authoring-scope="'+scope+'" '});
  } else if (scopeNodes.length===1) {
    const binding=bindings.find(b=>b.id===scopeNodes[0]);
    let target=null;
    walkHtml(parsed.document,node=>{ if (node.sourceCodeLocation?.startOffset===binding.source.start) target=node; });
    if (attribute(target,'data-sam-authoring-scope')!==scope) {
      const offset=target.sourceCodeLocation.startTag.endOffset-(html[target.sourceCodeLocation.startTag.endOffset-2]==='/'?2:1);
      patches.push({start:offset,end:offset,before:'',after:' data-sam-authoring-scope="'+scope+'" '});
    }
  } else if (scopeNodes.length>1) throw new Error('ambiguous_authoring_scope');
  // Multiple zero-width insertions at the same offset must be merged.
  const merged=new Map();
  for(const patch of patches) merged.set(patch.start,(merged.get(patch.start)||'')+patch.after);
  const annotation=[...merged].map(([start,after])=>({start,end:start,before:'',after}));
  const annotatedHtml=applyPatches(html,annotation);
  return {schema:AUTHORING_SCHEMA,filename,scope,originalHtml:html,annotatedHtml,
    bindings,diagnostics:parsed.errors,counts:{elements:bindings.length,controls:bindings.reduce((n,b)=>n+b.controls.length,0)}};
}
/** Compile sparse per-element edits; removing an edit resets authored CSS unchanged. */
export function compileScopedStyles({compiled,edits=[]}={}) {
  if (compiled?.schema!==AUTHORING_SCHEMA) throw new Error('authoring_compilation_required');
  const scope=safeToken(compiled.scope,'scope');
  const byId=new Map(compiled.bindings.map(b=>[b.id,b]));
  const rules=new Map();
  for (const edit of edits) {
    const id=safeToken(edit.nodeId,'node_id');
    const binding=byId.get(id);
    if (!binding) throw new Error('unknown_authoring_node:'+id);
    const control=binding.controls.find(c=>c.key===edit.property);
    if (!control) throw new Error('unsupported_authoring_property:'+edit.property);
    const breakpoint=edit.breakpoint||'base';
    if (!Object.hasOwn(BREAKPOINTS,breakpoint)) throw new Error('unsupported_authoring_breakpoint');
    const value=assertCssValue(control.kind,edit.value);
    const key=breakpoint+':'+id;
    if (!rules.has(key)) rules.set(key,{breakpoint,id,properties:new Map()});
    rules.get(key).properties.set(control.css,value);
  }
  const selector=id=>':where([data-sam-authoring-scope="'+scope+'"]) [data-sam-node="'+id+'"],:where([data-sam-authoring-scope="'+scope+'"])[data-sam-node="'+id+'"]';
  const chunks=[];
  for (const rule of rules.values()) {
    const declaration=[...rule.properties].map(([name,val])=>name+':'+val+' !important').join(';');
    const css=selector(rule.id)+'{'+declaration+'}';
    chunks.push(BREAKPOINTS[rule.breakpoint]?'@media '+BREAKPOINTS[rule.breakpoint]+'{'+css+'}':css);
  }
  return {schema:'agentsam.authoring-styles.v1',scope,css:chunks.join('\n'),edits:edits.length};
}
/** Client-side rendered element probe. Never substitutes guessed source for a missing binding. */
export function inspectRenderedElement({compiled,element}={}) {
  if (compiled?.schema!==AUTHORING_SCHEMA || !element?.closest) throw new Error('rendered_element_required');
  const match=element.closest('[data-sam-node]');
  const binding=compiled.bindings.find(b=>b.id===match?.getAttribute('data-sam-node'));
  if (!binding) throw new Error('unbound_rendered_element');
  const win=match.ownerDocument.defaultView;
  const computed=win?.getComputedStyle?.(match);
  const values=Object.fromEntries(binding.controls.map(c=>[c.key,computed?.getPropertyValue(c.css)?.trim()||null]));
  return {binding,computed:values,rect:match.getBoundingClientRect?.().toJSON?.()||null};
}
/** Reviewable patch against the exact original; no ambient filesystem or execution. */
export function compileSourcePatch({source,patches}={}) {
  if (typeof source!=='string' || !Array.isArray(patches) || !patches.length) throw new Error('source_patch_required');
  if (patches.some(p=>typeof p.after!=='string'||typeof p.before!=='string')) throw new Error('source_patch_strings_required');
  return {schema:'agentsam.authoring-source-patch.v1',source:applyPatches(source,patches),patches:patches.map(p=>({...p}))};
}
