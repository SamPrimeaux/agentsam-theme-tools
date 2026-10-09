import { ingestSourceInputs } from '@inneranimalmedia/theme-source-ingest';
import { buildThemeModuleGraph, planModuleExtraction } from '@inneranimalmedia/theme-graph';
import { planHtmlRebuild } from '@inneranimalmedia/theme-html-rewriter';

export const CLI_COMMANDS = ['ingest', 'inspect', 'inventory', 'graph', 'check', 'closure', 'plan'];

function readArgs(argv, command) {
  const args = [...argv];
  let entryPoint = null;
  const index = args.indexOf('--entry');
  if (index >= 0) {
    entryPoint = args[index + 1];
    if (!entryPoint || entryPoint.startsWith('--')) throw new Error('missing_entry_point');
    args.splice(index, 2);
  }
  if (!['closure', 'plan'].includes(command) && entryPoint !== null) throw new Error('entry_only_supported_for_closure_or_plan');
  return { json: args.includes('--json'), entryPoint, inputs: args.filter((value) => value !== '--json') };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const unit = bytes >= 1048576 ? 'MB' : 'KB';
  return (bytes / (unit === 'MB' ? 1048576 : 1024)).toFixed(1) + ' ' + unit;
}

function writeInventorySummary(stdout, material) {
  const item = material.inventory;
  stdout.write(material.label + ' [' + material.origin + ']\n');
  stdout.write('  Source files: ' + item.totals.files + ' · ' + formatBytes(item.totals.bytes) + '\n');
  if (item.detected.length) {
    stdout.write('  Detected: ' + item.detected.map((d) => d.system).join(' + ') + ' (file-layout evidence)\n');
  }
  stdout.write('  File types: ' + item.languages.slice(0, 10)
    .map((d) => d.language + ' ' + d.count).join(' · ') + '\n');
  if (item.source.virtualRoot !== '.') stdout.write('  Archive root: ' + item.source.virtualRoot + '\n');
  stdout.write('  Source tree:\n');
  const folders = item.folders.slice(0, 14);
  for (let index = 0; index < folders.length; index++) {
    const row = folders[index];
    stdout.write('    ' + (index === folders.length - 1 ? '└─ ' : '├─ ') +
      row.folder.padEnd(21) + row.count + ' files\n');
  }
  if (item.folders.length > folders.length) {
    stdout.write('    … + ' + (item.folders.length - folders.length) + ' other folders\n');
  }
  if (item.keyFiles.length) {
    stdout.write('  Key files: ' + item.keyFiles.slice(0, 8).join(' · ') +
      (item.keyFiles.length > 8 ? ' · …' : '') + '\n');
  }
  const coverage = item.coverage;
  stdout.write('  Analysis: ' + coverage.htmlPagesAnalyzed + ' HTML pages · ' +
    coverage.htmlReferencesDiscovered + ' HTML references · ' +
    coverage.diagnostics + ' current diagnostics\n');
  if (coverage.notSemanticallyAnalyzed.length) {
    stdout.write('  Not yet parsed: ' + coverage.notSemanticallyAnalyzed.slice(0, 8)
      .map((d) => d.language + ' ' + d.count).join(' · ') + '\n');
  }
  stdout.write('  Exclusions: dependency/cache folders and macOS metadata ignored by default\n');
  stdout.write('  Coverage: partial — zero diagnostics does not mean the source is validated\n');
}

function writeClosureSummary(stdout, material, graph, plan) {
  const closure = plan.dependencyClosure;
  stdout.write(material.label + ' [' + material.origin + ']\n');
  stdout.write('  entry: ' + closure.entryPoint + '\n');
  stdout.write('  recognized module closure: ' + closure.modules.length + ' files\n');
  for (const id of closure.modules) {
    const mod = graph.modules[id];
    stdout.write('    ' + id + ' (' + mod.type + ')\n');
  }
  stdout.write('  unresolved: ' + closure.unresolved.length + '; external: ' +
    closure.external.length + '; unexamined: ' + closure.unexamined.length + '\n');
  for (const item of closure.unresolved) {
    stdout.write('    missing: ' + item.source.path + ' -> ' + item.target.path + '\n');
  }
  for (const item of closure.external) {
    stdout.write('    external: ' + item.source.path + ' -> ' + item.target.path + '\n');
  }
  for (const item of closure.unexamined) {
    stdout.write('    not analyzed: ' + item.module + ' (' + item.reason + ')\n');
  }
  stdout.write('  status: ' + plan.status + ' — no files copied or modified\n');
  stdout.write('  Note: recognized dependencies do NOT prove standalone runtime/visual fidelity.\n');
}

