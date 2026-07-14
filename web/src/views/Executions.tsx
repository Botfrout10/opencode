import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Terminal,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { Execution, ExecutionLog } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { LogViewer } from '../components/LogViewer';
import { EmptyState } from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { ToastContainer } from '../components/Toast';

// ─── helpers ────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

// ─── Detail Panel ───────────────────────────────────────────────
function ExecutionDetail({
  execution,
  onClose,
}: {
  execution: Execution;
  onClose: () => void;
}) {
  const { data: initialLogs = [] } = useQuery({
    queryKey: ['executionLogs', execution.id],
    queryFn: () => api.getExecutionLogs(execution.id),
  });

  return (
    <>
      <div className="fixed inset-0 z-30 animate-fade-in bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-40 flex h-full w-full max-w-2xl animate-drawer-in flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Execution</h2>
            <StatusBadge status={execution.status} />
            <span className="font-mono text-xs text-zinc-500">{execution.id.slice(0, 8)}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-zinc-200 px-6 py-4 text-xs dark:border-zinc-800">
          <div>
            <span className="text-zinc-500">Started</span>
            <div className="mt-0.5 text-zinc-900 dark:text-zinc-100">{formatTime(execution.startedAt)}</div>
          </div>
          <div>
            <span className="text-zinc-500">Ended</span>
            <div className="mt-0.5 text-zinc-900 dark:text-zinc-100">{formatTime(execution.endedAt)}</div>
          </div>
          <div>
            <span className="text-zinc-500">Exit Code</span>
            <div className="mt-0.5 font-mono text-zinc-900 dark:text-zinc-100">
              {execution.exitCode != null ? execution.exitCode : '-'}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Workspace</span>
            <div className="mt-0.5 truncate font-mono text-zinc-900 dark:text-zinc-100">
              {execution.workspacePath ?? '-'}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Logs</h3>
          <LogViewer executionId={execution.id} initialLogs={initialLogs} />
        </div>
      </div>
    </>
  );
}

// ─── Main View ──────────────────────────────────────────────────
export default function Executions() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: executions, isLoading } = useQuery({
    queryKey: ['executions'],
    queryFn: () => api.listExecutions(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.listAgents,
  });

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  const selectedExec = executions?.find((e) => e.id === selectedId);

  if (isLoading) {
    return (
      <>
        <div className="space-y-4">
          <h1 className="text-lg font-semibold tracking-tight">Executions</h1>
          <SkeletonTable rows={5} />
        </div>
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Executions</h1>

        {!executions || executions.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="No executions yet"
            description="Run a task to start an execution."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                  <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Ended</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="w-8 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {executions.map((ex) => (
                  <tr
                    key={ex.id}
                    className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => setSelectedId(ex.id)}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={ex.status} />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3">
                      {taskMap[ex.taskId]?.title ?? <span className="font-mono text-zinc-400">{ex.taskId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {ex.agentId ? agentMap[ex.agentId]?.name ?? '-' : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {timeAgo(ex.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {timeAgo(ex.endedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {ex.exitCode != null ? ex.exitCode : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-zinc-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedExec && (
        <ExecutionDetail
          execution={selectedExec}
          onClose={() => setSelectedId(null)}
        />
      )}

      <ToastContainer />
    </>
  );
}
