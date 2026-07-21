"""
Quiz Automation Bot
-------------------
Connects to an already-open Chrome instance via CDP (port 9222),
scrapes answers from an ITExamAnswers-style page, and automates
clicking the correct answers on the active quiz tab.

Usage:
    1. Launch Chrome with remote debugging (see README or instructions below).
    2. Open your quiz page in that Chrome instance.
    3. Run: python quiz_bot.py
    4. Paste the answer-source URL when prompted.
    5. The bot will match questions and click answers.

Requirements:
    pip install playwright beautifulsoup4 requests rapidfuzz
    python -m playwright install chromium
"""

import re
import time
import sys
import unicodedata
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup, Tag
from rapidfuzz import fuzz, process
from playwright.sync_api import sync_playwright, Page


# ─── Scraping Helpers ───────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """Normalize unicode and collapse whitespace."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def has_red_style(tag: Tag) -> bool:
    """Check if a tag or its children have red text styling (correct answer marker)."""
    style = tag.get("style", "")
    if re.search(r"color\s*:\s*#?ff0000", style, re.IGNORECASE):
        return True
    if re.search(r"color\s*:\s*red", style, re.IGNORECASE):
        return True
    for span in tag.find_all("span"):
        span_style = span.get("style", "")
        if re.search(r"color\s*:\s*#?ff0000", span_style, re.IGNORECASE):
            return True
        if re.search(r"color\s*:\s*red", span_style, re.IGNORECASE):
            return True
    return False


