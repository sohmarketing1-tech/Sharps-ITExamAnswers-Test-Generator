# ITExamAnswers Practice Test Generator

A full-stack app that scrapes quiz questions and answers from any `itexamanswers.net` exam page and lets you generate custom-length practice tests.

## What it does

- **Accepts any itexamanswers.net URL** through a web form.
- **Scrapes** the page with BeautifulSoup/Requests.
- **Extracts** the exam title, question text, multiple-choice options, and correct answers (detected via `<li class="correct_answer">`).
- **Saves** clean JSON in `questions.json`.
- **Serves** a polished web UI with a prominent exam title header, setup, quiz, and results screens.

## Project layout

```
quiz-scraper/
├── app.py              # Flask backend
├── scraper.py          # HTML scraper + JSON writer
├── questions.json      # scraped data (generated)
├── requirements.txt    # Python dependencies
├── Dockerfile          # Cloud Run container definition
├── firebase.json       # Firebase Hosting config + Cloud Run rewrites
├── .firebaserc         # Firebase project mapping
├── README.md           # this file
└── static/
    ├── index.html      # frontend
    ├── style.css       # styling
    └── app.js          # quiz logic
```

## Setup

1. Open a terminal in the project folder:

   ```bash
   cd /Users/jonathansharp/CascadeProjects/quiz-scraper
   ```

2. Install Python dependencies:

   ```bash
   python3 -m pip install -r requirements.txt
   ```

3. (Optional) Pre-scrape the default exam:

   ```bash
   python3 scraper.py
   ```

   Or scrape a specific exam:

   ```bash
   python3 scraper.py https://itexamanswers.net/some-other-exam.html
   ```

4. Start the Flask server:

   ```bash
   python3 app.py
   ```

5. Open your browser at `http://localhost:8080`.

## Usage

1. Paste any `itexamanswers.net` exam URL into the **Exam URL** field and click **Scrape Questions**.
2. The exam title appears in the page header (e.g., "IT Essentials 7.0 8.0 Final Exam (Chapters 1-9) Answers Full").
3. Enter how many questions you want and click **Start Test**.
4. Answer each question. Multi-answer questions use checkboxes; single-answer questions use radio buttons.
5. Click **Submit Test** to see your score and review every answer.

Click **Re-scrape Current** to refresh the currently loaded exam.

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve the frontend |
| `/api/state` | GET | Return current exam title, URL, and question count |
| `/api/questions` | GET | Return all scraped questions + metadata |
| `/api/scrape` | POST | Scrape a new URL and load it into the app |
| `/api/test?n=20` | GET | Return `n` random questions |
| `/api/score` | POST | Submit answers and receive scored results |
| `/api/refresh` | POST | Re-scrape the current URL |

## Notes on scraping flexibility

The scraper is designed to tolerate common variations across itexamanswers.net pages:

- Questions may appear inside `<p>`, `<strong>`, `<b>`, `<li>`, or `<div>` tags.
- Correct answers are detected by the `correct_answer` CSS class, not by exact text matching.
- Case variants (e.g. "Case 2:", "Case 3:") are split into separate questions.
- Multi-select questions are supported and correct answers are joined with `|`.
- Explanation/topic noise is filtered out during parsing.

## Troubleshooting

- **No questions loaded**: Paste an itexamanswers.net URL and click **Scrape Questions**, or run `python3 scraper.py` first.
- **Scrape fails**: The target site may block automated requests. Try adding a delay or rotating the User-Agent in `scraper.py`.
- **Port 8080 in use**: set `PORT=3000 python3 app.py` or edit `app.py`.

## Deploying to Firebase + Google Cloud Run

Firebase Hosting only serves static files, so the Python Flask backend needs to run on **Cloud Run**. Firebase Hosting can then proxy API requests to Cloud Run via `firebase.json` rewrites.

### Prerequisites

- A Firebase project (create one at [firebase.google.com](https://firebase.google.com)).
- The [Firebase CLI](https://firebase.google.com/docs/cli#install_the_firebase_cli) installed and logged in (`firebase login`).
- The [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`).
- Billing enabled in Google Cloud (Cloud Run has a generous free tier).

### 1. Set your Firebase project ID

Edit `.firebaserc`:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### 2. Build and deploy the Flask backend to Cloud Run

```bash
# Build the container image
export PROJECT_ID=your-firebase-project-id
gcloud builds submit --tag gcr.io/$PROJECT_ID/quiz-scraper-api

# Deploy to Cloud Run
gcloud run deploy quiz-scraper-api \
  --image gcr.io/$PROJECT_ID/quiz-scraper-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PORT=8080 \
  --memory 512Mi \
  --timeout 300
```

Note: Scraping can take a while, so set `--timeout 300` (5 minutes) to avoid timeouts.

### 3. Deploy the frontend to Firebase Hosting

The included `firebase.json` serves the `static/` folder and rewrites `/api/**` requests to the Cloud Run service named `quiz-scraper-api`.

```bash
firebase deploy --only hosting
```

Your site will be live at `https://your-firebase-project-id.web.app`.

### Important deployment notes

- **Ephemeral storage**: Cloud Run containers are stateless. The `questions.json` file is bundled in the image at deploy time, but any new scrapes update the in-memory state and the local file in the container. If the container restarts, it reverts to the bundled `questions.json`. For a shared, persistent state across instances, store scraped data in Firestore or Cloud Storage instead.
- **Scraping reliability**: Cloud Run/Functions make outbound requests from Google IPs. `itexamanswers.net` may rate-limit or block these IPs. If scraping fails in production, consider using a proxy service or scraping locally and uploading the resulting `questions.json` as part of the deploy.
- **Free tier limits**: Cloud Run free tier includes 2 million requests/month and 360,000 GB-seconds of memory. Firebase Hosting has a generous free CDN tier. Keep an eye on usage if the app gets popular.
- **CORS**: If you deploy the backend separately without Firebase rewrites, configure CORS in `app.py` for your Firebase Hosting domain.

## Alternative hosting options

If you want a simpler, Python-native host without Firebase, consider:

- [Render](https://render.com)
- [Railway](https://railway.app)
- [Fly.io](https://fly.io)
- [PythonAnywhere](https://www.pythonanywhere.com)
- [Heroku](https://www.heroku.com)

These platforms let you deploy the Flask app as-is, often just by connecting your GitHub repo.
