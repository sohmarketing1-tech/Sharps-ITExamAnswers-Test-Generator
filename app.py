import datetime
import fcntl
import json
import os
import random
import secrets
from pathlib import Path
from typing import Optional

from flask import Flask, jsonify, request, redirect, Response, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash

from scraper import scrape_url, is_valid_itexamanswers_url, DEFAULT_TARGET_URL, DEFAULT_OUTPUT

app = Flask(__name__, static_folder="static", static_url_path="")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SITE_URL = "https://answrit.net"
DEFAULT_PAGE_TITLE = "AnswrIT - ITE & CCNA Exam Answers | Netacad & Navy IT Rate Study Guide"
DEFAULT_PAGE_DESCRIPTION = "Free ITE answers, CCNA exam answers, and Netacad study help for the Navy IT rate A school and Cisco certification students. Practice tests, flashcards, and mastery tracking."


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


def render_index_html(page_title: str, page_description: str, canonical_url: str,
                      h1_text: str, seo_intro: str, exam_filename: str = "") -> Response:
    index_path = BASE_DIR / "static" / "index.html"
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


def get_questions_for_test(filename: str = ""):
    """Load questions for a test request, using a specific file if provided."""
    if filename:
        filepath = DATA_DIR / filename
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and "questions" in data:
                    return data.get("questions", [])
            except Exception:
                pass
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


def _write_json_file(data: dict, temp_file: Path, target_file: Path) -> None:
    """Write data to a temp file and atomically replace the live file."""
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
    os.replace(temp_file, target_file)


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
                data = _load_json_file(file, file.name)
                result = callback(data)
                if result is False:
                    return False
                if file.exists():
                    backup_file.write_bytes(file.read_bytes())
                _write_json_file(data, temp_file, file)
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
    """Load the small auth/profile file."""
    return _load_json_file(USERS_FILE, "users.json")


def save_users(users: dict) -> None:
    """Persist the small auth/profile file."""
    _save_json_file(users, USERS_FILE)


def modify_users(callback) -> None:
    """Load, modify, and save users.json atomically."""
    return _modify_json_file(USERS_FILE, callback)


def load_user_data() -> dict:
    """Load the large per-user exam/progress file."""
    return _load_json_file(USER_DATA_FILE, "user_data.json")


def save_user_data(data: dict) -> None:
    """Persist the large per-user exam/progress file."""
    _save_json_file(data, USER_DATA_FILE)


def modify_user_data(callback) -> None:
    """Load, modify, and save user_data.json atomically."""
    return _modify_json_file(USER_DATA_FILE, callback)


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


def load_chat() -> dict:
    """Load chat messages from disk."""
    if not CHAT_FILE.exists():
        return {"messages": []}
    try:
        with open(CHAT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"messages": []}


