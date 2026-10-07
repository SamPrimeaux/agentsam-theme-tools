//! Local-only Cloudflare Workers adapter. The portable rewrite logic lives in core.
//! This is not an authenticated production ingress or a CMS publication service.
use serde::Deserialize;
use serde_json::json;
use shared_core::{rewrite_html, RewriteRule, MAX_HTML_BYTES, MAX_RULES};
use worker::*;

const MAX_REQUEST_BYTES: usize = MAX_HTML_BYTES + 32_768;

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

fn local_only(req: &Request) -> bool {
    req.url()
        .ok()
        .and_then(|url| url.host_str().map(str::to_owned))
        .is_some_and(|host| host == "localhost" || host == "127.0.0.1")
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get("/health", |_req, _ctx| {
            Response::from_json(&json!({
                "ok": true,
                "schema": "agentsam.theme-html-rewriter.v1",
                "runtime": "rust-workers-wasm",
                "mode": "local-development",
                "core": "lol-html",
                "max_html_bytes": MAX_HTML_BYTES,
                "max_rules": MAX_RULES,
            }))
        })
        .post_async("/v1/rewrite", |mut req, _ctx| async move {
            if !local_only(&req) {
                return Response::error("local_rewriter_only", 403);
            }
            if let Some(header) = req.headers().get("content-length")? {
                if header.parse::<usize>().unwrap_or(MAX_REQUEST_BYTES + 1) > MAX_REQUEST_BYTES {
                    return Response::error("rewrite_request_too_large", 413);
                }
            }
            let body = req.text().await?;
            if body.len() > MAX_REQUEST_BYTES {
                return Response::error("rewrite_request_too_large", 413);
            }
            let parsed: RewriteRequest = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(_) => return Response::error("invalid_rewrite_request", 400),
            };
            let rules = parsed.rules.into_iter().map(|rule| RewriteRule {
                attribute: rule.attribute,
                from: rule.from,
                to: rule.to,
            }).collect::<Vec<_>>();
            match rewrite_html(&parsed.html, &rules) {
                Ok(result) => Response::from_json(&json!({
                    "schema": "agentsam.theme-html-rewriter.v1",
                    "html": result.html,
                    "changed": result.changed,
                })),
                Err(problem) => Response::error(&problem.to_string(), 400),
            }
        })
        .run(req, env)
        .await
}
