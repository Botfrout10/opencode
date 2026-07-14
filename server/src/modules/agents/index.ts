import type { FastifyInstance } from 'fastify';
import type { CreateAgentInput, AgentProvider } from '../../types.js';
import { agents } from '../../repositories/index.js';
import { resolveLaunchSpec, AGENT_PROVIDERS } from './providers.js';
import { execFile } from 'node:child_process';

function httpError(status: number, message: string): Error {
  const e: any = new Error(message);
  e.statusCode = status;
  return e;
}

function executableFromCommand(command: string): string {
  const trimmed = command.trim();
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

export function registerAgentRoutes(app: FastifyInstance): void {
  // GET /api/agents — list all agents
  app.get('/api/agents', async (_req, reply) => {
    try {
      return agents.list();
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/agents — create a new agent
  app.post('/api/agents', async (req, reply) => {
    try {
      const body = req.body as CreateAgentInput;
      if (!body.provider || !AGENT_PROVIDERS.includes(body.provider)) {
        throw httpError(400, 'A valid provider is required');
      }
      if (!body.name || body.name.trim().length === 0) {
        throw httpError(400, 'Name is required');
      }
      const spec = resolveLaunchSpec(body.provider, {
        command: body.command,
        args: body.args,
      });
      const agent = agents.create({
        name: body.name,
        provider: body.provider,
        command: spec.command,
        args: spec.args,
        env: body.env ?? {},
        maxConcurrency: body.maxConcurrency ?? 1,
      });
      return reply.code(201).send(agent);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /api/agents/:id — get a single agent
  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const agent = agents.get(req.params.id);
      if (!agent) throw httpError(404, 'Agent not found');
      return agent;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // PATCH /api/agents/:id — update an agent
  app.patch<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const current = agents.get(req.params.id);
      if (!current) throw httpError(404, 'Agent not found');

      const patch = req.body as Partial<{
        name: string;
        provider: AgentProvider;
        command: string;
        args: string[];
        env: Record<string, string>;
        status: string;
        maxConcurrency: number;
      }>;

      // If provider changed or command becomes empty, recompute via resolveLaunchSpec
      if (patch.provider && patch.provider !== current.provider) {
        const spec = resolveLaunchSpec(patch.provider, {
          command: patch.command,
          args: patch.args,
        });
        patch.command = spec.command;
        patch.args = spec.args;
      } else if (patch.command !== undefined && patch.command.trim().length === 0) {
        const spec = resolveLaunchSpec(
          (patch.provider ?? current.provider) as AgentProvider,
          { command: patch.command, args: patch.args },
        );
        patch.command = spec.command;
        patch.args = spec.args;
      }

      const updated = agents.update(req.params.id, patch as any);
      return updated;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // DELETE /api/agents/:id — delete an agent
  app.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    try {
      const agent = agents.get(req.params.id);
      if (!agent) throw httpError(404, 'Agent not found');
      agents.remove(req.params.id);
      return { ok: true };
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /api/agents/:id/probe — check if agent command is available
  app.post<{ Params: { id: string } }>('/api/agents/:id/probe', async (req, reply) => {
    try {
      const agent = agents.get(req.params.id);
      if (!agent) throw httpError(404, 'Agent not found');

      const cmd = executableFromCommand(agent.command);
      const probeCmd = process.platform === 'win32' ? 'where' : 'which';

      return new Promise<{ available: boolean; error?: string }>((resolve) => {
        execFile(probeCmd, [cmd], (err) => {
          if (err) {
            resolve({ available: false, error: `${cmd} not found on PATH` });
          } else {
            resolve({ available: true });
          }
        });
      });
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}
