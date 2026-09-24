"use client";

/**
 * A composição do UI-SPEC §"2 · Notas fiscais": `PageHeader` + filtros
 * client-side sobre o array já projetado inteiro + nove colunas + os dois
 * gatilhos de lote (D4-12) — nenhuma emissão por linha é alcançável por esta
 * tela. Componente único (não só a tabela) porque os dois botões de lote
 * vivem no `actions` do `PageHeader` e compartilham estado (diálogo aberto,
 * `Toast` do resultado) com o corpo — `MolduraDeLeitura` só sabe passar
 * `(dados, lidoEm) => ReactNode`, então quem monta cabeçalho e corpo juntos
 * é este componente client, do mesmo jeito que `PageHeader`/`CorpoDeTela` já
 * são Client Components (declarados dentro de `features/shell/ui.tsx`, que
 * abre com `"use client"").
 *
 * Divergência registrada da UI-SPEC (ver SUMMARY): o documento pede um
 * quarto filtro, `Select` de Plataforma. A coluna `plataforma` existe na
 * tabela de origem (`transacoes`, inventário §5.5), mas `NotaFiscalDto`
 * (04-01, `leituras-plataforma-dtos.ts`, já mesclado) não a projeta — só as
 * 13 propriedades de `NotaFiscal` abaixo atravessam a fronteira do
 * `apps/api`. Este componente nunca inventa um enum sobre um campo que não
 * chega até ele; adicionar o campo ao DTO é mudança em
 * `financeiro-tria/automation`, fora do escopo e do `files_modified` deste
 * plano.
 */

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { NotaFiscal } from "../dados/notas-fiscais";
import { executarWorkflow } from "../dados/acoes";
import { BotaoAtualizar } from "./botao-atualizar";
import { type Column, RecordList } from "@/features/shell/record-list";
import {
  BarraDeFiltros,
  Button,
  ConfirmDialog,
  CorpoDeTela,
  Icone,
  PageHeader,
  Pilula,
  Select,
  TextInput,
  Toast,
  type TomPilula,
} from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

const TOM_DO_STATUS: Record<string, TomPilula> = {
  aprovado: "sucesso",
  pago: "sucesso",
  aguardando: "aviso",
  pendente: "aviso",
  cancelado: "erro",
  reembolsado: "erro",
  estornado: "erro",
};

function tomDoStatus(status: string | null): TomPilula {
  if (!status) return "neutro";
  return TOM_DO_STATUS[status.toLowerCase()] ?? "neutro";
}

/** Valores distintos, não vazios, em ordem alfabética — nunca um enum inventado. */
function opcoesDistintas(linhas: readonly NotaFiscal[], campo: "statusPedido" | "formaPagamento") {
  const vistos = new Set<string>();
  for (const linha of linhas) {
    const valor = linha[campo];
    if (valor) vistos.add(valor);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "pt-BR")).map((valor) => ({ value: valor, label: valor }));
}

function EmissaoIcone({ ligado, titulo }: { readonly ligado: boolean; readonly titulo: string }) {
  // `Icone` não repassa `title` (a assinatura de `LucideIcon` não o expõe) —
  // o `title` do navegador precisa de um ancestral que o aceite.
  return (
    <span title={titulo}>
      <Icone de={CheckCircle2} tamanho="xs" style={{ color: ligado ? "var(--sucesso)" : "var(--texto-4)" }} />
    </span>
  );
}

