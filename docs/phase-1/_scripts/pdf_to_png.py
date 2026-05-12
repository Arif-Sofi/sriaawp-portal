"""Render every page of the two source PDFs to PNG images.

Run from the project root:
    python docs/phase-1/_scripts/pdf_to_png.py

Outputs:
    docs/phase-1/source/PP/page-01.png ...
    docs/phase-1/source/PS/page-01.png ...
"""

from __future__ import annotations

import sys
from pathlib import Path

import fitz

DPI = 200
ZOOM = DPI / 72

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DOCS_DIR = PROJECT_ROOT / "docs"
OUT_ROOT = DOCS_DIR / "phase-1" / "source"

JOBS = [
    ("PP", DOCS_DIR / "PP_MUHAMMAD ARIF HAKIMI BIN MOHD SOFI_A23MJ5008.pdf"),
    ("PS", DOCS_DIR / "PS_MUHAMMAD ARIF HAKIMI BIN MOHD SOFI_A23MJ5008(updated).pdf"),
]


def render(pdf_path: Path, out_dir: Path) -> int:
    if not pdf_path.exists():
        print(f"MISSING: {pdf_path}", file=sys.stderr)
        return 0
    out_dir.mkdir(parents=True, exist_ok=True)
    matrix = fitz.Matrix(ZOOM, ZOOM)
    with fitz.open(pdf_path) as doc:
        for page_index, page in enumerate(doc, start=1):
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            out_path = out_dir / f"page-{page_index:02d}.png"
            pixmap.save(out_path)
            print(f"  wrote {out_path.relative_to(PROJECT_ROOT)}")
        return doc.page_count


def main() -> int:
    for tag, pdf in JOBS:
        print(f"[{tag}] {pdf.name}")
        pages = render(pdf, OUT_ROOT / tag)
        print(f"[{tag}] {pages} pages -> {OUT_ROOT / tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
