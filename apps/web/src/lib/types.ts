export interface EventRecord {
  id: number
  source: string
  event_type: string
  title: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EventCreatePayload {
  source: string
  event_type: string
  title: string
  content: string
  metadata: Record<string, unknown>
}

export type EventUpdatePayload = Partial<EventCreatePayload>

export interface EventListParams {
  q?: string
  source?: string
  eventType?: string
}

export interface SemanticSearchResult {
  event: EventRecord
  score: number
}

export interface EventSummary {
  total_events: number
  source_counts: Record<string, number>
  event_type_counts: Record<string, number>
  latest_event_created_at: string | null
}

export interface EventActivityBucket {
  date: string
  total_events: number
}

export interface EventActivity {
  days: number
  buckets: EventActivityBucket[]
}

export interface EventSourceStats {
  source: string
  total_events: number
  event_type_counts: Record<string, number>
  latest_event_created_at: string | null
}

export interface EventExport {
  exported_at: string
  total_events: number
  events: EventRecord[]
}

export interface EventImportPayload {
  events: EventCreatePayload[]
}

export interface EventImportResult {
  imported_events: number
}

export interface MonitorWorkerStatus {
  name: 'clipboard' | 'filesystem'
  running: boolean
  interval_seconds: number | null
  watch_path: string | null
  include_hidden: boolean
  events_created: number
  last_event_id: number | null
  last_checked_at: string | null
  last_error: string | null
  started_at: string | null
  stopped_at: string | null
}

export interface MonitorStatus {
  clipboard: MonitorWorkerStatus
  filesystem: MonitorWorkerStatus
}

export interface ClipboardMonitorStartPayload {
  interval_seconds: number
}

export interface FilesystemMonitorStartPayload {
  path: string
  interval_seconds: number
  include_hidden: boolean
}
