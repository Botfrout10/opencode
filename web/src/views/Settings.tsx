import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Check } from 'lucide-react';
import { api } from '../api/client';
import type { Settings } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FolderPicker } from '../components/FolderPicker';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { toast, ToastContainer } from '../components/Toast';

function SettingsForm({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient();
  const [defaultProvider, setDefaultProvider] = useState(settings.defaultProvider);
  const [workspaceRoot, setWorkspaceRoot] = useState(settings.workspaceRoot);
  const [permissionPolicy, setPermissionPolicy] = useState(settings.permissionPolicy);
  const [logRetentionDays, setLogRetentionDays] = useState(settings.logRetentionDays.toString());
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.updateSettings({
        defaultProvider: defaultProvider.trim(),
        workspaceRoot: workspaceRoot.trim(),
        permissionPolicy,
        logRetentionDays: parseInt(logRetentionDays, 10) || 30,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('success', 'Settings saved');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const input =
    'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';

  return (
    <Card className="p-6">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Default Provider
          </label>
          <input
            value={defaultProvider}
            onChange={(e) => setDefaultProvider(e.target.value)}
            placeholder="claude"
            className={input}
          />
          <p className="mt-1 text-xs text-zinc-400">The default AI provider for new agents.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Workspace Root
          </label>
          <FolderPicker
            value={workspaceRoot}
            onChange={setWorkspaceRoot}
            placeholder="/home/user/projects"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Default base directory for agent workspaces. Each project can override this.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Permission Policy
          </label>
          <select
            value={permissionPolicy}
            onChange={(e) => setPermissionPolicy(e.target.value as Settings['permissionPolicy'])}
            className={input}
          >
            <option value="auto-allow">Auto Allow</option>
            <option value="ask">Ask</option>
          </select>
          <p className="mt-1 text-xs text-zinc-400">
            Whether agents can execute without asking for permission.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Log Retention (days)
          </label>
          <input
            type="number"
            min={1}
            value={logRetentionDays}
            onChange={(e) => setLogRetentionDays(e.target.value)}
            className={input}
          />
          <p className="mt-1 text-xs text-zinc-400">How long to keep execution logs.</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check size={14} /> Saved
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  if (isLoading) {
    return (
      <>
        <div className="space-y-4">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <Card className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          </Card>
        </div>
        <ToastContainer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SettingsIcon size={32} className="mb-3 text-red-400" stroke="1.5" />
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load settings. {error instanceof Error ? error.message : ''}
          </p>
        </div>
        <ToastContainer />
      </>
    );
  }

  if (!settings) {
    return (
      <>
        <EmptyState
          icon={SettingsIcon}
          title="Settings unavailable"
          description="Could not load application settings."
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <SettingsForm settings={settings} />
      </div>
      <ToastContainer />
    </>
  );
}
