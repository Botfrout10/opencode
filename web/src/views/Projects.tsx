import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Trash2, MoreVertical } from 'lucide-react';
import { api } from '../api/client';
import type { Project, Task } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FolderPicker } from '../components/FolderPicker';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { toast, ToastContainer } from '../components/Toast';

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

function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workspaceRoot, setWorkspaceRoot] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createProject({
        name: name.trim(),
        description: description.trim() || null,
        workspaceRoot: workspaceRoot.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast('success', 'Project created');
      setName('');
      setDescription('');
      setWorkspaceRoot('');
      onClose();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Project"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating...' : 'Create Project'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Website redesign"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional context for this project"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Workspace Root <span className="text-zinc-400">(optional)</span>
          </label>
          <FolderPicker
            value={workspaceRoot}
            onChange={setWorkspaceRoot}
            placeholder="/absolute/path/to/project-workspace"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Where this project's agent workspaces are created. Leave empty to use the global default.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ProjectCard({
  project,
  taskCount,
  onOpen,
}: {
  project: Project;
  taskCount: number;
  onOpen: () => void;
}) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => api.deleteProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast('success', 'Project deleted');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <div
      className="group relative cursor-pointer"
      onClick={onOpen}
    >
      <Card className="flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <FolderKanban size={20} />
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 w-40 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this project? Tasks stay but become ungrouped.')) {
                        del.mutate();
                      }
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
              {project.description}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </span>
          <span>Updated {timeAgo(project.updatedAt)}</span>
        </div>
      </Card>
    </div>
  );
}

export default function Projects() {
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
  });

  const taskCountByProject = (tasks as Task[]).reduce<Record<string, number>>((acc, t) => {
    if (t.projectId) acc[t.projectId] = (acc[t.projectId] ?? 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </Card>
            ))}
          </div>
        </div>
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Project
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Group related tasks into a project to keep your work organized."
            action={
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> Create Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                taskCount={taskCountByProject[p.id] ?? 0}
                onOpen={() => navigate(`/projects/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />

      <ToastContainer />
    </>
  );
}
