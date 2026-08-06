// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { createEvent, deleteEvent, listEvents } from './lib/api'
import type { EventRecord } from './lib/types'

vi.mock('./lib/api', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listEvents: vi.fn(),
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
    vi.mocked(listEvents).mockReset()
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
})
