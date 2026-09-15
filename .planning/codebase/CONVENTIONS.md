# Coding Conventions

**Analysis Date:** 2026-09-15

## Naming Patterns

**Files:**
- TypeScript source files: `camelCase.ts` or `camelCase.tsx`
- Test files: `<name>.test.ts` (collocated with source)
- Index/barrel files: `index.ts` that re-exports from organized subdirectories
- Domain layer exports: `operations/`, `types/`, and `derive.ts` as namespace folders

**Functions:**
- Operations (state mutations): `verbNoun` pattern (e.g., `createTask`, `changeTaskStatus`, `moveTask`)
- Utility/pure functions: `adjectiveNoun` or `nounVerb` pattern (e.g., `effectiveListConfig`, `memberReachesContainer`, `checklistProgress`)
- Boolean predicates: `verb` or `canVerb` pattern (e.g., `isAdmin`, `mayEditView`, `memberSeesTask`)

**Variables:**
- Constants: `SHOUTY_SNAKE_CASE` for seed or configuration values (e.g., `THIAGO`, `CP.listId`)
- Local state: `camelCase` (e.g., `state`, `result`, `refusal`)
- Temporary/derived values: `camelCase` (e.g., `admin`, `view`, `before`, `after`)

**Types:**
- Exported types and interfaces: `PascalCase` (e.g., `DataState`, `OperationResult`, `SaveViewInput`)
- Union types: `PascalCase` (e.g., `Lifecycle`, `ActorKind`, `TaskDate`)
- Generic parameters: `T`, `U`, `V` or descriptive PascalCase if needed

**IDs and references:**
- ID prefixes in code: `<prefix>_<number>` (e.g., `tsk_seed_1`, `lst_revisoes`, `viw_x`)
- Member references in tests: CONSTANT names like `THIAGO`, `CP` (for "Contas a Pagar")

## Code Style

**Formatting:**
- Enforced by `eslint` and `eslint-config-next` in apps/web (flat config at `eslint.config.mjs`)
- No `.prettierrc` — rely on linter's formatting rules
- 2-space indentation (standard TypeScript/JavaScript convention)

**Linting:**
- Web: `eslint-config-next` (core web vitals + TypeScript rules) via `apps/web/eslint.config.mjs`
- API: `typescript` type checking via `apps/api/tsconfig.json`
- Domain: `typescript` type checking via `packages/dominio/tsconfig.json`
- Run with: `npm run lint` (web only) or `npm run check` (all workspaces with typecheck)

**Strict TypeScript:**
- `strict: true` globally in `tsconfig.base.json`
- `noUncheckedIndexedAccess: true` — array/object access must be guarded
- `noImplicitOverride: true` — override keyword required in subclasses
- `noFalltyroughCasesInSwitch: true` — switch cases must be explicit
- Implication: all types must be explicit, no implicit `any`

## Import Organization

**Order:**
1. vitest (e.g., `import { describe, it, expect } from "vitest"`)
2. Node.js standard library (e.g., `import { readFileSync } from "node:fs"`)
3. Domain imports (e.g., `import { buildSeed } from "@n1/dominio"`)
4. Relative imports (e.g., `import { foo } from "../bar"`)
5. Type-only imports grouped separately (e.g., `import type { DataState }`)

**Path Aliases:**
- `@/*` in `apps/web` → `./src/*` (single alias, not extended)
- Direct package names for domain: `@n1/dominio` (workspaces import by name, not relative paths)
- No aliases in `packages/dominio` or `apps/api` — use relative imports

**Barrel files:**
- Used strategically: `packages/dominio/src/index.ts`, `packages/dominio/src/operations/index.ts`, `packages/dominio/src/types/*.ts`
- Avoid re-exporting to prevent circular dependencies
- Operations and derive are kept separate to prevent derived values becoming stored state

## Error Handling

**OperationResult Pattern:**
Every operation returns a typed result; never throw or return `null`:

```typescript
export type OperationResult<T = void> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly field?: string };

// Usage:
export const ok = <T>(value: T): OperationResult<T> => ({ ok: true, value });
export const fail = <T = never>(error: string, field?: string): OperationResult<T> =>
  field === undefined ? { ok: false, error } : { ok: false, error, field };
```

**Error messages:**
- Always in Portuguese (pt-BR)
- User-facing sentences, not codes (e.g., `"Você não alcança esta Lista."` not `"FORBIDDEN"`)
- Include context when field-specific: pass `field` param (e.g., `fail("...", "nome")`)
- Example: `return fail("Dê um nome à Visualização.", "nome")`

