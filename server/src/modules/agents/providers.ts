import type { AgentProvider } from '../../types.js';

export const AGENT_PROVIDERS = ['opencode', 'default', 'codex', 'claude', 'custom'] as const;

export interface LaunchSpec {
  command: string;
  args: string[];
}

export function resolveLaunchSpec(
  provider: AgentProvider,
  overrides?: { command?: string; args?: string[] },
): LaunchSpec {
  switch (provider) {
    case 'opencode':
    case 'default':
      return {
        command: overrides?.command ?? 'opencode',
        args: overrides?.args ?? ['acp'],
      };
    case 'codex':
      return {
        command: overrides?.command ?? 'npx',
        args: overrides?.args ?? ['@zed-industries/codex-acp'],
      };
    case 'claude':
      return {
        command: overrides?.command ?? 'npx',
        args: overrides?.args ?? ['@agentclientprotocol/claude-agent-acp'],
      };
    case 'custom':
      if (!overrides?.command) throw new Error('Custom agent requires a command');
      return { command: overrides.command, args: overrides?.args ?? [] };
    default:
      throw new Error(`Unknown agent provider: ${provider}`);
  }
}
