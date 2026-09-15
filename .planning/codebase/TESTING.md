# Testing Patterns

**Analysis Date:** 2026-09-15

## Test Framework

**Runner:**
- Vitest 5.0.0 across all three workspaces
- Node.js environment for all tests (`environment: "node"`)
- Config: one per workspace (see below)

**Assertion Library:**
- Vitest's built-in `expect` (compatible with Jest)

**Run Commands:**
```bash
npm run test                    # Run all tests across workspaces
npm run test:watch             # Watch mode (packages/dominio and apps/web only)
npm run check                  # Full CI: typecheck, lint, tokens, tests
```

## Test File Organization

**Location:**
- Collocated with source: `src/**/*.test.ts` (same directory as implementation)
- Pattern: `<feature>.test.ts` next to `<feature>.ts` or `<feature>.tsx`

**Naming:**
- Test file: same base name as source + `.test.ts`
- Examples: `operations.test.ts`, `seed-produto.test.ts`, `persistencia.test.ts`, `tokens.test.ts`

**Structure by Workspace:**

**packages/dominio:**
```
packages/dominio/
├── vitest.config.mts
├── src/
│   ├── operations/
│   │   ├── scale.ts
│   │   ├── deals.ts
│   │   ├── contacts.ts
│   │   └── operations.test.ts          # Single file, 900+ lines, comprehensive
│   ├── seed-produto.ts
│   ├── seed-produto.test.ts            # Small, focused test
│   ├── contas-a-receber.test.ts
│   └── state.ts
```
- **214 total tests** across the domain layer
- Operations tests: single large file (`operations.test.ts`) that tests all operation rules together
- Seed/feature tests: smaller, focused files

**apps/api:**
```
apps/api/
├── vitest.config.mts                   # testTimeout: 60s (long for Postgres)
├── src/
│   ├── persistencia/
│   │   ├── persistencia.test.ts        # Integration test against Postgres
│   │   ├── repositorio.ts
│   │   └── conexao.ts
```
- **Integration test** validates full persistence cycle
- Skips without `DATABASE_URL` env var (does not fail CI)

**apps/web:**
```
apps/web/
├── vitest.config.mts                   # Path alias for @/*
├── src/
│   ├── design/
│   │   ├── tokens.test.ts              # CSS token validation
│   │   └── components.tsx
│   └── features/
│       └── estrutura/financeiro/
│           ├── lens.test.ts
│           └── lens.ts
```
- **33 total tests**
- CSS validation: checks hex colors, contrast ratios, component usage
- Feature tests: unit tests for React components or utilities

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";

describe("Operation Name (RN-CODE, B##)", () => {
  let state: DataState;
  
  beforeEach(() => {
    state = buildSeed();
  });

  it("rejects invalid input and explains why", () => {
    const result = operation(state, actorId, input);
    
    expect(result.ok).toBe(false);
    if (result.ok) return;  // Type guard
    expect(result.error).toContain("user-facing error");
    expect(state).not.toHaveBeenMutated();
  });

  it("succeeds and mutates state as expected", () => {
    const result = operation(state, actorId, input);
    
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(expectedOutput);
    expect(state.collection).toContainEqual(expectedItem);
  });
});
```

**Patterns:**
- `beforeEach()` → fresh `buildSeed()` state per test (deterministic, isolated)
- Type guard check: `if (result.ok) return;` narrows union type for linter safety
- Describe blocks: name pattern is `"Feature Name (RN-CODE, B##)"` (links to PRD/ontology)

## Mocking

**Framework:** Vitest's built-in mocking via `vi`

**Patterns:**
- **Domain layer:** No mocking — tests build actual `DataState` from `buildSeed()`
- **API layer:** Mock Postgres client in unit tests; integration test uses real DB
- **Web layer:** Mock external services (Supabase), use real components for CSS tests

**What to Mock:**
- External HTTP calls (Supabase, third-party APIs)
- Timers: use `vi.useFakeTimers()` when testing time-dependent code
- Database connections in unit tests (not in integration tests)

**What NOT to Mock:**
- Domain operations — test with real state
- Core utilities — test the actual function
- CSS/design tokens — read the actual file (see tokens.test.ts example)

**Example: persistencia.test.ts (integration pattern):**
```typescript
// Skips if DATABASE_URL not present
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

d("persistência do DataState", () => {
  let semente: DataState;

  beforeAll(async () => {
    const cliente = await pool().connect();
    try {
      await cliente.query("delete from plataforma.registros where workspace_id = $1", [WS]);
      semente = buildSeed();
      const gravados = await semear(cliente, WS, semente);
      console.log(`semear: ${gravados} registros`);
    } finally {
      cliente.release();
    }
  });

  afterAll(async () => {
    await encerrar();
  });

  it("hydrates state identical to seed", async () => {
    const { state } = await hidratar(cliente, WS);
    expect(state).toStrictEqual(semente);  // Deep equality + undefined handling
  });
});
```

## Fixtures and Factories

**Test Data (buildSeed):**
- Central fixture: `packages/dominio/src/seed.ts` → `buildSeed()`
- **Deterministic:** same IDs and timestamps on every call
- **Comprehensive:** 900+ records covering all entity types and relationships
- **Mutable:** tests start with fresh copy via `beforeEach(() => { state = buildSeed(); })`

**Pattern:**
```typescript
// In tests:
beforeEach(() => {
  state = buildSeed();
});

