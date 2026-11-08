"""Build exam questions from an ITExamAnswers page, one numbered question at a time.

Usage: python rebuild/build_page.py <page.html> <out.json>

Written for CCNA 2 (Nov 2026), whose pages trip up scraper.py:
- Text "exhibits" (routing tables in <pre> blocks or extra paragraphs, a command to
  "consider") are kept as extra lines of the question text, joined with "\\n".
  scraper.py keeps only the first line ("Consider the following command:").
- Pictures are taken from the question's own block (lazy-load aware). scraper.py
  often gives a question the picture of the question before it.
- Correct answers marked with <span class="correct_answer"> inside the <li> count.
- "Case N" variants become extra questions: "<question> [Case N]" (same as scraper.py).

The page is split at the numbered question starts ("12. ..."), and each piece is cut
at its explanation box. Questions with no answer list (matching questions shown only
as a picture, choices written as paragraphs, "Question as presented:" leftovers) go to
"other" with their pictures and text, to be handled by hand or by a picture reading.

Output: {"questions": [...], "other": [...]}. Every item has "page_number"; questions
also have "images" (all pictures in the block) for checking. See EXAM-REBUILD.md.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bs4 import BeautifulSoup, NavigableString, Tag  # noqa: E402
from scraper import clean_text, has_red_text, find_main_content  # noqa: E402

BASE = "https://itexamanswers.net/"
START = re.compile(r"<(p|strong|b|h3|h4)(\s[^>]*)?>\s*(?:<(?:strong|b)>\s*)?(\d{1,3})\.\s")
EXPLANATION = re.compile(r'<div class="message_box|<(p|div)[^>]*>\s*<(strong|b)>\s*Explanation', re.I)
CASE = re.compile(r"^(Case\s+\d+|Other case)\b[^:]*:?\s*$", re.I)
CASE_TAIL = re.compile(r"\s*(Case\s+\d+|Other case)\b[^:]*:?\s*$", re.I)


def img_src(tag: Tag) -> str:
    for attr in ("data-src", "data-lazy-src", "src"):
        src = (tag.get(attr) or "").strip()
        if src and not src.startswith("data:"):
            return src if src.startswith("http") else BASE.rstrip("/") + "/" + src.lstrip("/")
    return ""


def lines_of(tag: Tag) -> list:
    """Text of a block, one entry per visual line (<br> and <pre> newlines kept)."""
    tag = BeautifulSoup(str(tag), "html.parser")
    for br in tag.find_all("br"):
        br.replace_with("\n")
    for junk in tag.find_all(class_=re.compile("cbc-code-bar|wp-caption-text")):
        junk.decompose()
    text = tag.get_text("")
    return [clean_text(line) for line in text.split("\n") if clean_text(line)]


def blocks(node):
    for c in node.children:
        if isinstance(c, NavigableString):
            if str(c).strip():
                yield ("text", c)
            continue
        if not isinstance(c, Tag) or c.name in ("script", "style", "noscript", "br", "button"):
            continue
        cls = " ".join(c.get("class") or [])
        if "cbc-code-bar" in cls or "wp-caption-text" in cls:
            continue
        if c.name in ("ul", "ol"):
            yield ("list", c)
        elif c.name == "img":
            yield ("img", c)
        elif c.name in ("div", "figure", "section") and "cbc-code-wrapper" not in cls:
            yield from blocks(c)
        elif c.name == "p" and c.find(["ul", "ol", "div"]):
            yield from blocks(c)
        else:
            yield ("block", c)


def chunks(html: str):
    """(number, html) for each numbered question, in page order."""
    found, last = [], 0
    for m in START.finditer(html):
        n = int(m.group(3))
        if last < n <= last + 5:
            found.append((n, m.start()))
            last = n
    out = []
    for i, (n, start) in enumerate(found):
        end = found[i + 1][1] if i + 1 < len(found) else len(html)
        out.append((n, html[start:end]))
    return out


def parse_chunk(n: int, chunk: str):
    cut = EXPLANATION.search(chunk)
    body = chunk[: cut.start()] if cut else chunk
    soup = BeautifulSoup(body, "html.parser")
    variants = []
    cur = {"page_number": n, "lines": [], "images": [], "options": [], "case": ""}

    def new_variant(label):
        nonlocal cur
        variants.append(cur)
        cur = {"page_number": n, "lines": list(variants[0]["lines"]), "images": list(variants[0]["images"]),
               "options": [], "case": label}

    for kind, el in blocks(soup):
        if kind == "img":
            if img_src(el):
                cur["images"].append(img_src(el))
            continue
        if kind == "list":
            if cur["options"]:
                continue  # a second list after the answers (rare); ignore
            for li in el.find_all("li", recursive=False) or el.find_all("li"):
                text = clean_text(li.get_text(" ", strip=True))
                pic = li.find("img")
                if not text and not pic:
                    continue
                correct = ("correct_answer" in (li.get("class") or [])
                           or li.find(class_="correct_answer") is not None or has_red_text(li))
                cur["options"].append({"text": text, "correct": correct, "image": img_src(pic) if pic else ""})
            continue
        for img in (el.find_all("img") if isinstance(el, Tag) else []):
            if img_src(img):
                cur["images"].append(img_src(img))
        lines = lines_of(el) if isinstance(el, Tag) else [clean_text(str(el))]
        if not lines:
            continue
        if len(lines) == 1 and CASE.match(lines[0]):
            if cur["options"]:
                new_variant(CASE.match(lines[0]).group(1).title())
            else:
                cur["case"] = CASE.match(lines[0]).group(1).title()
            continue
        if cur["options"]:
            cur.setdefault("after", []).extend(lines)  # text after the answer list
            continue
        cur["lines"].extend(lines)
    variants.append(cur)
    return variants


def to_question(v: dict):
    lines = list(v["lines"])
    if lines:
        lines[0] = re.sub(r"^\d{1,3}\.\s*", "", lines[0])
        # "…(Choose three.) Case 7 (NEW):" written on the question line itself.
        m = CASE_TAIL.search(lines[0])
        if m and not v["case"]:
            v["case"] = m.group(1).title()
        lines[0] = CASE_TAIL.sub("", lines[0])
    if lines and CASE.match(lines[-1]):
        v["case"] = v["case"] or CASE.match(lines[-1]).group(1).title()
        lines = lines[:-1]
    text = "\n".join(l for l in lines if l)
    return text


def build(html: str):
    soup = BeautifulSoup(html, "html.parser")
    main = str(find_main_content(soup))
    questions, other = [], []
    for n, chunk in chunks(main):
        variants = parse_chunk(n, chunk)
        for idx, v in enumerate(variants):
            text = to_question(v)
            opts = v["options"]
            correct = [o["text"] for o in opts if o["correct"]]
            # The first variant keeps the plain question; later ones get " [Case N]".
            label = v["case"] if idx > 0 else ""
            qtext = f"{text} [{label}]" if label else text
            if opts and 0 < len(correct) < len(opts):
                q = {"page_number": n, "question": qtext, "options": [o["text"] for o in opts],
                     "correct_answer": " | ".join(correct), "images": v["images"]}
                exhibit = [i for i in v["images"]]
                if exhibit:
                    q["image"] = exhibit[0]
                pics = {o["text"] or f"Image {k + 1}": o["image"] for k, o in enumerate(opts) if o["image"]}
                if pics:
                    q["option_images"] = pics
                if v.get("after"):
                    q["after"] = v["after"]
                questions.append(q)
            else:
                other.append({"page_number": n, "question": qtext, "images": v["images"],
                              "options": opts, "after": v.get("after", []),
                              "why": "no answer list" if not opts else f"{len(correct)} of {len(opts)} marked correct"})
    return questions, other


if __name__ == "__main__":
    qs, other = build(open(sys.argv[1], encoding="utf-8").read())
    json.dump({"questions": qs, "other": other}, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(qs)} questions, {len(other)} other")
    for o in other:
        print(f"  Q{o['page_number']} ({o['why']}, {len(o['images'])} pictures) {o['question'][:90]!r}")
