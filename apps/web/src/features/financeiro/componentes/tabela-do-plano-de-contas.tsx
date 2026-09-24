"use client";

/**
 * UI-SPEC §"4 · Plano de contas" (D4-10) — a tela mais importante das oito:
 * `conciliador_contas` é a MESMA tabela que `matchCategory` do Agente
 * consulta para classificar a próxima conta a pagar. A superfície é
 * lista + import em lote + apagar por id, nunca CRUD — sem edição nem
 * criação avulsa (decisão do produto).
 *
 * O diálogo de import AFIRMA a consequência em vez de negá-la (a versão
 * anterior de D4-10 continha a frase oposta, e estava errada); o botão de
 * confirmar só libera depois do `Toggle` de ciência.
 *
 * Sem `?empresa=` a tela nunca chama a leitura com Empresa vazia — é
 * `page.tsx` quem decide isso e passa `linhas: null` nesse caso; aqui o
 * corpo mostra um `EmptyState` pedindo a escolha, mas o filtro continua
 * visível e funcional (é ele quem resolve o pedido).
 *
 * A importação em si exige Empresa E Tipo (o `apps/api`, 04-10, valida os
 * dois como obrigatórios em `CORPO_IMPORTAR_PLANO_CONTAS`, ao contrário da
 * leitura, onde os dois filtros são opcionais) — o botão "Importar CSV"
 * fica desabilitado até que ambos estejam escolhidos, para nunca abrir um
 * diálogo que terminaria em 400.
 */

import { type ChangeEvent, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LinhaDoPlanoDeContas } from "../dados/plano-contas";
import { importarPlanoDeContas, removerLinhaDoPlanoDeContas } from "../dados/acoes";
import { lerCsvDePlanoDeContas, type LinhaCsvDoPlanoDeContas } from "../dados/csv-plano-de-contas";
import { FiltroDeEmpresa } from "./filtro-de-empresa";
import { BotaoAtualizar } from "./botao-atualizar";
import { type Column, RecordList } from "@/features/shell/record-list";
import {
  ActionMenu,
  BarraDeFiltros,
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  PageHeader,
  Select,
  Toast,
  Toggle,
} from "@/features/shell/ui";

const OPCOES_DE_TIPO = [
  { value: "", label: "Todos os tipos" },
  { value: "pagar", label: "Pagar" },
  { value: "receber", label: "Receber" },
] as const;

/** O par (Tipo) do filtro — vive aqui, não em arquivo próprio, porque só esta tela tem essa dimensão. */
function SelectDeTipo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipo = searchParams.get("tipo") ?? "";

  function mudar(valor: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("tipo", valor);
    else params.delete("tipo");
    const texto = params.toString();
    router.replace(texto ? `?${texto}` : "?", { scroll: false });
  }

  return <Select size="sm" placeholder="Todos os tipos" value={tipo} onChange={mudar} options={OPCOES_DE_TIPO} />;
}

