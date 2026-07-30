# GhostMirror

A local dashboard that captures your development activity in real time — file edits, terminal commands, git commits, and browser tabs — and gives you a searchable timeline of everything you did.

No cloud. No accounts. Everything stays on your machine.

---

## What it does

- Captures events from VS Code, terminal, git, and your browser
- Shows a live feed of recent activity
- Lets you search through your history
- Tracks which sources are active and how much data is stored locally

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Backend | Python + FastAPI |
| Database | SQLite |
| Styling | Tailwind CSS |

---

## Running it locally

**Requirements:** Node.js, Python 3.11+

**Frontend**
```bash
cd apps/web
npm install
npm run dev
```
Opens at `http://localhost:5173`

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## Project structure

```
apps/web/     → React dashboard
backend/      → FastAPI + SQLite event API
docs/         → notes and planning
```
