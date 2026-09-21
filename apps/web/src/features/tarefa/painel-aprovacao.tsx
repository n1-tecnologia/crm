"use client";

/**
 * D-08 — o Card de Aprovação na página cheia da Tarefa é o segundo ponto de
 * decisão, e chama exatamente a mesma operação (`decideProcessApproval`) que
 * a fila `/ia/aprovacoes`. Os dois diálogos de decisão (`DialogoAprovar`,
 * `DialogoRejeitar`) e o controlador de decisão (`useDecisaoDeAprovacao`)
 * nascem aqui e são importados pela fila — a UI-SPEC proíbe dois diálogos
 * diferentes para o mesmo fato de negócio.
 *
 * D-11 — aprovação de processo nunca mostra prazo, contagem regressiva ou
 * expiração: nenhum destes componentes lê `deadline` porque o ramo
 * `processTask` de `ApprovalOrigin` não tem esse campo.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useData, useLastResult, useRun, useSession } from "@/dados/store";
import { decideProcessApproval } from "@n1/dominio/operations";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio";
import { fluxoManualDe } from "./fluxo-manual-dialog";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { ApprovalRequest, Id, Task } from "@n1/dominio/types";
import type { Formatters } from "@/features/shell/format";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  EmptyState,
  Esqueleto,
  Field,
  Painel,
  Pilula,
  RecordRow,
  TextArea,
} from "@/features/shell/ui";

/* ── Campos da Solicitação, resolvidos por rótulo (nunca id hardcoded solto) */

function campoPorRotulo(rotulo: string): Id | undefined {
  return CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === rotulo)?.id;
}

const CAMPO_CENTRO_DE_CUSTO = campoPorRotulo("Centro de Custo");
const CAMPO_PESSOA = campoPorRotulo("Pessoa");
const CAMPO_NOME_DO_FORNECEDOR = campoPorRotulo("Nome do fornecedor");
const CAMPO_NOME_DO_SOLICITANTE = campoPorRotulo("Nome do solicitante");
const CAMPO_DATA_VENCIMENTO = campoPorRotulo("Data Vencimento");
const CAMPO_VALOR = campoPorRotulo("Valor");

function valorDoCampo(task: Task, definitionId: Id | undefined) {
  if (!definitionId) return undefined;
  return task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
}

export interface ResumoDaSolicitacao {
  readonly numero: string;
  readonly centroDeCusto: string;
  readonly fornecedor: string;
  readonly solicitante: string;
  readonly vencimento: string;
  readonly valorTexto: string;
  readonly anexos: number;
}

/**
 * Leitura de apresentação, não derivada de domínio: nunca lê CPF/CNPJ, chave
 * Pix, código de barras ou o comentário do RESUMO — esses dados ficam
 * restritos à Tarefa (UI-SPEC "Fila de aprovações" e "Card de aprovação").
 */
export function resumoDaSolicitacao(task: Task, state: DataState, fmt: Formatters): ResumoDaSolicitacao {
  const centro = valorDoCampo(task, CAMPO_CENTRO_DE_CUSTO);
  const pessoaId = valorDoCampo(task, CAMPO_PESSOA);
  const nomeFornecedor = valorDoCampo(task, CAMPO_NOME_DO_FORNECEDOR);
  const solicitante = valorDoCampo(task, CAMPO_NOME_DO_SOLICITANTE);
  const vencimento = valorDoCampo(task, CAMPO_DATA_VENCIMENTO);
  const valor = valorDoCampo(task, CAMPO_VALOR);

  const fornecedor =
    (typeof pessoaId === "string" && pessoaId ? state.members.find((m) => m.id === pessoaId)?.displayName : undefined) ??
    (typeof nomeFornecedor === "string" && nomeFornecedor ? nomeFornecedor : undefined) ??
    "—";

  return {
    numero: task.readableId ?? task.id,
    centroDeCusto: typeof centro === "string" && centro ? centro : "—",
    fornecedor,
    solicitante: typeof solicitante === "string" && solicitante ? solicitante : "—",
    vencimento: typeof vencimento === "string" && vencimento ? fmt.civilDate(vencimento) : "—",
    valorTexto: typeof valor === "number" ? fmt.money({ amount: valor, currency: "BRL" }) : "—",
    anexos: task.attachments.length,
  };
}

/* ── Controlador de decisão compartilhado ─────────────────────────────────
 *
 * `run()` clona o estado, roda a operação na cópia e devolve o resultado
 * IMEDIATO (D-05 de `store.ts`): uma recusa local (não autorizado, motivo
 * vazio, já decidida na cópia) chega aqui síncrona. A confirmação real do
 * servidor chega depois, fora de `run()` — por isso o card nunca é otimista
 * (UI-SPEC "Decisão por clique · Estado de processamento"): o controlador
 * fica em `processando` até `data.approvals` mudar (sucesso, inclusive
 * replay idempotente) ou `lastResult` marcar falha (conflito ou transitória).
 */
