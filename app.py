import copy
import datetime
import fcntl
import html as html_lib
import json
import os
import random
import re
import secrets
import threading
import time
from pathlib import Path
from typing import Optional

from flask import Flask, abort, jsonify, request, redirect, Response, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash

from scraper import scrape_url, is_valid_itexamanswers_url, DEFAULT_TARGET_URL, DEFAULT_OUTPUT

app = Flask(__name__, static_folder="static", static_url_path="")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SITE_URL = "https://www.answrit.net"
DEFAULT_PAGE_TITLE = "AnswrIT - Free Practice Tests, Flashcards & Study Guides for Cisco ITE & CCNA"
DEFAULT_PAGE_DESCRIPTION = "AnswrIT is a free interactive study platform for Cisco IT Essentials, CCNA, and Netacad exams. Take practice tests, flip flashcards, track mastery, and play interactive study games."


@app.after_request
def set_api_cache_headers(response):
    """Prevent browsers and proxies from caching API responses."""
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

QUESTIONS_FILE = BASE_DIR / DEFAULT_OUTPUT
USERS_FILE = BASE_DIR / "users.json"
USER_DATA_FILE = BASE_DIR / "user_data.json"
CHAT_FILE = BASE_DIR / "chat.json"
DM_FILE = BASE_DIR / "dms.json"  # private conversations (DMs and group chats)
SECRET_FILE = BASE_DIR / ".flask_secret"

if SECRET_FILE.exists():
    app.secret_key = SECRET_FILE.read_text(encoding="utf-8").strip()
else:
    app.secret_key = secrets.token_hex(32)
    SECRET_FILE.write_text(app.secret_key, encoding="utf-8")


# In-memory state for the currently loaded exam
app_state = {
    "title": None,
    "url": None,
    "filename": None,
    "questions": [],
}

# In-memory cache for exam questions to avoid repeated disk reads.
# Maps absolute file path -> (mtime, parsed data).
_exam_cache = {}

# In-memory store for anonymous session activity used by the public
# "active now" counter. Resets when the web worker restarts.
_active_sessions = {}


def load_exam_manifest() -> list:
    manifest_path = DATA_DIR / "exams.json"
    if not manifest_path.exists():
        return []
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        return manifest.get("exams", [])
    except Exception:
        return []


def exam_by_slug(slug: str):
    filename = f"{slug}.json"
    for exam in load_exam_manifest():
        if exam.get("filename") == filename:
            return exam
    return None


# ─── Search engines ─────────────────────────────────────────────────────────
# Every page ships real, readable HTML inside <main id="view"> (headings, the exam list, and on exam pages
# every question with its answer). Google reads it straight away; the app replaces it when it starts.
SEO_COURSES = [
    ("it-essentials", "IT Essentials (ITE) 7.0 / 8.0"),
    ("ccna-1", "CCNA 1 v7: Introduction to Networks (ITN)"),
    ("ccna-2", "CCNA 2 v7: Switching, Routing and Wireless Essentials (SRWE)"),
]
HINTS_DIR = BASE_DIR / "static" / "beta" / "hints"


def seo_course_of(filename: str):
    return next(((pre, name) for pre, name in SEO_COURSES if filename.startswith(pre)), (None, "Other exams"))


def seo_exam_name(exam: dict) -> str:
    """'CCNA 1 v7 Modules 1-3: Basic Network Connectivity and Communications Exam' (no 'Answers')."""
    t = exam.get("title") or display_name_for(exam.get("filename", ""), exam.get("display_name", ""))
    t = re.sub(r"\s+-\s+", " - ", t)
    t = re.sub(r"(\d+)\s+-\s+(\d+)", r"\1-\2", t)
    t = re.sub(r"\s*\bAnswers\b\s*(Full\b)?", " ", t).strip()
    t = t.replace("IT Essentials 7.0 8.0", "IT Essentials 7.0 / 8.0").replace("Exam Full", "Exam")
    t = re.sub(r"\s{2,}", " ", t).strip(" -")
    return t


def _esc(s) -> str:
    return html_lib.escape(str(s if s is not None else ""), quote=True)


def _load_hints(filename: str) -> dict:
    p = HINTS_DIR / filename
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except Exception:
        return {}


def _exam_questions(filename: str) -> list:
    try:
        data = json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))
        return data.get("questions", []) if isinstance(data, dict) else data
    except Exception:
        return []


def seo_exam_links_html(current: str = "") -> str:
    """Every exam, grouped by course, as plain links."""
    groups = {}
    for exam in load_exam_manifest():
        fn = exam.get("filename", "")
        if not fn.endswith(".json") or fn == current:
            continue
        groups.setdefault(seo_course_of(fn)[1], []).append(exam)
    out = []
    for _, cname in SEO_COURSES:
        exams = groups.get(cname)
        if not exams:
            continue
        items = "".join(
            f'<li><a href="/exams/{_esc(e["filename"][:-5])}/">{_esc(seo_exam_name(e))} Answers</a> '
            f'<span class="seo-n">({int(e.get("count") or 0)} questions)</span></li>' for e in exams)
        out.append(f"<h2>{_esc(cname)}</h2><ul class=\"seo-links\">{items}</ul>")
    return "".join(out)


def seo_home_html(h1: str, intro: str) -> str:
    return (
        '<article class="seo-page">'
        f"<h1>{_esc(h1)}</h1><p>{_esc(intro)}</p>"
        "<p>Every IT Essentials, CCNA 1 and CCNA 2 exam on AnswrIT has all of its questions with the correct answers, "
        "and you can turn each one into a free practice test, flashcards, or Mastery mode (it keeps asking until you know every question). "
        "There are also Packet Tracer practice labs that look and grade like the real skills exams, a CLI simulator, "
        "subnetting practice and short study games.</p>"
        f"{seo_exam_links_html()}"
        "<h2>Packet Tracer skills exam practice</h2>"
        "<p>Practice the CCNA 2 Packet Tracer skills assessments in your browser: VLANs, trunks, router-on-a-stick, SSH, "
        "IPv6, and static, default and floating routes. Every version has new names and addresses, and it grades your work like Packet Tracer.</p>"
        "</article>"
    )


def _answers_of(q: dict) -> list:
    ca = q.get("correct_answer")
    if isinstance(ca, list):
        return [str(x) for x in ca]
    return [x.strip() for x in str(ca or "").split(" | ") if x.strip()]


def seo_exam_html(exam: dict) -> str:
    fn = exam["filename"]
    name = seo_exam_name(exam)
    qs = _exam_questions(fn)
    hints = _load_hints(fn)
    course = seo_course_of(fn)[1]
    rows = []
    for i, q in enumerate(qs, 1):
        text = q.get("question", "")
        if q.get("type") == "matching" and q.get("correct_pairs"):
            pairs = q["correct_pairs"]
            items = pairs.items() if isinstance(pairs, dict) else [(p[0], p[1]) if isinstance(p, (list, tuple)) else (p.get("term"), p.get("definition")) for p in pairs]
            body = "<ul>" + "".join(f"<li>{_esc(a)} → <strong>{_esc(b)}</strong></li>" for a, b in items) + "</ul>"
        else:
            ans = set(_answers_of(q))
            opts = q.get("options") or []
            body = "<ul>" + "".join(
                f"<li>{'<strong>' + _esc(o) + ' (correct)</strong>' if o in ans else _esc(o)}</li>" for o in opts) + "</ul>"
            if ans:
                body += f'<p class="seo-ans"><strong>Answer:</strong> {_esc(" / ".join(_answers_of(q)))}</p>'
        h = hints.get(str(q.get("id", i))) or {}
        if h.get("why"):
            body += f'<p class="seo-tip"><strong>Why:</strong> {_esc(h["why"])}</p>'
        if h.get("tip"):
            body += f'<p class="seo-tip"><strong>Remember:</strong> {_esc(h["tip"])}</p>'
        page = question_slug_for(fn, q.get("id", i))
        head = f'<a href="/questions/{_esc(page)}/">{_esc(text)}</a>' if page else _esc(text)
        rows.append(f'<li id="q{_esc(q.get("id", i))}"><h3>{head}</h3>{body}</li>')
    start = f"/#/exam/{_esc(fn)}"
    return (
        '<article class="seo-page">'
        f'<p class="seo-crumbs"><a href="/">AnswrIT</a> › {_esc(course)}</p>'
        f"<h1>{_esc(name)} Answers</h1>"
        f"<p>All {len(qs)} questions from the {_esc(name)} with the correct answers{', a short explanation of why each answer is right, and a memory trick' if hints else ''}. "
        f"Study them here, then take a free practice test, flip through flashcards, or use Mastery mode until you know every one.</p>"
        f'<p><a class="seo-btn" href="{start}">Start the free practice test</a></p>'
        f"<h2>All {len(qs)} {_esc(name)} questions and answers</h2>"
        f'<ol class="seo-qs">{"".join(rows)}</ol>'
        f"<h2>More exam answers</h2>{seo_exam_links_html(fn)}"
        "</article>"
    )


# ── One page per question: /questions/<slug>/ ──
# Students search the exact question text, so each unique question gets its own page with the answer,
# a short explanation and a memory trick. Questions that need a picture (exhibit) are left out.
_QINDEX = {"built": 0.0, "by_slug": {}, "by_ref": {}}


def _slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    s = re.sub(r"^(refer-to-the-exhibit-|match-the-)", "", s)
    if len(s) > 90:
        s = s[:90].rsplit("-", 1)[0]
    return s or "question"


def question_index() -> dict:
    """Unique questions across all exams -> {slug: {exam, q, also: [exam filenames]}}; rebuilt when data changes."""
    files = [DATA_DIR / "exams.json"] + [DATA_DIR / e.get("filename", "") for e in load_exam_manifest()]
    stamp = max((p.stat().st_mtime for p in files if p.exists()), default=0.0)
    hint_dir_stamp = max((p.stat().st_mtime for p in HINTS_DIR.glob("*.json")), default=0.0) if HINTS_DIR.exists() else 0.0
    stamp = max(stamp, hint_dir_stamp)
    if _QINDEX["built"] == stamp:
        return _QINDEX
    norm = lambda s: re.sub(r"\W+", " ", str(s).lower()).strip()
    by_key, by_slug, by_ref = {}, {}, {}
    for exam in load_exam_manifest():
        fn = exam.get("filename", "")
        for q in _exam_questions(fn):
            if not q.get("question") or q.get("image") or q.get("option_images"):
                continue
            key = (norm(q["question"]), norm(q.get("correct_answer") or q.get("correct_pairs")))
            entry = by_key.get(key)
            if not entry:
                slug = base = _slugify(q["question"])
                n = 2
                while slug in by_slug:
                    slug = f"{base}-{n}"; n += 1
                entry = by_key[key] = {"slug": slug, "exam": fn, "q": q, "also": []}
                by_slug[slug] = entry
            if fn not in entry["also"]:
                entry["also"].append(fn)
            by_ref[(fn, str(q.get("id")))] = entry["slug"]
    _QINDEX.update(built=stamp, by_slug=by_slug, by_ref=by_ref)
    return _QINDEX


def question_slug_for(filename: str, qid) -> str:
    return question_index()["by_ref"].get((filename, str(qid)), "")


