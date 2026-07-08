import datetime
import json
import os
import random
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from scraper import scrape_url, is_valid_itexamanswers_url, DEFAULT_TARGET_URL, DEFAULT_OUTPUT

app = Flask(__name__, static_folder="static", static_url_path="")

BASE_DIR = Path(__file__).resolve().parent
QUESTIONS_FILE = BASE_DIR / DEFAULT_OUTPUT
DATA_DIR = BASE_DIR / "data"
STATS_FILE = BASE_DIR / "stats.json"


# In-memory state for the currently loaded exam
app_state = {
    "title": None,
    "url": None,
    "filename": None,
    "questions": [],
}


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


def load_stats():
    """Load persisted stats (study sessions and thanks)."""
    if not STATS_FILE.exists():
        return {"study_sessions": [], "thanks": []}
    try:
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return {"study_sessions": [], "thanks": []}
    return {
        "study_sessions": data.get("study_sessions", []),
        "thanks": data.get("thanks", []),
    }


def save_stats(stats):
    """Persist stats to disk."""
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def add_study_session(name: str) -> dict:
    stats = load_stats()
    name = name.strip()[:40]
    if not name:
        return stats
    sessions = stats.get("study_sessions", [])
    sessions = [s for s in sessions if s.get("name", "").lower() != name.lower()]
    sessions.append({"name": name, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"})
    stats["study_sessions"] = sessions[-50:]  # keep last 50
    save_stats(stats)
    return stats


def add_thanks(name: str) -> dict:
    stats = load_stats()
    name = name.strip()[:40] or "Anonymous"
    thanks = stats.get("thanks", [])
    thanks.append({"name": name, "timestamp": datetime.datetime.utcnow().isoformat() + "Z"})
    stats["thanks"] = thanks
    save_stats(stats)
    return stats


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/state")
def get_state():
    questions = get_current_questions()
    return jsonify({
        "title": get_current_title(),
        "url": get_current_url(),
        "total": len(questions),
    })


@app.route("/api/stats")
def get_stats():
    """Return current study sessions and thanks."""
    return jsonify(load_stats())


@app.route("/api/studied", methods=["POST"])
def record_studied():
    """Record that someone studied."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "Please enter your name."}), 400
    stats = add_study_session(name)
    return jsonify({"ok": True, "stats": stats})


@app.route("/api/thanks", methods=["POST"])
def record_thanks():
    """Record a thank you."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip() or "Anonymous"
    stats = add_thanks(name)
    return jsonify({"ok": True, "stats": stats})


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
            exams = manifest.get("exams", [])
        except Exception:
            pass
    return jsonify({
        "current_filename": app_state.get("filename"),
        "exams": exams,
    })


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
        })
    return jsonify({"ok": False, "error": f"Failed to load {filename}"}), 500


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
        if q.get("image"):
            item["image"] = q["image"]
        quiz.append(item)
    return jsonify({
        "title": get_current_title() if not filename else None,
        "quiz": quiz,
    })


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
    id_map = {q["id"]: q for q in questions}

    results = []
    correct_count = 0
    for qid_str, selected in answers.items():
        qid = int(qid_str)
        q = id_map.get(qid)
        if not q:
            continue
        correct_set = set(a.strip() for a in q["correct_answer"].split("|"))
        selected_set = set(s.strip() for s in (selected if isinstance(selected, list) else [selected]))
        is_correct = selected_set == correct_set
        if is_correct:
            correct_count += 1
        results.append({
            "id": qid,
            "question": q["question"],
            "options": q["options"],
            "selected": sorted(selected_set),
            "correct_answer": sorted(correct_set),
            "is_correct": is_correct,
        })

    total = len(results)
    score = round((correct_count / total) * 100, 2) if total else 0
    return jsonify({
        "title": get_current_title(),
        "total": total,
        "correct": correct_count,
        "score": score,
        "results": results,
    })


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), debug=debug)
