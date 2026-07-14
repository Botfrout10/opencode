import fs from 'node:fs';
import path from 'node:path';
import type { Task } from '../../types.js';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);

// --------------- helpers ---------------

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function getPackageJsonSummary(workspacePath: string): Promise<string | null> {
  const raw = await tryReadFile(path.join(workspacePath, 'package.json'));
  if (!raw) return null;

  try {
    const pkg = JSON.parse(raw);
    const lines: string[] = [];

    if (pkg.name) lines.push(`name: ${pkg.name}`);
    if (pkg.scripts) {
      lines.push(`scripts: ${Object.keys(pkg.scripts).join(', ')}`);
    }
    if (pkg.dependencies) {
      lines.push(`dependencies: ${Object.keys(pkg.dependencies).join(', ')}`);
    }
    if (pkg.devDependencies) {
      lines.push(`devDependencies: ${Object.keys(pkg.devDependencies).join(', ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
  } catch {
    return null;
  }
}

async function listSourceFiles(workspacePath: string): Promise<string[]> {
  const absoluteFiles: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && SOURCE_EXT.has(path.extname(entry.name))) {
        absoluteFiles.push(fullPath);
      }
    }
  }

  await walk(workspacePath);

  absoluteFiles.sort();
  // Limit to ~30 files, return relative paths
  return absoluteFiles.slice(0, 30).map((f) => path.relative(workspacePath, f));
}

// --------------- public API ---------------

/**
 * Assemble the context prompt sent to an AI coding agent.
 *
 * Reads key project files (AGENTS.md, README, package.json, tsconfig.json),
 * lists up to 30 source files, and composes a Markdown prompt with task
 * description, project context, and instructions.
 */
export async function buildContext(workspacePath: string, task: Task): Promise<string> {
  const lines: string[] = [];

  // -- Task --
  lines.push('# Task');
  lines.push(`Title: ${task.title}`);
  lines.push(`Description: ${task.description ?? '—'}`);
  lines.push('');

  // -- Project Context --
  lines.push('# Project Context');
  lines.push('');

  // AGENTS.md (truncated to ~4000 chars)
  const agentsMd = await tryReadFile(path.join(workspacePath, 'AGENTS.md'));
  if (agentsMd) {
    lines.push(agentsMd.slice(0, 4000));
    lines.push('');
  }

  // README.md or README (truncated to ~4000 chars)
  const readmeContent =
    (await tryReadFile(path.join(workspacePath, 'README.md'))) ??
    (await tryReadFile(path.join(workspacePath, 'README')));
  if (readmeContent) {
    lines.push(readmeContent.slice(0, 4000));
    lines.push('');
  }

  // package.json summary
  const pkgSummary = await getPackageJsonSummary(workspacePath);
  if (pkgSummary) {
    lines.push(pkgSummary);
    lines.push('');
  }

  // tsconfig.json (truncated)
  const tsconfig = await tryReadFile(path.join(workspacePath, 'tsconfig.json'));
  if (tsconfig) {
    lines.push(tsconfig.slice(0, 2000));
    lines.push('');
  }

  // Source file listing
  const sourceFiles = await listSourceFiles(workspacePath);
  if (sourceFiles.length > 0) {
    lines.push(sourceFiles.join('\n'));
    lines.push('');
  }

  // -- Instructions --
  lines.push('# Instructions');
  lines.push('1. Read the task and the project context above.');
  lines.push('2. Analyze the repository.');
  lines.push('3. Create an implementation plan.');
  lines.push('4. Implement the changes.');
  lines.push('5. Run tests & checks; fix failures until successful.');
  lines.push('6. Commit your progress with a clear message.');

  return lines.join('\n');
}
