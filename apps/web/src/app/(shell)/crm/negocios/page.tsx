"use client";

/**
 * T17 — Negócios, lidos e gravados pela api (D-04, D-05). O quadro é a leitura
 * padrão: uma coluna por Etapa do Funil escolhido, em `ordem`
 * (`QuadroDoFunil`, `features/crm/quadro-do-funil.tsx`).
 *
 * B58 continua valendo — toda Etapa é de progressão, então `ganho` e `perdido`
 * NÃO são colunas: são uma situação que o Negócio carrega na última Etapa, e
 * os encerrados aparecem na faixa própria abaixo do quadro.
 *
 * Esta tela é o quadro das ETAPAS DO FUNIL. O quadro de Status das Listas
 * conversacionais (Tarefas-espelho) é outro arquivo,
 * `features/estrutura/quadro-negocios.tsx`, e `/crm/meus-negocios` segue o
 * modelo de Tarefas: nenhum dos dois muda aqui (D-15).
 *
 * O cabeçalho soma só os abertos: o valor declarado e o ponderado pela
 * probabilidade efetiva (`totaisDoQuadro`). A lista do quadro é lida aqui e no
 * `QuadroDoFunil` com a MESMA chave de SWR — uma ida à api, não duas. Os Funis
 * do `Select` são os ativos; o quadro abre no Funil padrão do Espaço (D-13).
 * "Novo Negócio" abre o `DialogoNovoNegocio` por `?criar=negocio` e, ao criar,
 * leva à ficha do Negócio.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase } from "lucide-react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunis } from "@/dados/crm/funis";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import { DialogoNovoNegocio, FUNIS_ATIVOS } from "@/features/crm/formulario-de-negocio";
import { negociosDoFunil, QuadroDoFunil, totaisDoQuadro, useNegociosDoQuadro } from "@/features/crm/quadro-do-funil";
import { marcarChegada } from "@/features/shell/recente";
import { Button, CorpoDeTela, EmptyState, EsqueletoDeLinhas, Icone, PageHeader, Select } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** Os totais do cabeçalho são somados em BRL, a moeda padrão dos Negócios. */
const MOEDA_DOS_TOTAIS = "BRL";

export default function NegociosPage() {
  const router = useRouter();
  const fmt = useFormat();
  const funis = useFunis(FUNIS_ATIVOS);
  const [escolhido, setEscolhido] = useState("");
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("negocio");
  const semCriar = usePodeNoCrm("criar", "negocio");

  // `keepPreviousData`: só os Funis ativos entram, venha a lista de onde vier.
  const ativos = (funis.data?.itens ?? []).filter((item) => item.funil.estado === "ativo").map((item) => item.funil);
  const funil = ativos.find((item) => item.id === escolhido) ?? ativos.find((item) => item.padrao) ?? ativos[0];
  const lista = useNegociosDoQuadro(funil?.id);
  const totais = totaisDoQuadro(funil ? negociosDoFunil(lista.data?.itens, funil.id) : []);

  const corpo = () => {
    if (funis.data === undefined) {
      if (funis.error) {
        return (
          <EmptyState
            title="Não foi possível carregar os Funis."
            hint={funis.error instanceof ErroDeApi ? funis.error.message : "Tente de novo em instantes."}
          />
        );
      }
      return <EsqueletoDeLinhas quantidade={6} />;
    }
    if (!funil) {
      return (
        <EmptyState
          title="Nenhum Funil ativo."
          hint="Um Negócio existe sempre dentro de um Funil e de uma Etapa: crie um Funil primeiro."
          action={
            <Link href="/crm/funis" className="btn btn-contorno btn-sm">
              Ir para Funis
            </Link>
          }
        />
      );
    }
    return <QuadroDoFunil funilId={funil.id} onNovo={openCreate} />;
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Negócios"
        icon={<Icone de={Briefcase} tamanho="sm" />}
        meta={`${totais.abertos} ${totais.abertos === 1 ? "aberto" : "abertos"}`}
        details={
          funil ? (
            <>
              <span className="app-meta app-numero">{fmt.money({ amount: totais.declarado, currency: MOEDA_DOS_TOTAIS })} em valor declarado</span>
              <span className="app-meta app-numero">
                {fmt.money({ amount: totais.ponderado, currency: MOEDA_DOS_TOTAIS })} ponderado pela probabilidade
              </span>
            </>
          ) : undefined
        }
        actions={
          <>
            {funil ? (
              <span className="flex items-center gap-2">
                <label htmlFor="funil-do-quadro" className="app-sm shrink-0" style={{ color: "var(--texto-3)" }}>
                  Funil
                </label>
                <span className="w-48">
                  <Select
                    id="funil-do-quadro"
                    value={funil.id}
                    onChange={setEscolhido}
                    options={ativos.map((item) => ({ value: item.id, label: item.nome, ...(item.padrao ? { detail: "padrão" } : {}) }))}
                  />
                </span>
              </span>
            ) : null}
            {semCriar === undefined ? (
              <Button variant="primary" onClick={openCreate}>
                Novo Negócio
              </Button>
            ) : null}
          </>
        }
      />

      <DialogoNovoNegocio
        open={creating}
        onClose={closeCreate}
        onCriado={(detalhado) => {
          closeCreate();
          const href = `/crm/negocios/${detalhado.negocio.id}`;
          // O aviso viaja com a navegação: a ficha que abre o acende (UI-SPEC: Toast + ir para a ficha).
          marcarChegada(href, "Negócio criado.");
          router.push(href);
        }}
        {...(funil ? { valorInicial: { funilId: funil.id } } : {})}
      />

      <CorpoDeTela>{corpo()}</CorpoDeTela>
    </div>
  );
}
