import { ingestSourceInputs } from '@inneranimalmedia/theme-source-ingest';

export const CLI_COMMANDS = ['ingest','inspect','graph','check'];
export async function runThemeCommand(argv,{stdout=process.stdout,stderr=process.stderr,stdin=process.stdin}={}) {
  const args=[...argv];
  const command=args.shift() || 'help';
  if(command==='help'||command==='--help'||command==='-h'){
    stdout.write('AgentSam Theme Tools (foundation)\nUsage: agentsam-theme <ingest|inspect|graph|check> <paths...> [--json]\nSources: HTML, directory, ZIP, TAR, TAR.GZ, stdin (-); Git bundle metadata\n');
    return 0;
  }
  if(!CLI_COMMANDS.includes(command)){stderr.write('unknown_command: '+command+'\n');return 2;}
  const json=args.includes('--json');
  const inputs=args.filter(a=>a!=='--json');
  if(!inputs.length){stderr.write('source_required: supply one or more paths or -\n');return 2;}
  try{
    const report=await ingestSourceInputs(inputs,{stdin});
    if(json||command==='graph'){stdout.write(JSON.stringify(command==='graph'
      ?{schema:report.schema,materials:report.materials.map(m=>({label:m.label,origin:m.origin,graph:m.graph}))}
      :command==='check'?{schema:report.schema,diagnostics:report.diagnostics}
        :report,null,2)+'\n');}
    else {
      for(const material of report.materials) {
        const graph=material.graph;
        stdout.write(material.label+' ['+material.origin+']: '+material.fileCount+' files, '+
          graph.pages.length+' HTML pages, '+graph.edges.length+' references, '+graph.diagnostics.length+' diagnostics\n');
        if(material.metadata)stdout.write('  '+material.metadata.status+'\n');
        if(command==='inspect')for(const page of graph.pages)stdout.write('  '+page.id+': '+page.sections.length+' sections\n');
        if(command==='check')for(const diagnostic of graph.diagnostics)stdout.write('  '+diagnostic.severity+': '+diagnostic.code+' '+(diagnostic.file||'')+' '+(diagnostic.target||'')+'\n');
      }
    }
    return command==='check'&&report.diagnostics.some(d=>d.severity==='error')?1:0;
  }catch(e){stderr.write('theme_'+command+'_failed: '+String(e?.message||e)+'\n');return 1;}
}
