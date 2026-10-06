import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import tar from 'tar-stream';
import { createRequire } from 'node:module';
import { ingestSourceInputs, classifyBuffer } from '@inneranimalmedia/theme-source-ingest';
import { runThemeCommand } from '@inneranimalmedia/theme-cli';
const require=createRequire(import.meta.url), yazl=require('yazl');
const sample='<!doctype html><html><body><section data-cms-section="hero"><img src="logo.png"></section></body></html>';

async function zip(entries){
  const z=new yazl.ZipFile();for(const [name,value] of Object.entries(entries))z.addBuffer(Buffer.from(value),name);
  z.end();const parts=[];for await(const chunk of z.outputStream)parts.push(chunk);return Buffer.concat(parts);
}
async function tarball(entries){
  const pack=tar.pack();for(const [name,value] of Object.entries(entries))pack.entry({name},Buffer.from(value));
  pack.finalize();const chunks=[];for await(const chunk of pack)chunks.push(chunk);
  return Buffer.concat(chunks);
}
test('reads arbitrary HTML bytes without a CMS or Cloudflare runtime',async()=>{
  const r=await ingestSourceInputs({kind:'bytes',bytes:Buffer.from(sample),name:'index.html'});
  assert.equal(r.materials[0].graph.pages[0].sections[0].name,'hero');
  assert.equal(r.materials[0].origin,'html');
});
test('ingests ZIP files with source, resource inventory and intact graph',async()=>{
  const data=await zip({'index.html':sample,'logo.png':'fake-image','assets/app.css':'body{}'});
  const r=await ingestSourceInputs({kind:'bytes',bytes:data,name:'source.zip'});
  assert.equal(r.materials[0].origin,'zip');
  assert.equal(r.materials[0].fileCount,3);
  assert.equal(r.materials[0].graph.diagnostics.filter(d=>d.code==='UNRESOLVED_RESOURCE').length,0);
});
test('ingests TAR and TAR.GZ using one source contract',async()=>{
  const raw=await tarball({'index.html':sample,'logo.png':'image'});
  for(const [name,bytes] of [['source.tar',raw],['source.tar.gz',gzipSync(raw)]]){
    const r=await ingestSourceInputs({kind:'bytes',bytes,name});
    assert.equal(r.materials[0].fileCount,2);
    assert.equal(r.materials[0].graph.pages.length,1);
  }
});
test('rejects archive path traversal, links and decompression limits',async()=>{
  const pack=tar.pack();pack.entry({name:'../escape.html'},'bad');pack.finalize();
  const chunks=[];for await(const chunk of pack)chunks.push(chunk);
  await assert.rejects(ingestSourceInputs({kind:'bytes',bytes:Buffer.concat(chunks),name:'unsafe.tar'}),/unsafe_archive_path/);
  const link=tar.pack();link.entry({name:'pointer',type:'symlink',linkname:'/etc/passwd'});link.finalize();
  const c=[];for await(const chunk of link)c.push(chunk);
  await assert.rejects(ingestSourceInputs({kind:'bytes',bytes:Buffer.concat(c),name:'link.tar'}),/unsupported_archive_entry_type/);
  const data=await zip({'index.html':sample});
  await assert.rejects(ingestSourceInputs({kind:'bytes',bytes:data,name:'source.zip'},{policy:{maxExpandedBytes:3}}),/limit_exceeded/);
});
test('rejects invalid archive signatures and unauthorized remote acquisition',async()=>{
  assert.throws(()=>classifyBuffer(Buffer.from('plain'),'fake.zip'),/signature/);
  await assert.rejects(ingestSourceInputs('https://example.org/theme.zip'),/source_adapter_required/);
});
test('ingests unrelated customer trees without inheriting brand defaults',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'theme-tools-'));
  try {
    await fs.writeFile(path.join(root,'index.html'),sample);
    await fs.writeFile(path.join(root,'logo.png'),'asset');
    const r=await ingestSourceInputs(root);
    assert.equal(r.materials[0].origin,'directory');
    assert.equal(r.materials[0].graph.diagnostics.filter(d=>d.code==='UNRESOLVED_RESOURCE').length,0);
    assert.ok(r.materials[0].files.every(f=>!f.path.includes(root)));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('CLI executes against stdin with structured output and no side effects',async()=>{
  const output=[],errors=[];
  const code=await runThemeCommand(['inspect','-','--json'],{
    stdout:{write:s=>output.push(s)},stderr:{write:s=>errors.push(s)},
    stdin:[Buffer.from(sample)]
  });
  assert.equal(code,0);
  assert.equal(errors.length,0);
  assert.equal(JSON.parse(output.join('')).materials[0].origin,'html');
});
