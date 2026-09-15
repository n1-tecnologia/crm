# External Integrations

**Analysis Date:** 2026-09-15

## APIs & External Services

**Supabase (Database + Auth):**
- **Service:** Supabase (PostgreSQL + Auth service)
- **What it's used for:**
  - PostgreSQL database hosting and access
  - User authentication and session management
  - JWT-based authentication via Supabase Auth
- **Web SDK:** `@supabase/supabase-js` ^2.116.0
- **SSR Helper:** `@supabase/ssr` ^0.12.7
- **Admin SDK:** `@supabase/supabase-js` (via admin client with `SUPABASE_SECRET_KEY`)
- **Environment variables:**
  - Web (public): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - API (admin): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- **File references:**
  - Auth proxy: `apps/web/src/proxy.ts` (middleware for token refresh)
  - Seed creation: `apps/api/src/autenticacao/criar-usuarios-do-seed.ts`

## Data Storage

**Database:**
- **Type/Provider:** PostgreSQL via Supabase
- **Connection:** `DATABASE_URL` environment variable (Postgres URI)
- **Client:** `pg` ^8.23.0 (native Node.js driver)
- **Pool Config:** Max 10 connections, located in `apps/api/src/persistencia/conexao.ts`
- **TLS Handling:**
  - Local (localhost/127.0.0.1): No TLS verification
  - Remote (Supabase): TLS enabled with `rejectUnauthorized: false` (CA verification pending)
  - Future: Supabase CA certificate to be pinned to repository

**Migrations:**
- **Pattern:** SQL files in `apps/api/migracoes/` (e.g., `001-plataforma.sql`)
- **Executor:** TypeScript migration runner in `apps/api/src/persistencia/migrar.ts`
- **Tracking:** `plataforma.migracoes` table (schema + table auto-created)
- **Idempotency:** Each migration file runs once; renaming causes re-execution
- **Transactional:** Each migration wrapped in transaction; failure rolls back
- **CLI:** `npm run migrar -w @n1/api` (vite-node execution)

**Current Schema:**
- Schema: `plataforma` (contains `migracoes` tracking table)
- Initial migration: `001-plataforma.sql` (creates main data structures)
- Location: `apps/api/migracoes/`

**File Storage:**
- Not detected - no S3, Cloud Storage, or file upload integration present

**Caching:**
- Not implemented - state hydration via full DataState load from database
  - See: `apps/api/src/persistencia/repositorio.ts` (loads entire Workspace state)
  - Performance: ~900 records, ~475 KB per workspace
  - Scalability note: If workspace grows, load specific subsets instead of full state

## Authentication & Identity

**Auth Provider:**
- **Service:** Supabase Auth (JWT-based)
- **Flow:**
  1. User logs in via Supabase Auth → JWT token issued
  2. Token stored in HTTP-only cookie (managed by `@supabase/ssr`)
  3. Next.js middleware (`proxy.ts`) auto-refreshes token before expiry
  4. User ID resolved from JWT → finds Member in domain seed
  5. Member ID becomes session context for all operations

**Implementation:**
- **Web:** Middleware in `apps/web/src/proxy.ts` handles refresh and protection
- **Session Context:** `apps/web/src/dados/store.ts` (session + userId)
- **Member Resolution:** `@n1/dominio` seed maps userId → Member

**Development Users:**
- Created via `npm run usuarios:seed -w @n1/api`
- Source: `apps/api/src/autenticacao/criar-usuarios-do-seed.ts`
- Each Member in seed gets a Supabase Auth user with:
  - ID: matches `Member.userId` (for direct lookup)
  - Email: generated from Member ID (via `emailDoSeed()`)
  - Password: dev default `n1-teste-2026` (via `SEED_SENHA` env var, overrideable)
  - Auto-confirmed: email_confirm = true

**Environment Variables:**
- `SUPABASE_URL` - API endpoint
- `SUPABASE_SECRET_KEY` - Admin key (server-only)
- `NEXT_PUBLIC_SUPABASE_URL` - Client-accessible endpoint
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Client-accessible key

## Monitoring & Observability

**Error Tracking:**
- Not detected - no Sentry, Datadog, or error logging service integrated

**Logs:**
- **Approach:** `console.log()` via Node.js stdout
- **Examples:**
  - Migration status: `apps/api/src/persistencia/migrar.ts`
  - Seed creation: `apps/api/src/autenticacao/criar-usuarios-do-seed.ts`
- **Production:** No structured logging service configured

## CI/CD & Deployment

**Hosting:**
- **Platform:** Not configured - deployment target undefined
- **Candidates:** Vercel (Next.js native), self-hosted Node.js, or custom

**CI Pipeline:**
- Not detected - no GitHub Actions, GitLab CI, or other pipeline configured
- **Quality gates available:**
  - `npm run check` (typecheck, lint, tokens, tests) can be used as pre-commit/CI step

**Development Server:**
- Runs on `localhost:3000` by default (Next.js)
- Accessible on network via `172.16.0.127:3000` (configured in `next.config.ts`)

## Environment Configuration

**Web App (apps/web/.env.example):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API endpoint (public)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase client key (public)

**API App (apps/api/.env.example):**
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase API endpoint (for admin auth)
- `SUPABASE_SECRET_KEY` - Supabase admin key (secret)
- `SEED_SENHA` - Password for dev users (default: `n1-teste-2026`)

**Configuration Sources:**
- `.env` files (git-ignored, local development)
- `.env.example` files document required variables
- `apps/api/src/persistencia/conexao.ts` includes custom env loader (no dotenv dep)

**Secrets Storage:**
- Development: `.env` files (git-ignored)
- Production: Environment variables via hosting platform (Vercel, self-hosted, etc.)
- No secret management service integrated (Vault, Secrets Manager, etc.)

## Webhooks & Callbacks

**Incoming:**
- Not detected - no webhook endpoints configured for external services

**Outgoing:**
- Not detected - no outbound integrations to external webhooks or event services

## Persistence Details

**Data Layer Pattern:**
- Location: `apps/api/src/persistencia/`
- Architecture:
  1. `conexao.ts` - PostgreSQL connection pool initialization
  2. `repositorio.ts` - Serialization/hydration between `DataState` (domain) and Postgres JSONB
  3. `unidade-de-trabalho.ts` - Transaction coordination
  4. `migrar.ts` - Schema migration executor
- **Strategy:** Load entire workspace state, execute domain operation, save diffs
- **Format:** JSONB in Postgres (canonical JSON serialization for diffing)

**Testing:**
- Test file: `apps/api/src/persistencia/persistencia.test.ts`
- Condition: Tests require `DATABASE_URL` environment variable
- Skipped if: `DATABASE_URL` not set

---

*Integration audit: 2026-09-15*
