export type AgentProvider = 'default' | 'codex' | 'claude' | 'opencode' | 'custom';
export type AgentStatus = 'idle' | 'busy' | 'offline';
export type TaskStatus =
  | 'draft'
  | 'assigned'
  | 'workspace_ready'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'retrying';
export type ExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type LogKind =
  | 'system'
  | 'message'
  | 'thought'
  | 'tool_call'
  | 'plan'
  | 'permission'
  | 'error';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  status: TaskStatus;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceRoot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  provider: AgentProvider;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: AgentStatus;
  maxConcurrency: number;
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  taskId: string;
  agentId: string | null;
  workspacePath: string | null;
  status: ExecutionStatus;
  startedAt: string | null;
  endedAt: string | null;
  exitCode: number | null;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  seq: number;
  kind: LogKind;
  payload: unknown;
  ts: string;
}

export interface Settings {
  defaultProvider: string;
  workspaceRoot: string;
  permissionPolicy: 'auto-allow' | 'ask';
  logRetentionDays: number;
}

// ---- API input DTOs ----
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  projectId?: string | null;
}
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  workspaceRoot?: string | null;
}
export interface PatchProjectInput {
  name?: string;
  description?: string | null;
  workspaceRoot?: string | null;
}
export interface CreateAgentInput {
  name: string;
  provider: AgentProvider;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  maxConcurrency?: number;
}
export interface DashboardSummary {
  tasks: Record<TaskStatus, number>;
  agents: Record<AgentStatus, number>;
  executions: Record<ExecutionStatus, number>;
  recentExecutions: Array<Execution & { taskTitle: string; agentName: string }>;
}
