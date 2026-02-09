#!/usr/bin/env python3
"""
fetch_arxiv_sources_and_extract_figures.py

Usage:
  python fetch_arxiv_sources_and_extract_figures.py

What it does:
 - For each arXiv id in ARXIV_IDS, download the source tarball from https://arxiv.org/e-print/{id}
 - Extract files into a temp folder
 - Parse .tex files for figure environments and \includegraphics{...} occurrences
 - Copy referenced image files (and convert EPS if requested) into out/figures/<arxivid>/
 - Extract captions (content of \caption{...}) for each figure, strip common LaTeX references and citations
 - Write out out/figures.json describing the collected images and captions

Notes:
 - EPS->PNG conversion requires Ghostscript / PIL + appropriate delegate; if you don't have it, EPS files are copied as-is.
 - Be polite to arXiv; this script downloads only a few files but you should avoid hammering their servers.
"""

import os
import re
import io
import sys
import json
import tarfile
import shutil
import tempfile
import requests
from pathlib import Path
from html import unescape
from tqdm import tqdm
from PIL import Image

# === CONFIG ===
ARXIV_IDS = [
    "1904.09512",
    "1904.09951",
    "1904.09479",
    "1904.09931",
    "1904.09704",
    "1904.09725",
    "1904.09964"
]

OUT_DIR = Path("out")
FIG_DIR = OUT_DIR / "figures"
TIMEOUT = 60
DOWNLOAD_RETRIES = 3
CONVERT_EPS = True  # set True if you have Ghostscript/Pillow configured to render EPS -> PNG
CAPTION_WORDS = 10000

# === end config ===

session = requests.Session()
session.headers.update({"User-Agent": "USQCD-figures-extractor/1.0 (+you@your.org)"})

def ensure_dirs():
    OUT_DIR.mkdir(exist_ok=True)
    FIG_DIR.mkdir(parents=True, exist_ok=True)

def download_arxiv_source(arxiv_id, dest_path):
    url = f"https://arxiv.org/e-print/{arxiv_id}"
    last_err = None
    for attempt in range(1, DOWNLOAD_RETRIES+1):
        try:
            r = session.get(url, stream=True, timeout=TIMEOUT)
            r.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(1024*32):
                    if chunk:
                        f.write(chunk)
            return True
        except Exception as e:
            last_err = e
            print(f"Download attempt {attempt} failed for {arxiv_id}: {e}")
    print(f"Failed to download {arxiv_id} after {DOWNLOAD_RETRIES} attempts. Last error: {last_err}")
    return False

# regex helpers
RE_FIGURE_ENV = re.compile(r"\\begin\{figure.*?\}(.*?)\\end\{figure\}", re.DOTALL)
RE_INCLUDEGRAPHICS = re.compile(r"\\includegraphics(?:\[[^\]]*\])?\{([^\}]+)\}")
RE_CAPTION = re.compile(r"\\caption(?:\[[^\]]*\])?\{((?:[^{}]|\{[^}]*\})*?)\}", re.DOTALL)
RE_CITE = re.compile(r"\\cite[t]?\{[^\}]+\}")
RE_REF = re.compile(r"\\ref\{[^\}]+\}")
RE_LABEL = re.compile(r"\\label\{[^\}]+\}")

def sanitize_caption(tex):
    # remove LaTeX cites, refs, labels and simple LaTeX commands that commonly appear in captions
    t = tex
    t = RE_CITE.sub("", t)
    t = RE_REF.sub("", t)
    t = RE_LABEL.sub("", t)
    # remove math (simple $...$ and \(...\) and \[...\]) - replace with a space
    t = re.sub(r"\$[^\$]*\$", " ", t)
    t = re.sub(r"\\\([^\)]*\\\)", " ", t)
    t = re.sub(r"\\\[[^\]]*\\\]", " ", t)
    # strip simple commands like \emph{...} -> inner text, \textbf{..} -> inner
    t = re.sub(r"\\(?:emph|textbf|textit|textrm|texttt)\{([^\}]*)\}", r"\1", t)
    # remove other backslash commands (best-effort)
    t = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^\}]*\})?", "", t)
    # unescape common LaTeX sequences (\, -- -- etc)
    t = t.replace("~", " ")
    t = t.replace("--", "—")
    t = t.replace("``", '"').replace("''", '"')
    # collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t

