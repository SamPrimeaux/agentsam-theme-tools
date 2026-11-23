// Deterministic evidence generator. No network, no executes of donor HTML, no database writes.
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import {mineStyleCandidates} from "../packages/theme-graph/src/style-candidates.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const base="examples/meaux-donors/original/";
const paths=["partners.html","enhanced-brand.html","help-links.html"].map(x=>base+x);
const files=paths.map(path=>({path,text:readFileSync(resolve(root,path),"utf8"),sha256:createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex")}));
const selections=[
 {id:"meaux.partner.glass-card",file:paths[0],selector:".partner-block",type:"card"},
 {id:"meaux.motion.title-underline",file:paths[0],selector:".section-title",type:"motion"},
 {id:"meaux.motion.glisten-sweep",file:paths[0],selector:".partner-link::before",type:"motion"},
 {id:"meaux.motion.card-lift",file:paths[0],selector:".partner-block:hover",type:"motion"},
 {id:"meaux.partner.title-hover",file:paths[0],selector:".partner-content h2",type:"typography"},
 {id:"meaux.button.partner-apply",file:paths[0],selector:".apply-button",type:"button"},
 {id:"meaux.brand.swamp-hero",file:paths[1],selector:".meaux-swamp-cta-hero",type:"composition"},
 {id:"meaux.brand.swatch",file:paths[1],selector:".brand-color-swatch",type:"card"},
 {id:"meaux.brand.font-row",file:paths[1],selector:".brand-font-item",type:"typography"},
 {id:"meaux.brand.cta",file:paths[1],selector:".swamp-cta-btn",type:"button"},
 {id:"meaux.button.invert-help-link",file:paths[2],selector:".meaux-help-link",type:"button"},
];
const report=mineStyleCandidates(files,selections);
const path=resolve(root,"examples/meaux-donors/candidates.json");
if(report.diagnostics.length){console.error(report.diagnostics);process.exitCode=1;}
else {writeFileSync(path,JSON.stringify({...report,origin:"founder-source-2026-10-15",promotion:"review-only",meta:{
 notes:"Source-complete HTML remains unchanged; style evidence is NOT an executable/verified component.",
 sourceAttachmentSha256:{
  "partners.html":"c8ce535da35782ea9dc3d94fd309f75b157654444071c4db9225b36a6ddc8d1c",
  "enhanced-brand.html":"25fea00d39ebdbbb636cea96c105c64f88181994ebfb5ab5185a96b89470e328"
 }
}},null,2)+"\n");console.log(report.candidates.length+" candidate patterns written");}
