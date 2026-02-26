# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Two apps live in this repo:

1. **Root (`/`)** — Token Forge / SignalForge: a React SPA (Vite + TypeScript + Tailwind CSS + shadcn/ui) connecting to a remote Supabase cloud backend. No local backend needed; ~90 edge functions run on Supabase's infrastructure.
2. **`/rmint`** — A Next.js 16 app (TypeScript + Tailwind CSS + ESLint, App Router, `src/` directory).

### Key commands

#### Root (Token Forge)

See root `package.json` scripts:

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 8080) |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Build | `npm run build` |

#### rmint (Next.js)

See `rmint/package.json` scripts:

| Task | Command |
|------|---------|
| Dev server | `cd rmint && npm run dev` (port 3000) |
| Lint | `cd rmint && npm run lint` |
| Build | `cd rmint && npm run build` |

### Non-obvious notes

- The root `.env` file ships with Supabase anon key and project URL pointing to the live cloud instance. The frontend works immediately after `npm install && npm run dev`.
- The Vite dev server binds to `::` (all interfaces) on port **8080**, not the default 5173.
- `npm run lint` (root) exits non-zero due to ~168 pre-existing `@typescript-eslint/no-explicit-any` errors in both `src/` and `supabase/functions/`. These are **not** regressions; the codebase has never been clean on this rule.
- There is only one test file (`src/test/example.test.ts`). Test runner is Vitest with jsdom environment.
- The `supabase/functions/` directory contains Deno edge functions. They are not linted/tested locally by default and are deployed to Supabase Cloud.
- Production build emits large Web3 chunks (wagmi ~2.5 MB). The chunk-size warning is expected.
- The `rmint` Next.js app uses Turbopack by default. Its build warns about multiple lockfiles in the workspace; this is harmless.
