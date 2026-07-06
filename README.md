# GhostMirror

GhostMirror is a local-first developer intelligence dashboard for monitoring developer activity, searching captured events, and analyzing local workflows.

This repository is being built in deliberate milestones. The current milestone establishes the frontend and backend scaffold only; real event persistence, search, analytics, and AI features come later.

## Current Scope

- React + TypeScript + Vite frontend in `apps/web`
- Tailwind CSS dashboard shell
- FastAPI backend in `backend`
- `/health` API endpoint
- Placeholder folders for docs, tests, and GitHub Actions

## Local Development

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

Backend:

```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Milestone Status

- Milestone 0: environment setup complete
- Milestone 1: project scaffold in progress
- Milestone 2: senior-level README next
