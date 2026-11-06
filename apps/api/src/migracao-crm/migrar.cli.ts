/** Esqueleto do RED (15-27, Task 3). O GREEN troca isto pela CLI. */

import type { DecisaoDeFunil } from "./funil";

export type ModoDoScript = "seco" | "guardar" | "migrar" | "verificar";

export interface ArgumentosDoScript {
  readonly espaco: string;
  readonly modo: ModoDoScript;
  readonly funil?: DecisaoDeFunil;
}

export function lerArgumentos(_argv: readonly string[]): ArgumentosDoScript {
  return { espaco: "", modo: "seco" };
}

export async function principal(_argv: readonly string[]): Promise<number> {
  return 0;
}
