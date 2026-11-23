//! Portable AgentSam Rust theme-machine core.
//!
//! This crate performs bounded HTML harvest, inspection, exact resource rewrites,
//! and structural verification. It owns no CMS content, deployment, customer state,
//! credentials, or network acquisition.

use lol_html::{doc_text, doctype, element, rewrite_str, text, RewriteStrSettings};
use serde::Serialize;
use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::rc::Rc;

pub const HARVEST_SCHEMA: &str = "agentsam.theme-harvest.v1";
pub const INSPECT_SCHEMA: &str = "agentsam.theme-inspect.v1";
pub const REWRITE_SCHEMA: &str = "agentsam.theme-html-rewriter.v1";
pub const VERIFY_SCHEMA: &str = "agentsam.theme-verify.v1";

pub const MAX_HTML_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_RULES: usize = 500;
pub const MAX_FINDINGS: usize = 4_096;
const MAX_REFERENCE_BYTES: usize = 8_192;
const MAX_METADATA_BYTES: usize = 8_192;
const FNV_OFFSET: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;

const ALLOWED_REWRITE_ATTRIBUTES: &[&str] = &["href", "src", "poster", "data-src"];
const STRUCTURAL_ATTRS: &[&str] = &[
    "id",
    "class",
    "role",
    "data-cms-section",
    "data-section",
    "data-section-id",
    "data-section-type",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewriteRule {
    pub attribute: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RewriteResult {
    pub schema: &'static str,
    pub html: String,
    pub changed: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HarvestResource {
    pub kind: String,
    pub tag: String,
    pub attribute: String,
    pub value: String,
    pub rel: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SectionCandidate {
    pub tag: String,
    pub id: Option<String>,
    pub classes: Vec<String>,
    pub marker: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Default)]
pub struct HarvestMeta {
    pub title: Option<String>,
    pub description: Option<String>,
    pub canonical: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HarvestResult {
    pub schema: &'static str,
    pub source_url: Option<String>,
    pub has_doctype: bool,
    pub element_count: usize,
    pub resource_count: usize,
    pub external_resource_count: usize,
    pub image_count: usize,
    pub images_without_alt: usize,
    pub inline_script_count: usize,
    pub inline_style_count: usize,
    pub duplicate_ids: Vec<String>,
    pub resources: Vec<HarvestResource>,
    pub section_candidates: Vec<SectionCandidate>,
    pub meta: HarvestMeta,
    pub structure_fingerprint: String,
    pub text_fingerprint: String,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InspectionDiagnostic {
    pub code: String,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InspectionResult {
    pub schema: &'static str,
    pub harvest: HarvestResult,
    pub diagnostics: Vec<InspectionDiagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct VerificationResult {
    pub schema: &'static str,
    pub scope: &'static str,
    pub verified: bool,
    pub element_structure_match: bool,
    pub text_match: bool,
    pub section_shape_match: bool,
    pub resource_shape_match: bool,
    pub metadata_match: bool,
    pub changed_resources: usize,
    pub diagnostics: Vec<InspectionDiagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RewriteError {
    InvalidRule(String),
    LimitExceeded(&'static str),
    Parse(String),
}

impl fmt::Display for RewriteError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRule(message) => write!(f, "invalid_rewrite_rule: {message}"),
            Self::LimitExceeded(label) => write!(f, "theme_machine_limit_exceeded: {label}"),
            Self::Parse(message) => write!(f, "html_processing_failed: {message}"),
        }
    }
}

impl std::error::Error for RewriteError {}

#[derive(Debug)]
struct HarvestState {
    has_doctype: bool,
    element_count: usize,
    resources: Vec<HarvestResource>,
    sections: Vec<SectionCandidate>,
    resource_keys: BTreeSet<String>,
    section_keys: BTreeSet<String>,
    ids: BTreeMap<String, usize>,
    meta: HarvestMeta,
    image_count: usize,
    images_without_alt: usize,
    inline_script_count: usize,
    inline_style_count: usize,
    structure_hash: u64,
    text_hash: u64,
    truncated: bool,
}

impl Default for HarvestState {
    fn default() -> Self {
        Self {
            has_doctype: false,
            element_count: 0,
            resources: Vec::new(),
            sections: Vec::new(),
            resource_keys: BTreeSet::new(),
            section_keys: BTreeSet::new(),
            ids: BTreeMap::new(),
            meta: HarvestMeta::default(),
            image_count: 0,
            images_without_alt: 0,
            inline_script_count: 0,
            inline_style_count: 0,
            structure_hash: FNV_OFFSET,
            text_hash: FNV_OFFSET,
            truncated: false,
        }
    }
}

pub fn harvest_html(source: &str, source_url: Option<&str>) -> Result<HarvestResult, RewriteError> {
    enforce_html_limit(source)?;

    let state = Rc::new(RefCell::new(HarvestState::default()));
    let element_state = Rc::clone(&state);
    let title_state = Rc::clone(&state);
    let text_state = Rc::clone(&state);
    let doctype_state = Rc::clone(&state);

    let settings = RewriteStrSettings::new()
        .append_element_content_handler(element!("*", move |el| {
            inspect_element(&mut element_state.borrow_mut(), el);
            Ok(())
        }))
        .append_element_content_handler(text!("title", move |chunk| {
            if !chunk.as_str().is_empty() {
                let mut state = title_state.borrow_mut();
                let title = state.meta.title.get_or_insert_with(String::new);
                if title.len() < MAX_METADATA_BYTES {
                    title.push_str(chunk.as_str());
                }
            }
            Ok(())
        }))
        .append_document_content_handler(doc_text!(move |chunk| {
            let mut state = text_state.borrow_mut();
            fnv_update(&mut state.text_hash, chunk.as_str().as_bytes());
            if chunk.last_in_text_node() {
                fnv_update(&mut state.text_hash, &[0]);
            }
            Ok(())
        }))
        .append_document_content_handler(doctype!(move |_doctype| {
            doctype_state.borrow_mut().has_doctype = true;
            Ok(())
        }));

    rewrite_str(source, settings).map_err(|e| RewriteError::Parse(e.to_string()))?;

    let mut state = Rc::try_unwrap(state)
        .map_err(|_| RewriteError::Parse("harvest_state_still_borrowed".into()))?
        .into_inner();

    state.meta.title = normalized_optional(state.meta.title.take());

    let duplicate_ids = state
        .ids
        .iter()
        .filter_map(|(id, count)| (*count > 1).then_some(id.clone()))
        .collect::<Vec<_>>();

    let external_resource_count = state
        .resources
        .iter()
        .filter(|resource| {
            let value = resource.value.trim_start().to_ascii_lowercase();
            value.starts_with("http://") || value.starts_with("https://")
        })
        .count();

    Ok(HarvestResult {
        schema: HARVEST_SCHEMA,
        source_url: source_url.map(str::to_owned),
        has_doctype: state.has_doctype,
        element_count: state.element_count,
        resource_count: state.resources.len(),
        external_resource_count,
        image_count: state.image_count,
        images_without_alt: state.images_without_alt,
        inline_script_count: state.inline_script_count,
        inline_style_count: state.inline_style_count,
        duplicate_ids,
        resources: state.resources,
        section_candidates: state.sections,
        meta: state.meta,
        structure_fingerprint: format!("{:016x}", state.structure_hash),
        text_fingerprint: format!("{:016x}", state.text_hash),
        truncated: state.truncated,
    })
}

pub fn inspect_html(source: &str, source_url: Option<&str>) -> Result<InspectionResult, RewriteError> {
    let harvest = harvest_html(source, source_url)?;
    let mut diagnostics = Vec::new();

    if !harvest.has_doctype {
        diagnostics.push(diagnostic(
            "missing_doctype",
            "warning",
            "Document has no doctype declaration.",
        ));
    }
    if harvest.meta.title.as_deref().unwrap_or("").trim().is_empty() {
        diagnostics.push(diagnostic(
            "missing_title",
            "warning",
            "Document has no non-empty title.",
        ));
    }
    if harvest
        .meta
        .description
        .as_deref()
        .unwrap_or("")
        .trim()
        .is_empty()
    {
        diagnostics.push(diagnostic(
            "missing_meta_description",
            "info",
            "Document has no meta description.",
        ));
    }
    if !harvest.duplicate_ids.is_empty() {
        diagnostics.push(diagnostic(
            "duplicate_ids",
            "warning",
            &format!(
                "Duplicate element IDs detected: {}",
                harvest
                    .duplicate_ids
                    .iter()
                    .take(10)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        ));
    }
    if harvest.images_without_alt > 0 {
        diagnostics.push(diagnostic(
            "images_without_alt",
            "info",
            &format!(
                "{} image element(s) do not declare an alt attribute.",
                harvest.images_without_alt
            ),
        ));
    }
    if harvest.inline_script_count > 0 {
        diagnostics.push(diagnostic(
            "inline_script_present",
            "info",
            &format!(
                "{} inline script element(s) require deeper JavaScript analysis; this Rust pass does not execute them.",
                harvest.inline_script_count
            ),
        ));
    }
    if harvest.inline_style_count > 0 {
        diagnostics.push(diagnostic(
            "inline_style_present",
            "info",
            &format!(
                "{} style element(s) require CSS semantic analysis outside this streaming pass.",
                harvest.inline_style_count
            ),
        ));
    }
    if harvest.truncated {
        diagnostics.push(diagnostic(
            "harvest_findings_truncated",
            "warning",
            "The bounded harvesting pass reached its finding limit; the result is incomplete.",
        ));
    }

    Ok(InspectionResult {
        schema: INSPECT_SCHEMA,
        harvest,
        diagnostics,
    })
}

pub fn verify_html(before: &str, after: &str) -> Result<VerificationResult, RewriteError> {
    let before = harvest_html(before, None)?;
    let after = harvest_html(after, None)?;

    let element_structure_match =
        before.element_count == after.element_count
            && before.structure_fingerprint == after.structure_fingerprint
            && before.has_doctype == after.has_doctype
            && before.duplicate_ids == after.duplicate_ids;

    let text_match = before.text_fingerprint == after.text_fingerprint;
    let section_shape_match = before.section_candidates == after.section_candidates;
    let metadata_match = before.meta == after.meta;

    let resource_shape_match = before.resources.len() == after.resources.len()
        && before.resources.iter().zip(after.resources.iter()).all(|(left, right)| {
            left.kind == right.kind
                && left.tag == right.tag
                && left.attribute == right.attribute
                && left.rel == right.rel
        });

    let changed_resources = before
        .resources
        .iter()
        .zip(after.resources.iter())
        .filter(|(left, right)| left.value != right.value)
        .count();

    let verified = element_structure_match
        && text_match
        && section_shape_match
        && resource_shape_match
        && metadata_match;

    let mut diagnostics = Vec::new();
    if !element_structure_match {
        diagnostics.push(diagnostic(
            "element_structure_changed",
            "error",
            "Element count or structural marker fingerprint changed.",
        ));
    }
    if !text_match {
        diagnostics.push(diagnostic(
            "text_content_changed",
            "error",
            "Text-node fingerprint changed.",
        ));
    }
    if !section_shape_match {
        diagnostics.push(diagnostic(
            "section_shape_changed",
            "error",
            "Semantic or declared section candidates changed.",
        ));
    }
    if !resource_shape_match {
        diagnostics.push(diagnostic(
            "resource_shape_changed",
            "error",
            "Resource reference count/order/type changed; this is not an exact reference-only rewrite.",
        ));
    }
    if !metadata_match {
        diagnostics.push(diagnostic(
            "metadata_changed",
            "error",
            "Title, description, canonical URL, or language metadata changed.",
        ));
    }

    Ok(VerificationResult {
        schema: VERIFY_SCHEMA,
        scope: "structural-html-only",
        verified,
        element_structure_match,
        text_match,
        section_shape_match,
        resource_shape_match,
        metadata_match,
        changed_resources,
        diagnostics,
    })
}

/// Exact attribute replacement. The original design, event handlers, and unrelated
/// markup are left alone. No incoming HTML is executed and no network is accessed.
pub fn rewrite_html(source: &str, rules: &[RewriteRule]) -> Result<RewriteResult, RewriteError> {
    enforce_html_limit(source)?;
    if rules.len() > MAX_RULES {
        return Err(RewriteError::LimitExceeded("rule_count"));
    }

    let mut mappings = BTreeMap::<String, BTreeMap<String, String>>::new();
    for rule in rules {
        if !ALLOWED_REWRITE_ATTRIBUTES.contains(&rule.attribute.as_str()) {
            return Err(RewriteError::InvalidRule(format!(
                "unsupported_attribute: {}",
                rule.attribute
            )));
        }
        if rule.from.is_empty() || rule.to.is_empty() {
            return Err(RewriteError::InvalidRule("empty_reference".into()));
        }
        if rule.from.len() > MAX_REFERENCE_BYTES || rule.to.len() > MAX_REFERENCE_BYTES {
            return Err(RewriteError::LimitExceeded("reference_bytes"));
        }
        if rule.to.bytes().any(|b| b == 0 || b == b'\r' || b == b'\n')
            || is_dangerous_url(&rule.to)
        {
            return Err(RewriteError::InvalidRule("unsafe_replacement_url".into()));
        }
        let values = mappings.entry(rule.attribute.clone()).or_default();
        if values.insert(rule.from.clone(), rule.to.clone()).is_some() {
            return Err(RewriteError::InvalidRule(
                "duplicate_attribute_reference".into(),
            ));
        }
    }

    if mappings.is_empty() {
        return Ok(RewriteResult {
            schema: REWRITE_SCHEMA,
            html: source.to_owned(),
            changed: 0,
        });
    }

    let changed = Rc::new(Cell::new(0usize));
    let count = Rc::clone(&changed);
    let settings = RewriteStrSettings::new().append_element_content_handler(element!(
        "*",
        move |el| {
            for (name, replacements) in &mappings {
                if let Some(current) = el.get_attribute(name) {
                    if let Some(next) = replacements.get(&current) {
                        el.set_attribute(name, next)?;
                        count.set(count.get() + 1);
                    }
                }
            }
            Ok(())
        }
    ));

    let html =
        rewrite_str(source, settings).map_err(|e| RewriteError::Parse(e.to_string()))?;
    Ok(RewriteResult {
        schema: REWRITE_SCHEMA,
        html,
        changed: changed.get(),
    })
}

fn inspect_element<H: lol_html::HandlerTypes>(
    state: &mut HarvestState,
    el: &mut lol_html::html_content::Element<'_, '_, H>,
) {
    state.element_count += 1;
    let tag = el.tag_name();

    fnv_update(&mut state.structure_hash, tag.as_bytes());
    for attr in STRUCTURAL_ATTRS {
        fnv_update(&mut state.structure_hash, attr.as_bytes());
        if let Some(value) = el.get_attribute(attr) {
            fnv_update(&mut state.structure_hash, value.as_bytes());
        }
        fnv_update(&mut state.structure_hash, &[0]);
    }

    if tag == "html" {
        state.meta.lang = normalized_optional(el.get_attribute("lang"));
    }

    if let Some(id) = normalized_optional(el.get_attribute("id")) {
        *state.ids.entry(id).or_insert(0) += 1;
    }

    if tag == "meta" {
        let key = el
            .get_attribute("name")
            .or_else(|| el.get_attribute("property"))
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if let Some(content) = normalized_optional(el.get_attribute("content")) {
            if key == "description" {
                state.meta.description = Some(bounded(&content, MAX_METADATA_BYTES));
            }
            if matches!(
                key.as_str(),
                "og:image" | "og:image:url" | "twitter:image" | "twitter:image:src"
            ) {
                collect_resource(state, "meta-image", &tag, "content", &content, Some(&key));
            }
        }
    }

    if tag == "link" {
        let rel = el
            .get_attribute("rel")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if let Some(href) = normalized_optional(el.get_attribute("href")) {
            if rel.split_whitespace().any(|part| part == "canonical") {
                state.meta.canonical = Some(bounded(&href, MAX_METADATA_BYTES));
            }
            let kind = if rel.split_whitespace().any(|part| part == "stylesheet") {
                "stylesheet"
            } else if rel.split_whitespace().any(|part| part == "preload") {
                "preload"
            } else if rel.contains("icon") {
                "icon"
            } else {
                "link-resource"
            };
            let rel_value = normalized_optional(Some(rel));
            collect_resource(state, kind, &tag, "href", &href, rel_value.as_deref());
        }
    }

    match tag.as_str() {
        "a" => {
            if let Some(value) = el.get_attribute("href") {
                collect_resource(state, "navigation", &tag, "href", &value, None);
            }
        }
        "script" => {
            if let Some(value) = el.get_attribute("src") {
                collect_resource(state, "script", &tag, "src", &value, None);
            } else {
                state.inline_script_count += 1;
            }
        }
        "style" => state.inline_style_count += 1,
        "img" => {
            state.image_count += 1;
            if !el.has_attribute("alt") {
                state.images_without_alt += 1;
            }
            for attr in ["src", "data-src", "data-lazy-src", "data-original"] {
                if let Some(value) = el.get_attribute(attr) {
                    collect_resource(state, "image", &tag, attr, &value, None);
                }
            }
            for attr in ["srcset", "data-srcset"] {
                if let Some(value) = el.get_attribute(attr) {
                    collect_srcset(state, &tag, attr, &value);
                }
            }
        }
        "source" => {
            if let Some(value) = el.get_attribute("src") {
                collect_resource(state, "media-source", &tag, "src", &value, None);
            }
            for attr in ["srcset", "data-srcset"] {
                if let Some(value) = el.get_attribute(attr) {
                    collect_srcset(state, &tag, attr, &value);
                }
            }
        }
        "video" => {
            if let Some(value) = el.get_attribute("src") {
                collect_resource(state, "video", &tag, "src", &value, None);
            }
            if let Some(value) = el.get_attribute("poster") {
                collect_resource(state, "poster", &tag, "poster", &value, None);
            }
        }
        "audio" => {
            if let Some(value) = el.get_attribute("src") {
                collect_resource(state, "audio", &tag, "src", &value, None);
            }
        }
        "iframe" => {
            if let Some(value) = el.get_attribute("src") {
                collect_resource(state, "frame", &tag, "src", &value, None);
            }
        }
        "object" => {
            if let Some(value) = el.get_attribute("data") {
                collect_resource(state, "object", &tag, "data", &value, None);
            }
        }
        "form" => {
            if let Some(value) = el.get_attribute("action") {
                collect_resource(state, "form-action", &tag, "action", &value, None);
            }
        }
        _ => {}
    }

    if let Some(style) = el.get_attribute("style") {
        for value in extract_style_urls(&style) {
            collect_resource(state, "inline-style-url", &tag, "style", &value, None);
        }
    }

    for attr in ["data-bg", "data-background-image"] {
        if let Some(value) = el.get_attribute(attr) {
            collect_resource(state, "image", &tag, attr, &value, None);
        }
    }

    let marker = [
        "data-cms-section",
        "data-section",
        "data-section-id",
        "data-section-type",
    ]
    .iter()
    .find_map(|attr| normalized_optional(el.get_attribute(attr)));

    let semantic = matches!(
        tag.as_str(),
        "section" | "header" | "footer" | "main" | "nav" | "article" | "aside"
    );

    if semantic || marker.is_some() {
        collect_section(state, &tag, el, marker);
    }
}

fn collect_section<H: lol_html::HandlerTypes>(
    state: &mut HarvestState,
    tag: &str,
    el: &lol_html::html_content::Element<'_, '_, H>,
    marker: Option<String>,
) {
    if state.sections.len() >= MAX_FINDINGS {
        state.truncated = true;
        return;
    }

    let id = normalized_optional(el.get_attribute("id"));
    let classes = el
        .get_attribute("class")
        .unwrap_or_default()
        .split_whitespace()
        .take(32)
        .map(|part| bounded(part, 128))
        .collect::<Vec<_>>();

    let key = format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{}",
        tag,
        id.as_deref().unwrap_or(""),
        classes.join(" "),
        marker.as_deref().unwrap_or("")
    );
    if !state.section_keys.insert(key) {
        return;
    }

    state.sections.push(SectionCandidate {
        tag: tag.to_owned(),
        id,
        classes,
        marker,
    });
}

fn collect_srcset(state: &mut HarvestState, tag: &str, attribute: &str, value: &str) {
    for candidate in value.split(',') {
        let url = candidate.split_whitespace().next().unwrap_or("").trim();
        if !url.is_empty() {
            collect_resource(
                state,
                "image-candidate",
                tag,
                attribute,
                url,
                None,
            );
        }
    }
}

fn collect_resource(
    state: &mut HarvestState,
    kind: &str,
    tag: &str,
    attribute: &str,
    value: &str,
    rel: Option<&str>,
) {
    let value = value.trim();
    if value.is_empty() {
        return;
    }
    if state.resources.len() >= MAX_FINDINGS {
        state.truncated = true;
        return;
    }

    let value = bounded(value, MAX_REFERENCE_BYTES);
    let key = format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}",
        kind,
        tag,
        attribute,
        value,
        rel.unwrap_or("")
    );
    if !state.resource_keys.insert(key) {
        return;
    }

    state.resources.push(HarvestResource {
        kind: kind.to_owned(),
        tag: tag.to_owned(),
        attribute: attribute.to_owned(),
        value,
        rel: rel.map(str::to_owned),
    });
}

fn extract_style_urls(value: &str) -> Vec<String> {
    let lower = value.to_ascii_lowercase();
    let mut cursor = 0usize;
    let mut output = Vec::new();

    while let Some(found) = lower[cursor..].find("url(") {
        let start = cursor + found + 4;
        let Some(end_rel) = value[start..].find(')') else {
            break;
        };
        let end = start + end_rel;
        let candidate = value[start..end]
            .trim()
            .trim_matches(|ch| ch == '\'' || ch == '"')
            .trim();
        if !candidate.is_empty() {
            output.push(candidate.to_owned());
        }
        cursor = end + 1;
        if cursor >= value.len() {
            break;
        }
    }

    output
}

fn diagnostic(code: &str, severity: &str, message: &str) -> InspectionDiagnostic {
    InspectionDiagnostic {
        code: code.to_owned(),
        severity: severity.to_owned(),
        message: message.to_owned(),
    }
}

fn normalized_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_owned())
    })
}

