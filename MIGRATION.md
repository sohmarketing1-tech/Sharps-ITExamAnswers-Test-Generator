# Moving answrit.net from PythonAnywhere to Google Cloud

## ⚠️ REMINDER: Activate your full Google Cloud account before **February 4, 2027**
- The Google Cloud free trial ends on **Feb 4, 2027**. Do this by **late January 2027** to be safe.
- How: open Google Cloud Console, click **Upgrade** (or **Activate full account**), and confirm.
- **Why:** if you don't, Google pauses the server and **the site goes down**.
- Activating does **not** start charges. The free e2-micro server stays $0. You only pay for usage above the free limits, and the $1 budget alert emails you first.

## ⚠️ REMINDER: Renew answrit.net at Spaceship before **July 18, 2027**

## Checklist
- [x] **1. Back up PythonAnywhere.** The backup is in `~/Desktop/answrit-backups/answrit-backup.tar.gz` (taken Nov 5, 2026).
  - It contains 172 accounts, user progress, chat, all pages and data, and 8 connector images that existed **only** on PythonAnywhere.
- [x] **2. Create a cloud account.** Oracle rejected the signup, so the site moves to Google Cloud instead (created Nov 5, 2026).
- [x] **3. Set up a $1 budget alert in Google Cloud.** Done Nov 5, 2026. "Promotional credits" is unticked, so the alert fires even while the trial credit is covering costs.
- [x] **4. Create the free server (e2-micro).** Done Nov 5, 2026. Details are in "Server details" below.
- [x] **5. Copy the site and the backup onto the server, then test it at its IP address.**
  - [x] Set up the server and loaded the Nov 5 PythonAnywhere backup. Done Nov 5, 2026.
  - [x] Checked that the pages, images and data match the live site.
  - [x] The owner tested http://34.61.51.101 and logins work. Done Nov 5, 2026.
- [x] **6. Final switch.** Done Nov 7, 2026. answrit.net is now served from Google Cloud.
  - [x] Loaded a fresh PythonAnywhere backup (data up to Nov 6, 21:20 PythonAnywhere time). The file is saved as `~/Desktop/answrit-backups/answrit-backup-2026-11-07.tar`.
  - [x] Changed the `www` record at Spaceship to A `34.61.51.101`.
  - [x] HTTPS is on: Caddy got a Let's Encrypt certificate and renews it automatically.
  - [ ] **Optional fix:** the `otm2czpwzg` CNAME (Google verification) *is* saved at Spaceship, but Spaceship's DNS doesn't serve it.
    - Its `*` wildcard URL Redirect answers instead: `otm2czpwzg` gets the same 15.197.162.184 as any made-up subdomain.
    - This almost certainly predates the switch, since only `www` was changed. The site itself isn't affected.
    - If Google Search Console says verification is lost, remove the `*` row from Spaceship's **URL Redirect** tab. Keep `@`.
- [ ] **7. Check that the live site works on the new server for a few days.**
- [ ] **8. Cancel PythonAnywhere.** Only after step 7, and keep the backup files.
- [ ] **9. Activate the full Google Cloud account before Feb 4, 2027** (see the reminder above).

