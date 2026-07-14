import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/config.ts -> repo root is two levels up
const root = path.resolve(__dirname, '..', '..');

export type PermissionPolicy = 'auto-allow' | 'ask';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.DB_PATH ?? path.join(root, 'symphony.db'),
  workspaceRoot: process.env.WORKSPACE_ROOT ?? path.join(root, 'workspaces'),
  webDist: path.join(root, 'web', 'dist'),
  defaultProvider: (process.env.DEFAULT_PROVIDER ?? 'opencode') as string,
  permissionPolicy: (process.env.PERMISSION_POLICY ?? 'auto-allow') as PermissionPolicy,
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS ?? 30),
};

export const repoRoot = root;
