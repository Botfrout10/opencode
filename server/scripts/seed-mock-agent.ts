import { agents } from '../src/repositories/index.js';
import { getMockLaunchSpec } from '../src/modules/execution/index.js';

const spec = getMockLaunchSpec();
const existing = (agents.list() as Array<{ name: string; id: string }>).find(
  (a) => a.name === 'Mock Agent',
);

if (!existing) {
  agents.create({
    name: 'Mock Agent',
    provider: 'custom',
    command: spec.command,
    args: spec.args,
    maxConcurrency: 1,
  });
  console.log('Created Mock Agent:', spec);
} else {
  console.log('Mock Agent already exists:', existing.id);
}
