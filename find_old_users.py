#!/usr/bin/env python3
"""Search the PythonAnywhere home directory for any trace of an old users.json.

Run in a Bash console:

    python3 find_old_users.py

It looks for:
- files named users.json (anywhere under ~)
- editor backup/swap files like users.json~, users.json.bak, .users.json.swp, etc.
- any file containing known username strings you provide

If it finds a candidate, compare it to the current users.json and decide whether
to restore/merge it.
"""

import json
import os
from pathlib import Path

HOME = Path.home()
CURRENT = Path(__file__).resolve().parent / "users.json"


def looks_like_users(data):
    """Heuristic: users.json is a dict of dicts with password_hash."""
    if not isinstance(data, dict):
        return False
    for v in data.values():
        if isinstance(v, dict) and "password_hash" in v:
            return True
    return False


def main():
    print(f"Current users.json: {CURRENT}")
    if CURRENT.exists():
        current = json.load(open(CURRENT))
        print(f"  Contains {len(current)} user(s): {', '.join(current.keys()) or '(none)'}")
    else:
        print("  Not found!")

    known = input("\nEnter a username you know should be in the old file (or press Enter to skip): ").strip().lower()

    print("\nSearching home directory for users.json-like files...")
    found = []
    for path in HOME.rglob("*"):
        name = path.name.lower()
        if path.is_file() and (
            name == "users.json"
            or "users" in name and name.endswith((".json", ".bak", "~", ".swp", ".tmp"))
        ):
            try:
                data = json.load(open(path, "r", encoding="utf-8"))
                if looks_like_users(data):
                    found.append((path, len(data), data))
            except Exception:
                pass

    if known:
        print(f"\nSearching for any file containing username '{known}'...")
        for path in HOME.rglob("*.json"):
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
                if known in text.lower():
                    try:
                        data = json.loads(text)
                        if looks_like_users(data):
                            found.append((path, len(data), data))
                    except Exception:
                        pass
            except Exception:
                pass

    # Deduplicate by path
    seen = set()
    unique = []
    for item in found:
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)

    if not unique:
        print("\nNo candidate users.json files found.")
        print("The old file may have been overwritten with no backup available.")
        return 1

    print("\nCandidates found:")
    for path, count, data in unique:
        print(f"  {path} — {count} user(s): {', '.join(data.keys())}")

    print("\nTo restore a candidate, download it from PythonAnywhere, or run a merge script.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