export interface ControladorDeDecisao {
  readonly processando: "aprovada" | "rejeitada" | null;
  readonly erro: string | null;
  decidir(decisao: "aprovada" | "rejeitada", motivo?: string): void;
  limparErro(): void;
}

/**
 * `processando` e `erro` são DERIVADOS a cada render, não copiados para
 * estado local por um `useEffect` — `store.ts::run()` grava `lastResult`
 * tanto na recusa síncrona local (D-05) quanto na recusa assíncrona do
 * servidor (D-06), então os dois casos se resolvem pelo MESMO cálculo, sem
 * `setState` dentro de efeito (evita a cascata de render que a regra
 * `react-hooks/set-state-in-effect` proíbe). O único efeito real que resta é
 * a NOTIFICAÇÃO ao chamador quando a decisão termina em sucesso — não é
 * `setState` deste hook, é a fila/o card reagindo (fechar diálogo, mostrar
 * Toast).
 */
export function useDecisaoDeAprovacao(
  approvalId: Id | undefined,
  onSucesso: (decisao: "aprovada" | "rejeitada") => void,
): ControladorDeDecisao {
  const run = useRun();
  const lastResult = useLastResult();
  const state = useData((data) => data);
  const approval = state.approvals.find((a) => a.id === approvalId);
  /*
    A tentativa carrega o `approvalId` a que pertence — a fila reaproveita o
    MESMO controlador entre diálogos de Solicitações diferentes, e sem essa
    amarra uma tentativa (ou o erro dela) de uma decisão vazaria para a
    próxima. Isso substitui um `useEffect` de "resetar ao trocar de prop":
    quando `approvalId` muda, `tentativaAtual` já nasce `null` por conta
    própria, puro cálculo, sem `setState` dentro de efeito.
  */
  const [tentativa, setTentativa] = useState<{ readonly approvalId: Id; readonly decisao: "aprovada" | "rejeitada" } | null>(
    null,
  );
  const [marca, setMarca] = useState(0);
  const tentativaAtual = tentativa && tentativa.approvalId === approvalId ? tentativa.decisao : null;

  const formatarConflito = (mensagem: string): string => {
    if (mensagem.startsWith("Esta Solicitação já foi") && approval?.decidedByMemberId) {
      const nome = state.members.find((m) => m.id === approval.decidedByMemberId)?.displayName ?? "outro Membro";
      return `Esta Solicitação já foi decidida por ${nome}. A tela foi atualizada.`;
    }
    return mensagem;
  };

  const erro =
    tentativaAtual !== null && lastResult && !lastResult.ok && lastResult.at > marca
      ? formatarConflito(lastResult.error)
      : null;

  // Termina quando a decisão aparece em `data` (sucesso, inclusive replay
  // idempotente) OU quando `erro` aparece (a decisão é terminal: uma vez
  // presente, não desaparece, então não precisa de um "desligamento" à parte).
  const processando =
    tentativaAtual !== null && erro === null && approval?.decision !== tentativaAtual ? tentativaAtual : null;

  useEffect(() => {
    if (tentativaAtual !== null && approval?.decision === tentativaAtual) onSucesso(tentativaAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSucesso é recriada a cada render do chamador de propósito; só o par (decision, tentativaAtual) decide se dispara
  }, [approval?.decision, tentativaAtual]);

  const decidir = (decisao: "aprovada" | "rejeitada", motivo?: string) => {
    if (!approvalId) return;
    // -1 garante `lastResult.at > marca` mesmo quando a recusa é síncrona e
    // cai no mesmo milissegundo desta chamada.
    setMarca(Date.now() - 1);
    run((data, memberId) =>
      decideProcessApproval(data, memberId, approvalId, decisao, {
        source: "click",
        ...(motivo ? { reason: motivo } : {}),
      }),
    );
    setTentativa({ approvalId, decisao });
  };

  return { processando, erro, decidir, limparErro: () => setTentativa(null) };
}

/* ── Diálogos compartilhados (fila + card) ────────────────────────────────── */

export function DialogoAprovar({
  open,
  resumo,
  processando,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly resumo: ResumoDaSolicitacao;
  readonly processando: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Aprovar solicitação ${resumo.numero}?`}
      description="A decisão será registrada na timeline e o processamento continuará."
      confirmLabel={processando ? "Aprovando…" : "Aprovar solicitação"}
      cancelLabel="Voltar"
      {...(processando ? { confirmDisabledReason: "Aprovando…" } : {})}
      onConfirm={onConfirm}
      onCancel={processando ? () => {} : onCancel}
    >
      <dl className="grid gap-1">
        <RecordRow label="Fornecedor">{resumo.fornecedor}</RecordRow>
        <RecordRow label="Valor">{resumo.valorTexto}</RecordRow>
        <RecordRow label="Centro de Custo">{resumo.centroDeCusto}</RecordRow>
        <RecordRow label="Anexos">{resumo.anexos}</RecordRow>
      </dl>
    </ConfirmDialog>
  );
}

export function DialogoRejeitar({
  open,
  resumo,
  processando,
  motivo,
  onMotivoChange,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly resumo: ResumoDaSolicitacao;
  readonly processando: boolean;
  readonly motivo: string;
  readonly onMotivoChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Rejeitar solicitação ${resumo.numero}?`}
      description='Rejeitar solicitação? Esta decisão muda o status para "não aprovado" e fica registrada na timeline. Informe o motivo para continuar.'
      confirmLabel={processando ? "Rejeitando…" : "Rejeitar solicitação"}
      cancelLabel="Voltar"
      destructive
      {...(processando
        ? { confirmDisabledReason: "Rejeitando…" }
        : motivo.trim() === ""
          ? { confirmDisabledReason: "Escreva o motivo da rejeição." }
          : {})}
      onConfirm={onConfirm}
      onCancel={processando ? () => {} : onCancel}
    >
      <dl className="grid gap-1 mb-3">
        <RecordRow label="Fornecedor">{resumo.fornecedor}</RecordRow>
        <RecordRow label="Valor">{resumo.valorTexto}</RecordRow>
        <RecordRow label="Centro de Custo">{resumo.centroDeCusto}</RecordRow>
      </dl>
      <Field label="Motivo da rejeição" required hint="O motivo ficará visível para o Financeiro na timeline.">
        {(id) => <TextArea id={id} value={motivo} onChange={onMotivoChange} rows={3} disabled={processando} />}
      </Field>
    </ConfirmDialog>
  );
}

