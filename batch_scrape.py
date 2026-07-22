import json
import re
import sys
from pathlib import Path

from scraper import scrape_url, is_valid_itexamanswers_url

URLS = [
    "https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-1-9-answers-full.html",
    "https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-10-14-answers-full.html",
    "https://itexamanswers.net/it-essentials-7-0-final-exam-composite-chapters-1-14-answers.html",
    "https://itexamanswers.net/ccna-1-v5-1-v6-0-chapter-1-exam-answers-100-full.html",
    "https://itexamanswers.net/ccna-1-v5-1-v6-0-chapter-2-exam-answers-100-full.html",
    "https://itexamanswers.net/ccna-1-v5-1-v6-0-chapter-3-exam-answers-100-full.html",
]

DATA_DIR = Path(__file__).resolve().parent / "data"


def slugify(title: str) -> str:
    text = re.sub(r"[^\w\s-]", "", title.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def main():
    exams = []
    for url in URLS:
        if not is_valid_itexamanswers_url(url):
            print(f"Skipping invalid URL: {url}")
            continue
        print(f"Scraping {url} ...")
        title, questions = scrape_url(url)
        print(f"  Title: {title}")
        print(f"  Questions: {len(questions)}")

        filename = f"{slugify(title)}.json"
        out_path = DATA_DIR / filename
        payload = {"title": title, "url": url, "questions": questions}
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"  Saved to {out_path}")

        exams.append({
            "title": title,
            "url": url,
            "filename": filename,
            "count": len(questions),
        })

    manifest_path = DATA_DIR / "exams.json"
    if manifest_path.exists():
        try:
            existing = json.load(open(manifest_path, "r", encoding="utf-8"))
        except Exception:
            existing = {"exams": []}
    else:
        existing = {"exams": []}

    existing_by_filename = {e.get("filename"): idx for idx, e in enumerate(existing.get("exams", []))}
    for exam in exams:
        if exam["filename"] in existing_by_filename:
            existing["exams"][existing_by_filename[exam["filename"]]] = exam
        else:
            existing["exams"].append(exam)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    print(f"\nManifest saved to {manifest_path}")
    print(f"Total exams: {len(existing['exams'])}")


if __name__ == "__main__":
    main()
