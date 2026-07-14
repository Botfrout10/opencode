import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListChecks,
  Bot,
  Terminal,
  Clock,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardSummary } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { ToastContainer } from '../components/Toast';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

function StatCard({
  icon: Icon,
  label,
  value,
  children,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  value?: number | string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <Icon size={16} stroke="1.5" />
        {label}
      </div>
      {value !== undefined && (
        <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
          {value}
        </div>
      )}
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

function StatusCounts({
  counts,
  labels,
}: {
  counts: Record<string, number>;
  labels: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <div
          key={label}
          className="flex items-center gap-1.5 text-xs"
        >
          <StatusBadge status={label as never} />
          <span className="font-mono text-zinc-600 dark:text-zinc-400">{counts[label] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function RecentExecutions({
  executions,
}: {
  executions: DashboardSummary['recentExecutions'];
}) {
  const navigate = useNavigate();

  if (executions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-zinc-400">No recent executions.</p>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {executions.map((ex) => (
        <button
          key={ex.id}
          onClick={() => navigate('/executions')}
          className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <StatusBadge status={ex.status} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {ex.taskTitle}
            </div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {ex.agentName}
            </div>
          </div>
          <div className="shrink-0 text-xs text-zinc-400">
            {ex.startedAt ? timeAgo(ex.startedAt) : '-'}
          </div>
        </button>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="mb-3 h-3 w-32" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboard,
  });

  if (isLoading) {
    return (
      <>
        <LoadingSkeleton />
        <ToastContainer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle size={32} className="mb-3 text-red-400" stroke="1.5" />
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load dashboard. {error instanceof Error ? error.message : ''}
          </p>
        </div>
        <ToastContainer />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <EmptyState
          icon={LayoutDashboard}
          title="No data yet"
          description="Start by creating tasks and agents."
        />
        <ToastContainer />
      </>
    );
  }

  const taskStatuses = ['draft', 'assigned', 'workspace_ready', 'running', 'succeeded', 'failed', 'cancelled', 'retrying'];
  const agentStatuses = ['idle', 'busy', 'offline'];
  const execStatuses = ['pending', 'running', 'succeeded', 'failed', 'cancelled'];

  const totalTasks = Object.values(data.tasks).reduce((a, b) => a + b, 0);
  const totalAgents = Object.values(data.agents).reduce((a, b) => a + b, 0);
  const totalExecs = Object.values(data.executions).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={ListChecks} label="Tasks" value={totalTasks}>
            <StatusCounts counts={data.tasks} labels={taskStatuses} />
          </StatCard>

          <StatCard icon={Bot} label="Agents" value={totalAgents}>
            <StatusCounts counts={data.agents} labels={agentStatuses} />
          </StatCard>

          <StatCard icon={Terminal} label="Executions" value={totalExecs}>
            <StatusCounts counts={data.executions} labels={execStatuses} />
          </StatCard>
        </div>

        <Card>
          <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Clock size={16} stroke="1.5" className="text-zinc-400" />
              Recent Executions
            </h2>
          </div>
          <RecentExecutions executions={data.recentExecutions} />
        </Card>
      </div>
      <ToastContainer />
    </>
  );
}
