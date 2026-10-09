import assert from 'node:assert/strict';
import {test} from 'node:test';
import {planHtmlRebuild,compileStaticSection,renderStaticSection,scopeStaticCss} from '../src/index.js';

const css = '.card { color: #123; } .card:hover, .card:focus-visible { border-color: blue; } @media(max-width:600px){.card{padding:1rem;}}';
const page = '<!doctype html><html><head><style>'+css+'</style></head><body>' +
  '<section data-cms-section="capabilities" class="card" id="one">' +
  '<h2>Real reusable section</h2><p>Independent content</p>' +
  '<img src="/assets/photo.webp" alt="Original photo">' +
  '<a href="/work" aria-labelledby="one">Read</a></section></body></html>';
const options={marker:'capabilities',sourceId:'fixture/section.html',assets:['/assets/photo.webp']};

test('compiles source-backed static section, semantically typed settings, responsive scoped CSS',()=>{
  const r=compileStaticSection(page,options);
  assert.equal(r.schema,'agentsam.static-section.v1');
  assert.equal(r.state,'compiled-static-candidate');
  assert.equal(r.cmsInstalled,false);
  assert.ok(r.settingsSchema.some(x=>x.type==='media'));
  assert.ok(r.settingsSchema.some(x=>x.type==='textarea'));
  assert.match(r.css,/data-agent-section-instance="__UID__"/);
  assert.match(r.css,/@media/);
  assert.ok(!r.css.includes('html body'));
  const out=renderStaticSection(r,{uid:'instanceA'});
  assert.match(out.html,/instanceA-one/);
  assert.match(out.html,/aria-labelledby="instanceA-one"/);
  assert.match(out.css,/instanceA/);
  assert.deepEqual(out.sectionInstance.layout,{width:'full',bleed:'background'});
});
test('independent instance settings, escaped copy, source never mutated',()=>{
  const initial=page;
  const c=compileStaticSection(page,options);
  const a=renderStaticSection(c,{uid:'a',settings:{heading_1:'Custom <Title>',text_1:'Different & clean',link_1:'/services'}});
  const b=renderStaticSection(c,{uid:'b'});
  assert.match(a.html,/Custom &lt;Title&gt;/);
  assert.match(a.html,/Different &amp; clean/);
  assert.match(a.html,/href="\/services"/);
  assert.doesNotMatch(b.html,/Custom/);
  assert.match(b.html,/Original photo/);
  assert.match(b.html,/b-one/);
  assert.equal(page,initial);
  assert.throws(()=>renderStaticSection(c,{uid:'a',settings:{link_1:'javascript:alert(1)'}}),/unsafe_link_url/);
  assert.throws(()=>renderStaticSection(c,{uid:'a',settings:{unknown:'x'}}),/unknown_setting/);
});
test('the same HTML region can be selected by source range, not only CMS markup',()=>{
  const unmarked=page.replace(' data-cms-section="capabilities"','');
  const plan=planHtmlRebuild(unmarked,{filename:'fixture.html'});
  const candidate=plan.candidates.find(x=>x.tag==='section');
  assert.ok(candidate);
  const output=compileStaticSection(unmarked,{start:candidate.sourceRange.start,sourceId:'fixture.html',assets:['/assets/photo.webp']});
  assert.equal(output.state,'compiled-static-candidate');
  assert.match(renderStaticSection(output,{uid:'any'}).html,/Real reusable/);
});
test('fail closed for donor scripts, event handlers and unapproved media',()=>{
  const bad=page.replace('</body>','<script>window.done=true</script></body>');
  assert.throws(()=>compileStaticSection(bad,options),/unexamined_javascript/);
  const unsafe=page.replace('class="card"','class="card" onclick="run()"');
  assert.throws(()=>compileStaticSection(unsafe,options),/inline_event_handler/);
  assert.throws(()=>compileStaticSection(page,{marker:'capabilities'}),/unresolved_asset/);
  const inspect=compileStaticSection(bad,{...options,strict:false});
  assert.equal(inspect.state,'blocked');
  assert.throws(()=>renderStaticSection(inspect,{uid:'wrong'}),/blocked_static_section/);
});
test('global/unhandled CSS fails closed, nested media remains isolated',()=>{
  assert.throws(()=>scopeStaticCss('body{margin:0;}'),/css_global_selector/);
  assert.throws(()=>scopeStaticCss('@import "external.css";'),/unsupported_css_statement/);
  assert.throws(()=>scopeStaticCss('@keyframes spin{from{opacity:0}to{opacity:1}}'),/css_at_rule_requires_review/);
  assert.throws(()=>scopeStaticCss('.card { .nested {color:red} }'),/css_nested_rule_unverified/);
  const scoped=scopeStaticCss('@supports(display:grid){.grid:hover,.grid > a{display:grid;}}');
  assert.match(scoped,/@supports/);
  assert.equal((scoped.match(/data-agent-section-instance/g)||[]).length,2);
});
test('missing exact section selection and unsafe instances fail',()=>{
  assert.throws(()=>compileStaticSection(page,{...options,marker:'unknown'}),/section_selection_must_be_unique/);
  const c=compileStaticSection(page,options);
  assert.throws(()=>renderStaticSection(c,{uid:'not valid /'}),/invalid_instance_uid/);
});

test('archived Custom Liquid region hoists nested CSS and preserves emphasized text editability',()=>{
  const donor = '<div class="donor-story" role="region">' +
    '<style>.donor-story{color:navy}@media(max-width:700px){.donor-story{padding:8px}}</style>' +
    '<h2>Original title</h2><p>Before <strong>important</strong> after.</p></div>';
  const plan=planHtmlRebuild(donor,{filename:'custom-liquid.html'});
  const region=plan.candidates.find(x=>x.tag==='div'&&x.type==='section');
  assert.ok(region);
  const component=compileStaticSection(donor,{start:region.sourceRange.start,sourceId:'custom-liquid.html'});
  assert.equal(component.blockers.length,0);
  assert.equal(component.settingsSchema.length,4);
  assert.ok(component.settingsSchema.some(x=>x.id==='heading_1'));
  assert.ok(component.settingsSchema.some(x=>x.id==='text_2'));
  const output=renderStaticSection(component,{uid:'chapterB',
    settings:{heading_1:'Chapter revised',text_2:'significant'}});
  assert.ok(!output.html.includes('<style'));
  assert.match(output.html,/Chapter revised/);
  assert.match(output.html,/<strong>significant<\/strong>/);
  assert.match(output.css,/@media/);
  assert.match(output.css,/data-agent-section-instance="chapterB"/);
});
