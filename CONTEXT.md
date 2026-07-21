# AI Handoff Context

## Project

- **Location:** `/Users/jonathansharp/CascadeProjects/quiz-scraper`
- **Repo:** `https://github.com/sohmarketing1-tech/Sharps-ITExamAnswers-Test-Generator`
- **Branch:** `main`
- **Latest commit (already pushed to origin):** `d9312d6` — *Live chat avatar updates*
- **Stack:** Flask backend (`app.py`) + vanilla JS frontend (`static/`). Data stored locally in JSON files (`chat.json`, `users.json`, `data/`, `questions.json`, etc.).

## Current IDE State

- **Active file:** `/Users/jonathansharp/CascadeProjects/quiz-scraper/quiz_bot.py`
- **Cursor:** line 435, inside `get_options`
- **Other open file:** `/Users/jonathansharp/CascadeProjects/quiz-scraper/scraper.py`

## What We Just Finished

The last completed work was a **mobile-responsiveness pass** and hiding the avatar customizer behind a toggle.

### Key changes included

- `static/app.js`
  - Avatar builder is now **Micah-only**, with visual image pickers and color swatches.
  - Added `/api/chat/avatars` polling (`loadChatAvatars`) every 1.5 s while on the chat tab.
  - Added `updateChatAvatars()` to refresh existing chat avatar `<img>` sources in place without full re-render.
  - `renderChat()` now stores `state.chatMessages`/`state.chatMessagesKey` and skips a full rebuild unless the actual message list changes.
  - `saveProfile()` triggers an immediate own-avatar refresh in the chat.
  - Default avatar style in chat rendering changed from `"bottts"` to `"micah"`.
  - **NEW:** Moved the Micah builder into a dedicated `#avatar-modal`. Tapping `Customize Avatar` in the profile modal opens the avatar editor with a live preview that stays visible while scrolling options. The profile modal itself no longer shows the builder.
  - **NEW:** Added Save and Cancel buttons inside the avatar modal. Save closes the avatar modal and keeps the new avatar; Cancel restores the previous avatar from a snapshot and returns to the profile modal. Escape also cancels.
  - **NEW:** `openAvatarModal()` / `closeAvatarModal()` / `saveAvatarModal()` / `cancelAvatarModal()` and `avatarModal*` DOM refs.
- `static/index.html`
  - Replaced the inline avatar builder in the profile modal with a `Customize Avatar` button.
  - Added `#avatar-modal` markup: header with close button, sticky live preview, and scrollable options panel.
  - Cache-busting versions bumped to `?v=17` for `style.css` and `app.js`.
- `static/style.css`
  - Added/updated Micah avatar builder and color-swatch styles.
  - **NEW:** Made modals scrollable on small screens (`overflow-y: auto`, `align-items: flex-start`, modal `margin: auto`).
  - **NEW:** Added comprehensive mobile polish for the home page, profile modal, practice setup, quiz, results, flashcards, history, and community chat (nested `@media (max-width: 600px)` and `@media (max-width: 480px)` blocks).
- `quiz_bot.py`
  - New file (committed). A Selenium/Playwright-based bot for scraping exam questions.
  - Active function `get_options` starts around line 435.

### Local server

- A Flask dev server is running on **`http://127.0.0.1:8080`**.
- The site is serving and responding (`200 OK` on `/`).

## What Is Currently Pending / Open

1. **Test the new mobile/responsive changes and the avatar toggle on actual devices / mobile emulation.**
2. **Commit and push** the latest changes to the GitHub repo (`origin/main`).
3. **Deploy** the latest version to the live host when the user is ready. The repo is configured for **Firebase Hosting + Google Cloud Run**, but the user has been using **PythonAnywhere** for `answrit.net`.

### Deployment notes

- This environment does **not** have `firebase`, `gcloud`, `docker`, or deployment tokens installed, so deployment must be done by the user (or by providing the necessary credentials).
- Git remote uses HTTPS (`https://github.com/sohmarketing1-tech/...`) with macOS keychain credential helper; pushes to GitHub work from this machine.
- For PythonAnywhere: pull the latest `main` in a Bash console and reload the web app.

## Quick Reference: Important Files / Symbols

- `app.py` — Flask app with routes for exams, tests, scoring, chat, profile, history, flashcards, mastery, scraping.
- `static/app.js` — frontend state, routing, avatar builder (`MICAH_OPTIONS`, `MICAH_COLORS`, `renderMicahBuilder`), chat polling (`loadChat`, `loadChatAvatars`, `renderChat`, `updateChatAvatars`, `startChatPolling`, `stopChatPolling`), profile save (`saveProfile`), `getProfile`.
- `static/index.html` — UI markup, profile modal, chat tab.
- `static/style.css` — theme/Micah builder/chat styles.
- `quiz_bot.py` — active file; scraper bot with `get_options` around line 435.
- `scraper.py` — HTML scraper used by the app and `batch_scrape.py`.
- `data/exams.json` — manifest of pre-scraped exams.
- `chat.json` / `users.json` — runtime chat and user data.

## New user request (next task)

1. Hide the avatar customizer behind a button in the profile modal so it doesn't show all avatar builds immediately.
2. Fix mobile responsiveness across the entire site so every element looks good when viewing vertically on a phone — especially the profile customization menu, home page, modals, and all study screens.

## Notes

- `quiz_bot.py` was committed in `d9312d6` but may still be WIP.
- If you resume work on deployment, double-check that the running Flask server port matches the deployment/tunnel command you use.
