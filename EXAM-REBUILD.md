# Rebuilding the exams from ITExamAnswers

**Goal:** re-create every exam on answrit.net from its ITExamAnswers page. Claude does the work, and the owner gives the links. That covers every question and answer, matching questions, questions with images, and answers that are images. The same process will add the C School material later.

**Status (Nov 7, 2026):** **all 10 rebuilt exams are LIVE on answrit.net** (approved by the owner).
- **Backup of the old exam files, `app.py` and the beta files:** `/srv/answrit/prev-20261107-165153-exams/` on the server.
- **Verified live:**
  - answering every question correctly scores 100% on all 10 exams (1,318/1,318) through `/api/score`;
  - `/api/exams` shows the new counts;
  - no errors in the server log.
- **Rebuilt files:** `rebuild/output/`
- **Per-exam reports:** `rebuild/reports/`
- **Picture readings:** `rebuild/readings/`
- **Review page** (try every new or changed picture question next to its original picture): https://claude.ai/artifact/JgcokYbcf2iQBXa92R7nk8

## Test run: ITE Final Exam Modules 1–9
- **Source:** https://itexamanswers.net/it-essentials-7-0-final-exam-chapters-1-9-answers-full.html
- **Compare against:** `data/it-essentials-70-80-final-exam-modules-1-9-answers.json` (130 questions, 3 of them matching: ids 128–130). The local copy is identical to the live server (checked Nov 7, 2026).
- **Pass:** every question the old file has is found in the new build with the same answers. Every difference is explained in the report, along with anything new the old file missed.

## Tool
`rebuild/compare_exam.py <page.html> <matching-read.json> <current-exam.json> <out-dir>`
- It needs bs4, lxml and requests. On this Mac, use a venv with Python 3.14; system python3 is 3.9.
- It runs `scraper.scrape_questions` on the page, adds the matching questions Claude read from the pictures, and matches each question to the current file by question text plus its answer choices (with a ≥90% fuzzy fallback).
- It writes `new-exam.json` (matched questions keep their old id) and `report.md`.
- `<matching-read.json>` is a list in the matching format below, plus `page_number` and `image` (the answer picture URL) for each question. Claude writes it after reading each picture.

## Results
### ITE Final Exam Modules 1–9: test run passed (Nov 7, 2026)
- The page has 127 numbered questions, 3 of them matching (page Q34, Q52, Q57). The scraper numbers questions itself, so the matching ones are ids 128–130 at the end, as in the hand-made file.
- **Rebuilt file vs current file: identical** (130/130, same ids and content). That includes all 3 matching questions read from the pictures and the 1 question picture. The page has no answer choices that are pictures.
- **Checks:**
  - The Q52 picture reading agrees with the page's written-out answer. The text version drops "available." from the 288-pin box; we kept the picture's wording.
  - The report caught a planted wrong answer, a wrong matching pair and a missing question.
- No swap was needed, because nothing changed.

### All 10 exams (Nov 7, 2026)
| Exam | Now | Rebuilt | Same | Updated | Added |
|---|---|---|---|---|---|
| ITE 1–9 | 130 | 130 | 130 | 0 | 0 |
| ITE 10–14 | 158 | 158 | 151 | 7 | 0 |
| ITE Course Final | 340 | 352 | 339 | 1 | 12 |
| CCNA 1–3 | 68 | 75 | 67 | 1 | 7 |
| CCNA 4–7 | 72 | 74 | 71 | 1 | 2 |
| CCNA 8–10 | 59 | 65 | 57 | 2 | 6 |
| CCNA 11–13 | 64 | 70 | 62 | 2 | 6 |
| CCNA 14–15 | 60 | 61 | 58 | 2 | 1 |
| CCNA 16–17 | 67 | 67 | 61 | 6 | 0 |
| CCNA Final | 164 | 166 | 157 | 7 | 2 |

**What the numbers mean:**
- **Every current question is kept,** with the same id, so mastery progress carries over.
- **"Updated"** is mostly wording: invisible zero-width characters removed, the site adding "(Not all options are used.)", and so on.
- **All 1,318 rebuilt questions pass validation:** every answer is one of its choices, and every matching pair points at a real item and box.

