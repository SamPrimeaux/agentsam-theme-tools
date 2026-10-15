/**
 * Deterministic, read-only CSS style candidate extraction.
 * This is a source-evidence lane, not a CSS AST, a renderer, a CMS registry or publication.
 * Handles self-contained declaration rules; nested constructs that cannot be parsed are reported.
 */
export const STYLE_CANDIDATES_SCHEMA = "agentsam.style-candidates.v1";
function lineOf(text, offset) { return 1 + (text.slice(0,offset).match(/\n/g) || []).length; }
function extractRules(html) {
  const styles = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  for (const match of html.matchAll(re)) {
    const start = match.index + match[0].indexOf(match[1]);
    styles.push({ css: match[1], start });
  }
  return styles;
}
function decls(css) {
  const out={};
  for(const pair of css.split(";")) {
    const colon=pair.indexOf(":");
    if(colon<0)continue;
    const name=pair.slice(0,colon).trim().replace(/\/\*[\s\S]*?\*\//g,"").trim();
    const val=pair.slice(colon+1).trim();
    if(/^(?:--[a-z0-9_-]+|[a-z-]+)$/i.test(name)&&val) out[name]=val;
  }
  return out;
}
/** @param {{path:string,text:string}[]} files @param {{id:string,file:string,selector:string,type:string}[]} selections */
export function mineStyleCandidates(files, selections) {
  if (!Array.isArray(files) || !Array.isArray(selections) || files.length>80 || selections.length>250)
    throw new TypeError("Bounded files and selections are required");
  const errors=[],candidates=[], sources=[];
  const observedIds=new Set();
  for (const file of files) {
    if (typeof file?.path!=="string" || typeof file?.text!=="string" || file.text.length>1024*1024)
      throw new TypeError("Invalid or oversized source file");
    const hash=/^[a-f0-9]{64}$/i.test(file.sha256 ?? "") ? file.sha256 : null;
    if(!hash) errors.push({code:"SOURCE_HASH_MISSING",file:file.path});
    sources.push({path:file.path,sha256:hash,bytes:Buffer.byteLength(file.text)});
    const styles=extractRules(file.text);
    for(const spec of selections.filter(s=>s.file===file.path)){
      if(!/^[a-z0-9][a-z0-9._-]+$/i.test(spec.id) || observedIds.has(spec.id))
        throw new TypeError("Candidate ID must be unique and stable");
      observedIds.add(spec.id);
      // CSS rule locator intentionally conservative: plain selectors only.
      let found=[];
      for(const style of styles) {
        const re=/([^{}]+)\{([^{}]*)\}/g;
        for(const match of style.css.matchAll(re)){
          const rawSelector=match[1].trim();
          const selectors=rawSelector.split(",").map(s=>s.trim());
          if(selectors.some(s=>s===spec.selector || s.includes(spec.selector+":") ||
            s.includes(spec.selector+"::") || s.includes(spec.selector+" "))) {
            const values=decls(match[2]);
            const start=style.start+match.index;
            found.push({
              selectors:rawSelector,
              line:lineOf(file.text,start),
              declarationCount:Object.keys(values).length,
              declarations:values,
              interactions:Object.fromEntries(Object.entries(values).filter(([k])=>
                ["transition","animation","transform","box-shadow","opacity","filter","width","left"].includes(k)))
            });
          }
        }
      }
      if(!found.length){
        errors.push({code:"SELECTOR_NOT_FOUND",file:file.path,id:spec.id,selector:spec.selector});
      }
      candidates.push({
        id:spec.id,kind:spec.type,status:"candidate",portable:false,
        source:{path:file.path,sha256:hash},selector:spec.selector,evidence:found,
        unresolved:["browser_fidelity","typed_settings","host_integration","license_review","cms_install","second_site_proof"],
      });
    }
  }
  for(const spec of selections)if(!sources.some(s=>s.path===spec.file)){
    errors.push({code:"SOURCE_NOT_PRESENT",file:spec.file,id:spec.id});
  }
  return {schema:STYLE_CANDIDATES_SCHEMA,sources,candidates,diagnostics:errors};
}