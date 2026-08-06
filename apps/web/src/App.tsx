import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  FolderGit2,
  Inbox,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { createEvent, deleteEvent, listEvents } from './lib/api'
import type { EventRecord } from './lib/types'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Events', icon: Activity },
  { label: 'Search', icon: FileSearch },
  { label: 'Sources', icon: FolderGit2 },
  { label: 'Storage', icon: Database },
]

const sourceOptions = ['manual', 'clipboard', 'filesystem', 'git', 'editor']
const eventTypeOptions = ['note', 'snippet', 'file_change', 'command', 'commit']
const emptyEvents: EventRecord[] = []

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatMetadata(metadata: EventRecord['metadata']) {
  const entries = Object.entries(metadata)
  if (entries.length === 0) {
    return null
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
}

function App() {
  const queryClient = useQueryClient()
  const [source, setSource] = useState('manual')
  const [eventType, setEventType] = useState('note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')

  const eventListParams = useMemo(
    () => ({
      q: searchTerm.trim() || undefined,
      source: sourceFilter || undefined,
      eventType: eventTypeFilter || undefined,
    }),
    [eventTypeFilter, searchTerm, sourceFilter],
  )

  const eventsQuery = useQuery({
    queryKey: ['events', eventListParams],
    queryFn: () => listEvents(eventListParams),
  })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      setTitle('')
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const events = eventsQuery.data ?? emptyEvents
  const activeSources = useMemo(() => new Set(events.map((event) => event.source)).size, [events])
  const hasEvents = events.length > 0
  const hasActiveSearch = Boolean(eventListParams.q || eventListParams.source || eventListParams.eventType)
  const canCreate = title.trim().length > 0 && content.trim().length > 0 && !createMutation.isPending

  const stats = [
    { label: 'Events shown', value: String(events.length), detail: 'Matching the current event query' },
    { label: 'Sources in view', value: String(activeSources), detail: 'Based on the current result set' },
    { label: 'Search mode', value: 'Keyword', detail: 'Filtering stored events through the local API' },
  ]

  function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canCreate) {
      return
    }

    createMutation.mutate({
      source,
      event_type: eventType,
      title: title.trim(),
      content: content.trim(),
      metadata: {},
    })
  }

  function clearSearchFilters() {
    setSearchTerm('')
    setSourceFilter('')
    setEventTypeFilter('')
  }

  return (
    <main className="min-h-screen bg-[#090b10] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-white/10 bg-[#0d1017]/95 px-5 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <BrainCircuit size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">GhostMirror</p>
              <p className="text-xs text-slate-400">Developer intelligence</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  item.active
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
                href="/"
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <ShieldCheck size={16} className="text-emerald-300" aria-hidden="true" />
              Local-first by default
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Workspace activity stays local by default and is stored only when event capture is enabled.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#090b10]/80 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-4">
              <label className="flex h-10 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-400 transition focus-within:border-cyan-300/40">
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">Search events</span>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search event titles and content..."
                />
              </label>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10"
                type="button"
                aria-label="Notifications"
              >
                <Bell size={18} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="px-4 py-6 md:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0 space-y-6">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111620]">
                  <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 md:p-8">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                        <Sparkles size={14} aria-hidden="true" />
                        Local workspace telemetry
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                        API-backed events
                      </span>
                    </div>
                    <div className="mt-8 max-w-3xl">
                      <h1 className="text-3xl font-semibold tracking-normal text-white md:text-5xl">
                        Real-time developer activity, stored locally.
                      </h1>
                      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                        GhostMirror now reads and writes structured events through the local FastAPI
                        service. Ingestion sources and search build on this event layer.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-px bg-white/10 md:grid-cols-3">
                    {stats.map((stat) => (
                      <div key={stat.label} className="bg-[#111620] p-5">
                        <p className="text-sm text-slate-400">{stat.label}</p>
                        <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{stat.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#111620]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">Recent activity</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {eventsQuery.isError
                          ? 'The event API is unavailable'
                          : hasEvents
                            ? `${events.length} stored event${events.length === 1 ? '' : 's'}`
                            : hasActiveSearch
                              ? 'No events match the current search'
                              : 'No event source is connected'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasActiveSearch ? (
                        <button
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                          type="button"
                          onClick={clearSearchFilters}
                        >
                          <X size={16} aria-hidden="true" />
                          Clear
                        </button>
                      ) : null}
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => void eventsQuery.refetch()}
                        disabled={eventsQuery.isFetching}
                      >
                        <RefreshCw
                          size={16}
                          className={eventsQuery.isFetching ? 'animate-spin' : ''}
                          aria-hidden="true"
                        />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm text-slate-300">
                      Source
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                        value={sourceFilter}
                        onChange={(event) => setSourceFilter(event.target.value)}
                      >
                        <option value="">All sources</option>
                        {sourceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm text-slate-300">
                      Type
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                        value={eventTypeFilter}
                        onChange={(event) => setEventTypeFilter(event.target.value)}
                      >
                        <option value="">All types</option>
                        {eventTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {eventsQuery.isLoading ? (
                    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center text-slate-400">
                      <Loader2 size={26} className="animate-spin text-cyan-200" aria-hidden="true" />
                      <p className="mt-4 text-sm">Loading events from the local API...</p>
                    </div>
                  ) : eventsQuery.isError ? (
                    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-200">
                        <AlertCircle size={22} aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-white">Event API unavailable</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                        Start the backend on port 8000, then refresh this panel.
                      </p>
                    </div>
                  ) : hasEvents ? (
                    <div className="divide-y divide-white/10">
                      {events.map((event) => (
                        <article key={event.id} className="p-5 transition hover:bg-white/[0.03]">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">
                                  {event.source}
                                </span>
                                <span>{event.event_type}</span>
                                <span>{formatDate(event.created_at)}</span>
                              </div>
                              <h3 className="mt-3 text-sm font-semibold text-white">{event.title}</h3>
                              <p className="mt-2 text-sm leading-6 text-slate-400">{event.content}</p>
                              {formatMetadata(event.metadata) ? (
                                <p className="mt-2 text-xs text-slate-500">{formatMetadata(event.metadata)}</p>
                              ) : null}
                            </div>
                            <button
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              aria-label={`Delete ${event.title}`}
                              onClick={() => deleteMutation.mutate(event.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400">
                        <Inbox size={22} aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-white">No events captured yet</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                        {hasActiveSearch
                          ? 'Clear the search or adjust filters to inspect the full event history.'
                          : 'Create a manual event to verify the local event API and database path.'}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-6">
                <form className="rounded-lg border border-white/10 bg-[#111620] p-5" onSubmit={handleCreateEvent}>
                  <div className="flex items-center gap-2">
                    <Plus size={18} className="text-cyan-200" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-white">Create event</h2>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <label className="grid gap-2 text-sm text-slate-300">
                      Source
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                        value={source}
                        onChange={(event) => setSource(event.target.value)}
                      >
                        {sourceOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm text-slate-300">
                      Type
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                        value={eventType}
                        onChange={(event) => setEventType(event.target.value)}
                      >
                        {eventTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm text-slate-300">
                      Title
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="What happened?"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-slate-300">
                      Content
                      <textarea
                        className="min-h-24 resize-none rounded-lg border border-white/10 bg-[#0d1017] px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="Add the event details"
                      />
                    </label>
                  </div>

                  {createMutation.isError ? (
                    <p className="mt-3 text-sm leading-6 text-red-200">Could not create the event.</p>
                  ) : null}

                  <button
                    className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={!canCreate}
                  >
                    {createMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus size={16} aria-hidden="true" />
                    )}
                    Create event
                  </button>
                </form>

                <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">System status</h2>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        eventsQuery.isError
                          ? 'bg-red-300 shadow-[0_0_18px_rgba(252,165,165,0.75)]'
                          : 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.75)]'
                      }`}
                    />
                  </div>
                  <div className="mt-5 space-y-4">
                    {[
                      ['Frontend shell', 'Available'],
                      ['Event API', eventsQuery.isError ? 'Unavailable' : eventsQuery.isLoading ? 'Checking' : 'Available'],
                      ['SQLite storage', eventsQuery.isError ? 'Unknown' : 'Available'],
                    ].map(([item, status]) => (
                      <div key={item} className="flex items-center justify-between gap-4 text-sm">
                        <span className="text-slate-400">{item}</span>
                        <span className={status === 'Available' ? 'text-emerald-300' : 'text-slate-500'}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
                  <div className="flex items-center gap-2">
                    <Clock3 size={18} className="text-cyan-200" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-white">Next capability</h2>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    Full-text search will index stored event titles and content after the dashboard
                    event flow is stable.
                  </p>
                </div>

                {deleteMutation.isSuccess ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Event deleted.
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
