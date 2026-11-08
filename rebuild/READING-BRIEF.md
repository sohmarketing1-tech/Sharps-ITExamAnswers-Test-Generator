# Brief: turn ITExamAnswers answer pictures into AnswrIT questions

You're helping rebuild study exams for answrit.net, a practice site for Cisco IT Essentials and CCNA students. ITExamAnswers (itexamanswers.net) publishes exam questions with answers. For some questions the answer is shown **only as a picture**, usually a Cisco drag-and-drop ("matching") question after it was answered correctly. Your job is to read each picture and write the question in our JSON format, exactly.

Accuracy is everything: students memorize these answers for a real exam. Your output will be checked against hand-typed versions where they exist.

## Your input
A task file, a JSON list. Each item has:
- `exam`, `page_number`, `question` (the question text from the page), `kind`;
- `pictures`: local `path` plus original `url`. Open each `path` with your Read tool to see the image;
- `page_text_around_question`: the page text from this question to the next one. It may hold answer choices, an explanation, or a text version of the answer. **Use it to cross-check, but the picture wins** if they disagree, and say so in `notes`.

## What the pictures look like
- **Matching / drag-and-drop:** the left column shows the items still unplaced; these are leftovers, which "Not all options are used" questions have. The right column shows boxes, each with a heading (the target) and below it one or more filled slots (green, with a check mark) holding the item that belongs there. The heading may be a category, a step ("Step 1"), a description, and so on.
- Watermark text ("itexamanswers.net") sometimes overlaps the text. Read carefully, and flag anything uncertain.
- **Some questions have two pictures:** an *exhibit* (a network diagram or screenshot that's part of the question) and the *answer* picture. Tell them apart.
- **Some aren't matching at all:** an ordering question, a multiple-choice question whose answer choices are pictures (e.g. connectors), or a question where the answer is a picture of a marked choice. Handle them as described below.

## Output
Write **one JSON file**: a list with one object per task item, in the same order, to the output path you were given. Each object is one of these.

### A) Matching (including ordering and "categorize" questions)
```json
{
  "exam": "<copy>", "page_number": <copy>, "answer_picture": "<url of the answer picture>",
  "exhibit": "<url of the exhibit picture, or null>",
  "question": "<question text, copied exactly from the task's `question`>",
  "type": "matching",
  "options": [],
  "terms": ["every draggable item: the placed ones AND the leftovers from the left column"],
  "definitions": ["each box heading, once, in the top-to-bottom order shown"],
  "correct_pairs": { "<item>": "<the box heading it sits under>" },
  "correct_answer": "",
  "notes": "anything uncertain, or 'none'"
}
```
Rules:
- **Copy the wording exactly as shown,** including the site's typos, odd capitalization and trailing periods. Never fix spelling or grammar.
- **`terms` order:** put the leftover (unplaced) items in the position they appear in the left column, and the placed items in the order you meet them reading the boxes top to bottom. Order doesn't affect scoring.
- **Leftover items** go in `terms` but **not** in `correct_pairs`.
- **A box holding several items** (a category): list its heading **once** in `definitions`, and map every item in it to that heading in `correct_pairs`.
- **Ordering questions** ("put in the correct order", "what order…"): use `"definitions": ["Step 1", "Step 2", …]` unless the picture labels the slots differently. If it does, use the picture's labels exactly.
- **If the heading and the slot look swapped** (e.g. the boxes' headings are short terms and the placed items are long descriptions), still follow the picture: the box heading is the definition and the placed item is the term.

### B) Multiple choice (the answer choices are pictures, or the picture just shows which choice is right)
```json
{
  "exam": "<copy>", "page_number": <copy>, "answer_picture": "<url>", "exhibit": "<url or null>",
  "question": "<exact question text>",
  "options": ["choice text, exactly as written"],
  "correct_answer": "<the correct choice text; for several correct choices join them with |>",
  "option_images": { "<choice text>": "<image url>" },
  "notes": "..."
}
```
- Only include `option_images` when the choices themselves are pictures. Then make each choice a short label, such as the connector's name if the picture shows it, or "Image 1", "Image 2" otherwise, and map it to the image URL.
- Take the choice text from `page_text_around_question` when it's there.

### C) Anything else
For example, a question whose answer needs Packet Tracer, or one you can't read. Output `{"exam":…, "page_number":…, "type": "unknown", "question": …, "notes": "<what the picture shows and why it doesn't fit>"}`.

## Finish
- When the file is written, reply with a short summary: how many questions of each kind, and every item with a non-"none" note.
- Don't edit any other file.
- Use `python3 -c "import json; json.load(open('<your output path>'))"` to make sure the file is valid JSON.
