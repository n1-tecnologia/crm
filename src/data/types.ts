/**
 * Domain types, one per ontology entity.
 *
 * Derived from sections 6 (attributes) and 11 (states) of the 21 ontology
 * documents. The path is the one the PRD fixes (`src/data/types.ts`); the
 * definitions live in `types/` split by domain so no single file carries the
 * whole model.
 *
 * Identifiers are in English (code convention); every user-facing string is
 * pt-BR and lives in the interface, never here — except the ontology state
 * codes, which are canonical and invariant in gender (A4.1).
 */

export * from "./types/primitives";
export * from "./types/workspace";
export * from "./types/structure";
export * from "./types/crm";
export * from "./types/ai";
export * from "./types/panels";
