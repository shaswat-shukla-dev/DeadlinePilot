#!/bin/bash
# ═══════════════════════════════════════════════════════════
# LifeSaver AI — One-shot Google Cloud deployment
# No Docker required: App Engine (backend) + Firebase Hosting (frontend)
# ═══════════════════════════════════════════════════════════
set -e

echo "════════════════════════════════════════════"
echo "  LifeSaver AI — Deployment to Google Cloud"
echo "════════════════════════════════════════════"

# ── 0. Pre-flight checks ─────────────────────────────────
command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo "firebase CLI not found. Install: npm install -g firebase-tools"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install Node 18+"; exit 1; }

read -p "Enter your Google Cloud Project ID: " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then echo "Project ID is required."; exit 1; fi

gcloud config set project "$PROJECT_ID"

# ── 1. Enable required Google Cloud APIs ────────────────
echo ""
echo "→ Enabling required Google Cloud APIs..."
gcloud services enable \
  appengine.googleapis.com \
  firestore.googleapis.com \
  generativelanguage.googleapis.com \
  calendar-json.googleapis.com \
  cloudbuild.googleapis.com

# ── 2. Initialize App Engine (idempotent) ────────────────
echo ""
echo "→ Initializing App Engine (if not already)..."
gcloud app describe >/dev/null 2>&1 || gcloud app create --region=us-central

# ── 3. Initialize Firestore (idempotent) ─────────────────
echo ""
echo "→ Ensuring Firestore database exists..."
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || \
  gcloud firestore databases create --location=us-central --type=firestore-native

# ── 4. Deploy backend to App Engine ──────────────────────
echo ""
echo "→ Deploying backend to App Engine..."
cd backend
npm install

if [ ! -f .env ]; then
  echo "  ! No .env file found. Copy .env.example to .env and fill in values first."
  echo "  ! Continuing with placeholder env vars — update via Cloud Console after deploy."
fi

read -p "Enter your GEMINI_API_KEY (from https://aistudio.google.com/app/apikey): " GEMINI_KEY
read -p "Enter Google OAuth Client ID (or leave blank to skip Calendar): " OAUTH_CLIENT_ID
read -p "Enter Google OAuth Client Secret (or leave blank): " OAUTH_CLIENT_SECRET

BACKEND_URL="https://${PROJECT_ID}.appspot.com"

gcloud app deploy app.yaml --quiet \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_KEY},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLIENT_ID=${OAUTH_CLIENT_ID},GOOGLE_CLIENT_SECRET=${OAUTH_CLIENT_SECRET},GOOGLE_REDIRECT_URI=${BACKEND_URL}/api/calendar/callback,FRONTEND_URL=https://${PROJECT_ID}.web.app"

echo "✓ Backend deployed: ${BACKEND_URL}"
cd ..

# ── 5. Build and deploy frontend to Firebase Hosting ─────
echo ""
echo "→ Building and deploying frontend to Firebase Hosting..."
cd frontend
npm install

echo "REACT_APP_API_URL=${BACKEND_URL}" > .env.production
npm run build

firebase use "$PROJECT_ID" --add 2>/dev/null || firebase use "$PROJECT_ID"
firebase deploy --only hosting

FRONTEND_URL="https://${PROJECT_ID}.web.app"
cd ..

# ── 6. Done ───────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  Deployment complete!"
echo "════════════════════════════════════════════"
echo "  Frontend:  ${FRONTEND_URL}"
echo "  Backend:   ${BACKEND_URL}"
echo "  Health:    ${BACKEND_URL}/health"
echo ""
echo "Next steps:"
echo "  1. If using Calendar: add ${BACKEND_URL}/api/calendar/callback"
echo "     as an authorized redirect URI in Google Cloud Console > Credentials"
echo "  2. Visit ${FRONTEND_URL} to use the app"
echo "════════════════════════════════════════════"
