# Architecture

<!-- refreshed: 2026-09-15 -->

**Analysis Date:** 2026-09-15

## System Overview

This is a three-layer monorepo architecture where a pure domain layer (`packages/dominio`) is consumed by two independent frontends: a Next.js web UI (`apps/web`) and a backend API (`apps/api`). The dependency direction is strict: domain knows nothing, web and API know only the domain.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend & Backend                        │
├──────────────────────────────────┬──────────────────────────┤
│       apps/web (Next.js 16)      │    apps/api (Backend)    │
│  Client-side zustand store       │  HTTP endpoints (TBD)    │
│  `src/dados/store.ts`            │  `src/rotas/*`           │
└─────────────────────┬──────────────────────┬────────────────┘
                      │                      │
                      └──────────┬───────────┘
                                 │
                ┌────────────────▼───────────────┐
                │   packages/dominio             │
                │  Pure domain: types,           │
                │  operations, derivations       │
                │  `src/operations/*`            │
                │  `src/derive.ts`               │
                │  `src/state.ts`                │
                └────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Domain Types | Define ontology entities (Task, Contact, Deal, etc.) | `packages/dominio/src/types/` |
| Domain Operations | Write operations that mutate state, return Result<T> | `packages/dominio/src/operations/` |
| Domain Derivations | Read-only calculations over immutable state | `packages/dominio/src/derive.ts` |
| Frontend Store | Zustand store that mounts seed, mutates in place, tracks revision | `apps/web/src/dados/store.ts` |
| Frontend Pages | App Router pages that read store via `useData()` | `apps/web/src/app/(shell)/` |
| Frontend Features | Reusable component blocks per area (crm, estrutura, ia) | `apps/web/src/features/` |
| API Routes | HTTP endpoints (not yet implemented) | `apps/api/src/rotas/` |
| API Services | Business logic composition, transaction boundaries | `apps/api/src/servicos/` |
| API Repositories | Persistence layer behind interfaces | `apps/api/src/repositorios/` |

## Pattern Overview

**Overall:** Layered domain-driven design with a strict dependency boundary.

**Key Characteristics:**
- **Domain independence:** `packages/dominio` has zero framework dependencies (only zod for validation)
- **Single store boundary:** `apps/web/src/dados/store.ts` is the ONLY point where domain becomes React state
- **Mutation + revision:** Store mutates the domain graph in place and increments a revision counter for re-renders
- **No derivation persistence:** Reads are always recalculated from stored state; no cache or mirror fields
- **Result types, not exceptions:** Operations return `OperationResult<T>` (ok: true | ok: false with error message)

## Layers

**Domain (`packages/dominio/src`):**
- **Purpose:** Define the ontology and business rules in pure code
- **Location:** `packages/dominio/src/`
- **Contains:** Types, operations, derivations, seed data, labels
- **Depends on:** zod only
- **Used by:** apps/web, apps/api

**Web Frontend (`apps/web/src`):**
- **Purpose:** Deliver the Next.js UI with App Router and client-side state
- **Location:** `apps/web/src/`
- **Contains:** Pages, components, store adapter, design tokens
- **Depends on:** @n1/dominio
- **Used by:** Direct user interaction via browser

**Backend Skeleton (`apps/api/src`):**
- **Purpose:** Compose persistence and HTTP transport around domain
- **Location:** `apps/api/src/`
- **Contains:** Rotas (endpoints), Servicos (use cases), Repositorios (persistence)
- **Depends on:** @n1/dominio
- **Used by:** Future HTTP clients (web will switch from seed to this)

## Data Flow

### Primary Request Path (Frontend)

