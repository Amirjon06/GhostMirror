export type Source = "vscode" | "terminal" | "git" | "browser" | "filesystem";
export type SourceState = "streaming" | "watching" | "idle" | "offline";

export interface CaptureEvent {
  id: string;
  ts: Date;
  source: Source;
  action: string;
  detail: string;
  path?: string;
}

export interface SourceStatus {
  id: Source;
  label: string;
  state: SourceState;
  count: number;
  lastSeen: Date;
}