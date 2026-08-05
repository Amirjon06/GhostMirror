import type { EventCreatePayload, EventRecord } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function listEvents(): Promise<EventRecord[]> {
  return request<EventRecord[]>('/events')
}

export function createEvent(payload: EventCreatePayload): Promise<EventRecord> {
  return request<EventRecord>('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteEvent(eventId: number): Promise<void> {
  return request<void>(`/events/${eventId}`, {
    method: 'DELETE',
  })
}
