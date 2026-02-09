#!/usr/bin/env python3
"""
Scrape DOE Office of Science 'Science Highlights' for query 'lattice QCD',
fetch each highlight page to extract the canonical image (og:image/twitter:image or article figure),
download the images to static/data/figures/doe-science, and write static/data/doe-science.json.

Usage:
  python scripts/scrape_doe_science_highlights.py

Dependencies:
  pip install requests beautifulsoup4 tqdm
"""
from __future__ import annotations
import re
import time
import json
import logging
from pathlib import Path
from typing import List, Optional
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup, Tag
from tqdm import tqdm

# Config
BASE_SEARCH_URL = "https://science.osti.gov/Science-Features/Science-Highlights"
QUERY_PARAMS = "?query=lattice+QCD&program=b8d15e91-52ca-4c7b-87a4-fbc937064d59&program=577d1163-7228-472c-a6cb-f3ad37656c0b&page={page}"
OUT_DIR = Path("static/data")
FIGURES_DIR = OUT_DIR / "figures" / "doe-science"
OUT_JSON = OUT_DIR / "doe-science.json"
HEADERS = {
    "User-Agent": "USQCD-site-scraper/1.0 (+https://www.usqcd.org) - polite bot for small crawl"
}
REQUEST_TIMEOUT = 20  # seconds
PAUSE_BETWEEN_PAGES = 1.0  # seconds between list pages
PAUSE_BETWEEN_ITEM_FETCH = 0.8  # seconds between item page fetches
MAX_PAGES = 5  # cap for safety (we expect 2 pages per user note)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def safe_filename(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"[^\w\-_\. ]+", "_", s)
    s = re.sub(r"\s+", "_", s)
    return s[:180]


