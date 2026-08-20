#!/usr/bin/env python3
"""Build a multiple-choice exam from a Quizlet-style term/definition set.

Quizlet flashcard sets only have a term and a definition — no answer
choices, and only one "correct" answer per card. This script turns that
into a standard practice-exam question set (same shape as the scraped
itexamanswers.net exams) by:

  1. Using the definition as the question stem, and the term as the
     correct answer.
  2. Picking 3 plausible wrong-answer terms ("distractors") from the same
     set for each question, filtered so they're not near-duplicates of
     the correct term and are a similar length (so the correct answer
     isn't obviously the odd one out), while spreading distractor reuse
     evenly across the whole deck.
  3. For any term written as "(ACRONYM) Full Expansion" (or "Full Expansion
     (ACRONYM)"), also generating a dedicated "What does ACRONYM stand for?"
     question, with distractors pulled from other real expansions in the
     same deck that share the most words with the correct one (so wrong
     answers are believable, not just any other definition). Disable with
     --no-acronym-questions.

Input can be either:
  - A JSON file: a list of {"term": ..., "definition": ...} objects
    (this is what you get by pasting a Quizlet set into a term/definition
    JSON converter, or exporting via a browser extension).
  - A plain text file: Quizlet's built-in "Export" feature output, one
    card per line, with term and definition separated by a tab (default)
    or another delimiter you specify with --delimiter.

Usage:

    python3 quizlet_exam_builder.py <input_file> "<Exam Title>" [display_name]

Examples:

    python3 quizlet_exam_builder.py MESSAGING.json "Naval Messaging"
    python3 quizlet_exam_builder.py cards.txt "Subnetting Basics" --delimiter ","

This writes data/<slug>.json and adds/updates the entry in
data/exams.json, exactly like add_exam.py does for scraped exams.
"""

import argparse
import json
import random
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Tuple

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
MANIFEST_PATH = DATA_DIR / "exams.json"

NUM_OPTIONS = 4


