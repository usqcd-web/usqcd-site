#!/usr/bin/env python3
"""
fetch_arxiv.py (with INSPIRE enrichment)

Fetch hep-lat arXiv publications for authors listed in static/data/members.json,
partition by year and write per-year JSON files.

Optionally, enrich each arXiv entry with publication metadata from INSPIRE-HEP
(using the arXiv identifier). Cached lookups are stored locally.

Outputs:
 - static/data/publications.json           (top-N most recent overall)
 - static/data/publications-YYYY.json      (all papers for each year in range)
 - static/data/inspire_cache.json          (INSPIRE lookup cache)

Usage examples:
  python3 scripts/fetch_arxiv.py --all-years --start-year 2001
  python3 scripts/fetch_arxiv.py --year 2026 --inspire-delay 0.6
  python3 scripts/fetch_arxiv.py --range 2015 2023 --top-n 10 --no-inspire

Notes:
 - Be polite to external APIs: adjust --delay and --inspire-delay to your environment.
 - The script deduplicates by arXiv id and only keeps entries that include "hep-lat".
"""
from __future__ import annotations
import argparse
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from xml.etree import ElementTree as ET
from typing import List, Dict, Any
import os
import sys

import requests

ARXIV_API = "https://export.arxiv.org/api/query"
INSPIRE_API = "https://inspirehep.net/api/literature"
OUT_DIR = "public/static/data"
MEMBERS_PATHS = ["public/static/data/members.json", "static/members.json", "members.json"]

# XML namespaces for arXiv Atom
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom"
}

def make_session():
    retry = Retry(
        total=5,
        connect=3,
        read=3,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry)
    s = requests.Session()
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s

SESSION = make_session()

def load_members(path: str = None) -> List[Dict[str, Any]]:
    paths = [path] if path else MEMBERS_PATHS
    for p in paths:
        if not p:
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Support both flat person list and institution->people arrays
                if isinstance(data, dict):
                    if all(isinstance(v, list) for v in data.values()):
                        people = []
                        for inst, names in data.items():
                            for n in names:
                                people.append({"name": n, "institution": inst})
                        return people
                if isinstance(data, list):
                    if len(data) == 0:
                        return []
                    if isinstance(data[0], dict) and "name" in data[0]:
                        return data
                    if isinstance(data[0], dict) and "institution" in data[0] and "people" in data[0]:
                        people = []
                        for inst in data:
                            inst_name = inst.get("institution")
                            for n in inst.get("people", []):
                                people.append({"name": n, "institution": inst_name})
                        return people
                return []
        except FileNotFoundError:
            continue
        except Exception as e:
            print(f"Error loading members from {p}: {e}", file=sys.stderr)
            continue
    raise FileNotFoundError("Could not find members JSON. Expected at one of: " + ", ".join(MEMBERS_PATHS))

def arxiv_query_for_author(author_name: str, max_results: int = 10) -> str:
    query = f'au:"{author_name}" AND cat:hep-lat'
    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending"
    }
    #r = requests.get(ARXIV_API, params=params, timeout=90)
    r = SESSION.get(
        ARXIV_API,
        params=params,
        timeout=(10, 120))
    r.raise_for_status()
    return r.text

