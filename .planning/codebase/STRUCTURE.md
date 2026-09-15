# Codebase Structure

**Analysis Date:** 2026-09-15

## Directory Layout

```
crm-n1/                                    # Monorepo root
├── package.json                           # Root workspace config
├── CONTEXT.md                             # Dependency direction map
├── CLAUDE.md                              # Agent instructions
├── PRD-FRONTEND-NAVEGAVEL.md              # Product requirements
├── ontologia/                             # Shared ontology definitions
│   ├── 01-espaco-de-trabalho/
│   ├── 02-estrutura-de-trabalho/
│   ├── 03-crm/
│   ├── 04-ia/
│   └── 05-paineis/
├── docs/                                  # Shared documentation
│   ├── 02-mapa-ux/
│   ├── 03-fundacao/ARQUITETURA.md        # Frontend architecture (canonical)
│   ├── 04-wireframes/
│   ├── 05-design-system/
│   ├── 06-telas/
│   ├── 07-processos/
│   └── 08-migracao-financeiro/           # Financial module migration plan
├── packages/
│   └── dominio/                           # Pure domain layer
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                   # Public exports barrel
│       │   ├── types/                     # Ontology types by area
│       │   │   ├── primitives.ts          # Id, Instant, Money, ActorRef, etc.
│       │   │   ├── workspace.ts           # Workspace, Member, Team, Role, Grant
│       │   │   ├── structure.ts           # Space, Folder, List, Task, Checklist
│       │   │   ├── crm.ts                 # Contact, Company, Deal, Funnel, Conversation
│       │   │   ├── ai.ts                  # Agent, Skill, Automation, Chat, Approval
│       │   │   └── panels.ts              # Panel, Widget, Metric
│       │   ├── state.ts                   # DataState, OperationResult, Session
│       │   ├── rotulos.ts                 # Status labels for UI
│       │   ├── colecoes.ts                # Collection helpers
│       │   ├── usuarios-do-seed.ts        # User ID to member ID mapping
│       │   ├── operations/                # Write operations
│       │   │   ├── index.ts               # Barrel
│       │   │   ├── activity.ts            # recordActivity, nextId, memberActor
│       │   │   ├── tasks.ts               # createTask, changeTaskStatus, moveTask
│       │   │   ├── deals.ts               # moveDealToStage, winDeal, loseDeal
│       │   │   ├── conversations.ts       # sendMessage, resolveConversation
│       │   │   ├── contacts.ts            # mergeContacts, addContactIdentifier
│       │   │   ├── members.ts             # removeMember, transferOwnership
│       │   │   ├── ai.ts                  # publishAutomation, decideApproval
│       │   │   ├── structure.ts           # Container operations
│       │   │   ├── configuration.ts       # Settings operations
│       │   │   ├── financeiro.ts          # Financial module operations
│       │   │   ├── collaboration.ts       # Recurrence, timers
│       │   │   └── [more operations...]
│       │   ├── derive.ts                  # (46KB) All read derivations
│       │   ├── seed-produto.ts            # Main seed: 3 spaces, 32 contacts, 25 deals, etc.
│       │   ├── seed-comercial.ts          # Commercial seed (alternate)
│       │   ├── seed-financeiro.ts         # Financial module seed (38KB)
│       │   ├── seed.ts                    # Combined seed (147KB with all modules)
│       │   └── seed-produto.test.ts       # Seed validation
├── apps/
│   ├── web/                               # Next.js 16 frontend
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── public/
│   │   │   ├── marca/                     # Brand assets
│   │   │   ├── membros/                   # Member avatars
│   │   │   └── contatos/                  # Contact avatars
│   │   ├── scripts/
│   │   │   └── verificar-tokens.mjs       # Enforce color from tokens.css only
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx             # Root layout: fonts, metadata
│   │       │   ├── globals.css            # Global styles
│   │       │   ├── (publico)/             # Public routes (no auth)
│   │       │   │   ├── f/[segredo]/       # Shared file links
│   │       │   │   └── p/[segredo]/       # Shared panel links
│   │       │   ├── entrar/                # Login page (public)
│   │       │   │   └── page.tsx
│   │       │   ├── sair/                  # Logout action
│   │       │   ├── (shell)/               # Protected routes (requires auth)
│   │       │   │   ├── layout.tsx         # Auth check, resolve member, mount store
│   │       │   │   ├── page.tsx           # Home/dashboard (52KB)
│   │       │   │   ├── estrutura/         # Tasks, Lists, Folders, Spaces
│   │       │   │   │   ├── listas/[lista]/page.tsx     # List view (4 visualizations)
│   │       │   │   │   ├── tarefas/[tarefa]/page.tsx   # Task detail
│   │       │   │   │   ├── financeiro/    # Financial submodule
│   │       │   │   │   └── [more routes...]
│   │       │   │   ├── crm/                # Contacts, Companies, Deals, Inbox
│   │       │   │   │   ├── contatos/
│   │       │   │   │   ├── empresas/
│   │       │   │   │   ├── negocios/      # Deals board by stage
│   │       │   │   │   ├── negocios/[negocio]/  # Deal detail
│   │       │   │   │   ├── caixa-de-entrada/   # Conversations/Inbox
│   │       │   │   │   └── caixa-de-entrada/[conversa]/page.tsx
│   │       │   │   ├── ia/                # Agents, Skills, Automations, Chat
│   │       │   │   │   ├── agentes/
│   │       │   │   │   ├── habilidades/
│   │       │   │   │   ├── automacoes/
│   │       │   │   │   ├── chat/
│   │       │   │   │   ├── aprovacoes/    # Approval requests
│   │       │   │   │   └── execucoes/     # Agent execution history
│   │       │   │   ├── paineis/           # Dashboards
│   │       │   │   ├── configuracoes/     # Settings
│   │       │   │   │   ├── membros/
│   │       │   │   │   ├── integracao/
│   │       │   │   │   └── [more...]
│   │       │   │   ├── buscar/            # Global search
│   │       │   │   ├── notificacoes/      # Notifications
│   │       │   │   └── minha-conta/       # User account
│   │       ├── dados/                     # State adapter layer
│   │       │   ├── store.ts               # **THE CRITICAL FILE** — zustand store
│   │       │   │                          #    Mounts seed, mutates in place, revision tracking
│   │       │   ├── sessao-provider.tsx    # Checks member can act, wraps store
│   │       │   └── publico-provider.tsx   # Public (unauthenticated) store
│   │       ├── autenticacao/              # Auth integration
│   │       │   ├── sessao.ts              # usuarioAtual() — validates Supabase token
│   │       │   ├── cliente-servidor.ts    # Supabase client (server-side)
│   │       │   └── cliente-navegador.ts   # Supabase client (browser)
│   │       ├── features/                  # Component blocks by area
│   │       │   ├── shell/
│   │       │   │   ├── app-shell.tsx      # TopBar + SideNav wrapper
│   │       │   │   ├── ui.tsx             # Primitive components (Button, Panel, etc.)
│   │       │   │   ├── format.ts          # Intl formatting for dates/numbers/currency (pt-BR)
│   │       │   │   └── [shell components]
│   │       │   ├── estrutura/             # Task/List/Structure components
│   │       │   ├── crm/                   # Contact/Deal/Conversation components
│   │       │   ├── ia/                    # Agent/Automation/Chat components
│   │       │   └── configuracoes/         # Settings components
│   │       ├── design/                    # Design system
│   │       │   └── [icons, typography, spacing, etc. — under development]
│   │       └── estilos/
│   │           ├── tokens.css             # **CANONICAL COLOR SOURCE**
│   │           │                          # All colors defined here
│   │           │                          # npm run verificar:tokens enforces this
│   │           └── [utility styles]
│   └── api/                               # Backend skeleton
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                   # Composition point (empty, waiting for HTTP choice)
│       │   ├── autenticacao/              # Token validation layer
│       │   │   └── [auth handlers — future]
│       │   ├── persistencia/              # DB connection & migration
│       │   │   ├── schema/                # Postgres schema `plataforma`
│       │   │   │   └── [migrations]
│       │   │   └── [connection setup]
│       │   ├── repositorios/              # Persistence interfaces
│       │   │   ├── index.ts               # Barrel
│       │   │   ├── tarefas.ts             # Repository<Task>
│       │   │   ├── contatos.ts            # Repository<Contact>
│       │   │   └── [one per aggregate]
│       │   ├── servicos/                  # Use cases / business logic
│       │   │   ├── index.ts               # Barrel
│       │   │   ├── tarefas.ts             # Task service
│       │   │   ├── contatos.ts            # Contact service
│       │   │   └── [one per area]
│       │   └── rotas/                     # HTTP endpoints (HTTP choice pending)
│       │       ├── index.ts               # Barrel
│       │       ├── tarefas.ts             # GET/POST /tasks
│       │       ├── contatos.ts            # GET/POST /contacts
│       │       └── [one per resource]
│       ├── migracoes/                     # Database migrations (Postgres)
│       └── .env                           # (do NOT read) DB credentials
├── .planning/
│   └── codebase/                          # Generated docs (this folder)
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
```