def slugify(title: str) -> str:
    text = re.sub(r"[^\w\s-]", "", title.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def clean_whitespace(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


def clean_term(raw: str) -> str:
    return clean_whitespace(raw)


def clean_definition(raw: str) -> str:
    """Collapse a multi-line/bulleted definition into a single readable stem."""
    text = unicodedata.normalize("NFKC", raw)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned_lines = []
    for line in lines:
        line = re.sub(r"^[-\u2022*]\s*", "", line)
        cleaned_lines.append(clean_whitespace(line))
    joined = "; ".join(cleaned_lines)
    return clean_whitespace(joined)


def load_pairs_from_json(path: Path) -> List[Tuple[str, str]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    pairs = []
    for item in data:
        term = clean_term(item.get("term", ""))
        definition = clean_definition(item.get("definition", ""))
        if term and definition:
            pairs.append((term, definition))
    return pairs


def load_pairs_from_text(path: Path, delimiter: str) -> List[Tuple[str, str]]:
    pairs = []
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Quizlet's export separates cards with a blank line/newline and
    # term/definition within a card by the delimiter (tab by default).
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        if delimiter not in line:
            continue
        term_raw, definition_raw = line.split(delimiter, 1)
        term = clean_term(term_raw)
        definition = clean_definition(definition_raw)
        if term and definition:
            pairs.append((term, definition))
    return pairs


def load_pairs(path: Path, delimiter: str) -> List[Tuple[str, str]]:
    if path.suffix.lower() == ".json":
        return load_pairs_from_json(path)
    return load_pairs_from_text(path, delimiter)


# Small curated list of classification/handling-marking acronyms. When a term
# is one of these, we prefer distractors from the same group (rather than,
# say, pairing "NIPRNET" against an unrelated job title) since they're the
# terms most likely to actually get confused for one another.
MARKING_ACRONYMS = {
    "NIPRNET", "SIPRNET", "JWICS", "CRITIC", "GENSER", "DSSCS",
    "RD", "FRD", "FOUO", "EFTO", "SPECAT",
}


def extract_acronym(term: str) -> str:
    match = re.match(r"^\(([^)]+)\)", term)
    return (match.group(1) if match else term).upper()


def categorize(term: str) -> str:
    """Rough bucket so distractors get pulled from a similar kind of term
    (e.g. sequence lines vs. sequence lines, markings vs. markings) instead
    of any random term in the deck."""
    if re.match(r"^Line \d+$", term, re.IGNORECASE):
        return "line"
    if extract_acronym(term) in MARKING_ACRONYMS:
        return "marking"
    return "other"


def normalize_for_similarity(term: str) -> str:
    """Strip a leading acronym parenthetical so e.g. '(NCTS) Naval Computer...'
    and '(NCTAMS) Naval Communications...' are compared on their full names,
    not just coincidental word overlap."""
    return re.sub(r"^\([^)]*\)\s*", "", term).lower()


def is_too_similar(term_a: str, term_b: str) -> bool:
    """Only flags true near-duplicates (e.g. the same term entered twice under
    a different acronym casing). Terms that are merely confusable-but-distinct
    (NIPRNET/SIPRNET, RD/FRD, Line 1/Line 2, NCTS/NCTAMS, ...) are NOT
    considered "too similar" here — that kind of similarity is exactly what
    makes a distractor good, not a reason to exclude it."""
    a = normalize_for_similarity(term_a)
    b = normalize_for_similarity(term_b)
    if not a or not b:
        return False
    return a == b


def pick_distractors(
    terms: List[str],
    correct_idx: int,
    usage_counter: List[int],
    rng: random.Random,
    count: int = NUM_OPTIONS - 1,
) -> List[int]:
    correct_term = terms[correct_idx]
    correct_len = len(correct_term)
    correct_category = categorize(correct_term)

    def not_too_similar(i: int) -> bool:
        return i != correct_idx and not is_too_similar(terms[i], correct_term)

    # Prefer distractors from the same rough category (e.g. other GENSER
    # lines, other classification markings) so the wrong answers are
    # actually plausible instead of trivially different in kind.
    same_category = [i for i in range(len(terms)) if not_too_similar(i) and categorize(terms[i]) == correct_category]
    candidates = same_category if len(same_category) >= count else [i for i in range(len(terms)) if not_too_similar(i)]
    if len(candidates) < count:
        # Fall back to any other term if the set is too small/too similar overall.
        candidates = [i for i in range(len(terms)) if i != correct_idx]

    # Rank by (how often already used as a distractor, how close in length),
    # then take a slightly wider pool and shuffle so runs aren't deterministic.
    candidates.sort(key=lambda i: (usage_counter[i], abs(len(terms[i]) - correct_len)))
    pool = candidates[: max(count * 3, count)]
    rng.shuffle(pool)
    chosen = pool[:count]
    for i in chosen:
        usage_counter[i] += 1
    return chosen


def build_questions(pairs: List[Tuple[str, str]], seed: int = 0) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    terms = [t for t, _ in pairs]
    usage_counter = [0] * len(terms)

    questions = []
    for idx, (term, definition) in enumerate(pairs):
        distractor_idxs = pick_distractors(terms, idx, usage_counter, rng)
        options = [term] + [terms[i] for i in distractor_idxs]
        rng.shuffle(options)
        questions.append({
            "id": idx + 1,
            "question": definition,
            "options": options,
            "correct_answer": term,
        })
    return questions


# ---------------------------------------------------------------------------
# "What does the acronym stand for?" questions
# ---------------------------------------------------------------------------
#
# Plenty of terms in acronym-heavy decks are written as "(ACRONYM) Full
# Expansion" (or, occasionally, "Full Expansion (ACRONYM)"). The regular
# questions above only ever test the *operational* definition, never whether
# the student actually knows what the letters stand for. When a term has a
# real expansion baked into it, we pull out (acronym, expansion) pairs and
# generate a dedicated "What does X stand for?" question for each one, using
# other real expansions from the same deck as distractors.

ACRONYM_LEADING_RE = re.compile(r"^\(([A-Za-z0-9./&-]{2,})\)\s*(.+)$")
ACRONYM_TRAILING_RE = re.compile(r"^(.+?)\s*\(([A-Za-z0-9./&-]{2,})\)$")

STOPWORDS = {
    "of", "the", "and", "for", "to", "a", "an", "in", "on", "or", "with",
    "at", "by", "from",
}


def extract_acronym_pairs(pairs: List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    """Return [(acronym, expansion), ...] for every term that spells out its
    own acronym, e.g. '(DISA) Defense Information Systems Agency' -> ('DISA',
    'Defense Information Systems Agency'), or 'Two Person Integrity (TPI)' ->
    ('TPI', 'Two Person Integrity')."""
    seen_acronyms = set()
    results = []
    for term, _definition in pairs:
        acronym = expansion = ""
        m = ACRONYM_LEADING_RE.match(term)
        if m:
            acronym, expansion = m.group(1), m.group(2)
        else:
            m = ACRONYM_TRAILING_RE.match(term)
            if m:
                expansion, acronym = m.group(1), m.group(2)
        if not acronym or not expansion:
            continue
        # Skip acronyms that are really just numbers/initials with no letters,
        # and skip duplicates if the same acronym appears more than once.
        if not re.search(r"[A-Za-z]", acronym) or acronym.upper() in seen_acronyms:
            continue
        seen_acronyms.add(acronym.upper())
        results.append((acronym.upper(), clean_whitespace(expansion)))
    return results


def significant_words(text: str) -> set:
    return {w for w in re.findall(r"[a-z]+", text.lower()) if w not in STOPWORDS}


# A word-swap table for building "near-miss" wrong answers: plausible but
# incorrect rewordings of the *correct* expansion itself (e.g. "Joint Fleet
# Telecommunications Operations Center" -> "Joint Fleet Television Operations
# Control"), rather than a totally different acronym's meaning. This is what
# actually forces someone to know the exact wording instead of just picking
# "the org-sounding phrase that isn't one of the other options".
WORD_SWAPS = {
    "defense": ["defensive", "offense", "security"],
    "information": ["intelligence", "operations", "communications"],
    "systems": ["services", "system", "operations"],
    "system": ["systems", "service", "network"],
    "agency": ["agent", "authority", "command"],
    "communications": ["television", "telecommunications", "transmission", "communication"],
    "communication": ["communications", "transmission"],
    "telecommunications": ["television", "transmission", "communications"],
    "naval": ["navy", "national", "natural"],
    "navy": ["naval", "national"],
    "forces": ["force", "fleet", "command"],
    "force": ["forces", "fleet"],
    "network": ["networks", "system", "command"],
    "warfare": ["welfare", "warning", "warfighting"],
    "command": ["control", "center", "commander"],
    "cyber": ["cyberspace", "computer", "tech"],
    "operations": ["operation", "operational", "operators"],
    "operation": ["operations", "operational"],
    "security": ["safety", "secure", "surveillance"],
    "material": ["materiel", "materials", "management"],
    "area": ["areas", "region", "zone"],
    "master": ["mastery", "main", "primary"],
    "joint": ["combined", "joined", "unified"],
    "fleet": ["force", "field", "flight"],
    "center": ["control", "centre", "command"],
    "computer": ["computing", "communications", "control"],
    "stations": ["station", "systems", "centers"],
    "station": ["stations", "status", "situation"],
    "commanding": ["command", "commander", "commissioned"],
    "officer": ["office", "official", "operator"],
    "radio": ["radar", "remote", "relay"],
    "watch": ["watcher", "guard", "duty"],
    "tech": ["technical", "technology", "control"],
    "control": ["command", "controller", "controls"],
    "supervisor": ["supervision", "superintendent", "manager"],
    "log": ["logs", "ledger", "record"],
    "general": ["generic", "genser", "generalized"],
    "services": ["service", "systems", "supplies"],
    "special": ["specialized", "specialty", "specific"],
    "data": ["date", "database", "details"],
    "formerly": ["formally", "former", "previously"],
    "restricted": ["restrict", "restrictive", "reserved"],
    "official": ["officer", "office", "formal"],
    "use": ["used", "user", "usage"],
    "only": ["one", "solely", "alone"],
    "encrypted": ["encoded", "enciphered", "secured"],
    "transmission": ["transmit", "telecommunications", "broadcast"],
    "category": ["categories", "classification", "catalog"],
    "guard": ["guarded", "guardian", "watch"],
    "shift": ["shifted", "change", "turnover"],
    "message": ["messages", "messaging", "traffic"],
    "modular": ["module", "modulated", "mobile"],
    "automated": ["automatic", "automation", "auto"],
    "plain": ["plan", "plane", "planned"],
    "language": ["languages", "linguistic", "lingual"],
    "address": ["addresses", "addressee", "location"],
    "indicator": ["indicators", "indication", "index"],
    "group": ["groups", "grouping", "unit"],
    "collective": ["collection", "collected", "corporate"],
    "designator": ["designation", "designated", "designer"],
    "two": ["three", "dual", "double"],
    "person": ["personnel", "persons", "people"],
    "integrity": ["integration", "identity", "interest"],
}


def match_case(replacement: str, original: str) -> str:
    if original.isupper():
        return replacement.upper()
    if original[:1].isupper():
        return replacement.capitalize()
    return replacement.lower()


def has_new_duplicate_word(original: str, variant: str) -> bool:
    """True if `variant` repeats a word that wasn't already repeated in
    `original` — catches awkward collisions like a swap turning 'Tech
    Control Supervisor' into 'Control Control Manager'."""
    def word_counts(text: str) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for w in re.findall(r"[a-z']+", text.lower()):
            counts[w] = counts.get(w, 0) + 1
        return counts

    original_counts = word_counts(original)
    variant_counts = word_counts(variant)
    return any(count > original_counts.get(word, 0) and count > 1 for word, count in variant_counts.items())


def make_near_miss(expansion: str, rng: random.Random, num_swaps: int) -> str:
    """Return a variant of `expansion` with `num_swaps` words swapped out for
    a plausible-but-wrong alternative, or "" if no swappable words exist or
    every attempt produced an awkward duplicate-word collision."""
    tokens = list(re.finditer(r"[A-Za-z']+", expansion))
    swappable = [t for t in tokens if t.group().lower() in WORD_SWAPS]
    if not swappable:
        return ""

    for _ in range(6):
        rng.shuffle(swappable)
        chosen = sorted(swappable[:num_swaps], key=lambda t: t.start())

        pieces = []
        last_end = 0
        for t in chosen:
            word = t.group()
            replacement = match_case(rng.choice(WORD_SWAPS[word.lower()]), word)
            pieces.append(expansion[last_end:t.start()])
            pieces.append(replacement)
            last_end = t.end()
        pieces.append(expansion[last_end:])
        variant = "".join(pieces)

        if not has_new_duplicate_word(expansion, variant):
            return variant

    return ""


def build_near_miss_distractors(
    expansion: str,
    all_real_expansions: set,
    rng: random.Random,
    count: int = NUM_OPTIONS - 1,
    max_attempts: int = 40,
) -> List[str]:
    variants = []
    seen = {expansion.lower()}
    attempts = 0
    while len(variants) < count and attempts < max_attempts:
        attempts += 1
        num_swaps = rng.choice([1, 1, 2])
        variant = make_near_miss(expansion, rng, num_swaps)
        if not variant or variant.lower() in seen or variant.lower() in all_real_expansions:
            continue
        seen.add(variant.lower())
        variants.append(variant)
    return variants


def fallback_expansion_distractors(
    expansions: List[str],
    correct_idx: int,
    exclude: set,
    rng: random.Random,
    count: int,
) -> List[str]:
    """Used only if word-swapping can't produce enough near-miss variants
    (e.g. a very short expansion with no swappable words) — pads out the
    remaining slots with other real expansions from the deck, preferring
    ones that share words with the correct answer."""
    correct_expansion = expansions[correct_idx]
    correct_words = significant_words(correct_expansion)
    candidates = [
        e for i, e in enumerate(expansions)
        if i != correct_idx and e.lower() not in exclude
    ]
    candidates.sort(key=lambda e: -len(correct_words & significant_words(e)))
    rng.shuffle(candidates[:count * 2])
    return candidates[:count]


def build_acronym_questions(pairs: List[Tuple[str, str]], seed: int, start_id: int) -> List[Dict[str, Any]]:
    acronym_pairs = extract_acronym_pairs(pairs)
    if len(acronym_pairs) < NUM_OPTIONS:
        return []

    rng = random.Random(seed + 1)  # different stream than the definition questions
    expansions = [expansion for _acronym, expansion in acronym_pairs]
    all_real_expansions = {e.lower() for e in expansions}

    questions = []
    for idx, (acronym, expansion) in enumerate(acronym_pairs):
        distractors = build_near_miss_distractors(expansion, all_real_expansions, rng)
        if len(distractors) < NUM_OPTIONS - 1:
            exclude = {expansion.lower()} | {d.lower() for d in distractors}
            distractors += fallback_expansion_distractors(
                expansions, idx, exclude, rng, (NUM_OPTIONS - 1) - len(distractors)
            )

        options = [expansion] + distractors
        rng.shuffle(options)
        questions.append({
            "id": start_id + idx,
            "question": f"What does the acronym {acronym} stand for?",
            "options": options,
            "correct_answer": expansion,
        })
    return questions


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"exams": []}
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"exams": []}


def save_manifest(manifest: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)


def build_exam(
    input_path: Path,
    title: str,
    display_name: str,
    delimiter: str,
    seed: int,
    include_acronym_questions: bool = True,
) -> dict:
    pairs = load_pairs(input_path, delimiter)
    if len(pairs) < NUM_OPTIONS:
        raise RuntimeError(
            f"Only found {len(pairs)} term/definition pairs; need at least {NUM_OPTIONS} to build options."
        )

    questions = build_questions(pairs, seed=seed)

    if include_acronym_questions:
        acronym_questions = build_acronym_questions(pairs, seed=seed, start_id=len(questions) + 1)
        if acronym_questions:
            print(f"  Also generated {len(acronym_questions)} \"what does it stand for\" acronym questions")
            questions.extend(acronym_questions)

    filename = f"{slugify(title)}.json"
    out_path = DATA_DIR / filename
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"title": title, "url": "", "questions": questions}, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(questions)} questions to {out_path}")

    exam = {
        "title": title,
        "url": "",
        "filename": filename,
        "count": len(questions),
    }
    if display_name:
        exam["display_name"] = display_name
    return exam


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_file", help="Path to a Quizlet JSON export or exported text file")
    parser.add_argument("title", help="Exam title, e.g. \"Naval Messaging\"")
    parser.add_argument("display_name", nargs="?", default="", help="Optional short display name")
    parser.add_argument("--delimiter", default="\t", help="Term/definition delimiter for text input (default: tab)")
    parser.add_argument("--seed", type=int, default=0, help="Random seed for distractor selection (default: 0)")
    parser.add_argument(
        "--skip-manifest",
        action="store_true",
        help="Only write the data/<slug>.json question file; don't register it in data/exams.json yet "
             "(use this while you're still reviewing the generated question pool).",
    )
    parser.add_argument(
        "--no-acronym-questions",
        action="store_true",
        help="Don't generate extra \"what does the acronym stand for\" questions for terms written as "
             "'(ACRONYM) Full Expansion'.",
    )
    args = parser.parse_args()

    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: input file not found: {input_path}")
        return 1

    print(f"Reading {input_path} ...")
    exam = build_exam(
        input_path, args.title, args.display_name, args.delimiter, args.seed,
        include_acronym_questions=not args.no_acronym_questions,
    )

    if args.skip_manifest:
        print("\n--skip-manifest set: data/exams.json was NOT updated.")
        print(f"Review {DATA_DIR / exam['filename']}, then re-run without --skip-manifest to make it live.")
        return 0

    manifest = load_manifest()
    existing_by_filename = {e.get("filename"): idx for idx, e in enumerate(manifest.get("exams", []))}
    if exam["filename"] in existing_by_filename:
        idx = existing_by_filename[exam["filename"]]
        manifest["exams"][idx] = exam
        print(f"  Updated existing exam entry: {exam['filename']}")
    else:
        manifest["exams"].append(exam)
        print(f"  Added new exam entry: {exam['filename']}")

    save_manifest(manifest)
    print(f"\nManifest saved. Total exams: {len(manifest['exams'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
