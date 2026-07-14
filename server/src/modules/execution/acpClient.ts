import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { LogKind } from '../../types.js';

export interface RunAgentOpts {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  prompt: string;
  executionId: string;
  policy: 'auto-allow' | 'ask';
  onLog: (kind: LogKind, payload: unknown) => void;
  signal?: AbortSignal;
}

/**
 * Runs an ACP (Agent Client Protocol) session over stdio.
 *
 * Spawns the agent subprocess, drives the JSON-RPC 2.0 handshake
 * (initialize → session/new → session/prompt), streams log
 * notifications via onLog, and resolves with the exit code when the
 * agent finishes the prompt turn.
 *
 * Verified against `opencode acp` (v1.17.x):
 *  - initialize.protocolVersion is a NUMBER (e.g. 1), not a string.
 *  - session/new requires { cwd, mcpServers } and returns { sessionId }.
 *  - session/prompt requires { sessionId, prompt: [{ type: "text", text }] }
 *    and returns { stopReason }. The subprocess does NOT exit on its own,
 *    so we resolve on the prompt response and then terminate it.
 */
export async function runAgentSession(
  opts: RunAgentOpts,
): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Swallow EPIPE/write errors that can occur if we write to stdin after
    // the child has already exited (e.g. racing with a cancel signal).
    child.stdin?.on('error', () => {});

    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    let nextId = 1;
    let sessionId: string | null = null;
    let settled = false;

    // Accumulate streamed agent message/thought chunks into single log lines.
    let pendingText = '';
    let pendingKind: LogKind | null = null;
    const flushPending = () => {
      if (pendingText.length > 0 && pendingKind) {
        opts.onLog(pendingKind, pendingText);
        pendingText = '';
        pendingKind = null;
      }
    };
    const appendChunk = (kind: LogKind, text: string) => {
      if (pendingKind && pendingKind !== kind) flushPending();
      pendingText += text;
      pendingKind = kind;
    };

    const resolveOnce = (value: { exitCode: number }) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const rejectOnce = (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    // ── stdout: JSON-RPC line processor ──────────────────────────
    const stdoutRl = createInterface({ input: child.stdout! });

    stdoutRl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        opts.onLog('system', { stream: 'stdout', line: trimmed });
        return;
      }

      const id = msg.id as number | undefined;
      const method = msg.method as string | undefined;

      // 1) Response to a pending request we sent
      if (id != null && pending.has(id)) {
        const entry = pending.get(id)!;
        pending.delete(id);
        entry.resolve(msg);
        return;
      }

      // 2) Agent notification (method, no id)
      if (method && id == null) {
        if (method === 'session/update') {
          handleSessionUpdate(msg.params as Record<string, unknown> | undefined);
        }
        return;
      }

      // 3) Agent → Client request (method + id), e.g. requestPermission
      if (method && id != null) {
        if (method === 'requestPermission') {
          // 'ask' is not yet wired to a UI prompt; fail closed so the agent
          // session doesn't hang forever waiting for a permission response.
          const allowed = opts.policy === 'auto-allow';
          const response = JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: { allowed },
          });
          child.stdin!.write(response + '\n');
        }
        return;
      }
    });

    // Map a session/update notification to a clean log entry.
    function handleSessionUpdate(params: Record<string, unknown> | undefined): void {
      const update = (params?.update ?? {}) as Record<string, unknown>;
      const type = update.sessionUpdate as string | undefined;

      switch (type) {
        case 'agent_message_chunk': {
          const content = (update.content ?? {}) as Record<string, unknown>;
          if (typeof content.text === 'string') appendChunk('message', content.text);
          return;
        }
        case 'agent_thought_chunk': {
          const content = (update.content ?? {}) as Record<string, unknown>;
          if (typeof content.text === 'string') appendChunk('thought', content.text);
          return;
        }
        case 'tool_call': {
          flushPending();
          const title = (update.title as string) ?? (update.kind as string) ?? 'tool';
          const status = (update.status as string) ?? 'pending';
          const locs = Array.isArray(update.locations)
            ? (update.locations as Array<{ path?: string }>)
                .map((l) => l?.path)
                .filter(Boolean)
                .join(', ')
            : '';
          opts.onLog(
            'tool_call',
            locs ? `${title} (${status}) @ ${locs}` : `${title} (${status})`,
          );
          return;
        }
        case 'tool_call_update': {
          flushPending();
          const title = (update.title as string) ?? 'tool';
          const status = (update.status as string) ?? '';
          opts.onLog('tool_call', `${title} → ${status}`);
          return;
        }
        case 'plan':
          flushPending();
          opts.onLog('plan', stringify(update.content ?? update));
          return;
        case 'permission':
          flushPending();
          opts.onLog('permission', stringify(update.content ?? update));
          return;
        case 'available_commands_update':
        case 'usage_update':
          // Noisy bookkeeping — skip from the log stream.
          return;
        default:
          flushPending();
          opts.onLog('system', update);
          return;
      }
    }

    // ── stderr: forward as system log ─────────────────────────────
    const stderrRl = createInterface({ input: child.stderr! });
    stderrRl.on('line', (line: string) => {
      opts.onLog('system', { stream: 'stderr', line });
    });

    // ── Abort signal ──────────────────────────────────────────────
    if (opts.signal) {
      opts.signal.addEventListener(
        'abort',
        () => {
          flushPending();
          child.kill('SIGTERM');
        },
        { once: true },
      );
    }

    // ── Process exit / error ──────────────────────────────────────
    child.on('exit', (code) => {
      stdoutRl.close();
      stderrRl.close();
      flushPending();
      for (const entry of pending.values()) entry.reject(new Error('Agent process exited'));
      pending.clear();
      resolveOnce({ exitCode: code ?? 1 });
    });

    child.on('error', (err) => {
      stdoutRl.close();
      stderrRl.close();
      flushPending();
      rejectOnce(err);
    });

    // ── JSON-RPC request helper ───────────────────────────────────
    function sendRequest(method: string, params: unknown): Promise<unknown> {
      return new Promise((resolvePending, rejectPending) => {
        const id = nextId++;
        pending.set(id, { resolve: resolvePending, reject: rejectPending });
        const request = JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          params,
        });
        child.stdin!.write(request + '\n');
      });
    }

    // ── Main ACP handshake sequence ──────────────────────────────
    (async () => {
      try {
        // Initialize (protocolVersion MUST be a number)
        await sendRequest('initialize', {
          protocolVersion: 1,
          clientCapabilities: {},
          clientInfo: { name: 'symphony', version: '0.1.0' },
        });

        // Create session (requires cwd + mcpServers)
        const sessionResp = (await sendRequest('session/new', {
          cwd: opts.cwd,
          mcpServers: [],
        })) as Record<string, unknown>;
        if (sessionResp.error) {
          throw new Error(
            `session/new failed: ${(sessionResp.error as Record<string, unknown>).message ?? 'unknown error'}`,
          );
        }
        sessionId =
          ((sessionResp?.result as Record<string, unknown> | undefined)
            ?.sessionId as string | undefined) ?? null;
        if (!sessionId) {
          throw new Error('session/new did not return a sessionId');
        }

        // Send the prompt (prompt is an array of content blocks)
        const promptResp = (await sendRequest('session/prompt', {
          sessionId,
          prompt: [{ type: 'text', text: opts.prompt }],
        })) as Record<string, unknown>;
        if (promptResp.error) {
          throw new Error(
            `session/prompt failed: ${(promptResp.error as Record<string, unknown>).message ?? 'unknown error'}`,
          );
        }

        flushPending();
        const stopReason = ((promptResp?.result as Record<string, unknown> | undefined)
          ?.stopReason as string | undefined) ?? 'end_turn';
        const exitCode = stopReason === 'error' ? 1 : 0;

        resolveOnce({ exitCode });
        // opencode acp does not exit on its own — terminate the subprocess.
        child.kill('SIGTERM');
      } catch (err) {
        flushPending();
        if (!settled) {
          child.kill('SIGTERM');
          rejectOnce(err as Error);
        }
      }
    })();
  });
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
