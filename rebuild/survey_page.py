"""List every numbered question on an ITExamAnswers page with its answer choices and pictures.

Usage: python rebuild/survey_page.py <page.html> [<out.json>]

Flags questions whose answer is only a picture (matching / drag-and-drop), pictures in
questions (exhibits) and answer choices that are pictures. See EXAM-REBUILD.md.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bs4 import BeautifulSoup, Tag  # noqa: E402
from scraper import find_main_content, is_inside_explanation  # noqa: E402

Q_START = re.compile(r"^(\d{1,3})\.\s+\S")


def img_src(tag: Tag) -> str:
    for attr in ("data-src", "data-lazy-src", "src"):
        src = tag.get(attr) or ""
        if src and not src.startswith("data:"):
            return src
    return ""


def survey(html: str) -> list:
    soup = BeautifulSoup(html, "lxml")
    main = find_main_content(soup)
    questions, cur = [], None
    for el in main.find_all(["p", "h3", "h4", "li", "img", "ul"]):
        if el.name in ("p", "h3", "h4"):
            text = el.get_text(" ", strip=True)
            m = Q_START.match(text)
            if m and not is_inside_explanation(el):
                cur = {"page_number": int(m.group(1)), "question": re.sub(r"^\d{1,3}\.\s+", "", text),
                       "options": 0, "option_images": 0, "images": [], "arrow_pairs": 0}
                questions.append(cur)
                for img in el.find_all("img"):
                    if img_src(img):
                        cur["images"].append(img_src(img))
                continue
            if cur is not None and "-->" in text:
                cur["arrow_pairs"] += text.count("-->")
        if cur is None or is_inside_explanation(el):
            continue
        if el.name == "li":
            if "-->" in el.get_text(" ", strip=True):
                cur["arrow_pairs"] += 1  # a matching answer written out as text
                continue
            cur["options"] += 1
            if el.find("img"):
                cur["option_images"] += 1
        elif el.name == "img" and not el.find_parent("li"):
            src = img_src(el)
            if src and "wp-content/uploads" in src and src not in cur["images"]:
                cur["images"].append(src)
    for q in questions:
        q["kind"] = (
            "picture-answer" if q["options"] == 0 and q["images"]
            else "text-matching" if q["options"] == 0 and q["arrow_pairs"]
            else "no-options" if q["options"] == 0
            else "choices-are-pictures" if q["option_images"]
            else "multiple-choice"
        )
    return questions


if __name__ == "__main__":
    qs = survey(open(sys.argv[1], encoding="utf-8").read())
    if len(sys.argv) > 2:
        json.dump(qs, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    from collections import Counter
    print(len(qs), "questions", dict(Counter(q["kind"] for q in qs)))
    for q in qs:
        if q["kind"] != "multiple-choice":
            print(f"  Q{q['page_number']} [{q['kind']}] {q['question'][:80]} | images {len(q['images'])} | arrows {q['arrow_pairs']}")
