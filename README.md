# LifeSaver AI — The Last-Minute Life Saver

An AI-powered productivity companion built for **Vibe2Ship (Coding Ninjas x Google for Developers)**, addressing the *"Last-Minute Life Saver"* problem statement: helping students, professionals, and entrepreneurs stop missing deadlines, assignments, meetings, and commitments — by moving beyond passive reminders into proactive, agentic assistance.

![Status](https://img.shields.io/badge/status-ready--to--deploy-brightgreen)
![Platform](https://img.shields.io/badge/platform-Google%20Cloud-4285F4)
![No Docker](https://img.shields.io/badge/deployment-no%20docker-success)

---

## What it does

Most productivity tools nag you with reminders you swipe away. LifeSaver AI is different — it's a proactive agent that:

- **Watches your deadlines continuously.** A background agent sweeps every 15 minutes, and pushes real-time nudges over WebSockets the moment a task becomes urgent, critical, or overdue — no app refresh needed.
- **Thinks in the Eisenhower Matrix.** Every task is scored 1–100 by Gemini and bucketed into *Do Now / Schedule / Delegate / Reconsider*, with a one-line reason so you understand the "why," not just the "what."
- **Builds your day, not just your list.** One click generates a time-blocked schedule (deep work, admin, breaks) based on task complexity and estimated effort.
- **Talks like a teammate.** A Gemini-powered chat agent answers "what should I work on right now?" using your live task list as context — not generic advice.
- **Tracks habits alongside tasks.** Streaks, weekly dot-grids, and completion history live next to your deadlines, because productivity isn't just about due dates.
- **Connects to Google Calendar.** OAuth-linked calendar events surface on the dashboard and can be pushed back out as reminders with built-in popup/email alerts.
- **Learns from your patterns.** An insights view analyzes completion rate, your best time of day, and trend direction (improving/declining/stable) from real task and habit history.

---

## Why it solves the brief

| Brief requirement | How it's addressed |
|---|---|
| Move beyond passive reminders | Proactive cron-based agent + real-time push nudges via Socket.IO, not just a list sitting in an app |
| Intelligent task prioritization | Gemini scores every task (urgency × importance) and explains its reasoning |
| AI-powered scheduling assistance | One-click AI schedule generator producing time blocks |
| Personalized productivity recommendations | Insights engine analyzes history and surfaces a productivity score, trend, and recommendations |
| Context-aware reminders | Nudge urgency and cooldown periods are computed per task based on real time-to-deadline |
| Calendar integration | Native Google Calendar OAuth, read + write |
| Goal and habit tracking | Dedicated habit tracker with streaks and a 7-day visual grid |
| Voice-enabled assistance | Backend endpoint scaffolded for Google Cloud Speech-to-Text |
| Autonomous task planning and execution | Agent auto-reprioritizes the task list whenever it detects recent changes, without being asked |

---

## Architecture

```
┌─────────────────────┐        WebSocket (real-time nudges)        ┌──────────────────────┐
│  React Frontend      │ ◄──────────────────────────────────────── │  Node/Express Backend │
│  (Firebase Hosting)  │ ────────────────────────────────────────► │  (App Engine)         │
└─────────────────────┘            REST API (/api/*)               └──────────────────────┘
                                                                              │
                  ┌───────────────────────────────────────────────────────────┼──────────────────────┐
                  ▼                              ▼                            ▼                       ▼
          ┌───────────────┐           ┌────────────────────┐       ┌──────────────────┐     ┌──────────────────┐
          │  Cloud         │           │  Gemini API         │       │  Google Calendar  │     │  node-cron        │
          │  Firestore     │           │  (gemini-1.5-pro/   │       │  API (OAuth 2.0)  │     │  Proactive Agent  │
          │  (task/habit   │           │   flash)             │       │                   │     │  (15-min sweep)   │
          │  storage)      │           └────────────────────┘       └──────────────────┘     └──────────────────┘
          └───────────────┘
```

### Google technologies used

- **Gemini API** (`gemini-1.5-pro` for chat, `gemini-1.5-flash` for fast prioritization/scheduling/analytics) — the reasoning core of the agent
- **Cloud Firestore** — serverless NoSQL store for tasks, habits, chat history, and nudge logs
- **Google App Engine** — backend hosting, autoscaling, zero server management, **no Docker required**
- **Firebase Hosting** — frontend hosting with global CDN
- **Google Calendar API** (OAuth 2.0) — read upcoming events, write reminders back
- **Google Cloud Speech-to-Text** (scaffolded) — voice-enabled assistance endpoint ready for wiring

---

## Project structure

```
lastminute-lifesaver/
├── backend/                    # Node.js + Express API
│   ├── agents/
│   │   └── proactiveAgent.js   # Cron-driven deadline sweep + nudge generation
│   ├── routes/
│   │   ├── tasks.js            # CRUD + AI prioritize/schedule endpoints
│   │   ├── agent.js            # Chat + voice + insights endpoints
│   │   ├── calendar.js         # Google Calendar OAuth + events
│   │   ├── habits.js           # Habit CRUD + streak logic
│   │   └── insights.js         # Productivity analytics
│   ├── services/
│   │   ├── gemini.js           # All Gemini API calls (chat, prioritize, schedule, analyze)
│   │   └── firebase.js         # Firestore client (+ in-memory fallback for local dev)
│   ├── server.js               # Express app, Socket.IO, cron scheduler
│   ├── app.yaml                # App Engine deployment config (no Docker)
│   ├── package.json
│   └── .env.example
├── frontend/                   # React SPA
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js              # Full application (dashboard, tasks, schedule, habits, calendar, insights, chat)
│   │   ├── styles/main.css     # Complete design system
│   │   ├── utils/api.js        # REST API client
│   │   └── index.js
│   ├── firebase.json           # Firebase Hosting config
│   ├── package.json
│   └── .env.example
├── firestore.rules
└── deployment/
    └── deploy.sh                # One-shot deploy script
```

---

## Local development

### Prerequisites
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier available)
- (Optional) A Google Cloud project for Firestore + Calendar OAuth — the backend falls back to an in-memory store if Firestore credentials aren't present, so you can run the whole app locally without any Google Cloud setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY at minimum
npm start
```

Backend runs on `http://localhost:8080`. Check `http://localhost:8080/health`.

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000` and proxies API calls to the backend automatically (see `proxy` in `package.json`).

---

## Deploying to Google Cloud (no Docker)

Both pieces deploy as **source-based, buildpack-driven** services — App Engine Standard builds your Node.js source directly, and Firebase Hosting serves a static React build. No `Dockerfile`, no container registry, no Cloud Run config needed.

### Option A — One command

```bash
cd deployment
./deploy.sh
```

This script will prompt for your GCP project ID and API keys, then:
1. Enable required APIs (App Engine, Firestore, Generative Language, Calendar)
2. Initialize App Engine and Firestore (idempotent — safe to re-run)
3. Deploy the backend with `gcloud app deploy`
4. Build the frontend and deploy with `firebase deploy --only hosting`
5. Print both live URLs

### Option B — Manual steps

**Backend:**
```bash
cd backend
npm install
gcloud app deploy app.yaml \
  --set-env-vars="GEMINI_API_KEY=YOUR_KEY,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,FRONTEND_URL=https://YOUR_PROJECT_ID.web.app"
```

**Frontend:**
```bash
cd frontend
npm install
echo "REACT_APP_API_URL=https://YOUR_PROJECT_ID.appspot.com" > .env.production
npm run build
firebase deploy --only hosting
```

See [`deployment/SETUP_GUIDE.md`](deployment/SETUP_GUIDE.md) for the full walkthrough including Calendar OAuth setup, Gemini key creation, and Firestore initialization.

---

## Evaluation criteria mapping

| Criteria | Weight | Where it shows up |
|---|---|---|
| Problem solving & impact | 20% | Directly targets missed deadlines with proactive (not passive) intervention |
| Agentic depth | 20% | Background cron agent reasons autonomously, decides nudge urgency/cooldowns, and self-reprioritizes without user prompting |
| Innovation & creativity | 20% | Real-time WebSocket nudges + Eisenhower-matrix AI reasoning + habit/task fusion, rather than a generic to-do list |
| Usage of Google technologies | 15% | Gemini, Firestore, App Engine, Firebase Hosting, Calendar API, Speech-to-Text scaffold |
| Product experience & design | 10% | Custom design system (navy/electric-blue palette, Sora display type), responsive layout, live toasts |
| Technical implementation | 10% | Clean service-layer separation, Socket.IO real-time layer, graceful in-memory fallback for local dev |
| Completeness & usability | 5% | Full CRUD across tasks/habits/calendar, onboarding-free demo user, deployable end-to-end |

---

## Submission checklist

- [ ] Deploy backend to App Engine, confirm `/health` responds
- [ ] Deploy frontend to Firebase Hosting
- [ ] Add Gemini API key to App Engine environment variables
- [ ] (Optional) Set up Google OAuth credentials for Calendar integration
- [ ] Verify deployed app link is publicly accessible
- [ ] Push code to a public GitHub repository
- [ ] Create the Project Description Google Doc (problem statement, solution overview, key features, technologies used, Google technologies utilized)
- [ ] Share both links per the Vibe2Ship submission requirements
