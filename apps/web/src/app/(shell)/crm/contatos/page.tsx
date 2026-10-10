"use client";

/**
 * T13 — Contatos, lidos da api (D-04, traçador do 07-01).
 *
 * A lista vem de `GET /contatos` (SWR + `chamarCrm` com `Authorization:
 * Bearer`), não mais do store em memória do modelo antigo. A chave começa com
 * `/contatos` para `invalidarCrm("/contatos")` alcançá-la depois de uma
 * gravação.
 *
 * Saíram desta tela, de propósito:
 *   - o painel de Suspeitas de Duplicidade e a mesclagem (D-02): derivam do
 *     modelo antigo e voltam quando a mesclagem for reescrita sobre a 007;
 *   - o botão "Importar Contatos" (D-15): grava no modelo antigo;
 *   - o `CreateRecordDialog` antigo: a criação nova usa `POST /contatos`.
 *
 * A ficha `/crm/contatos/[id]` continua a do modelo antigo até o 07-06; abrir
 * por aqui um Contato criado pela api cai no "não encontrado" dela.
 */

import useSWR from "swr";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import { chamarCrm, ErroDeApi } from "@/dados/crm/cliente-crm";
import { useData } from "@/dados/store";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader, StateSeal } from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

const CHAVE_DA_LISTA = "/contatos?estado=ativo&limite=50&deslocamento=0";

interface RespostaDaLista {
  readonly ok: true;
  readonly itens: ContatoResumo[];
  readonly total: number;
}

/** O `StateSeal` conhece `naLixeira`; a api fala `na_lixeira`. */
function seloDoEstado(estado: ContatoResumo["estado"]): string {
  return estado === "na_lixeira" ? "naLixeira" : estado;
}

export default function ContatosPage() {
  const membros = useData((data) => data.members);
  const { data, error, isLoading } = useSWR(CHAVE_DA_LISTA, (chave: string) => chamarCrm<RespostaDaLista>(chave));

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Contatos" meta={`${total} Contatos`} />

      <CorpoDeTela semRespiro>
        {error ? (
          <EmptyState
            title="Não foi possível carregar os Contatos."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        ) : isLoading ? (
          <EsqueletoDeLinhas quantidade={6} />
        ) : (
          <RecordList
            items={itens}
            hrefOf={(item) => `/crm/contatos/${item.id}`}
            emptyTitle="Nenhum Contato ainda."
            emptyHint="Contatos também são criados automaticamente quando uma Mensagem chega por um Canal."
            columns={[
              { key: "nome", label: "Nome de exibição", render: (item) => <span className="truncate">{item.nomeDeExibicao}</span> },
              { key: "email", label: "E-mail principal", render: (item) => item.emailPrincipal ?? "—" },
              { key: "telefone", label: "Telefone principal", render: (item) => item.telefonePrincipal ?? "—" },
              {
                key: "proprietario",
                label: "Proprietário",
                render: (item) => membros.find((m) => m.id === item.proprietarioId)?.displayName ?? "—",
              },
              { key: "estado", label: "Estado", render: (item) => <StateSeal state={seloDoEstado(item.estado)} /> },
            ]}
          />
        )}
      </CorpoDeTela>
    </div>
  );
}