def seo_question_page(entry: dict) -> dict:
    q, fn = entry["q"], entry["exam"]
    exams = {e["filename"]: e for e in load_exam_manifest()}
    h = _load_hints(fn).get(str(q.get("id"))) or {}
    ans = _answers_of(q)
    text = q["question"]
    if q.get("type") == "matching" and q.get("correct_pairs"):
        p = q["correct_pairs"]
        items = p.items() if isinstance(p, dict) else [(x[0], x[1]) for x in p]
        body = "<ul>" + "".join(f"<li>{_esc(a)} → <strong>{_esc(b)}</strong></li>" for a, b in items) + "</ul>"
        ans_text = "; ".join(f"{a} → {b}" for a, b in items)
    else:
        ans_set = set(ans)
        body = "<ul>" + "".join(f"<li>{'<strong>' + _esc(o) + ' (correct)</strong>' if o in ans_set else _esc(o)}</li>" for o in (q.get("options") or [])) + "</ul>"
        ans_text = " / ".join(ans)
    body += f'<p class="seo-ans"><strong>Answer:</strong> {_esc(ans_text)}</p>'
    if h.get("why"):
        body += f'<h2>Why this is the answer</h2><p>{_esc(h["why"])}</p>'
    if h.get("tip"):
        keys = ", ".join(k["k"] if isinstance(k, dict) else k for k in h.get("keys", []))
        body += f'<h2>How to remember it</h2><p>{_esc(h["tip"])}</p>'
        if keys:
            body += f'<p>Look for these words in the right answer: <strong>{_esc(keys)}</strong></p>'
    names = [(f, seo_exam_name(exams[f])) for f in entry["also"] if f in exams]
    body += "<h2>This question is on</h2><ul class=\"seo-links\">" + "".join(
        f'<li><a href="/exams/{_esc(f[:-5])}/">{_esc(n)} Answers</a></li>' for f, n in names) + "</ul>"
    body += f'<p><a class="seo-btn" href="/#/exam/{_esc(fn)}">Practice the whole exam</a></p>'
    # A few other questions from the same exam, for readers and for search engines.
    idx = question_index()["by_slug"]
    sibs = [e for e in idx.values() if e["exam"] == fn and e["slug"] != entry["slug"]]
    pos = next((i for i, e in enumerate(sibs) if str(e["q"].get("id")) > str(q.get("id"))), 0)
    more = (sibs[pos:] + sibs[:pos])[:6]
    if more:
        body += "<h2>More questions from this exam</h2><ul class=\"seo-links\">" + "".join(
            f'<li><a href="/questions/{_esc(e["slug"])}/">{_esc(e["q"]["question"])}</a></li>' for e in more) + "</ul>"
    course = seo_course_of(fn)[1]
    html_out = (f'<article class="seo-page"><p class="seo-crumbs"><a href="/">AnswrIT</a> › '
                f'<a href="/exams/{_esc(fn[:-5])}/">{_esc(names[0][1] if names else course)}</a></p>'
                f"<h1>{_esc(text)}</h1>{body}</article>")
    short_q = text if len(text) <= 80 else text[:77].rsplit(" ", 1)[0] + "…"
    desc = f"Answer: {ans_text}. {h.get('why', '')}".strip()
    if len(desc) > 158:
        desc = desc[:155].rsplit(" ", 1)[0] + "…"
    ld = {"@context": "https://schema.org", "@type": "Quiz", "name": text,
          "about": {"@type": "Thing", "name": course},
          "hasPart": [{"@type": "Question", "eduQuestionType": "Flashcard", "text": text,
                       "acceptedAnswer": {"@type": "Answer", "text": ans_text}}]}
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    return {"title": f"{short_q} | Answer & Explanation | AnswrIT", "description": desc, "html": html_out,
            "jsonld": f'<script type="application/ld+json">{ld_json}</script>'}


