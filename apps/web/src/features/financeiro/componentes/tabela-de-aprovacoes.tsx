"use client";

/**
 * D4-11: esta é a única das oito telas do Financeiro sem nenhuma ação —
 * aprovar é decisão da plataforma desde a Fase 2, e um segundo botão sobre a
 * tabela antiga seria a divergência que a migração inteira existe para
 * eliminar. A diretiva de cliente aqui é só para o hook de formatação
 * (`fmt.relative`), não para interatividade: este arquivo não abre menu, não
 * dispara confirmação e não reage a clique nenhum.
 */

import Link from "next/link";
import { type Column, RecordList } from "@/features/shell/record-list";
import { useFormat } from "@/features/shell/use-format";
import type { LinhaDeAprovacaoPendente } from "../dados/aprovacoes-pendentes";

export function TabelaDeAprovacoes({ linhas }: { readonly linhas: ReadonlyArray<LinhaDeAprovacaoPendente> }) {
  const fmt = useFormat();

  const columns: ReadonlyArray<Column<LinhaDeAprovacaoPendente>> = [
    { key: "id", label: "Id", className: "app-meta", render: (item) => `SP-${item.id}` },
    { key: "fornecedor", label: "Fornecedor", render: (item) => item.fornecedor },
    { key: "status", label: "Status", render: (item) => item.status },
    { key: "previsao", label: "Previsão", render: (item) => fmt.relative(item.previsao) },
  ];

  return (
    <RecordList
      items={linhas}
      columns={columns}
      emptyTitle="Nenhuma solicitação pendente nesta vista legada."
      emptyHint="Ela esvazia com o tempo à medida que o pipeline antigo se encerra. Decisões acontecem em Aprovações."
      emptyAction={
        <Link href="/ia/aprovacoes" className="underline" style={{ color: "var(--acento)" }}>
          Ir para Aprovações
        </Link>
      }
    />
  );
}
