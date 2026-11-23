#!/usr/bin/env python3
"""Recover historical Markdown-escaped HTML uploaded as a paste. Does not execute scripts."""
import argparse
import html
import re
from pathlib import Path

MARKDOWN_ESCAPE = re.compile(r"\\([\\`*_{}\[\]()#+\-.!<>@:/])")

def recover(raw: str) -> str:
    """Decode HTML entities then common Markdown punctuation escapes."""
    out = html.unescape(raw)
    out = MARKDOWN_ESCAPE.sub(r"\1", out)
    if not out.lstrip().lower().startswith("<!doctype html>") or "</html>" not in out.lower():
        raise ValueError("Not a complete historical HTML document")
    return out

def main():
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    args = p.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(recover(args.input.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"RECOVERED {args.output}")

if __name__ == "__main__":
    main()
