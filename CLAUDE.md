# answrit.net: project notes for Claude

**Read [MIGRATION.md](MIGRATION.md) at the start of every session**, plus [EXAM-REBUILD.md](EXAM-REBUILD.md) when working on exam content (the plan and format for rebuilding exams from ITExamAnswers, including matching questions read from answer pictures). It holds the hosting move checklist, server details, deadlines and a dated log.

**Keep it updated.** Whenever something changes, edit MIGRATION.md in the same session:
- a step is finished,
- a server, domain or account setting changes,
- the site is deployed or edited.

Add a dated line to its Log section each time. The owner relies on this file to pick up where they left off.

## About the site
- answrit.net is a Flask app (`app.py`). Static files in `static/` are served from the site root (e.g. `/beta/app.js`). The exam data is in `data/`; see EXAM-REBUILD.md for how exams are rebuilt.
- User accounts, progress and chat live in `users.json`, `user_data.json` and `chat.json` on the server. They are gitignored and must never be committed or overwritten with older copies.
- **The main site is the redesign** in `static/beta/` (index.html, app.js, app.css; it was named "beta" while it was a preview).
  - `app.py`'s `render_index_html` serves it for `/`, `/study`, `/flashcards`, `/history` and `/exams/<slug>/`.
  - The **classic** design (`static/index.html` + `static/app.js` + `static/style.css`) is retired (since Nov 8, 2026): games are in `static/beta/drills.js`, and Packet Tracer, My Flashcards and Account are in `static/beta/app.js`. See MIGRATION.md.
- Hosting is moving from PythonAnywhere to a Google Cloud e2-micro server. See MIGRATION.md for the details.

## Working with the owner
- They're not a developer. Explain things in plain language, one small step at a time, and keep instructions short. Long lists overwhelm them.
- Never ask for passwords or card details.
