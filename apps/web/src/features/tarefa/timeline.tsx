"use client";

/**
 * SOL-04 — Comentários e Registros de Atividade deixam de ser painéis
 * separados na página cheia da Tarefa e viram um único `Timeline`, ordenado
 * do mais antigo para o mais recente. É um `ol`, cada entrada com
 * `<time dateTime>`, para a ordem DOM ser a ordem cronológica (02-UI-SPEC.md
 * "Timeline da Solicitação" / "Acessibilidade").
 *
 * D-03 — `sistema/Formulário` é um Ator próprio; `resolverNomeDoAtor` nunca
 * consulta quem é o dono do Formulário, então o requisito "nunca aparece
 * como o dono" é estrutural, não um cuidado de tela.
 *
 * D-09 — a decisão de aprovação publica uma resposta CANÔNICA no tópico
 * (`decideProcessApproval`, `packages/dominio/src/operations/ai.ts`) e um
 * Registro de Atividade com `objectType: "approvalRequest"` — não
 * `"task"` — então a Atividade da decisão não aparece pelo filtro simples
 * `objectId === task.id`; `atividadeDaTarefa` também busca por
 * `approvalRequest` ligado a uma Aprovação de processo desta Tarefa.
 *
 * Sanitização de eventos de integração (T-02-10): uma entrada cujo Ator é
 * `kind: "integration"` nunca renderiza `detail`/`antes`/`depois` — só o
 * rótulo da ação. É assim que um `detail` com CNPJ ou URL assinada nunca
 * chega ao DOM, sem precisar reconhecer o que "é" sensível dentro do texto.
 *
 * Sem markdown-it/remark (nenhuma dependência nova nesta fase): `Rico`
 * abaixo é o renderer exigido pelo UI-SPEC ("conteúdo Markdown... sem HTML
 * arbitrário") — reconhece só `**negrito**` e `_itálico_`, nunca usa
 * `dangerouslySetInnerHTML`, então HTML arbitrário no conteúdo do
 * Comentário sempre vira texto literal.
 */

import { Send } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { addTaskComment } from "@n1/dominio/operations";
import { useData, useLastResult, useRun } from "@/dados/store";
import type { Formatters } from "@/features/shell/format";
import { ACTOR_KIND_LABEL } from "@/features/shell/format";
import {
  ActorAvatar,
  Button,
  CabecalhoDePainel,
  EmptyState,
  Esqueleto,
  Icone,
  MultiSelect,
  Painel,
  Pilula,
} from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { ActivityRecord, ActorRef, Comment, Task } from "@n1/dominio/types";

/** Quantas entradas (das mais recentes) aparecem antes de "Carregar atividades anteriores". */
const TIMELINE_PAGE_SIZE = 20;

/* ───────────────────────────── Renderer `rico` ──────────────────────────── */

/**
 * `**negrito**` e `_itálico_`, quebra de linha preservada por
 * `white-space: pre-wrap`. Nunca usa HTML — cada pedaço vira texto de nó
 * React, nunca `dangerouslySetInnerHTML` — então nenhum HTML arbitrário do
 * conteúdo do Comentário chega a ser interpretado como marcação.
 */
