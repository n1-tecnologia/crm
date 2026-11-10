"use client";

/**
 * A linha de detalhes do cabeçalho da página da Lista (Fase 10, 2.1.6, saída de
 * `page.tsx` sem mudar comportamento): por onde a Lista conversacional atende e
 * o período planejado.
 *
 * 15-40 (3.4.5): os Canais vêm das tabelas (`GET /canais`, lidos pela página com
 * `useCanais`), não do Canal projetado no estado antigo; o aviso de «Meus negócios é
 * cópia do Funil» saiu com o espelho.
 */

import Link from "next/link";
import { canaisDaListaNasTabelas } from "@n1/dominio/derive-conversacional";
import type { Canal } from "@n1/dominio/crm/canais";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations/canais";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { Pilula } from "@/features/shell/ui";
import type { List } from "@n1/dominio/types";

export function DetalhesDaLista({
  list,
  conversacional,
  canais,
}: {
  readonly list: List;
  readonly conversacional: boolean;
  /** Os Canais ativos das tabelas; `undefined` enquanto a api não respondeu (a linha dos canais espera). */
  readonly canais: readonly Canal[] | undefined;
}) {
  const fmt = useFormat();
  const daLista = canais ? canaisDaListaNasTabelas(list, canais) : undefined;
  return (
    <span className="app-meta flex flex-wrap items-center gap-3">
      {conversacional && daLista ? (
        // C36 — por onde esta Lista atende: o tipo e a conta, na ordem marcada.
        daLista.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>Atende por</span>
            {daLista.map((ch) => {
              const IconeDoCanal = CHANNEL_ICON[ch.tipo];
              return (
                <Pilula key={ch.id} tom="neutro" className="gap-1.5" title={`${CHANNEL_TYPE_LABEL[ch.tipo]} · ${ch.identificadorExterno}`}>
                  <IconeDoCanal className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
                  {ch.nome}
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
