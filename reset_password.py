#!/usr/bin/env python3
"""Reset a user's password in the local users.json file.

Run on the server (e.g. in a PythonAnywhere Bash console):

    python3 reset_password.py

This is useful if the users.json file is intact but a password needs to be
reset. It cannot recreate a lost users.json file.
"""

import json
import getpass
import os
from pathlib import Path
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
USERS_FILE = BASE_DIR / "users.json"


def main():
    if not USERS_FILE.exists():
        print(f"ERROR: {USERS_FILE} not found. No users to reset.")
        return 1

    with open(USERS_FILE, "r", encoding="utf-8") as f:
        users = json.load(f)

    username = input("Username to reset: ").strip().lower()
    if username not in users:
        print(f"ERROR: User '{username}' does not exist.")
        print("Existing users:", ", ".join(users.keys()) or "(none)")
        return 1

    password = getpass.getpass("New password: ")
    confirm = getpass.getpass("Confirm new password: ")
    if not password:
        print("ERROR: Password cannot be empty.")
        return 1
    if password != confirm:
        print("ERROR: Passwords do not match.")
        return 1

    users[username]["password_hash"] = generate_password_hash(password, method="pbkdf2:sha256")

    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)

    print(f"Password reset for '{username}'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
