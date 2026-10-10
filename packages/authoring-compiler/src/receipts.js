import {compileHtmlAuthoring,compileScopedStyles,AUTHORING_SCHEMA} from './index.js';
import {assembleAuthoringEvidence,verifySourceIdentity} from './integrations.js';
export const RECEIPT_SCHEMA='agentsam.authoring-verification.v1';
/** Pure local receipt; no auth, source modifications, publication or implied browser fidelity. */
export function verifyAuthoringSource({sourceFile,sourceRevision=null,scope='component',edits=[],
  brandPack=null,assetRecords=[],section=null,sceneKindLookup=null,repositoryEvidence=null}={}) {
  const evidence=assembleAuthoringEvidence({sourceFile,sourceRevision,brandPack,assetRecords,section,sceneKindLookup,repositoryEvidence});
  verifySourceIdentity(evidence,sourceFile);
  const compiled=compileHtmlAuthoring({html:sourceFile.text,filename:sourceFile.path,scope,sourceHash:sourceFile.sha256,
    fragment:!/<html\b/i.test(sourceFile.text)});
  if(compiled.schema!==AUTHORING_SCHEMA) throw new Error('authoring_schema_mismatch');
  const styling=compileScopedStyles({compiled,edits,expectedSourceHash:sourceFile.sha256});
  // A receipt records preservation and emitted CSS, never infers an actual browser render.
  return {schema:RECEIPT_SCHEMA,evidence,
    compilation:{schema:compiled.schema,scope,elementCount:compiled.bindings.length,
      bindings:compiled.bindings,annotations:'preview-only',originalPreserved:compiled.originalHtml===sourceFile.text},
    transformations:{css:styling.css,edits,changedOriginal:false},
    verification:{sourceHashMatched:true,sourcePreserved:compiled.originalHtml===sourceFile.text,
      bindingsValid:compiled.bindings.length>0,stylesCompiled:true,renderedBrowser:false,
      cmsPersisted:false,published:false},
    diagnostics:[...evidence.diagnostics,...compiled.diagnostics]};
}
