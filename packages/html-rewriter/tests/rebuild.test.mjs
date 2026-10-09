import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewriteAssetReferences, rewriteResponseWithCloudflare,
  validateRewriteUrl, planHtmlRebuild, replaceSectionContent } from '../src/index.js';

const sample = '<!doctype html><html><head><title>Site</title><style>.hero{color:red}</style></head>' +
  '<body><section data-cms-section="hero" id="hero" onclick="openPanel()">' +
  '<h2>Header</h2><p>Copy</p><img alt="scene" src=old.png srcset="small.webp 1x, large.webp 2x">' +
  '<script>window.donor=true</script></section></body></html>';

test('rebuild plan extracts exact source ranges, proposed settings and hazards', () => {
  const plan = planHtmlRebuild(sample, { filename: 'donor.html', includeSource:true });
  assert.equal(plan.schema, 'agentsam.html-rebuild-plan.v1');
  assert.equal(plan.readyForCms, false);
  assert.equal(plan.verifiedPreview, false);
  const hero = plan.candidates.find(x => x.marker === 'hero');
  assert.ok(hero, 'declared region missing');
  assert.equal(hero.sourceHtml, sample.slice(hero.sourceRange.start, hero.sourceRange.end));
  assert.equal(hero.proposedFields.headings[0].value, 'Header');
  assert.equal(hero.proposedFields.paragraphs[0].value, 'Copy');
  assert.deepEqual(hero.proposedFields.media[0], {role:'media.image',src:'old.png',alt:'scene'});
  assert.ok(hero.hazards.includes('inline-handlers-needs-review'));
  assert.ok(hero.hazards.includes('script-needs-isolation'));
  assert.ok(hero.dependencies.some(x=>x.value==='old.png'));
  assert.ok(plan.coverage.notAnalyzed.includes('javascript-behavior'));
  assert.equal(plan.evidence.styleElements, 1);
});
test('duplicate IDs are diagnostic evidence; never implicitly approved', () => {
  const p=planHtmlRebuild('<section id="same"></section><section id="same"></section>');
  assert.deepEqual(p.evidence.duplicateIds, ['same']);
  assert.ok(p.candidates.every(x=>x.state==='requires-normalization'));
  assert.equal(p.approved,false);
});
test('source edit retains attribute case/spacing and unquoted attr becomes safe quoted', () => {
  const raw="<IMG  SRC = 'old.png' data-src=old.png><p>Keep all other source exactly</p>";
  const result=rewriteAssetReferences(raw,{'old.png':'new.png'});
  assert.equal(result.changed,2);
  assert.equal(result.html,'<IMG  SRC = &#39;new.png&#39; data-src="new.png"><p>Keep all other source exactly</p>'.replace('&#39;new.png&#39;',"'new.png'"));
  assert.deepEqual(rewriteAssetReferences(raw,{}).html,raw);
});
test('URL policy rejects scripting, data and file schemes; protects Cloudflare path too', () => {
  for(const scheme of ['javascript:alert(1)','  JaVaScRiPt:alert(1)','vbscript:x','data:text/html,x','file:///tmp/a','https://example.test/\nX:y','']) {
    assert.throws(()=>validateRewriteUrl(scheme),/unsafe_replacement_url/);
    assert.throws(()=>rewriteAssetReferences(sample,{'old.png':scheme}),/unsafe_replacement_url/);
  }
  class Stub {on(){return this;}transform(response){return response;}}
  assert.throws(()=>rewriteResponseWithCloudflare({}, {'old.png':'javascript:alert(1)'}, Stub),/unsafe_replacement_url/);
  assert.doesNotThrow(()=>validateRewriteUrl('/assets/approved/logo.svg'));
});
test('srcset opt-in rewrites simple descriptors without touching non-target candidate', () => {
  const out=rewriteAssetReferences(sample,{'small.webp':'sm.avif'}, {includeSrcset:true});
  assert.equal(out.changed,1);
  assert.ok(out.html.includes('srcset="sm.avif 1x, large.webp 2x"'));
  assert.ok(out.html.includes('src=old.png'));
  assert.equal(rewriteAssetReferences(sample,{'small.webp':'sm.avif'}).changed,0);
});
test('complex data-srcset is not silently rewritten or corrupted', () => {
  const src='<img srcset="data:image/svg+xml,%3Csvg%3E 1x, legacy.png 2x">';
  const out=rewriteAssetReferences(src,{'legacy.png':'replacement.png'},{includeSrcset:true});
  assert.equal(out.changed,0);
  assert.equal(out.html,src);
  assert.ok(out.diagnostics.some(x=>x.code==='complex_srcset_unhandled'));
});
test('source section mutation needs a unique trusted marker', () => {
  assert.throws(()=>replaceSectionContent(sample,{marker:'hero',html:'<p>x</p>'}),/requires_explicit_trust/);
  assert.throws(()=>replaceSectionContent('<section data-cms-section="same"></section><section data-cms-section="same"></section>',
    {marker:'same',html:'X',trusted:true}),/must_be_unique/);
});