def seo_exam_jsonld(exam: dict) -> str:
    """Quiz markup (Google's education Q&A format: flashcard questions with an accepted answer)."""
    fn = exam["filename"]
    name = seo_exam_name(exam)
    parts = []
    for q in _exam_questions(fn):
        ans = _answers_of(q)
        if q.get("type") == "matching" or not ans or not q.get("question"):
            continue
        parts.append({"@type": "Question", "eduQuestionType": "Flashcard", "text": q["question"],
                      "acceptedAnswer": {"@type": "Answer", "text": " / ".join(ans)}})
    data = {
        "@context": "https://schema.org", "@type": "Quiz", "name": f"{name} Answers",
        "about": {"@type": "Thing", "name": seo_course_of(fn)[1]},
        "educationalAlignment": {"@type": "AlignmentObject", "alignmentType": "educationalSubject", "targetName": "Computer networking"},
        "url": f"{SITE_URL}/exams/{fn[:-5]}/", "hasPart": parts,
    }
    breadcrumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "AnswrIT", "item": f"{SITE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": f"{name} Answers", "item": f"{SITE_URL}/exams/{fn[:-5]}/"},
        ],
    }
    dump = lambda d: json.dumps(d, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/ld+json">{dump(data)}</script><script type="application/ld+json">{dump(breadcrumbs)}</script>'


def build_exam_links_html() -> str:
    items = []
    for exam in load_exam_manifest():
        filename = exam.get("filename", "")
        if not filename.endswith(".json"):
            continue
        slug = filename[:-5]
        display = display_name_for(filename, exam.get("display_name", ""))
        items.append(f'<li><a href="{SITE_URL}/exams/{slug}/">{display} answers</a></li>')
    return f'<ul class="exam-links">{ "".join(items) }</ul>' if items else ""


# The redesigned site (Nov 2026) serves every page. The classic page
# (static/index.html) is retired; add a path to CLASSIC_PATHS to serve it again.
NEW_INDEX = BASE_DIR / "static" / "beta" / "index.html"
CLASSIC_INDEX = BASE_DIR / "static" / "index.html"
CLASSIC_PATHS: set = set()


def render_index_html(page_title: str, page_description: str, canonical_url: str,
                      h1_text: str, seo_intro: str, exam_filename: str = "",
                      index_path: Path = NEW_INDEX, view_html: str = "", extra_head: str = "") -> Response:
    html = index_path.read_text(encoding="utf-8")
    replacements = {
        "$PAGE_TITLE$": page_title,
        "$PAGE_DESCRIPTION$": page_description,
        "$CANONICAL_URL$": canonical_url,
        "$OG_URL$": canonical_url,
        "$SITE_URL$": SITE_URL,
        "$H1_TEXT$": h1_text,
        "$SEO_INTRO$": seo_intro,
        "$EXAM_FILENAME$": exam_filename,
        "$EXAM_LINKS$": build_exam_links_html(),
        "$VIEW_HTML$": view_html or seo_home_html(h1_text, seo_intro),
        "$EXTRA_HEAD$": extra_head,
    }
    for token, value in replacements.items():
        html = html.replace(token, value)
    # Prevent caching of index.html so the latest cache-busted static files are
    # always loaded after a deploy.
    response = Response(html, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def load_exam_from_file(filepath: Path) -> bool:
    """Load a specific exam JSON file into app_state."""
    if not filepath.exists():
        return False
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return False
    if isinstance(data, dict) and "questions" in data:
        app_state["title"] = data.get("title")
        app_state["url"] = data.get("url")
        app_state["filename"] = filepath.name
        app_state["questions"] = data.get("questions", [])
        return True
    return False


def load_local_data():
    """Load saved questions.json if it exists and is in the new format."""
    if not QUESTIONS_FILE.exists():
        return None, None, []
    try:
        with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None, None, []
    if isinstance(data, dict) and "questions" in data:
        return data.get("title"), data.get("url"), data.get("questions", [])
    # Legacy format: plain list of questions
    return None, None, data if isinstance(data, list) else []


def load_default_exam():
    """Try to load the first pre-scraped exam, otherwise fall back to questions.json."""
    manifest_path = DATA_DIR / "exams.json"
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            exams = manifest.get("exams", [])
            if exams:
                load_exam_from_file(DATA_DIR / exams[0]["filename"])
                return
        except Exception:
            pass
    # Fallback to legacy questions.json
    title, url, questions = load_local_data()
    app_state["title"] = title
    app_state["url"] = url
    app_state["questions"] = questions


def get_current_questions():
    if not app_state["questions"]:
        load_default_exam()
    return app_state["questions"]


def get_current_title():
    get_current_questions()
    return app_state["title"] or "IT Exam Practice Test"


def get_current_url():
    get_current_questions()
    return app_state["url"] or DEFAULT_TARGET_URL


def _load_exam_cached(filepath: Path):
    """Load exam data with an in-memory mtime cache."""
    key = str(filepath)
    try:
        mtime = filepath.stat().st_mtime
    except OSError:
        mtime = None
    cached = _exam_cache.get(key)
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None
    if mtime is not None:
        _exam_cache[key] = (mtime, data)
    return data


def get_questions_for_test(filename: str = ""):
    """Load questions for a test request, using a specific file if provided."""
    if filename:
        filepath = DATA_DIR / filename
        data = _load_exam_cached(filepath)
        if data and isinstance(data, dict) and "questions" in data:
            return data.get("questions", [])
    return get_current_questions()


# ---------------------------------------------------------------------------
# User accounts and mastery progress
# ---------------------------------------------------------------------------

def _load_json_file(file: Path, name: str) -> dict:
    """Load a JSON dict from disk with a friendly error message."""
    if not file.exists():
        return {}
    try:
        with open(file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as err:
        app.logger.exception("Unable to load %s: %s", name, err)
        raise RuntimeError(f"{name} is temporarily unavailable. Please try again shortly.") from err
    if not isinstance(data, dict):
        app.logger.error("%s has an invalid format", name)
        raise RuntimeError(f"{name} is temporarily unavailable. Please try again shortly.")
    return data


# ── In-memory copies of the JSON data files ────────────────────────────────
# user_data.json is tens of MB; parsing it took ~0.4 s on every request. We keep the
# parsed dict in memory and only re-read when the file's mtime/size changes (for example
# after a restore). All writes go through _write_json_file, which refreshes the cache.
# Readers never get the cached objects themselves: they get deep copies (of one user's
# record for user_data), so nothing a request changes can leak into the shared copy.
_JSON_CACHE: dict = {}
_JSON_CACHE_LOCK = threading.RLock()


def _file_key(file: Path):
    try:
        st = file.stat()
    except FileNotFoundError:
        return None
    return (st.st_mtime_ns, st.st_size)


def _cache_store(file: Path, data: dict) -> None:
    with _JSON_CACHE_LOCK:
        _JSON_CACHE[str(file)] = (_file_key(file), data)


def _cache_drop(file: Path) -> None:
    with _JSON_CACHE_LOCK:
        _JSON_CACHE.pop(str(file), None)


def _load_json_cached(file: Path, name: str) -> dict:
    """Return the shared parsed copy of a JSON file. Callers must not modify it."""
    key = _file_key(file)
    if key is None:
        return {}
    with _JSON_CACHE_LOCK:
        hit = _JSON_CACHE.get(str(file))
        if hit and hit[0] == key:
            return hit[1]
    data = _load_json_file(file, name)
    with _JSON_CACHE_LOCK:
        _JSON_CACHE[str(file)] = (key, data)
    return data


def _write_json_file(data: dict, temp_file: Path, target_file: Path) -> None:
    """Write data to a temp file and atomically replace the live file."""
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        f.flush()
    os.replace(temp_file, target_file)
    _cache_store(target_file, data)


def _save_json_file(data: dict, file: Path) -> None:
    """Persist a JSON dict to disk safely with a backup and lock."""
    temp_file = file.with_suffix(".json.tmp")
    backup_file = file.with_suffix(".json.bak")
    lock_file = file.with_suffix(".json.lock")
    try:
        with open(lock_file, "a", encoding="utf-8") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            try:
                if file.exists():
                    backup_file.write_bytes(file.read_bytes())
                _write_json_file(data, temp_file, file)
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    except OSError as err:
        app.logger.exception("Unable to save %s: %s", file.name, err)
        raise RuntimeError("Could not save data. Please try again.") from err
    finally:
        try:
            temp_file.unlink(missing_ok=True)
        except OSError:
            pass


def _modify_json_file(file: Path, callback) -> None:
    """Load the latest JSON, apply callback, and save atomically.

    This prevents the read-modify-write race where a stale copy overwrites
    a more recent save. The whole load/callback/save runs under the file lock,
    so concurrent updates are serialized safely.
    """
    temp_file = file.with_suffix(".json.tmp")
    backup_file = file.with_suffix(".json.bak")
    lock_file = file.with_suffix(".json.lock")
    try:
        with open(lock_file, "a", encoding="utf-8") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            try:
                with _JSON_CACHE_LOCK:
                    data = _load_json_cached(file, file.name)
                    try:
                        result = callback(data)
                    except Exception:
                        _cache_drop(file)
                        raise
                if result is False:
                    _cache_drop(file)
                    return False
                if file.exists():
                    backup_file.write_bytes(file.read_bytes())
                try:
                    _write_json_file(data, temp_file, file)
                except Exception:
                    _cache_drop(file)
                    raise
                return result
            finally:
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    except OSError as err:
        app.logger.exception("Unable to save %s: %s", file.name, err)
        raise RuntimeError("Could not save data. Please try again.") from err
    finally:
        try:
            temp_file.unlink(missing_ok=True)
        except OSError:
            pass


def load_users() -> dict:
    """Load the small auth/profile file (a private copy of the in-memory version)."""
    with _JSON_CACHE_LOCK:
        return copy.deepcopy(_load_json_cached(USERS_FILE, "users.json"))


def save_users(users: dict) -> None:
    """Persist the small auth/profile file."""
    _save_json_file(users, USERS_FILE)


def modify_users(callback) -> None:
    """Load, modify, and save users.json atomically."""
    return _modify_json_file(USERS_FILE, callback)


def load_user_data() -> dict:
    """Load the whole large per-user exam/progress file (slow; prefer load_user_record)."""
    with _JSON_CACHE_LOCK:
        return copy.deepcopy(_load_json_cached(USER_DATA_FILE, "user_data.json"))


def load_user_record(username: str) -> dict:
    """Return {username: <private copy of that user's record>} from the in-memory progress data.

    Shaped like user_data so existing helpers (user_data.get(user), _get_mastery_for_user)
    work unchanged, but only one user's record is copied (milliseconds, not 0.4 s+).
    """
    with _JSON_CACHE_LOCK:
        data = _load_json_cached(USER_DATA_FILE, "user_data.json")
        return {username: copy.deepcopy(data[username])} if username in data else {}


def save_user_data(data: dict) -> None:
    """Persist the large per-user exam/progress file."""
    _save_json_file(data, USER_DATA_FILE)


def modify_user_data(callback) -> None:
    """Load, modify, and save user_data.json atomically."""
    return _modify_json_file(USER_DATA_FILE, callback)


# ── Daily test-history cleanup ─────────────────────────────────────────────
# Each saved test keeps a full copy of every question and answer, which made up half of
# user_data.json. Once a day, tests older than HISTORY_DETAIL_DAYS keep only their summary
# (date, exam, score, time) and lose the question-by-question details. Mastery, flashcards
# and accounts are never touched. Each run is recorded in history_cleanup.json and
# history_cleanup.log next to this file (and in the service log).
HISTORY_DETAIL_DAYS = 30
HISTORY_DETAIL_FIELDS = ("quiz", "answers", "results")
CLEANUP_STATE_FILE = BASE_DIR / "history_cleanup.json"
CLEANUP_LOG_FILE = BASE_DIR / "history_cleanup.log"


def _parse_utc(value):
    try:
        dt = datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=datetime.timezone.utc)


def slim_old_history(days: int = HISTORY_DETAIL_DAYS, now=None) -> int:
    """Strip question-by-question details from tests older than `days`. Returns how many."""
    now = now or datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(days=days)
    slimmed = 0

    def _slim(user_data: dict):
        nonlocal slimmed
        for record in user_data.values():
            if not isinstance(record, dict):
                continue
            for attempt in record.get("test_history") or []:
                if not isinstance(attempt, dict) or attempt.get("slimmed"):
                    continue
                done = _parse_utc(attempt.get("completed_at"))
                if done is None or done >= cutoff:
                    continue
                if not any(k in attempt for k in HISTORY_DETAIL_FIELDS):
                    continue
                for k in HISTORY_DETAIL_FIELDS:
                    attempt.pop(k, None)
                attempt["slimmed"] = True
                slimmed += 1
        return True if slimmed else False

    modify_user_data(_slim)
    return slimmed


def run_history_cleanup_if_due() -> Optional[int]:
    """Run the cleanup if it hasn't run in the last 23 hours. Returns the count, or None if not due."""
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        state = json.loads(CLEANUP_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    last = _parse_utc(state.get("last_run"))
    if last and now - last < datetime.timedelta(hours=23):
        return None
    count = slim_old_history(now=now)
    state = {
        "last_run": now.isoformat(),
        "last_slimmed": count,
        "total_slimmed": int(state.get("total_slimmed", 0)) + count,
        "keep_details_days": HISTORY_DETAIL_DAYS,
    }
    CLEANUP_STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    line = f"{now.isoformat()} slimmed {count} test(s) older than {HISTORY_DETAIL_DAYS} days\n"
    with open(CLEANUP_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line)
    app.logger.warning("History cleanup: %s", line.strip())
    return count


def _history_cleanup_loop() -> None:
    time.sleep(120)  # let the server finish starting
    while True:
        try:
            run_history_cleanup_if_due()
        except Exception:  # never let the cleanup take the site down
            app.logger.exception("History cleanup failed")
        time.sleep(3600)  # check hourly; it only runs once every ~24 hours


if os.environ.get("ANSWRIT_DISABLE_CLEANUP") != "1":
    threading.Thread(target=_history_cleanup_loop, name="history-cleanup", daemon=True).start()


def current_user() -> str:
    """Return the logged-in username, or empty string if not logged in."""
    return session.get("user", "")


EXAM_DISPLAY_NAMES = {
    "it-essentials-70-80-final-exam-modules-1-9-answers.json": "ITE Module 1-9 Exam",
    "it-essentials-70-80-final-exam-modules-10-14-answers.json": "ITE Module 10-14 Exam",
    "it-essentials-70-80-course-final-exam-answers.json": "ITE Course Final Exam",
}


def display_name_for(filename: str, fallback: str = "") -> str:
    """Return a friendly short name for a known exam file."""
    if fallback:
        return fallback
    return EXAM_DISPLAY_NAMES.get(filename, filename.replace("-", " ").replace(".json", "").title())


def _get_flashcard_reviews_for_user(user_data: dict, username: str, filename: str) -> set:
    """Return the set of question IDs a user has marked for flashcard review."""
    user = user_data.get(username)
    if not user:
        return set()
    exams = user.setdefault("exams", {})
    exam = exams.setdefault(filename, {})
    reviews = exam.get("flashcard_reviews", [])
    return set(reviews) if isinstance(reviews, list) else set()


def _toggle_flashcard_review(username: str, filename: str, question_id) -> bool:
    """Toggle review status for a flashcard. Returns True if now marked, False if unmarked."""
    def _toggle(user_data: dict):
        record = user_data.setdefault(username, {})
        exams = record.setdefault("exams", {})
        exam = exams.setdefault(filename, {})
        reviews = set(exam.get("flashcard_reviews", []))
        qid = str(question_id)
        if qid in reviews:
            reviews.discard(qid)
            exam["flashcard_reviews"] = sorted(reviews, key=lambda x: int(x) if x.isdigit() else x)
            return False
        else:
            reviews.add(qid)
            exam["flashcard_reviews"] = sorted(reviews, key=lambda x: int(x) if x.isdigit() else x)
            return True

    return modify_user_data(_toggle)


def _update_streak(activity: dict) -> None:
    """Update a user's daily visit streak based on the last seen date."""
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).date()
    last = activity.get("last_seen")
    last_date = None
    if last:
        try:
            last_date = datetime.fromisoformat(last).date()
        except Exception:
            last_date = None
    if last_date is None:
        activity["streak"] = 1
    elif last_date == today:
        pass  # already counted today
    elif (today - last_date).days == 1:
        activity["streak"] = activity.get("streak", 0) + 1
    else:
        activity["streak"] = 1
    activity["last_seen"] = datetime.now(timezone.utc).isoformat()


def track_user_activity(username: str) -> dict:
    """Record that a user is active now and return their updated activity.

    This only updates an existing user record and only writes to disk when the
    streak or last_seen value actually changes, so /api/ping does not hammer
    users.json on every request.
    """
    from datetime import datetime, timezone, timedelta

    def _update(users: dict) -> bool:
        user_data = users.get(username)
        if not user_data:
            # Never create a skeleton user from a ping/me call.
            return False
        activity = user_data.setdefault("activity", {"streak": 0, "last_seen": None})
        now = datetime.now(timezone.utc)
        last_seen = activity.get("last_seen")
        if last_seen:
            try:
                last_dt = datetime.fromisoformat(last_seen)
            except Exception:
                last_dt = None
        else:
            last_dt = None

        # Only update last_seen if it is missing or older than 5 minutes.
        # Streak is updated at most once per day by _update_streak.
        if last_dt and (now - last_dt) < timedelta(minutes=5):
            return False

        _update_streak(activity)
        return True

    modify_users(_update)
    users = load_users()
    return users.get(username, {}).get("activity", {"streak": 0, "last_seen": None})


def get_online_users(minutes: int = 15) -> list:
    """Return recently active users and their streaks."""
    from datetime import datetime, timezone, timedelta
    users = load_users()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    online = []
    for username, data in users.items():
        activity = data.get("activity")
        if not activity:
            continue
        last_seen = activity.get("last_seen")
        if not last_seen:
            continue
        try:
            last_dt = datetime.fromisoformat(last_seen)
        except Exception:
            continue
        if last_dt >= cutoff:
            online.append({
                "username": username,
                "streak": activity.get("streak", 0),
            })
    online.sort(key=lambda u: u["username"].lower())
    return online


# ── Chat ───────────────────────────────────────────────────────────────────
# chat.json: {"messages": [...], "pins": {room: message_id}, "reports": [...]}.
# A message: {id, room, username, message, timestamp, reply_to?, quote?, reactions?}.
# Older messages (before rooms) have no id/room; they are treated as Lounge messages.
CHAT_ROOMS = [
    {"id": "announcements", "name": "Announcements", "desc": "News and updates from AnswrIT", "admin_only": True},
    {"id": "lounge", "name": "Lounge", "desc": "Hang out and talk about anything"},
    {"id": "ite", "name": "IT Essentials", "desc": "Questions about the IT Essentials exams"},
    {"id": "ccna1", "name": "CCNA 1", "desc": "Questions about the CCNA 1 exams"},
    {"id": "ccna2", "name": "CCNA 2", "desc": "Questions about the CCNA 2 exams"},
]
CHAT_ROOM_IDS = {r["id"] for r in CHAT_ROOMS}
CHAT_REACTIONS = ["👍", "❤️", "😂", "🙏"]
CHAT_ROOM_LIMIT = 300            # messages kept per room
CHAT_MIN_SECONDS = 2.0           # simple flood control per user
# Admin accounts can post announcements, delete any message, pin, and see reports.
ADMIN_USERS = {"answrit"}
ADMIN_DISPLAY = {"answrit": "AnswrIT"}
# Nobody can sign up with these (so no one can pose as the admin).
RESERVED_USERNAMES = {"admin", "administrator", "moderator", "mod", "staff", "support", "official",
                      "answrit team", "answritteam", "answrit_team", "answrit-team", "answrit.team",
                      "answrit admin", "answritadmin", "answrit_admin", "answrit-admin"}
_last_post: dict = {}


def is_admin(username: str) -> bool:
    return bool(username) and username in ADMIN_USERS


def _chat_normalize(data: dict) -> dict:
    """Give older messages an id and a room (in place)."""
    msgs = data.setdefault("messages", [])
    for i, m in enumerate(msgs):
        if not m.get("id"):
            m["id"] = f"old{i}"
        if m.get("room") not in CHAT_ROOM_IDS:
            m["room"] = "lounge"
        m.pop("avatar_image", None)
    data.setdefault("pins", {})
    data.setdefault("reports", [])
    return data


def load_chat() -> dict:
    """Return the shared in-memory chat data (read-only for callers)."""
    with _JSON_CACHE_LOCK:
        data = _load_json_cached(CHAT_FILE, "chat.json")
        if data.get("_normalized") is not True:
            _chat_normalize(data)
            data["_normalized"] = True
        return data


def modify_chat(callback):
    def _cb(data):
        _chat_normalize(data)
        data["_normalized"] = True
        return callback(data)
    return _modify_json_file(CHAT_FILE, _cb)


def save_chat(data: dict) -> None:
    """Kept for older code paths: save the whole chat file."""
    _save_json_file(data, CHAT_FILE)


def _public_message(m: dict, viewer: str) -> dict:
    out = {k: m[k] for k in ("id", "room", "username", "message", "timestamp", "reply_to", "quote") if k in m}
    out["display"] = ADMIN_DISPLAY.get(m.get("username"), m.get("username"))
    out["admin"] = is_admin(m.get("username"))
    out["mine"] = bool(viewer) and m.get("username") == viewer
    reactions = m.get("reactions") or {}
    out["reactions"] = [{"emoji": e, "count": len(reactions.get(e, [])), "mine": viewer in reactions.get(e, [])}
                        for e in CHAT_REACTIONS if reactions.get(e)]
    return out


def add_chat_message(username: str, message: str, room: str = "lounge", reply_to: str = "", quote: Optional[dict] = None) -> dict:
    """Add a message to a room and return it."""
    entry = {
        "id": secrets.token_urlsafe(8),
        "room": room,
        "username": username,
        "message": message.strip()[:500],
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    if quote:
        entry["quote"] = quote

    def _add(data: dict):
        if reply_to:
            target = next((m for m in data["messages"] if m.get("id") == reply_to and m.get("room") == room), None)
            if target:
                entry["reply_to"] = {"id": target["id"], "username": ADMIN_DISPLAY.get(target["username"], target["username"]),
                                     "message": (target.get("message") or (target.get("quote") or {}).get("question", ""))[:120]}
        data["messages"].append(entry)
        in_room = [m for m in data["messages"] if m.get("room") == room]
        if len(in_room) > CHAT_ROOM_LIMIT:
            drop = {m["id"] for m in in_room[: len(in_room) - CHAT_ROOM_LIMIT]}
            data["messages"] = [m for m in data["messages"] if m.get("id") not in drop]
        return True

    modify_chat(_add)
    return entry


def get_chat_messages(limit: int = 100, room: str = "lounge") -> list:
    """Return the most recent messages in a room."""
    msgs = [m for m in load_chat().get("messages", []) if m.get("room") == room]
    return copy.deepcopy(msgs[-limit:])


def _course_room_for(filename: str) -> str:
    f = filename or ""
    if f.startswith("it-essentials"):
        return "ite"
    if f.startswith("ccna-2"):
        return "ccna2"
    if f.startswith("ccna"):
        return "ccna1"
    return "lounge"


def _get_mastery_for_user(user_data: dict, username: str, filename: str) -> dict:
    """Return the per-exam mastery container, migrating from newer and older
    formats if needed.

    Per-question mastery:
    - First correct answer masters the question immediately.
    - If the first attempt is wrong, the user must answer the question
      correctly 3 times total before it is mastered.
    """
    mastery = user_data.setdefault(username, {}).setdefault("mastery", {})
    exam = mastery.setdefault(filename, {})

    # Migrate from the set-based redesign back to per-question tracking.
    if "mastered_qids" in exam:
        mastered_qids = set(str(q) for q in exam.get("mastered_qids", []))
        all_questions = get_questions_for_test(filename)
        all_qids = [str(q["id"]) for q in all_questions] if all_questions else []
        questions = {}
        for qid in all_qids:
            if qid in mastered_qids:
                questions[qid] = {
                    "mastered": True,
                    "streak": 0,
                    "correct_count": 1,
                    "attempts": 1,
                    "first_correct": True,
                }
            else:
                questions[qid] = {}
        exam.clear()
        exam["questions"] = questions
        exam["working_set"] = []
        return exam

    # Older per-question format stored dicts directly under the filename key.
    if "questions" not in exam:
        questions = {str(k): v for k, v in exam.items() if isinstance(v, dict)}
        migrated = {"questions": questions, "working_set": []}
        mastery[filename] = migrated
        return migrated

    # Normalize any existing keys to strings and drop stale non-dict entries.
    questions = {str(k): v for k, v in exam.get("questions", {}).items() if isinstance(v, dict)}
    exam["questions"] = questions
    working_set = exam.setdefault("working_set", [])
    exam["working_set"] = [str(qid) for qid in working_set]
    return exam


def _get_question_entry(exam_mastery: dict, qid: str) -> dict:
    return exam_mastery.setdefault("questions", {}).setdefault(str(qid), {})


def _mastery_threshold(entry: dict) -> int:
    """Return the number of correct answers required to master a question.

    Rule: if the first attempt is correct, the question is mastered immediately.
    If the first attempt is wrong, the user must answer correctly 3 times total.
    """
    return 1 if entry.get("first_correct") is True else 3


def _update_mastery_entry(entry: dict, is_correct: bool) -> bool:
    """Update a mastery entry with a new attempt. Return True if newly mastered."""
    entry.setdefault("streak", 0)
    entry.setdefault("attempts", 0)
    entry.setdefault("correct_count", 0)

    if entry.get("first_correct") is None:
        entry["first_correct"] = is_correct
        if is_correct:
            entry["streak"] = 1
            entry["correct_count"] = 1
            entry["attempts"] = 1
            entry["mastered"] = True
            return True

    entry["attempts"] += 1
    if is_correct:
        entry["streak"] += 1
        entry["correct_count"] += 1
    else:
        entry["streak"] = 0

    if entry.get("mastered"):
        return False
    threshold = _mastery_threshold(entry)
    if entry["correct_count"] >= threshold:
        entry["mastered"] = True
        return True
    return False


def _compute_mastery_summary(exam: dict, questions: list) -> dict:
    """Compute mastery summary from an already-loaded exam mastery dict."""
    question_store = exam.get("questions", {})
    total = len(questions)
    mastered = 0
    for q in questions:
        qid = str(q["id"])
        if question_store.get(qid, {}).get("mastered"):
            mastered += 1
    return {
        "total": total,
        "mastered": mastered,
        "remaining": total - mastered,
        "progress": round((mastered / total) * 100, 2) if total else 0,
    }


def get_mastery_summary(username: str, filename: str, questions: list) -> dict:
    """Return mastery stats for a user and exam."""
    user_data = load_user_record(username)
    exam = _get_mastery_for_user(user_data, username, filename)
    return _compute_mastery_summary(exam, questions)


@app.route("/")
def index():
    return render_index_html(
        page_title=DEFAULT_PAGE_TITLE,
        page_description=DEFAULT_PAGE_DESCRIPTION,
        canonical_url=f"{SITE_URL}/",
        h1_text="Free ITE, CCNA 1 and CCNA 2 Exam Answers and Practice Tests",
        seo_intro="AnswrIT has every Cisco Netacad IT Essentials (ITE), CCNA 1 (ITN) and CCNA 2 (SRWE) module and final exam with the correct answers, free practice tests, flashcards, Mastery mode and Packet Tracer practice labs.",
    )


SPA_PAGE_SEO = {
    "/study": {
        "title": "ITE & CCNA Practice Tests and Exam Answers | AnswrIT",
        "description": "Take custom-length, interactive practice tests for Cisco ITE, CCNA, and Netacad exams. Track mastery and focus on weak areas.",
        "h1": "ITE, CCNA 1 and CCNA 2 Practice Tests and Exam Answers",
        "intro": "Build and take practice tests for IT Essentials and CCNA exams. Set your own question count, see instant feedback, and track mastery over time.",
    },
    "/flashcards": {
        "title": "Flashcards & Spaced Repetition — AnswrIT",
        "description": "Swipe through flashcard decks for networking terms and Cisco exam topics. Study at your own pace with smart review tracking.",
        "h1": "Flashcard Decks for Networking and Cisco Exams",
        "intro": "Memorize networking terms and concepts with swipeable flashcards. Flip, rate, and review only the cards you need.",
    },
    "/apps": {
        "title": "Interactive Study Games & Arcade — AnswrIT",
        "description": "Play quick study games and drills for CCNA and IT Essentials: subnetting, binary, port numbers, OSI layers, CLI commands, and more.",
        "h1": "Study Games & Drills for CCNA and IT Essentials",
        "intro": "Reinforce what you have learned with quick study games: subnetting, binary, port numbers, OSI layers, CLI commands, cables, and more.",
    },
    "/history": {
        "title": "Progress & Mastery Tracking — AnswrIT",
        "description": "View your practice test scores, mastery progress, streaks, and study history across all Cisco exams on AnswrIT.",
        "h1": "Track Your Mastery & Exam Progress",
        "intro": "Review scores, streaks, and mastered questions across every exam. See where you are strong and where to focus next.",
    },
    "/packet-tracer": {
        "title": "Packet Tracer Skills Exam Practice Labs (CCNA 2) | AnswrIT",
        "description": "Free CCNA 2 Packet Tracer skills assessment practice in your browser: VLANs, trunks, router-on-a-stick, SSH, IPv6 and static, default and floating routes, graded like Packet Tracer.",
        "h1": "Packet Tracer Skills Exam Practice",
        "intro": "Work through subnetting, CLI configuration, and Packet Tracer lab scenarios designed to prepare you for the CCNA final.",
    },
}


@app.route("/study")
@app.route("/study/")
@app.route("/flashcards")
@app.route("/flashcards/")
@app.route("/apps")
@app.route("/apps/")
@app.route("/history")
@app.route("/history/")
@app.route("/packet-tracer")
@app.route("/packet-tracer/")
def spa_pages():
    path = request.path.rstrip("/") or "/"
    seo = SPA_PAGE_SEO.get(path)
    if not seo:
        return redirect("/", code=302)
    canonical = f"{SITE_URL}{path}/" if path != "/" else f"{SITE_URL}/"
    return render_index_html(
        page_title=seo["title"],
        page_description=seo["description"],
        canonical_url=canonical,
        h1_text=seo["h1"],
        seo_intro=seo["intro"],
        index_path=CLASSIC_INDEX if path in CLASSIC_PATHS else NEW_INDEX,
    )


@app.route("/exams/<slug>/")
def exam_page(slug: str):
    exam = exam_by_slug(slug)
    if not exam:
        return redirect("/", code=302)
    filename = exam.get("filename", f"{slug}.json")
    display = display_name_for(filename, exam.get("display_name", ""))
    exam = {**exam, "filename": filename}
    name = seo_exam_name(exam)
    count = int(exam.get("count") or len(_exam_questions(filename)))
    title = f"{name} Answers & Free Practice Test | AnswrIT"
    description = (f"All {count} {name} questions with the correct answers. "
                   f"Free practice test, flashcards and Mastery mode for Cisco Netacad students.")
    canonical = f"{SITE_URL}/exams/{slug}/"
    h1 = f"{name} Answers"
    intro = f"All {count} questions from the {name} with the correct answers."
    return render_index_html(
        page_title=title,
        page_description=description,
        canonical_url=canonical,
        h1_text=h1,
        seo_intro=intro,
        exam_filename=filename,
        view_html=seo_exam_html(exam),
        extra_head=seo_exam_jsonld(exam),
    )


@app.route("/questions/<slug>/")
def question_page(slug: str):
    entry = question_index()["by_slug"].get(slug)
    if not entry:
        return redirect("/", code=302)
    page = seo_question_page(entry)
    return render_index_html(
        page_title=page["title"],
        page_description=page["description"],
        canonical_url=f"{SITE_URL}/questions/{slug}/",
        h1_text=entry["q"]["question"],
        seo_intro=page["description"],
        view_html=page["html"],
        extra_head=page["jsonld"],
    )


@app.route("/questions/<slug>")
def question_page_noslash(slug: str):
    return redirect(f"/questions/{slug}/", code=301)


@app.route("/google46429450d03302f8.html")
def google_verify():
    return send_from_directory(app.static_folder, "google46429450d03302f8.html")


def _build_sitemap() -> str:
    today = datetime.date.today().isoformat()
    slugs = []
    for exam in load_exam_manifest():
        filename = exam.get("filename", "")
        if filename.endswith(".json"):
            slugs.append(filename[:-5])
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    lines.append(f"  <url><loc>{SITE_URL}/</loc><lastmod>{today}</lastmod><priority>1.0</priority></url>")
    for page in ["/study/", "/flashcards/", "/apps/", "/packet-tracer/"]:
        lines.append(f"  <url><loc>{SITE_URL}{page}</loc><lastmod>{today}</lastmod><priority>0.7</priority></url>")
    for slug in slugs:
        lines.append(f"  <url><loc>{SITE_URL}/exams/{slug}/</loc><lastmod>{today}</lastmod><priority>0.9</priority></url>")
    for qslug in question_index()["by_slug"]:
        lines.append(f"  <url><loc>{SITE_URL}/questions/{qslug}/</loc><lastmod>{today}</lastmod><priority>0.6</priority></url>")
    lines.append("</urlset>")
    return "\n".join(lines)


def write_sitemap(path: Path = BASE_DIR / "static" / "sitemap.xml"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_build_sitemap(), encoding="utf-8")


@app.route("/sitemap.xml")
def sitemap():
    write_sitemap()
    return send_from_directory(BASE_DIR / "static", "sitemap.xml", mimetype="application/xml")


@app.route("/api/state")
def get_state():
    questions = get_current_questions()
    return jsonify({
        "title": get_current_title(),
        "url": get_current_url(),
        "total": len(questions),
    })


@app.route("/api/questions")
def get_questions():
    questions = get_current_questions()
    return jsonify({
        "title": get_current_title(),
        "url": get_current_url(),
        "questions": questions,
    })


@app.route("/api/exams")
def get_exams():
    """Return the list of pre-scraped exams available in data/."""
    manifest_path = DATA_DIR / "exams.json"
    exams = []
    if manifest_path.exists():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            for exam in manifest.get("exams", []):
                filename = exam.get("filename", "")
                display_name = display_name_for(filename, exam.get("display_name", ""))
                # Count questions dynamically so the UI count stays accurate
                # when questions are added to a file.
                count = exam.get("count", 0)
                try:
                    with open(DATA_DIR / filename, "r", encoding="utf-8") as qf:
                        qdata = json.load(qf)
                    count = len(qdata.get("questions", []))
                except Exception:
                    pass
                exams.append({**exam, "display_name": display_name, "count": count})
        except Exception:
            pass
    return jsonify({
        "current_filename": app_state.get("filename"),
        "exams": exams,
    })


def read_exam_file(filepath: Path) -> Optional[dict]:
    """Return exam data from a file without mutating app_state."""
    data = _load_exam_cached(filepath)
    if data and isinstance(data, dict) and "questions" in data:
        return data
    return None


@app.route("/api/load", methods=["POST"])
def load_exam_endpoint():
    """Load a pre-scraped exam by filename."""
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "No filename provided."}), 400

    filepath = DATA_DIR / filename
    if not filepath.exists():
        return jsonify({"ok": False, "error": f"Exam file not found: {filename}"}), 404

    if load_exam_from_file(filepath):
        return jsonify({
            "ok": True,
            "title": app_state["title"],
            "url": app_state["url"],
            "filename": app_state["filename"],
            "count": len(app_state["questions"]),
            "questions": app_state["questions"],
        })
    return jsonify({"ok": False, "error": f"Failed to load {filename}"}), 500


@app.route("/api/exam-questions", methods=["POST"])
def exam_questions_endpoint():
    """Return all questions for a given exam filename without changing app_state."""
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "No filename provided."}), 400

    exam_meta = next((exam for exam in load_exam_manifest() if exam.get("filename") == filename), {})
    flashcard_filename = exam_meta.get("flashcard_file", "")
    filepath = DATA_DIR / (flashcard_filename or filename)
    if not filepath.exists():
        return jsonify({"ok": False, "error": f"Exam file not found: {filename}"}), 404

    if flashcard_filename:
        flashcard_data = _load_exam_cached(filepath)
        if not isinstance(flashcard_data, dict) or not isinstance(flashcard_data.get("flashcards"), list):
            return jsonify({"ok": False, "error": f"Failed to read {flashcard_filename}"}), 500
        questions = [
            {
                "id": card.get("id"),
                "question": card.get("front", ""),
                "correct_answer": card.get("back", ""),
                "options": [],
                "category": card.get("category", ""),
            }
            for card in flashcard_data["flashcards"]
        ]
        title = flashcard_data.get("title")
    else:
        exam_data = read_exam_file(filepath)
        if exam_data is None:
            return jsonify({"ok": False, "error": f"Failed to read {filename}"}), 500
        questions = exam_data.get("questions", [])
        title = exam_data.get("title")

    return jsonify({
        "ok": True,
        "title": title,
        "filename": filename,
        "count": len(questions),
        "questions": questions,
    })


