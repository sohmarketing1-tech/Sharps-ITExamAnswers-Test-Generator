import json
import re
import sys
from pathlib import Path

from scraper import scrape_url, is_valid_itexamanswers_url

URLS = [
    "https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-1-9-answers-full.html",
    "https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-10-14-answers-full.html",
    "https://itexamanswers.net/it-essentials-7-0-final-exam-composite-chapters-1-14-answers.html",
    "https://itexamanswers.net/ccna-1-v7-modules-1-3-basic-network-connectivity-and-communications-exam-answers.html",
    "https://itexamanswers.net/ccna-1-v7-modules-4-7-ethernet-concepts-exam-answers.html",
    "https://itexamanswers.net/ccna-1-v7-modules-8-10-communicating-between-networks-exam-answers.html",
    "https://itexamanswers.net/ccna-1-v7-modules-11-13-ip-addressing-exam-answers-full.html",
    "https://itexamanswers.net/ccna-1-v7-modules-14-15-network-application-communications-exam-answers.html",
    "https://itexamanswers.net/ccna-1-v7-modules-16-17-building-and-securing-a-small-network-exam-answers.html",
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
