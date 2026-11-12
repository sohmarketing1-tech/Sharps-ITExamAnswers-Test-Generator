"""Check a hints file against its work file.
Usage: python3 check.py <exam-file-name.json>
Reads work/<name> and out/<name>. Prints problems, or OK with counts.
"""
import json, pathlib, re, sys

W = pathlib.Path(__file__).parent
name = sys.argv[1]
work = json.loads((W / "work" / name).read_text())
try:
    out = json.loads((W / "out" / name).read_text())
except FileNotFoundError:
    sys.exit(f"out/{name} doesn't exist yet")
except json.JSONDecodeError as e:
    sys.exit(f"out/{name} is not valid JSON: {e}")

problems = []


def right_text(q):
    if q.get("correct_pairs"):
        p = q["correct_pairs"]
        pairs = p.items() if isinstance(p, dict) else [(x[0], x[1]) for x in p]
        return " ".join(f"{a} {b}" for a, b in pairs).lower()
    ca = q.get("correct_answer")
    if isinstance(ca, list):
        return " ".join(map(str, ca)).lower()
    return " ".join(str(ca or "").split("|")).lower()


ids = {str(q["id"]) for q in work}
for extra in set(out) - ids:
    problems.append(f"{extra}: not a question in this work file")
for q in work:
    qid = str(q["id"])
    h = out.get(qid)
    if not h:
        problems.append(f"{qid}: missing")
        continue
    for f in ("cue", "keys", "tip", "why"):
        if f not in h:
            problems.append(f"{qid}: no '{f}'")
    if not isinstance(h.get("keys"), list) or not (1 <= len(h.get("keys", [])) <= 4):
        problems.append(f"{qid}: keys must be a list of 1-4 strings")
        continue
    right = right_text(q)
    for k in h["keys"]:
        if not isinstance(k, str) or not k.strip():
            problems.append(f"{qid}: empty key")
        elif k.lower() not in right:
            problems.append(f"{qid}: key '{k}' is not copied exactly from the right answer")
    if not (2 <= len(h.get("cue", "")) <= 70):
        problems.append(f"{qid}: cue should be 2-70 characters")
    if not (10 <= len(h.get("tip", "")) <= 220):
        problems.append(f"{qid}: tip should be 10-220 characters (now {len(h.get('tip', ''))})")
    if not (20 <= len(h.get("why", "")) <= 320):
        problems.append(f"{qid}: why should be 20-320 characters (now {len(h.get('why', ''))})")
    text = " ".join(str(h.get(f, "")) for f in ("cue", "tip", "why"))
    if re.search(r"—|shipmate|sailor|navy|naval", text, re.I):
        problems.append(f"{qid}: no em dashes and no Navy words")
    if q.get("existing_hint"):
        e = q["existing_hint"]
        if h.get("cue") != e["cue"] or h.get("tip") != e["tip"] or h.get("keys") != [k["k"] for k in e["keys"]]:
            problems.append(f"{qid}: keep the existing cue, keys and tip exactly; only add 'why'")

if problems:
    print(f"{len(problems)} problems:")
    print("\n".join(problems[:80]))
    sys.exit(1)
print(f"OK: {len(out)} hints for {len(work)} questions")