@app.route("/api/scrape", methods=["POST"])
def scrape_endpoint():
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()
    if not url:
        url = DEFAULT_TARGET_URL
    if not is_valid_itexamanswers_url(url):
        return jsonify({"ok": False, "error": "Invalid URL. Only itexamanswers.net links are allowed."}), 400

    try:
        title, questions = scrape_url(url)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    # Save to disk so the state survives restarts
    payload = {"title": title, "url": url, "questions": questions}
    with open(QUESTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    app_state["title"] = title
    app_state["url"] = url
    app_state["questions"] = questions

    return jsonify({"ok": True, "title": title, "url": url, "count": len(questions)})


@app.route("/api/refresh", methods=["POST"])
def refresh_questions():
    return scrape_endpoint()


@app.route("/api/test", methods=["GET"])
def generate_test():
    try:
        n = int(request.args.get("n", 10))
    except ValueError:
        n = 10
    filename = request.args.get("filename", "").strip()
    questions = get_questions_for_test(filename)
    if not questions:
        return jsonify({"error": "No questions loaded. Paste an itexamanswers.net URL and click Scrape."}), 503
    ids = [x for x in request.args.get("ids", "").split(",") if x.strip()]
    if ids:
        # "Retake same test": the same questions, in the same order as last time.
        by_id = {str(q["id"]): q for q in questions}
        selected = [by_id[i.strip()] for i in ids if i.strip() in by_id]
        if not selected:
            return jsonify({"error": "Those questions aren't in this exam anymore."}), 404
    else:
        count = max(1, min(n, len(questions)))
        selected = random.sample(questions, count)
    quiz = []
    for q in selected:
        item = {
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "_correct_answer": q["correct_answer"],
        }
        if q.get("type"):
            item["type"] = q["type"]
        if q.get("terms"):
            item["terms"] = q["terms"]
        if q.get("definitions"):
            item["definitions"] = q["definitions"]
        if q.get("correct_pairs"):
            item["correct_pairs"] = q["correct_pairs"]
        if q.get("image"):
            item["image"] = q["image"]
        if q.get("option_images"):
            item["option_images"] = q["option_images"]
        quiz.append(item)
    return jsonify({
        "title": get_current_title() if not filename else None,
        "quiz": quiz,
    })


def _is_answer_correct(q: dict, selected) -> bool:
    """Return True if the selected answer matches the question's correct answer.

    Supports multiple-choice answers (pipe-separated correct strings) and
    matching questions (term -> definition mapping).
    """
    if q.get("type") == "matching":
        correct_pairs = q.get("correct_pairs", {})
        user_pairs = selected if isinstance(selected, dict) else {}
        if len(user_pairs) != len(correct_pairs):
            return False
        for term, definition in correct_pairs.items():
            if user_pairs.get(term) != definition:
                return False
        return bool(correct_pairs)

    correct_key = q.get("correct_answer") or q.get("_correct_answer", "")
    correct_set = set(a.strip() for a in correct_key.split("|") if a.strip())
    selected_set = set(s.strip() for s in (selected if isinstance(selected, list) else [selected]) if s)
    return selected_set == correct_set


@app.route("/api/score", methods=["POST"])
def score_test():
    data = request.get_json(silent=True) or {}
    answers = data.get("answers", {})
    # Prefer the exact quiz the frontend took to avoid global-state collisions.
    provided_quiz = data.get("quiz", [])
    if provided_quiz:
        questions = []
        for q in provided_quiz:
            normalized = dict(q)
            if "_correct_answer" in normalized and "correct_answer" not in normalized:
                normalized["correct_answer"] = normalized.pop("_correct_answer")
            questions.append(normalized)
    else:
        questions = get_current_questions()

    results = []
    correct_count = 0
    # Iterate over the quiz in the order the questions were presented, so the
    # review panel matches the test order rather than numeric answer-key order.
    for q in questions:
        qid = q["id"]
        selected = answers.get(str(qid))
        is_correct = _is_answer_correct(q, selected)
        if is_correct:
            correct_count += 1
        if q.get("type") == "matching":
            selected_display = selected if isinstance(selected, dict) else {}
            correct_display = q.get("correct_pairs", {})
        else:
            correct_key = q.get("correct_answer") or q.get("_correct_answer", "")
            selected_display = sorted(set(s.strip() for s in (selected if isinstance(selected, list) else [selected]) if s))
            correct_display = sorted(set(a.strip() for a in correct_key.split("|") if a.strip()))
        result = {
            "id": qid,
            "question": q["question"],
            "options": q.get("options", []),
            "selected": selected_display,
            "correct_answer": correct_display,
            "is_correct": is_correct,
        }
        if q.get("type") == "matching":
            result["type"] = "matching"
            result["terms"] = q.get("terms", [])
            result["correct_pairs"] = q.get("correct_pairs", {})
        results.append(result)

    total = len(results)
    score = round((correct_count / total) * 100, 2) if total else 0

    provided_filename = data.get("filename")
    provided_title = data.get("title")
    result_title = provided_title or (display_name_for(provided_filename) if provided_filename else None) or get_current_title()

    return jsonify({
        "title": result_title,
        "total": total,
        "correct": correct_count,
        "score": score,
        "results": results,
    })


# ---------------------------------------------------------------------------
# Recent activity (any type)
# ---------------------------------------------------------------------------


@app.route("/api/recent-activity", methods=["GET"])
def get_recent_activity():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Not logged in."}), 401
    user_data = load_user_record(user)
    record = user_data.get(user, {})
    activity = record.get("recent_activity")
    return jsonify({"ok": True, "activity": activity})


@app.route("/api/recent-activity", methods=["POST"])
def save_recent_activity():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Not logged in."}), 401
    body = request.get_json(silent=True) or {}
    activity_type = body.get("type", "")
    label = body.get("label", "")
    tab = body.get("tab", "")
    if not activity_type or not label or not tab:
        return jsonify({"ok": False, "error": "Missing fields."}), 400

    activity = {
        "type": activity_type,
        "label": label,
        "tab": tab,
        "detail": body.get("detail", ""),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    def _save(user_data: dict):
        record = user_data.setdefault(user, {})
        record["recent_activity"] = activity

    modify_user_data(_save)
    return jsonify({"ok": True, "activity": activity})


# ---------------------------------------------------------------------------
# Practice test history
# ---------------------------------------------------------------------------

HISTORY_MAX_ENTRIES = 10


@app.route("/api/history", methods=["GET"])
def get_history():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to view test history."}), 401
    user_data = load_user_record(user)
    record = user_data.get(user, {})
    attempts = record.get("test_history", [])
    tests_taken = record.get("tests_taken", len(attempts))
    return jsonify({"ok": True, "attempts": attempts, "tests_taken": tests_taken})


@app.route("/api/history", methods=["POST"])
def save_history_attempt():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to save test history."}), 401

    attempt = request.get_json(silent=True) or {}
    required = ("filename", "title", "quiz", "results", "total", "correct", "score")
    if any(key not in attempt for key in required) or not isinstance(attempt["quiz"], list):
        return jsonify({"ok": False, "error": "Invalid test history entry."}), 400

    filename = str(attempt["filename"])

    def _add_attempt(user_data: dict):
        record = user_data.setdefault(user, {})
        history = record.setdefault("test_history", [])
        if "tests_taken" not in record:
            record["tests_taken"] = len(history)

        # Retaking the same exam updates its existing entry instead of
        # cluttering history with duplicates (e.g. after adding questions).
        existing_id = next((e.get("id") for e in history if e.get("filename") == filename), None)

        saved_attempt = {
            "id": existing_id or secrets.token_urlsafe(12),
            "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "filename": filename,
            "title": str(attempt["title"]),
            "quiz": attempt["quiz"],
            "answers": attempt.get("answers", {}),
            "results": attempt["results"],
            "total": int(attempt["total"]),
            "correct": int(attempt["correct"]),
            "score": attempt["score"],
            "duration_seconds": max(0, int(attempt.get("duration_seconds", 0))),
        }

        history[:] = [e for e in history if e.get("filename") != filename]
        history.insert(0, saved_attempt)
        del history[HISTORY_MAX_ENTRIES:]
        record["tests_taken"] += 1
        return saved_attempt

    saved_attempt = modify_user_data(_add_attempt)
    return jsonify({"ok": True, "attempt": saved_attempt})


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"ok": False, "error": "Username and password are required."}), 400
    if len(username) < 3 or len(username) > 30:
        return jsonify({"ok": False, "error": "Username must be 3-30 characters."}), 400
    if len(password) < 4:
        return jsonify({"ok": False, "error": "Password must be at least 4 characters."}), 400
    if username in RESERVED_USERNAMES:
        return jsonify({"ok": False, "error": "That username is reserved. Please pick another."}), 409
    def _register(users: dict):
        if username in users:
            return False
        users[username] = {
            "password_hash": generate_password_hash(password, method="pbkdf2:sha256"),
            "activity": {"streak": 1, "last_seen": None},
        }
        return True

    if not modify_users(_register):
        return jsonify({"ok": False, "error": "Username already exists."}), 409
    session["user"] = username
    track_user_activity(username)
    return jsonify({"ok": True, "user": username, "profile": {}})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip().lower()
    password = data.get("password", "")
    if not username or not password:
        return jsonify({"ok": False, "error": "Username and password are required."}), 400
    users = load_users()
    user = users.get(username)
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        return jsonify({"ok": False, "error": "Invalid username or password."}), 401
    session["user"] = username
    track_user_activity(username)
    profile = user.get("profile", {})
    return jsonify({"ok": True, "user": username, "profile": profile})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"ok": True})


