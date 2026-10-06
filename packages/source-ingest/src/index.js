/**
 * Safe Node adapter for source intake, with portable SourceInput and ThemeGraph outputs.
 * Archives remain in memory and are never extracted onto a filesystem.
 * Network, provider-ref, and remote terminal transfers require caller-owned adapters.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import tar from 'tar-stream';
import { normalizeSourceInputs } from '@inneranimalmedia/theme-source-input';
import { buildThemeGraph } from '@inneranimalmedia/theme-graph';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl');
const FORMATS = new Set(['zip','tar','tar.gz','git-bundle','html','file','directory']);
const DEFAULTS = Object.freeze({maxArchiveBytes: 64*1024*1024, maxEntries: 10000,
  maxExpandedBytes: 256*1024*1024, maxEntryBytes: 16*1024*1024, maxFileBytes: 64*1024*1024});
const SKIP_DIR = new Set(['.git','node_modules','.agentsam','dist','coverage']);
const TEXT_EXT = /\.(?:html?|css|js|mjs|cjs|ts|tsx|jsx|jsonc?|liquid|svg|md)$/i;
const HTML_EXT = /\.html?$/i;

export const INGEST_SCHEMA = 'agentsam.theme-ingest.v1';

export function classifyBuffer(bytes, name = '') {
  const buffer = Buffer.from(bytes);
  const lower = String(name).toLowerCase();
  if (buffer.subarray(0,4).equals(Buffer.from('PK\x03\x04', 'binary')) || buffer.subarray(0,4).equals(Buffer.from('PK\x05\x06', 'binary'))) return 'zip';
  if (buffer.subarray(0,2).equals(Buffer.from([0x1f,0x8b]))) return 'tar.gz';
  if (buffer.length >= 262 && buffer.toString('ascii',257,262) === 'ustar') return 'tar';
  if (/^# v[23] git bundle/.test(buffer.toString('utf8',0,32))) return 'git-bundle';
  if (/\.(?:zip|tar|tgz|tar\.gz|bundle)$/.test(lower)) throw new Error('archive_extension_does_not_match_signature: ' + name);
  if (HTML_EXT.test(lower)) return 'html';
  return 'file';
}

function bytesHash(buf) { return createHash('sha256').update(buf).digest('hex'); }
function safeArchivePath(file) {
  if (!file || file.includes('\0') || file.includes('\\') || file.startsWith('/') || /^[a-zA-Z]:/.test(file)) throw new Error('unsafe_archive_path: ' + file);
  const segments = file.split('/');
  if (segments.includes('..')) throw new Error('unsafe_archive_path: ' + file);
  const result = path.posix.normalize(file).replace(/^\.\/+/, '');
  if (result === '.' || result.startsWith('../')) throw new Error('unsafe_archive_path: ' + file);
  return result;
}
function checkSize(value, limit, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > limit) throw new Error(label + '_limit_exceeded: ' + value);
}
function makeRecord(filePath, bytes, readText = false) {
  const data = Buffer.from(bytes);
  return { path: safeArchivePath(filePath), bytes: data.length, sha256: bytesHash(data),
    ...(readText && TEXT_EXT.test(filePath) ? {text: data.toString('utf8')} : {}) };
}
function uniqueRecords(items) {
  const paths = new Set();
  for (const item of items) {
    if (paths.has(item.path)) throw new Error('duplicate_archive_entry: ' + item.path);
    paths.add(item.path);
  }
  return items;
}

async function fromZip(buffer, policy) {
  return await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer,{lazyEntries:true,autoClose:true,validateEntrySizes:true},(err, zip) => {
      if (err) return reject(err);
      const records = []; let count = 0, expanded = 0, done = false;
      const fail = (error) => { if (done) return; done = true; zip.close(); reject(error); };
      zip.on('error',fail);
      zip.on('end',()=>{if (!done) {done = true; try {resolve(uniqueRecords(records));} catch(e) {reject(e);} }});
      zip.on('entry',(entry)=>{
        try {
          count++; checkSize(count,policy.maxEntries,'archive_entry_count');
          const file = safeArchivePath(entry.fileName);
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (mode === 0o120000 || (mode !== 0 && mode !== 0o100000 && mode !== 0o040000)) throw new Error('unsupported_archive_entry_type: ' + file);
          if (/\/$/.test(entry.fileName)) { zip.readEntry(); return; }
          expanded += entry.uncompressedSize;
          checkSize(expanded,policy.maxExpandedBytes,'archive_expanded_bytes');
          const selected = TEXT_EXT.test(file);
          if (!selected) {
            records.push({path:file,bytes:entry.uncompressedSize,sha256:null});
            zip.readEntry(); return;
          }
          checkSize(entry.uncompressedSize,policy.maxEntryBytes,'archive_entry_bytes');
          zip.openReadStream(entry,(openError, stream)=>{
            if(openError) return fail(openError);
            const chunks=[];let total=0;
            stream.on('data',(chunk)=>{
              total+=chunk.length;
              if(total>policy.maxEntryBytes) {stream.destroy(new Error('archive_entry_bytes_limit_exceeded'));return;}
              chunks.push(chunk);
            });
            stream.on('error',fail);
            stream.on('end',()=>{
              if(done) return;
              records.push(makeRecord(file,Buffer.concat(chunks),true));
              zip.readEntry();
            });
          });
        } catch(e) { fail(e); }
      });
      zip.readEntry();
    });
  });
}

async function fromTar(buffer, compressed, policy) {
  return await new Promise((resolve,reject)=>{
    const extract=tar.extract();
    const records=[];let count=0,expanded=0,done=false;
    const fail=(e)=>{if(done)return;done=true;extract.destroy();reject(e);};
    extract.on('error',fail);
    extract.on('finish',()=>{if(!done){done=true;try{resolve(uniqueRecords(records));}catch(e){reject(e);}}});
    extract.on('entry',(header,stream,next)=>{
      try{
        count++;checkSize(count,policy.maxEntries,'archive_entry_count');
        const name=safeArchivePath(header.name);
        if(header.type==='directory'){stream.resume();stream.once('end',next);return;}
        if(header.type!=='file' && header.type!=='contiguous-file')throw new Error('unsupported_archive_entry_type: '+name);
        expanded+=header.size;checkSize(expanded,policy.maxExpandedBytes,'archive_expanded_bytes');
        const selected=TEXT_EXT.test(name);
        if(!selected){records.push({path:name,bytes:header.size,sha256:null});stream.resume();stream.once('end',next);return;}
        checkSize(header.size,policy.maxEntryBytes,'archive_entry_bytes');
        const chunks=[];let total=0;
        stream.on('data',(data)=>{total+=data.length;if(total>policy.maxEntryBytes){fail(new Error('archive_entry_bytes_limit_exceeded'));return;}chunks.push(data);});
        stream.on('error',fail);
        stream.on('end',()=>{if(done)return;records.push(makeRecord(name,Buffer.concat(chunks),true));next();});
      }catch(e){fail(e);}
    });
    const source=Readable.from([buffer]);
    if(compressed) {
      const bound=new Transform({transform(chunk,encoding,callback){
        this.total=(this.total||0)+chunk.length;
        if(this.total>policy.maxExpandedBytes+policy.maxEntries*1024) callback(new Error('archive_decompression_limit_exceeded'));
        else callback(null,chunk);
      }});
      const gunzip=createGunzip();
      source.on('error',fail);gunzip.on('error',fail);bound.on('error',fail);
      source.pipe(gunzip).pipe(bound).pipe(extract);
    } else source.pipe(extract).on('error',fail);
  });
}

async function fromDirectory(dir,policy) {
  const records=[];let total=0,count=0;
  async function visit(current,prefix) {
    const entries=(await fs.readdir(current,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      if(SKIP_DIR.has(entry.name))continue;
      const file=path.join(current,entry.name);
      const relative=prefix?prefix+'/'+entry.name:entry.name;
      if(entry.isSymbolicLink())throw new Error('symlink_in_source_tree: '+relative);
      if(entry.isDirectory()){await visit(file,relative);continue;}
      if(!entry.isFile())throw new Error('unsupported_source_entry: '+relative);
      count++;checkSize(count,policy.maxEntries,'source_file_count');
      const stat=await fs.stat(file);total+=stat.size;checkSize(total,policy.maxExpandedBytes,'source_total_bytes');
      if(TEXT_EXT.test(relative)) {
        checkSize(stat.size,policy.maxEntryBytes,'source_entry_bytes');
        records.push(makeRecord(relative,await fs.readFile(file),true));
      } else records.push({path:safeArchivePath(relative),bytes:stat.size,sha256:null});
    }
  }
  await visit(dir,'');
  return records;
}

function bundleHeads(filename){
  const p=spawnSync('git',['bundle','list-heads',filename],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  if(p.status!==0)throw new Error('git_bundle_invalid: '+(p.stderr||p.error?.message||'unknown'));
  return p.stdout.split(/\r?\n/).filter(Boolean).map(line=>({head:line.trim()}));
}

async function obtainSource(source,options,policy) {
  if(source.kind==='url' || source.kind==='provider-ref'){
    if(typeof options.resolveSource!=='function')throw new Error('source_adapter_required: '+source.kind);
    const adapted=await options.resolveSource(source);
    const normalized=normalizeSourceInputs(adapted)[0];
    if(normalized.kind==='url'||normalized.kind==='provider-ref')throw new Error('source_adapter_did_not_resolve: '+normalized.kind);
    return obtainSource(normalized,options,policy);
  }
  if(source.kind==='directory') {
    const abs=path.resolve(source.path);
    return {origin:'directory',label:path.basename(abs),files:await fromDirectory(abs,policy)};
  }
  if(source.kind==='local-path'){
    const abs=path.resolve(source.path);
    const stat=await fs.lstat(abs);
    if(stat.isSymbolicLink())throw new Error('source_symlink_not_allowed: '+abs);
    if(stat.isDirectory())return {origin:'directory',label:path.basename(abs),files:await fromDirectory(abs,policy)};
    if(!stat.isFile())throw new Error('unsupported_source_type: '+abs);
    checkSize(stat.size,policy.maxArchiveBytes,'source_input_bytes');
    const bytes=await fs.readFile(abs);
    return processBuffer(bytes,path.basename(abs),abs,policy);
  }
  if(source.kind==='stdin'){
    const stream=options.stdin;
    if(!stream)throw new Error('stdin_stream_required');
    const chunks=[];let total=0;
    for await (const chunk of stream) {
      const part=Buffer.from(chunk);total+=part.length;checkSize(total,policy.maxArchiveBytes,'stdin_bytes');chunks.push(part);
    }
    return processBuffer(Buffer.concat(chunks),options.stdinName||'stdin.html',null,policy);
  }
  if(source.kind==='blob'){
    checkSize(source.blob.size,policy.maxArchiveBytes,'source_input_bytes');
    return processBuffer(Buffer.from(await source.blob.arrayBuffer()),source.name,null,policy);
  }
  if(source.kind==='bytes'){
    checkSize(source.bytes.byteLength,policy.maxArchiveBytes,'source_input_bytes');
    return processBuffer(Buffer.from(source.bytes),source.name,null,policy);
  }
  throw new Error('unsupported_source_input: '+source.kind);
}

async function processBuffer(bytes,name,localPath,policy) {
  const format=classifyBuffer(bytes,name);
  if(!FORMATS.has(format))throw new Error('unknown_source_format');
  let files=[], metadata=null;
  if(format==='zip')files=await fromZip(bytes,policy);
  else if(format==='tar')files=await fromTar(bytes,false,policy);
  else if(format==='tar.gz')files=await fromTar(bytes,true,policy);
  else if(format==='git-bundle'){
    if(!localPath)throw new Error('git_bundle_requires_local_path_for_validation');
    metadata={status:'history-inventory-only',heads:bundleHeads(localPath)};
  } else files=[makeRecord(name,bytes,true)];
  return {origin:format,label:name,sha256:bytesHash(bytes),files,metadata};
}

export async function ingestSourceInputs(inputs,options={}) {
  const policy={...DEFAULTS,...(options.policy||{})};
  const sources=normalizeSourceInputs(inputs);
  const materials=[];
  for(const source of sources) {
    const material=await obtainSource(source,options,policy);
    material.graph=buildThemeGraph(material.files);
    material.fileCount=material.files.length;
    materials.push(material);
  }
  return {schema:INGEST_SCHEMA,materials,policy,diagnostics:materials.flatMap(m=>m.graph.diagnostics)};
}
