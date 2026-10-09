/** Source-backed HTML rewrite and rebuild planning. No CMS/publish authority. */
export declare const HTML_REWRITE_SCHEMA: 'agentsam.html-rewrite.v1';
export declare const HTML_REBUILD_PLAN_SCHEMA: 'agentsam.html-rebuild-plan.v1';

export interface SourcePatch {
  start: number;
  end: number;
  before: string;
  after: string;
  kind: string;
  tag?: string;
  attribute?: string;
  original?: string;
  replacement?: string;
  referencesChanged?: number;
}
export interface HtmlDiagnostic {
  code: string;
  severity?: string;
  line?: number;
  column?: number;
  start?: number;
  [key: string]: unknown;
}
export interface RewriteResult {
  schema: typeof HTML_REWRITE_SCHEMA;
  html: string;
  changed: number;
  patches: SourcePatch[];
  diagnostics: HtmlDiagnostic[];
}
export type RewriteMap = ReadonlyMap<string, string> | Readonly<Record<string, string>>;
export interface SourceRange {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
}
export interface SectionDependency {
  tag: string;
  attribute: string;
  value: string;
  kind: string;
  external: boolean;
  range: { start: number; end: number };
}
export interface RebuildCandidate {
  candidateId: string;
  type: 'global-region' | 'navigation' | 'page-shell' | 'section';
  marker: string | null;
  tag: string;
  id: string | null;
  sourceRange: SourceRange;
  length: number;
  dependencies: SectionDependency[];
  proposedFields: {
    headings: Array<{tag:string;value:string}>;
    paragraphs: Array<{value:string}>;
    media: Array<{role:'media.image';src:string|null;alt:string|null}>;
    links: Array<{href:string|null;label:string}>;
  };
  hazards: string[];
  state: 'requires-normalization';
  sourceHtml?: string;
}
export interface HtmlRebuildPlan {
  schema: typeof HTML_REBUILD_PLAN_SCHEMA;
  source: { filename:string; length:number };
  coverage: { analyzed:string[]; notAnalyzed:string[] };
  evidence: {
    title: string | null;
    elementCount: number;
    scriptElements: number;
    styleElements: number;
    inlineHandlers: number;
    inlineStyles: number;
    duplicateIds: string[];
    parseErrors: HtmlDiagnostic[];
    references: Array<{tag:string;attr:string;value:string;kind:string;external:boolean;start:number|null;end:number|null}>;
  };
  candidates: RebuildCandidate[];
  state: 'source-backed-candidates-only';
  readyForCms: false;
  verifiedPreview: false;
  approved: false;
}
/** Reject unsafe rewrite URLs using the Rust v1 scheme/length baseline. */
export declare function validateRewriteUrl(value: string): string;
export declare function planHtmlRebuild(
  source: string,
  options?: { filename?: string; includeSource?: boolean }
): HtmlRebuildPlan;
export declare function rewriteAssetReferences(
  source: string,
  replacements: RewriteMap,
  options?: { includeSrcset?: boolean }
): RewriteResult;
export declare function replaceSectionContent(
  source: string,
  options: { marker: string; html: string; trusted?: boolean }
): RewriteResult;
export declare function applyPatches(source: string, patches: SourcePatch[]): string;
export declare function rewriteResponseWithCloudflare<T>(
  response: T,
  replacements: RewriteMap,
  Rewriter?: new () => {
    on: (selector:string, handler:unknown) => unknown;
    transform: (response:T) => T;
  }
): T;
