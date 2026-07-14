// Mock ACP Agent — plain Node ESM, no external dependencies.
// Implements the ACP JSON-RPC 2.0 protocol over stdio.
//
// Protocol:
//   Client → Agent: initialize, session/new, prompt
//   Agent → Client: session/update (streaming), result response
//
// Usage:  node server/mock-agent/index.mjs

import { createInterface } from 'node:readline';

// ── Helpers ────────────────────────────────────────────────────────

const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main loop: read JSON-RPC messages from stdin ──────────────────

let sessionId = 'mock-session';

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  if (method === 'initialize') {
    // Respond with capabilities
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '1.0',
        agentCapabilities: { prompt: true, tools: false },
      },
    });
  } else if (method === 'session/new') {
    sessionId = 'mock-session';
    send({ jsonrpc: '2.0', id, result: { sessionId } });
  } else if (method === 'session/prompt') {
    // Handle asynchronously – stream updates before sending result
    handlePrompt(params?.sessionId ?? sessionId, id);
  } else if (method === 'requestPermission') {
    send({ jsonrpc: '2.0', id, result: { allowed: true } });
  }
});

// ── Prompt handler: simulate streaming work ────────────────────────

async function handlePrompt(sid, id) {
  // Initial delay before starting
  await sleep(300);

  const updates = [
    { sessionUpdate: 'system', content: 'Agent session started (mock).' },
    { sessionUpdate: 'agent_message_chunk', content: { text: 'Reading task description and project context...' } },
    {
      sessionUpdate: 'plan',
      content:
        '1. Analyze repository\n2. Implement changes\n3. Run tests & checks\n4. Commit progress',
    },
    { sessionUpdate: 'tool_call', title: 'git status', status: 'completed' },
    { sessionUpdate: 'agent_message_chunk', content: { text: 'Implemented the requested change and ran checks successfully.' } },
    { sessionUpdate: 'tool_call', title: 'git add -A && git commit -m "feat: implement task"', status: 'completed' },
    { sessionUpdate: 'agent_message_chunk', content: { text: 'Done. All checks passed.' } },
  ];

  for (const update of updates) {
    await sleep(200);
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: { sessionId: sid, update },
    });
  }

  // Final result – total runtime ~1.9s fits comfortably in 1.5–2.5s
  send({ jsonrpc: '2.0', id, result: { status: 'completed' } });

  // Give the response a moment to flush, then exit
  process.exit(0);
}
