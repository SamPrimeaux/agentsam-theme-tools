//! Portable, customer-neutral HTML rewrite core.
//! This crate owns transformations, never CMS content or cloud deployment.

use lol_html::{element, rewrite_str, RewriteStrSettings};
use std::cell::Cell;
use std::collections::BTreeMap;
use std::fmt;
use std::rc::Rc;

pub const MAX_HTML_BYTES: usize = 1_048_576;
pub const MAX_RULES: usize = 100;
const ALLOWED_ATTRIBUTES: &[&str] = &["href", "src", "poster", "data-src"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewriteRule {
    pub attribute: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewriteResult {
    pub html: String,
    pub changed: usize,
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
            Self::LimitExceeded(label) => write!(f, "rewrite_limit_exceeded: {label}"),
            Self::Parse(message) => write!(f, "html_rewrite_failed: {message}"),
        }
    }
}

impl std::error::Error for RewriteError {}

/// Exact attribute replacement. The original design, event handlers, and unrelated
/// markup are left alone. No incoming HTML is executed, and no network is accessed.
pub fn rewrite_html(source: &str, rules: &[RewriteRule]) -> Result<RewriteResult, RewriteError> {
    if source.len() > MAX_HTML_BYTES {
        return Err(RewriteError::LimitExceeded("html_bytes"));
    }
    if rules.len() > MAX_RULES {
        return Err(RewriteError::LimitExceeded("rule_count"));
    }

    let mut mappings = BTreeMap::<String, BTreeMap<String, String>>::new();
    for rule in rules {
        if !ALLOWED_ATTRIBUTES.contains(&rule.attribute.as_str()) {
            return Err(RewriteError::InvalidRule(format!(
                "unsupported_attribute: {}",
                rule.attribute
            )));
        }
        if rule.from.is_empty() || rule.to.is_empty() {
            return Err(RewriteError::InvalidRule("empty_reference".into()));
        }
        if rule.from.len() > 8192 || rule.to.len() > 8192 {
            return Err(RewriteError::LimitExceeded("reference_bytes"));
        }
        if rule.to.bytes().any(|b| b == 0 || b == b'\r' || b == b'\n')
            || is_dangerous_url(&rule.to)
        {
            return Err(RewriteError::InvalidRule("unsafe_replacement_url".into()));
        }
        let values = mappings.entry(rule.attribute.clone()).or_default();
        if values.insert(rule.from.clone(), rule.to.clone()).is_some() {
            return Err(RewriteError::InvalidRule("duplicate_attribute_reference".into()));
        }
    }

    // Avoid needless parsing and guarantee byte-for-byte identity on no-op input.
    if mappings.is_empty() {
        return Ok(RewriteResult { html: source.to_owned(), changed: 0 });
    }

    let changed = Rc::new(Cell::new(0usize));
    let count = Rc::clone(&changed);
    let settings = RewriteStrSettings::new()
        .append_element_content_handler(element!("*", move |el| {
            for (name, replacements) in &mappings {
                if let Some(current) = el.get_attribute(name) {
                    if let Some(next) = replacements.get(&current) {
                        el.set_attribute(name, next)?;
                        count.set(count.get() + 1);
                    }
                }
            }
            Ok(())
        }));

    let html = rewrite_str(source, settings)
        .map_err(|e| RewriteError::Parse(e.to_string()))?;
    Ok(RewriteResult { html, changed: changed.get() })
}

fn is_dangerous_url(url: &str) -> bool {
    // Never emit dangerous URL schemes through a generic resource-rewrite operation.
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
        RewriteRule {attribute: attribute.into(), from: from.into(), to: to.into()}
    }

    #[test]
    fn rewrites_exact_asset_reference_and_preserves_markup() {
        let source = r#"<!doctype html><html><head><style>.hero{color:red}</style></head><body><section data-cms-section="hero"><img src="assets/old.svg" alt="Demo"></section></body></html>"#;
        let result = rewrite_html(source, &[rule("src", "assets/old.svg", "assets/new.svg")]).unwrap();
        assert_eq!(result.changed, 1);
        assert_eq!(result.html, source.replace("assets/old.svg", "assets/new.svg"));
    }

    #[test]
    fn exact_matches_only_and_preserves_noop_byte_identity() {
        let source = r#"<img src='old.png'><img src='other.png'>"#;
        assert_eq!(rewrite_html(source, &[]).unwrap().html, source);
        let changed = rewrite_html(source, &[rule("src","old.png","new.png")]).unwrap();
        assert_eq!(changed.changed, 1);
        assert!(changed.html.contains("other.png"));
    }

    #[test]
    fn supports_href_src_poster_and_data_src() {
        let source = r#"<a href="/old">Link</a><img src="/old" data-src="/old"><video poster="/old"></video>"#;
        let rules = ["href", "src", "poster", "data-src"].iter()
            .map(|attr| rule(attr, "/old", "/new")).collect::<Vec<_>>();
        let changed = rewrite_html(source, &rules).unwrap();
        assert_eq!(changed.changed, 4);
        assert!(!changed.html.contains("=\"/old\""));
    }

    #[test]
    fn rejects_invalid_and_duplicate_rules() {
        assert!(matches!(rewrite_html("x", &[rule("onclick","a","b")]), Err(RewriteError::InvalidRule(_))));
        assert!(rewrite_html("x", &[rule("href","a","javascript:alert(1)")]).is_err());
        assert!(rewrite_html("x", &[rule("href","x","y"),rule("href","x","z")]).is_err());
    }

    #[test]
    fn rejects_excessive_input_size_and_rule_count() {
        assert!(matches!(rewrite_html(&"x".repeat(MAX_HTML_BYTES+1), &[]), Err(RewriteError::LimitExceeded(_))));
        assert!(matches!(rewrite_html("", &vec![rule("src","a","b");MAX_RULES+1]), Err(RewriteError::LimitExceeded(_))));
    }

    #[test]
    fn escapes_unsafe_attribute_characters_on_output() {
        let result = rewrite_html(r#"<img src="old">"#,&[rule("src","old","new\"quoted")]).unwrap();
        assert_eq!(result.changed, 1);
        assert!(!result.html.contains("src=\"new\"quoted\""));
        assert!(result.html.contains("&quot;"));
    }
}
