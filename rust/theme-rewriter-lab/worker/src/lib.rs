//! Local-only Cloudflare Workers adapter for the AgentSam Rust theme machine.
//! The portable capabilities live in the core crate; this adapter only exposes
//! bounded HTTP contracts for local verification.

use serde::Deserialize;
use serde_json::json;
use shared_core::{
    harvest_html, inspect_html, rewrite_html, verify_html, RewriteRule, MAX_HTML_BYTES, MAX_RULES,
};
use worker::*;

const MAX_SINGLE_REQUEST_BYTES: usize = MAX_HTML_BYTES + 128 * 1024;
const MAX_VERIFY_REQUEST_BYTES: usize = (MAX_HTML_BYTES * 2) + 256 * 1024;

#[derive(Deserialize)]
struct RewriteRuleRequest {
    attribute: String,
    from: String,
    to: String,
}

#[derive(Deserialize)]
struct RewriteRequest {
    html: String,
    rules: Vec<RewriteRuleRequest>,
}

#[derive(Deserialize)]
struct HtmlRequest {
    html: String,
    source_url: Option<String>,
}

#[derive(Deserialize)]
struct VerifyRequest {
    before: String,
    after: String,
}

fn local_only(req: &Request) -> bool {
    req.url()
        .ok()
        .and_then(|url| url.host_str().map(str::to_owned))
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1")
}

async fn read_limited_body(req: &mut Request, max_bytes: usize) -> Result<std::result::Result<String, Response>> {
    if let Some(header) = req.headers().get("content-length")? {
        if header.parse::<usize>().unwrap_or(max_bytes + 1) > max_bytes {
            return Ok(Err(Response::error("theme_machine_request_too_large", 413)?));
        }
    }

    let body = req.text().await?;
    if body.len() > max_bytes {
        return Ok(Err(Response::error("theme_machine_request_too_large", 413)?));
    }
    Ok(Ok(body))
}

fn require_local(req: &Request) -> Result<Option<Response>> {
    if local_only(req) {
        Ok(None)
    } else {
        Ok(Some(Response::error("local_theme_machine_only", 403)?))
    }
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get("/health", |_req, _ctx| {
            Response::from_json(&json!({
                "ok": true,
                "schema": "agentsam.theme-machine.v1",
                "runtime": "rust-workers-wasm",
                "mode": "local-development",
                "core": "lol-html",
                "capabilities": ["harvest", "inspect", "rewrite", "verify"],
                "max_html_bytes": MAX_HTML_BYTES,
                "max_rules": MAX_RULES,
                "buffering": "request-body-bounded",
            }))
        })
        .post_async("/v1/harvest", |mut req, _ctx| async move {
            if let Some(response) = require_local(&req)? {
                return Ok(response);
            }
            let body = match read_limited_body(&mut req, MAX_SINGLE_REQUEST_BYTES).await? {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let parsed: HtmlRequest = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(_) => return Response::error("invalid_harvest_request", 400),
            };
            match harvest_html(&parsed.html, parsed.source_url.as_deref()) {
                Ok(result) => Response::from_json(&result),
                Err(problem) => Response::error(&problem.to_string(), 400),
            }
        })
        .post_async("/v1/inspect", |mut req, _ctx| async move {
            if let Some(response) = require_local(&req)? {
                return Ok(response);
            }
            let body = match read_limited_body(&mut req, MAX_SINGLE_REQUEST_BYTES).await? {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let parsed: HtmlRequest = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(_) => return Response::error("invalid_inspect_request", 400),
            };
            match inspect_html(&parsed.html, parsed.source_url.as_deref()) {
                Ok(result) => Response::from_json(&result),
                Err(problem) => Response::error(&problem.to_string(), 400),
            }
        })
        .post_async("/v1/rewrite", |mut req, _ctx| async move {
            if let Some(response) = require_local(&req)? {
                return Ok(response);
            }
            let body = match read_limited_body(&mut req, MAX_SINGLE_REQUEST_BYTES).await? {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let parsed: RewriteRequest = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(_) => return Response::error("invalid_rewrite_request", 400),
            };
            let rules = parsed
                .rules
                .into_iter()
                .map(|rule| RewriteRule {
                    attribute: rule.attribute,
                    from: rule.from,
                    to: rule.to,
                })
                .collect::<Vec<_>>();
            match rewrite_html(&parsed.html, &rules) {
                Ok(result) => Response::from_json(&result),
                Err(problem) => Response::error(&problem.to_string(), 400),
            }
        })
        .post_async("/v1/verify", |mut req, _ctx| async move {
            if let Some(response) = require_local(&req)? {
                return Ok(response);
            }
            let body = match read_limited_body(&mut req, MAX_VERIFY_REQUEST_BYTES).await? {
                Ok(body) => body,
                Err(response) => return Ok(response),
            };
            let parsed: VerifyRequest = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(_) => return Response::error("invalid_verify_request", 400),
            };
            match verify_html(&parsed.before, &parsed.after) {
                Ok(result) => Response::from_json(&result),
                Err(problem) => Response::error(&problem.to_string(), 400),
            }
        })
        .run(req, env)
        .await
}
