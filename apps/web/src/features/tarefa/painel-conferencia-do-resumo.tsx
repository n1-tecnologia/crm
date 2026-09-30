"use client";

/**
 * Fase 6 (Fluxos 5 e 6) — o card "Conferência do Resumo" na conta a pagar.
 *
 * O Agente publica o `📋 RESUMO DE PAGAMENTO` no tópico da conta e abre uma
 * Conferência (`ApprovalRequest` de processo com `processStep: "resumo"`).
 * O clique é o caminho oficial (D6-02): "Conferido, pode lançar" ou "Pedir
 * ajuste" chamam `decideProcessApproval` com `source: "click"` pelo MESMO
 * controlador da Aprovação da Solicitação (`useDecisaoDeAprovacao`, em
 * `./painel-aprovacao`) — um controlador, dois cards; a fila `/ia/aprovacoes`
 * importa os diálogos daqui, como já importa os da Solicitação.
 *
 * Nenhum componente deste arquivo lê a coleção de Aprovações do estado: o estado da
 * Conferência (e a própria Conferência vigente) vem de `conferenciaDoResumo`,
 * do domínio. A tela não calcula "está desatualizada", "foi superada" ou
 * "vale para os dados atuais" — isso é regra, e regra mora em `@n1/dominio`.
 *
 * O texto do RESUMO não é reparseado (D6-10): a tripla conta · categoria ·
 * código vem de `origin.lancamento`, que é dado.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useSession } from "@/dados/store";
import {
  CP,
  conferenciaDoResumo,
  erpMissingFields,
  lancamentoSemCodigo,
  movidaDepoisDaImportacao,
  podeDecidirAConferencia,
} from "@n1/dominio/operations";
import type { ConferenciaDoResumo, EstadoDaConferencia } from "@n1/dominio/operations";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Id, Task } from "@n1/dominio/types";
import type { Formatters } from "@/features/shell/format";
import { valorDaConta } from "@/features/estrutura/financeiro/lens";
import { PainelAprovacao, useDecisaoDeAprovacao } from "./painel-aprovacao";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  Field,
  Painel,
  Pilula,
  RecordRow,
  TextArea,
} from "@/features/shell/ui";
import type { TomPilula } from "@/features/shell/ui";

/* ── Leitura de apresentação ────────────────────────────────────────────── */

