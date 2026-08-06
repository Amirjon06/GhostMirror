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

export interface EventListParams {
  q?: string
  source?: string
  eventType?: string
}
