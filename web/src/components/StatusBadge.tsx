import type { TaskStatus, AgentStatus, ExecutionStatus } from '../types';

type AnyStatus = TaskStatus | AgentStatus | ExecutionStatus;

interface StatusConfig {
  label: string;
  dot: string;
  bg: string;
  text: string;
}

const configs: Record<AnyStatus, StatusConfig> = {
  // Task statuses
  draft: { label: 'Draft', dot: 'bg-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
  assigned: { label: 'Assigned', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-400' },
  workspace_ready: { label: 'Ready', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
  running: { label: 'Running', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
  succeeded: { label: 'Succeeded', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
  failed: { label: 'Failed', dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-400' },
  cancelled: { label: 'Cancelled', dot: 'bg-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
  retrying: { label: 'Retrying', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },

  // Agent statuses
  idle: { label: 'Idle', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-400' },
  busy: { label: 'Busy', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-400' },
  offline: { label: 'Offline', dot: 'bg-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },

  // Execution statuses
  pending: { label: 'Pending', dot: 'bg-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const c = configs[status] ?? { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
