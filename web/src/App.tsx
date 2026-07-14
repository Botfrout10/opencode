import { Outlet, NavLink, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  Bot,
  Terminal,
  Settings as SettingsIcon,
  FolderKanban,
  SunMoon,
} from 'lucide-react';
import { useTheme } from './store/useTheme';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, end: false },
  { to: '/agents', label: 'Agents', icon: Bot, end: false },
  { to: '/executions', label: 'Executions', icon: Terminal, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#059669" />
      <rect x="7" y="11" width="2.5" height="6" rx="1.25" fill="white" />
      <rect x="12.75" y="7" width="2.5" height="14" rx="1.25" fill="white" />
      <rect x="18.5" y="9" width="2.5" height="10" rx="1.25" fill="white" />
    </svg>
  );
}

function Layout() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">Symphony</span>
          </div>
          <button
            onClick={toggle}
            title="Toggle theme"
            aria-label="Toggle theme"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <SunMoon size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
                }`
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-zinc-400">AI Coding Orchestrator</div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
      <Route index element={<Dashboard />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:id" element={<ProjectDetail />} />
      <Route path="tasks" element={<Tasks />} />
      <Route path="agents" element={<Agents />} />
        <Route path="executions" element={<Executions />} />
        <Route path="executions/:id/logs" element={<ExecutionLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

// View components are implemented by the UI specialist (see web/src/views/*).
import Dashboard from './views/Dashboard';
import Projects from './views/Projects';
import ProjectDetail from './views/ProjectDetail';
import Tasks from './views/Tasks';
import Agents from './views/Agents';
import Executions from './views/Executions';
import ExecutionLogs from './views/ExecutionLogs';
import Settings from './views/Settings';
