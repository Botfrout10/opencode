import type { FastifyInstance } from 'fastify';
import type { CreateTaskInput } from '../../types.js';
import { tasks, agents } from '../../repositories/index.js';
import { runTask, cancelTask, retryTask } from '../execution/index.js';

function httpError(status: number, message: string): Error {
  const e: any = new Error(message);
  e.statusCode = status;
  return e;
}

export function registerTaskRoutes(app: FastifyInstance): void {
  // GET /api/tasks — list tasks with optional status and agentId filters
  app.get('/api/tasks', async (req, reply) => {
    try {
      const query = req.query as { status?: string; agentId?: string; projectId?: string };
      return tasks.list({
        status: query.status as any,
        agentId: query.agentId,
        projectId: query.projectId,
      });
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/tasks — create a new task
  app.post('/api/tasks', async (req, reply) => {
    try {
      const body = req.body as CreateTaskInput;
      if (!body.title || body.title.trim().length === 0) {
        throw httpError(400, 'Title is required');
      }
      const task = tasks.create(body);
      return reply.code(201).send(task);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /api/tasks/:id — get a single task
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');
      return task;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // PATCH /api/tasks/:id — update a task
  app.patch<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    try {
      const patch = req.body as Partial<{
        title: string;
        description: string | null;
        status: string;
        assignedAgentId: string | null;
      }>;
      const updated = tasks.update(req.params.id, patch as any);
      if (!updated) throw httpError(404, 'Task not found');
      return updated;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /api/tasks/:id — delete a task
  app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');
      tasks.remove(req.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/tasks/:id/assign — assign a task to an agent
  app.post<{ Params: { id: string } }>('/api/tasks/:id/assign', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');

      const { agentId } = req.body as { agentId: string };
      if (!agentId) throw httpError(400, 'agentId is required');

      const agent = agents.get(agentId);
      if (!agent) throw httpError(404, 'Agent not found');

      if (task.status === 'running') throw httpError(409, 'Cannot assign a running task');

      const updated = tasks.update(req.params.id, {
        assignedAgentId: agentId,
        status: 'assigned',
      });
      return updated;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/tasks/:id/run — execute a task
  app.post<{ Params: { id: string } }>('/api/tasks/:id/run', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');

      const exec = await runTask(req.params.id);
      return reply.code(201).send(exec);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/tasks/:id/cancel — cancel a running task
  app.post<{ Params: { id: string } }>('/api/tasks/:id/cancel', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');

      await cancelTask(req.params.id);
      return tasks.get(req.params.id);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/tasks/:id/retry — retry a failed/cancelled task
  app.post<{ Params: { id: string } }>('/api/tasks/:id/retry', async (req, reply) => {
    try {
      const task = tasks.get(req.params.id);
      if (!task) throw httpError(404, 'Task not found');

      const exec = await retryTask(req.params.id);
      return reply.code(201).send(exec);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}
