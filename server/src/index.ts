import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';

import { config } from './config.js';
import { registerWs } from './ws/index.js';
import { registerDashboardRoutes } from './modules/dashboard/index.js';
import { registerTaskRoutes } from './modules/tasks/index.js';
import { registerProjectRoutes } from './modules/projects/index.js';
import { registerAgentRoutes } from './modules/agents/index.js';
import { registerExecutionRoutes } from './modules/execution/index.js';
import { registerSettingsRoutes } from './modules/settings/index.js';
import { registerSystemRoutes } from './modules/system/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Tolerate empty bodies on JSON POSTs (e.g. run/cancel/retry with no payload).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '' || body == null) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch (e) {
      done(e as Error);
    }
  });

  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  registerDashboardRoutes(app);
  registerTaskRoutes(app);
  registerProjectRoutes(app);
  registerAgentRoutes(app);
  registerExecutionRoutes(app);
  registerSettingsRoutes(app);
  registerSystemRoutes(app);
  registerWs(app);

  // Serve the built SPA in production (web/dist). Dev uses Vite proxy instead.
  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    await app.register(staticPlugin, { root: webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
        reply.code(404).send({ error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  buildApp()
    .then((app) =>
      app.listen({ port: config.port, host: config.host }).then(() => {
        app.log.info(`Symphony listening on http://${config.host}:${config.port}`);
      }),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