export async function runThemeCommand(argv, { stdout = process.stdout, stderr = process.stderr, stdin = process.stdin } = {}) {
  const args = [...argv];
  const command = args.shift() || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    stdout.write(
      'AgentSam Theme Tools (foundation)\n' +
      'Usage: agentsam-theme <ingest|inspect|inventory|graph|check|closure|plan> <paths...> [--json]\n' +
      '       agentsam-theme closure <one path> [--entry relative/path] [--json]\n' +
      '       agentsam-theme plan <one path> [--entry relative/path.html] [--json]\n' +
      'Sources: HTML, directory, ZIP, TAR, TAR.GZ, stdin (-); Git bundle snapshots\n' +
      'Closure is a source-backed candidate report, not a runnable converted theme.\n'
    );
    return 0;
  }
  if (!CLI_COMMANDS.includes(command)) {
    stderr.write('unknown_command: ' + command + '\n');
    return 2;
  }
  let options;
  try {
    options = readArgs(args, command);
  } catch (error) {
    stderr.write(String(error?.message || error) + '\n');
    return 2;
  }
  const { json, entryPoint, inputs } = options;
  if (!inputs.length) {
    stderr.write('source_required: supply one or more paths or -\n');
    return 2;
  }
  if (['closure', 'plan'].includes(command) && inputs.length !== 1) {
    stderr.write('closure_requires_exactly_one_source\n');
    return 2;
  }
  try {
    const report = await ingestSourceInputs(inputs, { stdin });
    if (command === 'plan') {
      const material = report.materials[0];
      const graph = buildThemeModuleGraph(material.files);
      const entries = entryPoint ? [entryPoint] : [...graph.entryPoints];
      if (entries.some(entry => !Object.prototype.hasOwnProperty.call(graph.modules, entry) ||
          graph.modules[entry].type !== 'html')) {
        stderr.write('invalid_html_entry_point: ' + entries.join(', ') + '\n');
        return 2;
      }
      const results = entries.map(entry => {
        const file = material.files.find(file => file.path === entry);
        if (!file || typeof file.text !== 'string') {
          throw new Error('html_source_text_unavailable: ' + entry);
        }
        return {
          html: planHtmlRebuild(file.text, { filename: entry }),
          extraction: planModuleExtraction(graph, entry),
        };
      });
      const output = {
        schema:'agentsam.theme-rebuild-plan-report.v1',
        material:{ label:material.label, origin:material.origin, fileCount:material.fileCount },
        candidates:results, readyForCms:false, verifiedPreview:false,
      };
      if (json) stdout.write(JSON.stringify(output, null, 2) + '\n');
      else {
        stdout.write(material.label + ' [' + material.origin + ']\n');
        for (const item of results) {
          stdout.write('  ' + item.html.source.filename + ': ' +
            item.html.candidates.length + ' source-backed section/global candidates\n');
          stdout.write('    closure: ' + item.extraction.files.length + ' files; ' +
            item.extraction.dependencyClosure.blockers.length + ' unverified conditions\n');
          for (const candidate of item.html.candidates) {
            stdout.write('    ' + candidate.type + ': ' + candidate.candidateId +
              ' · hazards=' + candidate.hazards.length + '\n');
          }
        }
        stdout.write('  readiness: SOURCE_CANDIDATE_ONLY (no CMS install, JS evaluation or browser proof)\n');
      }
      return 0;
    }
    if (command === 'closure') {
      const material = report.materials[0];
      const graph = buildThemeModuleGraph(material.files);
      const entry = entryPoint ?? (graph.entryPoints.length === 1 ? graph.entryPoints[0] : null);
      if (!entry) {
        stderr.write('entry_required: choose an HTML entry with --entry; discovered: ' +
          (graph.entryPoints.join(', ') || '(none)') + '\n');
        return 2;
      }
      if (!Object.prototype.hasOwnProperty.call(graph.modules, entry)) {
        stderr.write('unknown_entry_point: ' + entry + '\n');
        return 2;
      }
      const plan = planModuleExtraction(graph, entry);
      if (json) {
        stdout.write(JSON.stringify({
          schema: 'agentsam.theme-closure-report.v1',
          material: { label: material.label, origin: material.origin, fileCount: material.fileCount },
          graph, plan,
        }, null, 2) + '\n');
      } else {
        writeClosureSummary(stdout, material, graph, plan);
      }
      return 0;
    }
    if (command === 'inventory') {
      if (json) {
        stdout.write(JSON.stringify({
          schema: 'agentsam.theme-inventory-report.v1',
          materials: report.materials.map((material) => material.inventory),
        }, null, 2) + '\n');
      } else {
        for (const material of report.materials) writeInventorySummary(stdout, material);
      }
      return 0;
    }
    if (json || command === 'graph') {
      stdout.write(JSON.stringify(command === 'graph'
        ? { schema: report.schema, materials: report.materials.map((m) => ({ label: m.label, origin: m.origin, graph: m.graph })) }
        : command === 'check'
          ? { schema: report.schema, diagnostics: report.diagnostics }
          : report, null, 2) + '\n');
    } else {
      for (const material of report.materials) {
        if (command === 'ingest' || command === 'inspect') {
          writeInventorySummary(stdout, material);
          if (command === 'inspect') for (const page of material.graph.pages) {
            stdout.write('  Page: ' + page.id + ' · ' + page.sections.length + ' structural regions\n');
          }
          continue;
        }
        const graph = material.graph;
        stdout.write(material.label + ' [' + material.origin + ']: ' + material.fileCount + ' files, ' +
          graph.pages.length + ' HTML pages, ' + graph.edges.length + ' references, ' + graph.diagnostics.length + ' diagnostics\n');
        if (material.metadata) stdout.write('  ' + material.metadata.status + '\n');
        if (command === 'inspect') {
          for (const page of graph.pages) stdout.write('  ' + page.id + ': ' + page.sections.length + ' sections\n');
        }
        if (command === 'check') {
          for (const diagnostic of graph.diagnostics) {
            stdout.write('  ' + diagnostic.severity + ': ' + diagnostic.code + ' ' + (diagnostic.file || '') + ' ' + (diagnostic.target || '') + '\n');
          }
        }
      }
    }
    return command === 'check' && report.diagnostics.some((d) => d.severity === 'error') ? 1 : 0;
  } catch (error) {
    stderr.write('theme_' + command + '_failed: ' + String(error?.message || error) + '\n');
    return 1;
  }
}
