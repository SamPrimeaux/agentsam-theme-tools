#!/usr/bin/env node
import assert from 'node:assert/strict';
import { analyzeHtml } from '@inneranimalmedia/theme-syntax-html';
import { rewriteAssetReferences } from '@inneranimalmedia/theme-html-rewriter';

// Intentionally local-only: this test must not reach a deployed customer application.
const endpoint = new URL(process.argv[2] || 'http://127.0.0.1:8787');
if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(endpoint.hostname)) {
  throw new Error('local_worker_endpoint_only');
}
const root = endpoint.href.replace(/\/$/, '');

const health = await fetch(root + '/health');
assert.equal(health.status, 200, 'local Wrangler health endpoint');
const h = await health.json();
assert.equal(h.schema, 'agentsam.theme-machine.v1');
assert.equal(h.core, 'lol-html');
assert.deepEqual(h.capabilities, ['harvest', 'inspect', 'rewrite', 'verify']);

const html = '<!doctype html><html lang="en"><head><title>Demo</title><meta name="description" content="Theme fixture"><link rel="stylesheet" href="/site.css"></head><body><section data-cms-section="hero"><img src="assets/old.png" srcset="assets/old@2x.png 2x" alt="Test"><a href="/old">Link</a></section><script src="/app.js"></script></body></html>';

const post = async (pathname, payload) =>
  fetch(root + pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

const harvestResponse = await post('/v1/harvest', {
  html,
  source_url: 'https://example.test/',
});
assert.equal(harvestResponse.status, 200);
const harvest = await harvestResponse.json();
assert.equal(harvest.schema, 'agentsam.theme-harvest.v1');
assert.equal(harvest.meta.title, 'Demo');
assert.equal(harvest.meta.lang, 'en');
assert.ok(harvest.resources.some((item) => item.kind === 'stylesheet' && item.value === '/site.css'));
assert.ok(harvest.resources.some((item) => item.value === 'assets/old@2x.png'));
assert.ok(harvest.section_candidates.some((item) => item.marker === 'hero'));

const inspectResponse = await post('/v1/inspect', {
  html: '<html><body><img src="/x.png"><script>window.demo=1</script></body></html>',
});
assert.equal(inspectResponse.status, 200);
const inspected = await inspectResponse.json();
assert.equal(inspected.schema, 'agentsam.theme-inspect.v1');
const diagnosticCodes = new Set(inspected.diagnostics.map((item) => item.code));
assert.ok(diagnosticCodes.has('missing_doctype'));
assert.ok(diagnosticCodes.has('missing_title'));
assert.ok(diagnosticCodes.has('images_without_alt'));
assert.ok(diagnosticCodes.has('inline_script_present'));

const replacements = [
  { attribute: 'src', from: 'assets/old.png', to: 'assets/new.png' },
  { attribute: 'href', from: '/old', to: '/new' },
];
const rewriteResponse = await post('/v1/rewrite', { html, rules: replacements });
assert.equal(rewriteResponse.status, 200);
const rewritten = await rewriteResponse.json();
assert.equal(rewritten.schema, 'agentsam.theme-html-rewriter.v1');
assert.equal(rewritten.changed, 2);

const patched = rewriteAssetReferences(html, {
  'assets/old.png': 'assets/new.png',
  '/old': '/new',
});
assert.equal(patched.changed, rewritten.changed);
assert.deepEqual(
  analyzeHtml(rewritten.html).sections.map((section) => ({ kind: section.kind, name: section.name })),
  analyzeHtml(patched.html).sections.map((section) => ({ kind: section.kind, name: section.name })),
);
assert.ok(rewritten.html.includes('src="assets/new.png"'));
assert.ok(rewritten.html.includes('href="/new"'));
assert.ok(!rewritten.html.includes('src="assets/old.png"'));

const verifyResponse = await post('/v1/verify', {
  before: html,
  after: rewritten.html,
});
assert.equal(verifyResponse.status, 200);
const verified = await verifyResponse.json();
assert.equal(verified.schema, 'agentsam.theme-verify.v1');
assert.equal(verified.scope, 'structural-html-only');
assert.equal(verified.verified, true);
assert.equal(verified.changed_resources, 2);

const driftResponse = await post('/v1/verify', {
  before: '<section data-cms-section="hero">Hello</section>',
  after: '<main><section data-cms-section="hero">Changed</section></main>',
});
assert.equal(driftResponse.status, 200);
const drift = await driftResponse.json();
assert.equal(drift.verified, false);
assert.equal(drift.element_structure_match, false);
assert.equal(drift.text_match, false);

const blocked = await post('/v1/rewrite', {
  html: '<a href="old">open</a>',
  rules: [{ attribute: 'href', from: 'old', to: 'javascript:alert(1)' }],
});
assert.equal(blocked.status, 400, 'dangerous replacements must be rejected');

console.log('AgentSam Rust theme machine HTTP smoke: PASS');
console.log('Harvest / inspect / rewrite / verify contract: PASS');
console.log('Rust / JavaScript rewrite semantics: PASS');
console.log('Unsafe resource validation: PASS');
