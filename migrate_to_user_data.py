#!/usr/bin/env python3
"""Split users.json into users.json (auth/profile) and user_data.json (exams/progress).

Run on PythonAnywhere in the app directory:

    python3 migrate_to_user_data.py

It will:
    - Back up users.json and user_data.json (if present)
    - Move mastery/test_history/exams/flashcard_session out of users.json
    - Write the new, smaller users.json and the new user_data.json

It is safe to run more than once: it will not double-migrate data.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
USERS_FILE = BASE_DIR / "users.json"
USER_DATA_FILE = BASE_DIR / "user_data.json"

AUTH_KEYS = {"password_hash", "activity", "profile"}
DATA_KEYS = {"mastery", "test_history", "exams", "flashcard_session"}


def backup_file(path: Path) -> None:
    if not path.exists():
        return
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = path.with_suffix(f".json.bak.{timestamp}")
    backup.write_bytes(path.read_bytes())
    print(f"Backed up {path.name} -> {backup.name}")


def main():
    if not USERS_FILE.exists():
        print(f"No {USERS_FILE.name} to migrate.")
        return 0

    try:
        users = json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"Cannot read {USERS_FILE.name}: {e}")
        return 1

    if not isinstance(users, dict):
        print(f"{USERS_FILE.name} is not a dict.")
        return 1

    backup_file(USERS_FILE)
    backup_file(USER_DATA_FILE)

    user_data = {}
    if USER_DATA_FILE.exists():
        try:
            user_data = json.loads(USER_DATA_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass

    cleaned_users = {}
    data_count = 0
    for username, record in users.items():
        if not isinstance(record, dict):
            continue
        auth_record = {k: v for k, v in record.items() if k in AUTH_KEYS}
        cleaned_users[username] = auth_record

        data_record = {k: v for k, v in record.items() if k in DATA_KEYS}
        # Merge with any existing user_data
        existing = user_data.get(username, {})
        # If existing user_data already has these keys, prefer the newer data from users.json
        for key in DATA_KEYS:
            if key in data_record:
                existing[key] = data_record[key]
        if existing:
            user_data[username] = existing
            data_count += 1

    USERS_FILE.write_text(json.dumps(cleaned_users, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    USER_DATA_FILE.write_text(json.dumps(user_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Migrated {len(cleaned_users)} users.")
    print(f"Moved exam/progress data for {data_count} users into {USER_DATA_FILE.name}.")
    print(f"{USERS_FILE.name} now contains only auth/profile data.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
