#!/usr/bin/env python3
"""Fetch the project's OneDrive Word source documents and mirror them as markdown.

The documents are shared with anonymous "anyone with the link" view access, so they
download headlessly: the first request to a share link sets an anonymous FedAuth
cookie, and the same link with ?download=1 then returns the .docx. The result is
converted to markdown under docs/source-docs/ so Claude has the current text without
opening OneDrive.

Run: python scripts/sync-source-docs.py
"""
from __future__ import annotations

import http.cookiejar
import io
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from itertools import groupby
from pathlib import Path

try:
    import docx
except ImportError:
    sys.exit("python-docx is required. Install it with: pip install python-docx")

from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "docs" / "source-docs"

SHARE_BASE = "https://liveutm-my.sharepoint.com/:w:/g/personal/muhammadarifhakimi_live_utm_my"
SOURCES = [
    {
        "slug": "thesis",
        "title": "Thesis - AI Integrated School Management and Communication Portal using RAG for SRIAAWP",
        "url": f"{SHARE_BASE}/IQDsoDnmehN3S4w61kHTaURHAdHYZBRdPdSWHGGyoZPfXeI",
    },
    {
        "slug": "srs",
        "title": "Software Requirements Specification (SRS)",
        "url": f"{SHARE_BASE}/IQAJsMHDTJqmTZSd8BWnQF6_Aak81OVYQq29Uipwu_HMWk8",
    },
]

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}


def download_docx(share_url):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.open(urllib.request.Request(share_url, headers=BROWSER_HEADERS), timeout=60).read()
    response = opener.open(urllib.request.Request(f"{share_url}?download=1", headers=BROWSER_HEADERS), timeout=60)
    data = response.read()
    if data[:4] != b"PK\x03\x04":
        ctype = response.headers.get("Content-Type")
        raise RuntimeError(f"expected a .docx but received {ctype}; the share link may have changed or access was revoked")
    return data


def iter_blocks(document):
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def wrap_emphasis(text, bold, italic):
    if bold and italic:
        return f"***{text}***"
    if bold:
        return f"**{text}**"
    if italic:
        return f"*{text}*"
    return text


def runs_to_text(paragraph):
    runs = [run for run in paragraph.runs if run.text]
    parts = []
    for (bold, italic), group in groupby(runs, key=lambda run: (bool(run.bold), bool(run.italic))):
        parts.append(wrap_emphasis("".join(run.text for run in group), bold, italic))
    return "".join(parts).strip()


def heading_level(style_name):
    if not style_name:
        return 0
    if style_name == "Title":
        return 1
    if not style_name.lower().startswith("heading"):
        return 0
    digits = "".join(ch for ch in style_name if ch.isdigit())
    return min(int(digits), 6) if digits else 2


def paragraph_to_md(paragraph):
    text = runs_to_text(paragraph)
    if not text:
        return ""
    style = paragraph.style.name if paragraph.style else ""
    level = heading_level(style)
    if level:
        return f"{'#' * level} {text}"
    if style.startswith("List Bullet"):
        return f"- {text}"
    if style.startswith("List Number"):
        return f"1. {text}"
    return text


def table_to_md(table):
    rows = [[cell.text.strip().replace("\n", " ") for cell in row.cells] for row in table.rows]
    if not rows:
        return ""
    width = len(rows[0])
    header = "| " + " | ".join(rows[0]) + " |"
    divider = "| " + " | ".join(["---"] * width) + " |"
    body = ["| " + " | ".join(row) + " |" for row in rows[1:]]
    return "\n".join([header, divider, *body])


def docx_to_markdown(data):
    document = docx.Document(io.BytesIO(data))
    blocks = []
    for block in iter_blocks(document):
        md = paragraph_to_md(block) if isinstance(block, Paragraph) else table_to_md(block)
        if md:
            blocks.append(md)
    return "\n\n".join(blocks)


def main():
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    for source in SOURCES:
        try:
            data = download_docx(source["url"])
        except (urllib.error.URLError, RuntimeError) as error:
            print(f"FAILED {source['slug']}: {error}")
            continue
        body = docx_to_markdown(data)
        header = (
            f"<!-- Generated by scripts/sync-source-docs.py from {source['url']} "
            f"Do not edit by hand; re-run the script to refresh. -->\n"
            f"# {source['title']}\n\n"
            f"_Source: UTM OneDrive (anonymous view link). Last synced {stamp}._\n\n"
        )
        out_path = SOURCE_DIR / f"{source['slug']}.md"
        out_path.write_text(header + body + "\n", encoding="utf-8")
        print(f"wrote {out_path.relative_to(ROOT)} ({len(body)} chars)")


if __name__ == "__main__":
    main()
