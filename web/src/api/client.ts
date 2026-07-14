import type {
  Agent,
  AgentProvider,
  DashboardSummary,
  Execution,
  ExecutionLog,
  Project,
  Settings,
  Task,
  TaskStatus,
} from '../types';

// Loose input shapes used by forms.
export type CreateTaskInput = { title: string; description?: string | null; projectId?: string | null };
export type PatchTaskInput = Partial<Pick<Task, 'title' | 'description' | 'projectId' | 'status' | 'assignedAgentId'>>;
export type CreateProjectInput = { name: string; description?: string | null; workspaceRoot?: string | null };
export type PatchProjectInput = Partial<CreateProjectInput>;
export type CreateAgentInput = { name: string; provider: AgentProvider; command?: string; args?: string[]; env?: Record<string, string>; maxConcurrency?: number };
export type PatchAgentInput = Partial<CreateAgentInput & { status: Agent['status'] }>;
export type PatchSettingsInput = Partial<Settings>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; ts: string }>('/api/health'),
  dashboard: () => request<DashboardSummary>('/api/dashboard'),

  // Tasks
  listTasks: (params?: { status?: TaskStatus; agentId?: string; projectId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.agentId) q.set('agentId', params.agentId);
    if (params?.projectId) q.set('projectId', params.projectId);
    const qs = q.toString();
    return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },
  getTask: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (input: CreateTaskInput) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  patchTask: (id: string, patch: PatchTaskInput) => request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTask: (id: string) => request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  assignTask: (id: string, agentId: string) => request<Task>(`/api/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify({ agentId }) }),
  runTask: (id: string) => request<Execution>(`/api/tasks/${id}/run`, { method: 'POST', body: '{}' }),
  cancelTask: (id: string) => request<Task>(`/api/tasks/${id}/cancel`, { method: 'POST', body: '{}' }),
  retryTask: (id: string) => request<Execution>(`/api/tasks/${id}/retry`, { method: 'POST', body: '{}' }),

  // Agents
  listAgents: () => request<Agent[]>('/api/agents'),
  getAgent: (id: string) => request<Agent>(`/api/agents/${id}`),
  createAgent: (input: CreateAgentInput) => request<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(input) }),
  patchAgent: (id: string, patch: PatchAgentInput) => request<Agent>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAgent: (id: string) => request<{ ok: true }>(`/api/agents/${id}`, { method: 'DELETE' }),
  probeAgent: (id: string) => request<{ available: boolean; error?: string }>(`/api/agents/${id}/probe`, { method: 'POST' }),

  // Projects
  listProjects: () => request<Project[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (input: CreateProjectInput) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  patchProject: (id: string, patch: PatchProjectInput) => request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),

  // Executions
  listExecutions: (params?: { taskId?: string; agentId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.taskId) q.set('taskId', params.taskId);
    if (params?.agentId) q.set('agentId', params.agentId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Execution[]>(`/api/executions${qs ? `?${qs}` : ''}`);
  },
  getExecution: (id: string) => request<Execution>(`/api/executions/${id}`),
  getExecutionLogs: (id: string) => request<ExecutionLog[]>(`/api/executions/${id}/logs`),

  // Settings
  getSettings: () => request<Settings>('/api/settings'),
  updateSettings: (patch: PatchSettingsInput) => request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  // System
  selectFolder: () => request<{ path: string | null }>('/api/system/select-folder', { method: 'POST', body: '{}' }),
};

// Subscribe to live execution logs over WebSocket.
export function subscribeExecutionLogs(
  executionId: string,
  onLog: (log: ExecutionLog) => void,
  onStatus?: (status: 'connecting' | 'open' | 'closed' | 'error') => void,
): () => void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws/executions/${executionId}`;
  const ws = new WebSocket(url);
  onStatus?.('connecting');
  ws.onopen = () => onStatus?.('open');
  ws.onmessage = (ev) => {
    try {
      onLog(JSON.parse(ev.data) as ExecutionLog);
    } catch {
      /* ignore malformed */
    }
  };
  ws.onclose = () => onStatus?.('closed');
  ws.onerror = () => onStatus?.('error');
  return () => ws.close();
}