@app.route("/api/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "user": None})
    track_user_activity(user)
    users = load_users()
    profile = users.get(user, {}).get("profile", {})
    return jsonify({"ok": True, "user": user, "profile": profile, "is_admin": is_admin(user),
                    "display": ADMIN_DISPLAY.get(user, user)})


@app.route("/api/profile", methods=["GET", "POST"])
def profile():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to manage your profile."}), 401
    if request.method == "GET":
        users = load_users()
        return jsonify({"ok": True, "profile": users.get(user, {}).get("profile", {})})

    data = request.get_json(silent=True) or {}
    updated_profile = None

    def _update_profile(users: dict):
        nonlocal updated_profile
        user_data = users.get(user)
        if not user_data:
            return False
        profile = user_data.setdefault("profile", {})
        if "theme" in data and isinstance(data["theme"], str):
            profile["theme"] = data["theme"][:30]
        if "avatar_image" in data and isinstance(data["avatar_image"], str):
            profile["avatar_image"] = data["avatar_image"][:200_000]
        updated_profile = profile
        return True

    if not modify_users(_update_profile):
        return jsonify({"ok": False, "error": "User record not found."}), 404

    return jsonify({"ok": True, "profile": updated_profile})


@app.route("/api/ping", methods=["POST"])
def ping():
    """Update current user's activity and return recently active users."""
    user = current_user()
    if user:
        track_user_activity(user)
    online = get_online_users(minutes=15)
    return jsonify({"ok": True, "online": online})


@app.route("/api/active-now", methods=["GET"])
def active_now():
    """Track this browser session and return the approximate current visitor count.

    Uses an in-memory dict of session IDs, pruned to the last 15 minutes.
    Counts reset when the web worker restarts (acceptable for a casual badge).
    """
    from datetime import datetime, timezone, timedelta

    if "device_id" not in session:
        session["device_id"] = secrets.token_urlsafe(16)
        session.modified = True

    device_id = session["device_id"]
    now = datetime.now(timezone.utc)
    _active_sessions[device_id] = now.isoformat()

    cutoff = now - timedelta(minutes=15)
    stale = [
        did for did, last_seen in _active_sessions.items()
        if datetime.fromisoformat(last_seen) < cutoff
    ]
    for did in stale:
        _active_sessions.pop(did, None)

    return jsonify({"ok": True, "count": len(_active_sessions)})


# ---------------------------------------------------------------------------
# Community chat endpoints
# ---------------------------------------------------------------------------

@app.route("/api/chat/rooms", methods=["GET"])
def chat_rooms():
    """Rooms with a preview of the last message and recent message times (for unread badges)."""
    user = current_user()
    data = load_chat()
    out = []
    for r in CHAT_ROOMS:
        msgs = [m for m in data["messages"] if m.get("room") == r["id"]]
        last = msgs[-1] if msgs else None
        out.append({**r,
                    "count": len(msgs),
                    "last": {"display": ADMIN_DISPLAY.get(last["username"], last["username"]), "message": last.get("message") or "Asked about a question",
                             "timestamp": last["timestamp"]} if last else None,
                    "recent": [m["timestamp"] for m in msgs[-60:] if m.get("username") != user]})
    return jsonify({"ok": True, "rooms": out, "is_admin": is_admin(user), "reactions": CHAT_REACTIONS})


@app.route("/api/chat/messages", methods=["GET"])
def chat_messages():
    """Latest messages in a room, the pinned message, and senders' pictures."""
    user = current_user()
    room = request.args.get("room", "lounge")
    if room not in CHAT_ROOM_IDS:
        return jsonify({"ok": False, "error": "Unknown room."}), 404
    data = load_chat()
    msgs = [m for m in data["messages"] if m.get("room") == room][-150:]
    pin_id = data["pins"].get(room)
    pinned = next((m for m in data["messages"] if m.get("id") == pin_id), None)
    users = _load_json_cached(USERS_FILE, "users.json")
    names = {m.get("username") for m in msgs} | ({pinned["username"]} if pinned else set())
    avatars = {n: (users.get(n, {}).get("profile", {}) or {}).get("avatar_image", "") for n in names if n}
    return jsonify({"ok": True, "room": room,
                    "messages": [_public_message(m, user) for m in msgs],
                    "pinned": _public_message(pinned, user) if pinned else None,
                    "avatars": avatars, "is_admin": is_admin(user)})


@app.route("/api/chat/message", methods=["POST"])
def chat_message():
    """Post a message. Body: {room, message, reply_to?, quote?: {filename, qid}}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to chat."}), 401
    data = request.get_json(silent=True) or {}
    room = data.get("room") or "lounge"
    message = str(data.get("message", "")).strip()
    quote = None
    q = data.get("quote") if isinstance(data.get("quote"), dict) else None
    if q:
        filename = str(q.get("filename", ""))
        qs = get_questions_for_test(filename) or []
        found = next((x for x in qs if str(x.get("id")) == str(q.get("qid"))), None)
        if not found:
            return jsonify({"ok": False, "error": "That question wasn't found."}), 400
        quote = {"filename": filename, "qid": found["id"], "question": str(found.get("question", ""))[:600],
                 "exam": next((e.get("display_name") or e.get("title") or filename for e in load_exam_manifest() if e.get("filename") == filename), filename)}
        if not data.get("room"):
            room = _course_room_for(filename)
    if room not in CHAT_ROOM_IDS:
        return jsonify({"ok": False, "error": "Unknown room."}), 404
    if any(r.get("admin_only") for r in CHAT_ROOMS if r["id"] == room) and not is_admin(user):
        return jsonify({"ok": False, "error": "Only AnswrIT can post announcements."}), 403
    if not message and not quote:
        return jsonify({"ok": False, "error": "Message cannot be empty."}), 400
    now = time.time()
    if now - _last_post.get(user, 0) < CHAT_MIN_SECONDS:
        return jsonify({"ok": False, "error": "You're sending messages too fast. Wait a moment."}), 429
    _last_post[user] = now
    entry = add_chat_message(user, message, room=room, reply_to=str(data.get("reply_to") or ""), quote=quote)
    return jsonify({"ok": True, "message": _public_message(entry, user)})


@app.route("/api/chat/react", methods=["POST"])
def chat_react():
    """Toggle a reaction. Body: {id, emoji}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to react."}), 401
    data = request.get_json(silent=True) or {}
    mid, emoji = str(data.get("id", "")), data.get("emoji")
    if emoji not in CHAT_REACTIONS:
        return jsonify({"ok": False, "error": "Unknown reaction."}), 400

    def _react(chat: dict):
        m = next((x for x in chat["messages"] if x.get("id") == mid), None)
        if not m:
            return False
        who = m.setdefault("reactions", {}).setdefault(emoji, [])
        if user in who:
            who.remove(user)
        else:
            who.append(user)
        if not who:
            m["reactions"].pop(emoji, None)
        return True

    if not modify_chat(_react):
        return jsonify({"ok": False, "error": "Message not found."}), 404
    return jsonify({"ok": True})


@app.route("/api/chat/delete", methods=["POST"])
def chat_delete():
    """Delete a message: your own, or any message if you're an admin."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    mid = str((request.get_json(silent=True) or {}).get("id", ""))

    def _del(chat: dict):
        m = next((x for x in chat["messages"] if x.get("id") == mid), None)
        if not m or not (m.get("username") == user or is_admin(user)):
            return False
        chat["messages"] = [x for x in chat["messages"] if x.get("id") != mid]
        for room, pid in list(chat["pins"].items()):
            if pid == mid:
                chat["pins"].pop(room)
        chat["reports"] = [r for r in chat["reports"] if r.get("id") != mid]
        return True

    if not modify_chat(_del):
        return jsonify({"ok": False, "error": "You can't delete that message."}), 403
    return jsonify({"ok": True})


@app.route("/api/chat/pin", methods=["POST"])
def chat_pin():
    """Admin: pin a message to the top of its room, or unpin. Body: {room, id|null}."""
    user = current_user()
    if not is_admin(user):
        return jsonify({"ok": False, "error": "Only admins can pin messages."}), 403
    data = request.get_json(silent=True) or {}
    room, mid = data.get("room"), data.get("id")
    if room not in CHAT_ROOM_IDS:
        return jsonify({"ok": False, "error": "Unknown room."}), 404

    def _pin(chat: dict):
        if mid:
            if not any(x.get("id") == mid and x.get("room") == room for x in chat["messages"]):
                return False
            chat["pins"][room] = mid
        else:
            chat["pins"].pop(room, None)
        return True

    if not modify_chat(_pin):
        return jsonify({"ok": False, "error": "Message not found."}), 404
    return jsonify({"ok": True})


@app.route("/api/chat/report", methods=["POST"])
def chat_report():
    """Report a message to the admins."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to report."}), 401
    data = request.get_json(silent=True) or {}
    mid, reason = str(data.get("id", "")), str(data.get("reason", ""))[:200]

    def _report(chat: dict):
        m = next((x for x in chat["messages"] if x.get("id") == mid), None)
        if not m:
            return False
        if any(r.get("id") == mid and r.get("by") == user for r in chat["reports"]):
            return True
        chat["reports"].append({"id": mid, "room": m.get("room"), "by": user, "reason": reason,
                                "at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
        chat["reports"] = chat["reports"][-200:]
        return True

    if not modify_chat(_report):
        return jsonify({"ok": False, "error": "Message not found."}), 404
    return jsonify({"ok": True})


@app.route("/api/chat/reports", methods=["GET", "POST"])
def chat_reports():
    """Admin: GET reported messages; POST {id} to dismiss the reports for a message."""
    user = current_user()
    if not is_admin(user):
        return jsonify({"ok": False, "error": "Admins only."}), 403
    if request.method == "POST":
        mid = str((request.get_json(silent=True) or {}).get("id", ""))

        def _dismiss(chat: dict):
            chat["reports"] = [r for r in chat["reports"] if r.get("id") != mid]
            return True

        modify_chat(_dismiss)
        return jsonify({"ok": True})
    chat = load_chat()
    by_id = {m.get("id"): m for m in chat["messages"]}
    grouped = {}
    for r in chat["reports"]:
        g = grouped.setdefault(r["id"], {"id": r["id"], "room": r.get("room"), "count": 0, "reasons": [],
                                         "message": _public_message(by_id[r["id"]], user) if r["id"] in by_id else None})
        g["count"] += 1
        if r.get("reason"):
            g["reasons"].append(r["reason"])
    return jsonify({"ok": True, "reports": [g for g in grouped.values() if g["message"]]})


@app.route("/api/chat/avatars", methods=["GET"])
def chat_avatars():
    """Kept for older pages: pictures for recent Lounge senders."""
    users = _load_json_cached(USERS_FILE, "users.json")
    names = {m.get("username") for m in get_chat_messages(limit=100)}
    return jsonify({"ok": True, "avatars": {n: {"avatar_image": (users.get(n, {}).get("profile", {}) or {}).get("avatar_image", "")} for n in names if n}})


# ---------------------------------------------------------------------------
# Direct messages and group chats
# ---------------------------------------------------------------------------
# dms.json: {"convos": {id: {id, type: "dm"|"group", name, owner, members: [...], created,
#            messages: [...]}}, "reports": [...]}
# Conversations are private: only members can read them. A report saves a copy of the
# reported message and a few around it, which is all the admin can see.
DM_GROUP_MAX = 25
DM_MESSAGE_LIMIT = 500


def load_dms() -> dict:
    with _JSON_CACHE_LOCK:
        data = _load_json_cached(DM_FILE, "dms.json")
        data.setdefault("convos", {})
        data.setdefault("reports", [])
        return data


def modify_dms(callback):
    def _cb(data):
        data.setdefault("convos", {})
        data.setdefault("reports", [])
        return callback(data)
    return _modify_json_file(DM_FILE, _cb)


def _display(username: str) -> str:
    return ADMIN_DISPLAY.get(username, username)


def _user_exists(username: str) -> bool:
    return username in _load_json_cached(USERS_FILE, "users.json")


def _convo_for(user: str, cid: str):
    c = load_dms()["convos"].get(cid)
    return c if c and user in c.get("members", []) else None


def _convo_summary(c: dict, user: str) -> dict:
    others = [m for m in c["members"] if m != user]
    last = c["messages"][-1] if c["messages"] else None
    if c["type"] == "dm":
        name = _display(others[0]) if others else "Just you"
    else:
        name = c.get("name") or ", ".join(_display(m) for m in others[:3])
    return {
        "id": c["id"], "type": c["type"], "name": name, "owner": c.get("owner"),
        "members": [{"username": m, "display": _display(m), "admin": is_admin(m)} for m in c["members"]],
        "with": others[0] if c["type"] == "dm" and others else None,
        "last": {"display": "You" if last["username"] == user else _display(last["username"]), "message": last.get("message", ""),
                 "timestamp": last["timestamp"]} if last else None,
        "updated": last["timestamp"] if last else c.get("created"),
        "recent": [m["timestamp"] for m in c["messages"][-60:] if m.get("username") != user],
    }


@app.route("/api/people/<username>", methods=["GET"])
def person_profile(username):
    """A student's public mini-profile for chat: picture, name, activity, streak and test count.

    Scores are deliberately not shown. Requires login.
    """
    viewer = current_user()
    if not viewer:
        return jsonify({"ok": False, "error": "Log in to view profiles."}), 401
    name = str(username).strip().lower()
    users = _load_json_cached(USERS_FILE, "users.json")
    rec = users.get(name)
    if not rec:
        return jsonify({"ok": False, "error": "That user wasn't found."}), 404
    activity = rec.get("activity") or {}
    last = _parse_utc(activity.get("last_seen"))
    days = (datetime.datetime.now(datetime.timezone.utc).date() - last.date()).days if last else None
    streak = int(activity.get("streak") or 0) if days is not None and days <= 1 else 0
    with _JSON_CACHE_LOCK:
        progress = _load_json_cached(USER_DATA_FILE, "user_data.json").get(name, {})
        tests = int(progress.get("tests_taken") or len(progress.get("test_history") or []))
    return jsonify({"ok": True, "person": {
        "username": name, "display": _display(name), "admin": is_admin(name), "me": name == viewer,
        "avatar": (rec.get("profile") or {}).get("avatar_image", ""),
        "last_active_days": days, "streak": streak, "tests_taken": tests,
    }})


@app.route("/api/users/search", methods=["GET"])
def users_search():
    """Find people to message by username (logged-in users only)."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    q = request.args.get("q", "").strip().lower()
    if not q:
        return jsonify({"ok": True, "users": []})
    names = [n for n in _load_json_cached(USERS_FILE, "users.json") if n != user]
    starts = sorted(n for n in names if n.startswith(q) or _display(n).lower().startswith(q))
    contains = sorted(n for n in names if q in n and n not in starts)
    return jsonify({"ok": True, "users": [{"username": n, "display": _display(n), "admin": is_admin(n)} for n in (starts + contains)[:12]]})


@app.route("/api/dm/list", methods=["GET"])
def dm_list():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to see your messages."}), 401
    convos = [_convo_summary(c, user) for c in load_dms()["convos"].values() if user in c.get("members", [])]
    convos.sort(key=lambda c: c["updated"] or "", reverse=True)
    admin_name = next(iter(ADMIN_USERS), "")
    return jsonify({"ok": True, "convos": convos, "admin": {"username": admin_name, "display": _display(admin_name)} if admin_name and admin_name != user else None})


@app.route("/api/dm/start", methods=["POST"])
def dm_start():
    """Open (or create) a one-on-one conversation. Body: {username}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to send messages."}), 401
    other = str((request.get_json(silent=True) or {}).get("username", "")).strip().lower()
    if not other or other == user or not _user_exists(other):
        return jsonify({"ok": False, "error": "That user wasn't found."}), 404
    cid = "dm-" + "-".join(sorted([user, other]))

    def _start(data):
        if cid not in data["convos"]:
            data["convos"][cid] = {"id": cid, "type": "dm", "members": sorted([user, other]), "owner": None,
                                   "created": datetime.datetime.now(datetime.timezone.utc).isoformat(), "messages": []}
        return True

    modify_dms(_start)
    return jsonify({"ok": True, "id": cid})


@app.route("/api/dm/group", methods=["POST"])
def dm_group():
    """Create a group chat. Body: {name, members: [usernames]}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to create a group."}), 401
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:60]
    members = [str(m).strip().lower() for m in (data.get("members") or []) if str(m).strip()]
    members = list(dict.fromkeys([user] + [m for m in members if m != user]))
    if not name:
        return jsonify({"ok": False, "error": "Give the group a name."}), 400
    if len(members) < 2:
        return jsonify({"ok": False, "error": "Add at least one person."}), 400
    if len(members) > DM_GROUP_MAX:
        return jsonify({"ok": False, "error": f"Groups can have up to {DM_GROUP_MAX} people."}), 400
    missing = [m for m in members if not _user_exists(m)]
    if missing:
        return jsonify({"ok": False, "error": f"Not found: {', '.join(missing)}"}), 404
    cid = "grp-" + secrets.token_urlsafe(8)

    def _create(d):
        d["convos"][cid] = {"id": cid, "type": "group", "name": name, "owner": user, "members": members,
                            "created": datetime.datetime.now(datetime.timezone.utc).isoformat(), "messages": []}
        return True

    modify_dms(_create)
    return jsonify({"ok": True, "id": cid})


@app.route("/api/dm/messages", methods=["GET"])
def dm_messages():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    c = _convo_for(user, request.args.get("id", ""))
    if not c:
        return jsonify({"ok": False, "error": "Conversation not found."}), 404
    users = _load_json_cached(USERS_FILE, "users.json")
    avatars = {n: (users.get(n, {}).get("profile", {}) or {}).get("avatar_image", "") for n in c["members"]}
    msgs = c["messages"][-200:]
    return jsonify({"ok": True, "convo": _convo_summary(c, user), "messages": [_public_message(m, user) for m in msgs], "avatars": avatars})


def _dm_change(user: str, cid: str, fn):
    """Run fn(convo, data) on a conversation the user belongs to, under the file lock."""
    result = {}

    def _cb(data):
        c = data["convos"].get(cid)
        if not c or user not in c.get("members", []):
            result["error"] = ("Conversation not found.", 404)
            return False
        out = fn(c, data)
        if isinstance(out, tuple):
            result["error"] = out
            return False
        result["value"] = out
        return True

    modify_dms(_cb)
    return result


@app.route("/api/dm/message", methods=["POST"])
def dm_message():
    """Send a message. Body: {id, message, reply_to?}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()[:1000]
    if not message:
        return jsonify({"ok": False, "error": "Message cannot be empty."}), 400
    now = time.time()
    if now - _last_post.get(user, 0) < CHAT_MIN_SECONDS / 2:
        return jsonify({"ok": False, "error": "You're sending messages too fast. Wait a moment."}), 429
    _last_post[user] = now
    entry = {"id": secrets.token_urlsafe(8), "username": user, "message": message,
             "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}

    def _send(c, _d):
        rid = str(data.get("reply_to") or "")
        target = next((m for m in c["messages"] if m.get("id") == rid), None) if rid else None
        if target:
            entry["reply_to"] = {"id": target["id"], "username": _display(target["username"]), "message": target.get("message", "")[:120]}
        c["messages"].append(entry)
        c["messages"] = c["messages"][-DM_MESSAGE_LIMIT:]
        return True

    r = _dm_change(user, str(data.get("id", "")), _send)
    if "error" in r:
        return jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]
    return jsonify({"ok": True, "message": _public_message(entry, user)})


@app.route("/api/dm/react", methods=["POST"])
def dm_react():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    data = request.get_json(silent=True) or {}
    mid, emoji = str(data.get("mid", "")), data.get("emoji")
    if emoji not in CHAT_REACTIONS:
        return jsonify({"ok": False, "error": "Unknown reaction."}), 400

    def _react(c, _d):
        m = next((x for x in c["messages"] if x.get("id") == mid), None)
        if not m:
            return ("Message not found.", 404)
        who = m.setdefault("reactions", {}).setdefault(emoji, [])
        who.remove(user) if user in who else who.append(user)
        if not who:
            m["reactions"].pop(emoji, None)
        return True

    r = _dm_change(user, str(data.get("id", "")), _react)
    return (jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]) if "error" in r else jsonify({"ok": True})


@app.route("/api/dm/delete", methods=["POST"])
def dm_delete():
    """Delete one of your own messages."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    data = request.get_json(silent=True) or {}
    mid = str(data.get("mid", ""))

    def _del(c, _d):
        m = next((x for x in c["messages"] if x.get("id") == mid), None)
        if not m or m.get("username") != user:
            return ("You can only delete your own messages.", 403)
        c["messages"] = [x for x in c["messages"] if x.get("id") != mid]
        return True

    r = _dm_change(user, str(data.get("id", "")), _del)
    return (jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]) if "error" in r else jsonify({"ok": True})


@app.route("/api/dm/members", methods=["POST"])
def dm_members():
    """Group owner: add/remove people or rename. Body: {id, add?: [], remove?: [], name?}."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    data = request.get_json(silent=True) or {}
    add = [str(m).strip().lower() for m in (data.get("add") or []) if str(m).strip()]
    remove = [str(m).strip().lower() for m in (data.get("remove") or [])]
    missing = [m for m in add if not _user_exists(m)]
    if missing:
        return jsonify({"ok": False, "error": f"Not found: {', '.join(missing)}"}), 404

    def _edit(c, _d):
        if c["type"] != "group":
            return ("Only group chats have members to manage.", 400)
        if c.get("owner") != user:
            return ("Only the group's creator can change it.", 403)
        members = [m for m in c["members"] if m not in remove or m == user]
        members += [m for m in add if m not in members]
        if len(members) > DM_GROUP_MAX:
            return (f"Groups can have up to {DM_GROUP_MAX} people.", 400)
        c["members"] = members
        if data.get("name"):
            c["name"] = str(data["name"]).strip()[:60]
        return True

    r = _dm_change(user, str(data.get("id", "")), _edit)
    return (jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]) if "error" in r else jsonify({"ok": True})


