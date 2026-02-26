# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Token Forge / SignalForge — a React SPA (Vite + TypeScript + Tailwind CSS + shadcn/ui) that connects to a remote Supabase cloud backend. There is no local backend to run; all ~90 edge functions run on Supabase's infrastructure.

### Key commands

See `package.json` scripts:

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 8080) |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Build | `npm run build` |

### Non-obvious notes

- The `.env` file ships with Supabase anon key and project URL pointing to the live cloud instance. The frontend works immediately after `npm install && npm run dev`.
- The Vite dev server binds to `::` (all interfaces) on port **8080**, not the default 5173.
- `npm run lint` exits non-zero due to ~168 pre-existing `@typescript-eslint/no-explicit-any` errors in both `src/` and `supabase/functions/`. These are **not** regressions; the codebase has never been clean on this rule.
- There is only one test file (`src/test/example.test.ts`). Test runner is Vitest with jsdom environment.
- The `supabase/functions/` directory contains Deno edge functions. They are not linted/tested locally by default and are deployed to Supabase Cloud.
- Production build emits large Web3 chunks (wagmi ~2.5 MB). The chunk-size warning is expected.
