/**
 * Esqueleto do RED de 11-07 (Task 2): o componente existe para o teste
 * importar, mas ainda só imprime o texto cru. O destaque entra no commit
 * seguinte.
 */

import type { Task } from "@n1/dominio/types";

export function DescricaoDaTarefa({ task }: { readonly task: Task }) {
  return <>{task.description}</>;
}