def parse_atom(xml_text: str) -> List[Dict[str, Any]]:
    root = ET.fromstring(xml_text)
    entries = []
    for e in root.findall("atom:entry", NS):
        try:
            id_raw = e.find("atom:id", NS).text.strip()
            arxiv_id = id_raw.split("/abs/")[-1]
            title = (e.find("atom:title", NS).text or "").strip()
            summary = (e.find("atom:summary", NS).text or "").strip()
            published = (e.find("atom:published", NS).text or "").strip()
            authors = [a.find("atom:name", NS).text for a in e.findall("atom:author", NS)]
            cats = [c.attrib.get("term") for c in e.findall("atom:category", NS) if c.attrib.get("term")]
            primary = None
            pc = e.find("arxiv:primary_category", NS)
            if pc is not None:
                primary = pc.attrib.get("term")
                if primary and primary not in cats:
                    cats.append(primary)
            pdf = None
            link = None
            for l in e.findall("atom:link", NS):
                atype = l.attrib.get("type", "")
                href = l.attrib.get("href")
                title_attr = l.attrib.get("title", "")
                if title_attr == "pdf" or atype == "application/pdf" or (href and href.endswith(".pdf")):
                    pdf = href
                if l.attrib.get("rel") == "alternate" and href:
                    link = href
            if not link:
                link = id_raw
            entries.append({
                "id": arxiv_id,
                "title": title,
                "summary": summary,
                "authors": authors,
                "pdf": pdf,
                "link": link,
                "published": published,
                "categories": cats
            })
        except Exception as ex:
            print("parse entry error:", ex, file=sys.stderr)
            continue
    return entries

def is_hep_lat(entry: Dict[str, Any]) -> bool:
    cats = [c.lower() for c in (entry.get("categories") or [])]
    return any("hep-lat" in c for c in cats)

def ensure_out_dir():
    os.makedirs(OUT_DIR, exist_ok=True)

def write_year_file(year: int, entries: List[Dict[str, Any]]):
    fname = os.path.join(OUT_DIR, f"publications-{year}.json")
    payload = {
        "generated": datetime.now(timezone.utc).isoformat() + "Z",
        "count": len(entries),
        "publications": entries
    }
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Wrote {fname} ({len(entries)} entries)")

def write_top_file(entries: List[Dict[str, Any]], top_n: int = 5):
    fname = os.path.join(OUT_DIR, "publications.json")
    payload = {
        "generated": datetime.now(timezone.utc).isoformat() + "Z",
        "count": len(entries),
        "publications": entries[:top_n]
    }
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Wrote {fname} (top {top_n})")

# ----------------- INSPIRE enrichment -----------------

def load_inspire_cache(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"Warning: failed to load inspire cache {path}: {e}", file=sys.stderr)
        return {}

def save_inspire_cache(path: str, cache: Dict[str, Any]):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Warning: failed to save inspire cache {path}: {e}", file=sys.stderr)

