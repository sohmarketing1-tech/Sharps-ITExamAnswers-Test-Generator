"""Build static/beta/hints/<exam>.json for every exam from the written hint files.

Input: a folder of written hints (one JSON per exam, keyed by question id:
{"cue", "keys": [..], "tip", "why"}), written only for each exam's unique questions, plus dups.json
(exam -> {question id: [owner exam, owner id]}) for questions that repeat an earlier exam's question.

Output per exam: {id: {"cue", "keys": [{"k", "unique"}], "tip", "why"}}. A key is "unique" when it shows up in
only one answer choice in that whole exam. Fails if a key isn't really in the right answer.

Usage: python3 tools/build_hints_all.py <folder with out/ and dups.json>
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path(sys.argv[1])
exams = json.loads((ROOT / "data" / "exams.json").read_text())["exams"]
dups = json.loads((SRC / "dups.json").read_text())
written = {}
for p in (SRC / "out").glob("*.json"):
    written[p.name] = json.loads(p.read_text())


def questions(fn):
    d = json.loads((ROOT / "data" / fn).read_text())
    return d["questions"] if isinstance(d, dict) else d


def right_text(q):
    if q.get("correct_pairs"):
        p = q["correct_pairs"]
        pairs = p.items() if isinstance(p, dict) else [(x[0], x[1]) for x in p]
        return " ".join(f"{a} {b}" for a, b in pairs).lower()
    ca = q.get("correct_answer")
    return (" ".join(map(str, ca)) if isinstance(ca, list) else " ".join(str(ca or "").split("|"))).lower()


problems, total = [], 0
for e in exams:
    fn = e["filename"]
    qs = questions(fn)
    all_opts = [o.lower() for q in qs for o in (q.get("options") or [])]
    for q in qs:
        cp = q.get("correct_pairs") or {}
        all_opts += [str(v).lower() for v in (cp.values() if isinstance(cp, dict) else [])]
    out = {}
    for q in qs:
        qid = str(q["id"])
        src = written.get(fn, {}).get(qid)
        if src is None and qid in dups.get(fn, {}):
            ofn, oid = dups[fn][qid]
            src = written.get(ofn, {}).get(oid)
        if src is None:
            problems.append(f"{fn} {qid}: no hint")
            continue
        right = right_text(q)
        keys = []
        for k in src["keys"]:
            if k.lower() not in right:
                problems.append(f"{fn} {qid}: key '{k}' not in the right answer")
            hits = sum(1 for o in all_opts if re.search(r"(?<![a-z0-9])" + re.escape(k.lower()) + r"(?![a-z0-9])", o))
            keys.append({"k": k, "unique": hits == 1})
        out[qid] = {"cue": src["cue"], "keys": keys, "tip": src["tip"], "why": src["why"]}
    total += len(out)
    dest = ROOT / "static/beta/hints" / fn
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
if problems:
    print(f"{len(problems)} problems:\n" + "\n".join(problems[:60]))
    sys.exit(1)
print(f"{total} hints written for {len(exams)} exams")
