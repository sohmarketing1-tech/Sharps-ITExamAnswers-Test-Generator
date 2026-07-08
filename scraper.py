import json
import re
import random
import unicodedata
import sys
from typing import List, Dict, Any, Tuple, Optional
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

DEFAULT_TARGET_URL = "https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-1-9-answers-full.html"
DEFAULT_OUTPUT = "questions.json"


def is_valid_itexamanswers_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower().endswith("itexamanswers.net") and parsed.scheme in ("http", "https")
    except Exception:
        return False


def fetch_html(url: str) -> str:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()
    return resp.text


def clean_text(text: str) -> str:
    if not text:
        return ""
    # Normalize unicode quotes/dashes
    text = unicodedata.normalize("NFKC", text)
    # Replace common typographic characters with plain ASCII equivalents
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = text.replace("–", "-").replace("—", "-").replace("\u00a0", " ")
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_question_start(text: str) -> bool:
    return bool(re.match(r"^\d+\.\s+", text))


def is_case_label(text: str) -> bool:
    return bool(re.match(r"^Case\s+\d+:\s*", text, re.IGNORECASE))


def has_red_text(tag: Tag) -> bool:
    """Detect correct-answer markers that use red text (common on some exam pages)."""
    style = tag.get("style", "")
    if re.search(r"color\s*:\s*#?ff0000", style, re.IGNORECASE):
        return True
    if re.search(r"color\s*:\s*red", style, re.IGNORECASE):
        return True
    # Check nested spans
    for span in tag.find_all("span"):
        if has_red_text(span):
            return True
    return False


def extract_case_label(text: str) -> str:
    m = re.match(r"^(Case\s+\d+):?\s*(.*)$", text, re.IGNORECASE)
    if not m:
        return "", text
    return m.group(1), clean_text(m.group(2))


def find_main_content(soup: BeautifulSoup) -> Tag:
    # Look for common WordPress article containers
    for selector in [
        ("article", {"class": re.compile(r"post|entry")}),
        ("div", {"class": re.compile(r"entry-content|post-content|content-area")}),
        ("main", {}),
        ("div", {"class": re.compile(r"site-main")}),
    ]:
        tag_name, kwargs = selector
        found = soup.find(tag_name, **kwargs)
        if found:
            return found
    return soup


def extract_title(soup: BeautifulSoup) -> str:
    """Extract the exam title from the page."""
    # Prefer the page title
    if soup.title and soup.title.string:
        title = clean_text(soup.title.string)
        if title:
            return title
    # Fallback to the first <h1> inside the main content area
    main = find_main_content(soup)
    h1 = main.find("h1")
    if h1:
        return clean_text(h1.get_text(" ", strip=True))
    # Last resort: first <h1> anywhere
    h1 = soup.find("h1")
    if h1:
        return clean_text(h1.get_text(" ", strip=True))
    return "IT Exam Practice Test"


