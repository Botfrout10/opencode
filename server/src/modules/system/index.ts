import type { FastifyInstance } from 'fastify';
import { selectFolder } from './folderDialog.js';

export function registerSystemRoutes(app: FastifyInstance): void {
  // POST /api/system/select-folder — open a native OS folder dialog on the
  // server machine and return the chosen absolute path (or null if cancelled).
  app.post('/api/system/select-folder', async (_req, reply) => {
    try {
      const path = await selectFolder();
      return reply.send({ path });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open folder dialog';
      return reply.code(500).send({ error: message });
    }
  });
}
