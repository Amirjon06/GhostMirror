import {
  Activity,
  Bell,
  BrainCircuit,
  Clipboard,
  Clock3,
  Command,
  Database,
  Inbox,
  FileSearch,
  FolderGit2,
  LayoutDashboard,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Events', icon: Activity },
  { label: 'Search', icon: FileSearch },
  { label: 'Sources', icon: FolderGit2 },
  { label: 'Storage', icon: Database },
]

const stats = [
  { label: 'Events indexed', value: '0', detail: 'Persistence starts in Milestone 3' },
  { label: 'Active sources', value: '0', detail: 'Clipboard and filesystem arrive later' },
  { label: 'Search mode', value: 'FTS5', detail: 'Planned after event storage' },
]

function App() {
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
              No cloud sync, no fake analytics, no AI layer until the event system works.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#090b10]/80 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-4">
              <div className="flex h-10 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-slate-400">
                <Search size={18} aria-hidden="true" />
                <span className="text-sm">Search events, snippets, files...</span>
                <kbd className="ml-auto hidden items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-500 sm:inline-flex">
                  <Command size={12} aria-hidden="true" /> K
                </kbd>
              </div>
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
                        Milestone 1 scaffold
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                        Local dashboard shell
                      </span>
                    </div>
                    <div className="mt-8 max-w-3xl">
                      <h1 className="text-3xl font-semibold tracking-normal text-white md:text-5xl">
                        Real-time developer activity, ready for real data.
                      </h1>
                      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                        GhostMirror starts with a clean local-first foundation: React, Tailwind,
                        FastAPI, and a dashboard surface designed for event streams, search, and
                        analytics once the backend is ready.
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
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">Recent activity</h2>
                      <p className="mt-1 text-sm text-slate-400">Waiting for the event system milestone</p>
                    </div>
                    <Clipboard className="text-slate-500" size={20} aria-hidden="true" />
                  </div>

                  <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400">
                      <Inbox size={22} aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-white">No events captured yet</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                      Milestone 3 will introduce persisted events. Until then, this panel stays
                      intentionally empty.
                    </p>
                  </div>
                </div>
              </section>

              <aside className="space-y-6">
                <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">System status</h2>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.75)]" />
                  </div>
                  <div className="mt-5 space-y-4">
                    {['Frontend shell', 'FastAPI service', 'SQLite storage'].map((item, index) => (
                      <div key={item} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{item}</span>
                        <span className={index < 2 ? 'text-emerald-300' : 'text-slate-500'}>
                          {index < 2 ? 'Scaffolded' : 'Next'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#111620] p-5">
                  <div className="flex items-center gap-2">
                    <Clock3 size={18} className="text-cyan-200" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-white">Next milestone</h2>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    The README gets promoted from starter notes into a senior-level project brief
                    with architecture, roadmap, and engineering principles.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
