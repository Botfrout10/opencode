import type { FastifyInstance } from 'fastify';
import type {
  DashboardSummary,
  TaskStatus,
  AgentStatus,
  ExecutionStatus,
} from '../../types.js';
import { tasks, agents, executions } from '../../repositories/index.js';

function httpError(status: number, message: string): Error {
  const e: any = new Error(message);
  e.statusCode = status;
  return e;
}

export function registerDashboardRoutes(app: FastifyInstance): void {
  // GET /api/dashboard — return aggregate summary
  app.get('/api/dashboard', async (_req, reply) => {
    try {
      const allTasks = tasks.list();
      const allAgents = agents.list();
      const allExecutions = executions.list();

      // Initialize all status counters to zero
      const taskStatuses: TaskStatus[] = [
        'draft',
        'assigned',
        'workspace_ready',
        'running',
        'succeeded',
        'failed',
        'cancelled',
        'retrying',
      ];
      const agentStatuses: AgentStatus[] = ['idle', 'busy', 'offline'];
      const execStatuses: ExecutionStatus[] = [
        'pending',
        'running',
        'succeeded',
        'failed',
        'cancelled',
      ];

      const taskCounts = Object.fromEntries(
        taskStatuses.map((s) => [s, 0]),
      ) as Record<TaskStatus, number>;
      for (const t of allTasks) taskCounts[t.status]++;

      const agentCounts = Object.fromEntries(
        agentStatuses.map((s) => [s, 0]),
      ) as Record<AgentStatus, number>;
      for (const a of allAgents) agentCounts[a.status]++;

      const executionCounts = Object.fromEntries(
        execStatuses.map((s) => [s, 0]),
      ) as Record<ExecutionStatus, number>;
      for (const e of allExecutions) executionCounts[e.status]++;

      // Last 10 executions with joined task title and agent name
      const recentExecutions = allExecutions.slice(0, 10).map((e) => ({
        ...e,
        taskTitle: tasks.get(e.taskId)?.title ?? '',
        agentName: e.agentId ? agents.get(e.agentId)?.name ?? '' : '',
      }));

      const summary: DashboardSummary = {
        tasks: taskCounts,
        agents: agentCounts,
        executions: executionCounts,
        recentExecutions,
      };

      return summary;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}