export function TabelaDeNotasFiscais({ notas, lidoEm }: { readonly notas: readonly NotaFiscal[]; readonly lidoEm: string }) {
  const fmt = useFormat();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [pagamento, setPagamento] = useState("");

  const [confirmandoMarcar, setConfirmandoMarcar] = useState(false);
  const [confirmandoEmitir, setConfirmandoEmitir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ readonly tone: "neutral" | "error"; readonly texto: string } | null>(null);

  const opcoesStatus = useMemo(() => opcoesDistintas(notas, "statusPedido"), [notas]);
  const opcoesPagamento = useMemo(() => opcoesDistintas(notas, "formaPagamento"), [notas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return notas.filter((nota) => {
      if (status && nota.statusPedido !== status) return false;
      if (pagamento && nota.formaPagamento !== pagamento) return false;
      if (termo) {
        const alvo = `${nota.idPedido ?? ""} ${nota.cliente ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [notas, busca, status, pagamento]);

  async function disparar(key: string, fechar: () => void) {
    setEnviando(true);
    const resultado = await executarWorkflow(key);
    setEnviando(false);
    fechar();
    if (resultado.ok) {
      setToast({ tone: "neutral", texto: "Execução iniciada. Isto pode levar alguns instantes." });
    } else {
      setToast({ tone: "error", texto: resultado.erro });
    }
  }

  const colunas: ReadonlyArray<Column<NotaFiscal>> = [
    { key: "pedido", label: "Pedido", render: (nota) => <span className="app-base app-numero">{nota.idPedido ?? "—"}</span> },
    { key: "cliente", label: "Cliente", render: (nota) => <span className="app-base">{nota.cliente ?? "—"}</span> },
    {
      key: "produtos",
      label: "Produto(s)",
      render: (nota) => (
        <span className="app-base block max-w-[220px] truncate" title={nota.produtos ?? undefined}>
          {nota.produtos ?? "—"}
        </span>
      ),
    },
    {
      key: "valor",
      label: "Valor",
      className: "text-right",
      render: (nota) => (
        <span className="app-base app-numero">
          {nota.valorTotal !== null ? fmt.money({ amount: nota.valorTotal, currency: "BRL" }) : "—"}
        </span>
      ),
    },
    { key: "pagamento", label: "Pagamento", render: (nota) => <span className="app-base">{nota.formaPagamento ?? "—"}</span> },
    {
      key: "status",
      label: "Status",
      render: (nota) => <Pilula tom={tomDoStatus(nota.statusPedido)}>{nota.statusPedido ?? "—"}</Pilula>,
    },
    {
      key: "emissao",
      label: "Emissão",
      render: (nota) => (
        <span className="flex items-center gap-1">
          <EmissaoIcone ligado={nota.emissaoNotaProduto} titulo="Nota de Produto" />
          <EmissaoIcone ligado={nota.emissaoNotaServico} titulo="Nota de Serviço" />
          <EmissaoIcone ligado={nota.controleEmissao} titulo="Controle de emissão" />
        </span>
      ),
    },
    {
      key: "seteDias",
      label: "7 dias",
      render: (nota) => (nota.seteDias ? <Pilula tom="aviso">7 dias</Pilula> : null),
    },
    {
      key: "aprovadoEm",
      label: "Aprovado em",
      render: (nota) => <span className="app-meta">{nota.aprovadoEm ? fmt.instant(nota.aprovadoEm) : "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Notas fiscais"
        meta={`${filtradas.length} de ${notas.length}`}
        actions={
          <span className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setConfirmandoMarcar(true)}>
              Marcar 7 dias
            </Button>
            <Button variant="primary" size="sm" onClick={() => setConfirmandoEmitir(true)}>
              Emitir notas pendentes
            </Button>
            <BotaoAtualizar lidoEm={lidoEm} />
          </span>
        }
      />

      <BarraDeFiltros>
        <div className="min-w-48 flex-1">
          <label htmlFor="notas-fiscais-busca" className="sr-only">
            Buscar por pedido ou cliente
          </label>
          <TextInput
            id="notas-fiscais-busca"
            size="sm"
            type="search"
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por pedido ou cliente"
          />
        </div>
        <div className="w-44">
          <Select
            size="sm"
            value={status}
            onChange={setStatus}
            placeholder="Status do pedido"
            options={[{ value: "", label: "Todos os status" }, ...opcoesStatus]}
          />
        </div>
        <div className="w-44">
          <Select
            size="sm"
            value={pagamento}
            onChange={setPagamento}
            placeholder="Forma de pagamento"
            options={[{ value: "", label: "Todas as formas" }, ...opcoesPagamento]}
          />
        </div>
      </BarraDeFiltros>

      <CorpoDeTela>
        {toast ? (
          <Toast tone={toast.tone} onDismiss={() => setToast(null)}>
            {toast.texto}
          </Toast>
        ) : null}

        <RecordList
          items={filtradas}
          columns={colunas}
          emptyTitle="Nenhuma nota fiscal encontrada."
          emptyHint="Ajuste os filtros ou tente outro termo de busca."
        />
      </CorpoDeTela>

      <ConfirmDialog
        open={confirmandoMarcar}
        title="Marcar pedidos com 7 dias"
        description="Marca todos os pedidos elegíveis para o prazo de 7 dias de emissão. A lista atualiza sozinha quando terminar; não há como desfazer marca por marca."
        confirmLabel="Marcar"
        destructive={false}
        {...(enviando ? { confirmDisabledReason: "Enviando…" } : {})}
        onConfirm={() => disparar("tria-invoice-mark-7days", () => setConfirmandoMarcar(false))}
        onCancel={() => setConfirmandoMarcar(false)}
      />

      <ConfirmDialog
        open={confirmandoEmitir}
        title="Emitir as notas fiscais pendentes"
        description="Dispara a emissão de nota de produto e de serviço para todos os pedidos pendentes agora. É a mesma rotina que roda sozinha todo dia — disparar de novo não duplica nota já emitida, mas processa em lote e pode levar alguns minutos."
        confirmLabel="Emitir agora"
        destructive={false}
        {...(enviando ? { confirmDisabledReason: "Enviando…" } : {})}
        onConfirm={() => disparar("tria-invoice-emit", () => setConfirmandoEmitir(false))}
        onCancel={() => setConfirmandoEmitir(false)}
      />
    </>
  );
}
