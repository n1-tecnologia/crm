# Technology Stack

**Analysis Date:** 2026-09-15

## Languages

**Primary:**
- TypeScript 5 - All application code across monorepo workspaces
- JavaScript (ES2017+) - Build scripts, configuration files
- SQL - Database migrations and queries via pg driver

**Secondary:**
- CSS - Styling via Tailwind CSS, global styles in `src/estilos/tokens.css`

## Runtime

**Environment:**
- Node.js (version not pinned; development uses current stable)

**Package Manager:**
- npm (npm workspaces)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Web Frontend:**
- Next.js 16.3.4 - Full-stack React framework with App Router (`apps/web`)
- React 19.2.8 - UI component library
- React DOM 19.2.8 - DOM rendering

**API Backend:**
- Skeleton architecture - no HTTP transport layer chosen yet (`apps/api/CONTEXT.md`)
- HTTP transport selection pending (candidates: Fastify, Hono, Nest, Next.js route handlers)
- Persistence layer using PostgreSQL via `pg` driver

**Domain Layer:**
- Pure TypeScript - No framework dependencies (`packages/dominio`)
- Only external dep: zod for validation

**Testing:**
- Vitest 5.0.0 - Test runner for all workspaces
  - Run: `npm run test` (all workspaces)
  - Watch: `npm run test:watch` (in individual workspace)
  - Config: `vitest.config.*` (implicit, uses defaults)

**Build/Dev Tools:**
- Turbopack - Next.js bundler (default in Next.js 16)
- TypeScript 5 - Type checking via `tsc --noEmit`
- Vite Node - CLI execution for migrations and seed scripts
- PostCSS 4 - CSS processing with Tailwind
- ESLint 9 - Code linting

## Key Dependencies

**Critical:**

- `@n1/dominio` (workspace) - Core business logic, types, operations, derived reads
  - Only dependency: `zod` ^4.6.1
  - Consumed by: `@n1/web` and `@n1/api`

- `@supabase/supabase-js` ^2.116.0 - Postgres database client and Auth SDK
  - Used in: `apps/api` for database operations, `apps/web` for auth via proxy
  - Auth: Supabase Auth with JWT tokens in cookies

- `@supabase/ssr` ^0.12.7 - Supabase Auth integration for Next.js SSR
  - Used in: `apps/web/src/proxy.ts` (middleware for auth refresh)
  - Handles cookie-based session persistence and token refresh

- `pg` ^8.23.0 - PostgreSQL client library (native driver)
  - Used in: `apps/api/src/persistencia/conexao.ts`
  - Provides connection pooling (max 10 connections)
  - Custom pool initialization with TLS handling for remote Postgres

- `zod` ^4.6.1 - TypeScript-first schema validation
  - Used in: `packages/dominio` for type validation
  - Re-exported by: `@n1/dominio`, consumed by web and API

**UI & State:**

- `zustand` ^5.0.15 - Lightweight state management
  - Used in: `apps/web/src/dados/store.ts`
  - Pattern: Per-request store via React Context (App Router SSR pattern)
  - Alternatives rejected: Redux (too heavy), Context alone (no selectors)

- `lucide-react` ^1.44.0 - Icon library
  - SVG-based, tree-shakeable icons

- `tailwindcss` ^4 - Utility-first CSS framework
  - PostCSS-based processing via `@tailwindcss/postcss` ^4
  - Config: Tailwind v4 supports configuration via CSS only (no config file required)
  - Design tokens canonical source: `apps/web/src/estilos/tokens.css`
  - Validation: `npm run verificar:tokens` enforces color constants

**Infrastructure:**

- `server-only` ^0.0.1 - Prevents accidental server code in client bundles
  - Used in: `apps/web` for SSR-only modules

- `@types/pg` ^8.23.1 - TypeScript types for pg driver
- `@types/node` ^24.13.4 - Node.js types
- `@types/react` ^19, `@types/react-dom` ^19 - React type definitions

**Dev Tools:**

- `eslint` ^9 - Linting
  - Config: `eslint-config-next` 16.3.4 (web), custom for others
  - File: `apps/web/eslint.config.mjs` (ESLint flat config format)

- `@tailwindcss/postcss` ^4 - PostCSS plugin for Tailwind v4
- `@vitejs/plugin-react` ^6.1.1 - Vite React plugin (unused in build, present for tooling)
- `vite-node` ^6.0.0 - Execute TypeScript files directly (migrations, seed scripts)

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json`
  - Target: ES2017
  - Strict mode enabled
  - Module resolution: bundler
  - Key flags: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- Per-workspace: `apps/web/tsconfig.json`, `apps/api/tsconfig.json`, `packages/dominio/tsconfig.json`

**Next.js:**
- File: `apps/web/next.config.ts`
- Transpile: `@n1/dominio` (TypeScript workspace package)
- Dev origins: `localhost`, `127.0.0.1`, `172.16.0.127` (for HMR over network)

**ESLint:**
- File: `apps/web/eslint.config.mjs`
- Extends: ESLint config Next core-web-vitals + TypeScript
- Format: Flat config (ESLint 9)

**Environment Variables:**
- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public, in cookies)
- API: `DATABASE_URL` (PostgreSQL connection string), `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (admin key), `SEED_SENHA` (dev password)
- Files: `.env.example` in each app; `.env` and `.env.local` are git-ignored
- Loading: Custom implementation in `apps/api/src/persistencia/conexao.ts` (no dotenv dependency)

## Build

**Development:**
- `npm run dev` - Runs Next.js dev server (`apps/web`)
- Watch modes active: TypeScript, ESLint, vitest

**Production:**
- `npm run build` - Next.js standalone build
- `npm run start` - Runs Next.js production server
- Output: `.next/` (Next.js build artifact)

**Quality Checks:**
- `npm run check` - Runs all: typecheck, lint, token verification, tests
  - TypeScript: `npm run typecheck --workspaces`
  - ESLint: `npm run lint -w @n1/web`
  - Tokens: `npm run verificar:tokens -w @n1/web`
  - Tests: `npm run test --workspaces`

## Platform Requirements

**Development:**
- Node.js (current stable; ES2017 target supports Node 4.0+)
- PostgreSQL 12+ (for local development or Supabase)
- Text editor / IDE with TypeScript support
- npm 10+ (for workspaces support)

**Production:**
- Node.js 18+ (for Next.js 16 and Supabase client)
- PostgreSQL database (Supabase or self-hosted)
- Supabase project (for Auth and database)
- Deployment target: Vercel (Next.js native), or Node.js hosting for custom

## Monorepo Structure

**Workspaces (`npm workspaces`):**
```
apps/
  web/       @n1/web (Next.js frontend)
  api/       @n1/api (backend skeleton)
packages/
  dominio/   @n1/dominio (business logic, shared)
```

**Scripts at root:**
- Run from root with `-w <package>` flag: `npm run typecheck -w @n1/web`
- Cross-workspace: `npm run test --workspaces --if-present`

---

*Stack analysis: 2026-09-15*
