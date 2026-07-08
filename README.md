# ITExamAnswers Practice Test Generator

A static, GitHub Pages-ready practice test app. It loads pre-scraped exam data from JSON files and lets users generate custom-length practice tests entirely in the browser.

## What it does

- **Displays a dropdown** of available exams scraped from `itexamanswers.net`.
- **Generates** random practice tests of any length.
- **Scores** answers and shows a detailed review with correct answers.
- **Runs entirely in the browser** — no backend server needed in production.

## Project layout

```
quiz-scraper/
├── index.html                  # main page (GitHub Pages entry point)
├── app.py                      # Flask backend (optional, for local dev/scraping)
├── scraper.py                  # HTML scraper
├── batch_scrape.py             # scrape multiple exams into data/
├── requirements.txt            # Python dependencies
├── data/                       # pre-scraped exam JSON files
│   ├── exams.json              # manifest of all exams
│   ├── it-essentials-70-80-final-exam-modules-1-9-answers.json
│   ├── it-essentials-70-80-final-exam-modules-10-14-answers.json
│   └── it-essentials-70-80-course-final-exam-answers.json
├── static/
│   ├── style.css               # app styles
│   └── app.js                  # quiz logic (runs in browser)
├── .github/workflows/
│   └── deploy-pages.yml        # auto-deploy to GitHub Pages
├── Dockerfile                  # optional Cloud Run deployment
├── firebase.json               # optional Firebase Hosting config
├── .firebaserc                 # optional Firebase project mapping
└── README.md                   # this file
```

## Included exams

The repo currently includes three scraped IT Essentials 7.0/8.0 exams:

- **Final Exam Modules 1-9** — 127 questions
- **Final Exam Modules 10-14** — 149 questions
- **Course Final Exam** — 338 questions

## Running locally (no install)

The static version only needs a simple HTTP server:

```bash
cd /Users/jonathansharp/CascadeProjects/quiz-scraper
python3 -m http.server 8888
```

Then open `http://localhost:8888`.

## Running locally with Flask

If you want the original Flask backend (for local scraping):

```bash
cd /Users/jonathansharp/CascadeProjects/quiz-scraper
python3 -m pip install -r requirements.txt
python3 app.py
```

Open `http://localhost:8080`.

## Adding more exams

1. Run the scraper for a new URL:

   ```bash
   python3 scraper.py https://itexamanswers.net/your-exam-url.html
   ```

2. Move/rename the generated `questions.json` into `data/` with a descriptive filename.

3. Update `data/exams.json` to add the new exam:

   ```json
   {
     "exams": [
       {
         "title": "Your Exam Title",
         "url": "https://itexamanswers.net/your-exam-url.html",
         "filename": "your-exam-filename.json",
         "count": 123
       }
     ]
   }
   ```

4. Commit and push — GitHub Pages will redeploy automatically.

## Deploying to GitHub Pages (recommended — free & fast)

This repo includes a GitHub Actions workflow that deploys to GitHub Pages on every push to `main`.

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Push this repo to GitHub. The workflow in `.github/workflows/deploy-pages.yml` will deploy it.
4. Your site will be live at:

   ```
   https://sohmarketing1-tech.github.io/Sharps-ITExamAnswers-Test-Generator
   ```

## Notes on scraping flexibility

The scraper is designed to tolerate common variations across itexamanswers.net pages:

- Questions may appear inside `<p>`, `<strong>`, `<b>`, `<li>`, or `<div>` tags.
- Correct answers are detected by the `correct_answer` CSS class or red-colored text spans.
- Case variants (e.g. "Case 2:", "Case 3:") are split into separate questions.
- Multi-select questions are supported and correct answers are joined with `|`.
- Explanation/topic noise is filtered out during parsing.

## Optional: Firebase + Cloud Run

If you prefer Firebase, the included `Dockerfile`, `firebase.json`, and `.firebaserc` can be used to host the Flask backend on Cloud Run and the frontend on Firebase Hosting. See earlier commits for the full Firebase deployment commands.

## Optional: other hosts

- [Render](https://render.com)
- [Railway](https://railway.app)
- [Fly.io](https://fly.io)
- [PythonAnywhere](https://www.pythonanywhere.com)
