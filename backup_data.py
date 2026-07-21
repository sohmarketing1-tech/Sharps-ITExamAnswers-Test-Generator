#!/usr/bin/env python3
"""Backup runtime JSON data files to a timestamped directory.

Run on the server (e.g. in a PythonAnywhere Bash console or as a cron job):

    python3 backup_data.py

Backs up users.json, chat.json, questions.json, stats.json, and the data/
directory. Useful because these files are gitignored and are not preserved
by a fresh git clone or container rebuild.
"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKUP_DIR = BASE_DIR / "backups"

FILES_TO_BACKUP = [
    BASE_DIR / "users.json",
    BASE_DIR / "chat.json",
    BASE_DIR / "questions.json",
    BASE_DIR / "stats.json",
    BASE_DIR / ".flask_secret",
]

DIRS_TO_BACKUP = [
    BASE_DIR / "data",
]


def main():
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = BACKUP_DIR / timestamp
    dest.mkdir(parents=True, exist_ok=True)

    for src in FILES_TO_BACKUP:
        if src.exists():
            shutil.copy2(src, dest / src.name)
            print(f"Backed up {src.name}")
        else:
            print(f"Skipped {src.name} (not found)")

    for src in DIRS_TO_BACKUP:
        if src.exists():
            shutil.copytree(src, dest / src.name, dirs_exist_ok=True)
            print(f"Backed up {src.name}/")
        else:
            print(f"Skipped {src.name}/ (not found)")

    # Keep only the 20 most recent backups
    backups = sorted(BACKUP_DIR.iterdir(), key=os.path.getmtime, reverse=True)
    for old in backups[20:]:
        shutil.rmtree(old, ignore_errors=True)

    print(f"Backup complete: {dest}")


if __name__ == "__main__":
    main()