// Access seed data:
const task = state.tasks.find((t) => t.id === "tsk_seed_1");
const member = state.members.find((m) => m.id === THIAGO);  // Constant from seed
```

**Seed mutations:**
Tests modify state in-place for setup:
```typescript
it("test", () => {
  const task = state.tasks.find((t) => t.id === "tsk_seed_8");
  task?.checklists.push({ ... });  // Mutate seed for test setup
  
  const result = operation(state, ...);
  expect(result.ok).toBe(true);
});
```

**Seed constants:**
Named actors for readability:
```typescript
const THIAGO = "membro_gerente_seed";  // From seed
const CP = { listId: "lst_contas", status: { paraPagar: "st_cp_pagar" } };
```

## Coverage

**Requirements:** No enforced target (coverage not measured in CI)

**View Coverage:**
```bash
# Vitest doesn't have built-in coverage reporting configured
# To add coverage, install @vitest/coverage-v8 and configure in vitest.config.mts
npm install --save-dev @vitest/coverage-v8
# Then use: vitest run --coverage
```

**Current state:**
- Domain: 214 tests covering operations, derive, seed
- API: 1 integration test validating persistence
- Web: 33 tests covering tokens and features
- No minimum coverage requirement enforced

## Test Types

**Unit Tests (Domain):**
- Scope: Single operation or utility function
- Approach: Build state from `buildSeed()`, call operation, assert result and side effects
- File: `packages/dominio/src/operations/operations.test.ts` (914 lines, all operations)
- Example:
  ```typescript
  it("rejeita mover para Lista com outro Conjunto sem mapear", () => {
    const result = moveTask(state, THIAGO, "tsk_seed_1", "lst_ativacao");
    
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Em andamento");  // Status name
    expect(state.tasks.find((t) => t.id === "tsk_seed_1")?.listId).toBe("lst_revisoes");  // Unchanged
  });
  ```

**Integration Tests (API):**
- Scope: Full persistence cycle: seed → save → hydrate → verify
- Approach: Real Postgres database via `apps/api/src/persistencia/persistencia.test.ts`
- Conditional: Skips if `DATABASE_URL` not set (no hard requirement)
- Example:
  ```typescript
  it("hidrata um estado equivalente ao que o seed monta", async () => {
    const { state } = await hidratar(cliente, WS);
    expect(state).toStrictEqual(semente);  // Deep equality
  });
  ```

**Feature/CSS Tests (Web):**
- Scope: Component behavior, CSS compliance, accessibility
- Approach: Read actual files (CSS), test against invariants (contrast ratios, no raw colors)
- File: `apps/web/src/design/tokens.test.ts` (171 lines)
- Example:
  ```typescript
  it("não escreve hex, função de cor crua nem cor nomeada do Tailwind", () => {
    const literals = source.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|...)/g) ?? [];
    expect(literals).toEqual([]);  // No raw colors found
  });
  ```

## Common Patterns

**Async Testing:**
```typescript
it("awaits Postgres and validates round-trip", async () => {
  const cliente = await pool().connect();
  try {
    const { state } = await hidratar(cliente, WS);
    expect(state).toEqual(semente);
  } finally {
    cliente.release();
  }
});
```

**Error Testing (OperationResult pattern):**
```typescript
it("rejeita e coloca o error no result", () => {
  const result = operation(state, actingId, badInput);
  
  expect(result.ok).toBe(false);
  if (result.ok) return;  // Type guard — result.error now accessible
  expect(result.error).toContain("Descrição do erro");
  expect(result.field).toBe("nome");  // Optional field for validation
});
```

**State Mutation Assertion:**
```typescript
it("mutates state by adding entity", () => {
  const before = state.views.length;
  
  const result = saveView(state, actingId, input);
  
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(state.views.length).toBe(before + 1);  // State grew
  expect(result.value.id).toBeDefined();        // Returned value has ID
  expect(state.views).toContainEqual(result.value);  // New entity in state
});
```

**Activity Recording:**
```typescript
it("records activity after successful operation", () => {
  const result = changeTaskStatus(state, memberId, taskId, newStatus);
  
  expect(result.ok).toBe(true);
  expect(state.activity[0]?.action).toBe("Status alterado");
  expect(state.activity[0]?.objectId).toBe(taskId);
});
```

## Test Configuration

**packages/dominio/vitest.config.mts:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

**apps/api/vitest.config.mts:**
```typescript
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,    // Long timeout for Postgres operations
    hookTimeout: 60_000,    // beforeAll/afterAll need time to seed 900 records
  },
});
```

**apps/web/vitest.config.mts:**
```typescript
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),  // Path alias support
    },
  },
});
```

## Debugging Tests

**Run single test:**
```bash
npm run test -w @n1/dominio -- operations.test.ts
npm run test:watch -w @n1/dominio -- operations.test.ts -t "rejeita mover"
```

**Watch mode:**
```bash
npm run test:watch -w @n1/dominio
npm run test:watch -w @n1/web
```

**Full output:**
```bash
npm run test -w @n1/dominio -- --reporter=verbose
```

---

*Testing analysis: 2026-09-15*
