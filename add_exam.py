#!/usr/bin/env python3
"""Add one or more exams by URL to the existing data/exams.json manifest.

Usage (in a PythonAnywhere Bash console):

    python3 add_exam.py "https://itexamanswers.net/..." "Short Display Name"

You can add multiple exams at once:

    python3 add_exam.py \
        "https://itexamanswers.net/exam-1.html" "Exam 1 Name" \
        "https://itexamanswers.net/exam-2.html" "Exam 2 Name" \
        "https://itexamanswers.net/exam-3.html"

If a display name is omitted, the page title is used.
"""

import json
import re
import sys
from pathlib import Path

from scraper import scrape_url, is_valid_itexamanswers_url

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MANIFEST_PATH = DATA_DIR / "exams.json"
URLS_FILE = BASE_DIR / "urls_to_add.txt"


def slugify(title: str) -> str:
    text = re.sub(r"[^\w\s-]", "", title.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"exams": []}
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"exams": []}


def save_manifest(manifest: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def parse_urls_file(path: Path) -> list:
    """Read urls_to_add.txt and return [(url, display_name?), ...]."""
    pairs = []
    if not path.exists():
        return pairs
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 1)
            url = parts[0]
            display_name = parts[1] if len(parts) > 1 else ""
            if is_valid_itexamanswers_url(url):
                pairs.append((url, display_name))
            else:
                print(f"  Skipping invalid URL in file: {url}")
    return pairs


def add_exam(url: str, display_name: str = "") -> dict:
    if not is_valid_itexamanswers_url(url):
        raise ValueError(f"Invalid URL: {url}")
    print(f"Scraping {url} ...")
    title, questions = scrape_url(url)
    if not questions:
        raise RuntimeError(f"No questions scraped from {url}")
    filename = f"{slugify(title)}.json"
    out_path = DATA_DIR / filename
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"title": title, "url": url, "questions": questions}, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(questions)} questions to {out_path}")
    exam = {
        "title": title,
        "url": url,
        "filename": filename,
        "count": len(questions),
    }
    if display_name:
        exam["display_name"] = display_name
    return exam


def main() -> int:
    args = sys.argv[1:]
    if not args:
        pairs = parse_urls_file(URLS_FILE)
        if not pairs:
            print(f"Usage: python3 add_exam.py <url> [display_name] ...")
            print(f"   Or add URLs (one per line) to {URLS_FILE} and run python3 add_exam.py")
            return 1
    else:
        pairs = []
        i = 0
        while i < len(args):
            url = args[i]
            display_name = ""
            if i + 1 < len(args) and not is_valid_itexamanswers_url(args[i + 1]):
                display_name = args[i + 1]
                i += 1
            i += 1
            pairs.append((url, display_name))

    manifest = load_manifest()
    existing_by_filename = {e.get("filename"): idx for idx, e in enumerate(manifest.get("exams", []))}

    for url, display_name in pairs:
        try:
            exam = add_exam(url, display_name)
            if exam["filename"] in existing_by_filename:
                idx = existing_by_filename[exam["filename"]]
                manifest["exams"][idx] = exam
                print(f"  Updated existing exam: {exam['filename']}")
            else:
                manifest["exams"].append(exam)
                existing_by_filename[exam["filename"]] = len(manifest["exams"]) - 1
                print(f"  Added new exam: {exam['filename']}")
        except Exception as err:
            print(f"  ERROR: {err}")

    save_manifest(manifest)
    print(f"\nManifest saved. Total exams: {len(manifest['exams'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
