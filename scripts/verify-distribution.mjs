#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=[
  '@inneranimalmedia/theme-source-input',
  '@inneranimalmedia/theme-syntax-html',
  '@inneranimalmedia/theme-html-rewriter',
  '@inneranimalmedia/theme-graph',
  '@inneranimalmedia/theme-source-ingest',
  '@inneranimalmedia/theme-cli',
  '@inneranimalmedia/lang-jsonc'
];
const work=fs.mkdtempSync(path.join(os.tmpdir(),'agentsam-theme-tools-install-'));
function run(command,args,cwd=root){
  const p=spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  if(p.status!==0)throw new Error(command+' '+args.join(' ')+' failed: '+(p.stderr||p.error?.message||p.stdout));
  return (p.stdout||'').trim();
}
try{
  const archives=names.map(name=>{
    const output=run('npm',['pack','--silent','-w',name,'--pack-destination',work]);
    const tarball=path.join(work,output.split(/\r?\n/).at(-1));
    if(!fs.existsSync(tarball))throw new Error('missing package tarball: '+name);
    return tarball;
  });
  const project=path.join(work,'consumer');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({name:'test-consumer',private:true,type:'module'})+'\n');
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund','--prefix',project,...archives]);
  const smoke=[
    "import {analyzeHtml} from '@inneranimalmedia/theme-syntax-html';",
    "import {analyzeJsonc} from '@inneranimalmedia/lang-jsonc';",
    "import {rewriteAssetReferences} from '@inneranimalmedia/theme-html-rewriter';",
    "import {buildThemeGraph,buildThemeModuleGraph,planModuleExtraction} from '@inneranimalmedia/theme-graph';",
    "import {ingestSourceInputs,buildSourceInventory} from '@inneranimalmedia/theme-source-ingest';",
    "const s='<!doctype html><html><body><section data-cms-section=\"hero\"><img src=\"logo.png\"></section></body></html>';",
    "if(analyzeHtml(s).sections[0].name!=='hero')throw Error('HTML failed');",
    "if(rewriteAssetReferences(s,{'logo.png':'other.png'}).changed!==1)throw Error('Rewriter failed');",
    "if(!buildThemeGraph([{path:'index.html',text:s},{path:'logo.png'}]).edges[0].resolved)throw Error('Graph failed');",
    "const sourceGraph=buildThemeModuleGraph([{path:'index.html',text:s},{path:'logo.png'}]);",
    "if(planModuleExtraction(sourceGraph,'index.html').files.length!==2)throw Error('Module closure failed');",
    "if(analyzeJsonc('{ //comment\\n \"x\": 1,}').value.x!==1)throw Error('JSONC failed');",
    "const mat=(await ingestSourceInputs({kind:'bytes',bytes:new TextEncoder().encode(s),name:'index.html'})).materials[0];",
    "if(mat.graph.pages.length!==1)throw Error('Ingest failed');",
    "if(buildSourceInventory(mat).totals.files!==1 || mat.inventory.coverage.htmlPagesAnalyzed!==1)throw Error('Inventory failed');",
    "console.log('independent-package-consumer: PASS');",
  ].join('\n');
  console.log(run(process.execPath,['--input-type=module','-e',smoke],project));
  console.log(run(process.execPath,[path.join(project,'node_modules/@inneranimalmedia/theme-cli/bin/agentsam-theme.mjs'),'inspect',path.join(root,'examples/basic')],project));
  const closure=run(process.execPath,[path.join(project,'node_modules/@inneranimalmedia/theme-cli/bin/agentsam-theme.mjs'),'closure',path.join(root,'examples/basic')],project);
  if(!closure.includes('recognized module closure: 3 files'))throw new Error('Independent CLI closure failed: '+closure);
  console.log('independent-cli-closure: PASS');
  console.log('independent-packaged-install: PASS ('+archives.length+' packages)');
} finally {
  fs.rmSync(work,{recursive:true,force:true});
}