def query_inspire_by_arxiv(arxiv_id: str, timeout=30) -> Dict[str, Any]:
    """
    Query INSPIRE for a given arXiv id. Returns a dictionary with extracted fields,
    or {} if not found.
    """
    params = {"q": f"arxiv:{arxiv_id}", "size": 1, "format": "json"}
    headers = {"Accept": "application/json"}
    try:
        r = SESSION.get(
            INSPIRE_API,
            params=params,
            headers=headers,
            timeout=(10, 60)
        )
        #r = requests.get(INSPIRE_API, params=params, headers=headers, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            return {}
        h = hits[0]
        meta = h.get("metadata", {})
        out = {}
        # control number / recid
        recid = h.get("id") or h.get("control_number") or meta.get("control_number")
        if recid:
            out["control_number"] = recid
        # inspire url
        if "id" in h and isinstance(h["id"], str):
            out["inspire_url"] = f"https://inspirehep.net/literature/{h['id']}"
        # DOIs
        dois = meta.get("dois") or []
        if isinstance(dois, list) and len(dois) > 0:
            # prefer the first with a value
            for d in dois:
                if isinstance(d, dict) and d.get("value"):
                    out["doi"] = d.get("value")
                    break
        # publication_info: list of dicts describing journal info
        pubinfo = meta.get("publication_info") or []
        extracted_pubinfo = []
        for p in pubinfo:
            # gather common fields if present
            j = {}
            if "journal_title" in p:
                j["journal_title"] = p.get("journal_title")
            if "journal_volume" in p:
                j["journal_volume"] = p.get("journal_volume")
            if "page_start" in p:
                j["page_start"] = p.get("page_start")
            if "artid" in p:
                j["artid"] = p.get("artid")
            if "year" in p:
                j["year"] = p.get("year")
            if "journal_issue" in p:
                j["journal_issue"] = p.get("journal_issue")
            if "page_end" in p:
                j["page_end"] = p.get("page_end")
            if p:
                extracted_pubinfo.append(j)
        if extracted_pubinfo:
            out["publication_info"] = extracted_pubinfo
        # best-effort journal_ref string: sometimes stored under metadata['journal_reference'] or 'publication_info'
        journal_ref = meta.get("journal_reference") or meta.get("journal_ref") or None
        if journal_ref:
            out["journal_ref"] = journal_ref
        else:
            # If no single journal_ref, try to format from first pubinfo
            if extracted_pubinfo:
                p0 = extracted_pubinfo[0]
                jparts = []
                if p0.get("journal_title"):
                    jparts.append(p0["journal_title"])
                if p0.get("journal_volume"):
                    jparts.append(f"vol. {p0['journal_volume']}")
                if p0.get("artid"):
                    jparts.append(f"artid {p0['artid']}")
                if p0.get("page_start"):
                    jparts.append(f"p. {p0['page_start']}")
                if p0.get("year"):
                    jparts.append(str(p0["year"]))
                if jparts:
                    out["journal_ref"] = ", ".join(jparts)

        # --- citation count extraction (INSPIRE can expose this under different keys) ---
        cit_count = None
        # common direct field
        if isinstance(meta.get("citation_count"), int):
            cit_count = meta.get("citation_count")
        # sometimes it's under 'citations' or 'citations_count' structures
        if cit_count is None:
            cands = meta.get("citations") or meta.get("citation") or meta.get("cited_by") or {}
            # if it's a dict with a numeric subfield, try to find an int value
            if isinstance(cands, dict):
                for subk, subv in cands.items():
                    if isinstance(subv, int):
                        cit_count = subv
                        break
            # if it's an int directly
            if isinstance(cands, int):
                cit_count = cands

        # defensive scan: sometimes keys have 'citation' or 'cited' in their name
        if cit_count is None:
            for k, v in meta.items():
                kl = str(k).lower()
                if "citation" in kl or "cited" in kl:
                    if isinstance(v, int):
                        cit_count = v
                        break
                    if isinstance(v, dict):
                        # pick the first integer subfield (e.g. {"total": 12})
                        for sv in v.values():
                            if isinstance(sv, int):
                                cit_count = sv
                                break
                        if cit_count is not None:
                            break

        # attach if found (otherwise leave it out)
        if cit_count is not None:
            out["citation_count"] = int(cit_count)


        return out
    except Exception as e:
        print(f"INSPIRE query error for {arxiv_id}: {e}", file=sys.stderr)
        return {}

# ----------------- Batch INSPIRE enrichment (faster) -----------------

