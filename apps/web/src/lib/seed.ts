import type { CaptureEvent, SourceStatus } from "./types";

const t = Date.now();
const ago = (ms: number) => new Date(t - ms);

export const EVENTS: CaptureEvent[] = [
  { id:"e1",  ts:ago(90000),   source:"vscode",     action:"edited",   detail:"Updated src/api/events.ts",         path:"src/api/events.ts" },
  { id:"e2",  ts:ago(210000),  source:"terminal",   action:"ran",      detail:"pytest · 48 passed" },
  { id:"e3",  ts:ago(330000),  source:"git",        action:"commit",   detail:"add event batching · a7f3c2e" },
  { id:"e4",  ts:ago(480000),  source:"browser",    action:"opened",   detail:"FastAPI docs — /redoc" },
  { id:"e5",  ts:ago(660000),  source:"vscode",     action:"searched", detail:"index_event across 14 files" },
  { id:"e6",  ts:ago(900000),  source:"terminal",   action:"ran",      detail:"uvicorn main:app --reload" },
  { id:"e7",  ts:ago(1200000), source:"git",        action:"commit",   detail:"fix: dedup events on insert · 3e9d1f2" },
  { id:"e8",  ts:ago(1500000), source:"filesystem", action:"created",  detail:"backend/migrations/0003_index.sql", path:"backend/migrations/0003_index.sql" },
  { id:"e9",  ts:ago(1800000), source:"vscode",     action:"edited",   detail:"Updated backend/database.py",       path:"backend/database.py" },
  { id:"e10", ts:ago(2400000), source:"browser",    action:"opened",   detail:"github.com/Amirjon06/GhostMirror" },
];

export const SOURCES: SourceStatus[] = [
  { id:"vscode",     label:"VS Code",    state:"streaming", count:812, lastSeen:ago(90000)   },
  { id:"terminal",   label:"Terminal",   state:"streaming", count:286, lastSeen:ago(210000)  },
  { id:"git",        label:"Git",        state:"watching",  count:144, lastSeen:ago(330000)  },
  { id:"browser",    label:"Browser",    state:"idle",      count:42,  lastSeen:ago(480000)  },
  { id:"filesystem", label:"Filesystem", state:"watching",  count:58,  lastSeen:ago(1500000) },
];