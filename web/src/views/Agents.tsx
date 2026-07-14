import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Activity,
  Bot,
} from 'lucide-react';
import { api } from '../api/client';
import type { Agent, AgentProvider } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { toast, ToastContainer } from '../components/Toast';

const PROVIDERS: AgentProvider[] = ['default', 'codex', 'claude', 'opencode', 'custom'];

// ─── Agent Form Modal ───────────────────────────────────────────
function AgentFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Agent;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState<AgentProvider>(initial?.provider ?? 'default');
  const [command, setCommand] = useState(initial?.command ?? '');
  const [args, setArgs] = useState(initial?.args?.join(' ') ?? '');
  const [maxConcurrency, setMaxConcurrency] = useState(initial?.maxConcurrency?.toString() ?? '1');

  const isEdit = !!initial;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        provider,
        command: provider === 'custom' ? command.trim() : undefined,
        args: provider === 'custom' ? args.trim().split(/\s+/).filter(Boolean) : undefined,
        maxConcurrency: parseInt(maxConcurrency, 10) || 1,
      };
      if (isEdit) {
        return api.patchAgent(initial.id, payload);
      }
      return api.createAgent(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast('success', isEdit ? 'Agent updated' : 'Agent created');
      onClose();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Agent' : 'New Agent'}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Agent'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-agent"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as AgentProvider)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        {provider === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Command</label>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Arguments (space-separated)</label>
              <input
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="ts-node src/main.ts"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Max Concurrency</label>
          <input
            type="number"
            min={1}
            value={maxConcurrency}
            onChange={(e) => setMaxConcurrency(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Agent Card ─────────────────────────────────────────────────
function AgentCard({
  agent,
  onEdit,
}: {
  agent: Agent;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();

  const del = useMutation({
    mutationFn: () => api.deleteAgent(agent.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast('success', 'Agent deleted');
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const probe = useMutation({
    mutationFn: () => api.probeAgent(agent.id),
    onSuccess: (res) => {
      if (res.available) {
        toast('success', `${agent.name} is available`);
      } else {
        toast('error', `${agent.name} unavailable${res.error ? `: ${res.error}` : ''}`);
      }
    },
    onError: (e: Error) => toast('error', e.message),
  });

  return (
    <Card className="flex flex-col p-3">
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{agent.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded bg-zinc-100 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {agent.provider}
            </span>
            <StatusBadge status={agent.status} />
          </div>
        </div>
      </div>

      <div className="mb-2 space-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">cmd:</span>
          <code className="truncate font-mono">{agent.command} {agent.args.join(' ')}</code>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">concurrency:</span>
          <code className="font-mono">{agent.maxConcurrency}</code>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil size={13} /> Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={probe.isPending}
          onClick={() => probe.mutate()}
        >
          <Activity size={13} /> Probe
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={del.isPending}
          onClick={() => {
            if (window.confirm(`Delete agent "${agent.name}"?`)) del.mutate();
          }}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </Card>
  );
}

// ─── Main View ──────────────────────────────────────────────────
export default function Agents() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: api.listAgents,
  });

  if (isLoading) {
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Agents</h1>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
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
          <h1 className="text-lg font-semibold tracking-tight">Agents</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Agent
          </Button>
        </div>

        {!agents || agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents registered"
            description="Add an AI coding agent to start orchestrating tasks."
            action={
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> Add Agent
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onEdit={() => setEditingAgent(a)}
              />
            ))}
          </div>
        )}
      </div>

      <AgentFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editingAgent && (
        <AgentFormModal
          open
          initial={editingAgent}
          onClose={() => setEditingAgent(null)}
        />
      )}

      <ToastContainer />
    </>
  );
}