def first_n_words(text, n=CAPTION_WORDS):
    words = text.split()
    if len(words) <= n:
        return " ".join(words)
    return " ".join(words[:n]) + "…"

def find_tex_files(root):
    texs = []
    for p in Path(root).rglob("*.tex"):
        texs.append(p)
    return texs

def resolve_graphics_filename(tex_dir, filename):
    """
    Given a tex directory and an includegraphics filename (which may omit extension),
    try common extensions and return Path to actual file if found.
    """
    candidate = Path(filename)
    # if path is absolute-ish, join with tex_dir
    candidates = []
    if candidate.suffix:
        candidates.append(Path(tex_dir) / candidate)
    else:
        exts = [".pdf", ".png", ".jpg", ".jpeg", ".eps", ".svg", ".ps"]
        for e in exts:
            candidates.append(Path(tex_dir) / (str(candidate) + e))
            # also try subdirs like figs/..., figure/...
            candidates.append(Path(tex_dir) / "figs" / (str(candidate) + e))
            candidates.append(Path(tex_dir) / "figures" / (str(candidate) + e))
    # also consider candidate relative to root of archive (some includegraphics refer to path relative to project root)
    candidates += [Path(candidate)]
    for c in candidates:
        if c.exists():
            return c
    # try case-insensitive search in tex_dir for a file with same stem
    stem = candidate.stem.lower()
    for p in Path(tex_dir).rglob("*"):
        if p.is_file() and p.stem.lower() == stem:
            return p
    return None

def convert_eps_to_png(src_path, dst_path):
    # attempt conversion using Pillow (requires Ghostscript support). If fails, copy as-is.
    try:
        img = Image.open(src_path)
        # convert to RGBA or RGB
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGBA", img.size, (255,255,255,0))
            bg.paste(img, mask=img.split()[3])
            out = bg.convert("RGBA")
        else:
            out = img.convert("RGB")
        out.save(dst_path, "PNG")
        return True
    except Exception as e:
        print(f"EPS->PNG conversion failed for {src_path}: {e}")
        return False

