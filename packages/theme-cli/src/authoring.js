import {readFile} from 'node:fs/promises';
import {ingestSourceInputs} from '@inneranimalmedia/theme-source-ingest';
import {verifyAuthoringSource} from '@inneranimalmedia/theme-authoring-compiler/consumer';

function argsFor(argv){
  const rest=[...argv],args={json:false,entry:null,scope:'component',expectedSha:null,edits:null,inputs:[]};
  for(let i=0;i<rest.length;i++){
    const arg=rest[i];
    if(arg==='--json'){args.json=true;continue;}
    if(['--entry','--scope','--expected-sha','--edits'].includes(arg)){
      const value=rest[++i];
      if(!value||value.startsWith('--')) throw new Error('missing_option_value:'+arg);
      args[{'--entry':'entry','--scope':'scope','--expected-sha':'expectedSha','--edits':'edits'}[arg]]=value;continue;
    }
    if(arg.startsWith('--')) throw new Error('unknown_authoring_option:'+arg);
    args.inputs.push(arg);
  }
  if(args.inputs.length!==1) throw new Error('authoring_exactly_one_source_required');
  return args;
}
export async function runAuthoringCommand(command,argv,{stdout=process.stdout,stderr=process.stderr,stdin=process.stdin}={}){
  try{
    const args=argsFor(argv);
    const material=(await ingestSourceInputs(args.inputs,{stdin})).materials[0];
    const candidates=material.files.filter(f=>/\.html?$/i.test(f.path)&&typeof f.text==='string');
    if(!candidates.length) throw new Error('no_html_source_available:requires_source_adapter_for_liquid_react');
    if(!args.entry&&candidates.length!==1) throw new Error('entry_required:'+candidates.map(f=>f.path).join(','));
    const sourceFile=candidates.find(f=>f.path===(args.entry||candidates[0].path));
    if(!sourceFile) throw new Error('unknown_source_entry:'+args.entry);
    if(args.expectedSha&&args.expectedSha!==sourceFile.sha256) throw new Error('authoring_source_revision_conflict');
    let edits=[];
    if(args.edits){
      const file=await readFile(args.edits,'utf8');
      if(file.length>65536) throw new Error('authoring_edits_too_large');
      edits=JSON.parse(file);
      if(!Array.isArray(edits)||edits.length>100) throw new Error('authoring_edits_array_required');
    }
    if(command==='analyze'&&edits.length) throw new Error('analyze_is_read_only');
    const receipt=verifyAuthoringSource({sourceFile,scope:args.scope,edits});
    receipt.material={origin:material.origin,sourceFileCount:material.fileCount};
    receipt.verification.assetsResolved=false;
    receipt.verification.languageRuntimeValidated=false;
    if(command==='verify'&&receipt.diagnostics.some(d=>d.severity==='error')) {
      stderr.write(JSON.stringify(receipt.diagnostics)+'\n');
      return 1;
    }
    if(args.json) stdout.write(JSON.stringify(receipt,null,2)+'\n');
    else {
      stdout.write('Source: '+sourceFile.path+'\nSHA-256: '+sourceFile.sha256+'\n');
      stdout.write('Bindings: '+receipt.compilation.elementCount+' · scope '+args.scope+'\n');
      stdout.write('Source preserved: '+receipt.verification.sourcePreserved+'; rendered verification: not performed\n');
      stdout.write('Diagnostics: '+receipt.diagnostics.length+'\n');
      if(command==='authoring') stdout.write(receipt.transformations.css+'\n');
      stdout.write('Receipt: '+receipt.schema+'\n');
    }
    return 0;
  }catch(error){
    stderr.write('theme_'+command+'_failed: '+String(error?.message||error)+'\n');
    return 1;
  }
}
