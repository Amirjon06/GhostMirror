// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createEvent, deleteEvent, exportEvents, getEventSummary, importEvents, listEvents, updateEvent } from './lib/api'
import type { EventRecord, EventSummary } from './lib/types'

vi.mock('./lib/api', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  exportEvents: vi.fn(),
  getEventSummary: vi.fn(),
  importEvents: vi.fn(),
  listEvents: vi.fn(),
  updateEvent: vi.fn(),
}))

const events: EventRecord[] = [
  {
    id: 1,
    source: 'clipboard',
    event_type: 'snippet',
    title: 'Copied SQL query',
    content: 'select * from events;',
    metadata: { language: 'sql' },
    created_at: '2026-08-06T12:00:00Z',
    updated_at: '2026-08-06T12:00:00Z',
  },
  {
    id: 2,
    source: 'filesystem',
    event_type: 'file_snapshot',
    title: 'backend/app/main.py',
    content: 'app = create_app()',
    metadata: { path: '/workspace/backend/app/main.py' },
    created_at: '2026-08-06T12:05:00Z',
    updated_at: '2026-08-06T12:05:00Z',
  },
]

const summary: EventSummary = {
  total_events: 2,
  source_counts: {
    clipboard: 1,
    filesystem: 1,
  },
  event_type_counts: {
    file_snapshot: 1,
    snippet: 1,
  },
  latest_event_created_at: '2026-08-06T12:05:00Z',
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('dashboard', () => {
  beforeEach(() => {
    vi.mocked(createEvent).mockReset()
    vi.mocked(deleteEvent).mockReset()
    vi.mocked(exportEvents).mockReset()
    vi.mocked(getEventSummary).mockReset()
    vi.mocked(importEvents).mockReset()
    vi.mocked(listEvents).mockReset()
    vi.mocked(updateEvent).mockReset()
    vi.mocked(getEventSummary).mockResolvedValue(summary)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an empty state when no events are available', async () => {
    vi.mocked(listEvents).mockResolvedValue([])

    renderDashboard()

    expect(await screen.findByText('No events captured yet')).toBeInTheDocument()
    expect(screen.getByText('Create a manual event to verify the local event API and database path.')).toBeInTheDocument()
  })

  it('renders events and shows the first event in the detail panel', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)

    renderDashboard()

    expect(await screen.findAllByText('Copied SQL query')).toHaveLength(3)
    expect(screen.getByText('Total events')).toBeInTheDocument()
    expect(screen.getByText('Sources tracked')).toBeInTheDocument()
    expect(screen.getAllByText('backend/app/main.py')).toHaveLength(2)
    expect(screen.getAllByText('select * from events;')).toHaveLength(2)
    expect(screen.getAllByText('language: sql')).toHaveLength(2)
  })

  it('passes search and filters to the event API', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)

    renderDashboard()

    await screen.findAllByText('Copied SQL query')

    fireEvent.change(screen.getByPlaceholderText('Search event titles and content...'), {
      target: { value: 'main' },
    })
    fireEvent.change(screen.getAllByLabelText('Source')[0], {
      target: { value: 'filesystem' },
    })
    fireEvent.change(screen.getAllByLabelText('Type')[0], {
      target: { value: 'file_snapshot' },
    })

    await waitFor(() => {
      expect(listEvents).toHaveBeenCalledWith({
        q: 'main',
        source: 'filesystem',
        eventType: 'file_snapshot',
      })
    })
  })

  it('creates a manual event from the form', async () => {
    vi.mocked(listEvents).mockResolvedValue([])
    vi.mocked(createEvent).mockResolvedValue({
      id: 3,
      source: 'manual',
      event_type: 'note',
      title: 'Follow up',
      content: 'Review search behavior',
      metadata: {},
      created_at: '2026-08-06T12:10:00Z',
      updated_at: '2026-08-06T12:10:00Z',
    })

    renderDashboard()

    await screen.findByText('No events captured yet')

    fireEvent.change(screen.getByPlaceholderText('What happened?'), {
      target: { value: 'Follow up' },
    })
    fireEvent.change(screen.getByPlaceholderText('Add the event details'), {
      target: { value: 'Review search behavior' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        {
          source: 'manual',
          event_type: 'note',
          title: 'Follow up',
          content: 'Review search behavior',
          metadata: {},
        },
        expect.any(Object),
      )
    })
  })

  it('updates the selected event from the detail panel', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)
    vi.mocked(updateEvent).mockResolvedValue({
      ...events[0],
      title: 'Updated SQL query',
      content: 'select id from events;',
      updated_at: '2026-08-06T12:20:00Z',
    })

    renderDashboard()

    await screen.findAllByText('Copied SQL query')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Copied SQL query' }))
    fireEvent.change(screen.getByPlaceholderText('Event title'), {
      target: { value: 'Updated SQL query' },
    })
    fireEvent.change(screen.getByPlaceholderText('Event content'), {
      target: { value: 'select id from events;' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(1, {
        source: 'clipboard',
        event_type: 'snippet',
        title: 'Updated SQL query',
        content: 'select id from events;',
      })
    })
  })

  it('exports events from the activity header', async () => {
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:ghostmirror-export'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.mocked(listEvents).mockResolvedValue(events)
    vi.mocked(exportEvents).mockResolvedValue({
      exported_at: '2026-08-07T12:00:00Z',
      total_events: 2,
      events,
    })

    renderDashboard()

    await screen.findAllByText('Copied SQL query')
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    await waitFor(() => {
      expect(exportEvents).toHaveBeenCalled()
      expect(clickMock).toHaveBeenCalled()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:ghostmirror-export')
    })
  })

  it('imports events from a selected JSON file', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)
    vi.mocked(importEvents).mockResolvedValue({ imported_events: 1 })

    renderDashboard()

    await screen.findAllByText('Copied SQL query')

    const file = new File(
      [
        JSON.stringify({
          exported_at: '2026-08-07T12:00:00Z',
          total_events: 1,
          events: [
            {
              id: 99,
              source: 'clipboard',
              event_type: 'snippet',
              title: 'Imported SQL query',
              content: 'select id from events;',
              metadata: { language: 'sql' },
              created_at: '2026-08-06T12:00:00Z',
              updated_at: '2026-08-06T12:00:00Z',
            },
          ],
        }),
      ],
      'ghostmirror-events.json',
      { type: 'application/json' },
    )

    fireEvent.change(screen.getByLabelText('Import events file'), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(importEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          events: [
            expect.objectContaining({
              title: 'Imported SQL query',
            }),
          ],
        }),
        expect.any(Object),
      )
    })
  })
})
