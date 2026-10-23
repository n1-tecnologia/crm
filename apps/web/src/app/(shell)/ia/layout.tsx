"use client";

/**
 * Fase 9, D-03 — a área de IA não existe para o Convidado: em qualquer rota
 * `/ia/*` ele vê "sem acesso", e as páginas filhas nem são montadas. É
 * cosmético: a barreira real é o servidor não mandar `agents`, `automations`,
 * `documents`, `collections` e `skills` ao Convidado (D-02, 09-02). O item
 * "IA" já some do trilho pela mesma regra (`veAssuntoIa`).
 *
 * Antes de a sessão resolver (`memberId` nulo) as páginas renderizam: nada
 * some à toa, e `ehConvidado` troca para "sem acesso" assim que o Papel chega.
 */

import { useData, useSession } from "@/dados/store";
import { ehConvidado } from "@/features/shell/assuntos-do-trilho";
import { CorpoDeTela, NoAccessState, PageHeader } from "@/features/shell/ui";

export default function LayoutDaIA({ children }: { children: React.ReactNode }) {
  const estado = useData((data) => data);
  const { memberId } = useSession();

  if (ehConvidado(estado, memberId)) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="IA" />
        <CorpoDeTela>
          <NoAccessState what="a área de IA" />
        </CorpoDeTela>
      </div>
    );
  }
  return <>{children}</>;
}
