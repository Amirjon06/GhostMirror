import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEvent, deleteEvent, getEventSummary, listEvents } from './api'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
    ...init,
  })
}

describe('event API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists events without query parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    const events = await listEvents()

    expect(events).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('lists events with search and filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    await listEvents({
      q: 'sql query',
      source: 'clipboard',
      eventType: 'snippet',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events?q=sql+query&source=clipboard&event_type=snippet',
      expect.any(Object),
    )
  })

  it('creates events with a JSON body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 1,
        source: 'manual',
        event_type: 'note',
        title: 'Manual note',
        content: 'Test content',
        metadata: {},
        created_at: '2026-08-06T00:00:00Z',
        updated_at: '2026-08-06T00:00:00Z',
      }),
    )

    await createEvent({
      source: 'manual',
      event_type: 'note',
      title: 'Manual note',
      content: 'Test content',
      metadata: {},
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          source: 'manual',
          event_type: 'note',
          title: 'Manual note',
          content: 'Test content',
          metadata: {},
        }),
      }),
    )
  })

  it('gets event summary statistics', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        total_events: 2,
        source_counts: { clipboard: 1, filesystem: 1 },
        event_type_counts: { file_snapshot: 1, snippet: 1 },
        latest_event_created_at: '2026-08-06T12:05:00Z',
      }),
    )

    const summary = await getEventSummary()

    expect(summary.total_events).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/stats/summary',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('deletes events with the event id path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))

    await deleteEvent(42)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/42',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws response text when a request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('API unavailable', { status: 503 }))

    await expect(listEvents()).rejects.toThrow('API unavailable')
  })
})