def download_image(img_url: str, out_path: Path) -> bool:
    try:
        resp = requests.get(img_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            logging.warning(f"Image GET returned status {resp.status_code} for {img_url}")
            return False
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(resp.content)
        return True
    except Exception as e:
        logging.warning(f"Failed to download {img_url}: {e}")
        return False


def extract_items_from_list_page(html: str, base_url: str) -> List[dict]:
    """
    Extract titles/links/short descriptions from the search results page.
    Returns dicts with keys: title, link, description.
    (Image will be obtained by fetching the individual page.)
    """
    soup = BeautifulSoup(html, "html.parser")
    items = []

    # Heuristic: look for result blocks that include heading tags with anchors
    headers = soup.find_all(["h2", "h3", "h4"])
    for h in headers:
        if not isinstance(h, Tag):
            continue
        # find anchor in header
        a = h.find("a", href=True)
        title = a.get_text(strip=True) if a and isinstance(a, Tag) else h.get_text(strip=True)
        if not title:
            continue
        link = urljoin(base_url, a["href"]) if a and a.has_attr("href") else None

        # try to find a short description near the header
        desc = None
        # look at next siblings
        sib = h.next_sibling
        steps = 0
        while sib and steps < 8:
            if isinstance(sib, Tag):
                if sib.name == "p":
                    desc = sib.get_text(" ", strip=True)
                    break
                p = sib.find("p")
                if isinstance(p, Tag):
                    desc = p.get_text(" ", strip=True)
                    break
            sib = getattr(sib, "next_sibling", None)
            steps += 1
        if not desc and isinstance(h.parent, Tag):
            p = h.parent.find("p")
            if isinstance(p, Tag):
                desc = p.get_text(" ", strip=True)

        items.append({"title": title, "link": link, "description": desc or ""})
    return items


def find_best_image_on_page(item_url: str, html: str) -> Optional[str]:
    """
    Given the HTML of an individual highlight page, attempt to find the best representative image.
    Order:
      1. meta property="og:image" or name="twitter:image"
      2. first <figure><img>
      3. first <article> img or main container img
      4. first <img> on the page
    Returns absolute URL or None.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1) Open Graph / Twitter meta
    meta_og = soup.find("meta", property="og:image")
    if isinstance(meta_og, Tag) and meta_og.has_attr("content"):
        candidate = meta_og["content"].strip()
        if candidate:
            return urljoin(item_url, candidate)
    meta_tw = soup.find("meta", attrs={"name": "twitter:image"})
    if isinstance(meta_tw, Tag) and meta_tw.has_attr("content"):
        candidate = meta_tw["content"].strip()
        if candidate:
            return urljoin(item_url, candidate)

    # 2) look for <figure> containing <img>
    fig = soup.find("figure")
    if isinstance(fig, Tag):
        img = fig.find("img")
        if isinstance(img, Tag) and img.has_attr("src"):
            return urljoin(item_url, img["src"])

    # 3) look for <article> or main container images
    article = soup.find("article")
    if isinstance(article, Tag):
        img = article.find("img")
        if isinstance(img, Tag) and img.has_attr("src"):
            return urljoin(item_url, img["src"])

    # some pages wrap content in .entry-content or .feature-content etc.
    for selector in ["div.entry-content", "div.feature-content", "div.content", "main"]:
        node = soup.select_one(selector)
        if node and isinstance(node, Tag):
            img = node.find("img")
            if isinstance(img, Tag) and img.has_attr("src"):
                return urljoin(item_url, img["src"])

    # 4) fallback: first img on page
    img_any = soup.find("img")
    if isinstance(img_any, Tag) and img_any.has_attr("src"):
        return urljoin(item_url, img_any["src"])

    return None


def crawl_list_pages(start_page: int = 1, max_pages: int = MAX_PAGES) -> List[dict]:
    results = []
    base = BASE_SEARCH_URL
    for page in range(start_page, start_page + max_pages):
        url = base + QUERY_PARAMS.format(page=page)
        logging.info(f"Fetching list page {page}: {url}")
        try:
            r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        except Exception as e:
            logging.error(f"Request failed for {url}: {e}")
            break
        if r.status_code != 200:
            logging.error(f"Non-200 status {r.status_code} for {url}")
            break
        page_items = extract_items_from_list_page(r.text, base)
        if not page_items:
            logging.info(f"No items found on page {page}; stopping.")
            break
        results.extend(page_items)
        time.sleep(PAUSE_BETWEEN_PAGES)
    return results


def build_dataset_and_download(images_root: Path, out_json: Path, items: List[dict]):
    images_root.mkdir(parents=True, exist_ok=True)
    final = []
    seen_titles = set()

    for it in tqdm(items, desc="Processing items"):
        title = (it.get("title") or "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        link = it.get("link")
        desc = (it.get("description") or "").strip()
        image_file_rel = None

        # if we have a link, fetch that page and attempt to extract a canonical image
        if link:
            try:
                r = requests.get(link, headers=HEADERS, timeout=REQUEST_TIMEOUT)
                if r.status_code == 200:
                    img_url = find_best_image_on_page(link, r.text)
                    if img_url:
                        # prepare filename
                        parsed = urlparse(img_url)
                        filename = Path(unquote(parsed.path)).name
                        if not filename:
                            filename = safe_filename(title) + ".png"
                        else:
                            if not re.search(r"\.(png|jpe?g|gif|webp)$", filename, re.I):
                                filename = filename + ".png"
                        filename = safe_filename(filename)
                        dest = images_root / filename
                        ok = download_image(img_url, dest)
                        if ok:
                            image_file_rel = str(Path("figures") / "doe-science" / filename)
                        else:
                            logging.warning(f"Failed to download image {img_url} for {title}")
                    else:
                        logging.info(f"No image found on page for '{title}' ({link})")
                else:
                    logging.warning(f"Non-200 fetching item page {link}: {r.status_code}")
            except Exception as e:
                logging.warning(f"Failed to fetch item page {link}: {e}")
            time.sleep(PAUSE_BETWEEN_ITEM_FETCH)

        if image_file_rel != None:
            final.append({
                "title": title,
                "link": link,
                "description": desc,
                "image_file": image_file_rel
            })

    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=2, ensure_ascii=False)
    logging.info(f"Wrote {len(final)} items to {out_json}")
    return final


def main():
    logging.info("Starting DOE Science Highlights scraper for 'lattice QCD' (individual page fetch mode)...")
    items = crawl_list_pages(start_page=1, max_pages=MAX_PAGES)
    if not items:
        logging.error("No items found; exiting.")
        return
    logging.info(f"Found {len(items)} items on list pages; fetching each item page to obtain images...")
    build_dataset_and_download(FIGURES_DIR, OUT_JSON, items)
    logging.info("Done.")


if __name__ == "__main__":
    main()
    
