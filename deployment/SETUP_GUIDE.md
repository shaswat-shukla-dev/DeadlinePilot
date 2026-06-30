# Setup guide — Google Cloud deployment (no Docker)

This walks through every manual step needed to get LifeSaver AI fully live, including the parts the deploy script automates.

## 1. Create a Google Cloud project

```bash
gcloud projects create YOUR_PROJECT_ID --name="LifeSaver AI"
gcloud config set project YOUR_PROJECT_ID
```

Link a billing account in the Cloud Console (App Engine and Firestore have generous free tiers, but billing must be enabled).

## 2. Enable required APIs

```bash
gcloud services enable \
  appengine.googleapis.com \
  firestore.googleapis.com \
  generativelanguage.googleapis.com \
  calendar-json.googleapis.com \
  cloudbuild.googleapis.com
```

## 3. Get a Gemini API key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **Create API key**, select your Google Cloud project
3. Copy the key — you'll pass it as `GEMINI_API_KEY`

## 4. Initialize App Engine

App Engine requires a region to be picked once per project, permanently:

```bash
gcloud app create --region=us-central
```

## 5. Initialize Firestore

```bash
gcloud firestore databases create --location=us-central --type=firestore-native
```

## 6. (Optional) Set up Google Calendar OAuth

Only needed if you want the Calendar tab to connect to a real Google Calendar.

1. Go to [Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs — add both:
   - `http://localhost:8080/api/calendar/callback` (local dev)
   - `https://YOUR_PROJECT_ID.appspot.com/api/calendar/callback` (production)
5. Copy the **Client ID** and **Client Secret**

If you skip this step, the app still works fully — the Calendar tab will simply show a "Connect Google Calendar" prompt that doesn't do anything until OAuth is configured.

## 7. Deploy the backend (App Engine, no Docker)

App Engine Standard's Node.js runtime builds your app directly from source using buildpacks — there's no `Dockerfile` anywhere in this repo and none is needed.

```bash
cd backend
npm install

gcloud app deploy app.yaml --set-env-vars="\
GEMINI_API_KEY=YOUR_GEMINI_KEY,\
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,\
GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID,\
GOOGLE_CLIENT_SECRET=YOUR_OAUTH_CLIENT_SECRET,\
GOOGLE_REDIRECT_URI=https://YOUR_PROJECT_ID.appspot.com/api/calendar/callback,\
FRONTEND_URL=https://YOUR_PROJECT_ID.web.app"
```

This takes 2-5 minutes. When it finishes, note the URL — it's `https://YOUR_PROJECT_ID.appspot.com`.

Verify it's live:
```bash
curl https://YOUR_PROJECT_ID.appspot.com/health
# {"status":"ok","timestamp":"..."}
```

## 8. Deploy the frontend (Firebase Hosting)

```bash
npm install -g firebase-tools   # if not already installed
firebase login

cd frontend
npm install

echo "REACT_APP_API_URL=https://YOUR_PROJECT_ID.appspot.com" > .env.production
npm run build

firebase use YOUR_PROJECT_ID --add
firebase deploy --only hosting
```

Your app is now live at `https://YOUR_PROJECT_ID.web.app`.

## 9. Smoke test

1. Open `https://YOUR_PROJECT_ID.web.app`
2. Add a task with a due date a few hours from now
3. Click **AI Prioritize** — within a few seconds it should get a priority score and Eisenhower quadrant
4. Open the **AI Agent** tab and ask "what should I work on right now?" — it should reference your actual task
5. Wait up to 15 minutes (or check back later) — if the task becomes urgent, a real-time nudge toast should appear automatically

## 10. Updating environment variables after deploy

You don't need to redeploy code to change env vars — but App Engine does require a new version deploy to pick them up:

```bash
gcloud app deploy app.yaml --set-env-vars="GEMINI_API_KEY=NEW_KEY,..."
```

Or set them permanently in `backend/app.yaml` under `env_variables` (not recommended for secrets — prefer the CLI flag or Secret Manager for production).

## Troubleshooting

**"Gemini error" responses / chat falls back to generic replies**
Your `GEMINI_API_KEY` isn't set or is invalid. Check `gcloud app describe` env vars, or re-deploy with the correct key.

**Calendar tab shows "not connected" after clicking Connect**
Double-check the redirect URI in Cloud Console matches exactly (including `https://` and no trailing slash) what's set as `GOOGLE_REDIRECT_URI`.

**Real-time nudges never appear**
The cron sweep runs every 15 minutes server-side — it's not instant. For faster testing, edit the cron schedule in `backend/server.js` from `*/15 * * * *` to `*/1 * * * *` temporarily, then redeploy.

**Firestore permission errors locally**
Run `gcloud auth application-default login` to set up Application Default Credentials for local Firestore access — or just don't set `GOOGLE_CLOUD_PROJECT` locally and let it use the built-in in-memory fallback.