function Rico({ texto }: { readonly texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter((parte) => parte !== "");
  return (
    <p className="app-base mt-1 whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
      {partes.map((parte, indice) => {
        if (parte.startsWith("**") && parte.endsWith("**")) {
          return <strong key={indice}>{parte.slice(2, -2)}</strong>;
        }
        if (parte.startsWith("_") && parte.endsWith("_") && parte.length > 2) {
          return <em key={indice}>{parte.slice(1, -1)}</em>;
        }
        return <span key={indice}>{parte}</span>;
      })}
    </p>
  );
}

/* ───────────────────────────── Resolução de Ator ────────────────────────── */

/**
 * D-03 — nunca deriva o nome de quem PREENCHEU o Formulário: só olha
 * `actor.kind`/`actor.id`. Um Ator `system` com id `formulario:<id>` vira
 * sempre `sistema/Formulário`, mesmo que o Formulário tenha dono.
 */
function resolverNomeDoAtor(state: DataState, actor: ActorRef): string {
  if (actor.kind === "system" && actor.id.startsWith("formulario:")) return "sistema/Formulário";
  if (actor.kind === "member") {
    return state.members.find((m) => m.id === actor.id)?.displayName ?? "Membro removido";
  }
  if (actor.kind === "agent") {
    return state.agents.find((a) => a.id === actor.id)?.name ?? "Agente eliminado";
  }
  if (actor.kind === "automation") {
    return state.automations.find((a) => a.id === actor.id)?.name ?? "Automação";
  }
  return ACTOR_KIND_LABEL[actor.kind] ?? actor.kind;
}

/** Rótulo textual do tipo de Ator, só quando não é Membro — "menções têm texto, não só cor" vale também aqui. */
function rotuloDoTipo(actor: ActorRef): string | undefined {
  if (actor.kind === "member") return undefined;
  if (actor.kind === "system" && actor.id.startsWith("formulario:")) return undefined; // já embutido no nome
  return ACTOR_KIND_LABEL[actor.kind] ?? actor.kind;
}

/* ───────────────────────────── Montagem das entradas ────────────────────── */

interface EntradaDeComentario {
  readonly tipo: "comentario";
  readonly at: string;
  readonly comment: Comment;
}
interface EntradaDeAtividade {
  readonly tipo: "atividade";
  readonly at: string;
  readonly record: ActivityRecord;
}
type Entrada = EntradaDeComentario | EntradaDeAtividade;

/**
 * D-09 — a Atividade da decisão de aprovação é gravada com
 * `objectType: "approvalRequest"` e `objectId: approval.id`, não
 * `task.id`: sem este segundo caminho de busca, "por clique"/"por
 * comentário" nunca apareceria na Timeline.
 */
function entradasDaTarefa(state: DataState, task: Task): readonly Entrada[] {
  const aprovacoesDaTarefa = new Set(
    state.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === task.id).map((a) => a.id),
  );
  const comentarios: Entrada[] = task.comments
    .filter((c) => !c.deletedAt)
    .map((comment) => ({ tipo: "comentario", at: comment.createdAt, comment }) as const);
  const atividades: Entrada[] = state.activity
    .filter((record) => record.objectId === task.id || (record.objectType === "approvalRequest" && aprovacoesDaTarefa.has(record.objectId)))
    .map((record) => ({ tipo: "atividade", at: record.at, record }) as const);
  return [...comentarios, ...atividades].sort((a, b) => a.at.localeCompare(b.at));
}

/** O comentário de roteamento de cada Aprovação de processo desta Tarefa — recebe a pill `Pedido de aprovação`. */
function comentariosDeRoteamento(state: DataState, task: Task): ReadonlySet<string> {
  return new Set(
    state.approvals
      .filter((a) => a.origin.kind === "processTask" && a.origin.taskId === task.id)
      .map((a) => (a.origin.kind === "processTask" ? a.origin.threadCommentId : undefined))
      .filter((id): id is string => id !== undefined),
  );
}

/* ───────────────────────────── Entrada de Comentário ────────────────────── */

function nomeDaMencao(state: DataState, mencao: { readonly type: string; readonly id: string }): string {
  return mencao.type === "member" ? (state.members.find((m) => m.id === mencao.id)?.displayName ?? mencao.id) : mencao.id;
}

