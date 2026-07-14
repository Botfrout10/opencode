import type { FastifyInstance } from 'fastify';
import type { CreateProjectInput, PatchProjectInput } from '../../types.js';
import { projects } from '../../repositories/index.js';

function httpError(status: number, message: string): Error {
  const e: any = new Error(message);
  e.statusCode = status;
  return e;
}

export function registerProjectRoutes(app: FastifyInstance): void {
  // GET /api/projects — list all projects
  app.get('/api/projects', async (_req, reply) => {
    try {
      return projects.list();
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /api/projects — create a project
  app.post('/api/projects', async (req, reply) => {
    try {
      const body = req.body as CreateProjectInput;
      if (!body.name || body.name.trim().length === 0) {
        throw httpError(400, 'Name is required');
      }
      const project = projects.create(body);
      return reply.code(201).send(project);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /api/projects/:id — get a single project
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    try {
      const project = projects.get(req.params.id);
      if (!project) throw httpError(404, 'Project not found');
      return project;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // PATCH /api/projects/:id — update a project
  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    try {
      const patch = req.body as PatchProjectInput;
      const updated = projects.update(req.params.id, patch);
      if (!updated) throw httpError(404, 'Project not found');
      return updated;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /api/projects/:id — delete a project
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    try {
      const project = projects.get(req.params.id);
      if (!project) throw httpError(404, 'Project not found');
      projects.remove(req.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}
