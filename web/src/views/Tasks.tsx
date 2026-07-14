import { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Square,
  RefreshCw,
  Trash2,
  MoreVertical,
  User,
  ListChecks,
  List,
  LayoutGrid,
  ChevronLeft,
  FolderKanban,
} from 'lucide-react';
import { api } from '../api/client';
import type { Task, Agent, Project, TaskStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { LogViewer } from '../components/LogViewer';
import { EmptyState } from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { toast, ToastContainer } from '../components/Toast';

// ─── helpers ────────────────────────────────────────────────────
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

// ─── Shared task action predicates ──────────────────────────────
// The Kanban drag rules and the per-row action menu both derive from
// these, so a card is draggable exactly when its menu offers Run/Retry.
const RUN_ACTION_STATUSES: TaskStatus[] = [
  'draft',
  'assigned',
  'workspace_ready',
  'failed',
  'cancelled',
  'retrying',
];
const hasRunAction = (task: Task) =>
  RUN_ACTION_STATUSES.includes(task.status) && !!task.assignedAgentId;
const hasRetryAction = (status: TaskStatus) => status === 'failed';
const hasCancelAction = (status: TaskStatus) => status === 'running';

// ─── Create Task Modal ──────────────────────────────────────────
function CreateTaskModal({
  open,
  onClose,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null);

  const create = useMutation({
    mutationFn: () =>
      api.createTask({
        title: title.trim(),
        description: description.trim() || null,
        projectId: projectId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', 'Task created');
      setTitle('');
      setDescription('');
      setProjectId(defaultProjectId ?? null);
      onClose();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Task"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Creating...' : 'Create Task'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fix the login bug"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional context for the agent"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Project</label>
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign Agent Picker ────────────────────────────────────────
function AssignPicker({
  agents,
  onAssign,
  onClose,
  openAbove,
}: {
  agents: Agent[];
  onAssign: (agentId: string) => void;
  onClose: () => void;
  openAbove?: boolean;
}) {
  return (
    <div className={`absolute right-full mr-1 z-30 ${openAbove ? 'bottom-0' : 'top-0'} w-56 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900`}>
      <div className="p-2">
        <div className="px-2 py-1 text-xs font-medium text-zinc-500">Assign to agent</div>
        {agents.length === 0 && (
          <div className="px-2 py-2 text-xs text-zinc-400">No agents available.</div>
        )}
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              onAssign(a.id);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <StatusBadge status={a.status} />
            <span className="truncate">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Row Actions ────────────────────────────────────────────────
function RowActions({
  task,
  agents,
}: {
  task: Task;
  agents: Agent[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const run = useMutation({
    mutationFn: () => api.runTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', 'Execution started');
      navigate('/executions');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const cancel = useMutation({
    mutationFn: () => api.cancelTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast('success', 'Task cancelled');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const retry = useMutation({
    mutationFn: () => api.retryTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      toast('success', 'Retrying task');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const assign = useMutation({
    mutationFn: (agentId: string) => api.assignTask(task.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast('success', 'Task assigned');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const del = useMutation({
    mutationFn: () => api.deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', 'Task deleted');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const canRun = hasRunAction(task);
  const canCancel = hasCancelAction(task.status);
  const canRetry = hasRetryAction(task.status);

  // Close the menu on scroll/resize so the fixed-positioned menu never
  // detaches from its trigger.
  useEffect(() => {
    if (!openMenu) return;
    const close = () => { setOpenMenu(false); setShowAssign(false); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  // Position the menu from the trigger's viewport rect so it is never clipped
  // by the table's overflow container. Recompute when it opens or when the
  // assign submenu changes the menu height.
  useLayoutEffect(() => {
    if (!openMenu || !triggerRef.current || !menuRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuH = menuRef.current.offsetHeight;
    const above = window.innerHeight - rect.bottom < menuH + 8;
    setMenuAbove(above);
    setCoords({
      top: above ? rect.top - menuH - 4 : rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [openMenu, showAssign]);

  const toggleMenu = () => {
    if (!openMenu && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estH = 220;
      const above = window.innerHeight - rect.bottom < estH + 8;
      setMenuAbove(above);
      setCoords({
        top: above ? rect.top - estH - 4 : rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpenMenu((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <MoreVertical size={16} />
      </button>

      {openMenu && coords && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpenMenu(false); setShowAssign(false); }} />
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, right: coords.right }}
            className="z-50 w-44 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="p-1">
              <button
                onClick={() => { setShowAssign(!showAssign); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <User size={14} /> Assign
              </button>
              {canRun && (
                <button
                  disabled={run.isPending}
                  onClick={() => { run.mutate(); setOpenMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Play size={14} /> Run
                </button>
              )}
              {canCancel && (
                <button
                  disabled={cancel.isPending}
                  onClick={() => { cancel.mutate(); setOpenMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Square size={14} /> Cancel
                </button>
              )}
              {canRetry && (
                <button
                  disabled={retry.isPending}
                  onClick={() => { retry.mutate(); setOpenMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <RefreshCw size={14} /> Retry
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm('Delete this task?')) {
                    del.mutate();
                    setOpenMenu(false);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
            {showAssign && (
              <AssignPicker
                agents={agents}
                onAssign={(agentId) => { assign.mutate(agentId); setOpenMenu(false); setShowAssign(false); }}
                onClose={() => { setShowAssign(false); setOpenMenu(false); }}
                openAbove={menuAbove}
              />
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Detail Drawer ──────────────────────────────────────────────
function TaskDetailDrawer({
  taskId,
  onClose,
  agents,
  agentMap,
}: {
  taskId: string;
  onClose: () => void;
  agents: Agent[];
  agentMap: Record<string, Agent>;
}) {
  const { data: task } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId),
  });

  const { data: executions } = useQuery({
    queryKey: ['executions', { taskId }],
    queryFn: () => api.listExecutions({ taskId }),
  });

  const latestExec = executions?.[0];

  const { data: initialLogs } = useQuery({
    queryKey: ['executionLogs', latestExec?.id],
    queryFn: () => (latestExec ? api.getExecutionLogs(latestExec.id) : []),
    enabled: !!latestExec,
  });

  const agent = task?.assignedAgentId ? agentMap[task.assignedAgentId] : null;

  return (
    <>
      <div className="fixed inset-0 z-30 animate-fade-in bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-40 flex h-full w-full max-w-lg animate-drawer-in flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="truncate text-base font-semibold">{task?.title ?? 'Loading...'}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {task && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                </div>
                {task.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Assigned Agent</span>
                  <div className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {agent?.name ?? '-'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Task ID</span>
                  <div className="mt-0.5 font-mono text-zinc-900 dark:text-zinc-100">{task.id}</div>
                </div>
                <div>
                  <span className="text-zinc-500">Created</span>
                  <div className="mt-0.5 text-zinc-900 dark:text-zinc-100">
                    {new Date(task.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Updated</span>
                  <div className="mt-0.5 text-zinc-900 dark:text-zinc-100">
                    {new Date(task.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {latestExec && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Latest Execution
                  </h3>
                  <div className="mb-3 flex items-center gap-3 text-xs">
                    <StatusBadge status={latestExec.status} />
                    <span className="font-mono text-zinc-500">{latestExec.id.slice(0, 8)}</span>
                    {latestExec.exitCode != null && (
                      <span className="font-mono text-zinc-500">exit {latestExec.exitCode}</span>
                    )}
                  </div>
                  {initialLogs && (
                    <LogViewer executionId={latestExec.id} initialLogs={initialLogs} />
                  )}
                </div>
              )}

              {!latestExec && (
                <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  No executions yet. Run this task to start.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────
const STATUS_ORDER: TaskStatus[] = [
  'draft',
  'assigned',
  'workspace_ready',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'retrying',
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  workspace_ready: 'Ready',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  retrying: 'Retrying',
};

function KanbanCard({
  task,
  agents,
  agentMap,
  onSelect,
}: {
  task: Task;
  agents: Agent[];
  agentMap: Record<string, Agent>;
  onSelect: (id: string) => void;
}) {
  const draggable = hasRunAction(task) || hasRetryAction(task.status);
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      onClick={() => onSelect(task.id)}
      className={`${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} rounded-lg border border-zinc-200 bg-white p-2.5 transition-shadow hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {task.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span>{task.assignedAgentId ? (agentMap[task.assignedAgentId]?.name ?? '-') : '-'}</span>
            <span>·</span>
            <span>{timeAgo(task.updatedAt)}</span>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions task={task} agents={agents} />
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({
  tasks,
  agents,
  agentMap,
  onSelectTask,
}: {
  tasks: Task[];
  agents: Agent[];
  agentMap: Record<string, Agent>;
  onSelectTask: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const dropTimeoutRef = useRef<number | null>(null);

  const runMutation = useMutation({
    mutationFn: (id: string) => api.runTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', 'Execution started');
    },
    onError: (e: Error) => {
      toast('error', e.message);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.retryTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast('success', 'Retrying task');
    },
    onError: (e: Error) => {
      toast('error', e.message);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of STATUS_ORDER) map[s] = [];
    for (const t of tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const columnTasks = grouped[status];
        return (
          <div
            key={status}
            className={`flex w-72 flex-shrink-0 flex-col rounded-xl border ${dragOverStatus === status ? 'ring-2 ring-emerald-400' : ''} bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50`}
            onDragOver={(e) => {
              if (status === 'running') {
                e.preventDefault();
                setDragOverStatus(status);
              }
            }}
            onDragLeave={() => {
              if (dropTimeoutRef.current) clearTimeout(dropTimeoutRef.current);
              dropTimeoutRef.current = window.setTimeout(() => setDragOverStatus(null), 50);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('text/plain');
              if (status === 'running' && taskId) {
                const task = tasks.find((t) => t.id === taskId);
                const nextStatus: TaskStatus = task?.status === 'failed' ? 'retrying' : 'running';
                // Move the card immediately so the board reflects the action
                // without waiting for the refetch; the mutation's invalidation
                // reconciles the cache with the server afterwards.
                queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (list) =>
                  list ? list.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)) : list,
                );
                if (task?.status === 'failed') retryMutation.mutate(taskId);
                else runMutation.mutate(taskId);
              }
              setDragOverStatus(null);
            }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <span className="text-xs tabular-nums text-zinc-400">{columnTasks.length}</span>
            </div>

            {/* Cards */}
            <div className="min-h-15 space-y-2 p-2">
              {columnTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">No tasks</div>
              ) : (
                columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    agents={agents}
                    agentMap={agentMap}
                    onSelect={onSelectTask}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────
export function TasksView({
  projectId,
  projectName,
  backTo,
}: {
  projectId?: string;
  projectName?: string;
  backTo?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () => api.listTasks({ projectId }),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.listAgents,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
  });

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  if (tasksLoading) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">
              {projectName ? `${projectName} · Tasks` : 'Tasks'}
            </h1>
          </div>
          <SkeletonTable rows={6} />
        </div>
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                title="Back to projects"
                aria-label="Back to projects"
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {projectName ? `${projectName} · Tasks` : 'Tasks'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 ${viewMode === 'kanban' ? 'bg-emerald-500 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Task
            </Button>
          </div>
        </div>

        {!tasks || tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description="Create a task to get started with your AI coding workflow."
            action={
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> Create Task
              </Button>
            }
          />
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={tasks}
            agents={agents}
            agentMap={agentMap}
            onSelectTask={setSelectedTaskId}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Agent</th>
                  {!projectId && <th className="px-4 py-3">Project</th>}
                  <th className="px-4 py-3">Updated</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => setSelectedTaskId(t.id)}
                  >
                    <td className="max-w-xs truncate px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t.assignedAgentId ? agentMap[t.assignedAgentId]?.name ?? '-' : '-'}
                    </td>
                    {!projectId && (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {t.projectId ? projectMap[t.projectId]?.name ?? '-' : '-'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                      {timeAgo(t.updatedAt)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowActions task={t} agents={agents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projects={projects}
        defaultProjectId={projectId}
      />

      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          agents={agents}
          agentMap={agentMap}
        />
      )}

      <ToastContainer />
    </>
  );
}

export default function Tasks() {
  return <TasksView />;
}