def query_inspire_batch(arxiv_ids: List[str], timeout=30) -> Dict[str, Dict[str, Any]]:
    """
    Batch-query INSPIRE for a list of arXiv ids.
    Returns mapping arxiv_id -> extracted info dict (may be empty for misses).
    Uses the query: q=arxiv:(id1 OR id2 OR ...) with size = len(arxiv_ids)
    """
    if not arxiv_ids:
        return {}
    # Build a OR-separated list, escaping any colon in ids (shouldn't be necessary normally)
    q_terms = " OR ".join([f'arxiv:{a}' for a in arxiv_ids])
    params = {"q": q_terms, "size": max(len(arxiv_ids), 100), "format": "json"}
    headers = {"Accept": "application/json"}
    try:
        r = SESSION.get(
            INSPIRE_API,
            params=params,
            headers=headers,
            timeout=(10, 60)
        )
        #r = requests.get(INSPIRE_API, params=params, headers=headers, timeout=timeout)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"INSPIRE batch query error for {len(arxiv_ids)} ids: {e}", file=sys.stderr)
        return {}

    hits = data.get("hits", {}).get("hits", []) or []
    mapping = {}

    for h in hits:
        meta = h.get("metadata", {}) or {}
        # Attempt to get arXiv id from metadata
        arxiv_val = None
        # common location INSPIRE uses for arXiv eprints
        ae = meta.get("arxiv_eprints") or meta.get("preprint_eprints") or meta.get("arxiv")
        if isinstance(ae, list) and len(ae) > 0:
            # take first entry's 'value' if present
            if isinstance(ae[0], dict) and ae[0].get("value"):
                arxiv_val = ae[0]["value"]
            elif isinstance(ae[0], str):
                arxiv_val = ae[0]
        # fallback: sometimes the arXiv id is given inside 'ids' or other url fields
        if not arxiv_val:
            # try the arXiv id encoded in the id string or other fields
            # check metadata['ids'] entries
            for id_item in meta.get("ids", []) or []:
                if isinstance(id_item, dict) and id_item.get("schema") and 'arxiv' in id_item.get("schema", "").lower():
                    arxiv_val = id_item.get("value")
                    break
        if not arxiv_val:
            # sometimes hits have 'control_number' and no explicit arXiv listing; skip then
            continue

        # Normalize arXiv id (strip vN suffix)
        norm_id = arxiv_val.split("v")[0] if arxiv_val and "v" in arxiv_val else arxiv_val

        # extract useful info (reuse earlier logic)
        out = {}
        recid = h.get("id") or h.get("control_number") or meta.get("control_number")
        if recid:
            out["control_number"] = recid
        if "id" in h and isinstance(h["id"], str):
            out["inspire_url"] = f"https://inspirehep.net/literature/{h['id']}"

        # DOI extraction (if present)
        dois = meta.get("dois") or []
        if isinstance(dois, list) and len(dois) > 0:
            for d in dois:
                if isinstance(d, dict) and d.get("value"):
                    out["doi"] = d.get("value")
                    break

        # publication_info list -> normalized extraction
        pubinfo = meta.get("publication_info") or []
        extracted_pubinfo = []
        for p in pubinfo:
            j = {}
            if "journal_title" in p:
                j["journal_title"] = p.get("journal_title")
            if "journal_volume" in p:
                j["journal_volume"] = p.get("journal_volume")
            if "page_start" in p:
                j["page_start"] = p.get("page_start")
            if "artid" in p:
                j["artid"] = p.get("artid")
            if "year" in p:
                j["year"] = p.get("year")
            if "journal_issue" in p:
                j["journal_issue"] = p.get("journal_issue")
            if "page_end" in p:
                j["page_end"] = p.get("page_end")
            if p:
                extracted_pubinfo.append(j)
        if extracted_pubinfo:
            out["publication_info"] = extracted_pubinfo

        # --- citation count extraction (INSPIRE can expose this under different keys) ---
        cit_count = None
        # common direct field
        if isinstance(meta.get("citation_count"), int):
            cit_count = meta.get("citation_count")
        # sometimes it's under 'citations' or 'citations_count' structures
        if cit_count is None:
            cands = meta.get("citations") or meta.get("citation") or meta.get("cited_by") or {}
            # if it's a dict with a numeric subfield, try to find an int value
            if isinstance(cands, dict):
                for subk, subv in cands.items():
                    if isinstance(subv, int):
                        cit_count = subv
                        break
            # if it's an int directly
            if isinstance(cands, int):
                cit_count = cands

        # defensive scan: sometimes keys have 'citation' or 'cited' in their name
        if cit_count is None:
            for k, v in meta.items():
                kl = str(k).lower()
                if "citation" in kl or "cited" in kl:
                    if isinstance(v, int):
                        cit_count = v
                        break
                    if isinstance(v, dict):
                        # pick the first integer subfield (e.g. {"total": 12})
                        for sv in v.values():
                            if isinstance(sv, int):
                                cit_count = sv
                                break
                        if cit_count is not None:
                            break

        # attach if found (otherwise leave it out)
        if cit_count is not None:
            out["citation_count"] = int(cit_count)

        # journal_ref fallback
        journal_ref = meta.get("journal_reference") or meta.get("journal_ref") or None
        if journal_ref:
            out["journal_ref"] = journal_ref
        else:
            if extracted_pubinfo:
                p0 = extracted_pubinfo[0]
                jparts = []
                if p0.get("journal_title"):
                    jparts.append(p0["journal_title"])
                if p0.get("journal_volume"):
                    jparts.append(f"{p0['journal_volume']}")
                if p0.get("artid"):
                    jparts.append(f"artid {p0['artid']}")
                if p0.get("page_start"):
                    jparts.append(f"p. {p0['page_start']}")
                if p0.get("year"):
                    jparts.append(str(p0["year"]))
                if jparts:
                    out["journal_ref"] = ", ".join(jparts)

        mapping[norm_id] = out

    return mapping


        