## Directory Purposes

**`ontologia/`:**
- Contains the official ontology definitions (v1.0) in structured documents
- Organized by area: workspace, structure, CRM, AI, panels
- SOURCES: these are read during design, inform the domain types
- NOT code — reference material

**`docs/`:**
- `03-fundacao/ARQUITETURA.md` — Frontend architecture (canonical, describes Phase 3 build)
- `08-migracao-financeiro/` — Migration plan for Financial module from old system

**`packages/dominio/src/types/`:**
- One file per ontology region (not per entity)
- All types are exported from `index.ts` as the public API
- Types are readonly by default — assertions of invariant, not convenience

**`packages/dominio/src/operations/`:**
- One file per area or aggregate type
- Every operation signature: `(state: DataState, actingMemberId: Id, ...args) => OperationResult<T>`
- Operations mutate state in-place (the store will increment revision)
- Errors are pt-BR sentences that a user can read

**`packages/dominio/src/derive.ts`:**
- MONOLITHIC (46KB) — all derivations in one file, never split
- Reason: circular dependencies between derives (e.g., `effectiveListConfig` needs `memberReachesContainer` which needs `effectiveListConfig`)
- Pure functions, no side effects, no mutation
- Recalculated on every read

**`packages/dominio/src/seed*.ts`:**
- `seed-produto.ts` — main prototype seed (3 spaces, 6 folders, 7 lists, ~60 tasks, 32 contacts, 25 deals, etc.)
- `seed-financeiro.ts` — financial module seed (38KB with invoice/payment data)
- `seed.ts` — combined seed (147KB with all modules)
- Seeds are data, not code — they prove the ontology works at the planned volumes

