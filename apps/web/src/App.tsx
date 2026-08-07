import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Eye,
  FileSearch,
  FolderGit2,
  Inbox,
  LayoutDashboard,
  Loader2,
  Upload,
  Plus,
  Save,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { createEvent, deleteEvent, exportEvents, getEventSummary, importEvents, listEvents, updateEvent } from './lib/api'
import type { EventExport, EventImportPayload, EventRecord, EventUpdatePayload } from './lib/types'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Events', icon: Activity },
  { label: 'Search', icon: FileSearch },
  { label: 'Sources', icon: FolderGit2 },
  { label: 'Storage', icon: Database },
]

const sourceOptions = ['manual', 'clipboard', 'filesystem', 'demo', 'git', 'editor']
const eventTypeOptions = ['note', 'snippet', 'file_snapshot', 'file_change', 'command', 'commit']
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

function downloadEventExport(payload: EventExport) {
  const exportedDate = new Date(payload.exported_at).toISOString().slice(0, 10)
  const fileContents = JSON.stringify(payload, null, 2)
  const fileUrl = URL.createObjectURL(new Blob([fileContents], { type: 'application/json' }))
  const link = document.createElement('a')

  link.href = fileUrl
  link.download = `ghostmirror-events-${exportedDate}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(fileUrl)
}

function App() {
  const queryClient = useQueryClient()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [source, setSource] = useState('manual')
  const [eventType, setEventType] = useState('note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [isEditingSelectedEvent, setIsEditingSelectedEvent] = useState(false)
  const [editSource, setEditSource] = useState('')
  const [editEventType, setEditEventType] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [importFileError, setImportFileError] = useState(false)

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

  const summaryQuery = useQuery({
    queryKey: ['event-summary'],
    queryFn: getEventSummary,
  })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async (event) => {
      setSelectedEventId(event.id)
      setTitle('')
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      await queryClient.invalidateQueries({ queryKey: ['event-summary'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      await queryClient.invalidateQueries({ queryKey: ['event-summary'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ eventId, payload }: { eventId: number; payload: EventUpdatePayload }) =>
      updateEvent(eventId, payload),
    onSuccess: async (event) => {
      setSelectedEventId(event.id)
      setIsEditingSelectedEvent(false)
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      await queryClient.invalidateQueries({ queryKey: ['event-summary'] })
    },
  })

  const exportMutation = useMutation({
    mutationFn: exportEvents,
    onSuccess: downloadEventExport,
  })

  const importMutation = useMutation({
    mutationFn: importEvents,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      await queryClient.invalidateQueries({ queryKey: ['event-summary'] })
    },
  })

  const events = eventsQuery.data ?? emptyEvents
  const summary = summaryQuery.data
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null

  useEffect(() => {
    setIsEditingSelectedEvent(false)
  }, [selectedEventId])

  const hasEvents = events.length > 0
  const hasActiveSearch = Boolean(eventListParams.q || eventListParams.source || eventListParams.eventType)
  const canCreate = title.trim().length > 0 && content.trim().length > 0 && !createMutation.isPending
  const canUpdate =
    selectedEvent !== null &&
    editTitle.trim().length > 0 &&
    editContent.trim().length > 0 &&
    !updateMutation.isPending
  const totalEventsValue = summary ? String(summary.total_events) : summaryQuery.isError ? 'Unavailable' : 'Loading'
  const sourcesTrackedValue = summary
    ? String(Object.keys(summary.source_counts ?? {}).length)
    : summaryQuery.isError
      ? 'Unavailable'
      : 'Loading'

  const stats = [
    {
      label: 'Total events',
      value: totalEventsValue,
      detail: 'Stored in the local event database',
    },
    {
      label: 'Sources tracked',
      value: sourcesTrackedValue,
      detail: 'Distinct sources in stored history',
    },
    { label: 'Search mode', value: 'FTS5', detail: 'Indexed title and content search' },
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

  function startEditingEvent(event: EventRecord) {
    setEditSource(event.source)
    setEditEventType(event.event_type)
    setEditTitle(event.title)
    setEditContent(event.content)
    setIsEditingSelectedEvent(true)
  }

  function handleUpdateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEvent || !canUpdate) {
      return
    }

    updateMutation.mutate({
      eventId: selectedEvent.id,
      payload: {
        source: editSource,
        event_type: editEventType,
        title: editTitle.trim(),
        content: editContent.trim(),
      },
    })
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const payload = JSON.parse(await file.text()) as EventImportPayload
      setImportFileError(false)
      importMutation.mutate(payload)
    } catch {
      setImportFileError(true)
    }
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
              <p className="text-xs text-slate-400">Activity dashboard</p>
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
                      <input
                        ref={importInputRef}
                        className="hidden"
                        type="file"
                        accept="application/json,.json"
                        aria-label="Import events file"
                        onChange={(event) => void handleImportFile(event)}
                      />
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        disabled={importMutation.isPending}
                      >
                        {importMutation.isPending ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Upload size={16} aria-hidden="true" />
                        )}
                        Import
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => exportMutation.mutate()}
                        disabled={exportMutation.isPending}
                      >
                        {exportMutation.isPending ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Download size={16} aria-hidden="true" />
                        )}
                        Export
                      </button>
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

                  {exportMutation.isError ? (
                    <div className="border-b border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-100">
                      Could not export events.
                    </div>
                  ) : null}

                  {importMutation.isError || importFileError ? (
                    <div className="border-b border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-100">
                      Could not import events.
                    </div>
                  ) : null}

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
                        <article
                          key={event.id}
                          className={`p-5 transition ${
                            selectedEvent?.id === event.id
                              ? 'bg-cyan-300/[0.06] ring-1 ring-inset ring-cyan-300/20'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
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
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{event.content}</p>
                              {formatMetadata(event.metadata) ? (
                                <p className="mt-2 text-xs text-slate-500">{formatMetadata(event.metadata)}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                                type="button"
                                aria-label={`View ${event.title}`}
                                onClick={() => setSelectedEventId(event.id)}
                              >
                                <Eye size={16} aria-hidden="true" />
                              </button>
                              <button
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                type="button"
                                aria-label={`Delete ${event.title}`}
                                onClick={() => {
                                  if (selectedEventId === event.id) {
                                    setSelectedEventId(null)
                                  }
                                  deleteMutation.mutate(event.id)
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
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
                <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Eye size={18} className="text-cyan-200" aria-hidden="true" />
                      <h2 className="text-base font-semibold text-white">Event detail</h2>
                    </div>
                    {selectedEvent && !isEditingSelectedEvent ? (
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                        type="button"
                        aria-label={`Edit ${selectedEvent.title}`}
                        onClick={() => startEditingEvent(selectedEvent)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  {selectedEvent && isEditingSelectedEvent ? (
                    <form className="mt-5 space-y-4" onSubmit={handleUpdateEvent}>
                      <label className="grid gap-2 text-sm text-slate-300">
                        Source
                        <select
                          className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                          value={editSource}
                          onChange={(event) => setEditSource(event.target.value)}
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
                          value={editEventType}
                          onChange={(event) => setEditEventType(event.target.value)}
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
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          placeholder="Event title"
                        />
                      </label>

                      <label className="grid gap-2 text-sm text-slate-300">
                        Content
                        <textarea
                          className="min-h-28 resize-none rounded-lg border border-white/10 bg-[#0d1017] px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
                          value={editContent}
                          onChange={(event) => setEditContent(event.target.value)}
                          placeholder="Event content"
                        />
                      </label>

                      {updateMutation.isError ? (
                        <p className="text-sm leading-6 text-red-200">Could not update the event.</p>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                          type="button"
                          onClick={() => setIsEditingSelectedEvent(false)}
                        >
                          <X size={16} aria-hidden="true" />
                          Cancel
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                          type="submit"
                          disabled={!canUpdate}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Save size={16} aria-hidden="true" />
                          )}
                          Save
                        </button>
                      </div>
                    </form>
                  ) : selectedEvent ? (
                    <div className="mt-5 space-y-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">
                            {selectedEvent.source}
                          </span>
                          <span>{selectedEvent.event_type}</span>
                          <span>{formatDate(selectedEvent.created_at)}</span>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold leading-6 text-white">{selectedEvent.title}</h3>
                      </div>

                      <div className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-[#0d1017] p-3">
                        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                          {selectedEvent.content}
                        </pre>
                      </div>

                      <dl className="grid gap-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-slate-500">Created</dt>
                          <dd className="text-right text-slate-300">{formatDate(selectedEvent.created_at)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-slate-500">Updated</dt>
                          <dd className="text-right text-slate-300">{formatDate(selectedEvent.updated_at)}</dd>
                        </div>
                      </dl>

                      {formatMetadata(selectedEvent.metadata) ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Metadata</p>
                          <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
                            {formatMetadata(selectedEvent.metadata)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Select an event to inspect its content and metadata.
                    </p>
                  )}
                </div>

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
                    <h2 className="text-base font-semibold text-white">Timeline</h2>
                  </div>
                  {hasEvents ? (
                    <ol className="mt-5 space-y-4">
                      {events.slice(0, 5).map((event) => (
                        <li key={event.id} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3">
                          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-200" />
                          <button
                            className="min-w-0 text-left"
                            type="button"
                            onClick={() => setSelectedEventId(event.id)}
                          >
                            <span className="block truncate text-sm font-medium text-white">{event.title}</span>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {event.source} · {event.event_type} · {formatDate(event.created_at)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-400">
                      Timeline entries appear after events are stored.
                    </p>
                  )}
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
