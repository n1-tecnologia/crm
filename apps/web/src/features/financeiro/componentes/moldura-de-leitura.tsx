/**
 * O ÚNICO lugar que decide qual dos três estados (D4-15) uma tela do
 * Financeiro mostra. `EstadoDeFalha`/`TentarDeNovo` e `EmptyState` nunca
 * aparecem juntos: ou a leitura falhou (`indisponivel`) e a tela nem chega a
 * `children`, ou ela respondeu (`ok`) e é `children` — dentro do próprio
 * dado — quem decide se a lista está vazia.
 *
 * Server Component: `redirect()` e a leitura em si só fazem sentido no
 * servidor, e não precisa de `"use client"` para renderizar `NoAccessState`
 * ou `TentarDeNovo` (ambos Client Components importados por um Server
 * Component, o padrão comum do App Router).
 */

import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NoAccessState } from "@/features/shell/ui";
import type { Leitura } from "../dados/leitura";
import { TentarDeNovo } from "./estado-de-falha";

export function MolduraDeLeitura<T>({
  leitura,
  children,
}: {
  readonly leitura: Leitura<T>;
  readonly children: (dados: T, lidoEm: string) => ReactNode;
}) {
  if (leitura.tipo === "semSessao") redirect("/entrar");
  if (leitura.tipo === "semAcesso") return <NoAccessState what="Financeiro" />;
  if (leitura.tipo === "indisponivel") return <TentarDeNovo />;
  return <>{children(leitura.dados, leitura.lidoEm)}</>;
}