**Accuracy check.** Four helper agents read the pictures independently, without seeing the hand-typed versions; brief in `rebuild/READING-BRIEF.md`. They matched **24 of the 28** hand-typed matching questions exactly. The 4 that differed:
- **ITE 10–14 #151, Windows 10 boot sequence: the hand-typed version was WRONG** (4 of 5 steps misplaced). Claude checked the picture's lettered lines.
  - Correct order: boot loader winload.exe loads → ntoskrnl.exe and hal.dll loaded → winload.exe is loaded → ntoskrnl.exe loads and executes → winlogon.exe.
  - The rebuild fixes it.
- **Wording only:**
  - #157: "16 exabyte" vs "exabytes".
  - CCNA 16–17 #64: the site's typos "nework" and "malicous".
  - #67: the SSH box heading.

**Other finds:**
- **ITE 10–14 #114 and #119 gave away the answer:** the correct choice ended in " *". Fixed.
- **ITE 10–14 Task Manager question:** the hand-typed version was missing the leftover "Users". Added.
- **CCNA Final Q33 (host B → router PDU addresses):** the site doesn't mark an answer. Worked out from the exhibit and checked by Claude: L2 dst = router Fa0 00-00-0c-94-36-ab, L2 src = B, L3 dst = D 172.16.20.200, L3 src = B 172.16.10.200.
- **CCNA 14–15 TCP termination:** the site shows two answer pictures that disagree. We used the one that matches the site's explanation (client FIN, server ACK, server FIN, client ACK).
- **Left out:**
  - CCNA 8–10 Q48 needs Packet Tracer. It could be rebuilt as multiple choice from the page text if the owner wants.
  - CCNA 11–13 Q26 is cut off on the site (no address range, no choices).
- **Line-style pictures** (two columns joined by lines, common on the CCNA pages): which column is the "box" side is a judgment call. It doesn't change which pairs are correct.

### Going live (done Nov 7, 2026)
- **`app.py`:** `generate_test` and `mastery_batch` now pass `option_images` through to the page.
- **The new design** (`static/beta/app.js` v=6, `app.css` v=3) shows `option_images` inside answer choices.
- **The old live site** (`static/app.js`) doesn't show option pictures. The connector question shows text labels there ("RJ 45", "LC conector", …), which are still answerable.
- **The old site's matching drag-and-drop** handles every new shape (leftover items, boxes with several items, boxes that stay empty). Its scoring checks every correct pair.
- **`data/`** in the repo now matches the live server.

### CCNA 2 (Nov 8, 2026): built locally, NOT LIVE yet
New course, so there was nothing to compare against. The files are in `data/`, registered in `data/exams.json` (after the CCNA 1 entries), and tested on a local copy of the site. Course id `ccna2` in `static/beta/app.js` matches files starting `ccna-2`.

| Exam | File (`data/…json`) | Questions | Matching | Exhibit pictures | Left out |
|---|---|---|---|---|---|
| Modules 1–4 | `ccna-2-v7-modules-1-4-switching-concepts-vlans-and-intervlan-routing-exam-answers` | 76 | 4 | 18 | 1 (PT activity) |
| Modules 5–6 | `ccna-2-v7-modules-5-6-redundant-networks-exam-answers` | 54 | 2 | 10 | 1 (PT activity) |
| Modules 7–9 | `ccna-2-v7-modules-7-9-available-and-reliable-networks-exam-answers` | 64 | 8 | 10 | 5 (PT activity + 4 fragments) |
| Modules 10–13 | `ccna-2-v7-modules-10-13-l2-security-and-wlans-exam-answers` | 79 | 1 | 5 | 1 (PT activity) + 1 exact repeat |
| Modules 14–16 | `ccna-2-v7-modules-14-16-routing-concepts-and-configuration-exam-answers` | 61 | 2 | 24 | 1 (PT activity) + 1 exact repeat |
| Final Exam | `ccna-2-v7-0-final-exam-answers-full-switching-routing-and-wireless-essentials` | 179 | 8 | 41 | 0 |

**Total: 513 questions, 25 matching.** All 513 score correct through `/api/test` → `/api/score`, and deliberately wrong answers are marked wrong.

