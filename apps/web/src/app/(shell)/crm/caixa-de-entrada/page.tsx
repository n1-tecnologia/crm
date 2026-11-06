"use client";

/**
 * T21 — Caixa de Entrada sem Conversa aberta.
 *
 * As duas primeiras colunas vêm de `InboxColumns`; aqui só a terceira, que
 * ainda não tem Conversa escolhida — e que por isso diz o que fazer em vez de
 * ficar em branco.
 */

import { useSearchParams } from "next/navigation";
import { useData, useSession } from "@/dados/store";
import {
  ehConversaDeGrupo,
  filtroDoEscopo,
  InboxColumns,
  matchesScope,
  recorteNoCliente,
  scopeTitle,
  useRecorte,
} from "@/features/crm/inbox-columns";
import { CorpoDeTela, EmptyState } from "@/features/shell/ui";

export default function CaixaDeEntradaPage() {
  const scope = useSearchParams().get("escopo") ?? "todas";
  const { memberId } = useSession();
  // O mesmo recorte da coluna: "Minhas" conta só as minhas. As aguardando resposta são as abertas e as
  // pendentes (o total da api, uma consulta de uma linha cada) mais as Conversas de Grupo, que seguem no
  // estado antigo (F14-D-05) e não têm linha em `plataforma.conversas`.
  const doEscopo = filtroDoEscopo(scope, memberId);
  const noCliente = recorteNoCliente(scope, "todas");
  const abertas = useRecorte({ ...doEscopo, situacao: "aberta", limite: 1 }, noCliente);
  const pendentes = useRecorte({ ...doEscopo, situacao: "pendente", limite: 1 }, noCliente);
  const grupos = useData(
    (data) =>
      data.conversations.filter(
        (conversation) => ehConversaDeGrupo(conversation) && conversation.state !== "resolvida" && matchesScope(conversation, scope, memberId),
      ).length,
  );
  const unresolved = abertas.total + pendentes.total + grupos;
  const carregada = abertas.carregada && pendentes.carregada;

  // A terceira coluna já é a coluna de tela: só o corpo, centrado.
  return (
    <InboxColumns>
      <CorpoDeTela className="grid place-items-center">
        <div className="max-w-sm">
          <EmptyState
            title={
              !carregada
                ? scopeTitle(scope)
                : unresolved === 0
                  ? `${scopeTitle(scope)}: nenhuma Conversa aguardando resposta.`
                  : `${scopeTitle(scope)}: ${unresolved} Conversa(s) aguardando resposta.`
            }
            hint="Escolha uma Conversa na coluna ao lado. Os filtros ficam no endereço: trocar de Conversa não perde o recorte, e um recorte se compartilha por link."
          />
        </div>
      </CorpoDeTela>
    </InboxColumns>
  );
}
