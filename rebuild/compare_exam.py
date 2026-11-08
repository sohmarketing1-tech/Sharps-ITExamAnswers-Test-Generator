"""Rebuild an exam from an ITExamAnswers page and compare it with the current exam file.

Usage:
    python rebuild/compare_exam.py <page.html> <matching-read.json> <current-exam.json> <out-dir>

- <page.html>: the saved ITExamAnswers page.
- <matching-read.json>: the matching questions Claude read from the answer pictures
  (a list of questions in our matching format, plus "page_number" and "image").
- <current-exam.json>: the exam file now on the site (data/<exam>.json).

Writes to <out-dir>:
- new-exam.json: the rebuilt exam. Questions that match the current file keep their old
  id, so users' mastery progress carries over.
- report.md: what's the same, what's different, and what's new or missing.

See EXAM-REBUILD.md for the full process.
"""
import difflib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scraper import scrape_questions  # noqa: E402


def norm(text: str) -> str:
    text = str(text or "").lower()
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    text = text.replace("–", "-").replace("—", "-").replace(" ", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text.rstrip(" .")


def answer_set(q: dict) -> set:
    return {norm(a) for a in str(q.get("correct_answer", "")).split("|") if a.strip()}


def key_for(q: dict) -> str:
    if q.get("type") == "matching":
        return norm(q["question"]) + "||" + "|".join(sorted(norm(t) for t in q.get("terms", [])))
    return norm(q["question"]) + "||" + "|".join(sorted(norm(o) for o in q.get("options", [])))


def pairs_norm(q: dict) -> dict:
    return {norm(k): norm(v) for k, v in (q.get("correct_pairs") or {}).items()}


def image_name(q: dict) -> str:
    return (q.get("image") or "").split("/")[-1]


READ_ONLY_KEYS = ("page_number", "image", "exam", "answer_picture", "exhibit", "notes")


def from_reading(m: dict) -> dict:
    """Turn one picture reading into a question in our exam format."""
    q = {k: v for k, v in m.items() if k not in READ_ONLY_KEYS}
    if m.get("exhibit"):
        q["image"] = m["exhibit"]
    if not q.get("option_images"):
        q.pop("option_images", None)
    return q


def build(page_html: str, matching: list) -> list:
    """Scrape the page, then add the questions read from answer pictures.

    A picture reading replaces any version of the same question the scraper made
    (e.g. a question whose choices are pictures, which the scraper only half-captures).
    """
    readings = [m for m in matching if m.get("type") != "unknown"]
    read_texts = {norm(m["question"]) for m in readings}
    questions = [q for q in scrape_questions(page_html, "https://itexamanswers.net/") if norm(q["question"]) not in read_texts]
    questions += [from_reading(m) for m in readings]
    # Clean up: remove invisible zero-width characters, and drop exact repeats
    # (some pages list the same question twice).
    questions = [clean(q) for q in questions]
    seen, unique = set(), []
    for q in questions:
        k = key_for(q) + "##" + json.dumps(q.get("correct_pairs") or q.get("correct_answer"), sort_keys=True)
        if k not in seen:
            seen.add(k)
            unique.append(q)
    return unique


INVISIBLE = re.compile("[​‌‍﻿]")


def clean(value):
    if isinstance(value, str):
        return re.sub(r"\s+$", "", INVISIBLE.sub("", value)) if value.strip() else INVISIBLE.sub("", value)
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {clean(k): clean(v) for k, v in value.items()}
    return value


def compare(new: list, old: list):
    old_by_key = {}
    for q in old:
        old_by_key.setdefault(key_for(q), []).append(q)
    matched, unmatched_new = [], []
    used_old = set()
    for q in new:
        cands = [o for o in old_by_key.get(key_for(q), []) if o["id"] not in used_old]
        if cands:
            matched.append((q, cands[0]))
            used_old.add(cands[0]["id"])
        else:
            unmatched_new.append(q)
    # Second pass: same question with reworded text or changed choices.
    remaining_old = [o for o in old if o["id"] not in used_old]
    still_new = []
    for q in unmatched_new:
        best, best_score = None, 0.0
        for o in remaining_old:
            if o["id"] in used_old or o.get("type") != q.get("type"):
                continue
            a, b = norm(q["question"]), norm(o["question"])
            # Same question with extra words added at the end, e.g. "(Not all options are used.)".
            score = 1.0 if (a.startswith(b) or b.startswith(a)) else difflib.SequenceMatcher(None, a, b).ratio()
            if score > best_score:
                best, best_score = o, score
        if best is not None and best_score >= 0.9:
            matched.append((q, best))
            used_old.add(best["id"])
        else:
            still_new.append(q)
    only_old = [o for o in old if o["id"] not in used_old]
    return matched, still_new, only_old


def differences(q: dict, o: dict) -> list:
    diffs = []
    if norm(q["question"]) != norm(o["question"]):
        diffs.append(("Question wording", o["question"], q["question"]))
    if q.get("type") == "matching" or o.get("type") == "matching":
        if pairs_norm(q) != pairs_norm(o):
            diffs.append(("Matching pairs", json.dumps(o.get("correct_pairs"), ensure_ascii=False), json.dumps(q.get("correct_pairs"), ensure_ascii=False)))
        if sorted(map(norm, q.get("terms", []))) != sorted(map(norm, o.get("terms", []))):
            diffs.append(("Matching items", "; ".join(o.get("terms", [])), "; ".join(q.get("terms", []))))
        if sorted(map(norm, q.get("definitions", []))) != sorted(map(norm, o.get("definitions", []))):
            diffs.append(("Matching boxes", "; ".join(o.get("definitions", [])), "; ".join(q.get("definitions", []))))
    else:
        if answer_set(q) != answer_set(o):
            diffs.append(("Correct answer", o.get("correct_answer", ""), q.get("correct_answer", "")))
        if sorted(map(norm, q.get("options", []))) != sorted(map(norm, o.get("options", []))):
            diffs.append(("Answer choices", " / ".join(o.get("options", [])), " / ".join(q.get("options", []))))
    if image_name(q) != image_name(o):
        diffs.append(("Picture", image_name(o) or "(none)", image_name(q) or "(none)"))
    return diffs


def main():
    page, matching_path, current_path, out_dir = sys.argv[1:5]
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    current = json.load(open(current_path, encoding="utf-8"))
    old = current["questions"]
    new = build(open(page, encoding="utf-8").read(), json.load(open(matching_path, encoding="utf-8")))

    matched, only_new, only_old = compare(new, old)
    next_id = max(q["id"] for q in old) + 1
    final = []
    for q, o in matched:
        final.append({**q, "id": o["id"]})
    for q in only_new:
        final.append({**q, "id": next_id})
        next_id += 1
    final.sort(key=lambda q: q["id"])
    json.dump({**current, "questions": final}, open(out / "new-exam.json", "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    changed = [(q, o, differences(q, o)) for q, o in matched]
    changed = [c for c in changed if c[2]]
    lines = [
        f"# Rebuild report: {current.get('title', current_path)}",
        "",
        f"- Questions on the site page: **{len(new)}** ({sum(1 for q in new if q.get('type') == 'matching')} matching)",
        f"- Questions in the current file: **{len(old)}** ({sum(1 for q in old if q.get('type') == 'matching')} matching)",
        f"- In both and identical: **{len(matched) - len(changed)}**",
        f"- In both but different: **{len(changed)}**",
        f"- Only on the site (new): **{len(only_new)}**",
        f"- Only in the current file (missing from the site): **{len(only_old)}**",
        f"- Pictures in questions: site {sum(1 for q in new if q.get('image'))}, current {sum(1 for q in old if q.get('image'))}",
        "",
    ]
    if changed:
        lines += ["## Different", ""]
        for q, o, diffs in changed:
            lines.append(f"### #{o['id']}: {o['question']}")
            for what, before, after in diffs:
                lines.append(f"- **{what}**\n  - current: {before}\n  - site: {after}")
            lines.append("")
    if only_new:
        lines += ["## Only on the site", ""] + [f"- {q['question']} (answer: {q.get('correct_answer') or 'matching'})" for q in only_new] + [""]
    if only_old:
        lines += ["## Only in the current file", ""] + [f"- #{q['id']}: {q['question']}" for q in only_old] + [""]
    readings = json.load(open(matching_path, encoding="utf-8"))
    unknown = [m for m in readings if m.get("type") == "unknown"]
    if unknown:
        lines += ["## Couldn't be turned into a question", ""] + [f"- Page Q{m.get('page_number')}: {m['question']} ({m.get('notes', '')})" for m in unknown] + [""]
    noted = [m for m in readings if m.get("notes") and str(m["notes"]).strip().lower() not in ("none", "")]
    if noted:
        lines += ["## Notes from reading the pictures", ""] + [f"- Page Q{m.get('page_number')}: {m['notes']}" for m in noted] + [""]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:10]))


if __name__ == "__main__":
    main()