@app.route("/api/dm/leave", methods=["POST"])
def dm_leave():
    """Leave a group. If the creator leaves, the next member takes over; empty groups are removed."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    cid = str((request.get_json(silent=True) or {}).get("id", ""))

    def _leave(c, d):
        if c["type"] != "group":
            return ("You can't leave a direct message.", 400)
        c["members"] = [m for m in c["members"] if m != user]
        if not c["members"]:
            d["convos"].pop(c["id"], None)
        elif c.get("owner") == user:
            c["owner"] = c["members"][0]
        return True

    r = _dm_change(user, cid, _leave)
    return (jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]) if "error" in r else jsonify({"ok": True})


@app.route("/api/dm/report", methods=["POST"])
def dm_report():
    """Report a private message. Saves a copy of it and up to 3 messages before and after."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in first."}), 401
    data = request.get_json(silent=True) or {}
    mid, reason = str(data.get("mid", "")), str(data.get("reason", ""))[:200]

    def _report(c, d):
        idx = next((i for i, x in enumerate(c["messages"]) if x.get("id") == mid), None)
        if idx is None:
            return ("Message not found.", 404)
        around = c["messages"][max(0, idx - 3): idx + 4]
        d["reports"].append({
            "rid": secrets.token_urlsafe(6), "convo": c["id"], "mid": mid, "by": user, "reason": reason,
            "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "where": "Direct message" if c["type"] == "dm" else f"Group: {c.get('name', '')}",
            "context": [{"id": x["id"], "display": _display(x["username"]), "message": x.get("message", ""),
                         "timestamp": x["timestamp"], "reported": x["id"] == mid} for x in around],
        })
        d["reports"] = d["reports"][-200:]
        return True

    r = _dm_change(user, str(data.get("id", "")), _report)
    return (jsonify({"ok": False, "error": r["error"][0]}), r["error"][1]) if "error" in r else jsonify({"ok": True})