function textoDoCampo(task: Task, definitionId: Id): string {
  const v = task.fieldValues.find((x) => x.definitionId === definitionId && x.state === "ativo")?.value;
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

export interface ResumoDaConta {
  readonly numero: string;
  readonly valorTexto: string;
  readonly fornecedor: string;
  readonly vencimento: string;
}

/**
 * Apresentação, não regra: valor, fornecedor e vencimento. Nunca CPF/CNPJ,
 * chave Pix, código de barras ou o texto do RESUMO — esses ficam na conta,
 * para quem a abre (o mesmo cuidado de `resumoDaSolicitacao`).
 */
export function resumoDaConta(task: Task, state: DataState, fmt: Formatters): ResumoDaConta {
  const pessoaId = textoDoCampo(task, CP.fields.pessoa);
  const fornecedor =
    (pessoaId ? state.members.find((m) => m.id === pessoaId)?.displayName : undefined) ??
    (textoDoCampo(task, CP.fields.nomeFornecedor) || "—");
  const temValor = task.fieldValues.some((v) => v.definitionId === CP.fields.valor && v.state === "ativo");
  return {
    numero: task.readableId ?? task.id,
    valorTexto: temValor ? fmt.money({ amount: valorDaConta(task), currency: "BRL" }) : "—",
    fornecedor,
    vencimento: task.dueDate ? fmt.taskDate(task.dueDate) : "—",
  };
}

/** Status em que a conta ainda espera, ou está, a conferência — antes de "lançado omie". */
const STATUS_DA_CONFERENCIA: readonly string[] = [CP.status.paraPagar, CP.status.emLancamento];

/**
 * O estado que a TELA mostra — `conferenciaDoResumo` decide o estado; aqui
 * só se decide se há o que mostrar: nada fora de Contas a pagar, nada para
 * Integração manual (D6-04: o Agente não encosta), e `sem-resumo` só numa
 * conta completa em "para pagar"/"em lançamento omie" (o Agente ainda não
 * publicou; numa conta incompleta o que falta é dado, não Resumo) que a
 * ponte varre — a conta importada do ClickUp e parada desde a importação
 * não recebe Resumo (G1, `movidaDepoisDaImportacao`), então a tela não o
 * promete.
 */
export function conferenciaVisivel(
  state: DataState,
  task: Task,
): { readonly estado: EstadoDaConferencia; readonly conferencia?: ConferenciaDoResumo } | undefined {
  if (task.listId !== CP.listId) return undefined;
  if (textoDoCampo(task, CP.fields.integracaoManual) === "Manual") return undefined;
  const { estado, conferencia } = conferenciaDoResumo(state, task);
  if (estado === "sem-resumo") {
    if (!STATUS_DA_CONFERENCIA.includes(task.statusId)) return undefined;
    if (erpMissingFields(state, task).length > 0) return undefined;
    if (!movidaDepoisDaImportacao(state, task)) return undefined;
  }
  return conferencia ? { estado, conferencia } : { estado };
}

/**
 * Quem vê os botões: `podeDecidirAConferencia` do domínio — a MESMA régua com
 * que a ponte lê as respostas do fio (06-18, crm2:WR-03): quem ALCANÇA a
 * conta (um Administrador fora da Lista privada não comenta nela, e a
 * resposta canônica no fio seria recusada) e é o aprovador designado (o
 * Financeiro, ou quem a ponte indicou) ou um Membro ativo de Papel base
 * Administrador/Proprietário. Quem confere pelo clique é quem confere pelo
 * fio; a fila (`ia/aprovacoes`) usa esta mesma função.
 */
export function podeConferirOResumo(state: DataState, memberId: Id, conferencia: ConferenciaDoResumo): boolean {
  return podeDecidirAConferencia(state, memberId, conferencia);
}

/**
 * 06-14 (crm:WR-03, a parte da tela) — o Resumo não tem código de Categoria
 * que se confira: a tela não oferece "Conferido, pode lançar" (card) nem
 * "Conferir" (fila), só o pedido de ajuste. Leitura do DADO da Conferência
 * (`origin.lancamento`, D6-10), pela MESMA regra com que o domínio recusa a
 * aprovação desde o 06-11 (`lancamentoSemCodigo`: veredito `ausente` ou
 * código fora da forma do contrato). Uma regra de tela, dois lugares.
 */
export function faltaCodigoDaCategoria(conferencia: ConferenciaDoResumo): boolean {
  return lancamentoSemCodigo(conferencia.origin.lancamento);
}

const ROTULO_DO_CARD: Record<EstadoDaConferencia, string> = {
  "sem-resumo": "Aguardando",
  pendente: "Pendente",
  conferida: "Conferido",
  "ajuste-pedido": "Ajuste pedido",
  desatualizada: "Desatualizado",
};

const PILULA: Record<EstadoDaConferencia, { readonly texto: string; readonly tom: TomPilula }> = {
  "sem-resumo": { texto: "Aguardando Resumo", tom: "neutro" },
  pendente: { texto: "Resumo para conferir", tom: "aviso" },
  conferida: { texto: "Resumo conferido", tom: "sucesso" },
  "ajuste-pedido": { texto: "Ajuste pedido", tom: "info" },
  desatualizada: { texto: "Resumo desatualizado", tom: "aviso" },
};

/* ── A pílula ao lado do Status ─────────────────────────────────────────── */

/** O estado da Conferência como pílula — no cabeçalho da conta e na linha de `contas-view`. */
export function PilulaDaConferencia({ task }: { readonly task: Task }) {
  const visivel = useData((data) => conferenciaVisivel(data, task));
  if (!visivel || !STATUS_DA_CONFERENCIA.includes(task.statusId)) return null;
  const { texto, tom } = PILULA[visivel.estado];
  return (
    <Pilula tom={tom} comPonto className="whitespace-nowrap" title="Conferência do Resumo de pagamento">
      {texto}
    </Pilula>
  );
}

/* ── Diálogos (card + fila) ─────────────────────────────────────────────── */

function Tripla({ conferencia }: { readonly conferencia: ConferenciaDoResumo }) {
  const { conta, categoria, codigo } = conferencia.origin.lancamento;
  return <>{`${conta} · ${categoria} · ${codigo}`}</>;
}

export function DialogoConferir({
  open,
  resumo,
  conferencia,
  processando,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly resumo: ResumoDaConta;
  readonly conferencia: ConferenciaDoResumo;
  readonly processando: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Conferir o Resumo de ${resumo.numero}?`}
      description='A conferência fica registrada no tópico. O lançamento no Omie acontece quando a conta for para "em lançamento omie".'
      confirmLabel={processando ? "Conferindo…" : "Conferido, pode lançar"}
      cancelLabel="Voltar"
      {...(processando ? { confirmDisabledReason: "Conferindo…" } : {})}
      onConfirm={onConfirm}
      onCancel={processando ? () => {} : onCancel}
    >
      <dl className="grid gap-1">
        <RecordRow label="Lançamento">
          <Tripla conferencia={conferencia} />
        </RecordRow>
        <RecordRow label="Fornecedor">{resumo.fornecedor}</RecordRow>
        <RecordRow label="Valor">{resumo.valorTexto}</RecordRow>
        <RecordRow label="Vencimento">{resumo.vencimento}</RecordRow>
      </dl>
    </ConfirmDialog>
  );
}

export function DialogoPedirAjuste({
  open,
  resumo,
  conferencia,
  processando,
  motivo,
  onMotivoChange,
  onConfirm,
  onCancel,
}: {
  readonly open: boolean;
  readonly resumo: ResumoDaConta;
  readonly conferencia: ConferenciaDoResumo;
  readonly processando: boolean;
  readonly motivo: string;
  readonly onMotivoChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={`Pedir ajuste no Resumo de ${resumo.numero}?`}
      description="O pedido fica no tópico, e o Agente republica o Resumo revisado no mesmo tópico para uma nova conferência."
      confirmLabel={processando ? "Pedindo…" : "Pedir ajuste"}
      cancelLabel="Voltar"
      {...(processando
        ? { confirmDisabledReason: "Pedindo…" }
        : motivo.trim() === ""
          ? { confirmDisabledReason: "Escreva o que ajustar." }
          : {})}
      onConfirm={onConfirm}
      onCancel={processando ? () => {} : onCancel}
    >
      <dl className="grid gap-1 mb-3">
        <RecordRow label="Lançamento">
          <Tripla conferencia={conferencia} />
        </RecordRow>
        <RecordRow label="Valor">{resumo.valorTexto}</RecordRow>
      </dl>
      <Field label="O que ajustar" required hint="O Agente lê o seu pedido e republica o Resumo com ele.">
        {(id) => <TextArea id={id} value={motivo} onChange={onMotivoChange} rows={3} disabled={processando} />}
      </Field>
    </ConfirmDialog>
  );
}

/* ── O card na conta ─────────────────────────────────────────────────────── */

export function PainelConferenciaDoResumo({
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

  const visivel = conferenciaVisivel(state, task);
  const conferencia = visivel?.conferencia;

  const controlador = useDecisaoDeAprovacao(conferencia?.id, (decisao) => {
    setDialogoAberto(null);
    setMotivo("");
    report(
      { ok: true, value: undefined } as OperationResult<unknown>,
      decisao === "aprovada" ? "Resumo conferido." : "Ajuste pedido; o Agente vai republicar o Resumo.",
    );
  });

  if (!visivel) return null;
  const { estado } = visivel;
  const titulo = `Conferência do Resumo · ${ROTULO_DO_CARD[estado]}`;

  if (!conferencia) {
    return (
      <Painel>
        <CabecalhoDePainel titulo={titulo} />
        <div className="p-3">
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Aguardando o Resumo do Agente.
          </p>
        </div>
      </Painel>
    );
  }

  const resumo = resumoDaConta(task, state, fmt);
  const nomeDe = (id: Id | undefined) => state.members.find((m) => m.id === id)?.displayName ?? "—";
  const aprovador = nomeDe(conferencia.approverMemberId);
  const autorizado = podeConferirOResumo(state, memberId, conferencia);
  const { veredito } = conferencia.origin.lancamento;
  const semCodigo = faltaCodigoDaCategoria(conferencia);

  return (
    <Painel>
      <CabecalhoDePainel titulo={titulo} />
      <div className="p-3 grid gap-2">
        <dl className="grid gap-1">
          <RecordRow label="Lançamento">
            <Tripla conferencia={conferencia} />
          </RecordRow>
          <RecordRow label="Fornecedor">{resumo.fornecedor}</RecordRow>
          <RecordRow label="Valor">{resumo.valorTexto}</RecordRow>
          <RecordRow label="Vencimento">{resumo.vencimento}</RecordRow>
        </dl>
        {veredito === "revisar" ? (
          <p className="app-base" style={{ color: "var(--aviso)" }}>
            A categoria foi escolhida por semelhança de nome: confira o código antes de conferir.
          </p>
        ) : veredito === "ausente" ? (
          <p className="app-base" style={{ color: "var(--aviso)" }}>
            A categoria não tem correspondência no plano de contas: peça o ajuste com o código certo.
          </p>
        ) : null}
        <a href={`#comentario-${conferencia.origin.resumoCommentId}`} className="app-sm underline" style={{ color: "var(--texto)" }}>
          Ver o Resumo no tópico
        </a>

        {controlador.erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {controlador.erro}
          </p>
        ) : null}

        {estado === "conferida" ? (
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Conferido por {nomeDe(conferencia.decidedByMemberId)}
            {conferencia.decidedAt ? ` em ${fmt.instant(conferencia.decidedAt)}` : ""} ·{" "}
            {conferencia.decisionSource === "comment" ? "por comentário" : "por clique"}
          </p>
        ) : estado === "ajuste-pedido" ? (
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Ajuste pedido por {nomeDe(conferencia.decidedByMemberId)}: {conferencia.decisionReason ?? "—"} — o Agente vai
            republicar o Resumo
          </p>
        ) : estado === "desatualizada" ? (
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            Os dados mudaram depois da conferência; um Resumo novo será publicado
          </p>
        ) : autorizado && semCodigo ? (
          // Sem código de Categoria não há o que conferir: só o pedido de ajuste (o domínio recusaria a aprovação).
          <div className="grid gap-2">
            <p className="app-base" style={{ color: "var(--texto-2)" }}>
              {'Peça ajuste com o código da Categoria — pelo botão ou respondendo no fio do Resumo com o código (ex.: "use 2.04.03").'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setDialogoAberto("rejeitada")}
                disabled={controlador.processando !== null}
                disabledReason="Aguarde a decisão em andamento."
              >
                Pedir ajuste
              </Button>
            </div>
          </div>
        ) : autorizado ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => setDialogoAberto("aprovada")}
                disabled={controlador.processando !== null}
                disabledReason="Aguarde a decisão em andamento."
              >
                Conferido, pode lançar
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDialogoAberto("rejeitada")}
                disabled={controlador.processando !== null}
                disabledReason="Aguarde a decisão em andamento."
              >
                Pedir ajuste
              </Button>
            </div>
            {/* crm:WR-05 — o "ok" no fio (D6-02) também confere; a ponte lê a resposta ao Resumo.
                06-18 (crm2:WR-03) — só quando a Conferência aceita o "ok" pelo fio (`origin.aprovacaoPeloFio`, dado). */}
            <p className="app-sm" style={{ color: "var(--texto-3)" }}>
              {conferencia.origin.aprovacaoPeloFio === false
                ? "Confira pelo botão; uma resposta no fio do Resumo pede ajuste."
                : 'Confira pelo botão ou responda "ok" no fio do Resumo; qualquer outra resposta no fio pede ajuste.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              Somente {aprovador} ou um Administrador confere este Resumo.
            </p>
            <Link href="/ia/aprovacoes" className="app-sm underline" style={{ color: "var(--texto)" }}>
              Abrir na fila de aprovações
            </Link>
          </div>
        )}
      </div>

      {estado === "pendente" && autorizado ? (
        <>
          {semCodigo ? null : (
            <DialogoConferir
              open={dialogoAberto === "aprovada"}
              resumo={resumo}
              conferencia={conferencia}
              processando={controlador.processando === "aprovada"}
              onConfirm={() => controlador.decidir("aprovada")}
              onCancel={() => setDialogoAberto(null)}
            />
          )}
          <DialogoPedirAjuste
            open={dialogoAberto === "rejeitada"}
            resumo={resumo}
            conferencia={conferencia}
            processando={controlador.processando === "rejeitada"}
            motivo={motivo}
            onMotivoChange={setMotivo}
            onConfirm={() => controlador.decidir("rejeitada", motivo)}
            onCancel={() => setDialogoAberto(null)}
          />
        </>
      ) : null}
    </Painel>
  );
}

/**
 * O ponto de decisão da página da Tarefa: numa conta a pagar, a Conferência
 * do Resumo; em qualquer outra Tarefa, a Aprovação de processo de sempre.
 * Nunca os dois — `PainelAprovacao` escolheria a Conferência como "a
 * aprovação mais recente" e a mostraria com os textos da Solicitação.
 */
export function PainelDeDecisaoDaTarefa({
  task,
  fmt,
  report,
}: {
  readonly task: Task;
  readonly fmt: Formatters;
  readonly report: (result: OperationResult<unknown>, message: string) => void;
}) {
  return task.listId === CP.listId ? (
    <PainelConferenciaDoResumo task={task} fmt={fmt} report={report} />
  ) : (
    <PainelAprovacao task={task} fmt={fmt} report={report} />
  );
}
