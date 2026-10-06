/**
 * AgentSam-owned JSONC language interface.
 * Uses a standalone low-level JSONC parser; not Shopify lang-jsonc.
 * No CodeMirror/Monaco/React/Node/cloud dependencies.
 */
import {
  parseTree, getNodeValue, printParseErrorCode,
  modify, applyEdits, format, getLocation,
} from 'jsonc-parser';

export const JSONC_SCHEMA = 'agentsam.lang-jsonc.v1';

function assertSource(source) {
  if (typeof source !== 'string') throw new TypeError('JSONC source must be a string');
}

export function analyzeJsonc(source, { allowTrailingComma = true, disallowComments = false } = {}) {
  assertSource(source);
  const errors = [];
  const tree = parseTree(source, errors, { allowTrailingComma, disallowComments });
  return {
    schema: JSONC_SCHEMA,
    value: tree ? getNodeValue(tree) : undefined,
    tree,
    diagnostics: errors.map((error) => ({
      code: printParseErrorCode(error.error),
      severity: 'error',
      start: error.offset,
      end: error.offset + error.length,
    })),
  };
}

export function editJsonc(source, location, value, {
  formattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' },
  allowInvalidSource = false,
} = {}) {
  assertSource(source);
  if (!Array.isArray(location) || location.some((segment) => typeof segment !== 'string' && !Number.isInteger(segment))) {
    throw new TypeError('JSONC edit location must be a path of property names or indices');
  }
  const analyzed = analyzeJsonc(source);
  if (!allowInvalidSource && analyzed.diagnostics.length) throw new Error('jsonc_source_has_parse_errors');
  const edits = modify(source, location, value, { formattingOptions });
  return {
    schema: JSONC_SCHEMA,
    text: applyEdits(source, edits),
    edits,
    previousValue: analyzed.value,
  };
}

export function formatJsonc(source, {
  insertSpaces = true, tabSize = 2, eol = '\n',
} = {}) {
  assertSource(source);
  const edits = format(source, undefined, { insertSpaces, tabSize, eol });
  return { schema: JSONC_SCHEMA, text: applyEdits(source, edits), edits };
}

export function locateJsonc(source, offset) {
  assertSource(source);
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) throw new RangeError('offset out of range');
  const location = getLocation(source, offset);
  return {
    schema: JSONC_SCHEMA,
    path: location.path,
    isAtPropertyKey: location.isAtPropertyKey,
    previousNode: location.previousNode,
  };
}
