#!/usr/bin/env node
/**
 * Mandatory cross-repository AgentSam/Theme Tools acceptance gate.
 * Set AGENTSAM_SDK_ROOT to a checked-out SDK. No tenant-specific data,
 * second registry, publication, or filesystem mutations.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as compiler from '@inneranimalmedia/theme-authoring-compiler';

const root = process.env.AGENTSAM_SDK_ROOT;
if (!root) throw new Error('AGENTSAM_SDK_ROOT_required_for_sam_bridge_gate');
const sdkRequire = createRequire(path.join(path.resolve(root), 'package.json'));
const resolved = sdkRequire.resolve('@inneranimalmedia/agentsam-sdk/sam');
const { createSamOS, AgentSamClient } = await import(pathToFileURL(resolved).href);
const source = '<section data-cms-section="hero"><h1 data-cms="headline">Original</h1></section>';
const hash = createHash('sha256').update(source).digest('hex');
const writes = [];
let authorized = true;
const repository = {
  getSource: async () => ({ source, revision: 1, contentHash: hash, filename: 'hero.html', fragment: true }),
  saveDraftStyles: async request => {
    assert.equal(request.principal.accountId, 'test-account');
    assert.equal(request.expectedCmsRevision, 1);
    writes.push('styles');
    return { ok: true, revisionId: 'cms-revision-2' };
  },
  saveSourceDraft: async request => {
    assert.equal(request.principal.accountId, 'test-account');
    writes.push('source');
    return { ok: true, revisionId: 'cms-revision-3', artifactId: 'fixture-v2' };
  },
};
const os = createSamOS({ core: false, authoring: {
  compiler, repository,
  resolveTrustedContext: async () => ({ accountId: 'test-account', actorId: 'editor' }),
  authorize: async () => authorized,
} });
const names = os.list().map(op => op.id);
assert.deepEqual(names, [
  'sam.authoring.inspect', 'sam.authoring.previewStyles',
  'sam.authoring.proposeSourcePatch', 'sam.authoring.saveDraftStyles',
  'sam.authoring.saveSourceDraft',
]);
const sam = new AgentSamClient({ os });
const base = { artifactId: 'fixture', scope: 'hero', expectedRevision: 1, expectedHash: hash };
const inspected = await sam.invoke('sam.authoring.inspect', { artifactId: 'fixture', scope: 'hero' });
assert.equal(inspected.ok, true, JSON.stringify(inspected.error));
const title = inspected.data.bindings.find(b => b.authored.cmsField === 'headline');
assert.ok(title, 'real compiler must provide an authored binding');
const edits = [{ nodeId: title.id, property: 'fontSize', value: '3rem' }];
const preview = await sam.invoke('sam.authoring.previewStyles', { ...base, edits });
assert.equal(preview.ok, true, JSON.stringify(preview.error));
assert.match(preview.data.css, /font-size:3rem !important/);
const saved = await sam.invoke('sam.authoring.saveDraftStyles', {
  ...base, pageId: 'home', sectionId: 'hero', expectedCmsRevision: 1, edits,
});
assert.equal(saved.ok, true, JSON.stringify(saved.error));
assert.equal(saved.data.published, false);

authorized = false;
assert.equal((await sam.invoke('sam.authoring.inspect', base)).ok, false, 'authorization required');
authorized = true;
assert.equal((await sam.invoke('sam.authoring.previewStyles', { ...base, expectedRevision: 2, edits })).ok, false, 'revision check required');
assert.equal((await sam.invoke('sam.authoring.previewStyles', {
  ...base, edits: [{ nodeId: title.id, property: 'color', value: 'red;body{display:none}' }],
})).ok, false, 'unsafe CSS must fail');
const start = source.indexOf('Original');
const patches = [{ start, end: start + 8, before: 'Original', after: 'Revised' }];
const proposed = await sam.invoke('sam.authoring.proposeSourcePatch', { ...base, patches });
assert.equal(proposed.ok, true, JSON.stringify(proposed.error));
assert.match(proposed.data.proposedSource, /Revised/);
assert.equal((await sam.invoke('sam.authoring.saveSourceDraft', { ...base, patches })).ok, false, 'write must require approval');
const approved = await sam.invoke('sam.authoring.saveSourceDraft', { ...base, patches, approved: true });
assert.equal(approved.ok, true, JSON.stringify(approved.error));
assert.equal(approved.data.published, false);
assert.deepEqual(writes, ['styles', 'source']);
assert.match(source, /Original/, 'original source remains immutable');
console.log(JSON.stringify({
  schema: 'agentsam.theme-tools.sam-bridge-receipt.v1',
  ok: true, sdk: '@inneranimalmedia/agentsam-sdk/sam',
  compiler: '@inneranimalmedia/theme-authoring-compiler',
  operations: names, realCompiler: true,
  authorizationEnforced: true, staleRevisionRejected: true,
  unsafeCssRejected: true, sourceApprovalRequired: true,
  originalPreserved: true, published: false,
}, null, 2));