export function TabelaDoPlanoDeContas({
  linhas,
  lidoEm,
}: {
  readonly linhas: readonly LinhaDoPlanoDeContas[] | null;
  readonly lidoEm: string | null;
}) {
  const searchParams = useSearchParams();
  const empresa = searchParams.get("empresa") ?? "";
  const tipo = searchParams.get("tipo") ?? "";

  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();

  const [removendo, setRemovendo] = useState<LinhaDoPlanoDeContas | null>(null);
  const [linhasParaImportar, setLinhasParaImportar] = useState<ReadonlyArray<LinhaCsvDoPlanoDeContas> | null>(null);
  const [entendi, setEntendi] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ readonly tone: "success" | "error"; readonly texto: string } | null>(null);

  function abrirSeletorDeArquivo(): void {
    inputRef.current?.click();
  }

  async function aoEscolherArquivo(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;
    const texto = await arquivo.text();
    const resultado = lerCsvDePlanoDeContas(texto);
    if (resultado.erro) {
      setToast({ tone: "error", texto: resultado.erro });
      return;
    }
    setEntendi(false);
    setLinhasParaImportar(resultado.linhas);
  }

  function fecharImportacao(): void {
    setLinhasParaImportar(null);
    setEntendi(false);
  }

  async function confirmarImportacao(): Promise<void> {
    if (!linhasParaImportar || !empresa || (tipo !== "pagar" && tipo !== "receber")) return;
    setEnviando(true);
    const resultado = await importarPlanoDeContas({
      empresa,
      tipo,
      linhas: linhasParaImportar.map((linha) => ({
        cod: linha.cod,
        categoria: linha.categoria,
        categoriaClickup: linha.categoria_clickup,
        descricao: linha.descricao,
      })),
    });
    setEnviando(false);
    if (resultado.ok) {
      setToast({ tone: "success", texto: `${linhasParaImportar.length} linha(s) importada(s).` });
      fecharImportacao();
    } else {
      setToast({ tone: "error", texto: resultado.erro });
    }
  }

  async function confirmarRemocao(): Promise<void> {
    if (!removendo) return;
    setEnviando(true);
    const resultado = await removerLinhaDoPlanoDeContas(removendo.id);
    setEnviando(false);
    setRemovendo(null);
    if (resultado.ok) {
      setToast({ tone: "success", texto: "Linha removida." });
    } else {
      setToast({ tone: "error", texto: resultado.erro });
    }
  }

  const colunas: ReadonlyArray<Column<LinhaDoPlanoDeContas>> = [
    { key: "id", label: "id", render: (linha) => <span className="app-meta">{linha.id}</span> },
    {
      key: "conteudo",
      label: "Conteúdo",
      render: (linha) => (
        <div className="flex flex-col gap-0.5">
          {linha.conteudo.split(",").map((pedaco, indice) => (
            <span key={indice} className="app-meta">
              {pedaco.trim()}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "acoes",
      label: "",
      className: "text-right",
      render: (linha) => <ActionMenu items={[{ label: "Remover", destructive: true, onSelect: () => setRemovendo(linha) }]} />,
    },
  ];

  const importacaoDesabilitada = !empresa || (tipo !== "pagar" && tipo !== "receber");

  return (
    <>
      <PageHeader
        title="Plano de contas"
        meta={linhas ? `${linhas.length} linha(s)` : undefined}
        actions={
          <span className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept=".csv" className="sr-only" onChange={(event) => void aoEscolherArquivo(event)} />
            <Button
              variant="primary"
              size="sm"
              onClick={abrirSeletorDeArquivo}
              disabled={importacaoDesabilitada}
              disabledReason="Escolha a Empresa e o Tipo antes de importar."
            >
              Importar CSV
            </Button>
            {lidoEm ? <BotaoAtualizar lidoEm={lidoEm} /> : null}
          </span>
        }
      />

      <BarraDeFiltros>
        <div className="w-56">
          <FiltroDeEmpresa />
        </div>
        <div className="w-44">
          <SelectDeTipo />
        </div>
      </BarraDeFiltros>

      <CorpoDeTela>
        {toast ? (
          <Toast tone={toast.tone} onDismiss={() => setToast(null)}>
            {toast.texto}
          </Toast>
        ) : null}

        <p className="app-meta">
          Arquivo .csv apenas — importação de planilha (.xlsx) ainda não está disponível nesta tela.
        </p>

        {linhas === null ? (
          <EmptyState
            title="Escolha uma Empresa para ver o Plano de contas."
            hint="O Plano de contas é filtrado por Empresa — escolha uma acima para começar."
          />
        ) : (
          <RecordList
            items={linhas}
            columns={colunas}
            emptyTitle="Nenhuma linha encontrada para este filtro."
            emptyHint="Ajuste a Empresa ou o Tipo, ou importe um CSV."
          />
        )}
      </CorpoDeTela>

      <ConfirmDialog
        open={removendo !== null}
        title="Remover esta linha do Plano de contas"
        description="A linha some do que o Agente consulta para classificar a próxima conta a pagar. Não é um Status arquivado — é remoção de verdade."
        confirmLabel="Remover"
        destructive
        {...(enviando ? { confirmDisabledReason: "Removendo…" } : {})}
        onConfirm={() => void confirmarRemocao()}
        onCancel={() => setRemovendo(null)}
      />

      <ConfirmDialog
        open={linhasParaImportar !== null}
        wide
        title={`Importar ${linhasParaImportar?.length ?? 0} linha(s) para o Plano de contas`}
        description="Esta tabela é a mesma que o Agente consulta para classificar a próxima conta a pagar. Depois de importar, a classificação automática do próximo lançamento pode mudar."
        confirmLabel="Importar e mudar a classificação"
        cancelLabel="Cancelar"
        confirmDisabledReason={!entendi ? "Confirme que leu o aviso acima para importar." : enviando ? "Importando…" : undefined}
        onConfirm={() => void confirmarImportacao()}
        onCancel={fecharImportacao}
      >
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {linhasParaImportar?.map((linha, indice) => (
            <p key={indice} className="app-meta">
              {[linha.cod, linha.categoria, linha.categoria_clickup, linha.descricao].filter(Boolean).join(" · ")}
            </p>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Toggle checked={entendi} onChange={setEntendi} labelledBy={labelId} />
          <span id={labelId} className="app-base">
            Entendi que isto muda a classificação que o Agente usa no próximo lançamento.
          </span>
        </div>
      </ConfirmDialog>
    </>
  );
}