/* ── O painel na página cheia da Tarefa ───────────────────────────────────── */

function encontrarAprovacaoDeProcesso(state: DataState, taskId: Id): ApprovalRequest | undefined {
  return [...state.approvals]
    .filter((a) => a.origin.kind === "processTask" && a.origin.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function PainelAprovacao({
  task,
  fmt,
  report,
}: {
  readonly task: Task;
  readonly fmt: Formatters;
  readonly report: (result: OperationResult<unknown>, message: string) => void;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const [dialogoAberto, setDialogoAberto] = useState<"aprovada" | "rejeitada" | null>(null);
  const [motivo, setMotivo] = useState("");

  const approval = encontrarAprovacaoDeProcesso(state, task.id);

  const controlador = useDecisaoDeAprovacao(approval?.id, (decisao) => {
    setDialogoAberto(null);
    setMotivo("");
    report(
      { ok: true, value: undefined } as OperationResult<unknown>,
      decisao === "aprovada" ? "Solicitação aprovada; a Execução retomou." : "Solicitação rejeitada.",
    );
  });

  const member = state.members.find((m) => m.id === memberId);
  const role = state.roles.find((r) => r.id === member?.roleId);
  const adminLevel = role?.base === "administrador" || role?.base === "proprietario";

  if (!approval) {
    if (!adminLevel) return null;
    return (
      <Painel>
        <CabecalhoDePainel titulo="Aprovação" />
        <div className="p-3">
          <EmptyState compact title="Esta Tarefa não possui uma aprovação de processo." />
        </div>
      </Painel>
    );
  }

  if (approval.origin.kind !== "processTask") return null; // guarda de tipo; `encontrarAprovacaoDeProcesso` já filtra por kind.
  const origin = approval.origin;

  const aprovador = state.members.find((m) => m.id === approval.approverMemberId);
  const autorizado = approval.approverMemberId === memberId || adminLevel;
  const naoAutorizadoMotivo = `Somente ${aprovador?.displayName ?? "o aprovador designado"} ou um Administrador pode decidir esta Solicitação.`;
  const fluxoManual = fluxoManualDe(state, task);

  if (approval.decision) {
    const decisor = state.members.find((m) => m.id === approval.decidedByMemberId)?.displayName ?? "—";
    return (
      <Painel>
        <CabecalhoDePainel titulo="Aprovação" />
        <div className="p-3 grid gap-2">
          {controlador.erro ? (
            <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
              {controlador.erro}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <h3 className="app-md" style={{ color: "var(--texto)" }}>
              Aprovação concluída
            </h3>
            <Pilula tom={approval.decision === "aprovada" ? "sucesso" : "neutro"} comPonto>
              {approval.decision === "aprovada" ? "Aprovada" : "Rejeitada"}
            </Pilula>
          </div>
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Decidida por {decisor}
            {approval.decidedAt ? ` em ${fmt.instant(approval.decidedAt)}` : ""} ·{" "}
            {approval.decisionSource === "comment" ? "por comentário" : "por clique"}
          </p>
          {approval.decisionReason ? (
            <p className="app-base" style={{ color: "var(--texto)" }}>
              {approval.decisionReason}
            </p>
          ) : null}
          {fluxoManual ? (
            <p className="app-base" style={{ color: "var(--texto-2)" }}>
              Fluxo manual por {fluxoManual.nome}: {fluxoManual.motivo}
            </p>
          ) : null}
        </div>
      </Painel>
    );
  }

  const resumo = resumoDaSolicitacao(task, state, fmt);

  return (
    <Painel>
      <CabecalhoDePainel titulo="Aprovação" />
      <div className="p-3 grid gap-3">
        <div className="flex items-center gap-2">
          <h3 className="app-md" style={{ color: "var(--texto)" }}>
            Aprovação pendente
          </h3>
          <Pilula tom="aviso" comPonto>
            Pendente
          </Pilula>
        </div>
        <p className="app-base" style={{ color: "var(--texto-2)" }}>
          Aguardando decisão de {aprovador?.displayName ?? "—"}.
        </p>
        <p className="app-base" style={{ color: "var(--texto-2)" }}>
          Centro de Custo: {resumo.centroDeCusto} · Valor: {resumo.valorTexto}
        </p>
        <a href={`#comentario-${origin.threadCommentId}`} className="app-sm underline" style={{ color: "var(--texto)" }}>
          Ver tópico de aprovação
        </a>

        {fluxoManual ? (
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Fluxo manual por {fluxoManual.nome}: {fluxoManual.motivo}
          </p>
        ) : null}

        {controlador.erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {controlador.erro}
          </p>
        ) : null}

        {autorizado ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => setDialogoAberto("aprovada")}
              disabled={controlador.processando !== null}
              disabledReason="Aguarde a decisão em andamento."
            >
              Aprovar solicitação
            </Button>
            <Button
              variant="danger"
              onClick={() => setDialogoAberto("rejeitada")}
              disabled={controlador.processando !== null}
              disabledReason="Aguarde a decisão em andamento."
            >
              Rejeitar solicitação
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              {naoAutorizadoMotivo}
            </p>
            <Link href="/ia/aprovacoes" className="app-sm underline" style={{ color: "var(--texto)" }}>
              Abrir na fila de aprovações
            </Link>
          </div>
        )}
      </div>

      <DialogoAprovar
        open={dialogoAberto === "aprovada"}
        resumo={resumo}
        processando={controlador.processando === "aprovada"}
        onConfirm={() => controlador.decidir("aprovada")}
        onCancel={() => setDialogoAberto(null)}
      />
      <DialogoRejeitar
        open={dialogoAberto === "rejeitada"}
        resumo={resumo}
        processando={controlador.processando === "rejeitada"}
        motivo={motivo}
        onMotivoChange={setMotivo}
        onConfirm={() => controlador.decidir("rejeitada", motivo)}
        onCancel={() => setDialogoAberto(null)}
      />
    </Painel>
  );
}

/**
 * UI-SPEC "Estados de carregamento, vazio e erro · Card da Tarefa": geometria
 * final, `aria-hidden`, região que carrega anunciada por `role="status"`
 * sr-only. `PainelAprovacao` nasce já hidratado nesta fase — o layout do
 * shell aguarda `carregarEstadoInicial()` no servidor antes de montar a
 * árvore (`(shell)/layout.tsx`) — então este esqueleto ainda não tem onde
 * entrar em produção; fica pronto para o dia em que a Aprovação carregar à
 * parte (por exemplo, a fusão em timeline única do Plan 02-19).
 */
export function PainelAprovacaoEsqueleto() {
  return (
    <Painel>
      <CabecalhoDePainel titulo="Aprovação" />
      <div className="p-3 grid gap-3" aria-hidden="true">
        <Esqueleto largura="40%" altura="1.25rem" />
        <Esqueleto largura="70%" />
        <Esqueleto largura="55%" />
        <div className="flex gap-2">
          <Esqueleto largura="9rem" altura="var(--controle-h-lg)" />
          <Esqueleto largura="9rem" altura="var(--controle-h-lg)" />
        </div>
      </div>
      <p role="status" className="sr-only">
        Carregando a Aprovação…
      </p>
    </Painel>
  );
}
