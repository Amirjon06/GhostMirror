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

export interface EventSummary {
  total_events: number
  source_counts: Record<string, number>
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