def fetch_and_parse(url: str) -> Dict[str, List[str]]:
    """
    Fetch the answer page and return a dict:
        { "question text": ["correct answer 1", "correct answer 2", ...] }
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    print(f"[*] Fetching: {url}")
    resp = requests.get(url, headers=headers, timeout=60)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Find the main content area
    main = None
    for selector in [
        ("div", {"class": re.compile(r"entry-content|post-content")}),
        ("article", {}),
        ("main", {}),
    ]:
        tag_name, kwargs = selector
        main = soup.find(tag_name, **kwargs)
        if main:
            break
    if not main:
        main = soup

    qa_dict: Dict[str, List[str]] = {}
    current_question: Optional[str] = None
    current_answers: List[str] = []

    def flush():
        nonlocal current_question, current_answers
        if current_question and current_answers:
            qa_dict[current_question] = current_answers
        current_question = None
        current_answers = []

    for elem in main.descendants:
        if not isinstance(elem, Tag):
            continue
        if elem.name in ("script", "style", "noscript"):
            continue

        text = clean_text(elem.get_text(" ", strip=True))
        if not text:
            continue

        # Detect numbered question start (e.g. "1. What is ...")
        if elem.name in ("p", "strong", "b", "li", "div", "h3", "h4"):
            if re.match(r"^\d+\.\s+", text):
                flush()
                current_question = re.sub(r"^\d+\.\s*", "", text)
                continue

        # Collect correct answers from <li> elements with red styling or correct_answer class
        if elem.name == "li" and current_question is not None:
            classes = elem.get("class", [])
            is_correct = "correct_answer" in classes or has_red_style(elem)
            if is_correct:
                answer_text = clean_text(text)
                if answer_text and answer_text not in current_answers:
                    current_answers.append(answer_text)

    flush()
    return qa_dict


# ─── Matching Helpers ───────────────────────────────────────────────────────────

def _strip_choose_suffix(text: str) -> str:
    """Remove '(Choose two)', 'Select 2', etc. from question text for better matching."""
    text = re.sub(r"\s*\(Choose\s+\w+\)\s*\.?\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*Select\s+\d+\s*\.?\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(Select\s+\w+\)\s*\.?\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*Choose\s+\d+\s*\.?\s*$", "", text, flags=re.IGNORECASE)
    return text.strip()


def find_best_question_match(
    quiz_question: str, qa_dict: Dict[str, List[str]], threshold: int = 60
) -> Optional[List[str]]:
    """
    Use fuzzy matching to find the closest question in qa_dict.
    Returns the list of correct answers or None if no match above threshold.
    """
    if not qa_dict:
        return None

    # Strip "Choose two" / "Select 2" suffixes from both sides for better matching
    cleaned_q = _strip_choose_suffix(quiz_question)
    keys = list(qa_dict.keys())
    cleaned_keys = [_strip_choose_suffix(k) for k in keys]

    result = process.extractOne(cleaned_q, cleaned_keys, scorer=fuzz.token_sort_ratio)
    if result is None:
        return None

    match_text, score, match_idx = result
    print(f"    [debug] Best match score: {score:.0f}% -> {keys[match_idx][:80]}")
    if score >= threshold:
        return qa_dict[keys[match_idx]]
    return None


def _clean_option_text(text: str) -> str:
    """Strip NetAcad suffixes like '3 of 4' and other noise from option labels."""
    # Remove trailing "N of M" pattern (e.g. "WPA2 3 of 4" -> "WPA2")
    text = re.sub(r"\s+\d+\s+of\s+\d+\s*$", "", text, flags=re.IGNORECASE)
    return text.strip()


SKIP_OPTIONS = {"skip all", "skip question", "submit", "next"}


def find_best_answer_match(
    correct_answers: List[str], option_texts: List[str], threshold: int = 55
) -> List[int]:
    """
    For each correct answer, find the best matching option index.
    Returns list of indices to click.
    """
    cleaned_opts = [_clean_option_text(o) for o in option_texts]
    indices_to_click: List[int] = []

    for answer in correct_answers:
        answer_lower = answer.lower().strip()
        print(f"    [debug] Matching answer: '{answer[:80]}'")
        matched = False

        # Strategy 1: Exact match (case-insensitive) on cleaned options
        for i, copt in enumerate(cleaned_opts):
            if answer_lower == copt.lower():
                if i not in indices_to_click:
                    indices_to_click.append(i)
                    print(f"    [debug]   -> Exact match at option {i}: '{copt}'")
                matched = True
                break

        if matched:
            continue

        # Strategy 2: Substring containment — answer contains option or vice versa
        for i, copt in enumerate(cleaned_opts):
            copt_lower = copt.lower()
            if copt_lower and (copt_lower in answer_lower or answer_lower in copt_lower):
                if i not in indices_to_click:
                    indices_to_click.append(i)
                    print(f"    [debug]   -> Substring match at option {i}: '{copt}'")
                matched = True
                break

        if matched:
            continue

        # Strategy 3: Fuzzy match
        result = process.extractOne(answer, cleaned_opts, scorer=fuzz.token_sort_ratio)
        if result:
            print(f"    [debug]   -> Fuzzy best: '{result[0][:60]}' score={result[1]:.0f}%")
            if result[1] >= threshold:
                idx = cleaned_opts.index(result[0])
                if idx not in indices_to_click:
                    indices_to_click.append(idx)

    return indices_to_click


# ─── Browser Automation ─────────────────────────────────────────────────────────

SKIP_TEXTS = {
    "your privacy", "cookie", "accept all", "manage preferences",
    "we use cookies", "privacy policy", "terms of service",
    "the exam consists", "you have unlimited", "skip all",
}


def _is_junk_text(text: str) -> bool:
    """Filter out cookie banners, privacy notices, instructions, and other non-question text."""
    lower = text.lower().strip()
    if len(lower) < 15:
        return True
    for skip in SKIP_TEXTS:
        if lower.startswith(skip):
            return True
    # Skip if it looks like an instruction block (mentions passing percentage, attempts, etc.)
    if "required to pass" in lower or "unlimited attempts" in lower:
        return True
    return False


def _get_quiz_frame(page: Page):
    """
    NetAcad (and similar platforms) often embed quizzes in nested iframes.
    Walk ALL frames and return the one with radio/checkbox inputs.
    """
    # Strategy 1: find frame with radio/checkbox inputs
    for frame in page.frames:
        if frame == page.main_frame:
            continue
        try:
            radios = frame.query_selector_all("input[type='radio'], input[type='checkbox']")
            if len(radios) >= 2:
                print(f"    [debug] Found quiz frame with {len(radios)} inputs")
                return frame
        except Exception:
            continue

    # Strategy 2: find frame with the most <p> tags
    best_frame = None
    best_count = 0
    for frame in page.frames:
        if frame == page.main_frame:
            continue
        try:
            ps = frame.query_selector_all("p")
            if len(ps) > best_count:
                best_count = len(ps)
                best_frame = frame
        except Exception:
            continue

    if best_frame:
        print(f"    [debug] Fallback: frame with {best_count} paragraphs")
        return best_frame

    print("    [debug] No quiz frame found, using main page")
    return page


def get_question_text(target) -> str:
    """Extract the current question by finding the unchecked input group's nearby paragraph.
    
    NetAcad keeps all questions visible in the DOM. We find the first UNCHECKED
    visible radio/checkbox, then walk backwards through the DOM to find the
    question paragraph that belongs to it.
    """
    # Strategy: find the LAST visible non-junk paragraph.
    # NetAcad appends new questions to the DOM, so the last one is the current.
    # We also track how many visible question paragraphs there are.
    try:
        paragraphs = target.query_selector_all("p")
        last_q = ""
        for p in paragraphs:
            try:
                if not p.is_visible():
                    continue
            except Exception:
                continue
            text = clean_text(p.inner_text())
            if text and not _is_junk_text(text) and len(text) > 20:
                last_q = text
        if last_q:
            return last_q
    except Exception:
        pass

    return ""


def get_options(target) -> List[dict]:
    """
    Get answer options from the page/frame.
    Returns list of dicts: [{"text": "...", "element": <ElementHandle>}, ...]
    
    NetAcad keeps all questions in the DOM. We identify the LAST group of
    consecutive same-type inputs (radio or checkbox) as the current question.
    """
    options = []
    seen_texts = set()

    try:
        inputs = target.query_selector_all("input[type='radio'], input[type='checkbox']")
        if not inputs:
            return options

        # Determine group size from "N of M" pattern in labels, or use name attr.
        # Strategy: check the last input's label for "X of Y" to know the group size.
        group_size = target.evaluate("""
            () => {
                const inputs = [...document.querySelectorAll('input[type="radio"], input[type="checkbox"]')];
                if (inputs.length === 0) return 0;
                
                const lastInput = inputs[inputs.length - 1];
                const lastName = lastInput.getAttribute('name') || '';
                
                // For radio buttons: same name = same question
                if (lastInput.type === 'radio' && lastName) {
                    let count = 0;
                    inputs.forEach(inp => {
                        if (inp.getAttribute('name') === lastName) count++;
                    });
                    if (count > 1) return count;
                }
                
                // Check for "X of Y" pattern in the last input's label
                let labelText = '';
                const id = lastInput.getAttribute('id');
                if (id) {
                    const label = document.querySelector('label[for="' + id + '"]');
                    if (label) labelText = label.innerText;
                }
                if (!labelText) {
                    const parentLabel = lastInput.closest('label');
                    if (parentLabel) labelText = parentLabel.innerText;
                }
                if (!labelText && lastInput.parentElement) {
                    labelText = lastInput.parentElement.innerText;
                }
                
                // Match "X of Y" pattern
                const match = labelText.match(/(\\d+)\\s+of\\s+(\\d+)/i);
                if (match) return parseInt(match[2]);
                
                // Fallback: count unchecked inputs at the end
                let count = 0;
                for (let i = inputs.length - 1; i >= 0; i--) {
                    if (!inputs[i].checked) count++;
                    else break;
                }
                return count || 4;
            }
        """)
        
        # Take the last `group_size` inputs
        group_size = max(group_size, 2)  # at least 2
        last_group = inputs[-group_size:] if len(inputs) > group_size else inputs
        
        for inp in last_group:
            label_text = ""
            clickable = None

            # Try label[for=id]
            inp_id = inp.get_attribute("id")
            if inp_id:
                label = target.query_selector(f"label[for='{inp_id}']")
                if label:
                    label_text = clean_text(label.inner_text())
                    clickable = label

            # Try parent label
            if not label_text:
                try:
                    parent_label = inp.evaluate_handle("el => el.closest('label')")
                    if parent_label and parent_label.as_element():
                        label_text = clean_text(parent_label.as_element().inner_text())
                        clickable = parent_label.as_element()
                except Exception:
                    pass

            # Try parent element text
            if not label_text:
                try:
                    parent = inp.evaluate_handle("el => el.parentElement")
                    if parent and parent.as_element():
                        label_text = clean_text(parent.as_element().inner_text())
                        clickable = parent.as_element()
                except Exception:
                    pass

            # Try next sibling element (some UIs put label as a sibling after input)
            if not label_text:
                try:
                    sibling = inp.evaluate_handle("el => el.nextElementSibling")
                    if sibling and sibling.as_element():
                        label_text = clean_text(sibling.as_element().inner_text())
                        clickable = sibling.as_element()
                except Exception:
                    pass

            # Try grandparent text (input > wrapper > container with text)
            if not label_text:
                try:
                    grandparent = inp.evaluate_handle("el => el.parentElement ? el.parentElement.parentElement : null")
                    if grandparent and grandparent.as_element():
                        gp_text = clean_text(grandparent.as_element().inner_text())
                        if gp_text and len(gp_text) < 200:
                            label_text = gp_text
                            clickable = grandparent.as_element()
                except Exception:
                    pass

            # Last resort: use the input itself with JS to get any nearby text
            if not label_text:
                try:
                    label_text = inp.evaluate("""el => {
                        // Try aria-label
                        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
                        // Try title
                        if (el.title) return el.title;
                        // Try value
                        if (el.value && el.value.length > 1) return el.value;
                        return '';
                    }""")
                    label_text = clean_text(label_text) if label_text else ""
                except Exception:
                    pass

            if not clickable:
                clickable = inp

            if label_text and label_text not in seen_texts:
                if label_text.lower().strip() not in SKIP_OPTIONS:
                    seen_texts.add(label_text)
                    options.append({"text": label_text, "element": clickable})
    except Exception:
        pass

    if options:
        return options

    # Fallback: Try label selectors
    selectors = ["label", ".form-check-label"]
    for sel in selectors:
        try:
            elements = target.query_selector_all(sel)
            for el in elements:
                text = clean_text(el.inner_text())
                if text and len(text) > 1 and text not in seen_texts:
                    if text.lower().strip() not in SKIP_OPTIONS:
                        seen_texts.add(text)
                        options.append({"text": text, "element": el})
        except Exception:
            continue
        if options:
            break

    return options


def click_next_button(target) -> bool:
    """Try to find and click the LAST VISIBLE 'Submit' / 'Next' button."""
    selectors = [
        "button:has-text('Submit')",
        "input[value='Submit']",
        "a:has-text('Submit')",
        "button:has-text('Next')",
        "input[value='Next']",
        "a:has-text('Next')",
        ".next-btn",
        ".btn-next",
        "button[type='submit']",
    ]
    for sel in selectors:
        try:
            # Get ALL matching elements and pick the LAST visible one
            elements = target.query_selector_all(sel)
            last_visible = None
            for el in elements:
                try:
                    if el.is_visible():
                        last_visible = el
                except Exception:
                    continue
            if last_visible:
                try:
                    last_visible.click(timeout=3000)
                except Exception:
                    last_visible.evaluate("el => el.click()")
                return True
        except Exception:
            continue
    return False


def run_bot():
    """Main bot loop."""
    print("=" * 60)
    print("  QUIZ AUTOMATION BOT")
    print("=" * 60)
    print()

    # Step 1: Get the answer source URL
    url = input("Enter the ITExamAnswers URL: ").strip()
    if not url:
        print("[!] No URL provided. Exiting.")
        sys.exit(1)

    # Step 2: Scrape answers
    try:
        qa_dict = fetch_and_parse(url)
    except Exception as e:
        print(f"[!] Failed to fetch/parse the URL: {e}")
        sys.exit(1)

    print(f"[+] Scraped {len(qa_dict)} questions with answers.")
    if not qa_dict:
        print("[!] No questions found. Check the URL and page structure.")
        sys.exit(1)

    # Step 3: Ask for automation mode
    print()
    print("Automation mode:")
    print("  [1] Auto-advance (click Next automatically after each question)")
    print("  [2] Manual advance (wait for Enter before clicking Next)")
    mode = input("Choose mode [1/2] (default=2): ").strip()
    auto_advance = mode == "1"

    # Step 4: Connect to Chrome via CDP
    print()
    print("[*] Connecting to Chrome on localhost:9222 ...")
    print("    (Make sure Chrome is running with --remote-debugging-port=9222)")
    print()

    with sync_playwright() as pw:
        try:
            browser = pw.chromium.connect_over_cdp("http://localhost:9222")
        except Exception as e:
            print(f"[!] Failed to connect to Chrome: {e}")
            print()
            print("Launch Chrome with debugging enabled:")
            print('  macOS:')
            print('    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\')
            print('      --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"')
            print()
            print('  Windows:')
            print('    chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\temp\\chrome-debug"')
            sys.exit(1)

        context = browser.contexts[0]
        page = context.pages[0]
        print(f"[+] Connected! Active page: {page.url}")

        # Detect quiz iframe (common on NetAcad and similar platforms)
        target = _get_quiz_frame(page)
        if target != page:
            print("[+] Detected quiz iframe — targeting it.")
        else:
            print("[*] No iframe detected — targeting main page.")
        print()

        def count_visible_questions(t) -> int:
            """Count visible non-junk paragraphs (each = one question)."""
            try:
                paragraphs = t.query_selector_all("p")
                count = 0
                for p in paragraphs:
                    try:
                        if not p.is_visible():
                            continue
                    except Exception:
                        continue
                    text = clean_text(p.inner_text())
                    if text and not _is_junk_text(text) and len(text) > 20:
                        count += 1
                return count
            except Exception:
                return 0

        # Step 5: Automation loop
        question_num = 0
        prev_q_count = 0
        while True:
            question_num += 1
            print(f"--- Question #{question_num} ---")

            # Wait for a new question paragraph to appear in the DOM
            time.sleep(2)
            target = _get_quiz_frame(page)

            # Poll until new question appears (paragraph count increases OR input count changes)
            q_text = ""
            prev_inputs = 0
            try:
                prev_inputs = len(target.query_selector_all("input[type='radio'], input[type='checkbox']"))
            except Exception:
                pass

            for attempt in range(10):
                target = _get_quiz_frame(page)
                cur_count = count_visible_questions(target)
                cur_inputs = 0
                try:
                    cur_inputs = len(target.query_selector_all("input[type='radio'], input[type='checkbox']"))
                except Exception:
                    pass
                q_text = get_question_text(target)

                if question_num == 1:
                    if q_text:
                        prev_q_count = cur_count
                        break
                else:
                    # New question detected if paragraph count OR input count changed
                    if (cur_count > prev_q_count or cur_inputs > prev_inputs) and q_text:
                        prev_q_count = cur_count
                        break

                print(f"    [debug] Waiting for new question... (visible_qs={cur_count}, prev={prev_q_count}, inputs={cur_inputs}, attempt {attempt + 1})")
                time.sleep(1.5)

            # Debug
            frame_url = getattr(target, 'url', 'unknown')
            print(f"    [debug] Target frame: {frame_url[:80]}")
            print(f"    [debug] Total frames: {len(page.frames)}")

            if not q_text:
                print("[!] Could not read question text from the page.")
                action = input("    Press Enter to retry, or type 'quit' to exit: ").strip()
                if action.lower() == "quit":
                    break
                question_num -= 1
                continue

            print(f"[Q] {q_text[:120]}{'...' if len(q_text) > 120 else ''}")

            # Fuzzy match to our answer bank
            correct_answers = find_best_question_match(q_text, qa_dict)
            if not correct_answers:
                print("[!] No matching question found in the answer bank.")
                print("    Skipping — please answer manually.")
                input("    Press Enter when ready for next question...")
                prev_q_count = count_visible_questions(target)
                continue

            print(f"[A] Correct: {correct_answers}")

            # Get options on the page/frame
            options = get_options(target)
            if not options:
                print("[!] Could not find answer options on the page.")
                input("    Press Enter when ready for next question...")
                prev_q_count = count_visible_questions(target)
                continue

            option_texts = [o["text"] for o in options]
            print(f"    Options found: {len(option_texts)}")
            for oi, ot in enumerate(option_texts):
                print(f"      [{oi}] {ot}")

            # Match correct answers to page options
            indices = find_best_answer_match(correct_answers, option_texts)
            if not indices:
                print("[!] Could not match any correct answer to the displayed options.")
                print(f"    Options on page: {option_texts}")
                input("    Press Enter when ready for next question...")
                prev_q_count = count_visible_questions(target)
                continue

            # Warn if not all answers matched (e.g. Choose two but only found one)
            if len(indices) < len(correct_answers):
                print(f"    [!] Only matched {len(indices)}/{len(correct_answers)} answers!")
                print(f"    Missing answers won't be selected. Please answer manually.")
                input("    Press Enter when ready for next question...")
                prev_q_count = count_visible_questions(target)
                continue

            # Click the matched options
            for idx in indices:
                print(f"    -> Clicking: {option_texts[idx]}")
                try:
                    options[idx]["element"].click(timeout=5000)
                except Exception:
                    # Fallback: force click or JS click
                    try:
                        options[idx]["element"].click(force=True, timeout=3000)
                    except Exception:
                        try:
                            options[idx]["element"].evaluate("el => el.click()")
                        except Exception as e:
                            print(f"    [!] Click failed: {e}")
                time.sleep(0.5)

            time.sleep(1)

            # Advance to next question
            if auto_advance:
                print("    [Auto] Clicking Submit...")
                time.sleep(1)
                if not click_next_button(target):
                    print("[!] Could not find Submit/Next button.")
                    input("    Press Enter to continue...")
            else:
                resp = input("    Press Enter to click Submit (or type 'quit' to stop): ").strip()
                if resp.lower() == "quit":
                    break
                if not click_next_button(target):
                    print("[!] Could not find Submit button. Navigate manually.")
                    input("    Press Enter when ready...")

        print()
        print("[*] Bot finished. Disconnecting.")
        browser.close()


if __name__ == "__main__":
    run_bot()