**`apps/web/src/app/(shell)/layout.tsx`:**
- THE AUTHENTICATION ENTRY POINT for protected routes
- Calls `usuarioAtual()` to validate Supabase token server-side
- Resolves user ID to member ID via seed lookup
- If member can act (ativo or suspenso): mounts `SessaoProvider` → `StoreProvider`
- If not: renders "sem acesso" error

**`apps/web/src/dados/store.ts`:**
- THE CRITICAL BOUNDARY between domain and React
- Creates per-request zustand store with resolved member
- Mounts seed data, mutates in place, increments revision on writes
- Exposes `useData()`, `useRun()`, `useSession()`, `useLastResult()` hooks
- All of `apps/web` only touches domain through these hooks
- **Future:** This file swaps from seed to API calls — components never change

**`apps/web/src/features/shell/format.ts`:**
- All date/number/currency formatting for pt-BR
- Uses `Intl` with pt-BR locale
- Canonical for text formatting across the app

**`apps/web/src/estilos/tokens.css`:**
- CANONICAL COLOR SOURCE
- All colors defined here, nowhere else
- `npm run verificar:tokens` enforces this via script in `scripts/verificar-tokens.mjs`
- Updates to branding go here, not scattered in components

**`apps/api/src/index.ts`:**
- Empty by design — waiting for HTTP framework choice (Fastify, Hono, Nest, Next route handlers)
- When filled: instantiates repositories, injects into services, wires to transport