# ----------------- Main flow -----------------

def main(args):
    ensure_out_dir()
    members = load_members(args.members)
    names = []
    for m in members:
        nm = None
        if isinstance(m, dict):
            nm = m.get("name") or m.get("person") or m.get("fullname")
        else:
            nm = str(m)
        if nm:
            if nm not in names:
                names.append(nm)
    print(f"Loaded {len(names)} member names")

    if args.max_authors:
        names = names[: args.max_authors]
        print(f"Truncating to first {len(names)} authors for this run (max_authors)")

    seen = set()
    year_buckets = defaultdict(list)

    def add_entry(ent):
        arxiv_id = ent.get("id")
        if not arxiv_id or arxiv_id in seen:
            return False
        if not is_hep_lat(ent):
            return False
        pub = ent.get("published") or ""
        try:
            year = int(pub[:4])
        except Exception:
            year = datetime.utcnow().year
        seen.add(arxiv_id)
        year_buckets[year].append(ent)
        return True

    per_author = args.per_author
    for idx, name in enumerate(names):
        try:
            xml = arxiv_query_for_author(name, max_results=per_author)
            entries = parse_atom(xml)
            added = 0
            for ent in entries:
                if add_entry(ent):
                    added += 1
            print(f"[{idx+1}/{len(names)}] {name}: found {len(entries)} entries, added {added}")
        except Exception as e:
            print(f"ERROR querying arXiv for {name}: {e}", file=sys.stderr)
        time.sleep(args.delay)

    # Collect years to write
    current_year = datetime.now(timezone.utc).year
    years_to_write = set()
    if args.year:
        years_to_write.add(args.year)
    if args.range:
        start, end = args.range
        for y in range(start, end + 1):
            years_to_write.add(y)
    if args.all_years:
        for y in range(args.start_year, current_year + 1):
            years_to_write.add(y)
    if not years_to_write:
        years_to_write = set(year_buckets.keys())

    # Optionally enrich with INSPIRE
    inspire_cache = {}


    # Replace the earlier per-entry INSPIRE loop with this batching routine
    if not args.no_inspire:
        inspire_cache = load_inspire_cache(args.inspire_cache)
        print(f"Loaded INSPIRE cache with {len(inspire_cache)} entries")

        # Build list of all arXiv ids we might want to enrich across years_to_write
        arxiv_to_enrich = []
        for y in sorted(years_to_write, reverse=True):
            for ent in year_buckets.get(y, []):
                aid = ent.get("id")
                if not aid:
                    continue
                norm = aid.split("v")[0] if "v" in aid else aid
                # If not in cache or cache entry empty, schedule for lookup
                existing = inspire_cache.get(norm)
                if existing and existing != {}:
                    continue
                arxiv_to_enrich.append(norm)

        # Deduplicate
        arxiv_to_enrich = list(dict.fromkeys(arxiv_to_enrich))
        print(f"Enriching {len(arxiv_to_enrich)} arXiv ids with INSPIRE (batch size {args.inspire_batch_size})")

        # Process in batches
        batch_size = max(1, int(args.inspire_batch_size))
        batch_delay = float(args.inspire_batch_delay)
        for i in range(0, len(arxiv_to_enrich), batch_size):
            batch = arxiv_to_enrich[i : i + batch_size]
            try:
                mapping = query_inspire_batch(batch, timeout=30)
                # store mapping into cache (store empty dict for misses to avoid re-query)
                for aid in batch:
                    info = mapping.get(aid) or {}
                    inspire_cache[aid] = info
                print(f"Processed batch {i//batch_size + 1} / {((len(arxiv_to_enrich)-1)//batch_size)+1} ({len(batch)} ids) -> {sum(1 for a in batch if inspire_cache.get(a))} hits")
            except Exception as e:
                print(f"Batch enrichment error for batch starting at {i}: {e}", file=sys.stderr)
            # polite pause between batches
            time.sleep(batch_delay)

        # Attach cache contents to entries and write per-year files
        all_entries = []
        for y in sorted(years_to_write, reverse=True):
            entries = year_buckets.get(y, [])
            enriched = []
            for ent in entries:
                aid = ent.get("id")
                if aid:
                    norm = aid.split("v")[0] if "v" in aid else aid
                    info = inspire_cache.get(norm)
                    if info:
                        ent = dict(ent)
                        ent["inspire"] = info
                enriched.append(ent)
            entries_sorted = sorted(enriched, key=lambda e: e.get("published", ""), reverse=True)
            write_year_file(y, entries_sorted)
            all_entries.extend(entries_sorted)

        # Save the inspire cache
        save_inspire_cache(args.inspire_cache, inspire_cache)
        print(f"Saved INSPIRE cache to {args.inspire_cache}")

    else:
        # no_inspire: just write year files unchanged (but preserve earlier flow)
        all_entries = []
        for y in sorted(years_to_write, reverse=True):
            entries = year_buckets.get(y, [])
            entries_sorted = sorted(entries, key=lambda e: e.get("published", ""), reverse=True)
            write_year_file(y, entries_sorted)
            all_entries.extend(entries_sorted)


    # Write top-n overall
    all_entries_sorted = sorted(all_entries, key=lambda e: e.get("published", ""), reverse=True)
    write_top_file(all_entries_sorted, top_n=args.top_n)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch hep-lat arXiv papers for USQCD members and write per-year caches, optionally enriching from INSPIRE-HEP.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--year", type=int, help="Single year to generate (e.g. 2026)")
    group.add_argument("--range", nargs=2, type=int, metavar=("START", "END"), help="Year range to generate (inclusive)")
    group.add_argument("--all-years", action="store_true", help="Generate files for all years from --start-year to current year")
    parser.add_argument("--start-year", type=int, default=2001, help="Start year for --all-years (default 2001)")
    parser.add_argument("--per-author", type=int, default=1000, help="Max results per author query (arXiv max_results per call)")
    parser.add_argument("--delay", type=float, default=0.3, help="Seconds to wait between arXiv API calls (default 0.3s)")
    parser.add_argument("--top-n", type=int, default=5, help="How many top recent papers to write into static/data/publications.json (default 5)")
    parser.add_argument("--members", type=str, default=None, help="Path to members.json (default tries common locations)")
    parser.add_argument("--max-authors", type=int, default=None, help="Truncate number of authors to process (helpful for testing / CI)")
    parser.add_argument("--no-inspire", action="store_true", help="Do not query INSPIRE-HEP for publication enrichment")
    parser.add_argument("--inspire-delay", type=float, default=0.5, help="Seconds to wait between INSPIRE API calls (default 0.5s)")
    parser.add_argument("--inspire-cache", type=str, default=os.path.join(OUT_DIR, "inspire_cache.json"), help="Path to local INSPIRE lookup cache (default static/data/inspire_cache.json)")
    parser.add_argument("--inspire-batch-size", type=int, default=20, help="Number of arXiv ids per INSPIRE batch query (default 20)")
    parser.add_argument("--inspire-batch-delay", type=float, default=1.0, help="Seconds to wait between INSPIRE batch queries (default 1.0s)")
    args = parser.parse_args()
    try:
        main(args)
    except Exception as e:
        print("Fatal error:", e, file=sys.stderr)
        sys.exit(2)
        
