/**
 * `npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>` — esqueleto do RED (15-29, Task 2): ainda não faz nada.
 */

export interface ArgumentosDoDemo {
  readonly espaco: string;
}

export const USO = "";

export function lerArgumentos(_argv: readonly string[]): ArgumentosDoDemo {
  return { espaco: "" };
}

export async function principal(_argv: readonly string[]): Promise<number> {
  return 0;
}
