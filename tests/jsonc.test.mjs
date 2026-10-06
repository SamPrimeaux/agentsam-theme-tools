import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeJsonc, editJsonc, formatJsonc, locateJsonc } from '@inneranimalmedia/lang-jsonc';

const config = '{\n  // public comment\n  "title": "Generic theme",\n  "sections": [1, 2,],\n}\n';

test('JSONC accepts comments/trailing commas through an independent language API', () => {
  const parsed = analyzeJsonc(config);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.value)), {title:'Generic theme',sections:[1,2]});
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.schema, 'agentsam.lang-jsonc.v1');
});

test('JSONC supports strict profile and ranged diagnostics', () => {
  const strict = analyzeJsonc(config,{allowTrailingComma:false,disallowComments:true});
  assert.ok(strict.diagnostics.length>0);
  assert.ok(strict.diagnostics.every(d=>d.start>=0&&d.end>=d.start));
  assert.ok(analyzeJsonc('{"x": }').diagnostics.length>0);
});

test('JSONC patch preserves comments and unrelated source', () => {
  const updated = editJsonc(config,['title'],'Renamed');
  assert.match(updated.text,/public comment/);
  assert.match(updated.text,/Renamed/);
  assert.deepEqual(analyzeJsonc(updated.text).value.sections,[1,2]);
  const location=locateJsonc(updated.text,updated.text.indexOf('"title"'));
  assert.ok(Array.isArray(location.path));
});

test('JSONC refuses unsafe edits on malformed documents unless explicitly authorized', () => {
  assert.throws(()=>editJsonc('{"title":', ['title'],'x'),/parse_errors/);
  assert.throws(()=>editJsonc(config,{} ,'x'),/path/);
  assert.throws(()=>locateJsonc(config,-3),/offset/);
});

test('JSONC formatting keeps parseable semantics', () => {
  const result = formatJsonc(config);
  assert.deepEqual(analyzeJsonc(result.text).value,analyzeJsonc(config).value);
});
