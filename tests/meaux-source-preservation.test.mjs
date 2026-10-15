import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {mineStyleCandidates} from "../packages/theme-graph/src/style-candidates.js";
const dir=new URL("../examples/meaux-donors/original/",import.meta.url);
const digest = s=>createHash("sha256").update(s).digest("hex");
test("unaltered uploaded HTML sources match source SHA-256",()=>{
 const p=readFileSync(new URL("partners.html",dir));
 const b=readFileSync(new URL("enhanced-brand.html",dir));
 assert.equal(digest(p),"c8ce535da35782ea9dc3d94fd309f75b157654444071c4db9225b36a6ddc8d1c");
 assert.equal(digest(b),"25fea00d39ebdbbb636cea96c105c64f88181994ebfb5ab5185a96b89470e328");
});
test("style miner indexes selectors with source positions, motion and hashes",()=>{
 const text=readFileSync(new URL("partners.html",dir),"utf8");
 const report=mineStyleCandidates([{path:"partners.html",text,sha256:digest(text)}],[
   {id:"meaux.partner.card",file:"partners.html",selector:".partner-block",type:"card"},
   {id:"meaux.partner.underline",file:"partners.html",selector:".section-title",type:"motion"}
 ]);
 assert.equal(report.schema,"agentsam.style-candidates.v1");
 assert.equal(report.diagnostics.length,0);
 assert.equal(report.candidates.length,2);
 assert.equal(report.candidates[0].portable,false);
 assert.ok(report.candidates[0].evidence.length>=2);
 assert.ok(report.candidates[1].evidence.some(x=>x.declarations.transition));
 assert.ok(report.candidates.every(x=>x.evidence.every(y=>y.line>0)));
});
test("rejections never mint a stock item or execute source code",()=>{
 const report=mineStyleCandidates([{path:"x.html",text:"<style>.a{transform:translateY(-4px)}</style>",sha256:digest("<style>.a{transform:translateY(-4px)}</style>")}],[
 {id:"mined.a",file:"x.html",selector:".not-here",type:"motion"}]);
 assert.equal(report.diagnostics[0].code,"SELECTOR_NOT_FOUND");
 assert.equal(report.candidates[0].status,"candidate");
 assert.ok(report.candidates[0].unresolved.includes("cms_install"));
 assert.throws(()=>mineStyleCandidates([{path:"x",text:"a"}],[{id:"bad",file:"x",selector:".a"} ,{id:"bad",file:"x",selector:".b"}]),/unique/);
});