import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  Download,
  Eye,
  FileSearch,
  FolderGit2,
  FolderOpen,
  HardDrive,
  Inbox,
  LayoutDashboard,
  Loader2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Play,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import {
  createEvent,
  deleteEvent,
  exportEvents,
  getEventActivity,
  getEventSummary,
  getMonitorStatus,
  importEvents,
  listEventSources,
  listEvents,
  startClipboardMonitor,
  startFilesystemMonitor,
  stopClipboardMonitor,
  stopFilesystemMonitor,
  updateEvent,
} from './lib/api'
import type { EventExport, EventImportPayload, EventRecord, EventUpdatePayload, MonitorStatus, MonitorWorkerStatus } from './lib/types'

type ActiveView = 'dashboard' | 'events' | 'search' | 'sources' | 'storage'
type ThemeMode = 'dark' | 'light'

const navItems: Array<{ id: ActiveView; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: Activity },
  { id: 'search', label: 'Search', icon: FileSearch },
  { id: 'sources', label: 'Sources', icon: FolderGit2 },
  { id: 'storage', label: 'Storage', icon: Database },
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

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
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
  const contentScrollRef = useRef<HTMLDivElement | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark')
  const [notificationOpen, setNotificationOpen] = useState(false)
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
  const [filesystemMonitorPath, setFilesystemMonitorPath] = useState('')

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

  const activityQuery = useQuery({
    queryKey: ['event-activity', 7],
    queryFn: () => getEventActivity(7),
  })

  const sourcesQuery = useQuery({
    queryKey: ['event-sources'],
    queryFn: listEventSources,
  })

  const monitorQuery = useQuery({
    queryKey: ['monitor-status'],
    queryFn: getMonitorStatus,
    refetchInterval: 5000,
  })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async (event) => {
      setSelectedEventId(event.id)
      setActiveView('events')
      setTitle('')
      setContent('')
      await invalidateEventQueries()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      await invalidateEventQueries()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ eventId, payload }: { eventId: number; payload: EventUpdatePayload }) =>
      updateEvent(eventId, payload),
    onSuccess: async (event) => {
      setSelectedEventId(event.id)
      setIsEditingSelectedEvent(false)
      await invalidateEventQueries()
    },
  })

  const exportMutation = useMutation({
    mutationFn: exportEvents,
    onSuccess: downloadEventExport,
  })

  const importMutation = useMutation({
    mutationFn: importEvents,
    onSuccess: async () => {
      await invalidateEventQueries()
    },
  })

  const startClipboardMonitorMutation = useMutation({
    mutationFn: () => startClipboardMonitor({ interval_seconds: 1 }),
    onSuccess: async () => {
      await invalidateMonitorQueries()
      await invalidateEventQueries()
    },
  })

  const stopClipboardMonitorMutation = useMutation({
    mutationFn: stopClipboardMonitor,
    onSuccess: async () => {
      await invalidateMonitorQueries()
      await invalidateEventQueries()
    },
  })

  const startFilesystemMonitorMutation = useMutation({
    mutationFn: startFilesystemMonitor,
    onSuccess: async () => {
      await invalidateMonitorQueries()
      await invalidateEventQueries()
    },
  })

  const stopFilesystemMonitorMutation = useMutation({
    mutationFn: stopFilesystemMonitor,
    onSuccess: async () => {
      await invalidateMonitorQueries()
      await invalidateEventQueries()
    },
  })

  async function invalidateEventQueries() {
    await queryClient.invalidateQueries({ queryKey: ['events'] })
    await queryClient.invalidateQueries({ queryKey: ['event-summary'] })
    await queryClient.invalidateQueries({ queryKey: ['event-activity'] })
    await queryClient.invalidateQueries({ queryKey: ['event-sources'] })
  }

  async function invalidateMonitorQueries() {
    await queryClient.invalidateQueries({ queryKey: ['monitor-status'] })
  }

  const events = eventsQuery.data ?? emptyEvents
  const summary = summaryQuery.data
  const activityBuckets = activityQuery.data?.buckets ?? []
  const sourceStats = sourcesQuery.data ?? []
  const maxActivityCount = Math.max(...activityBuckets.map((bucket) => bucket.total_events), 0)
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null
  const latestEvent = events[0] ?? null
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
      detail: 'Stored locally in SQLite',
    },
    {
      label: 'Sources tracked',
      value: sourcesTrackedValue,
      detail: 'Distinct event sources',
    },
    { label: 'Search mode', value: 'FTS5', detail: 'Title and content index' },
  ]

  useEffect(() => {
    setIsEditingSelectedEvent(false)
  }, [selectedEventId])

  useEffect(() => {
    const contentScroller = contentScrollRef.current
    if (contentScroller) {
      if (typeof contentScroller.scrollTo === 'function') {
        contentScroller.scrollTo({ top: 0 })
      } else {
        contentScroller.scrollTop = 0
      }
    }

    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [activeView])

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
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

  function handleUpdateEvent(event: FormEvent<HTMLFormElement>) {
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

  function handleHeaderSearchChange(value: string) {
    setSearchTerm(value)
    setActiveView('search')
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
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

  function selectSourceFilter(value: string) {
    setSourceFilter(value)
    setActiveView('search')
  }

  function handleStartFilesystemMonitor() {
    const path = filesystemMonitorPath.trim()
    if (!path || startFilesystemMonitorMutation.isPending) {
      return
    }

    startFilesystemMonitorMutation.mutate({
      path,
      interval_seconds: 5,
      include_hidden: false,
    })
  }

  const eventListSummary = eventsQuery.isError
    ? 'The event API is unavailable'
    : hasEvents
      ? `${events.length} stored event${events.length === 1 ? '' : 's'}`
      : hasActiveSearch
        ? 'No events match the current search'
        : 'No events stored yet'
  const isLightTheme = themeMode === 'light'
  const shellThemeClass = isLightTheme ? 'gm-shell gm-light' : 'gm-shell gm-dark'

  return (
    <main className={`${shellThemeClass} h-screen overflow-hidden bg-[#090b10] text-slate-100`}>
      <div className="flex h-screen overflow-hidden">
        <aside
          className={`hidden h-screen shrink-0 overflow-y-auto border-r border-white/10 bg-[#0d1017]/95 py-6 lg:flex lg:flex-col ${
            sidebarCollapsed ? 'w-24 px-4' : 'w-72 px-5'
          }`}
        >
          <div className={sidebarCollapsed ? 'grid justify-items-center gap-3' : 'flex items-center gap-3'}>
            <LogoMark compact={sidebarCollapsed} />
            <div className={sidebarCollapsed ? 'sr-only' : ''}>
              <p className="text-sm font-semibold text-white">GhostMirror</p>
              <p className="text-xs text-slate-400">Local activity console</p>
            </div>
            <button
              className={`${sidebarCollapsed ? '' : 'ml-auto'} flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100`}
              type="button"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
            </button>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  activeView === item.id
                    ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-inset ring-cyan-300/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                } ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}
                type="button"
                aria-label={sidebarCollapsed ? item.label : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setActiveView(item.id)}
              >
                <item.icon size={18} aria-hidden="true" />
                <span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 grid gap-3">
            {!sidebarCollapsed ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <ShieldCheck size={16} className="text-emerald-300" aria-hidden="true" />
                  Local storage
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Events stay on this machine unless exported manually.
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-10 shrink-0 border-b border-white/10 bg-[#090b10]/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
              <div className="flex items-center gap-3 lg:hidden">
                <LogoMark compact />
                <span className="text-sm font-semibold text-white">GhostMirror</span>
              </div>
              <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-400 transition focus-within:border-cyan-300/40">
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">Search events</span>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  value={searchTerm}
                  onFocus={() => setActiveView('search')}
                  onChange={(event) => handleHeaderSearchChange(event.target.value)}
                  placeholder="Search event titles and content..."
                />
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                  type="button"
                  aria-label={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
                  title={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
                  onClick={() => setThemeMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
                >
                  {isLightTheme ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
                </button>

                <div className="relative">
                  <button
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                    type="button"
                    aria-label="Notifications"
                    aria-expanded={notificationOpen}
                    onClick={() => setNotificationOpen((open) => !open)}
                  >
                    <Bell size={17} aria-hidden="true" />
                    {eventsQuery.isError ? (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-300" />
                    ) : null}
                  </button>
                  {notificationOpen ? (
                    <div className="absolute right-0 top-12 w-80 rounded-lg border border-white/10 bg-[#111620] p-4 shadow-2xl shadow-black/40">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-white">Notifications</h2>
                        <button
                          className="text-slate-500 transition hover:text-slate-200"
                          type="button"
                          aria-label="Close notifications"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-4 space-y-3">
                        <StatusRow
                          label="Event API"
                          value={eventsQuery.isError ? 'Unavailable' : eventsQuery.isLoading ? 'Checking' : 'Available'}
                          healthy={!eventsQuery.isError}
                        />
                        <StatusRow label="SQLite storage" value={eventsQuery.isError ? 'Unknown' : 'Available'} healthy={!eventsQuery.isError} />
                        {latestEvent ? (
                          <button
                            className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                            type="button"
                            onClick={() => {
                              setSelectedEventId(latestEvent.id)
                              setActiveView('events')
                              setNotificationOpen(false)
                            }}
                          >
                            <span className="block text-xs text-slate-500">Latest event</span>
                            <span className="mt-1 block truncate text-sm font-medium text-white">{latestEvent.title}</span>
                          </button>
                        ) : (
                          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-400">
                            No event activity has been stored yet.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <div ref={contentScrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-6xl">
              {activeView === 'dashboard' ? (
                <DashboardView
                  stats={stats}
                  events={events}
                  eventsQueryIsError={eventsQuery.isError}
                  eventsQueryIsLoading={eventsQuery.isLoading}
                  activityBuckets={activityBuckets}
                  activityQueryIsError={activityQuery.isError}
                  activityQueryIsLoading={activityQuery.isLoading}
                  maxActivityCount={maxActivityCount}
                  monitorStatus={monitorQuery.data}
                  monitorStatusIsLoading={monitorQuery.isLoading}
                  monitorStatusIsError={monitorQuery.isError}
                  filesystemMonitorPath={filesystemMonitorPath}
                  startClipboardMonitorIsPending={startClipboardMonitorMutation.isPending}
                  stopClipboardMonitorIsPending={stopClipboardMonitorMutation.isPending}
                  startFilesystemMonitorIsPending={startFilesystemMonitorMutation.isPending}
                  stopFilesystemMonitorIsPending={stopFilesystemMonitorMutation.isPending}
                  startClipboardMonitorIsError={startClipboardMonitorMutation.isError}
                  stopClipboardMonitorIsError={stopClipboardMonitorMutation.isError}
                  startFilesystemMonitorIsError={startFilesystemMonitorMutation.isError}
                  stopFilesystemMonitorIsError={stopFilesystemMonitorMutation.isError}
                  onOpenEvents={() => setActiveView('events')}
                  onStartClipboardMonitor={() => startClipboardMonitorMutation.mutate()}
                  onStopClipboardMonitor={() => stopClipboardMonitorMutation.mutate()}
                  onStartFilesystemMonitor={handleStartFilesystemMonitor}
                  onStopFilesystemMonitor={() => stopFilesystemMonitorMutation.mutate()}
                  onSetFilesystemMonitorPath={setFilesystemMonitorPath}
                />
              ) : null}

              {activeView === 'events' ? (
                <EventsView
                  events={events}
                  selectedEvent={selectedEvent}
                  isEditingSelectedEvent={isEditingSelectedEvent}
                  eventListSummary={eventListSummary}
                  eventsQueryIsLoading={eventsQuery.isLoading}
                  eventsQueryIsError={eventsQuery.isError}
                  deleteMutationIsPending={deleteMutation.isPending}
                  deleteMutationIsSuccess={deleteMutation.isSuccess}
                  createMutationIsPending={createMutation.isPending}
                  createMutationIsError={createMutation.isError}
                  updateMutationIsPending={updateMutation.isPending}
                  updateMutationIsError={updateMutation.isError}
                  exportMutationIsPending={exportMutation.isPending}
                  exportMutationIsError={exportMutation.isError}
                  importMutationIsPending={importMutation.isPending}
                  importMutationIsError={importMutation.isError}
                  importFileError={importFileError}
                  source={source}
                  eventType={eventType}
                  title={title}
                  content={content}
                  editSource={editSource}
                  editEventType={editEventType}
                  editTitle={editTitle}
                  editContent={editContent}
                  canCreate={canCreate}
                  canUpdate={canUpdate}
                  importInputRef={importInputRef}
                  onCreateEvent={handleCreateEvent}
                  onUpdateEvent={handleUpdateEvent}
                  onImportFile={handleImportFile}
                  onExportEvents={() => exportMutation.mutate()}
                  onRefreshEvents={() => void eventsQuery.refetch()}
                  onSetSource={setSource}
                  onSetEventType={setEventType}
                  onSetTitle={setTitle}
                  onSetContent={setContent}
                  onSetEditSource={setEditSource}
                  onSetEditEventType={setEditEventType}
                  onSetEditTitle={setEditTitle}
                  onSetEditContent={setEditContent}
                  onSelectEvent={setSelectedEventId}
                  onStartEditing={startEditingEvent}
                  onCancelEditing={() => setIsEditingSelectedEvent(false)}
                  onDeleteEvent={(eventId) => {
                    if (selectedEventId === eventId) {
                      setSelectedEventId(null)
                    }
                    deleteMutation.mutate(eventId)
                  }}
                />
              ) : null}

              {activeView === 'search' ? (
                <SearchView
                  events={events}
                  searchTerm={searchTerm}
                  sourceFilter={sourceFilter}
                  eventTypeFilter={eventTypeFilter}
                  hasActiveSearch={hasActiveSearch}
                  eventsQueryIsLoading={eventsQuery.isLoading}
                  eventsQueryIsError={eventsQuery.isError}
                  onSearchTermChange={setSearchTerm}
                  onSourceFilterChange={setSourceFilter}
                  onEventTypeFilterChange={setEventTypeFilter}
                  onClearSearchFilters={clearSearchFilters}
                  onSelectEvent={(eventId) => {
                    setSelectedEventId(eventId)
                    setActiveView('events')
                  }}
                />
              ) : null}

              {activeView === 'sources' ? (
                <SourcesView
                  sourceStats={sourceStats}
                  sourcesQueryIsLoading={sourcesQuery.isLoading}
                  sourcesQueryIsError={sourcesQuery.isError}
                  activityBuckets={activityBuckets}
                  activityQueryIsLoading={activityQuery.isLoading}
                  activityQueryIsError={activityQuery.isError}
                  maxActivityCount={maxActivityCount}
                  onSelectSource={selectSourceFilter}
                />
              ) : null}

              {activeView === 'storage' ? (
                <StorageView
                  totalEventsValue={totalEventsValue}
                  latestEvent={summary?.latest_event_created_at ?? null}
                  eventsQueryIsError={eventsQuery.isError}
                  exportMutationIsPending={exportMutation.isPending}
                  exportMutationIsError={exportMutation.isError}
                  importMutationIsPending={importMutation.isPending}
                  importMutationIsError={importMutation.isError}
                  importFileError={importFileError}
                  importInputRef={importInputRef}
                  onImportFile={handleImportFile}
                  onExportEvents={() => exportMutation.mutate()}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  const size = compact ? 'h-10 w-10' : 'h-12 w-12'

  return (
    <div
      className={`flex ${size} items-center justify-center overflow-hidden rounded-xl shadow-[0_0_28px_rgba(34,211,238,0.12)]`}
      aria-hidden="true"
    >
      <img className="h-full w-full" src="/ghostmirror-mark.svg" alt="" />
    </div>
  )
}

function ViewHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-white md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function StatusRow({ label, value, healthy }: { label: string; value: string; healthy: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={healthy ? 'text-emerald-300' : 'text-red-200'}>{value}</span>
    </div>
  )
}

function DashboardView({
  stats,
  events,
  eventsQueryIsError,
  eventsQueryIsLoading,
  activityBuckets,
  activityQueryIsError,
  activityQueryIsLoading,
  maxActivityCount,
  monitorStatus,
  monitorStatusIsLoading,
  monitorStatusIsError,
  filesystemMonitorPath,
  startClipboardMonitorIsPending,
  stopClipboardMonitorIsPending,
  startFilesystemMonitorIsPending,
  stopFilesystemMonitorIsPending,
  startClipboardMonitorIsError,
  stopClipboardMonitorIsError,
  startFilesystemMonitorIsError,
  stopFilesystemMonitorIsError,
  onOpenEvents,
  onStartClipboardMonitor,
  onStopClipboardMonitor,
  onStartFilesystemMonitor,
  onStopFilesystemMonitor,
  onSetFilesystemMonitorPath,
}: {
  stats: Array<{ label: string; value: string; detail: string }>
  events: EventRecord[]
  eventsQueryIsError: boolean
  eventsQueryIsLoading: boolean
  activityBuckets: Array<{ date: string; total_events: number }>
  activityQueryIsError: boolean
  activityQueryIsLoading: boolean
  maxActivityCount: number
  monitorStatus: MonitorStatus | undefined
  monitorStatusIsLoading: boolean
  monitorStatusIsError: boolean
  filesystemMonitorPath: string
  startClipboardMonitorIsPending: boolean
  stopClipboardMonitorIsPending: boolean
  startFilesystemMonitorIsPending: boolean
  stopFilesystemMonitorIsPending: boolean
  startClipboardMonitorIsError: boolean
  stopClipboardMonitorIsError: boolean
  startFilesystemMonitorIsError: boolean
  stopFilesystemMonitorIsError: boolean
  onOpenEvents: () => void
  onStartClipboardMonitor: () => void
  onStopClipboardMonitor: () => void
  onStartFilesystemMonitor: () => void
  onStopFilesystemMonitor: () => void
  onSetFilesystemMonitorPath: (path: string) => void
}) {
  return (
    <>
      <ViewHeading
        title="Dashboard"
        description="A compact overview of local event capture, API availability, and recent activity."
      />

      <section className="grid gap-6">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#111620]">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                <Sparkles size={14} aria-hidden="true" />
                Local workspace activity
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                API-backed events
              </span>
            </div>
            <div className="mt-8 max-w-3xl">
              <h2 className="text-3xl font-semibold text-white md:text-5xl">
                Local activity, organized by source.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                GhostMirror stores structured workflow events locally and makes them searchable through the dashboard.
              </p>
            </div>
          </div>

          <div className="grid gap-px bg-white/10">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#111620] p-5">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <SystemStatusCard eventsQueryIsError={eventsQueryIsError} eventsQueryIsLoading={eventsQueryIsLoading} />
          <MonitorControlsCard
            monitorStatus={monitorStatus}
            isLoading={monitorStatusIsLoading}
            isError={monitorStatusIsError}
            filesystemPath={filesystemMonitorPath}
            startClipboardIsPending={startClipboardMonitorIsPending}
            stopClipboardIsPending={stopClipboardMonitorIsPending}
            startFilesystemIsPending={startFilesystemMonitorIsPending}
            stopFilesystemIsPending={stopFilesystemMonitorIsPending}
            startClipboardIsError={startClipboardMonitorIsError}
            stopClipboardIsError={stopClipboardMonitorIsError}
            startFilesystemIsError={startFilesystemMonitorIsError}
            stopFilesystemIsError={stopFilesystemMonitorIsError}
            onStartClipboard={onStartClipboardMonitor}
            onStopClipboard={onStopClipboardMonitor}
            onStartFilesystem={onStartFilesystemMonitor}
            onStopFilesystem={onStopFilesystemMonitor}
            onSetFilesystemPath={onSetFilesystemMonitorPath}
          />
          <RecentPreviewCard events={events} onOpenEvents={onOpenEvents} />
        </div>
        <ActivityCard
          activityBuckets={activityBuckets}
          isError={activityQueryIsError}
          isLoading={activityQueryIsLoading}
          maxActivityCount={maxActivityCount}
        />
      </section>
    </>
  )
}

function EventsView(props: {
  events: EventRecord[]
  selectedEvent: EventRecord | null
  isEditingSelectedEvent: boolean
  eventListSummary: string
  eventsQueryIsLoading: boolean
  eventsQueryIsError: boolean
  deleteMutationIsPending: boolean
  deleteMutationIsSuccess: boolean
  createMutationIsPending: boolean
  createMutationIsError: boolean
  updateMutationIsPending: boolean
  updateMutationIsError: boolean
  exportMutationIsPending: boolean
  exportMutationIsError: boolean
  importMutationIsPending: boolean
  importMutationIsError: boolean
  importFileError: boolean
  source: string
  eventType: string
  title: string
  content: string
  editSource: string
  editEventType: string
  editTitle: string
  editContent: string
  canCreate: boolean
  canUpdate: boolean
  importInputRef: React.RefObject<HTMLInputElement | null>
  onCreateEvent: (event: FormEvent<HTMLFormElement>) => void
  onUpdateEvent: (event: FormEvent<HTMLFormElement>) => void
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  onExportEvents: () => void
  onRefreshEvents: () => void
  onSetSource: (value: string) => void
  onSetEventType: (value: string) => void
  onSetTitle: (value: string) => void
  onSetContent: (value: string) => void
  onSetEditSource: (value: string) => void
  onSetEditEventType: (value: string) => void
  onSetEditTitle: (value: string) => void
  onSetEditContent: (value: string) => void
  onSelectEvent: (eventId: number) => void
  onStartEditing: (event: EventRecord) => void
  onCancelEditing: () => void
  onDeleteEvent: (eventId: number) => void
}) {
  return (
    <>
      <ViewHeading
        title="Events"
        description="Create, inspect, update, import, export, and delete stored events."
      />

      <div className="grid gap-6">
        <section className="min-w-0 rounded-lg border border-white/10 bg-[#111620]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-white">Event history</h2>
              <p className="mt-1 text-sm text-slate-400">{props.eventListSummary}</p>
            </div>
            <EventFileActions
              importInputRef={props.importInputRef}
              importMutationIsPending={props.importMutationIsPending}
              exportMutationIsPending={props.exportMutationIsPending}
              onImportFile={props.onImportFile}
              onExportEvents={props.onExportEvents}
              onRefreshEvents={props.onRefreshEvents}
              refreshDisabled={props.eventsQueryIsLoading}
            />
          </div>

          <ActionErrors
            exportMutationIsError={props.exportMutationIsError}
            importMutationIsError={props.importMutationIsError}
            importFileError={props.importFileError}
          />

          <EventList
            events={props.events}
            selectedEvent={props.selectedEvent}
            isLoading={props.eventsQueryIsLoading}
            isError={props.eventsQueryIsError}
            hasActiveSearch={false}
            deleteMutationIsPending={props.deleteMutationIsPending}
            onSelectEvent={props.onSelectEvent}
            onDeleteEvent={props.onDeleteEvent}
          />
        </section>

        <aside className="grid gap-6">
          <EventDetailCard
            selectedEvent={props.selectedEvent}
            isEditingSelectedEvent={props.isEditingSelectedEvent}
            updateMutationIsPending={props.updateMutationIsPending}
            updateMutationIsError={props.updateMutationIsError}
            editSource={props.editSource}
            editEventType={props.editEventType}
            editTitle={props.editTitle}
            editContent={props.editContent}
            canUpdate={props.canUpdate}
            onUpdateEvent={props.onUpdateEvent}
            onSetEditSource={props.onSetEditSource}
            onSetEditEventType={props.onSetEditEventType}
            onSetEditTitle={props.onSetEditTitle}
            onSetEditContent={props.onSetEditContent}
            onStartEditing={props.onStartEditing}
            onCancelEditing={props.onCancelEditing}
          />

          <CreateEventCard
            source={props.source}
            eventType={props.eventType}
            title={props.title}
            content={props.content}
            canCreate={props.canCreate}
            createMutationIsPending={props.createMutationIsPending}
            createMutationIsError={props.createMutationIsError}
            onCreateEvent={props.onCreateEvent}
            onSetSource={props.onSetSource}
            onSetEventType={props.onSetEventType}
            onSetTitle={props.onSetTitle}
            onSetContent={props.onSetContent}
          />

          {props.deleteMutationIsSuccess ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
              <CheckCircle2 size={16} aria-hidden="true" />
              Event deleted.
            </div>
          ) : null}
        </aside>
      </div>
    </>
  )
}

function SearchView({
  events,
  searchTerm,
  sourceFilter,
  eventTypeFilter,
  hasActiveSearch,
  eventsQueryIsLoading,
  eventsQueryIsError,
  onSearchTermChange,
  onSourceFilterChange,
  onEventTypeFilterChange,
  onClearSearchFilters,
  onSelectEvent,
}: {
  events: EventRecord[]
  searchTerm: string
  sourceFilter: string
  eventTypeFilter: string
  hasActiveSearch: boolean
  eventsQueryIsLoading: boolean
  eventsQueryIsError: boolean
  onSearchTermChange: (value: string) => void
  onSourceFilterChange: (value: string) => void
  onEventTypeFilterChange: (value: string) => void
  onClearSearchFilters: () => void
  onSelectEvent: (eventId: number) => void
}) {
  return (
    <>
      <ViewHeading
        title="Search"
        description="Search event titles and content, then narrow results by source or event type."
      />

      <section className="rounded-lg border border-white/10 bg-[#111620]">
        <div className="grid gap-4 border-b border-white/10 p-5">
          <label className="grid gap-2 text-sm text-slate-300">
            Query
            <input
              className="h-11 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search title or content"
            />
          </label>

          <FilterSelect label="Source" value={sourceFilter} options={sourceOptions} emptyLabel="All sources" onChange={onSourceFilterChange} />
          <FilterSelect label="Type" value={eventTypeFilter} options={eventTypeOptions} emptyLabel="All types" onChange={onEventTypeFilterChange} />

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onClearSearchFilters}
            disabled={!hasActiveSearch}
          >
            <X size={16} aria-hidden="true" />
            Clear
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-sm text-slate-400">
            {eventsQueryIsError
              ? 'The event API is unavailable'
              : eventsQueryIsLoading
                ? 'Loading results'
                : `${events.length} result${events.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <EventList
          events={events}
          selectedEvent={null}
          isLoading={eventsQueryIsLoading}
          isError={eventsQueryIsError}
          hasActiveSearch={hasActiveSearch}
          deleteMutationIsPending={false}
          onSelectEvent={onSelectEvent}
          onDeleteEvent={null}
        />
      </section>
    </>
  )
}

function SourcesView({
  sourceStats,
  sourcesQueryIsLoading,
  sourcesQueryIsError,
  activityBuckets,
  activityQueryIsLoading,
  activityQueryIsError,
  maxActivityCount,
  onSelectSource,
}: {
  sourceStats: Array<{ source: string; total_events: number; event_type_counts: Record<string, number> }>
  sourcesQueryIsLoading: boolean
  sourcesQueryIsError: boolean
  activityBuckets: Array<{ date: string; total_events: number }>
  activityQueryIsLoading: boolean
  activityQueryIsError: boolean
  maxActivityCount: number
  onSelectSource: (source: string) => void
}) {
  return (
    <>
      <ViewHeading
        title="Sources"
        description="Review where stored events are coming from and jump into filtered search results."
      />

      <div className="grid items-start gap-6">
        <section className="rounded-lg border border-white/10 bg-[#111620] p-5">
          <div className="flex items-center gap-2">
            <FolderGit2 size={18} className="text-cyan-200" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">Tracked sources</h2>
          </div>

          {sourcesQueryIsError ? (
            <p className="mt-5 text-sm leading-6 text-slate-400">Source counts are unavailable.</p>
          ) : sourcesQueryIsLoading ? (
            <LoadingLine label="Loading sources" />
          ) : sourceStats.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {sourceStats.map((source) => (
                <button
                  key={source.source}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                  type="button"
                  onClick={() => onSelectSource(source.source)}
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm font-semibold text-white">{source.source}</span>
                    <span className="text-sm font-semibold text-cyan-100">{source.total_events}</span>
                  </span>
                  <span className="mt-3 block truncate text-xs text-slate-500">
                    {Object.entries(source.event_type_counts)
                      .map(([eventType, count]) => `${eventType}: ${count}`)
                      .join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No sources yet" description="Sources appear after events are stored." />
          )}
        </section>

        <ActivityCard
          activityBuckets={activityBuckets}
          isError={activityQueryIsError}
          isLoading={activityQueryIsLoading}
          maxActivityCount={maxActivityCount}
        />
      </div>
    </>
  )
}

function StorageView({
  totalEventsValue,
  latestEvent,
  eventsQueryIsError,
  exportMutationIsPending,
  exportMutationIsError,
  importMutationIsPending,
  importMutationIsError,
  importFileError,
  importInputRef,
  onImportFile,
  onExportEvents,
}: {
  totalEventsValue: string
  latestEvent: string | null
  eventsQueryIsError: boolean
  exportMutationIsPending: boolean
  exportMutationIsError: boolean
  importMutationIsPending: boolean
  importMutationIsError: boolean
  importFileError: boolean
  importInputRef: React.RefObject<HTMLInputElement | null>
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  onExportEvents: () => void
}) {
  return (
    <>
      <ViewHeading
        title="Storage"
        description="Manage local event data and move event history in or out of GhostMirror as JSON."
      />

      <div className="grid gap-6">
        <section className="rounded-lg border border-white/10 bg-[#111620] p-5">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-cyan-200" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">Local database</h2>
          </div>
          <dl className="mt-5 grid gap-4 text-sm">
            <StorageRow label="Storage engine" value="SQLite" />
            <StorageRow label="Stored events" value={totalEventsValue} />
            <StorageRow label="Latest event" value={latestEvent ? formatDate(latestEvent) : 'None'} />
            <StorageRow label="Event API" value={eventsQueryIsError ? 'Unavailable' : 'Available'} />
          </dl>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#111620] p-5">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-cyan-200" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">Import and export</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Export creates a JSON file. Import reads a GhostMirror export file and stores new local events.
          </p>

          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            aria-label="Import events file"
            onChange={(event) => void onImportFile(event)}
          />

          <div className="mt-5 grid gap-3">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importMutationIsPending}
            >
              {importMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={onExportEvents}
              disabled={exportMutationIsPending}
            >
              {exportMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export
            </button>
          </div>

          <ActionErrors
            exportMutationIsError={exportMutationIsError}
            importMutationIsError={importMutationIsError}
            importFileError={importFileError}
          />
        </section>
      </div>
    </>
  )
}

function EventFileActions({
  importInputRef,
  importMutationIsPending,
  exportMutationIsPending,
  refreshDisabled,
  onImportFile,
  onExportEvents,
  onRefreshEvents,
}: {
  importInputRef: React.RefObject<HTMLInputElement | null>
  importMutationIsPending: boolean
  exportMutationIsPending: boolean
  refreshDisabled: boolean
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void
  onExportEvents: () => void
  onRefreshEvents: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Import events file"
        onChange={(event) => void onImportFile(event)}
      />
      <button
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={() => importInputRef.current?.click()}
        disabled={importMutationIsPending}
      >
        {importMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        Import
      </button>
      <button
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={onExportEvents}
        disabled={exportMutationIsPending}
      >
        {exportMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Export
      </button>
      <button
        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        onClick={onRefreshEvents}
        disabled={refreshDisabled}
      >
        <RefreshCw size={16} className={refreshDisabled ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  )
}

function ActionErrors({
  exportMutationIsError,
  importMutationIsError,
  importFileError,
}: {
  exportMutationIsError: boolean
  importMutationIsError: boolean
  importFileError: boolean
}) {
  return (
    <>
      {exportMutationIsError ? (
        <div className="border-b border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-100">
          Could not export events.
        </div>
      ) : null}

      {importMutationIsError || importFileError ? (
        <div className="border-b border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-100">
          Could not import events.
        </div>
      ) : null}
    </>
  )
}

function EventList({
  events,
  selectedEvent,
  isLoading,
  isError,
  hasActiveSearch,
  deleteMutationIsPending,
  onSelectEvent,
  onDeleteEvent,
}: {
  events: EventRecord[]
  selectedEvent: EventRecord | null
  isLoading: boolean
  isError: boolean
  hasActiveSearch: boolean
  deleteMutationIsPending: boolean
  onSelectEvent: (eventId: number) => void
  onDeleteEvent: ((eventId: number) => void) | null
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center text-slate-400">
        <Loader2 size={26} className="animate-spin text-cyan-200" aria-hidden="true" />
        <p className="mt-4 text-sm">Loading events from the local API...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-200">
          <AlertCircle size={22} aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-white">Event API unavailable</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          Start the backend on port 8000, then refresh this panel.
        </p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events captured yet"
        description={
          hasActiveSearch
            ? 'Clear the search or adjust filters to inspect the full event history.'
            : 'Create a manual event to verify the local event API and database path.'
        }
      />
    )
  }

  return (
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
              <EventMeta event={event} />
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
                onClick={() => onSelectEvent(event.id)}
              >
                <Eye size={16} aria-hidden="true" />
              </button>
              {onDeleteEvent ? (
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  aria-label={`Delete ${event.title}`}
                  onClick={() => onDeleteEvent(event.id)}
                  disabled={deleteMutationIsPending}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function EventDetailCard(props: {
  selectedEvent: EventRecord | null
  isEditingSelectedEvent: boolean
  updateMutationIsPending: boolean
  updateMutationIsError: boolean
  editSource: string
  editEventType: string
  editTitle: string
  editContent: string
  canUpdate: boolean
  onUpdateEvent: (event: FormEvent<HTMLFormElement>) => void
  onSetEditSource: (value: string) => void
  onSetEditEventType: (value: string) => void
  onSetEditTitle: (value: string) => void
  onSetEditContent: (value: string) => void
  onStartEditing: (event: EventRecord) => void
  onCancelEditing: () => void
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-cyan-200" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Event detail</h2>
        </div>
        {props.selectedEvent && !props.isEditingSelectedEvent ? (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
            type="button"
            aria-label={`Edit ${props.selectedEvent.title}`}
            onClick={() => props.onStartEditing(props.selectedEvent as EventRecord)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {props.selectedEvent && props.isEditingSelectedEvent ? (
        <form className="mt-5 space-y-4" onSubmit={props.onUpdateEvent}>
          <FilterSelect label="Source" value={props.editSource} options={sourceOptions} onChange={props.onSetEditSource} />
          <FilterSelect label="Type" value={props.editEventType} options={eventTypeOptions} onChange={props.onSetEditEventType} />
          <TextInput label="Title" value={props.editTitle} onChange={props.onSetEditTitle} placeholder="Event title" />
          <TextArea label="Content" value={props.editContent} onChange={props.onSetEditContent} placeholder="Event content" />

          {props.updateMutationIsError ? (
            <p className="text-sm leading-6 text-red-200">Could not update the event.</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/10"
              type="button"
              onClick={props.onCancelEditing}
            >
              <X size={16} aria-hidden="true" />
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!props.canUpdate}
            >
              {props.updateMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
        </form>
      ) : props.selectedEvent ? (
        <div className="mt-5 space-y-5">
          <div>
            <EventMeta event={props.selectedEvent} />
            <h3 className="mt-3 text-sm font-semibold leading-6 text-white">{props.selectedEvent.title}</h3>
          </div>

          <div className="max-h-72 overflow-auto rounded-lg border border-white/10 bg-[#0d1017] p-3">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
              {props.selectedEvent.content}
            </pre>
          </div>

          <dl className="grid gap-3 text-sm">
            <StorageRow label="Created" value={formatDate(props.selectedEvent.created_at)} />
            <StorageRow label="Updated" value={formatDate(props.selectedEvent.updated_at)} />
          </dl>

          {formatMetadata(props.selectedEvent.metadata) ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Metadata</p>
              <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300">
                {formatMetadata(props.selectedEvent.metadata)}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-400">Select an event to inspect its content and metadata.</p>
      )}
    </div>
  )
}

function CreateEventCard(props: {
  source: string
  eventType: string
  title: string
  content: string
  canCreate: boolean
  createMutationIsPending: boolean
  createMutationIsError: boolean
  onCreateEvent: (event: FormEvent<HTMLFormElement>) => void
  onSetSource: (value: string) => void
  onSetEventType: (value: string) => void
  onSetTitle: (value: string) => void
  onSetContent: (value: string) => void
}) {
  return (
    <form className="rounded-lg border border-white/10 bg-[#111620] p-5" onSubmit={props.onCreateEvent}>
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-cyan-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Create event</h2>
      </div>

      <div className="mt-5 grid gap-3">
        <FilterSelect label="Source" value={props.source} options={sourceOptions} onChange={props.onSetSource} />
        <FilterSelect label="Type" value={props.eventType} options={eventTypeOptions} onChange={props.onSetEventType} />
        <TextInput label="Title" value={props.title} onChange={props.onSetTitle} placeholder="What happened?" />
        <TextArea label="Content" value={props.content} onChange={props.onSetContent} placeholder="Add the event details" />
      </div>

      {props.createMutationIsError ? (
        <p className="mt-3 text-sm leading-6 text-red-200">Could not create the event.</p>
      ) : null}

      <button
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={!props.canCreate}
      >
        {props.createMutationIsPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        Create event
      </button>
    </form>
  )
}

function ActivityCard({
  activityBuckets,
  isError,
  isLoading,
  maxActivityCount,
}: {
  activityBuckets: Array<{ date: string; total_events: number }>
  isError: boolean
  isLoading: boolean
  maxActivityCount: number
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-cyan-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">7-day activity</h2>
      </div>
      {isError ? (
        <p className="mt-4 text-sm leading-6 text-slate-400">Activity counts are unavailable.</p>
      ) : isLoading ? (
        <LoadingLine label="Loading activity" />
      ) : (
        <div className="mt-5 space-y-3">
          {activityBuckets.map((bucket) => {
            const width = maxActivityCount > 0 ? Math.max((bucket.total_events / maxActivityCount) * 100, 8) : 0

            return (
              <div key={bucket.date} className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-3">
                <span className="text-xs text-slate-500">{formatDay(bucket.date)}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-300" style={{ width: `${width}%` }} />
                </div>
                <span className="text-right text-xs font-medium text-slate-300">{bucket.total_events}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MonitorControlsCard({
  monitorStatus,
  isLoading,
  isError,
  filesystemPath,
  startClipboardIsPending,
  stopClipboardIsPending,
  startFilesystemIsPending,
  stopFilesystemIsPending,
  startClipboardIsError,
  stopClipboardIsError,
  startFilesystemIsError,
  stopFilesystemIsError,
  onStartClipboard,
  onStopClipboard,
  onStartFilesystem,
  onStopFilesystem,
  onSetFilesystemPath,
}: {
  monitorStatus: MonitorStatus | undefined
  isLoading: boolean
  isError: boolean
  filesystemPath: string
  startClipboardIsPending: boolean
  stopClipboardIsPending: boolean
  startFilesystemIsPending: boolean
  stopFilesystemIsPending: boolean
  startClipboardIsError: boolean
  stopClipboardIsError: boolean
  startFilesystemIsError: boolean
  stopFilesystemIsError: boolean
  onStartClipboard: () => void
  onStopClipboard: () => void
  onStartFilesystem: () => void
  onStopFilesystem: () => void
  onSetFilesystemPath: (path: string) => void
}) {
  const clipboard = monitorStatus?.clipboard
  const filesystem = monitorStatus?.filesystem
  const clipboardBusy = startClipboardIsPending || stopClipboardIsPending
  const filesystemBusy = startFilesystemIsPending || stopFilesystemIsPending
  const filesystemCanStart = filesystemPath.trim().length > 0 && !filesystemBusy
  const hasMutationError = startClipboardIsError || stopClipboardIsError || startFilesystemIsError || stopFilesystemIsError

  return (
    <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-cyan-200" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Capture controls</h2>
        </div>
        {isLoading ? <Loader2 size={16} className="animate-spin text-cyan-200" aria-hidden="true" /> : null}
      </div>

      {isError ? (
        <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
          Monitor API unavailable.
        </p>
      ) : null}

      {hasMutationError ? (
        <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
          Could not update monitor state.
        </p>
      ) : null}

      <div className="mt-5 divide-y divide-white/10">
        <MonitorWorkerPanel
          icon={Clipboard}
          title="Clipboard"
          worker={clipboard}
          isBusy={clipboardBusy}
          onStart={onStartClipboard}
          onStop={onStopClipboard}
          startLabel="Start clipboard monitor"
          stopLabel="Stop clipboard monitor"
        />

        <div className="py-4 last:pb-0">
          <MonitorWorkerHeader icon={FolderOpen} title="Filesystem" worker={filesystem} />

          <label className="mt-4 grid gap-2 text-sm text-slate-300">
            Filesystem path
            <input
              className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60"
              value={filesystem?.running ? filesystem.watch_path ?? filesystemPath : filesystemPath}
              onChange={(event) => onSetFilesystemPath(event.target.value)}
              placeholder="/Users/you/project"
              disabled={filesystem?.running || filesystemBusy}
            />
          </label>

          <MonitorWorkerMeta worker={filesystem} />

          <button
            className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              filesystem?.running
                ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
                : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
            }`}
            type="button"
            aria-label={filesystem?.running ? 'Stop filesystem monitor' : 'Start filesystem monitor'}
            onClick={filesystem?.running ? onStopFilesystem : onStartFilesystem}
            disabled={filesystem?.running ? filesystemBusy : !filesystemCanStart}
          >
            {filesystemBusy ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : filesystem?.running ? (
              <Square size={15} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {filesystem?.running ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MonitorWorkerPanel({
  icon: Icon,
  title,
  worker,
  isBusy,
  startLabel,
  stopLabel,
  onStart,
  onStop,
}: {
  icon: typeof Clipboard
  title: string
  worker: MonitorWorkerStatus | undefined
  isBusy: boolean
  startLabel: string
  stopLabel: string
  onStart: () => void
  onStop: () => void
}) {
  return (
    <div className="pb-4">
      <MonitorWorkerHeader icon={Icon} title={title} worker={worker} />
      <MonitorWorkerMeta worker={worker} />
      <button
        className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          worker?.running
            ? 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
            : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
        }`}
        type="button"
        aria-label={worker?.running ? stopLabel : startLabel}
        onClick={worker?.running ? onStop : onStart}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : worker?.running ? (
          <Square size={15} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
        {worker?.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}

function MonitorWorkerHeader({
  icon: Icon,
  title,
  worker,
}: {
  icon: typeof Clipboard
  title: string
  worker: MonitorWorkerStatus | undefined
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-cyan-200" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          worker?.running
            ? 'bg-emerald-300/10 text-emerald-300'
            : 'bg-white/[0.04] text-slate-400'
        }`}
      >
        {worker?.running ? 'Running' : 'Stopped'}
      </span>
    </div>
  )
}

function MonitorWorkerMeta({ worker }: { worker: MonitorWorkerStatus | undefined }) {
  return (
    <dl className="mt-4 grid gap-2 text-xs">
      <MonitorMetaRow label="Session events" value={String(worker?.events_created ?? 0)} />
      <MonitorMetaRow label="Last checked" value={worker?.last_checked_at ? formatDate(worker.last_checked_at) : 'Never'} />
      {worker?.last_error ? <MonitorMetaRow label="Last error" value={worker.last_error} /> : null}
    </dl>
  )
}

function MonitorMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-right text-slate-300">{value}</dd>
    </div>
  )
}

function SystemStatusCard({
  eventsQueryIsError,
  eventsQueryIsLoading,
}: {
  eventsQueryIsError: boolean
  eventsQueryIsLoading: boolean
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">System status</h2>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            eventsQueryIsError
              ? 'bg-red-300 shadow-[0_0_18px_rgba(252,165,165,0.75)]'
              : 'bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.75)]'
          }`}
        />
      </div>
      <div className="mt-5 space-y-4">
        <StatusRow label="Frontend shell" value="Available" healthy />
        <StatusRow
          label="Event API"
          value={eventsQueryIsError ? 'Unavailable' : eventsQueryIsLoading ? 'Checking' : 'Available'}
          healthy={!eventsQueryIsError}
        />
        <StatusRow label="SQLite storage" value={eventsQueryIsError ? 'Unknown' : 'Available'} healthy={!eventsQueryIsError} />
      </div>
    </div>
  )
}

function RecentPreviewCard({ events, onOpenEvents }: { events: EventRecord[]; onOpenEvents: () => void }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3 size={18} className="text-cyan-200" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Recent events</h2>
        </div>
        <button className="text-sm text-cyan-100 transition hover:text-cyan-50" type="button" onClick={onOpenEvents}>
          Open
        </button>
      </div>
      {events.length > 0 ? (
        <ol className="mt-5 space-y-4">
          {events.slice(0, 3).map((event) => (
            <li key={event.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-cyan-200" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">{event.title}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {event.source} · {event.event_type} · {formatDate(event.created_at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-400">Recent events appear after data is stored.</p>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  emptyLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <select
        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <input
        className="h-10 rounded-lg border border-white/10 bg-[#0d1017] px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <textarea
        className="min-h-24 resize-none rounded-lg border border-white/10 bg-[#0d1017] px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function EventMeta({ event }: { event: EventRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">{event.source}</span>
      <span>{event.event_type}</span>
      <span>{formatDate(event.created_at)}</span>
    </div>
  )
}

function StorageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-300">{value}</dd>
    </div>
  )
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
      <Loader2 size={16} className="animate-spin text-cyan-200" aria-hidden="true" />
      {label}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400">
        <Inbox size={22} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

export default App
