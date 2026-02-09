#!/usr/bin/env python3
"""
convert_figures_pdf_to_png.py

- Converts PDF figure files found under ROOT/figures/... to PNG thumbnails (first page).
- Updates figures.json to point to the new PNG files in place of the PDF (if conversion succeeded).
- Use carefully; keep a backup of figures.json.
"""

import sys
from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image
import json
from tqdm import tqdm

# CONFIG — change to match your project layout
ROOT = Path("./static/data")  # adjust to "static/data" if your site uses that folder
FIGURES_SUBDIR = "figures"
JSON_PATH = ROOT / "figures.json"
MAX_WIDTH = 1200  # pixels for generated PNG (adjust)
DPI = 150  # rendering DPI; higher -> better quality but bigger files

def convert_pdf_to_png(pdf_path: Path, out_path: Path, max_width=MAX_WIDTH, dpi=DPI):
    try:
        doc = fitz.open(str(pdf_path))
        page = doc.load_page(0)  # first page
        mat = fitz.Matrix(dpi/72, dpi/72)  # scale to DPI
        pix = page.get_pixmap(matrix=mat, alpha=False)
        mode = "RGB"
        img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
        # optionally resize if too wide
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((int(max_width), int(img.height * ratio)), Image.LANCZOS)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_path, format="PNG", optimize=True)
        doc.close()
        return True
    except Exception as e:
        print(f"Conversion failed for {pdf_path}: {e}")
        try:
            doc.close()
        except Exception:
            pass
        return False

def main():
    if not JSON_PATH.exists():
        print(f"Error: {JSON_PATH} not found. Adjust JSON_PATH in the script.")
        sys.exit(1)

    # load JSON
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    modified = False
    updated_entries = 0
    total_pdf = 0
    converted = 0

    # Ensure we use array-of-entries format; if your JSON is nested adapt as needed
    if not isinstance(data, list):
        print("Warning: figures.json is not a top-level array. This script expects an array of entries.")
        # try to handle object -> values
        entries = []
        if isinstance(data, dict):
            # flatten: values might be lists
            for v in data.values():
                if isinstance(v, list):
                    entries.extend(v)
                else:
                    entries.append(v)
        else:
            print("Unknown JSON structure; aborting.")
            sys.exit(1)
    else:
        entries = data

    for e in tqdm(entries):
        img = e.get("image_file") or ""
        if not img.lower().endswith(".pdf"):
            continue
        total_pdf += 1
        # compute actual disk path(s)
        # allow for leading / or not
        img_rel = img.lstrip("/")
        pdf_path = ROOT / img_rel
        if not pdf_path.exists():
            # try variant: maybe JSON has "figures/..." but actual path is ROOT/figures/...
            alt = ROOT / Path(img_rel).name
            if alt.exists():
                pdf_path = alt
            else:
                print(f"PDF not found: {pdf_path}")
                continue
        png_name = pdf_path.stem + ".png"
        png_path = pdf_path.parent / png_name

        ok = convert_pdf_to_png(pdf_path, png_path)
        if ok:
            # update JSON entry to point to png relative path
            new_rel = str((Path(img_rel).with_suffix(".png")).as_posix())
            e["image_file"] = new_rel
            modified = True
            converted += 1
            updated_entries += 1
        else:
            print(f"Could not convert {pdf_path}")

    # Write updated JSON to a new file (backup original)
    if modified:
        backup = JSON_PATH.with_suffix(".json.bak")
        backup_written = False
        try:
            JSON_PATH.replace(backup)
            # after replace, write updated content to new JSON_PATH
            with open(JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(entries, f, indent=2, ensure_ascii=False)
            backup_written = True
        except Exception as e:
            print("Error writing updated JSON:", e)
            # attempt safer write
            with open(JSON_PATH.with_suffix(".updated.json"), "w", encoding="utf-8") as f:
                json.dump(entries, f, indent=2, ensure_ascii=False)
            print("Wrote updated JSON to", JSON_PATH.with_suffix(".updated.json"))

        if backup_written:
            print(f"Backed up original to {backup} and wrote updated {JSON_PATH}")
    print(f"Total PDFs encountered: {total_pdf}. Converted: {converted}. Updated JSON entries: {updated_entries}")

if __name__ == "__main__":
    main()

    
