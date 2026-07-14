# AGENTS.md

Compact guidance for AI coding agents in this repo. Keep lines high-signal; see
`package.json` scripts as the source of truth for commands.

## What this is
- **symphony-orchestrator**: an AI agent orchestration web app. Backend = Fastify
  + TypeScript using Node's built-in `node:sqlite` (sync). Frontend = Vite + React 18
  + Tailwind v4 + TanStack Query + Zustand. npm **workspaces** monorepo (`server`, `web`).

## Layout / boundaries
- `server/src/index.ts` — entry (`buildApp()`). Backend modules live in
  `server/src/modules/*` (each registers its own Fastify routes: tasks, agents,
  repositories, execution, dashboard, settings, …).
- `server/src/db/` — `connection.ts` opens `symphony.db` and runs `migrate()` on
  import; schema is defined **in code** in `migrate.ts` (no SQL migration files).
- `server/mock-agent/` + `server/scripts/seed-mock-agent.ts` — a mock agent for
  local dev without real providers.
- `web/` — SPA; entry `index.html` → `src/main.tsx`. `web/dist/` is the build output.
- `workspaces/` — **generated at runtime**, one subdir per task execution (agent
  scratch space). Contains arbitrary projects (C#, Rust, …), some with their own
  `.git`. Treat as runtime artifacts: do NOT edit or treat as source.

## Commands (run from repo root)
- Install: `npm install`
- Dev (server + web together): `npm run dev`
  - server only: `npm run dev -w server`
  - web only: `npm run dev -w web` (Vite on :5173, proxies `/api` and `/ws` → :3000)
- Build frontend: `npm run build` (or `npm run build -w web`) → `web/dist/`
- Production start: `npm run start` (= `npm run start -w server`); serves `web/dist` if present
- Typecheck: `npm run typecheck` (runs `tsc --noEmit` in server then web)
- No lint and no test runner are configured (see Gotchas).

## Gotchas
- **Server needs `--experimental-sqlite`.** The npm scripts set
  `set NODE_OPTIONS=--experimental-sqlite`. Running `tsx server/src/index.ts`
  directly without that flag fails. Use the npm scripts (or export the env var on
  non-Windows: `NODE_OPTIONS=--experimental-sqlite tsx …`).
- **Web must be built before the server serves the UI.** The server only serves
  `web/dist` if it exists (`server/src/index.ts:48`); otherwise use the Vite dev
  server (port 5173, which proxies to the API). For standalone/prod, build web first.
- **No tests, no linter.** `server/test/` exists but is empty; there is no vitest/
  jest/eslint. Verification = `npm run typecheck` only. Don't invent a test command.
- **DB is created/migrated in code on startup.** Never hand-edit `symphony.db`
  (or its `-wal`/`-shm` files) and never commit it.
- **Git is unusual here.** This directory is NOT its own git repo. The nearest root
  is `C:/Users/mehdi` — a dotfiles repo whose `.gitignore` ignores everything
  except `.agents/`, `.copilot/`, `README.md`. So `git status`/`git log` invoked
  here reflect that outer repo, and this project's files are gitignored. Don't rely
  on git history for this project.

## Environment variables (all optional; defaults in `server/src/config.ts`)
- `PORT` (3000), `HOST` (127.0.0.1)
- `DB_PATH` (`symphony.db`), `WORKSPACE_ROOT` (`workspaces/`)
- `DEFAULT_PROVIDER` (`opencode`), `PERMISSION_POLICY` (`auto-allow` | `ask`)
- `LOG_LEVEL`, `LOG_RETENTION_DAYS`
- Note: the retention var is misspelled in code as `LOG_RETENTION_DAYS`
  (`server/src/config.ts:18`, `process.env.LOG_RETENTION_DAYS`) — match that exactly.