1. **Page render** (`apps/web/src/app/(shell)/*/page.tsx`) — Server Component redirects if not authenticated
2. **Resolve session** (`apps/web/src/autenticacao/sessao.ts`) — Supabase auth validates user, maps to member ID via seed
3. **Mount store** (`apps/web/src/dados/store.ts`) — `StoreProvider` creates per-tree store with resolved member
4. **Read state** — Component calls `useData(selector)` which subscribes to revision + data
5. **Write operation** — Component calls `run((data, memberId) => operation(...))`, which:
   - Applies operation to in-place-mutated state
   - Increments revision counter
   - Returns `OperationResult<T>` for UI feedback
6. **Re-render** — Subscribers detect revision change, selector re-runs, component re-renders

### Secondary Flow: Derivation (Read)

```typescript
// Example from a page:
const tasks = useData((data) => {
  const list = data.lists.find(l => l.id === listId);
  return data.tasks.filter(t => 
    derive.taskLevel(data, t.id) > 0 &&
    derive.memberSeesTask(data, memberId, t.id)
  );
});
```

Derivations in `derive.ts` are **never stored**. They recalculate on every read. This is intentional per the ontology (RN-CRM-16, B36, B45, B100): derived values are ephemeral and re-derive if conditions change.

### Authentication Flow

1. User navigates to `/app/**`
2. Server layout (`apps/web/src/app/(shell)/layout.tsx`) calls `usuarioAtual()` → validates Supabase token
3. If token valid: maps user ID to member ID via `USUARIOS_DO_SEED` map
4. If no member: renders "sem acesso" error
5. If member is `ativo` or `suspenso`: wraps tree in `SessaoProvider` + `StoreProvider`
6. All child pages mount with store already initialized with correct member

### Backend Composition (Future)

When API is implemented:

1. **rotas** receive HTTP request → extract user from auth header
2. **rotas** call **servicos** with extracted memberId
3. **servicos** call domain operations + repository methods for transaction boundaries
4. **repositorios** execute SQL behind the interface
5. **rotas** format result as JSON and respond

## Key Abstractions

**OperationResult<T>:**
- Purpose: Every write returns either success or a localized error message
- Examples: `createTask`, `changeTaskStatus`, `assignTask` in `packages/dominio/src/operations/`
- Pattern: `{ ok: true; value: T } | { ok: false; error: string; field?: string }`

**DataState:**
- Purpose: The entire graph of domain entities — one root object
- Examples: `DataState` type in `packages/dominio/src/state.ts`
- Pattern: Contains arrays: `tasks`, `contacts`, `companies`, `deals`, `members`, `spaces`, `folders`, `lists`, etc.

**Derivation:**
- Purpose: Computed properties that depend on state but are never stored
- Examples: `effectiveLifecycleOfTask`, `memberSeesTask`, `isBlocked` in `derive.ts`
- Pattern: Pure functions `(state, ...context) => T`

**Store (Zustand):**
- Purpose: React-side boundary where domain mutates into component subscriptions
- Location: `apps/web/src/dados/store.ts`
- Pattern: Single store per tree (via context), revision-based subscribers

## Entry Points

**Frontend Root Layout:**
- **Location:** `apps/web/src/app/layout.tsx`
- **Triggers:** Every page load
- **Responsibilities:** Load fonts (SF Pro Display → Inter fallback, JetBrains Mono), set theme color metadata, language tag

**Shell Layout (Protected):**
- **Location:** `apps/web/src/app/(shell)/layout.tsx`
- **Triggers:** Every protected page load
- **Responsibilities:** Validate auth, resolve member, wrap in stores, render shell (TopBar + SideNav)

**Entry Page (Public):**
- **Location:** `apps/web/src/app/entrar/page.tsx`
- **Triggers:** Unauthenticated user
- **Responsibilities:** Choose member to simulate session (prototype only)

**Home (Shell):**
- **Location:** `apps/web/src/app/(shell)/page.tsx`
- **Triggers:** Authenticated user enters `/app`
- **Responsibilities:** Display dashboard/overview

**Backend Index (Composition):**
- **Location:** `apps/api/src/index.ts`
- **Triggers:** Server startup (when implemented)
- **Responsibilities:** Read env config, instantiate repositories, inject into services, expose to HTTP transport

