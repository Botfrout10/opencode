import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import type { Execution } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { LogViewer } from '../components/LogViewer';
import { Skeleton } from '../components/Skeleton';
import { ToastContainer } from '../components/Toast';

// ─── helpers ────────────────────────────────────────────────────
function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

// ─── Main View ──────────────────────────────────────────────────
export default function ExecutionLogs() {
  const { id } = useParams<{ id: string }>();

  const {
    data: execution,
    isLoading: loadingExec,
    error: execError,
  } = useQuery<Execution>({
    queryKey: ['execution', id],
    queryFn: () => api.getExecution(id!),
    enabled: !!id,
  });

  const {
    data: initialLogs = [],
    isLoading: loadingLogs,
    error: logsError,
  } = useQuery({
    queryKey: ['executionLogs', id],
    queryFn: () => api.getExecutionLogs(id!),
    enabled: !!id,
  });

  const isLoading = loadingExec || loadingLogs;
  const loadError = execError ?? logsError;

  return (
    <div className="flex h-full flex-col">
      {/* Back button */}
      <div className="mb-4">
        <Link
          to="/executions"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Executions
        </Link>
      </div>

      {loadError ? (
        <div className="flex items-center justify-center flex-1 text-xs text-red-400">
          Failed to load: {loadError instanceof Error ? loadError.message : 'unknown error'}
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : execution ? (
        <>
          {/* Execution metadata header */}
          <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge status={execution.status} />
              <span className="font-mono text-xs text-zinc-500">
                {execution.id.slice(0, 8)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-zinc-500">Task ID</span>
                <div className="mt-0.5 font-mono text-zinc-100">
                  {execution.taskId.slice(0, 8)}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Started</span>
                <div className="mt-0.5 text-zinc-100">
                  {formatTime(execution.startedAt)}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Ended</span>
                <div className="mt-0.5 text-zinc-100">
                  {formatTime(execution.endedAt)}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Exit Code</span>
                <div className="mt-0.5 font-mono text-zinc-100">
                  {execution.exitCode != null ? execution.exitCode : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 min-h-0">
            <LogViewer
              executionId={execution.id}
              initialLogs={initialLogs}
              showOpenButton={false}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center flex-1 text-xs text-zinc-500">
          Execution not found.
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
