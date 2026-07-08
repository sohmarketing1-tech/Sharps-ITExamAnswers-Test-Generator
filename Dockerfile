# Build the Flask backend into a container for Google Cloud Run.
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and default scraped data
COPY app.py scraper.py ./
COPY questions.json ./
COPY static/ ./static/

# Cloud Run sets PORT automatically; default to 8080 for local testing.
ENV PORT=8080

# Run the Flask app
CMD ["python", "app.py"]
