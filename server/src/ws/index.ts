import { EventEmitter } from 'node:events';
import type { FastifyInstance } from 'fastify';
import type { ExecutionLog } from '../types.js';

/**
 * Process-wide event bus for execution logs.
 * The Execution Engine emits `{ executionId, log }` here; the WS route forwards
 * matching events to subscribed clients. Keeping this as a shared singleton lets
 * the engine and the transport layer stay decoupled.
 */
export const logBus = new EventEmitter();
logBus.setMaxListeners(200);

export function emitLog(executionId: string, log: ExecutionLog): void {
  logBus.emit('log', { executionId, log });
}

export function registerWs(app: FastifyInstance): void {
  // The @fastify/websocket plugin is registered at app level (see index.ts).
  app.get('/ws/executions/:id', { websocket: true }, (socket, req) => {
    const id = (req.params as { id: string }).id;
    const send = (log: ExecutionLog) => {
      try {
        socket.send(JSON.stringify(log));
      } catch {
        /* socket closed */
      }
    };
    const handler = (data: { executionId: string; log: ExecutionLog }) => {
      if (data.executionId === id) send(data.log);
    };
    logBus.on('log', handler);
    socket.on('close', () => logBus.off('log', handler));
    socket.on('error', () => logBus.off('log', handler));
  });
}
