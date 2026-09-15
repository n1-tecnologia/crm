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
import { InboxColumns, matchesScope, scopeTitle } from "@/features/crm/inbox-columns";
import { CorpoDeTela, EmptyState } from "@/features/shell/ui";

export default function CaixaDeEntradaPage() {
  const scope = useSearchParams().get("escopo") ?? "todas";
  const { memberId } = useSession();
  // O mesmo recorte da coluna: "Minhas" conta só as minhas.
  const unresolved = useData(
    (data) =>
      data.conversations.filter(
        (conversation) =>
          conversation.lifecycle === "ativo" && conversation.state !== "resolvida" && matchesScope(conversation, scope, memberId),
      ).length,
  );

  // A terceira coluna já é a coluna de tela: só o corpo, centrado.
  return (
    <InboxColumns>
      <CorpoDeTela className="grid place-items-center">
        <div className="max-w-sm">
          <EmptyState
            title={
              unresolved === 0
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
