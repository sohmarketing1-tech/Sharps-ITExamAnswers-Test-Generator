import json
import os
import random
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from scraper import scrape_url, is_valid_itexamanswers_url, DEFAULT_TARGET_URL, DEFAULT_OUTPUT

app = Flask(__name__, static_folder="static", static_url_path="/static")

BASE_DIR = Path(__file__).resolve().parent
QUESTIONS_FILE = BASE_DIR / DEFAULT_OUTPUT


# In-memory state for the currently loaded exam
app_state = {
    "title": None,
    "url": None,
    "questions": [],
}


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


def get_current_questions():
    if not app_state["questions"]:
        title, url, questions = load_local_data()
        app_state["title"] = title
        app_state["url"] = url
        app_state["questions"] = questions
    return app_state["questions"]


def get_current_title():
    get_current_questions()
    return app_state["title"] or "IT Exam Practice Test"


def get_current_url():
    get_current_questions()
    return app_state["url"] or DEFAULT_TARGET_URL


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


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
    questions = get_current_questions()
    if not questions:
        return jsonify({"error": "No questions loaded. Paste an itexamanswers.net URL and click Scrape."}), 503
    count = max(1, min(n, len(questions)))
    selected = random.sample(questions, count)
    quiz = []
    for q in selected:
        quiz.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "_correct_answer": q["correct_answer"],
        })
    return jsonify({
        "title": get_current_title(),
        "quiz": quiz,
    })


@app.route("/api/score", methods=["POST"])
def score_test():
    data = request.get_json(silent=True) or {}
    answers = data.get("answers", {})
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
