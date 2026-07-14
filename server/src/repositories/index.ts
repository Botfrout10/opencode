import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { db } from '../db/connection.js';
import type {
  Agent,
  AgentProvider,
  AgentStatus,
  CreateAgentInput,
  CreateProjectInput,
  CreateTaskInput,
  Execution,
  ExecutionLog,
  ExecutionStatus,
  LogKind,
  PatchProjectInput,
  Project,
  Settings,
  Task,
  TaskStatus,
} from '../types.js';

// ---------------- Tasks ----------------
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  status: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
}
const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  projectId: r.project_id,
  status: r.status as TaskStatus,
  assignedAgentId: r.assigned_agent_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const tasks = {
  list(filter?: { status?: TaskStatus; agentId?: string; projectId?: string }): Task[] {
    const where: string[] = [];
    const params: any[] = [];
    if (filter?.status) { where.push('status = ?'); params.push(filter.status); }
    if (filter?.agentId) { where.push('assigned_agent_id = ?'); params.push(filter.agentId); }
    if (filter?.projectId) { where.push('project_id = ?'); params.push(filter.projectId); }
    const sql = `SELECT * FROM tasks${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
    return (db.prepare(sql).all(...params) as unknown as TaskRow[]).map(mapTask);
  },
  get(id: string): Task | undefined {
    const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    return r ? mapTask(r) : undefined;
  },
  create(input: CreateTaskInput): Task {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO tasks (id,title,description,project_id,status,assigned_agent_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
    ).run(id, input.title, input.description ?? null, input.projectId ?? null, 'draft', null, now, now);
    return this.get(id)!;
  },
  update(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'projectId' | 'status' | 'assignedAgentId'>>): Task | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const title = patch.title ?? cur.title;
    const description = patch.description !== undefined ? patch.description : cur.description;
    const projectId = patch.projectId !== undefined ? patch.projectId : cur.projectId;
    const status = patch.status ?? cur.status;
    const assignedAgentId = patch.assignedAgentId !== undefined ? patch.assignedAgentId : cur.assignedAgentId;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE tasks SET title=?, description=?, project_id=?, status=?, assigned_agent_id=?, updated_at=? WHERE id=?',
    ).run(title, description, projectId, status, assignedAgentId, now, id);
    return this.get(id);
  },
  remove(id: string): void {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  },
};

// ---------------- Agents ----------------
interface AgentRow {
  id: string;
  name: string;
  provider: string;
  command: string;
  args: string;
  env: string;
  status: string;
  max_concurrency: number;
  created_at: string;
  updated_at: string;
}
const mapAgent = (r: AgentRow): Agent => ({
  id: r.id,
  name: r.name,
  provider: r.provider as AgentProvider,
  command: r.command,
  args: JSON.parse(r.args),
  env: JSON.parse(r.env),
  status: r.status as AgentStatus,
  maxConcurrency: r.max_concurrency,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const agents = {
  list(): Agent[] {
    return (db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as unknown as AgentRow[]).map(mapAgent);
  },
  get(id: string): Agent | undefined {
    const r = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    return r ? mapAgent(r) : undefined;
  },
  create(input: CreateAgentInput): Agent {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO agents (id,name,provider,command,args,env,status,max_concurrency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      input.name,
      input.provider,
      input.command ?? '',
      JSON.stringify(input.args ?? []),
      JSON.stringify(input.env ?? {}),
      'idle',
      input.maxConcurrency ?? 1,
      now,
      now,
    );
    return this.get(id)!;
  },
  update(id: string, patch: Partial<Pick<Agent, 'name' | 'provider' | 'command' | 'args' | 'env' | 'status' | 'maxConcurrency'>>): Agent | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const name = patch.name ?? cur.name;
    const provider = patch.provider ?? cur.provider;
    const command = patch.command ?? cur.command;
    const args = patch.args ?? cur.args;
    const env = patch.env ?? cur.env;
    const status = patch.status ?? cur.status;
    const maxConcurrency = patch.maxConcurrency ?? cur.maxConcurrency;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE agents SET name=?, provider=?, command=?, args=?, env=?, status=?, max_concurrency=?, updated_at=? WHERE id=?',
    ).run(name, provider, command, JSON.stringify(args), JSON.stringify(env), status, maxConcurrency, now, id);
    return this.get(id);
  },
  setStatus(id: string, status: AgentStatus): void {
    db.prepare('UPDATE agents SET status=?, updated_at=? WHERE id=?').run(status, new Date().toISOString(), id);
  },
  remove(id: string): void {
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  },
};

// ---------------- Projects ----------------
interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  workspace_root: string | null;
  created_at: string;
  updated_at: string;
}
const mapProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  workspaceRoot: r.workspace_root,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const projects = {
  list(): Project[] {
    return (db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as unknown as ProjectRow[]).map(mapProject);
  },
  get(id: string): Project | undefined {
    const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
    return r ? mapProject(r) : undefined;
  },
  create(input: CreateProjectInput): Project {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO projects (id,name,description,workspace_root,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    ).run(id, input.name, input.description ?? null, input.workspaceRoot ?? null, now, now);
    return this.get(id)!;
  },
  update(id: string, patch: PatchProjectInput): Project | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const name = patch.name ?? cur.name;
    const description = patch.description !== undefined ? patch.description : cur.description;
    const workspaceRoot = patch.workspaceRoot !== undefined ? patch.workspaceRoot : cur.workspaceRoot;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE projects SET name=?, description=?, workspace_root=?, updated_at=? WHERE id=?',
    ).run(name, description, workspaceRoot, now, id);
    return this.get(id);
  },
  remove(id: string): void {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};

// ---------------- Executions ----------------
interface ExecRow {
  id: string;
  task_id: string;
  agent_id: string | null;
  workspace_path: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  exit_code: number | null;
}
const mapExec = (r: ExecRow): Execution => ({
  id: r.id,
  taskId: r.task_id,
  agentId: r.agent_id,
  workspacePath: r.workspace_path,
  status: r.status as ExecutionStatus,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  exitCode: r.exit_code,
});

export const executions = {
  list(filter?: { taskId?: string; agentId?: string; status?: ExecutionStatus }): Execution[] {
    const where: string[] = [];
    const params: any[] = [];
    if (filter?.taskId) { where.push('task_id = ?'); params.push(filter.taskId); }
    if (filter?.agentId) { where.push('agent_id = ?'); params.push(filter.agentId); }
    if (filter?.status) { where.push('status = ?'); params.push(filter.status); }
    const sql = `SELECT * FROM executions${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY started_at DESC NULLS LAST, id DESC`;
    return (db.prepare(sql).all(...params) as unknown as ExecRow[]).map(mapExec);
  },
  get(id: string): Execution | undefined {
    const r = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as ExecRow | undefined;
    return r ? mapExec(r) : undefined;
  },
  create(input: { taskId: string; agentId: string | null; workspacePath?: string | null }): Execution {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO executions (id,task_id,agent_id,workspace_path,status,started_at) VALUES (?,?,?,?,?,?)',
    ).run(id, input.taskId, input.agentId, input.workspacePath ?? null, 'running', now);
    return this.get(id)!;
  },
  update(id: string, patch: Partial<Pick<Execution, 'status' | 'workspacePath' | 'endedAt' | 'exitCode' | 'agentId'>>): Execution | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    const status = patch.status ?? cur.status;
    const workspacePath = patch.workspacePath !== undefined ? patch.workspacePath : cur.workspacePath;
    const endedAt = patch.endedAt !== undefined ? patch.endedAt : cur.endedAt;
    const exitCode = patch.exitCode !== undefined ? patch.exitCode : cur.exitCode;
    const agentId = patch.agentId !== undefined ? patch.agentId : cur.agentId;
    db.prepare(
      'UPDATE executions SET status=?, workspace_path=?, ended_at=?, exit_code=?, agent_id=? WHERE id=?',
    ).run(status, workspacePath, endedAt, exitCode, agentId, id);
    return this.get(id);
  },
};

// ---------------- Execution logs ----------------
interface LogRow {
  id: string;
  execution_id: string;
  seq: number;
  kind: string;
  payload: string;
  ts: string;
}
const mapLog = (r: LogRow): ExecutionLog => ({
  id: r.id,
  executionId: r.execution_id,
  seq: r.seq,
  kind: r.kind as LogKind,
  payload: JSON.parse(r.payload),
  ts: r.ts,
});

export const executionLogs = {
  list(executionId: string): ExecutionLog[] {
    return (db.prepare('SELECT * FROM execution_logs WHERE execution_id = ? ORDER BY seq ASC').all(executionId) as unknown as LogRow[]).map(mapLog);
  },
  add(executionId: string, kind: LogKind, payload: unknown): ExecutionLog {
    const id = randomUUID();
    const seq = (db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS n FROM execution_logs WHERE execution_id = ?').get(executionId) as { n: number }).n;
    const ts = new Date().toISOString();
    db.prepare('INSERT INTO execution_logs (id,execution_id,seq,kind,payload,ts) VALUES (?,?,?,?,?,?)').run(
      id, executionId, seq, kind, JSON.stringify(payload ?? {}), ts,
    );
    return { id, executionId, seq, kind, payload: payload ?? {}, ts };
  },
};

// ---------------- Settings ----------------
export const settingsStore = {
  all(): Settings {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return {
      defaultProvider: map.defaultProvider ?? 'opencode',
      workspaceRoot: map.workspaceRoot ?? '',
      permissionPolicy: (map.permissionPolicy as Settings['permissionPolicy']) ?? 'auto-allow',
      logRetentionDays: Number(map.logRetentionDays ?? 30),
    };
  },
  update(patch: Partial<Settings>): Settings {
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v));
    return this.all();
  },
};