## Server details (Google Cloud)
| | |
|---|---|
| Server (VM) name | `answrit` |
| Zone | `us-central1-c` (Iowa, a free-tier region) |
| Machine | `e2-micro` (free tier) |
| Disk | 30 GB Standard persistent disk (free tier) |
| Operating system | Ubuntu 24.04 LTS (x86/64) |
| External IP | `34.61.51.101`, reserved as the static address `answrit-ip` (it won't change). ⚠️ Never release or delete it while the domain points here. A reserved IP that's *not* attached to a running server costs money. |
| Firewall | HTTP and HTTPS allowed |
| Backups | None from Google (they cost money). Keep our own backups. |
| Budget alert | `answrit alert`, $1/month, sent by email |
| PythonAnywhere (old host) | Account `jjsharp19`, folder `~/Sharps-ITExamAnswers-Test-Generator`, startup file `/var/www/www_answrit_net_wsgi.py` |

Google Cloud's price estimate shows about $7/month for this server. That's normal: the estimate doesn't subtract the free tier.

## How the new server is set up
- **App folder:** `/srv/answrit/app`. This is the site code plus the user data files (`users.json`, `user_data.json`, `chat.json`).
- **Python packages:** `/srv/answrit/venv`, the same versions as PythonAnywhere (from `pip-freeze.txt`), plus `gunicorn`.
- **The app runs as a background service called `answrit`.** It starts on boot and restarts itself if it crashes. Gunicorn runs it with 1 process and 4 threads on 127.0.0.1:8000, under the `answrit` system user.
- **Caddy** is the web server. It serves `https://www.answrit.net`, redirects http to https, and renews the HTTPS certificate on its own. It also serves `http://34.61.51.101` for testing. Its settings are in `/etc/caddy/Caddyfile`.
- **answrit.net (without www)** is still sent to www by Spaceship's URL Redirect. The server doesn't handle it.
- **Before a restore,** `deploy/restore-backup.sh` saves the server's current data to `/srv/answrit/pre-restore-<time>/`.
- **A 1 GB swap file** is extra memory that keeps the small server from running out.
- **The setup script** is [deploy/server-setup.sh](deploy/server-setup.sh) in this repo.

### For Claude: managing the server from this Mac
- The Google Cloud CLI is in `~/google-cloud-sdk`. It isn't on PATH, and it needs Python 3.14 set like this:
  - `export CLOUDSDK_PYTHON=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
  - `G=~/google-cloud-sdk/bin/gcloud`
- It's signed in as the owner's Google account. The project is `project-4346dd28-75f1-49bb-8e9` and the default zone is `us-central1-c`.
- Run a command on the server: `$G compute ssh answrit --zone us-central1-c --quiet --command "..."`
- Copy files up: `$G compute scp <file> answrit:/tmp/ --zone us-central1-c --quiet`
- Restart the app: `sudo systemctl restart answrit`. Read its logs: `sudo journalctl -u answrit -n 50`
- `/srv/answrit` is only readable with `sudo`. Wrap server-side file work in `sudo bash -c "..."`.
- **Deploying a page change:**
  1. Upload the changed files to `/tmp`.
  2. Copy the current versions to `/srv/answrit/prev-static-<time>/`.
  3. `install -o answrit -g answrit -m 664` the new files into `/srv/answrit/app/static/`.
  4. Bump `app.js?v=` / `style.css?v=` in index.html so phones fetch the new file.
  - index.html is read on every request, so static changes don't need a restart. Python (`app.py`) changes do.
- **The live site is not the same as this folder.**
  - The server runs commit `3b757fa` plus the site changes listed below, including the `app.py` option_images change and the rebuilt `data/` files. None of this is committed to git yet.
  - This folder also has unpublished experiments: a flashcard redesign, a Comms Test 2 "mixed feedback" notice, and 80 flashcards. Don't deploy whole files from here without deciding about those first.

## Site changes since the move
| Date | Change | Files | Version |
|---|---|---|---|
| 2026-11-07 | Replaced the Comms tab disclaimer with: "we didn't have enough help building this section… study with your classmates… the final test is the easiest one you'll take in this class." | `static/app.js`, `static/index.html` | app.js v=103 |
| 2026-11-07 | **Retired Comms Test 1 and Comms Test 2.** Details below the table. | `data/exams.json`, `static/app.js`, `static/index.html`, `static/style.css`, `static/comms-test-1.html`, `static/mrts-test-2.html` | app.js v=104, style.css v=137 |
| 2026-11-07 | Removed the "Congrats to Class 530…" message from the top of every page. The `.class-congrats` CSS rule is now unused. | `static/index.html` | (index.html only) |
| 2026-11-07 | **Rebuilt exams went live:** all 10 exams were replaced with versions rebuilt from ITExamAnswers. The rebuild added 36 missing questions, fixed the boot-sequence answer, and removed answers given away by "*". `app.py` now passes `option_images`. The backup is in `/srv/answrit/prev-20261107-165153-exams/`. Details are in EXAM-REBUILD.md. | `data/*.json`, `app.py`, `static/beta/*` | beta app.js v=6, app.css v=3 |
| 2026-11-08 | **Profiles from chat.** Tapping any picture or name in rooms, DMs or a group's member list opens a profile sheet: picture, name (Admin badge for AnswrIT), "Active today / N days ago", 🔥 day streak, number of practice tests, and a **Message** button that opens a DM. Your own profile links to Account. Scores are deliberately not shown. Login is required to view profiles. API: `GET /api/people/<username>`. Backup: `/srv/answrit/prev-20261108-191426-profiles/`. | `app.py`, `static/beta/app.js`, `app.css` | app.js v=21, app.css v=13, restart |
| 2026-11-08 | **Retake same test.** The practice test results screen (and past tests in Progress, while their details are kept) has a **Retake same test** button: the same questions in the same order, answer choices still reshuffled. "Try again" is now **New questions** (a fresh random set). API: `/api/test?filename=…&ids=1,2,3`. Backup: `/srv/answrit/prev-20261109-014549-retake/`. | `app.py`, `static/beta/app.js`, `app.css` | app.js v=22, app.css v=14, restart |
| 2026-11-08 | **Retake shuffles question order.** At the owner's request, Retake same test now mixes the same questions into a new order each time. Backup: `/srv/answrit/prev-20261109-015147-retake-shuffle/`. | `static/beta/app.js` | app.js v=23, no restart |
| 2026-11-08 | **Fix: page jumped up when tapping a choice** (owner's bug1.MP4, mostly picture questions on iPhone). Redrawing a question reloaded its pictures; for a moment they had no height, so the page shrank and scrolled up. Now the loaded pictures are kept and the scroll position restored when the same question redraws. Backup: `/srv/answrit/prev-20261109-022442-scrollfix/`. | `static/beta/app.js` | app.js v=24, no restart |
| 2026-11-08 | **Matching questions shuffle both sides.** In practice tests and Mastery, the items on the left and the answer boxes on the right come in a new order every time, never the same as last time on that device (same `answrit:choiceOrder` memory, keys `…|L` and `…|R`). Backup: `/srv/answrit/prev-20261109-025027-matchshuffle/`. | `static/beta/app.js` | app.js v=25, no restart |
| 2026-11-08 | **Memory hints: PREVIEW ONLY (CCNA 2 Modules 1–4).** Hand-written hint per question: clue in the question → key word(s) from the right answer (★ = in no other answer choice in the exam) + a one-line tip. Show memory hint button before answering; hint always shown after checking, key words highlighted in the right answer. Only shows on a device that opened `https://www.answrit.net/?hintpreview=1` (`?hintpreview=0` turns it off). Hints file: `static/beta/hints/<exam>.json`, built by `tools/build_hints_ccna2_m1-4.py`. Not decided yet whether to roll out to everyone. Backup: `/srv/answrit/prev-20261109-040834-hints-preview/`. | `static/beta/app.js`, `app.css`, `static/beta/hints/` | app.js v=26, app.css v=15, no restart |
| 2026-11-08 | **Memory hints live for everyone** (owner approved the preview). The `?hintpreview` switch is gone; hints load for exams listed in `HINT_EXAMS` in `static/beta/app.js` (only CCNA 2 Modules 1–4 so far). To add an exam: write its hints (see `tools/build_hints_ccna2_m1-4.py`), build `static/beta/hints/<exam>.json`, add the file name to `HINT_EXAMS`. Backup: `/srv/answrit/prev-20261109-041138-hints-live/`. | `static/beta/app.js` | app.js v=27, no restart |
| 2026-11-09 | **Packet Tracer labs: PREVIEW ONLY.** The PT-style labs (CCNA 1 final practice + the new CCNA 2 VLAN lab with versions) only show on a device that opened `https://www.answrit.net/?ptpreview=1` (`?ptpreview=0` turns it off). `ptlab.js`/`ptlab.css` are no longer in index.html; app.js loads them on demand for preview devices only. Everyone else sees the old Packet Tracer page (subnetting + CLI simulator). Backup: `/srv/answrit/prev-20261109-191100-ptlab-preview/`. | `static/beta/app.js`, `ptlab.js`, `ptlab.css` | app.js v=28, ptlab v=9, no restart |
| 2026-11-08 | **Direct messages and group chats.** Chat has a **Rooms / Messages** switch. Messages: New message (search by username), New group (name + up to **25** people incl. the creator), and a "Message AnswrIT" shortcut. Each message's ⋯ menu: react, reply, report, delete own. In groups, the creator can add/remove people and rename; anyone can leave; if the creator leaves, the next member owns it. Owner's choices: **private unless reported** (the admin can't open conversations; a report saves the message + 3 before/after, shown under Reported messages → Private messages, where the admin can delete it or keep it), and **anyone can DM, no blocking**. Stored in **`dms.json`** (private user data: never commit it, it's in .gitignore). Unread counts are included in the Chat tab badge (seen keys `dm:<id>`). API: `/api/users/search`, `/api/dm/list|start|group|messages|message|react|delete|members|leave|report|reports`. Backup: `/srv/answrit/prev-20261108-190751-dms/`. | `app.py`, `static/beta/app.js`, `app.css` | app.js v=20, app.css v=12, restart |
| 2026-11-08 | **New tab/app icon: "Q&A bubble"** (white speech bubble with a blue "IT" on a blue gradient; the owner picked it from 4 options). Files: `static/images/answrit-qa.svg`, `answrit-qa-32/192/512.png`, `apple-touch-icon-qa.png` (square, since iOS rounds it). `index.html` links and `manifest.json` updated (the live index was edited in place). The older `answrit-it*` files are unused. **Admin profile picture** set on the `answrit` account: "Official badge" (white IT with a gold check), written through `modify_users`. Backup: `/srv/answrit/prev-20261108-185204-icon-qa/` (incl. users.json). The source drawings are in `make_icons.py` (scratchpad). | `static/images/*-qa*`, `static/manifest.json` | |
| 2026-11-08 | **New chat with rooms.** Rooms: Announcements (only admins post), Lounge, IT Essentials, CCNA 1, CCNA 2, Comms (`CHAT_ROOMS` in app.py). The 20 old messages moved to the Lounge. Features: an **"Ask about this question"** button in practice/Mastery that posts the question card to its course room (and stays in the quiz); unread badges on the Chat tab and rooms (seen-times in localStorage `answrit:chatSeen:<user>`); replies; reactions 👍 ❤️ 😂 🙏; each message's ⋯ menu (react, reply, report, delete own, admin pin/delete); admin "Reported messages" page (`#/chat-reports`); flood control (1 msg / 2 s). **Admin account: `answrit`** (shows as "AnswrIT" with an Admin badge; the owner's personal account `sharp` is a normal user). `ADMIN_USERS`/`ADMIN_DISPLAY` are in app.py. Names like admin/moderator/answrit team are reserved (`RESERVED_USERNAMES`). Messages no longer copy profile pictures into chat.json. API: `/api/chat/rooms`, `/api/chat/messages?room=`, `/api/chat/message`, `/api/chat/react`, `/api/chat/delete`, `/api/chat/pin`, `/api/chat/report`, `/api/chat/reports`. Backup: `/srv/answrit/prev-20261108-184311-chat-rooms/`. | `app.py`, `static/beta/app.js`, `app.css` | app.js v=18, app.css v=10, restart |
| 2026-11-08 | **Answer choices shuffle** in practice tests and Mastery (`shuffleChoices` in app.js). Each time a question appears, its choices are in a new order, never the same as the last time on that device (localStorage `answrit:choiceOrder`). Scoring matches by text, so it's unaffected. Matching questions keep their own item shuffle. Only `app.js` uploaded (v=15). Backup: `/srv/answrit/prev-20261108-182719-shuffle/`. | `static/beta/app.js` | app.js v=15 |
| 2026-11-08 | **Automatic daily backups (disk snapshots).** Snapshot schedule `answrit-daily` (us-central1) is attached to the `answrit` disk: every day at 09:00 UTC, keeps 7 days, stored in us-central1. One snapshot is ~2.3 GB, and later ones only store changes, so it stays near the free 5 GB-month allowance (cents if over). A manual `answrit-test-snapshot` (Nov 8) was kept as that day's backup; it is NOT auto-deleted, so delete it after a week or two (`gcloud compute snapshots delete answrit-test-snapshot`). **To restore:** Console → Compute Engine → Snapshots → pick a date → "Create disk", then swap it in, or ask Claude. (A Cloud Storage data-only backup was tried first, but the project blocks service-account keys, so that approach was dropped and the bucket/account deleted.) | Google Cloud | none |
| 2026-11-08 | **Code saved to GitHub** on branch `site-update-2026-11` (repo `sohmarketing1-tech/Sharps-ITExamAnswers-Test-Generator`, which is **public**). Student data, recordings, the .pka and the Comms PDF are excluded via `.gitignore`. Not merged into `main` yet. | git | |
| 2026-11-08 | **Daily test-history cleanup (automatic, owner approved).** Built into `app.py` as a background thread (`_history_cleanup_loop`): 2 min after start, then hourly checks, and it runs once every ~24 h. Tests older than 30 days (`HISTORY_DETAIL_DAYS`) keep their date/exam/score/time but lose `quiz`/`answers`/`results` and get `"slimmed": true`. Mastery, flashcards and accounts are never touched. The Progress page shows "Question-by-question review is kept for 30 days…" for slimmed tests. Each run is recorded in `/srv/answrit/app/history_cleanup.log` and `history_cleanup.json` (also in the service log). First run Nov 8: slimmed 319 tests; user_data.json went 36 MB → 8.7 MB; all 166 users and 378 tests kept, nothing else changed. Full backup before it: `/srv/answrit/prev-20261108-181527-before-history-cleanup/user_data.json`. To change the 30 days, edit `HISTORY_DETAIL_DAYS` and restart. To turn it off, set `ANSWRIT_DISABLE_CLEANUP=1` in the service. | `app.py`, `static/beta/app.js` | app.js v=14, restart |
| 2026-11-08 | **Speed fix: pages no longer take seconds to load.** Cause: `user_data.json` has grown to 36 MB (half is `test_history`), and the server re-parsed it (~0.45 s) on every logged-in request. A course page made 7 such calls (~3 s), and every save also re-parsed it and rewrote it indented (~1.7 s). Fix in `app.py`: users.json and user_data.json are kept parsed in memory (`_load_json_cached`, refreshed when the file's mtime/size changes). Readers get a private copy of just their own record (`load_user_record(user)`). Saves update the in-memory copy and write compact JSON. Measured on the server: exam page 0.02 s, course page 0.16 s, history 0.03 s, Mastery save ~0.4 s. Uses ~60 MB of RAM. Backup (app.py, users.json, user_data.json): `/srv/answrit/prev-20261108-180656-speed/`. | `app.py` | restart |
| 2026-11-08 | **New "All questions & answers" screen on every exam** (`#/answers/<file>`, button on the exam page). Shows every question in order with its exhibit and every choice; correct ones are highlighted green, and matching questions are shown as boxes. It has a search box and a "Hide answers until I tap" option. **New tab/app icon:** a white "IT" on blue (`static/images/answrit-it.svg`, `-32/-192/-512.png`, `apple-touch-icon-it.png`); `manifest.json` icons updated. The live index.html was edited in place (icon links, versions) so the PT lab stays offline. Backup: `/srv/answrit/prev-20261108-180023-answers-icon/`. | `static/beta/app.js`, `app.css`, `static/manifest.json`, `static/images/*-it*` | app.js v=13, app.css v=8 |
| 2026-11-08 | **iPhone home-screen app: header no longer hidden under the notch/clock.** Added `env(safe-area-inset-top)` padding to `.topbar` and focus-mode screens (0 in a normal browser, so the website is unchanged). Cause: the page uses `viewport-fit=cover`, and the classic design's `black-translucent` status bar may still apply to apps installed back then. Only `app.css` uploaded (v=7). Backup: `/srv/answrit/prev-20261108-085012-notch/`. | `static/beta/app.css` | app.css v=7 |
| 2026-11-08 | **Course order changed** to IT Essentials, CCNA 1, Comms, CCNA 2 (`COURSE_ORDER` in app.js). Only `static/beta/app.js` was uploaded, and the live index.html bumped to app.js v=12. The Packet Tracer lab stays **offline**: the live index doesn't load ptlab.js, so its link doesn't show. Backup: `/srv/answrit/prev-20261108-083913-course-order/`. | `static/beta/app.js` | app.js v=12 |
| 2026-11-08 | **Everything moved to the new design + CCNA 2 live.** Games, Packet Tracer, My Flashcards, picture upload and themes; `/apps` and `/packet-tracer` now open the new design. Six CCNA 2 exams (513 questions) added. Questions now keep their line breaks (command output, routing tables). Backup: `/srv/answrit/prev-20261108-073735-move-all-ccna2/before.tar` (old app.py, static/beta, data/exams.json). | `app.py`, `static/beta/*`, `data/exams.json`, `data/ccna-2-*.json` | app.js v=9, app.css v=5, drills v=1 |
| 2026-11-07 | **The redesign is now the main site.** Details below the table. The backup is in `/srv/answrit/prev-20261107-165538-launch/` (old app.py, beta files, Caddyfile, classic index). | `app.py`, `static/beta/*`, `static/index.html`, Caddyfile | app.js v=7, app.css v=3 |

Details of the redesign launch:
- **New design:** `/`, `/study`, `/flashcards`, `/history` and `/exams/<slug>/` serve it (`static/beta/index.html`, filled in by `render_index_html`). Old paths are mapped to the matching screen by `routeFromPath()` in `app.js`.
- **Classic design:** `/apps` and `/packet-tracer` still serve it, for the drills and Packet Tracer practice. Its Home and Study buttons now go back to the new design (a small inline script in `static/index.html`).
- **Old preview address:** `/beta` and `/beta/` redirect to `/` (Caddy).
- **Carried over:** the GA4 tag (page_view on every screen change), Google site verification and SEO titles, descriptions and canonicals. The preview banner and noindex are gone.
- **To undo:** restore `app.py` from the backup folder, restart `answrit`, and restore the Caddyfile.

Details of the Comms retirement:
- **Removed:**
  - both tests from `data/exams.json`, which also drops them from the Flashcards picker and the sitemap;
  - the Comms Test tiles from All Apps.
- **The Comms tab now shows a note card** (`.comms-note`): "We didn't have enough material… removed it. Please study with your peers… the final is the easiest test… We'll see you in C school!"
- **Redirects:**
  - `/exams/naval-messaging/` and `/exams/naval-comms-exam-v3/` already redirect home through `app.py`;
  - `comms-test-1.html` and `mrts-test-2.html` are now small pages that redirect home.
- **Kept on disk:** the question files (`data/naval-*.json`), `master-recall-flashcards.json` and the study guide PDFs. They're unlinked and can be restored by putting the entries back in `exams.json`.
- **Old live copies** are in `/srv/answrit/prev-20261107-144848-retire-comms/`.

The same change was made in this folder's working copy. Nothing is committed to git yet.

## Redesign (in progress)
- **Goal, Nov 7, 2026:** a full redesign, built for A School now with room to add C School later.
  - Look: clean & modern.
  - Main complaint: it's hard for users to find things.
  - Keep prominent: Practice, Mastery, Flashcards, Chat and Progress. Mini-games stay, but less prominent.
- **Main finding:** the current bottom menu only shows Home and Study. History, Flashcards, Chat and Apps are hidden from it.
- **Mockup:** https://claude.ai/artifact/Vu1EmvpR3m9UfPxDZ3BZYL (private to the owner). It has 4 phone screens: Home, Exam page, Progress and Chat.
  - Bottom menu with 4 tabs: Home, Study, Progress, Chat.
  - Fonts: Inter, with Space Grotesk headings. Colors: blue #2563EB on a light #F5F7FB background.
- **Plan:** build the new design as a preview the owner can review, separate from the live site. Accounts and data stay the same. Go live only after the owner approves.
- **Built Nov 7, 2026. The preview is live at https://www.answrit.net/beta/** (noindex, with a "previewing" banner).
  - **Code:** `static/beta/index.html`, `static/beta/app.css` and `static/beta/app.js`. It's plain JavaScript with no build step, and it uses the existing `/api/...` endpoints. No `app.py` changes.
  - **Screen addresses** are in the URL hash: `#/`, `#/study`, `#/course/<id>`, `#/exam/<file>`, `#/practice/<file>?n=`, `#/mastery/<file>`, `#/flashcards/<file>`, `#/results`, `#/progress`, `#/progress/attempt/<id>`, `#/chat`, `#/login`, `#/account`, `#/drills`.
  - **Courses** are set in the `COURSE_ORDER`, `COURSES` and `EXAM_NAMES` lists at the top of `app.js`. (There are no schools any more.)
  - **Server:** the Caddyfile has `redir /beta /beta/` and `rewrite /beta/ /beta/index.html` on both site blocks. Flask serves the files from `static/beta/`. A backup of the old Caddyfile is in `/etc/caddy/Caddyfile.bak-*`.
  - **Bump `?v=`** in `beta/index.html` after changing app.js or app.css.
  - **Tested** with headless Chrome over the DevTools protocol, logged out: the home, study, course, exam, Comms, flashcards and chat screens, plus a full 164-question practice test with matching and multi-answer questions. It reached the results page with no JS errors.
  - **Not yet tested** (needs a login): mastery mode, Progress, marking flashcards, sending chat messages, login/sign-up.
  - **Not in the new design yet:**
    - the drills/mini-games (they open the classic site at `/apps`);
    - Packet Tracer practice;
    - profile picture upload and themes;
    - My Flashcards ("coming soon" on the old site too).
- **LIVE as the main site since Nov 7, 2026** (see "Site changes since the move").
- **Everything moved into the new design (Nov 8, 2026). LIVE since Nov 8, 2026** (deployed together with CCNA 2).**
  - **Drills & games:** all 21 games are in `static/beta/drills.js` + `drills.css` (`window.AnswritDrills.list` / `mount`). Screens `#/drills` and `#/drills/<id>`. The data tables were copied unchanged from classic `app.js`. The Cable ID pictures (`/images/connector-*.jpg`) are only on the server, not in this folder or git.
  - **Packet Tracer:** `#/packet-tracer`, `#/packet-tracer/subnet`, `#/packet-tracer/cli` (same problems and CLI tasks as classic).
  - **My Flashcards:** `#/my-flashcards`, `#/my-flashcards/<n>`, `#/my-flashcards/<n>/study`. Uses `/api/my-flashcards`; logged out, decks are kept on the device and copied into the account on first login.
  - **Account:** profile picture upload with drag/zoom crop (256px JPEG, under the server's 200k limit) and themes Ocean, Midnight (dark), Forest, Sunset, Jenelle. The theme keys match classic, so saved choices carry over (`applyTheme` in app.js, `:root[data-theme=…]` in app.css).
  - **No more A School / C School.** Home and Study show one "Courses" list (`COURSE_ORDER` in app.js) plus "More ways to study". A course only shows once it has exams. **CCNA 2** is already set up as course `ccna2` (files starting `ccna-2`), and it will appear as soon as its exams are added.
  - **app.py:** `CLASSIC_PATHS` is now empty, so `/apps` → `#/drills` and `/packet-tracer` → `#/packet-tracer` in the new design. The classic page is retired (its files are still on disk).
  - Versions: app.js v=9, app.css v=5, drills.js v=1, drills.css v=1.
  - **To deploy:** upload `app.py` and `static/beta/{index.html,app.js,app.css,drills.js,drills.css}`, back up the old copies to `/srv/answrit/prev-<time>-move-all/`, install them, then restart `answrit` (app.py changed).

## Log
- **2026-11-12 (SEO update, live).** Owner asked to rank above ITExamAnswers (told them no one can promise rank #1; Google tends to rank the original source of copied answers first; links from other sites matter most). Changes: every page now ships readable HTML in `<main id="view">` (`$VIEW_HTML$` token, built by `seo_home_html` / `seo_exam_html` in app.py): home lists every exam by course; each `/exams/<slug>/` page lists all its questions with the correct answer (and the hint "Why" tip where `static/beta/hints/` has one) plus links to the other exams. Exam pages also get `Quiz` (flashcard Q&A) and `BreadcrumbList` JSON-LD (`$EXTRA_HEAD$` token). New titles: "<exam> Answers & Free Practice Test | AnswrIT"; new home H1; better /study/ and /packet-tracer/ titles; `/history/` dropped from the sitemap (21 URLs). The app now opens an exam's web address on its "All questions & answers" screen (H1 "<exam> answers" + a "Practice this exam" button). The noscript duplicate H1 was removed. app.js v=41, app.css v=20, restart done. Backup: `/srv/answrit/prev-20261112-153149-seo/`. Tested with the server's venv (all pages 200, no leftover tokens) and live.
- **2026-11-12 (Navy removal, live with the owner's OK).** Owner asked to remove everything about the Navy, A School and C School (no "shipmate", "sailor", etc.). Backup and the 17 moved files: `/srv/answrit/prev-20261112-152618-navy-removal/` (`removed/` holds the old Navy/classic files). Restarted; old URLs (/index.html, /studyData.json, Navy PDFs…) now 404.
  - **Text:** app.py search titles/descriptions/H1s no longer mention Navy IT / A school / naval comms; "Most shipmates score…" → "Most students score…"; the retired **Comms** course (tile + "see you in C school" note), its 3 games (NATO Phonetic, Message Precedence, RF Spectrum) and the **Comms chat room** are gone (the room had 0 messages); `<meta keywords>`, JSON-LD "about" and manifest.json description cleaned; CCNA 1 practice lab: "IT A/C School" → "Building A/C", domain ITTN.navy → ITTN.net. The `.pt-navy` CSS class (the color) stays.
  - **Files taken off the public site** (they were all reachable by URL) and moved to `archive/` (gitignored, kept on the Mac): the classic page (`static/index.html`, `app.js`, `style.css`, `dataLoader.js`, `deviceDetect.js`), Navy material (`comms-test-1.html`, `mrts-test-2.html`, `study-guide.html`, `studyData.json`, `interactive-modes-db.json`, `nomenclature-*.json`, `static/study-guides/Naval_*.pdf`, `data/naval-*.json`, `data/master-recall-flashcards.json`). They're removed from the repo's current files; older commits still have them.
- **2026-11-12 (deployed with the owner's OK): step order drill typing fix + Packet Tracer 2 lab** (`static/beta/{index.html,app.js,app.css,ptlab.js}`; index app.js v=39, app.css v=19; app.js loads ptlab v=16; no restart). Backup: `/srv/answrit/prev-20261112-150034-pt2-lab/`. Live check (phone size): CCNA 2 page lists Packet Tracer 2, lab opens, drill typing works, no errors.
  1. **Step order drill, Type it mode:** owner said on the phone Enter submitted after one command and they couldn't tell which CLI mode they were in. Now Enter adds a line (whole step, one command per line, then Check), the prompt changes as you type, a "You're in: …" line explains the mode in plain words, mistakes show like IOS (`% This goes inside a port…`), and Check marks each line ✓/✗ and lists what was left out. Order inside a step is free but each line must be in the right port/VLAN/line. Tested: 65,130 grading checks + phone-size UI test, no errors.
  2. **Account themes:** a Light/Dark-only change was tried, then dropped at the owner's request before deploying. The five themes (Ocean, Midnight, Forest, Sunset, Jenelle) stay.
  3. **Packet Tracer 2 lab** (`#/packet-tracer/lab/ccna2-routes`, versions 1-6 + random): static, default and floating routes, IPv4 + IPv6, serial cables. Owner's file `packet-tracer-ccna2-2.pka` was solved in Packet Tracer to **100%** (answer key + proof in `ptlabs/`, not committed; the file hides its Assessment Items, so the site's 53 graded items are our own list). Engine additions in ptlab.js (used only by labs with `routing: true`, PT1 unchanged and still 48/48): 1941 router with Serial ports, `clock rate` (DCE only; serial link stays down without it), `ip route` / `ipv6 route` (next hop or exit port, one or two words, distance), `no` forms, hop-by-hop routing with longest match + distance (floating route takes over when the main cable is shut), `show ip route` / `show ipv6 route`, routes in `show run`, IPv6 DNS box on hosts, red zigzag serial cables with DCE clock marks. Own names/addresses in every version (scan finds no class values). Linked from the CCNA 2 course page; the Packet Tracer page lists it automatically. Tested: 1,700 checks over 63 versions (100% score, all pings, backup route, no-clock and no-IPv6-routing cases), desktop + phone screenshots, no errors.
  Also: `~/Downloads/Packet-Tracer-2-Command-List.pdf` made for the owner (same layout as the PT1 list, generic device names).
- **2026-11-11 (Packet Tracer 1 step order drill, live):** Owner said they know the commands but not the order, and gave permission to deploy. New page `#/packet-tracer/order` (`viewPtOrder` + `pto*` helpers in app.js), linked from the CCNA 2 course page and the Packet Tracer page. Each question shows one device, its cables from the map and the steps done so far, then asks what's next: type the first command (short forms count, same checker as the command drill) or pick from 4. Router = Start, Lock, Sign, cable to server, cable to switch + a virtual port per VLAN, Save; switch = Start, Rooms, Cables, Own address, SSH if named, Save. Full walkthrough (28, whole lab in order) or quick round (12); new values each round; "Practice the ones I missed". Tested: ~103,000 checker checks over 500 random rounds, phone-size UI test local and live, no errors. Also added `unicast-routing` to `PTC_MIN`. app.js v=36, app.css v=17. Backup on the server: `/srv/answrit/prev-20261111-120354-pt-step-order/`. Also: the owner's command-list PDF (in their Downloads, not in the repo) now uses the same router order.
- **2026-11-10 (Packet Tracer 1 command drill, live):** Owner asked for a phone-friendly command memory drill and gave permission to deploy. New page `#/packet-tracer/commands` (`viewPtCmd` + `ptc*` helpers in app.js): 42 questions in Tasks-box order (commands + a few notebook math ones), new names/numbers each round, "Type it" (checker accepts Packet Tracer short forms, rejects ambiguous ones like `en sec`, handles interface ranges, IPv6 forms, banner delimiters) or "Pick it" (4 choices); Quick round (15) or Full walkthrough; shows full + short form and a one-line why; results list missed with "Practice the ones I missed". Linked from the CCNA 2 course page (Packet Tracer section, `COURSES.ccna2.labs` now uses href/icon/tint) and the Packet Tracer page. Checker test: 37,869 checks pass. app.js v=35, app.css v=16, no restart. Backup: `/srv/answrit/prev-20261110-034826-pt-cmd-drill/`. Live check (phone size) passed.
- **2026-11-10 (Packet Tracer 1 live for everyone):** Owner asked to put the CCNA 2 lab on the live site. No more `?ptpreview=1` gate: the Packet Tracer page lists the lab for everyone, and the CCNA 2 course page has a new "Packet Tracer" section with **Packet Tracer 1** (`COURSES.ccna2.labs` in app.js) linking to `#/packet-tracer/lab/ccna2-vlan`. Lab renamed "Packet Tracer 1". Home tile text now "Practice labs, subnetting and a CLI simulator". ptlab v=15, app.js v=34, no restart. Backup: `/srv/answrit/prev-20261110-033912-pt1-live/`. Live check as a fresh visitor (desktop + phone): course page shows it, lab opens, no errors. Known: phone use of the lab is still rough (owner's to-do).
- **2026-11-10 (PT lab passwords shown, deployed):** Owner asked to stop users guessing passwords: the Tasks box now says "Router: enable secret class, console/VTY password cisco, encrypted" (the class file never named them; Packet Tracer grades console/VTY = cisco, enable secret isn't graded). ptlab v=14, app.js v=33, no restart. Backup: `/srv/answrit/prev-20261110-015246-pt-passwords/`. Live check passed.
- **2026-11-10 (PT lab movable windows, deployed):** Owner asked to move and resize device windows. On screens 760px+ the device window floats: drag by its title bar, resize from a corner grip, map stays clickable behind it, size/spot remembered while the lab is open; it opens on the right (about 58% wide) so the map shows. Phones unchanged (full screen). ptlab v=13, app.js v=32. Tested drag, resize, tab switch, clicking other devices, CLI typing, phone; engine still 48/48. Deployed with the owner's OK (no restart). Backup: `/srv/answrit/prev-20261110-014625-pt-dragwin/`. Live check passed (drag, resize, CLI, phone, preview gate).
- **2026-11-10 (to do: PT lab on phones):** Owner says the CCNA 2 lab "doesn't really work well on the phone"; fix later (ask what goes wrong). Also: `answrit.net` → `www` redirect in Caddy drops the query string, so `answrit.net/?ptpreview=1` loses the flag; owner was offered a one-line Caddy fix (`redir https://www.answrit.net{uri}`), not done yet.
- **2026-11-10 (PT lab version bar, deployed):** Owner found the version picker too hidden (only in PT Activity) and the two round time-bar buttons unclickable. Added a yellow bar above the lab: Version dropdown (1-6, or "Random #N"), New random, Start over (same actions as in PT Activity). The round buttons (Power Cycle Devices, Fast Forward Time) now show a note on what they do in real Packet Tracer and that they aren't needed here. ptlab v=12, app.js v=31. Tested desktop + phone: switching, new random, start over all work, no errors. Deployed with the owner's OK (no restart). Backup: `/srv/answrit/prev-20261110-003142-pt-verbar/`. Live check: picker, New random, Start over and the round-button notes all work; preview gate unchanged.
- **2026-11-09 (PT lab own values: deployed):** Deployed with the owner's OK (ptlab.js, app.js loads ptlab v=11, index.html app.js v=30; no restart). Backup: `/srv/answrit/prev-20261109-221133-pt-own-values/`. Live check: lab shows NOVA/answrit_skills_pt1_v1.pka, no class values in the live file, preview gate still works. `ptlabs/` removed from GitHub (now gitignored, kept only on the Mac); older commits on the `site-update-2026-11` branch still contain it.
- **2026-11-09 (PT lab: own names and addresses):** Owner asked that no version reuse the class file's names or addresses. Version 1 is now NOVA/COMET/QUASAR/PULSAR, VLANs 30 PLANNING / 60 SUPPORT / 99 NATIVE_MGMT, 172.20.14.64/27, .96/27, .128/29, link 10.88.6.8/30, 2001:DB8:C4:B::/64 (::5, FE80::A), netlab.com / netadmin / Secure1, banner "Authorized Access Only!". The random pools drop every class value (VLAN 50/75/500, cisco.com, admin, Keep Out!, DNS SVR, 192.168.10.x, 10.40.50.x, 2021:, FE80::1, ::9). Requirements box reworded in our own words; title bar file is `answrit_skills_pt1_vN.pka`; no "class" label on version 1. Saved lab progress key gets `:r2` so old saves don't clash. Tests: versions 1-6 + random all 48/48; scan of 9,100 versions finds no class values. The step-by-step Claude doc examples were switched to the new version 1 values. Not deployed yet. `ptlabs/` in the public repo still holds the class file's answer key and screenshots.
- **2026-11-09 (PT preview rename):** Owner asked: only CCNA 2 labs on the page; the lab is now **CCNA 2 Skills PT 1** (there will be Skills PT 2 and a final PT). CCNA 1 lab hidden from the list (code kept). Deployed to the preview (app.js v=29, ptlab v=10); live check passed. Backup: `/srv/answrit/prev-20261109-191530-ptrename/`.
- **2026-11-09 (PT lab preview live):** Deployed the PT labs behind `?ptpreview=1` with the owner's OK. Live check: without the link no labs and no lab files load; with it both labs list and version 2 opens.
- **2026-11-09 (PT lab ccna2 build, local only):** Built the CCNA 2 skills lab in `static/beta/ptlab.js` (lab id `ccna2-vlan`, versions `ccna2-vlan-N`). Engine now does VLANs, access/trunk/native, DTP auto, `interface range`, router-on-a-stick subinterfaces (`encapsulation dot1Q N [native]`), SVIs, VTY 0-15, host DNS, `show vlan [brief]`, `show interfaces trunk`, and VLAN-aware pings. Version 1 = the class file (same 48 items; the 48/48 commands score 48/48 in the sim); versions 2-6 and "New random" change names, VLANs, networks, ports, IPv6, domain/user/banner but keep the same steps and 48 items. Tests: every version tested scores 48/48 with its answer commands, blank = 0/48, old CCNA 1 lab still works. NOT on the live site yet (live index.html doesn't load ptlab.js/css).
- **2026-11-09 (PT lab ccna2-1 recheck):** Owner reopened the lab to see if it changes each time. Compared topology text, VLANs/networks, 1st/2nd/3rd labels, requirements, port cabling and the 48 assessment items (23 Ip / 9 Other / 4 Physical / 12 Switching): no changes. The answer key in `ptlabs/` still holds.
- **2026-11-09 (PT lab ccna2-1):** With the owner's OK (Accessibility + Screen Recording for VS Code), Claude drove Packet Tracer 9.0.1 on the Mac (screenshots + a small CGEvent click helper in the scratchpad) and completed `packet-tracer-ccna2-1.pka` to **48/48** in Check Results. Router = last usable address; server IPv6 = ::1. Verified answer key, topology/port screenshot and the 48/48 proof are in `ptlabs/`. The modified activity was NOT saved. Next: rebuild it as a practice lab on the site (offline PT lab page), shown on a test page first.
- **2026-11-08 (hints live):** Owner said the hints are good enough; turned them on for everyone on CCNA 2 Modules 1–4. Live check passed. Other exams don't have hints yet.
- **2026-11-08 (hints preview):** Memory hints for CCNA 2 Modules 1–4 put up as a hidden preview (owner's idea, owner to decide). Live check: no hint button without the preview link or on other exams; with it, hint button and highlight work.
- **2026-11-08 (matching shuffle):** Both sides of matching questions now shuffle every time (owner asked). Deployed with the owner's OK; live test: 5 openings gave 5 different left orders, right side never repeated back to back, answering correctly still scored 100%.
- **2026-11-08 (scroll fix):** Fixed the page jumping up when tapping an answer on picture questions. Deployed with the owner's OK; tested live with image reloads blocked: scroll stayed at 353 (old code jumped to 154).
- **2026-11-08 (retake shuffle):** Retake same test now shuffles the question order too (owner asked). Deployed with the owner's OK; live app.js v=23 checked.
- **2026-11-08 (retake):** Added **Retake same test** to practice test results (same questions, same order). Deployed with the owner's OK; live checks passed (`ids=5,3,9` returns those questions in order; app.js v=22, app.css v=14). To undo: copy the files back from `/srv/answrit/prev-20261109-014549-retake/` and restart.
- **2026-11-08 (chat):** Chat rebuilt with rooms, ask-about-question, unread badges, replies/reactions and admin tools. The owner created the `answrit` admin account.
- **2026-11-08 (protect):** Code pushed to GitHub (branch `site-update-2026-11`); daily disk snapshots set up (7 days kept); answer choices now shuffle in practice and Mastery.
- **2026-11-08 (cleanup):** Added the automatic daily cleanup of test details older than 30 days (see table). Check it's running: `sudo tail /srv/answrit/app/history_cleanup.log`.
- **2026-11-08 (speed):** Found that user_data.json (36 MB) was being re-read on every request; added in-memory caching and compact saves. user_data.json will now be stored compact (about 24 MB) after the next save. Its `test_history` (18 MB) keeps every quiz in full and could be trimmed later if it keeps growing.
- **2026-11-08:**
  - **Built CCNA 2 locally (not live):** 6 exams, 513 questions, added to `data/` and `data/exams.json`. Every question scores correct on a local copy of the site. Details, and 3 answers for the owner to double-check, are in EXAM-REBUILD.md under "CCNA 2". Before deploying: fix the `#/course/` route in `static/beta/app.js` so `ccna2` works (the regex allows letters only), and add CCNA 2 to `EXAM_NAMES`.
  - Moved everything left on the classic design into the new one: the 21 games, Packet Tracer practice, My Flashcards, profile pictures and themes. The owner said to "move everything entirely".
  - Dropped the A School/C School split (the owner's request). Next up: **CCNA 2**, which the owner will send ITExamAnswers links for. Rebuild it the same way as the other exams (EXAM-REBUILD.md).
  - Tested on a local copy with headless Chrome: Packet Tracer subnet and CLI, My Flashcards (logged out and in), sign-up, theme saving, picture upload and crop, Midnight theme, and all 21 games through the real router. No JS errors.
  - **Deployed** after the owner said to make everything live once CCNA 2 was done. Fixed first: the `#/course/ccna2` route (it didn't allow digits), the CCNA 2 names in `EXAM_NAMES`, and `white-space: pre-line` for question and choice text.
  - Live checks: every route serves the new design; all 21 games run with no JS errors; the CCNA 2 course page lists 6 exams; the sitemap includes them; `/api/exams` shows 76/54/64/79/61/179 questions.
  - **To undo:** on the server, `cd /srv/answrit/app && sudo tar xf /srv/answrit/prev-20261108-073735-move-all-ccna2/before.tar`, then `sudo systemctl restart answrit`. Remove `data/ccna-2-*.json` too if needed.
  - **Packet Tracer lab simulations.** `.pka` files are encrypted by Cisco, so Claude can't read them, and won't try to break that. The owner made two screen recordings instead (`Screen Recording 2026-11-08 at 01.41.48.mov` = instructions, `…01.42.24.mov` = topology and devices; frames pulled with imageio-ffmpeg).
    - **Built `final_practice_27_oct_2020` as a lab:** `static/beta/ptlab.js` + `ptlab.css`, screen `#/packet-tracer/lab/final-practice-2020`, linked from the Packet Tracer page.
      - Clickable topology with link lights.
      - A simplified Cisco IOS CLI on the router and both switches that keeps its config: modes, abbreviations, `?` help, Tab, history, real-style errors, `show run/start/ip int brief/ipv6 int brief/ip route`, banner, passwords (type 7 / secret 5 display), `security passwords min-length` refusing short passwords, `login block-for`, SSH (domain, user, RSA keys), IPv4/IPv6/link-local, `ipv6 unicast-routing`, `copy run start`, `copy run tftp`.
      - PCs and the server have IP Configuration and a Command Prompt (ipconfig, ping); the server has a TFTP file list.
      - Ping follows the real addressing, gateways and routing.
      - An Addressing worksheet (Step 1, with checking) and a full address plan.
      - Instructions with "see the commands" help.
      - "Results" scoring with 65 items, like Packet Tracer's Check Results.
      - Progress is saved in the browser (localStorage `answrit:ptlab:<id>`).
    - **Adding another lab:** add an entry to `LABS` in ptlab.js (devices with x/y, links, instructions, help, worksheet, checks). The engine is shared.
    - Tested: a scripted full solution scores 100% (`scratchpad/pka/solve.mjs`), and the phone-size browser check had no JS errors.
    - **Mobile redesign (the owner asked for "better formatted for mobile… more creative"):**
      - The lab is full screen (`body.lab-mode` hides the site's top bar and tabs) with its own top bar (back, title, score ring) and bottom dock (Network / Tasks / Subnets / Score).
      - **Network** has a "Next up" card, the diagram with progress badges, and device cards.
      - Devices open in a full-screen panel. The terminal has tap-to-insert command suggestion chips from IOS `?` help, ? / Tab / ↑ / ↓ / Ctrl+Z keys, and a device switcher. PCs have a settings-style IP Configuration screen.
      - **Tasks** are 7 steps that tick themselves off live (each check has a `step`), with "Show commands".
      - **Subnets** works one subnet at a time, with dots and checking.
      - **Score** has a ring, per-step bars and a "Still to do" list.
      - A pop-up appears when an item becomes correct.
    - **Rebuilt to look like Packet Tracer (Nov 8; the owner wants it to match the real test so students aren't confused):**
      - The main window has the title bar, the menu (File Edit Options View Tools Extensions Window Help), a toolbar, and the navy Logical/Physical bar.
      - A white workspace shows the devices with "model / name" labels and green ▲ / red ▼ link triangles.
      - The navy Time bar has Realtime/Simulation, plus a device tray on wide screens.
      - **PT Activity** is docked at the bottom and opens into the instructions window: Times-font document, red values, yellow highlights, the Step 1 table with fillable cells, Time Left countdown from 4:30:00, Top/Dock, **Check Results**, Back 1/1 Next, Completion %.
      - **Device windows** use mac traffic-light dots and Packet Tracer's tabs:
        - routers and switches: Physical / Config / **CLI** / Attributes. CLI is a white "IOS Command Line Interface" box with Copy/Paste, plus an optional AnswrIT Suggestions/keys row.
        - PCs: Physical / Config / **Desktop** / Programming / Attributes.
        - the server: Physical / Config / **Services** / Desktop / Programming / Attributes.
      - The **Desktop** is the navy grid of app icons. **IP Configuration** has the blue title bar and matches the recording field for field; **Command Prompt** is a black window.
      - The **Config** tab has the left list (GLOBAL / INTERFACE …). On routers and switches, Hostname, NVRAM Save/Erase and interface Port Status/IPv4 work, and it shows "Equivalent IOS Commands".
      - Services → TFTP lists the backup files.
      - **Activity Results** has Overall Feedback, Assessment Items (Correct/Incorrect tree) and Connectivity Tests (ping pairs).
      - The recording only showed PC and server windows; the router/switch CLI and Config tabs follow Cisco's Packet Tracer help pages.
      - All drawings are original (no Cisco artwork copied). The previous phone-app version is saved at `scratchpad/pka/ptlab-v6-backup.js`.
      - Tested with real taps at 390px and 1440px: every window opens, there are no JS errors, and the scripted solution still scores 100%.
    - Versions: ptlab.js v=7, ptlab.css v=8, app.js v=11, app.css v=6.
    - **Kept offline on purpose (owner, Nov 8): "I will come back to this later."** The local `static/beta/index.html` loads ptlab.js/ptlab.css. Don't upload that index until the owner says to; upload only the specific files a change needs. Files to deploy: `static/beta/{index.html,app.js,app.css,ptlab.js,ptlab.css}` (no restart needed).
- **2026-11-05:**
  - Checked the live site against this folder. It matched commit `3b757fa`; the local edits haven't been deployed.
  - Backed up PythonAnywhere.
  - Oracle rejected the signup, so the site is moving to Google Cloud. Set up the budget alert and created the `answrit` server.
  - Installed the Google Cloud CLI on the Mac (plus Python 3.14 from python.org).
  - Set up the server and loaded the PythonAnywhere backup (unchanged from commit `3b757fa`, the live version). The test copy runs at http://34.61.51.101 and matches the live site.
  - The owner tested logins on the test copy, and they work. Reserved the IP as static (`answrit-ip`). Found that the domain is at Spaceship.
- **2026-11-07:** Reviewed the Spaceship DNS records and wrote the switch-day plan. Only the `www` record needs to change.
  - **Switched.** Loaded the fresh backup (172 accounts) onto the server. The owner changed `www` to A 34.61.51.101. Caddy got the HTTPS certificate.
  - Checked that https://www.answrit.net, the http→https redirect and the answrit.net→www redirect all work, and that logins answer.
  - The Google verification CNAME is still saved at Spaceship, but Spaceship's `*` wildcard redirect overrides it. It's a low-priority issue that probably existed before the switch.
  - Published a new Comms tab message: limited material, study with classmates, the final is the easiest test. Old copies are in `/srv/answrit/prev-static-20261107-144315/`.
  - **Retired both Comms tests.** The Comms tab now shows a "study with your peers / see you in C school" note. The two Comms tiles are gone, and old Comms links redirect home. Verified live.
  - Started the redesign: gathered goals and drew a 4-screen mockup (link in the Redesign section).
  - Built the redesign as a preview at https://www.answrit.net/beta/ and tested it logged out. Waiting for the owner's review.
  - The owner likes the preview.
  - **Matching questions from pictures:** ITExamAnswers shows matching answers only as an image. Claude can read those images and rebuild them in our JSON format.
    - Proof of concept on ITE 1–9 Q34 and Q57: both came out identical to the owner's hand-entered questions 128 and 130.
    - Demo page: https://claude.ai/artifact/NPWzVEZ4fEYSmkqntnhcai
  - **Fixed a preview bug:** "Not all options are used" questions (10 of them) couldn't be answered correctly, because terms missing from `correct_pairs` had no valid choice.
    - The fix adds a "Not used" choice; those terms are left out of the answer sent to the server.
    - Tested with headless Chrome: all matching questions in ITE 1–9 and the CCNA final now score correct (app.js v=3).
  - **Redesigned matching questions to look like the real Cisco exam** (app.js v=4, app.css v=2). The owner wants students used to the exam format.
    - Layout: items on the left, answer boxes on the right. Each box has a heading and slots; it gets as many slots as items belong in it.
    - Tap an item, then tap a slot. On desktop you can also drag. Tapping a placed item takes it back.
    - Unused items simply stay on the left, which replaced the "Not used" dropdown choice.
    - After checking: green box with a ✓ or red box with an ✗, plus "Answer: …" under wrong boxes.
    - The code is `matchTargets` / `boardHtml` / `bindBoard` in `static/beta/app.js`.
    - Tested on ITE 1–9 with headless Chrome: Q128 and Q130 (with a leftover item) were correct; Q129 was deliberately wrong and was flagged. The server's scoring agreed, with no JS errors.
    - The demo page was updated to the same board.
  - The owner approved the matching board. The pool items are now shuffled every time a question shows (app.js v=5).
  - **Made the redesign the main site** (after the owner said to). Browser-tested: the home page, an old exam link, `/history` → Progress, `/study`, the drills link to classic `/apps` and back, and starting a practice test. No JS errors.
  - Rebuilt all 10 exams. After the owner approved, they went **live**: every exam scores 100% when answered correctly, and there are no server errors. `app.py` changed (option_images), so the service was restarted.
  - **New project: rebuild every exam from ITExamAnswers.** The plan, question format and progress are in [EXAM-REBUILD.md](EXAM-REBUILD.md). The test run is ITE Final Modules 1–9.
  - Removed the Class 530 congrats message. The old copy is in `/srv/answrit/prev-20261107-145240-congrats/`.
  - The PythonAnywhere backup download turned out to be a plain .tar file even though its name ends in .tar.gz. Use `tar xf` to unpack it.

## Notes
- The site keeps users, progress and chat in files on disk (`users.json`, `user_data.json`, `chat.json`, and private messages in `dms.json`). The server needs a persistent disk, and these files must never be lost or committed to GitHub.
- Copy the `.flask_secret` file from the PythonAnywhere backup so people stay logged in after the switch.
- **Domain:** answrit.net is registered at **Spaceship** (spaceship.com), and its DNS is managed there too. ⚠️ **It expires on July 18, 2027. Renew it before then**, or turn on auto-renew.
- **Spaceship DNS records** (seen Nov 7, 2026). To find them: Spaceship → answrit.net → Nameservers & DNS → **Advanced DNS**.

  | Host | Type | Value | What it does |
  |---|---|---|---|
  | `@` and `*` | URL Redirect (A 15.197.162.184) | (Spaceship redirect) | Sends answrit.net to www.answrit.net. **Keep it.** |
  | `otm2czpwzg` | CNAME | `gv-x5gckloeaobh6a.dv.googlehosted.com` | Google Search Console verification. **Never delete it.** |
  | `www` | **A**, TTL 1 min | **`34.61.51.101`** | Points the site to the Google Cloud server. Changed Nov 7, 2026. Before that it was a CNAME to `webapp-3134744.pythonanywhere.com`. |

## Switch-day plan (step 6)
Do this at a quiet time. It takes about 15 minutes, and anything users save between steps 1 and 3 is lost, so keep the gap short.
1. **Owner:** on PythonAnywhere, open a Bash console and re-run the backup command:
   ```
   cd ~ && tar czf answrit-backup.tar.gz --exclude=venv --exclude=__pycache__ Sharps-ITExamAnswers-Test-Generator pip-freeze.txt /var/www/*_wsgi.py
   ```
   Then download the file to `~/Desktop/answrit-backups/`.
2. **Claude:** upload it, stop the app, unpack it over `/srv/answrit/app` with `tar xf`, check the user files, then start the app again.
3. **Owner:** at Spaceship, edit the `www` row:
   - change **Type** from CNAME to **A**,
   - set **Value** to **34.61.51.101**,
   - save.
4. **Claude:** change the Caddyfile to serve `www.answrit.net`, so Caddy gets the HTTPS certificate automatically. Then check https://www.answrit.net, logins, and the redirect from answrit.net.
5. **To undo:** set the `www` row back to CNAME `webapp-3134744.pythonanywhere.com`. PythonAnywhere keeps running until it's cancelled.
