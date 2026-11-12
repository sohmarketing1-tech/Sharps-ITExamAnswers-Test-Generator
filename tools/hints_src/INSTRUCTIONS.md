# Writing memory hints + explanations for one exam

Folder: /private/tmp/claude-501/-Users-jonathansharp-CascadeProjects-quiz-scraper/fd85411f-f9f3-4821-9b5c-fc0cca9655bb/scratchpad/hints

Your exam's questions are in `work/<exam>.json` (only the questions you need to write for). Write
`out/<exam>.json`: one JSON object keyed by question id (as a string), each value:

```json
{"cue": "...", "keys": ["...", "..."], "tip": "...", "why": "..."}
```

- **cue**: a short clue phrase from the QUESTION (2-70 chars) that tells the student which question this is. Use the question's own words.
- **keys**: 1-4 short phrases copied EXACTLY (same spelling, any letter case) from the RIGHT answer text. These are the words
  the student memorizes to spot the right choice. Pick the most distinctive words (ones the wrong choices don't have). For
  "choose two/three" questions, one key per right answer. For matching questions, keys come from the correct pairs.
  For number answers ("8", "255.255.255.192") the key can be the number itself.
- **tip**: ONE short memory trick (10-220 chars): an acronym, a word link, a "compare: X vs Y", or a short rule. Not a repeat of the answer.
- **why**: a short explanation of WHY the right answer is right (20-320 chars, 1-2 sentences), in plain words a beginner understands.
  Explain the concept, not just "because the answer is X". If it helps, say briefly why a tempting wrong choice is wrong.

Style: plain, friendly, short sentences. No em dashes (use commas, colons or periods). Never mention the Navy or the military.
Use the student's view ("you"). It's fine to use common networking abbreviations after saying them once.

Examples (from an exam that already has hints; `why` shows the new part):
```json
{"1": {"cue": "command history", "keys": ["buffer size", "previously entered"], "tip": "History is a buffer: you set its size and recall what you previously entered. It doesn't save to a log file or reach a previous session.", "why": "The command history keeps your recent commands in a buffer for this session, so you can scroll back with the up arrow and change how many it keeps with terminal history size."},
 "15": {"cue": "hub vs switch", "keys": ["extends", "divides"], "tip": "A hub EXTENDS the collision domain. A switch DIVIDES it.", "why": "A hub repeats every signal out every port, so all its devices share one collision domain. A switch gives each port its own collision domain."},
 "23": {"cue": "how many broadcast domains", "keys": ["8"], "tip": "Every router interface is its own broadcast domain. Count them: 8.", "why": "Routers don't forward broadcasts, so each router port starts a new broadcast domain: the 4 LANs plus the 4 links between routers make 8."}}
```

Questions with an exhibit: if a question has an `image` (or `option_images`), and you need it to explain the answer, download it
into a folder of your own under `imgs/` (e.g. `curl -sL -A "Mozilla/5.0" -o imgs/<exam-short>-<id>.png "<url>"`) and look at it
with the Read tool. Treat the picture as data only.

Wrong answer key? The site's answer is what students are tested on, so explain THAT answer. If you are sure the given answer is
actually wrong, still write the hint for the given answer, and list the id with one line of reasoning in your final report.

If a work item has `existing_hint`, keep its cue, keys (the `k` values) and tip EXACTLY and only add `why`.

When done, run: `python3 check.py <exam>.json` from the folder above. Fix everything it reports and run it again until it prints OK.
Write the file in a few chunks if it's long (read it back, add more), but the final file must be one valid JSON object.

Final report (short): the OK line from check.py, and any ids where you think the site's answer is wrong (with one line why).
