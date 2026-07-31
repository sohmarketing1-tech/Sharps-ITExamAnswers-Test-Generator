#!/usr/bin/env python3
from __future__ import annotations

"""Recover the best possible users.json from the live file, backup, and leftover .tmp files.

Run on PythonAnywhere in the app directory:

    python3 recover_users.py

Or point it at a folder of candidates:

    python3 recover_users.py --candidates-dir /path/to/candidates

It will produce:
    - recovered_users.json   (merged/ best version, do NOT rename until you verify)
    - recovery_report.txt    (summary of what was found and what was fixed)

It never overwrites users.json or users.json.bak.
"""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_timestamp(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def record_age_seconds(record: dict) -> float:
    """Return how recent a record looks based on last_seen. 1e18 = very old/no date."""
    ts = parse_timestamp(record.get("activity", {}).get("last_seen"))
    if ts:
        return -ts.timestamp()  # negative so more recent == smaller
    return 1e18


def is_valid_hash(value: Any) -> bool:
    if not value or not isinstance(value, str):
        return False
    return bool(re.match(r"^(pbkdf2|scrypt):", value.strip()))


def load_candidate(path: Path) -> tuple[dict | None, str]:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if not text.strip():
            return None, "empty file"
        data = json.loads(text)
        if not isinstance(data, dict):
            return None, f"top-level type is {type(data).__name__}, expected dict"
        return data, "ok"
    except json.JSONDecodeError as e:
        return None, f"invalid JSON: {e}"
    except OSError as e:
        return None, f"cannot read: {e}"


def find_candidates(directory: Path) -> list[Path]:
    candidates = []
    for name in ("users.json", "users.json.bak"):
        p = directory / name
        if p.is_file():
            candidates.append(p)
    # Hidden .tmp files
    for p in directory.glob(".users.json.*.tmp"):
        if p.is_file():
            candidates.append(p)
    # Also pick up any numbered copies the user may have collected
    for p in directory.glob("users*.json*"):
        if p.is_file() and p.name not in {"users.json", "users.json.bak"} and not p.name.startswith("recovered_") and p.suffix != ".lock" and p.suffix != ".tmp":
            if p not in candidates:
                candidates.append(p)
    return sorted(set(candidates), key=lambda p: p.stat().st_mtime, reverse=False)


def merge_users(candidates: list[Path]) -> tuple[dict, dict]:
    """Build a merged users dict and a report dict from all candidate files."""
    loaded: list[tuple[Path, datetime, dict]] = []
    per_file_report = {}

    for path in candidates:
        data, status = load_candidate(path)
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        per_file_report[path.name] = {
            "mtime_utc": mtime.isoformat(),
            "status": status,
            "users": 0,
            "with_hash": 0,
            "skeletons": 0,
        }
        if data is None:
            continue
        with_hash = 0
        skeletons = 0
        for username, record in data.items():
            if is_valid_hash(record.get("password_hash")):
                with_hash += 1
            else:
                skeletons += 1
        per_file_report[path.name]["users"] = len(data)
        per_file_report[path.name]["with_hash"] = with_hash
        per_file_report[path.name]["skeletons"] = skeletons
        loaded.append((path, mtime, data))

    merged: dict[str, dict] = {}
    source_by_user: dict[str, str] = {}
    fixes: list[dict] = []
    unrecoverable: list[str] = []

    # Gather all usernames
    all_usernames = set()
    for _, _, data in loaded:
        all_usernames.update(data.keys())

    for username in all_usernames:
        records = [(p, mtime, data[username]) for (p, mtime, data) in loaded if username in data]

        # Sort by last_seen (most recent first)
        records.sort(key=lambda item: record_age_seconds(item[2]))

        # Find best record that has a valid password hash
        hashed_records = [r for r in records if is_valid_hash(r[2].get("password_hash"))]

        # Choose the most recent overall record
        best_recent = records[0][2] if records else None

        # If the most recent record has a valid hash, use it as-is
        if best_recent and is_valid_hash(best_recent.get("password_hash")):
            merged[username] = best_recent
            source_by_user[username] = records[0][0].name
            continue

        # Most recent is a skeleton or missing hash; try to merge in a hash from another copy
        if best_recent and hashed_records:
            best_hashed = hashed_records[0][2]
            recovered = dict(best_recent)
            recovered["password_hash"] = best_hashed["password_hash"]
            merged[username] = recovered
            source_by_user[username] = f"{records[0][0].name} (activity) + {hashed_records[0][0].name} (hash)"
            fixes.append({
                "username": username,
                "issue": "skeleton/missing password_hash, merged hash from older candidate",
                "activity_source": records[0][0].name,
                "hash_source": hashed_records[0][0].name,
            })
            continue

        # No hash anywhere — keep the most recent record, but it's unrecoverable
        if best_recent:
            merged[username] = best_recent
            source_by_user[username] = records[0][0].name
            unrecoverable.append(username)

    return merged, {
        "per_file": per_file_report,
        "total_users": len(merged),
        "users_with_valid_hash": sum(1 for r in merged.values() if is_valid_hash(r.get("password_hash"))),
        "unrecoverable_no_hash": unrecoverable,
        "merged_fixes": fixes,
        "source_by_user": source_by_user,
    }


def main():
    parser = argparse.ArgumentParser(description="Recover users.json from backup and .tmp files")
    parser.add_argument("--candidates-dir", type=Path, default=Path("."), help="Directory containing users.json candidates")
    parser.add_argument("--output", type=Path, default=Path("recovered_users.json"), help="Output file")
    parser.add_argument("--report", type=Path, default=Path("recovery_report.txt"), help="Report file")
    parser.add_argument("--drop-unrecoverable", action="store_true", help="Remove users that have no valid password_hash in any candidate")
    args = parser.parse_args()

    candidates = find_candidates(args.candidates_dir)
    if not candidates:
        print(f"No candidate files found in {args.candidates_dir.resolve()}")
        return 1

    print(f"Found {len(candidates)} candidate file(s):")
    for p in candidates:
        print(f"  {p.name}")

    merged, report = merge_users(candidates)

    if args.drop_unrecoverable and report["unrecoverable_no_hash"]:
        for username in report["unrecoverable_no_hash"]:
            del merged[username]
        report["dropped_users"] = report["unrecoverable_no_hash"]
        report["total_users"] = len(merged)
        report["users_with_valid_hash"] = sum(
            1 for r in merged.values() if is_valid_hash(r.get("password_hash"))
        )
    else:
        report["dropped_users"] = []

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")

    report_text = [
        "Users.json recovery report",
        "==========================",
        "",
        f"Candidate directory: {args.candidates_dir.resolve()}",
        f"Candidates examined: {len(candidates)}",
        "",
    ]

    for name, info in report["per_file"].items():
        report_text.append(f"{name}")
        report_text.append(f"  mtime (UTC): {info['mtime_utc']}")
        report_text.append(f"  status: {info['status']}")
        if info["status"] == "ok":
            report_text.append(f"  users: {info['users']}")
            report_text.append(f"  with valid password_hash: {info['with_hash']}")
            report_text.append(f"  skeletons (no valid hash): {info['skeletons']}")
        report_text.append("")

    report_text.extend([
        f"Total users in recovered file: {report['total_users']}",
        f"Users with a valid password_hash: {report['users_with_valid_hash']}",
        f"Users still missing a valid hash (unrecoverable): {len(report['unrecoverable_no_hash'])}",
    ])

    if report["unrecoverable_no_hash"]:
        report_text.append("Unrecoverable usernames (use reset_password.py for these if needed):")
        for u in report["unrecoverable_no_hash"]:
            report_text.append(f"  - {u}")

    if report["dropped_users"]:
        report_text.append("")
        report_text.append("Dropped from recovered file because they had no valid password_hash:")
        for u in report["dropped_users"]:
            report_text.append(f"  - {u}")

    if report["merged_fixes"]:
        report_text.append("")
        report_text.append("Merged records (activity from one file, password_hash from another):")
        for fix in report["merged_fixes"]:
            report_text.append(f"  - {fix['username']}: {fix['issue']}")

    with open(args.report, "w", encoding="utf-8") as f:
        f.write("\n".join(report_text))
        f.write("\n")

    print(f"\nWrote recovered data to {args.output}")
    print(f"Wrote report to {args.report}")
    print(f"Recovered {report['users_with_valid_hash']} of {report['total_users']} users with a valid password_hash.")
    if report["unrecoverable_no_hash"]:
        print(f"{len(report['unrecoverable_no_hash'])} user(s) still have no password_hash and will need a reset.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