fn bounded(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn enforce_html_limit(source: &str) -> Result<(), RewriteError> {
    if source.len() > MAX_HTML_BYTES {
        return Err(RewriteError::LimitExceeded("html_bytes"));
    }
    Ok(())
}

fn fnv_update(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash ^= u64::from(*byte);
        *hash = hash.wrapping_mul(FNV_PRIME);
    }
}

fn is_dangerous_url(url: &str) -> bool {
    let lowered = url.trim_start().to_ascii_lowercase();
    lowered.starts_with("javascript:")
        || lowered.starts_with("vbscript:")
        || lowered.starts_with("data:")
        || lowered.starts_with("file:")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(attribute: &str, from: &str, to: &str) -> RewriteRule {
        RewriteRule {
            attribute: attribute.into(),
            from: from.into(),
            to: to.into(),
        }
    }

    #[test]
    fn rewrites_exact_asset_reference_and_preserves_markup() {
        let source = r#"<!doctype html><html><head><style>.hero{color:red}</style></head><body><section data-cms-section="hero"><img src="assets/old.svg" alt="Demo"></section></body></html>"#;
        let result =
            rewrite_html(source, &[rule("src", "assets/old.svg", "assets/new.svg")]).unwrap();
        assert_eq!(result.changed, 1);
        assert_eq!(result.schema, REWRITE_SCHEMA);
        assert_eq!(result.html, source.replace("assets/old.svg", "assets/new.svg"));
    }

    #[test]
    fn exact_matches_only_and_preserves_noop_byte_identity() {
        let source = r#"<img src='old.png'><img src='other.png'>"#;
        assert_eq!(rewrite_html(source, &[]).unwrap().html, source);
        let changed = rewrite_html(source, &[rule("src", "old.png", "new.png")]).unwrap();
        assert_eq!(changed.changed, 1);
        assert!(changed.html.contains("other.png"));
    }

    #[test]
    fn supports_href_src_poster_and_data_src() {
        let source =
            r#"<a href="/old">Link</a><img src="/old" data-src="/old"><video poster="/old"></video>"#;
        let rules = ["href", "src", "poster", "data-src"]
            .iter()
            .map(|attr| rule(attr, "/old", "/new"))
            .collect::<Vec<_>>();
        let changed = rewrite_html(source, &rules).unwrap();
        assert_eq!(changed.changed, 4);
        assert!(!changed.html.contains("=\"/old\""));
    }

    #[test]
    fn rejects_invalid_and_duplicate_rules() {
        assert!(matches!(
            rewrite_html("x", &[rule("onclick", "a", "b")]),
            Err(RewriteError::InvalidRule(_))
        ));
        assert!(rewrite_html("x", &[rule("href", "a", "javascript:alert(1)")]).is_err());
        assert!(rewrite_html(
            "x",
            &[rule("href", "x", "y"), rule("href", "x", "z")]
        )
        .is_err());
    }

    #[test]
    fn rejects_excessive_input_size_and_rule_count() {
        assert!(matches!(
            rewrite_html(&"x".repeat(MAX_HTML_BYTES + 1), &[]),
            Err(RewriteError::LimitExceeded(_))
        ));
        assert!(matches!(
            rewrite_html("", &vec![rule("src", "a", "b"); MAX_RULES + 1]),
            Err(RewriteError::LimitExceeded(_))
        ));
    }

    #[test]
    fn escapes_unsafe_attribute_characters_on_output() {
        let result =
            rewrite_html(r#"<img src="old">"#, &[rule("src", "old", "new\"quoted")]).unwrap();
        assert_eq!(result.changed, 1);
        assert!(!result.html.contains("src=\"new\"quoted\""));
        assert!(result.html.contains("&quot;"));
    }

    #[test]
    fn harvests_resources_sections_and_metadata_without_execution() {
        let source = r#"<!doctype html><html lang="en"><head><title>Demo</title><meta name="description" content="A demo"><link rel="stylesheet" href="/site.css"><link rel="canonical" href="https://example.test/"></head><body><nav id="top"><a href="/shop">Shop</a></nav><section class="hero wide" data-cms-section="hero"><img src="/hero.jpg" srcset="/hero-2x.jpg 2x" alt="Hero" style="background-image:url('/texture.png')"></section><script src="/app.js"></script></body></html>"#;
        let result = harvest_html(source, Some("https://example.test/")).unwrap();

        assert!(result.has_doctype);
        assert_eq!(result.meta.title.as_deref(), Some("Demo"));
        assert_eq!(result.meta.description.as_deref(), Some("A demo"));
        assert_eq!(result.meta.lang.as_deref(), Some("en"));
        assert!(result
            .resources
            .iter()
            .any(|item| item.kind == "stylesheet" && item.value == "/site.css"));
        assert!(result
            .resources
            .iter()
            .any(|item| item.value == "/hero-2x.jpg"));
        assert!(result
            .resources
            .iter()
            .any(|item| item.value == "/texture.png"));
        assert!(result
            .section_candidates
            .iter()
            .any(|section| section.marker.as_deref() == Some("hero")));
    }

    #[test]
    fn inspection_reports_truthful_static_gaps() {
        let source =
            r#"<html><body><img src="/x.png"><script>window.demo=1</script><style>.x{color:red}</style><div id="dup"></div><div id="dup"></div></body></html>"#;
        let result = inspect_html(source, None).unwrap();
        let codes = result
            .diagnostics
            .iter()
            .map(|item| item.code.as_str())
            .collect::<BTreeSet<_>>();

        assert!(codes.contains("missing_doctype"));
        assert!(codes.contains("missing_title"));
        assert!(codes.contains("duplicate_ids"));
        assert!(codes.contains("images_without_alt"));
        assert!(codes.contains("inline_script_present"));
        assert!(codes.contains("inline_style_present"));
    }

    #[test]
    fn verification_accepts_exact_resource_rewrite() {
        let before = r#"<!doctype html><html><head><title>Demo</title></head><body><section data-cms-section="hero"><img src="/old.png" alt="Demo"><a href="/old">Open</a></section></body></html>"#;
        let after = rewrite_html(
            before,
            &[
                rule("src", "/old.png", "/new.png"),
                rule("href", "/old", "/new"),
            ],
        )
        .unwrap()
        .html;
        let result = verify_html(before, &after).unwrap();

        assert!(result.verified);
        assert_eq!(result.changed_resources, 2);
        assert!(result.text_match);
        assert!(result.section_shape_match);
    }

    #[test]
    fn verification_rejects_content_or_structure_drift() {
        let before =
            r#"<!doctype html><html><body><section data-cms-section="hero">Hello</section></body></html>"#;
        let after =
            r#"<!doctype html><html><body><main><section data-cms-section="hero">Changed</section></main></body></html>"#;
        let result = verify_html(before, after).unwrap();

        assert!(!result.verified);
        assert!(!result.element_structure_match);
        assert!(!result.text_match);
    }
}