@app.route("/api/dm/reports", methods=["GET", "POST"])
def dm_reports():
    """Admin: GET reported private messages (only the saved copies); POST {rid, action: keep|delete}."""
    user = current_user()
    if not is_admin(user):
        return jsonify({"ok": False, "error": "Admins only."}), 403
    if request.method == "GET":
        return jsonify({"ok": True, "reports": list(reversed(load_dms()["reports"]))})
    data = request.get_json(silent=True) or {}
    rid, action = str(data.get("rid", "")), data.get("action")

    def _handle(d):
        rep = next((r for r in d["reports"] if r.get("rid") == rid), None)
        if not rep:
            return False
        if action == "delete":
            c = d["convos"].get(rep["convo"])
            if c:
                c["messages"] = [x for x in c["messages"] if x.get("id") != rep["mid"]]
        d["reports"] = [r for r in d["reports"] if r.get("mid") != rep["mid"]]
        return True

    if not modify_dms(_handle):
        return jsonify({"ok": False, "error": "Report not found."}), 404
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Flashcard review endpoints
# ---------------------------------------------------------------------------

@app.route("/api/flashcard/reviews", methods=["GET"])
def flashcard_reviews():
    """Return the logged-in user's marked flashcards for an exam."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to see marked cards."}), 401
    filename = request.args.get("filename", "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "No filename provided."}), 400
    user_data = load_user_record(user)
    reviews = _get_flashcard_reviews_for_user(user_data, user, filename)
    return jsonify({"ok": True, "reviews": sorted(reviews, key=lambda x: int(x) if x.isdigit() else x)})


@app.route("/api/flashcard/review", methods=["POST"])
def flashcard_review_toggle():
    """Toggle a flashcard's review status for the logged-in user."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to mark cards."}), 401
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()
    question_id = data.get("question_id")
    if not filename or question_id is None:
        return jsonify({"ok": False, "error": "Filename and question_id required."}), 400
    marked = _toggle_flashcard_review(user, filename, question_id)
    return jsonify({"ok": True, "marked": marked})