function LinhaDeComentario({
  state,
  fmt,
  comment,
  pai,
  ehRoteamento,
}: {
  readonly state: DataState;
  readonly fmt: Formatters;
  readonly comment: Comment;
  readonly pai: Comment | undefined;
  readonly ehRoteamento: boolean;
}) {
  const nome = resolverNomeDoAtor(state, comment.author);
  const tipo = rotuloDoTipo(comment.author);

  return (
    <li id={`comentario-${comment.id}`} className="item-solto scroll-mt-4" data-bloco="true" data-estatico="true">
      <div className="flex items-start gap-3">
        <ActorAvatar kind={comment.author.kind} name={nome} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-base" style={{ fontWeight: 500, color: "var(--texto)" }}>
              {nome}
            </span>
            {tipo ? <Pilula tom="neutro">{tipo}</Pilula> : null}
            {ehRoteamento ? <Pilula tom="aviso">Pedido de aprovação</Pilula> : null}
            <time dateTime={comment.createdAt} className="app-meta">
              {fmt.relative(comment.createdAt)}
            </time>
            {comment.resolved ? <Pilula tom="sucesso">Resolvido</Pilula> : null}
          </div>
          {comment.parentCommentId ? (
            <a href={`#comentario-${comment.parentCommentId}`} className="app-sm underline" style={{ color: "var(--texto-3)" }}>
              Em resposta a {pai ? resolverNomeDoAtor(state, pai.author) : "comentário anterior"}
            </a>
          ) : null}
          <Rico texto={comment.content} />
          {comment.mentions.length > 0 ? (
            <p className="app-meta">mencionou {comment.mentions.map((m) => nomeDaMencao(state, m)).join(", ")}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────────── Entrada de Atividade ──────────────────────── */

function LinhaDeAtividade({ state, fmt, record }: { readonly state: DataState; readonly fmt: Formatters; readonly record: ActivityRecord }) {
  const nome = resolverNomeDoAtor(state, record.actor);
  // T-02-10 — Ator de integração: só o rótulo da ação. `before`/`after`/`detail`
  // podem carregar payload, CPF/CNPJ ou signed URL, então nunca renderizam aqui.
  const ehIntegracao = record.actor.kind === "integration";

  return (
    <li className="item-solto" data-bloco="true" data-estatico="true">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1.5 shrink-0 rounded-full"
          style={{ width: "0.5rem", height: "0.5rem", background: "var(--texto-3)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="app-base" style={{ color: "var(--texto-1)" }}>
            <span style={{ fontWeight: 500, color: "var(--texto)" }}>{nome}</span>
            {record.delegate ? <span style={{ color: "var(--texto-3)" }}> em nome de {resolverNomeDoAtor(state, record.delegate)}</span> : null}{" "}
            {record.action}
            {!ehIntegracao && (record.before || record.after) ? (
              <span style={{ color: "var(--texto-3)" }}>
                {" "}
                ({record.before ?? "—"} → {record.after ?? "—"})
              </span>
            ) : null}
          </p>
          <p className="app-meta">
            <time dateTime={record.at}>{fmt.relative(record.at)}</time>
            {!ehIntegracao && record.detail ? ` · ${record.detail}` : ""}
          </p>
        </div>
      </div>
    </li>
  );
}

/* ───────────────────────────── Compositor ────────────────────────────────── */

/**
 * D-05/D-06 — `run()` devolve o resultado ACEITO localmente, mas o servidor
 * é a verdade: o rascunho só some quando o Comentário aceito aparece de
 * verdade em `task.comments` (o diff voltou), nunca antes. Uma recusa
 * síncrona (conteúdo vazio, sem permissão) aparece na hora; uma falha do
 * servidor aparece quando `lastResult` marcar depois da nossa tentativa —
 * mesmo padrão de `useDecisaoDeAprovacao` em `painel-aprovacao.tsx`.
 */
function useCompositorDeTimeline(task: Task) {
  const run = useRun();
  const lastResult = useLastResult();
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<readonly string[]>([]);
  const [erroImediato, setErroImediato] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState<{ readonly id: string; readonly marca: number } | null>(null);

  const confirmado = tentativa !== null && task.comments.some((c) => c.id === tentativa.id);

  // Efeito de NOTIFICAÇÃO, não de cálculo (mesmo padrão de `useDecisaoDeAprovacao`):
  // limpa o rascunho só quando o Comentário aceito já está em `data`.
  useEffect(() => {
    if (confirmado) {
      setTexto("");
      setMencoes([]);
      setTentativa(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só o par (task.comments, tentativa) decide, como no controlador de decisão
  }, [confirmado]);

  const erroDoServidor =
    tentativa !== null && !confirmado && lastResult && !lastResult.ok && lastResult.at > tentativa.marca ? lastResult.error : null;
  const erro = erroImediato ?? erroDoServidor;
  const enviando = tentativa !== null && !confirmado && erroDoServidor === null;

  const enviar = () => {
    if (texto.trim() === "" || enviando) return;
    setErroImediato(null);
    const marca = Date.now() - 1;
    const resultado = run((data, memberId) =>
      addTaskComment(data, memberId, task.id, {
        content: texto,
        mentions: mencoes.map((m) => ({ type: "member" as const, id: m })),
      }),
    );
    if (!resultado.ok) {
      setErroImediato(resultado.error);
      return;
    }
    setTentativa({ id: resultado.value.id, marca });
  };

  return { texto, setTexto, mencoes, setMencoes, erro, enviando, enviar };
}

function Compositor({ task }: { readonly task: Task }) {
  const members = useData((data) => data.members);
  const controlador = useCompositorDeTimeline(task);
  const id = useId();

  return (
    <form
      className="grid gap-2 pt-2"
      style={{ borderTop: "1px solid var(--linha-sutil)" }}
      onSubmit={(event) => {
        event.preventDefault();
        controlador.enviar();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Novo comentário
      </label>
      <textarea
        id={id}
        value={controlador.texto}
        onChange={(event) => controlador.setTexto(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            controlador.enviar();
          }
          // Enter sozinho: comportamento padrão do textarea — nova linha.
        }}
        rows={3}
        disabled={controlador.enviando}
        placeholder="Escreva um comentário. Ctrl+Enter envia."
        className="campo"
      />
      {controlador.erro ? (
        <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
          {controlador.erro}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <span className="min-w-56 flex-1">
          <label htmlFor={`${id}-mencoes`} className="sr-only">
            Mencionar alguém
          </label>
          <MultiSelect
            id={`${id}-mencoes`}
            values={controlador.mencoes}
            onChange={controlador.setMencoes}
            placeholder="Mencionar alguém"
            options={members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }))}
          />
        </span>
        <Button
          type="submit"
          variant="primary"
          disabled={controlador.texto.trim() === "" || controlador.enviando}
          disabledReason={controlador.enviando ? "Enviando…" : "Escreva o comentário antes de enviar."}
          icon={<Icone de={Send} tamanho="xs" />}
        >
          {controlador.enviando ? "Enviando…" : "Comentar"}
        </Button>
      </div>
    </form>
  );
}

/* ───────────────────────────── Painel ─────────────────────────────────────── */

export function Timeline({ task, fmt, readOnly }: { readonly task: Task; readonly fmt: Formatters; readonly readOnly: boolean }) {
  const state = useData((data) => data);
  const [janela, setJanela] = useState(TIMELINE_PAGE_SIZE);

  const entradas = useMemo(() => entradasDaTarefa(state, task), [state, task]);
  const roteamento = useMemo(() => comentariosDeRoteamento(state, task), [state, task]);
  const temMais = entradas.length > janela;
  const visiveis = entradas.slice(Math.max(0, entradas.length - janela));
  const contagemVisivel = task.comments.filter((c) => !c.deletedAt).length + entradas.filter((e) => e.tipo === "atividade").length;

  return (
    <Painel>
      <CabecalhoDePainel titulo="Timeline" contagem={contagemVisivel} />
      <div className="p-3 grid gap-3">
        {entradas.length === 0 ? (
          <EmptyState compact title="Nenhum comentário ou atividade nesta Solicitação." />
        ) : (
          <>
            {temMais ? (
              <div className="flex justify-center">
                <Button onClick={() => setJanela((atual) => atual + TIMELINE_PAGE_SIZE)}>Carregar atividades anteriores</Button>
              </div>
            ) : null}
            <ol className="pilha-solta">
              {visiveis.map((entrada) =>
                entrada.tipo === "comentario" ? (
                  <LinhaDeComentario
                    key={`c-${entrada.comment.id}`}
                    state={state}
                    fmt={fmt}
                    comment={entrada.comment}
                    pai={
                      entrada.comment.parentCommentId
                        ? task.comments.find((c) => c.id === entrada.comment.parentCommentId)
                        : undefined
                    }
                    ehRoteamento={roteamento.has(entrada.comment.id)}
                  />
                ) : (
                  <LinhaDeAtividade key={`a-${entrada.record.id}`} state={state} fmt={fmt} record={entrada.record} />
                ),
              )}
            </ol>
          </>
        )}
        {readOnly ? null : <Compositor task={task} />}
      </div>
    </Painel>
  );
}

/**
 * Geometria final com `aria-hidden`, região que carrega anunciada por
 * `role="status"` sr-only — mesmo padrão de `PainelAprovacaoEsqueleto`. A
 * Tarefa nasce hidratada nesta fase (o layout do shell espera
 * `carregarEstadoInicial()` no servidor), então este esqueleto ainda não
 * tem onde entrar em produção; fica pronto para quando a Timeline carregar
 * à parte.
 */
export function TimelineEsqueleto() {
  return (
    <Painel>
      <CabecalhoDePainel titulo="Timeline" />
      <div className="p-3 grid gap-3" aria-hidden="true">
        <Esqueleto largura="60%" altura="2.5rem" />
        <Esqueleto largura="85%" altura="1.5rem" />
        <Esqueleto largura="40%" altura="3rem" />
        <Esqueleto largura="70%" altura="1.5rem" />
      </div>
      <p role="status" className="sr-only">
        Carregando a timeline…
      </p>
    </Painel>
  );
}