**Validation strategy:**
- Check preconditions early with guard clauses (e.g., `if (!name) return fail(...)`)
- Refusal helpers return error string or undefined (e.g., `activeMember(state, id)` returns error or undefined)
- Chain validation, return early on first failure

## Logging

**Framework:** `console` (standard output for domain layer; no dedicated logger)

**Patterns:**
- Log with context about what is being done (WHY, not WHAT)
- Example from `apps/api/src/persistencia/persistencia.test.ts`: `console.log(`\n  semear: ${gravados} registros em ${(performance.now() - t0).toFixed(0)} ms`)`
- Performance measurements: include timing in logs where relevant (`performance.now()`)

## Comments

**When to Comment:**
- WHY is a rule written the way it is, or WHY a workaround exists
- Never state WHAT the code does if the code is clear
- Link to ontology documents or PRD sections (e.g., `/** A8 — provenance without a live link */`)

**JSDoc/TSDoc:**
- Used for type descriptions and ontology references
- Example: `/** Absolute instant, ISO 8601 in UTC. Rendered in the workspace Locale timezone. */`
- Include when a type's invariant isn't obvious (e.g., `TaskDate` being a discriminated union)

**Block comments:**
- Longer explanations (2+ sentences): use `/** ... */` above function or section
- Link to documents: `// See CONTEXT.md`, `// Ontology: A4.1`
- Explain constraints: `// The codes are invariant in gender for every entity (A4.1)`

**Example from codebase:**
```typescript
/**
 * A Data of a Task is either a civil day or an instant. The form is chosen per
 * Data, never per Task (documento 06, 6.2).
 */
export type TaskDate =
  | { readonly form: "civilDay"; readonly value: CivilDate }
  | { readonly form: "instant"; readonly value: Instant };
```

## Function Design

**Size:** 
- Prefer small, focused functions (20-50 lines typical)
- Extract validation checks into named helpers for readability (e.g., `activeMember(state, id)`)

**Parameters:** 
- First param is always `state: DataState` for operations
- Second param: `actingMemberId: Id` (who is performing the action)
- Third+ params: input object or simple values
- Use discriminated unions for complex inputs

**Return Values:** 
- All operations return `OperationResult<T>` (typed union)
- Synchronous only — no promises in domain layer
- Pure functions: no side effects beyond state mutation (in operations)

## Module Design

**Exports:**
- Operations: export named functions that take `state` and return `OperationResult`
- Types: export interfaces and type aliases, re-export from organized subdirectories
- Utilities: export pure functions (derive, helpers)
- Example: `packages/dominio/src/operations/scale.ts` exports `saveView`, `deleteView`, `createGoal`, etc.

**Barrel Files:**
- `packages/dominio/src/index.ts` → types, state, operations namespace, derive namespace, seed functions
- `packages/dominio/src/operations/index.ts` → named exports of all operation functions
- `packages/dominio/src/types/*.ts` → domain-organized exports (one per ontology section)

**CONTEXT.md Per Layer:**
Each layer has a `CONTEXT.md`:
- Root: `CONTEXT.md` (dependency rules, where changes originate)
- Domain: `packages/dominio/CONTEXT.md` (what enters, what exits, re-exports)
- Web: `apps/web/CONTEXT.md` (UI patterns, store integration)
- API: `apps/api/CONTEXT.md` (persistence layer, endpoints)
- Sublayers: `apps/api/src/{rotas,repositorios,servicos}/CONTEXT.md`

Read the root `CONTEXT.md` before reading layer-specific ones.

## Invariants & Constraints

**Immutability:**
- Types use `readonly` on properties: `readonly id: Id`, `readonly members: Member[]`
- Operations mutate state in-place (mutable collections), but inputs are readonly

**Language split:**
- Code identifiers (functions, variables, types): English only
- User-facing strings and error messages: Portuguese (pt-BR)
- Comments: Portuguese (pt-BR) — explain WHY in Portuguese
- Ontology state codes (e.g., "ativo", "arquivado"): Portuguese in code (canonical per A4.1)

**Colors in UI:**
- No hardcoded hex values outside `apps/web/src/estilos/tokens.css`
- All colors referenced via CSS custom properties: `var(--token-name)`
- Enforced by `npm run verificar:tokens` (script at `apps/web/scripts/verificar-tokens.mjs`)

**No raw colors example:**
```typescript
// ❌ DON'T
<div className="bg-white" />  // raw Tailwind color

// ✅ DO
<div className="bg-[var(--page)]" />  // token reference
```

---

*Convention analysis: 2026-09-15*