def extract_from_arxiv(arxiv_id):
    print(f"Processing {arxiv_id} ...")
    tempd = Path(tempfile.mkdtemp(prefix=f"arxiv_{arxiv_id}_"))
    tarball = tempd / f"{arxiv_id}.tar"
    try:
        ok = download_arxiv_source(arxiv_id, tarball)
        if not ok:
            print(f"Skipping {arxiv_id} due to download failure.")
            shutil.rmtree(tempd, ignore_errors=True)
            return None
        # some arXiv source tarballs are gzipped tar; tarfile.open auto-detects
        try:
            with tarfile.open(tarball, "r:*") as tf:
                tf.extractall(path=tempd / "src")
        except Exception as e:
            print(f"Failed to extract tarball for {arxiv_id}: {e}")
            shutil.rmtree(tempd, ignore_errors=True)
            return None

        srcroot = tempd / "src"
        tex_files = find_tex_files(srcroot)
        if not tex_files:
            # sometimes top-level .tex is in srcroot itself under a different name; try listing
            tex_files = list(srcroot.glob("*.tex"))
        if not tex_files:
            print(f"No .tex files found for {arxiv_id}; skipping.")
            shutil.rmtree(tempd, ignore_errors=True)
            return None

        # parse all tex files and collect figure entries
        paper_entries = []
        seen_figs = []
        for tex in tex_files:
            text = tex.read_text(encoding="utf-8", errors="ignore")
            # find figure environments
            for fig_m in RE_FIGURE_ENV.finditer(text):
                fig_block = fig_m.group(1)
                # find included graphics inside the figure block
                graphics = RE_INCLUDEGRAPHICS.findall(fig_block)
                captions = RE_CAPTION.findall(fig_block)
                caption_text = captions[0] if captions else ""
                caption_text = sanitize_caption(capton := caption_text) if caption_text else ""
                caption_text = sanitize_caption(caption_text)
                caption_excerpt = first_n_words(caption_text, CAPTION_WORDS) if caption_text else ""
                # for each referenced graphic produce an entry (some figures include multiple \includegraphics)
                for g in graphics:
                    g_clean = g.strip()
                    # some includegraphics use file base like figs/figure1; handle that
                    resolved = resolve_graphics_filename(tex.parent, g_clean)
                    if resolved is None:
                        # try relative to srcroot
                        resolved = resolve_graphics_filename(srcroot, g_clean)
                    if resolved is None:
                        print(f"Warning: referenced graphic '{g_clean}' not found for {arxiv_id} in {tex}")
                        continue
                    # avoid duplicates
                    if str(resolved.resolve()) in seen_figs:
                        continue
                    seen_figs.append(str(resolved.resolve()))
                    # copy (or convert) into output folder
                    out_paper_dir = FIG_DIR / arxiv_id
                    out_paper_dir.mkdir(parents=True, exist_ok=True)
                    dest_name = f"{resolved.stem}{resolved.suffix}"
                    dest_path = out_paper_dir / dest_name
                    try:
                        # if EPS and conversion desired, convert
                        if resolved.suffix.lower() in (".eps", ".ps") and CONVERT_EPS:
                            converted = out_paper_dir / (resolved.stem + ".png")
                            ok_conv = convert_eps_to_png(resolved, converted)
                            if ok_conv:
                                target_rel = converted.relative_to(OUT_DIR)
                                image_file_rel = str(target_rel)
                            else:
                                shutil.copy2(resolved, dest_path)
                                image_file_rel = str(dest_path.relative_to(OUT_DIR))
                        else:
                            shutil.copy2(resolved, dest_path)
                            image_file_rel = str(dest_path.relative_to(OUT_DIR))
                    except Exception as e:
                        print(f"Failed to copy graphic {resolved} -> {dest_path}: {e}")
                        continue

                    entry = {
                        "arxiv_id": arxiv_id,
                        "arxiv_link": f"https://arxiv.org/abs/{arxiv_id}",
                        "source_tex": str(tex.relative_to(srcroot)),
                        "image_file": image_file_rel.replace("\\", "/"),
                        "original_path": str(resolved),
                        "caption_full": caption_text,
                        "caption_excerpt": caption_excerpt
                    }
                    paper_entries.append(entry)

        # if no figure entries found, attempt heuristic: copy top-level images in srcroot
        if not paper_entries:
            for p in srcroot.rglob("*"):
                if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".pdf", ".eps"):
                    out_paper_dir = FIG_DIR / arxiv_id
                    out_paper_dir.mkdir(parents=True, exist_ok=True)
                    dest = out_paper_dir / p.name
                    try:
                        shutil.copy2(p, dest)
                        rel = str(dest.relative_to(OUT_DIR))
                        paper_entries.append({
                            "arxiv_id": arxiv_id,
                            "arxiv_link": f"https://arxiv.org/abs/{arxiv_id}",
                            "source_tex": None,
                            "image_file": rel.replace("\\", "/"),
                            "original_path": str(p),
                            "caption_full": "",
                            "caption_excerpt": ""
                        })
                    except Exception:
                        continue

        # cleanup temp extract (keep tar maybe) -- we remove tempdir
        shutil.rmtree(tempd, ignore_errors=True)
        return paper_entries

    except Exception as e:
        print(f"Unexpected error processing {arxiv_id}: {e}")
        shutil.rmtree(tempd, ignore_errors=True)
        return None

def main():
    ensure_dirs()
    all_entries = []
    for aid in ARXIV_IDS:
        res = extract_from_arxiv(aid)
        if res:
            # res is list of figure entries for this paper
            all_entries.extend(res)
    # write JSON
    out_json = OUT_DIR / "figures.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, indent=2, ensure_ascii=False)
    print(f"Done. Wrote {len(all_entries)} figure entries to {out_json}")
    print(f"Figure files are in {FIG_DIR} (relative paths written in JSON).")

if __name__ == "__main__":
    main()
    
