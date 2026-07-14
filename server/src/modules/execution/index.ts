import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import {
  tasks,
  agents,
  executions,
  executionLogs,
  settingsStore,
  projects,
} from '../../repositories/index.js';
import { emitLog } from '../../ws/index.js';
import { createWorkspace, teardownWorkspace } from '../workspaces/workspaceManager.js';
import { buildContext } from '../context/contextBuilder.js';
import { resolveLaunchSpec } from '../agents/providers.js';
import { config, repoRoot } from '../../config.js';
import type {
  Agent,
  Execution,
  ExecutionLog,
  ExecutionStatus,
  LogKind,
  Settings,
  Task,
} from '../../types.js';
import { runAgentSession } from './acpClient.js';

// ── Module state ──────────────────────────────────────────────────
const controllers = new Map<string, AbortController>();

// ── Error helper ──────────────────────────────────────────────────
function httpError(status: number, message: string): Error {
  const e = new Error(message) as Error & { statusCode: number };
  e.statusCode = status;
  return e;
}

// ── Internal execution driver ─────────────────────────────────────
async function execute(
  task: Task,
  agent: Agent,
  workspacePath: string,
): Promise<Execution> {
  const settings = settingsStore.all();
  const context = await buildContext(workspacePath, task);

  const exec = executions.create({
    taskId: task.id,
    agentId: agent.id,
    workspacePath,
  });

  tasks.update(task.id, { status: 'running' });
  agents.setStatus(agent.id, 'busy');

  const spec = resolveLaunchSpec(agent.provider, {
    command: agent.command,
    args: agent.args,
  });

  const controller = new AbortController();
  controllers.set(exec.id, controller);

  try {
    const { exitCode } = await runAgentSession({
      command: spec.command,
      args: spec.args,
      env: agent.env,
      cwd: workspacePath,
      prompt: context,
      executionId: exec.id,
      policy: settings.permissionPolicy,
      onLog: (kind: LogKind, payload: unknown) => {
        const log = executionLogs.add(exec.id, kind, payload);
        emitLog(exec.id, log);
      },
      signal: controller.signal,
    });

    // A cancellation may have updated the execution status while the agent
    // was shutting down. Don't overwrite a terminal status set by cancelTask.
    const current = executions.get(exec.id);
    if (current && current.status !== 'running') {
      return current;
    }

    const ok = exitCode === 0;
    executions.update(exec.id, {
      status: ok ? 'succeeded' : 'failed',
      endedAt: new Date().toISOString(),
      exitCode,
    });
    tasks.update(task.id, { status: ok ? 'succeeded' : 'failed' });
  } catch (e) {
    executions.update(exec.id, {
      status: 'failed',
      endedAt: new Date().toISOString(),
    });
    tasks.update(task.id, { status: 'failed' });
    throw e;
  } finally {
    agents.setStatus(agent.id, 'idle');
    controllers.delete(exec.id);
  }

  return executions.get(exec.id)!;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Resolve the workspace root for a task: a project-level override if set,
 * otherwise the global setting (which itself defaults to config.workspaceRoot).
 */
function resolveWorkspaceRoot(task: Task, settings: Settings): string {
  if (task.projectId) {
    const project = projects.get(task.projectId);
    if (project?.workspaceRoot) return project.workspaceRoot;
  }
  return settings.workspaceRoot || config.workspaceRoot;
}

export async function runTask(taskId: string): Promise<Execution> {
  const task = tasks.get(taskId);
  if (!task) throw httpError(404, 'Task not found');

  if (!task.assignedAgentId) {
    throw httpError(409, 'Task is not assigned to an agent');
  }
  if (task.status === 'running') {
    throw httpError(409, 'Task already running');
  }

  const agent = agents.get(task.assignedAgentId);
  if (!agent) throw httpError(404, 'Agent not found');

  const runningCount = executions.list({ agentId: agent.id, status: 'running' }).length;
  if (runningCount >= agent.maxConcurrency) {
    throw httpError(409, `Agent "${agent.name}" is at its max concurrency (${agent.maxConcurrency})`);
  }

  const settings = settingsStore.all();
  const workspacePath = await createWorkspace(taskId, settings, resolveWorkspaceRoot(task, settings));

  return execute(task, agent, workspacePath);
}

export async function cancelTask(taskId: string): Promise<void> {
  const running = executions.list({ taskId, status: 'running' })[0];
  if (!running) throw httpError(409, 'No running execution to cancel');

  controllers.get(running.id)?.abort();

  executions.update(running.id, {
    status: 'cancelled',
    endedAt: new Date().toISOString(),
  });
  tasks.update(taskId, { status: 'cancelled' });

  if (running.agentId) agents.setStatus(running.agentId, 'idle');
  controllers.delete(running.id);
}

export async function retryTask(taskId: string): Promise<Execution> {
  const task = tasks.get(taskId);
  if (!task) throw httpError(404, 'Task not found');

  const [last] = executions.list({ taskId });
  if (!last) throw httpError(409, 'No execution to retry');
  if (last.status !== 'failed') {
    throw httpError(409, 'Only failed executions can be retried');
  }

  const agent = last.agentId ? agents.get(last.agentId) : null;
  if (!agent) throw httpError(404, 'Agent not found');

  const runningCount = executions.list({ agentId: agent.id, status: 'running' }).length;
  if (runningCount >= agent.maxConcurrency) {
    throw httpError(409, `Agent "${agent.name}" is at its max concurrency (${agent.maxConcurrency})`);
  }

  const workspacePath =
    last.workspacePath ??
    (await createWorkspace(
      taskId,
      settingsStore.all(),
      resolveWorkspaceRoot(task, settingsStore.all()),
    ));

  tasks.update(taskId, { status: 'retrying' });

  return execute(task, agent, workspacePath);
}

export function getMockLaunchSpec(): { command: string; args: string[] } {
  return {
    command: 'node',
    args: [path.join(repoRoot, 'server', 'mock-agent', 'index.mjs')],
  };
}

// ── HTTP routes ───────────────────────────────────────────────────

export function registerExecutionRoutes(app: FastifyInstance): void {
  // GET /api/executions – list executions with optional filters
  app.get('/api/executions', async (request) => {
    const { taskId, agentId, status } = request.query as {
      taskId?: string;
      agentId?: string;
      status?: string;
    };
    const filter: {
      taskId?: string;
      agentId?: string;
      status?: ExecutionStatus;
    } = {};
    if (taskId) filter.taskId = taskId;
    if (agentId) filter.agentId = agentId;
    if (status) filter.status = status as ExecutionStatus;
    return executions.list(filter);
  });

  // GET /api/executions/:id – single execution
  app.get<{ Params: { id: string } }>(
    '/api/executions/:id',
    async (request, reply) => {
      const exec = executions.get(request.params.id);
      if (!exec) {
        return reply.code(404).send({ error: 'Execution not found' });
      }
      return exec;
    },
  );

  // GET /api/executions/:id/logs – execution logs
  app.get<{ Params: { id: string } }>(
    '/api/executions/:id/logs',
    async (request, reply) => {
      const exec = executions.get(request.params.id);
      if (!exec) {
        return reply.code(404).send({ error: 'Execution not found' });
      }
      return executionLogs.list(request.params.id);
    },
  );
}