def save_chat(data: dict) -> None:
    """Persist chat messages to disk."""
    with open(CHAT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def add_chat_message(username: str, message: str) -> dict:
    """Add a new chat message and return the message entry."""
    from datetime import datetime, timezone
    users = load_users()
    user_data = users.get(username, {})
    profile = user_data.get("profile", {})
    data = load_chat()
    messages = data.setdefault("messages", [])
    entry = {
        "username": username,
        "message": message.strip()[:500],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "avatar_image": profile.get("avatar_image", ""),
    }
    messages.append(entry)
    data["messages"] = messages[-500:]
    save_chat(data)
    return entry


def get_chat_messages(limit: int = 100) -> list:
    """Return the most recent chat messages."""
    data = load_chat()
    messages = data.get("messages", [])
    return messages[-limit:]


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


def get_mastery_summary(username: str, filename: str, questions: list) -> dict:
    """Return mastery stats for a user and exam."""
    user_data = load_user_data()
    exam = _get_mastery_for_user(user_data, username, filename)
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


@app.route("/")
def index():
    return render_index_html(
        page_title=DEFAULT_PAGE_TITLE,
        page_description=DEFAULT_PAGE_DESCRIPTION,
        canonical_url=f"{SITE_URL}/",
        h1_text="AnswrIT - Free ITE & CCNA Exam Answers for Netacad Students",
        seo_intro="Boost your scores with free ITE answers, CCNA answers, and Netacad study tools. Built for Navy IT rate A school students and anyone taking Cisco IT Essentials or CCNA certification exams.",
    )


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
    return render_index_html(
        page_title=DEFAULT_PAGE_TITLE,
        page_description=DEFAULT_PAGE_DESCRIPTION,
        canonical_url=f"{SITE_URL}/",
        h1_text="AnswrIT",
        seo_intro="",
    )


@app.route("/exams/<slug>/")
def exam_page(slug: str):
    exam = exam_by_slug(slug)
    if not exam:
        return redirect("/", code=302)
    filename = exam.get("filename", f"{slug}.json")
    display = display_name_for(filename, exam.get("display_name", ""))
    title = f"{display} Exam Answers - AnswrIT"
    description = f"Free {display} exam answers and practice tests. Study flashcards, mastery mode, and timed quizzes for Netacad and Navy IT A school students."
    canonical = f"{SITE_URL}/exams/{slug}/"
    h1 = f"{display} Exam Answers & Practice Tests"
    intro = f"Get free {display} exam answers, practice tests, and flashcards on AnswrIT. Built for Netacad students and Navy IT rate A school trainees."
    return render_index_html(
        page_title=title,
        page_description=description,
        canonical_url=canonical,
        h1_text=h1,
        seo_intro=intro,
        exam_filename=filename,
    )


@app.route("/google46429450d03302f8.html")
def google_verify():
    return send_from_directory(app.static_folder, "google46429450d03302f8.html")


@app.route("/sitemap.xml")
def sitemap():
    today = datetime.date.today().isoformat()
    slugs = []
    for exam in load_exam_manifest():
        filename = exam.get("filename", "")
        if filename.endswith(".json"):
            slugs.append(filename[:-5])
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    lines.append(f"  <url><loc>{SITE_URL}/</loc><lastmod>{today}</lastmod><priority>1.0</priority></url>")
    for slug in slugs:
        lines.append(f"  <url><loc>{SITE_URL}/exams/{slug}/</loc><lastmod>{today}</lastmod><priority>0.8</priority></url>")
    lines.append("</urlset>")
    return Response("\n".join(lines), mimetype="application/xml")


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
    if not filepath.exists():
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None
    if isinstance(data, dict) and "questions" in data:
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

    filepath = DATA_DIR / filename
    if not filepath.exists():
        return jsonify({"ok": False, "error": f"Exam file not found: {filename}"}), 404

    exam_data = read_exam_file(filepath)
    if exam_data is None:
        return jsonify({"ok": False, "error": f"Failed to read {filename}"}), 500

    return jsonify({
        "ok": True,
        "title": exam_data.get("title"),
        "filename": filepath.name,
        "count": len(exam_data.get("questions", [])),
        "questions": exam_data.get("questions", []),
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
    user_data = load_user_data()
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
    user_data = load_user_data()
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
    return jsonify({"ok": True, "user": user, "profile": profile})


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

    # Update this user's existing chat messages to the new avatar
    chat_data = load_chat()
    for msg in chat_data.get("messages", []):
        if msg.get("username") == user:
            msg["avatar_image"] = updated_profile.get("avatar_image", "")
    save_chat(chat_data)

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

@app.route("/api/chat/messages", methods=["GET"])
def chat_messages():
    """Return the latest chat messages."""
    return jsonify({"ok": True, "messages": get_chat_messages(limit=100)})


@app.route("/api/chat/message", methods=["POST"])
def chat_message():
    """Post a new chat message. Requires login."""
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "Log in to chat."}), 401
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    if not message:
        return jsonify({"ok": False, "error": "Message cannot be empty."}), 400
    entry = add_chat_message(user, message)
    return jsonify({"ok": True, "message": entry})


@app.route("/api/chat/avatars", methods=["GET"])
def chat_avatars():
    """Return the latest avatar info for users with recent chat messages."""
    messages = get_chat_messages(limit=100)
    usernames = {m.get("username") for m in messages}
    users = load_users()
    avatars = {}
    for username in usernames:
        if not username:
            continue
        profile = users.get(username, {}).get("profile", {})
        avatars[username] = {
            "avatar_image": profile.get("avatar_image", ""),
        }
    return jsonify({"ok": True, "avatars": avatars})


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
    user_data = load_user_data()
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
    user_data = load_user_data()
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
    user_data = load_user_data()
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
    user_data = load_user_data()
    mastery = _get_mastery_for_user(user_data, user, filename)
    summary = get_mastery_summary(user, filename, questions)
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

    working_set = []

    def _build_working_set(user_data: dict):
        nonlocal working_set
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
        return True

    modify_user_data(_build_working_set)

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
        quiz.append(item)

    summary = get_mastery_summary(user, filename, questions)
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
        return True

    modify_user_data(_submit_mastery)
    all_questions = get_questions_for_test(filename)
    summary = get_mastery_summary(user, filename, all_questions)
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

    user_data = load_user_data()
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

    modify_user_data(_reset_mastery)
    all_questions = get_questions_for_test(filename)
    summary = get_mastery_summary(user, filename, all_questions)
    return jsonify({"ok": True, "summary": summary})


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=debug)
