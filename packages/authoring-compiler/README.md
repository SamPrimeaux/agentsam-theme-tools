# Universal Authoring Compiler (initial HTML/CSS lane)

Source-preserving AST -> stable editor annotation -> typed visual control bindings -> validated, scoped, responsive CSS edits. The original HTML is returned unchanged; only the **preview derivative** contains `data-sam-node` markers. Controls arise from rendered element types and source geometry, not CMS field names. Click mapping is via `inspectRenderedElement`. Removing an override restores authored styling.

This is a first, executable HTML/CSS lane. JavaScript, Liquid, React behavior and computed-style browser verification require separately validated AST/parser adapters and runtime tests; this compiler does **not** claim arbitrary behavior is editable with sliders. Integrators must attach immutable artifacts, revision persistence, auth and publication using their existing CMS adapter. Do not ship editor annotations or unreviewed executable patches to live pages.