## Architectural Constraints

- **No web ↔ API imports:** A component cannot import from `apps/api` and vice versa. Both import only `@n1/dominio`.
- **No domain framework dependencies:** `packages/dominio` cannot import React, Next, database drivers, fetch, or HTTP libraries. Only zod.
- **Single store per tree:** Frontend uses per-request stores via context, not module-level singletons. This prevents SSR cross-request contamination.
- **In-place mutation:** Domain graph is mutated in place by operations. Store doesn't deep-clone. Components must not hold references across renders.
- **Strict result types:** Operations never throw; errors are wrapped in `OperationResult`.
- **No backend yet:** The API skeleton exists but the HTTP transport is not chosen. `apps/api/src/index.ts` is empty by design.

## Anti-Patterns

### Storing Derivations in State

**What happens:** A component calculates `const taskDueDate = task.dueDate || task.list.defaultDueDate` and caches it in local state.

**Why it's wrong:** If `list.defaultDueDate` changes, the cached value is stale. The ontology forbids storing derived values (B36, B45, B100).

**Do this instead:** Always read from `derive.ts`. If the derivation doesn't exist, add it there. `packages/dominio/src/derive.ts` is where all reads live.

### Importing Operations Outside Domain

**What happens:** A component imports `operations.createTask` directly and calls it: `const result = operations.createTask(state, memberId, ...)`.

**Why it's wrong:** The operation mutates state in place, but React doesn't detect the mutation. The revision counter (in store) must be incremented for subscribers to re-render.

**Do this instead:** Call `const run = useRun()` in the component, then `run((data, id) => operations.createTask(data, id, ...))`. The store's `run` method increments revision.

### Calling API from a Component

**What happens:** A page imports `apps/api` directly or fetches from an undocumented internal endpoint.

**Why it's wrong:** This couples the frontend to backend implementation. The frontend is meant to work standalone (prototype runs in memory). When API is ready, `apps/web/src/dados/store.ts` swaps to backend calls — one file change, not a hundred.

**Do this instead:** Backend calls happen only in `store.ts`. Components never know the difference.

### Conditional Renders Based on Missing State

**What happens:** `const title = task?.title ?? "Untitled"` rendering "Untitled" when task is undefined.

**Why it's wrong:** Task IDs come from the store. If a task ID exists in `useData`, the task must exist. If it doesn't, there's a data integrity bug. Silently rendering a fallback hides it.

**Do this instead:** If a page receives a task ID, load the task once before rendering. If it doesn't exist, render an error or 404. The state's invariants should be maintained by the store, not worked around by components.

## Error Handling

**Strategy:** Operations never throw. All failures are values.

**Patterns:**
- Operations return `OperationResult<T>` with `ok: boolean`, `error: string` (pt-BR), optional `field: string` for form errors
- `error` is a sentence the user can read: "Não é possível mover a Tarefa para um Status no Lixo"
- `field` points to which form field failed, for input-level feedback
- UI reads `lastResult` from store via `useLastResult()` hook to display feedback
- Network errors (future): when API exists, wrapped in same `OperationResult` shape

## Cross-Cutting Concerns

**Logging:** No logging framework is in place in the domain. Operations record activity via `recordActivity()` which appends an `ActivityRecord` to state. This is the audit trail.

**Validation:** Zod schemas in `packages/dominio/src/types/` validate external input (e.g., form submissions). Operations validate business rules and return structured errors.

**Authentication:** Frontend validates user via Supabase, resolves to member ID. API (future) will validate token, resolve to member ID, pass to services. Domain operations take `actingMemberId` as parameter — permission is the responsibility of the caller (API), not the operation.

**Authorization:** Derivations like `memberSeesTask()`, `memberReachesContainer()` in `derive.ts` compute visibility per member. Pages check these before rendering. API endpoints will call the same derivations to decide what to return.

---

*Architecture analysis: 2026-09-15*