**`apps/api/src/persistencia/`:**
- Database connection (Postgres)
- Migrations directory
- Schema definition

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx` — Root layout
- `apps/web/src/app/(shell)/layout.tsx` — Protected routes entry
- `apps/web/src/app/entrar/page.tsx` — Login page
- `apps/api/src/index.ts` — Backend composition (empty)

**State & Data:**
- `apps/web/src/dados/store.ts` — **THE CRITICAL FILE** (all domain-to-React translation)
- `packages/dominio/src/state.ts` — DataState, OperationResult types
- `packages/dominio/src/derive.ts` — All reads

**Configuration:**
- `packages/dominio/package.json` — Domain package config
- `apps/web/package.json` — Frontend package config
- `apps/web/tsconfig.json` — Strict TypeScript settings (noUncheckedIndexedAccess, noImplicitOverride, noFallthroughCasesInSwitch)
- `apps/api/package.json` — Backend package config

**Core Logic:**
- `packages/dominio/src/operations/` — Write operations
- `packages/dominio/src/derive.ts` — Read derivations
- `apps/web/src/features/shell/ui.tsx` — Primitive components
- `apps/web/src/features/*/` — Area-specific components

**Testing:**
- `packages/dominio/src/**/*.test.ts` — Operation and seed tests
- `apps/web/` — No tests yet (prototype only)

## Naming Conventions

**Files:**
- **Operations**: Verb-based (`tasks.ts`, `contacts.ts`, `deals.ts`)
- **Types**: Noun-plural or by region (`structure.ts`, `crm.ts`, `ai.ts`)
- **Derivations**: Single `derive.ts` file (monolithic by design)
- **Pages**: Segment-based (`[id]` for dynamic routes)
- **Components**: PascalCase (React convention)

**Directories:**
- **Features**: By product area (shell, estrutura, crm, ia, configuracoes)
- **Types**: By ontology region, NOT by entity type
- **Operations**: By aggregate or area
- **App routes**: Match URL structure exactly (App Router pattern)

**Identifiers in Code:**
- English: function names, variable names, comments explaining *why*
- pt-BR: status codes (`ativo`, `arquivado`, `naLixeira`), user-visible strings
- Codes are immutable: `ativo` never becomes "Ativo" or "active", always the code

## Where to Add New Code

**New Domain Type:**
1. Add to appropriate file in `packages/dominio/src/types/` (not a new file)
2. Examples: new Status code → `structure.ts`, new field → update entity file
3. Export from `packages/dominio/src/index.ts`
4. Update tests in that same file

**New Domain Operation:**
1. Add to appropriate file in `packages/dominio/src/operations/` (one per area: tasks.ts, contacts.ts, etc.)
2. Signature: `(state: DataState, actingMemberId: Id, ...args) => OperationResult<T>`
3. Call `recordActivity()` if it affects audit trail
4. Call `derive.*()` functions to check permissions or compute visibility
5. Return `OperationResult` (ok | error)

**New Domain Derivation:**
1. Add to `packages/dominio/src/derive.ts` (always this file, never new files)
2. Pure function, no mutation, no side effects
3. Recalculates on every call
4. Tests inline in `operations/*.test.ts` if used by operations

**New Frontend Page:**
1. Create `apps/web/src/app/(shell)/[segment]/page.tsx`
2. It's a Server Component by default; use `"use client"` if it needs hooks
3. Pass parameters via `use(params)` (Next 16 breaking change)
4. Read state via `useData(selector)` hook
5. Write via `const run = useRun()` then `run((data, id) => operation(...))`
6. Format text via `features/shell/format.ts` (Intl)
7. Colors only from `estilos/tokens.css`

**New Component:**
1. Create in `apps/web/src/features/[area]/[name].tsx` 
2. Use `"use client"` if it uses hooks
3. Accept props, read via `useData()` if needed
4. Compose from `features/shell/ui.tsx` primitives
5. No direct domain imports (only via `useData()`)

**New Backend Service:**
1. Create `apps/api/src/servicos/[area].ts`
2. Accepts injected repositories in constructor
3. Calls domain operations (from `@n1/dominio`)
4. Calls repositories for persistence
5. Wraps in transactions
6. Returns same `OperationResult<T>` shape as domain

**New Backend Repository:**
1. Create `apps/api/src/repositorios/[entity].ts`
2. Define interface with CRUD methods
3. Implement against Postgres via Prisma/Drizzle/SQL
4. No business logic — only SQL translation
5. One method per use case in servico layer

**New Backend Route:**
1. Create `apps/api/src/rotas/[resource].ts`
2. Receives HTTP request
3. Extracts auth → memberId
4. Calls servico
5. Returns `OperationResult` as JSON
6. No business logic in route — only HTTP↔service translation

## Special Directories

**`packages/dominio/src/seed*.ts`:**
- Generated + committed
- NOT build artifacts — actual data files
- Prove the ontology works at target volumes
- Updated manually when ontology changes
- Used by frontend in development (seed mounts in store.ts)

**`apps/api/migracoes/`:**
- Database migrations (SQL files)
- Version-controlled
- Run on deployment

**`public/` (apps/web):**
- Static assets (brand, member avatars, contact photos)
- Committed

**`.env` files:**
- Database credentials (apps/api/.env)
- Supabase keys (apps/web/.env.local)
- NOT committed, NOT read during analysis

**`.planning/codebase/`:**
- Generated by `/gsd-map-codebase`
- Read by `/gsd-plan-phase` and `/gsd-execute-phase`
- Not committed (or low priority to commit)

---

*Structure analysis: 2026-09-15*
