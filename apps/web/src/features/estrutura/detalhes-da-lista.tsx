"use client";

/**
 * A linha de detalhes do cabeçalho da página da Lista (Fase 10, 2.1.6, saída de
 * `page.tsx` sem mudar comportamento): por onde a Lista conversacional atende,
 * o aviso de que o espelho de «Meus negócios» é cópia do Funil e o período
 * planejado.
 */

import Link from "next/link";
import { canaisDaLista } from "@n1/dominio/derive-conversacional";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations/canais";
import { useData } from "@/dados/store";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { Pilula } from "@/features/shell/ui";
import type { List } from "@n1/dominio/types";

export function DetalhesDaLista({
  list,
  conversacional,
  espelhoComercial,
}: {
  readonly list: List;
  readonly conversacional: boolean;
  readonly espelhoComercial: boolean;
}) {
  const state = useData((data) => data);
  const fmt = useFormat();
  return (
    <span className="app-meta flex flex-wrap items-center gap-3">
      {conversacional ? (
        // C36 — por onde esta Lista atende: o tipo e a conta, na ordem marcada.
        canaisDaLista(state, list.id).length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>Atende por</span>
            {canaisDaLista(state, list.id).map((ch) => {
              const IconeDoCanal = CHANNEL_ICON[ch.channelType];
              return (
                <Pilula key={ch.id} tom="neutro" className="gap-1.5" title={`${CHANNEL_TYPE_LABEL[ch.channelType]} · ${ch.externalId}`}>
                  <IconeDoCanal className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
                  {ch.name}
                </Pilula>
              );
            })}
          </span>
        ) : (
          <span role="status" style={{ color: "var(--aviso)" }}>
            {LISTA_SEM_CANAIS.replace(" configure-os nas Configurações da Lista.", "")}{" "}
            <Link href={`/estrutura/listas/${list.id}/configuracoes`} className="underline">
              Configurar os canais
            </Link>
            .
          </span>
        )
      ) : null}
      {espelhoComercial ? (
        <span>
          Cópia do Funil “{list.name}”: mover aqui não move o Negócio em{" "}
          <Link href="/crm/negocios" className="underline">
            Negócios
          </Link>
          .
        </span>
      ) : null}
      {list.plannedPeriod?.start ? (
        <span>
          Período planejado:{" "}
          {fmt.taskDate({
            form: "civilDay",
            value: list.plannedPeriod.start,
          })}
          {list.plannedPeriod.end
            ? ` a ${fmt.taskDate({ form: "civilDay", value: list.plannedPeriod.end })}`
            : ""}
        </span>
      ) : null}
    </span>
  );
}