**New tool: `rebuild/build_page.py`** (used instead of `scraper.py` for CCNA 2). It splits the page at each numbered question and cuts each piece at its explanation box. Compared with the scraper on the same pages, every answer was identical, plus:
- **Text exhibits are kept.** Routing tables (`<pre>`), "Consider the following command: …", etc. become extra lines of the question, joined with `\n` (28 questions; 18 in Modules 14–16). The scraper kept only the first line. **The same problem probably affects the CCNA 1 exams already live** (e.g. any "Consider the following command:" question). Not fixed there yet.
- **The site doesn't show line breaks in question text yet.** `.question-text` in `static/beta/app.css` needs `white-space: pre-line` (choices too, for the 2 hand-built questions whose choices are command blocks). Until then the lines run together with spaces.
- **Answers marked with `<span class="correct_answer">`** are caught (Final Q82, which the scraper dropped).
- **Lazy-loaded pictures:** it uses `data-src`, so the 3 PT-activity screenshots got real URLs. Those questions are left out anyway.
- **Broken page HTML:** Modules 10–13's page never closes Q13's explanation box, which hid Q14–Q82 from both tools. The saved copy was repaired by hand before building (removed the stray `<p>` before Q13's `<div class="message_box …">`, and moved `</div>` to after its `</ul>`).

**Picture readings** are in `rebuild/readings/ccna-2-*.json`. Claude read all 25 pictures directly (no helper agents). Per-exam details are in `rebuild/reports/ccna-2-*.md`. Matching questions keep the picture's layout: left column = items, right column = boxes, and an unused box stays empty, like the CCNA 1 exams.

**Owner should double-check (marked CHECK in the reports):**
- **Final Q93 / Modules 7–9 Q38, "Match the purpose with its DHCP message type": the site's answer is wrong.** Its picture swaps DHCPREQUEST/DHCPDISCOVER and pairs DHCPNAK with "acknowledge that the lease is successful". Used Cisco's definitions, which also match the site's own explanation in 7–9 Q19: DISCOVER = locate any available DHCP server, OFFER = suggest a lease, REQUEST = identify the explicit server and lease offer to accept, ACK = "finalize a successful lease". DHCPNAK and "acknowledge…" are unused.
- **Modules 5–6 Q9, "Match the spanning-tree feature with the protocol type": the site's answer is wrong.** Used RSTP = fast converging enhancement of 802.1D, PVST+ = Cisco implementation of 802.1D, MSTP = IEEE standard that reduces the number of STP instances. MST is a leftover, and "proprietary per VLAN implementation of 802.1w" (Rapid PVST+) stays empty.
- **Modules 14–16 Q62, static vs dynamic routing:** the picture puts "Not suitable for topologies where more than one router is required" under Static routing, but the site's explanation suggests it's unused. Followed the picture.

**Also decided:**
- Modules 7–9 Q19's picture shows only the unanswered question; the order comes from the explanation (DISCOVER, OFFER, REQUEST, ACK).
- Modules 5–6 Q49 and Modules 7–9 Q52 and Q54 have their choices written as paragraphs; they were built by hand (the red one is correct).
- **Left out:** 5 "Open the PT Activity" questions (one per module exam; they need the Packet Tracer file), and Modules 7–9 Q5, Q23, Q30, Q33. Those four are page fragments ("Place the options in the following order:", "Question as presented:") with no question or choices.
- **Case variants:** Final Q122 (7 cases) and Q131 (2) become separate questions ("… [Case N]"), like CCNA 1.

**Before going live:**
1. Fix the course route in `static/beta/app.js`: `/^course\/([a-z]+)$/` doesn't match `ccna2` (it has a digit), so tapping CCNA 2 on Home goes nowhere. Change it to `[a-z0-9]+`.
2. Add the CCNA 2 `EXAM_NAMES` entries (suggested ones are in each report).
3. Optionally add `white-space: pre-line` to `.question-text`.
4. Deploy `data/ccna-2-*.json` + `data/exams.json` with a backup first. No restart is needed for data, but `app.py` caches exam files (`_load_exam_cached`), so restart if unsure.

## Process for each exam
1. **Download the page.** Use a normal browser User-Agent; a plain `curl` works (checked Nov 7, 2026).
2. **Pull out the questions.** Reuse or extend [scraper.py](scraper.py) (`scrape_questions`). Correct answers are marked in red on the page (`has_red_text`).
3. **Handle every question type:**
   - **Multiple choice:** one red answer.
   - **"Choose two/three":** several red answers, stored joined with `|` in `correct_answer`.
   - **Image in the question** (exhibits, diagrams): store the URL in `image`.
   - **Image as an answer choice:** store each choice as a short text label in `options`, plus `"option_images": {"<label>": "<image url>"}`. Decided Nov 7, 2026; first used in CCNA Final Q122.
   - **Matching / ordering questions:** the answer is only a picture (the drag-and-drop result).
     1. Download the picture.
     2. Claude reads it: the items on the left, each answer box and what's in it, and any leftover items.
     3. Store it in the matching format below.
     - Keep the source wording exactly, typos included. The real exam uses the same wording.
     - Watermarks sometimes cover text, so flag any word Claude isn't sure about.
4. **Build the new exam file** in the same format as `data/*.json`.
5. **Compare it with the current file.** Match questions by their text, allowing tiny wording changes. Report:
   - questions in both with the same answers (count only);
   - questions in both with **different** answers (list each one);
   - questions only on the site (new), and only in our file (removed or renamed);
   - matching questions: whether the pairs are identical;
   - images: missing, added or changed.
6. **The owner reviews the report.**
7. **Swap the new file in only after the owner approves.**
   - First back up the live file to `/srv/answrit/prev-<date>-<exam>/`.
   - Then deploy and log it in MIGRATION.md.
   - Question ids should stay the same for questions that didn't change, so users' mastery progress (stored per question id) isn't lost.

## Question format (`data/<exam>.json`)
```json
{ "title": "...", "url": "<ITExamAnswers link>", "questions": [ ... ] }
```
**Multiple choice:**
```json
{ "id": 1, "question": "...", "options": ["a", "b", "c", "d"], "correct_answer": "b",
  "image": "https://... (optional exhibit)" }
```
For several correct answers: `"correct_answer": "a|c"`.

**Matching / ordering:**
```json
{ "id": 130, "question": "Match the problem to the possible solution. (Not all options are used.)",
  "type": "matching", "options": [], "correct_answer": "",
  "terms": ["items that start on the left (include leftovers)"],
  "definitions": ["answer box headings, in the order the exam shows them"],
  "correct_pairs": { "<term>": "<definition>" } }
```
- **Leftover items** ("Not all options are used") go in `terms` but not in `correct_pairs`.
- **Several items in one box** (e.g. "Required steps to configure SSH:"): put the box's heading in `definitions` once, and map each item to it in `correct_pairs`. The site gives the box one slot per item.
- **Ordering questions** use `definitions: ["Step 1", "Step 2", ...]`.

## Decisions so far
- **Nov 7, 2026: reading matching pictures works.** Q34 and Q57 of this exam came out identical to the owner's hand-typed questions 128 and 130. The demo is at https://claude.ai/artifact/NPWzVEZ4fEYSmkqntnhcai
- **Matching questions on the site look like the real exam's drag-and-drop:**
  - items on the left, boxes on the right;
  - tap an item, then tap a box;
  - **items are shuffled every time** so their order never gives the answer away (done in the preview, `static/beta/app.js`, v=5).
- **Still open:** should multiple-choice answer options also be shuffled? The real exam shuffles them. Ask the owner.

## Exams to rebuild
All 10 are rebuilt and waiting for the owner's approval (see Results). The source links are in `data/exams.json`.

**Tools:**
- `rebuild/survey_page.py` lists each page's questions and flags picture answers.
- `rebuild/compare_exam.py` builds and compares an exam.

## Log
- **2026-11-07:**
  - Wrote this plan.
  - Confirmed that ITExamAnswers can be downloaded and that the matching pictures can be read.
  - Confirmed that all local exam files match the live server.
  - Test run on ITE 1–9 passed (details under Results). Added `rebuild/compare_exam.py`.
  - Rebuilt the other 9 exams:
    - 4 helper agents read 73 answer pictures;
    - reports are in `rebuild/reports/`;
    - the review page was published.
  - Found and fixed: a wrong boot-sequence answer (ITE 10–14 #151), two answers given away by " *", and 36 questions that were missing from the current exams.
  - **Went live** after the owner approved: deployed all 10 rebuilt exams plus the `app.py` option_images change, with a backup first. Verified 100% scoring on every exam.
- **2026-11-08:** Built all 6 CCNA 2 exams (513 questions, 25 matching read from pictures) with the new `rebuild/build_page.py`. Tested locally; **not live**. Two site answers were wrong and were decided by Claude (DHCP purposes, spanning-tree features); one is uncertain (static vs dynamic routing). See "CCNA 2" under Results.