def scrape_questions(html: str, base_url: str = "") -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    main = find_main_content(soup)

    questions: List[Dict[str, Any]] = []
    current_question: Optional[Dict[str, Any]] = None
    current_options: List[Dict[str, Any]] = []
    base_question_text = ""
    collecting = False
    pending_image: Optional[str] = None

    def make_absolute(src: str) -> str:
        return urljoin(base_url, src.strip()) if base_url else src.strip()

    def extract_image_from_tag(tag: Tag) -> Optional[str]:
        img = tag.find("img")
        if img and img.get("src"):
            return make_absolute(img["src"])
        return None

    def flush_question():
        nonlocal current_question, current_options, collecting, pending_image
        if current_question and current_options:
            correct = [opt["text"] for opt in current_options if opt.get("correct")]
            options_text = [opt["text"] for opt in current_options]
            # Require at least one correct answer and not every option marked correct.
            if 0 < len(correct) < len(options_text):
                q = {
                    "question": current_question["text"],
                    "options": options_text,
                    "correct_answer": " | ".join(correct),
                }
                image = current_question.get("image") or pending_image
                if image:
                    q["image"] = image
                questions.append(q)
        current_question = None
        current_options = []
        collecting = False
        pending_image = None

    def start_question(text: str, image: Optional[str] = None):
        nonlocal current_question, current_options, collecting, base_question_text, pending_image
        flush_question()
        current_question = {"text": text, "image": image}
        current_options = []
        collecting = True
        # Remember the base question text to use for case variants.
        base_question_text = text

    def start_case(label: str, image: Optional[str] = None):
        nonlocal current_question, current_options, collecting, pending_image
        flush_question()
        # Use the most recent base question text as the stem, appending the case.
        stem = base_question_text or (questions[-1]["question"] if questions else "")
        if stem:
            current_question = {"text": f"{stem} [{label}]", "image": image}
        else:
            current_question = {"text": label, "image": image}
        current_options = []
        collecting = True

    # Walk the DOM in document order
    for elem in main.descendants:
        if not isinstance(elem, Tag):
            continue

        if elem.name in ("script", "style", "noscript"):
            continue

        # Capture images that appear before or inside a question.
        if elem.name == "img":
            src = elem.get("src")
            if src:
                pending_image = make_absolute(src)
            continue

        text = elem.get_text(" ", strip=True)
        if not text:
            continue

        # New numbered question
        if elem.name in ("p", "strong", "b", "li", "div") and is_question_start(text):
            cleaned = clean_text(text)
            cleaned = re.sub(r"^\d+\.\s*", "", cleaned)
            img = extract_image_from_tag(elem)
            # Prefer an image found inside the question element; otherwise use any pending image.
            start_question(cleaned, image=img or pending_image)
            continue

        # Case variant label (e.g. "Case 2:")
        if is_case_label(text):
            label, _ = extract_case_label(text)
            img = extract_image_from_tag(elem)
            start_case(label, image=img or pending_image)
            continue

        # Collect options from <li> elements
        if elem.name == "li" and collecting:
            option_text = clean_text(text)
            if not option_text:
                continue

            # Skip explanation/annotation lines that sometimes appear as list items
            if re.match(r"^(Explanation|Topic)\s*[\d:.]", option_text, re.IGNORECASE):
                continue

            classes = elem.get("class", [])
            is_correct = "correct_answer" in classes or has_red_text(elem)
            # Avoid adding duplicate options
            if not any(opt["text"] == option_text for opt in current_options):
                current_options.append({"text": option_text, "correct": is_correct})
            continue

        # Stop collecting when we hit a section heading that signals end of Q/A block
        if collecting and elem.name in ("h2", "h3", "h4", "h5", "h6"):
            if "explanation" in text.lower() or "topic" in text.lower():
                flush_question()
                collecting = False

    flush_question()

    # Post-process: assign ids, filter degenerate items, remove boilerplate, de-dupe
    seen = set()
    final = []
    for idx, q in enumerate(questions, start=1):
        if not q["options"]:
            continue
        if not q["correct_answer"]:
            continue
        q_text = q["question"]
        if q_text.lower().startswith(("it essentials", "how to find", "press ctrl")):
            continue
        key = (q_text, tuple(q["options"]))
        if key in seen:
            continue
        seen.add(key)
        item = {
            "id": idx,
            "question": q_text,
            "options": q["options"],
            "correct_answer": q["correct_answer"],
        }
        if q.get("image"):
            item["image"] = q["image"]
        final.append(item)

    return final


def generate_test(questions: List[Dict[str, Any]], n: int) -> List[Dict[str, Any]]:
    count = min(max(n, 1), len(questions))
    return random.sample(questions, count)


def scrape_url(url: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Fetch, parse, and return (title, questions) for a given URL."""
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    title = extract_title(soup)
    questions = scrape_questions(html, base_url=url)
    return title, questions


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TARGET_URL
    if not is_valid_itexamanswers_url(url):
        print(f"Error: '{url}' is not a valid itexamanswers.net URL.")
        sys.exit(1)
    print(f"Fetching {url} ...")
    title, questions = scrape_url(url)
    print(f"Title: {title}")
    print(f"Extracted {len(questions)} questions.")
    payload = {"title": title, "url": url, "questions": questions}
    with open(DEFAULT_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Saved to {DEFAULT_OUTPUT}")


if __name__ == "__main__":
    main()
