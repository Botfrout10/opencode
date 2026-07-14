import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { api } from '../api/client';
import { TasksView } from './Tasks';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { ToastContainer } from '../components/Toast';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <ToastContainer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex items-center justify-center py-16 text-center text-sm text-red-600 dark:text-red-400">
          Failed to load project. {error instanceof Error ? error.message : ''}
        </div>
        <ToastContainer />
      </>
    );
  }

  if (!project) {
    return (
      <>
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="This project may have been deleted."
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Project</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.description}</p>
        )}
        <p className="mt-2 text-xs text-zinc-400">
          Workspace:{' '}
          <span className="font-mono text-zinc-600 dark:text-zinc-300">
            {project.workspaceRoot || 'Global default'}
          </span>
        </p>
      </div>

      <TasksView projectId={project.id} projectName={project.name} backTo="/projects" />
    </div>
  );
}
