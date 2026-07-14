import type { FastifyInstance, FastifyReply } from 'fastify';
import { settingsStore } from '../../repositories/index.js';
import type { Settings } from '../../types.js';

interface HttpError extends Error {
  statusCode: number;
}

function httpError(statusCode: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.statusCode = statusCode;
  return err;
}

function handleError(err: unknown, reply: FastifyReply): void {
  const e = err as HttpError;
  reply.code(e.statusCode ?? 500).send({ error: e.message ?? 'Internal server error' });
}

/**
 * Register REST routes for settings CRUD under `/api/settings`.
 */
export function registerSettingsRoutes(app: FastifyInstance): void {
  // GET /api/settings — get all settings
  app.get('/api/settings', async (_req, reply) => {
    try {
      return settingsStore.all();
    } catch (err) {
      handleError(err, reply);
    }
  });

  // PUT /api/settings — update settings
  app.put<{ Body: Partial<Settings> }>('/api/settings', async (req, reply) => {
    try {
      const updated = settingsStore.update(req.body);
      return updated;
    } catch (err) {
      handleError(err, reply);
    }
  });
}
