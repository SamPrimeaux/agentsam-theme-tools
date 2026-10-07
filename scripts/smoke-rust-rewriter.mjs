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
assert.equal(h.schema, 'agentsam.theme-html-rewriter.v1');
assert.equal(h.core, 'lol-html');

const html = '<!doctype html><html><body><section data-cms-section="hero"><img src="assets/old.png" alt="Test"><a href="/old">Link</a></section></body></html>';
const replacements = [
  { attribute: 'src', from: 'assets/old.png', to: 'assets/new.png' },
  { attribute: 'href', from: '/old', to: '/new' },
];
const request = async (payload) => fetch(root + '/v1/rewrite', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
const response = await request({ html, rules: replacements });
assert.equal(response.status, 200);
const result = await response.json();
assert.equal(result.schema, 'agentsam.theme-html-rewriter.v1');
assert.equal(result.changed, 2);
const patched = rewriteAssetReferences(html, {
  'assets/old.png': 'assets/new.png',
  '/old': '/new',
});
assert.equal(patched.changed, result.changed);
assert.deepEqual(
  analyzeHtml(result.html).sections.map(s => ({ kind: s.kind, name: s.name })),
  analyzeHtml(patched.html).sections.map(s => ({ kind: s.kind, name: s.name })),
);
assert.ok(result.html.includes('src="assets/new.png"'));
assert.ok(result.html.includes('href="/new"'));
assert.ok(!result.html.includes('assets/old.png'));

const blocked = await request({
  html: '<a href="old">open</a>',
  rules: [{ attribute: 'href', from: 'old', to: 'javascript:alert(1)' }],
});
assert.equal(blocked.status, 400, 'dangerous replacements must be rejected');

console.log('Rust Worker HTTP smoke: PASS');
console.log('Rust / JavaScript HTML semantics: PASS (section + resource mapping fixture)');
console.log('Unsafe resource validation: PASS');