# ---------------------------------------------------------------------------
# Flashcard session persistence (server-side, logged-in users only)
# ---------------------------------------------------------------------------

@app.route("/api/flashcard/session", methods=["GET"])
def get_flashcard_session():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "session": None}), 200
    user_data = load_user_record(user)
    record = user_data.get(user, {})
    saved = record.get("flashcard_session")
    return jsonify({"ok": True, "session": saved})


@app.route("/api/flashcard/session", methods=["POST"])
def save_flashcard_session():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Not logged in"}), 401
    body = request.get_json(silent=True) or {}
    sess = body.get("session")
    def _save_session(user_data: dict):
        record = user_data.get(user)
        if not record:
            record = user_data.setdefault(user, {})
        if sess is None:
            record.pop("flashcard_session", None)
        else:
            record["flashcard_session"] = sess
        return True

    modify_user_data(_save_session)
    return jsonify({"ok": True})


@app.route("/api/flashcard/session", methods=["DELETE"])
def delete_flashcard_session():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Not logged in"}), 401
    def _delete_session(user_data: dict):
        record = user_data.get(user)
        if not record:
            return False
        record.pop("flashcard_session", None)
        return True

    modify_user_data(_delete_session)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Custom flashcards ("My Flashcards") endpoints
# ---------------------------------------------------------------------------

@app.route("/api/my-flashcards", methods=["GET"])
def get_my_flashcards():
    """Return the logged-in user's custom flashcard decks."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to use My Flashcards."}), 401
    user_data = load_user_record(user)
    record = user_data.get(user, {})
    decks = record.get("my_flashcards", [])
    return jsonify({"ok": True, "decks": decks})


@app.route("/api/my-flashcards", methods=["POST"])
def save_my_flashcards():
    """Save the logged-in user's entire flashcard decks array."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to save flashcards."}), 401
    data = request.get_json(silent=True) or {}
    decks = data.get("decks")
    if decks is None or not isinstance(decks, list):
        return jsonify({"ok": False, "error": "Invalid decks data."}), 400

    def _save_decks(user_data: dict):
        record = user_data.setdefault(user, {})
        record["my_flashcards"] = decks
        return True

    modify_user_data(_save_decks)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Mastery mode endpoints
# ---------------------------------------------------------------------------

@app.route("/api/mastery", methods=["GET"])
def get_mastery():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to track mastery progress."}), 401
    filename = request.args.get("filename", "").strip()
    questions = get_questions_for_test(filename)
    if not questions:
        return jsonify({"ok": False, "error": "No questions found."}), 503
    user_data = load_user_record(user)
    mastery = _get_mastery_for_user(user_data, user, filename)
    summary = _compute_mastery_summary(mastery, questions)
    return jsonify({"ok": True, "summary": summary, "mastery": mastery})


@app.route("/api/mastery/batch", methods=["GET"])
def mastery_batch():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to track mastery progress."}), 401
    try:
        n = int(request.args.get("n", 20))
    except ValueError:
        n = 20
    filename = request.args.get("filename", "").strip()
    questions = get_questions_for_test(filename)
    if not questions:
        return jsonify({"ok": False, "error": "No questions found."}), 503

    def _build_working_set(user_data: dict):
        exam = _get_mastery_for_user(user_data, user, filename)
        question_store = exam.setdefault("questions", {})
        working_set = exam.setdefault("working_set", [])

        mastered_qids = {qid for qid, entry in question_store.items() if entry.get("mastered")}
        # Drop mastered questions from the working set.
        working_set[:] = [qid for qid in working_set if qid not in mastered_qids]

        # Refill the working set with non-mastered questions not already in it.
        current_set = set(working_set)
        candidates = [q for q in questions if str(q["id"]) not in mastered_qids and str(q["id"]) not in current_set]
        # Prefer questions with the lowest streak so new questions appear before partially learned ones.
        # When starting fresh (empty working set), shuffle first so each new session has a different order.
        fresh_start = len(working_set) == 0
        if fresh_start:
            random.shuffle(candidates)
        else:
            candidates.sort(key=lambda q: question_store.get(str(q["id"]), {}).get("streak", 0))
        while len(working_set) < n and candidates:
            working_set.append(str(candidates.pop(0)["id"]))
        return exam

    exam = modify_user_data(_build_working_set)
    working_set = exam.get("working_set", []) if isinstance(exam, dict) else []

    selected = [q for q in questions if str(q["id"]) in working_set[:n]]

    quiz = []
    for q in selected:
        item = {
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "_correct_answer": q["correct_answer"],
        }
        if q.get("type"):
            item["type"] = q["type"]
        if q.get("terms"):
            item["terms"] = q["terms"]
        if q.get("definitions"):
            item["definitions"] = q["definitions"]
        if q.get("correct_pairs"):
            item["correct_pairs"] = q["correct_pairs"]
        if q.get("image"):
            item["image"] = q["image"]
        if q.get("option_images"):
            item["option_images"] = q["option_images"]
        quiz.append(item)

    summary = _compute_mastery_summary(exam, questions)
    return jsonify({"ok": True, "quiz": quiz, "summary": summary, "filename": filename})


@app.route("/api/mastery/submit", methods=["POST"])
def mastery_submit():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to track mastery progress."}), 401
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()
    answers = data.get("answers", {})
    provided_quiz = data.get("quiz", [])
    if not filename or not provided_quiz:
        return jsonify({"ok": False, "error": "Filename and quiz are required."}), 400

    questions = provided_quiz
    id_map = {q["id"]: q for q in questions}
    newly_mastered = 0

    def _submit_mastery(user_data: dict):
        nonlocal newly_mastered
        exam = _get_mastery_for_user(user_data, user, filename)
        question_store = exam.setdefault("questions", {})
        working_set = exam.setdefault("working_set", [])
        newly_mastered = 0

        for qid_str, selected in answers.items():
            qid = int(qid_str)
            q = id_map.get(qid)
            if not q:
                continue
            is_correct = _is_answer_correct(q, selected)
            entry = _get_question_entry(exam, str(qid))
            if _update_mastery_entry(entry, is_correct):
                newly_mastered += 1
                if str(qid) in working_set:
                    working_set.remove(str(qid))
        return exam

    exam = modify_user_data(_submit_mastery)
    all_questions = get_questions_for_test(filename)
    summary = _compute_mastery_summary(exam, all_questions)
    return jsonify({"ok": True, "summary": summary, "newly_mastered": newly_mastered})


@app.route("/api/mastery/debug", methods=["GET"])
def mastery_debug():
    """Return raw mastery entries for the current user and exam for troubleshooting."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to track mastery progress."}), 401
    filename = request.args.get("filename", "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "Filename is required."}), 400
    questions = get_questions_for_test(filename)
    if not questions:
        return jsonify({"ok": False, "error": "No questions found."}), 503

    user_data = load_user_record(user)
    exam = _get_mastery_for_user(user_data, user, filename)
    working_set = exam.get("working_set", [])

    entries = []
    for q in questions:
        qid = str(q["id"])
        entry = exam.get("questions", {}).get(qid, {})
        if entry or qid in working_set:
            entries.append({
                "id": q["id"],
                "in_working_set": qid in working_set,
                "entry": entry,
            })

    summary = get_mastery_summary(user, filename, questions)
    return jsonify({"ok": True, "summary": summary, "working_set": working_set, "entries": entries})


@app.route("/api/mastery/reset", methods=["POST"])
def mastery_reset():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to track mastery progress."}), 401
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()
    if not filename:
        return jsonify({"ok": False, "error": "Filename is required."}), 400
    def _reset_mastery(user_data: dict):
        record = user_data.get(user)
        if not record:
            return False
        if "mastery" in record and filename in record["mastery"]:
            del record["mastery"][filename]
            return True
        return False

    modified = modify_user_data(_reset_mastery)
    all_questions = get_questions_for_test(filename)
    if modified:
        # Mastery was reset: return a 0-progress summary without re-reading user_data.
        summary = _compute_mastery_summary({"questions": {}, "working_set": []}, all_questions)
    else:
        summary = get_mastery_summary(user, filename, all_questions)
    return jsonify({"ok": True, "summary": summary})


@app.route("/download/study-guide/<path:filename>")
def download_study_guide(filename):
    """Serve a study guide PDF as a download so it doesn't open in the browser viewer."""
    if ".." in filename or not filename.endswith(".pdf"):
        abort(400)
    study_guides_dir = Path(app.static_folder) / "study-guides"
    safe_path = (study_guides_dir / filename).resolve()
    if not str(safe_path).startswith(str(study_guides_dir.resolve())) or not safe_path.exists():
        abort(404)
    return send_from_directory(study_guides_dir, filename, as_attachment=True)


write_sitemap()


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=debug)
