import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT,
      project_id      TEXT,
      status          TEXT NOT NULL DEFAULT 'draft',
      assigned_agent_id TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      workspace_root  TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      provider        TEXT NOT NULL,
      command         TEXT NOT NULL,
      args            TEXT NOT NULL DEFAULT '[]',
      env             TEXT NOT NULL DEFAULT '{}',
      status          TEXT NOT NULL DEFAULT 'idle',
      max_concurrency INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS executions (
      id              TEXT PRIMARY KEY,
      task_id         TEXT NOT NULL,
      agent_id        TEXT,
      workspace_path  TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      started_at      TEXT,
      ended_at        TEXT,
      exit_code       INTEGER
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id              TEXT PRIMARY KEY,
      execution_id    TEXT NOT NULL,
      seq             INTEGER NOT NULL,
      kind            TEXT NOT NULL,
      payload         TEXT NOT NULL DEFAULT '{}',
      ts              TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_execution_logs_exec ON execution_logs(execution_id, seq);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
  `);

  // Add project_id column to tasks for existing databases (safe, idempotent).
  // Must run before any index that references the column.
  const hasProjectCol = db
    .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('tasks') WHERE name = 'project_id'")
    .get() as { c: number };
  if (hasProjectCol.c === 0) {
    db.exec('ALTER TABLE tasks ADD COLUMN project_id TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)');

  // Add workspace_root column to projects for existing databases (safe, idempotent).
  const hasProjectWsCol = db
    .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('projects') WHERE name = 'workspace_root'")
    .get() as { c: number };
  if (hasProjectWsCol.c === 0) {
    db.exec('ALTER TABLE projects ADD COLUMN workspace_root TEXT');
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM settings').get() as { c: number };
  if (count.c === 0) {
    const defaults: Record<string, string> = {
      defaultProvider: config.defaultProvider,
      workspaceRoot: config.workspaceRoot,
      permissionPolicy: config.permissionPolicy,
      logRetentionDays: String(config.logRetentionDays),
    };
    const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) stmt.run(k, v);
  }

  // Remove the deprecated repository linkage from tasks (replaced by the
  // project's workspace root / global settings for workspace creation).
  const hasRepoCol = db
    .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('tasks') WHERE name = 'repository_id'")
    .get() as { c: number };
  if (hasRepoCol.c > 0) {
    db.exec('ALTER TABLE tasks DROP COLUMN repository_id');
  }
  db.exec('DROP TABLE IF EXISTS repositories');
}
