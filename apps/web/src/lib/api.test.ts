import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createEvent,
  deleteEvent,
  exportEvents,
  getEventActivity,
  getEventSummary,
  importEvents,
  listEventSources,
  listEvents,
  getMonitorStatus,
  startClipboardMonitor,
  startFilesystemMonitor,
  stopClipboardMonitor,
  stopFilesystemMonitor,
  updateEvent,
} from './api'

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

  it('gets event activity statistics', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        days: 7,
        buckets: [{ date: '2026-08-07', total_events: 2 }],
      }),
    )

    const activity = await getEventActivity(7)

    expect(activity.buckets[0].total_events).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/stats/activity?days=7',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('lists source statistics', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        {
          source: 'clipboard',
          total_events: 2,
          event_type_counts: { snippet: 2 },
          latest_event_created_at: '2026-08-07T12:00:00Z',
        },
      ]),
    )

    const sources = await listEventSources()

    expect(sources[0].source).toBe('clipboard')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/stats/sources',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('exports events as JSON data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        exported_at: '2026-08-07T12:00:00Z',
        total_events: 1,
        events: [
          {
            id: 1,
            source: 'clipboard',
            event_type: 'snippet',
            title: 'Copied SQL query',
            content: 'select * from events;',
            metadata: {},
            created_at: '2026-08-06T00:00:00Z',
            updated_at: '2026-08-06T00:00:00Z',
          },
        ],
      }),
    )

    const exported = await exportEvents()

    expect(exported.total_events).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/export',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('imports events from JSON data', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ imported_events: 1 }))

    const result = await importEvents({
      events: [
        {
          source: 'clipboard',
          event_type: 'snippet',
          title: 'Imported SQL query',
          content: 'select id from events;',
          metadata: { language: 'sql' },
        },
      ],
    })

    expect(result.imported_events).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/import',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          events: [
            {
              source: 'clipboard',
              event_type: 'snippet',
              title: 'Imported SQL query',
              content: 'select id from events;',
              metadata: { language: 'sql' },
            },
          ],
        }),
      }),
    )
  })

  it('updates events with a JSON body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        id: 1,
        source: 'manual',
        event_type: 'note',
        title: 'Updated note',
        content: 'Updated content',
        metadata: {},
        created_at: '2026-08-06T00:00:00Z',
        updated_at: '2026-08-06T00:01:00Z',
      }),
    )

    await updateEvent(1, {
      title: 'Updated note',
      content: 'Updated content',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/events/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated note',
          content: 'Updated content',
        }),
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

  it('gets monitor status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        clipboard: {
          name: 'clipboard',
          running: false,
          interval_seconds: null,
          watch_path: null,
          include_hidden: false,
          events_created: 0,
          last_event_id: null,
          last_checked_at: null,
          last_error: null,
          started_at: null,
          stopped_at: null,
        },
        filesystem: {
          name: 'filesystem',
          running: false,
          interval_seconds: null,
          watch_path: null,
          include_hidden: false,
          events_created: 0,
          last_event_id: null,
          last_checked_at: null,
          last_error: null,
          started_at: null,
          stopped_at: null,
        },
      }),
    )

    const status = await getMonitorStatus()

    expect(status.clipboard.running).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/monitors/status',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('starts and stops clipboard monitoring', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))

    await startClipboardMonitor({ interval_seconds: 1 })
    await stopClipboardMonitor()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8000/monitors/clipboard/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ interval_seconds: 1 }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8000/monitors/clipboard/stop',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('starts and stops filesystem monitoring', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))

    await startFilesystemMonitor({
      path: '/workspace/project',
      interval_seconds: 5,
      include_hidden: false,
    })
    await stopFilesystemMonitor()

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8000/monitors/filesystem/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          path: '/workspace/project',
          interval_seconds: 5,
          include_hidden: false,
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8000/monitors/filesystem/stop',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws response text when a request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('API unavailable', { status: 503 }))

    await expect(listEvents()).rejects.toThrow('API unavailable')
  })
})
