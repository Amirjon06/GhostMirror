// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import {
  createEvent,
  deleteEvent,
  exportEvents,
  getEventActivity,
  getEventSummary,
  importEvents,
  listEventSources,
  listEvents,
  updateEvent,
} from './lib/api'
import type { EventActivity, EventRecord, EventSourceStats, EventSummary } from './lib/types'

vi.mock('./lib/api', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  exportEvents: vi.fn(),
  getEventActivity: vi.fn(),
  getEventSummary: vi.fn(),
  importEvents: vi.fn(),
  listEventSources: vi.fn(),
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

const activity: EventActivity = {
  days: 7,
  buckets: [
    { date: '2026-08-01', total_events: 0 },
    { date: '2026-08-02', total_events: 1 },
    { date: '2026-08-03', total_events: 0 },
    { date: '2026-08-04', total_events: 2 },
    { date: '2026-08-05', total_events: 0 },
    { date: '2026-08-06', total_events: 1 },
    { date: '2026-08-07', total_events: 2 },
  ],
}

const sources: EventSourceStats[] = [
  {
    source: 'clipboard',
    total_events: 1,
    event_type_counts: { snippet: 1 },
    latest_event_created_at: '2026-08-06T12:00:00Z',
  },
  {
    source: 'filesystem',
    total_events: 1,
    event_type_counts: { file_snapshot: 1 },
    latest_event_created_at: '2026-08-06T12:05:00Z',
  },
]

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
    vi.mocked(getEventActivity).mockReset()
    vi.mocked(getEventSummary).mockReset()
    vi.mocked(importEvents).mockReset()
    vi.mocked(listEventSources).mockReset()
    vi.mocked(listEvents).mockReset()
    vi.mocked(updateEvent).mockReset()
    vi.mocked(getEventActivity).mockResolvedValue(activity)
    vi.mocked(getEventSummary).mockResolvedValue(summary)
    vi.mocked(listEventSources).mockResolvedValue(sources)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders an empty state when no events are available', async () => {
    vi.mocked(listEvents).mockResolvedValue([])

    renderDashboard()

    fireEvent.click(screen.getByRole('button', { name: 'Events' }))

    expect(await screen.findByText('No events captured yet')).toBeInTheDocument()
    expect(screen.getByText('Create a manual event to verify the local event API and database path.')).toBeInTheDocument()
  })

  it('renders dashboard overview and separates event detail behind the events view', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)

    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Local activity, organized by source.')).toBeInTheDocument()
    expect(screen.getByText('Total events')).toBeInTheDocument()
    expect(screen.getByText('Sources tracked')).toBeInTheDocument()
    expect(screen.getByText('7-day activity')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Event detail' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Events' }))

    expect(await screen.findByRole('heading', { name: 'Event detail' })).toBeInTheDocument()
    expect(screen.getAllByText('Copied SQL query')).toHaveLength(2)
    expect(screen.getAllByText('backend/app/main.py')).toHaveLength(1)
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

    fireEvent.click(screen.getByRole('button', { name: 'Events' }))

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

    await screen.findByText('Copied SQL query')
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))

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

    await screen.findByText('Copied SQL query')
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))
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

    await screen.findByText('Copied SQL query')
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))

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

  it('opens the notification panel from the bell button', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)

    renderDashboard()

    await screen.findByText('Copied SQL query')
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Latest event')).toBeInTheDocument()
    expect(screen.getAllByText('Event API').length).toBeGreaterThan(0)
  })

  it('toggles the sidebar and color theme controls', async () => {
    vi.mocked(listEvents).mockResolvedValue(events)

    renderDashboard()

    await screen.findByRole('heading', { name: 'Dashboard' })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })
})
