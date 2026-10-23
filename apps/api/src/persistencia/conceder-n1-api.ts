import type { Pool } from "pg";

// Esqueleto do RED: o corpo real vem no GREEN (09-04, Task 3).
export async function concederN1Api(_cliente: Pick<Pool, "query">): Promise<{ readonly papelExiste: boolean }> {
  return { papelExiste: false };
}
