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

import { ChevronRight, Send } from "lucide-react";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { CabecalhoDaAtividade, formatarQuando, normalizarBusca, type FiltroDaAtividade } from "@/features/tarefa/feed-de-atividade";
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
  timeZone,
}: {
  readonly state: DataState;
  readonly fmt: Formatters;
  readonly comment: Comment;
  readonly pai: Comment | undefined;
  readonly ehRoteamento: boolean;
  readonly timeZone: string;
}) {
  const nome = resolverNomeDoAtor(state, comment.author);
  const tipo = rotuloDoTipo(comment.author);
  void fmt;

  // O cartão do ClickUp: avatar, nome e hora no topo; o texto embaixo. Resposta recua.
  return (
    <li id={`comentario-${comment.id}`} className={`scroll-mt-4 py-1.5${comment.parentCommentId ? " pl-6" : ""}`}>
      <div
        className="rounded-[var(--r-painel)] px-3 py-2.5"
        style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)" }}
      >
        <div className="flex items-center gap-2">
          <ActorAvatar kind={comment.author.kind} name={nome} />
          <span className="app-base min-w-0 truncate" style={{ fontWeight: 600, color: "var(--texto)" }}>
            {nome}
          </span>
          {tipo ? <Pilula tom="neutro">{tipo}</Pilula> : null}
          {ehRoteamento ? <Pilula tom="aviso">Pedido de aprovação</Pilula> : null}
          {comment.resolved ? <Pilula tom="sucesso">Resolvido</Pilula> : null}
          <time dateTime={comment.createdAt} className="app-sm ml-auto shrink-0 whitespace-nowrap" style={{ color: "var(--texto-3)" }}>
            {formatarQuando(comment.createdAt, timeZone)}
          </time>
        </div>
        {comment.parentCommentId ? (
          <a href={`#comentario-${comment.parentCommentId}`} className="app-sm mt-1 inline-block underline" style={{ color: "var(--texto-3)" }}>
            Em resposta a {pai ? resolverNomeDoAtor(state, pai.author) : "comentário anterior"}
          </a>
        ) : null}
        <Rico texto={comment.content} />
        {comment.mentions.length > 0 ? (
          <p className="app-meta mt-1">mencionou {comment.mentions.map((m) => nomeDaMencao(state, m)).join(", ")}</p>
        ) : null}
      </div>
    </li>
  );
}

/* ───────────────────────────── Entrada de Atividade ──────────────────────── */

function LinhaDeAtividade({
  state,
  record,
  timeZone,
}: {
  readonly state: DataState;
  readonly record: ActivityRecord;
  readonly timeZone: string;
}) {
  const nome = resolverNomeDoAtor(state, record.actor);
  // T-02-10 — Ator de integração: só o rótulo da ação. `before`/`after`/`detail`
  // podem carregar payload, CPF/CNPJ ou signed URL, então nunca renderizam aqui.
  const ehIntegracao = record.actor.kind === "integration";

  // A linha discreta do ClickUp: bolinha · quem fez o quê · quando, à direita.
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span aria-hidden="true" className="app-sm shrink-0 leading-5" style={{ color: "var(--texto-4)" }}>
        •
      </span>
      <span className="app-sm min-w-0 flex-1 break-words leading-5" style={{ color: "var(--texto-3)" }}>
        <span>{nome}</span>
        {record.delegate ? ` em nome de ${resolverNomeDoAtor(state, record.delegate)}` : ""} {record.action}
        {!ehIntegracao && (record.before || record.after) ? ` (${record.before ?? "—"} → ${record.after ?? "—"})` : ""}
        {!ehIntegracao && record.detail ? ` · ${record.detail}` : ""}
      </span>
      <time dateTime={record.at} className="app-sm shrink-0 whitespace-nowrap leading-5" style={{ color: "var(--texto-3)" }}>
        {formatarQuando(record.at, timeZone)}
      </time>
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
 * mesmo padrão de `useDecisaoDeAprovacao` em `painel-aprovacao.tsx`. `texto`/
 * `mencoes` moram em `Compositor` (quem os exibe), não aqui: o efeito de
 * confirmação chama `onEnviado` — nunca `setTexto` direto — pela mesma razão
 * de `useDecisaoDeAprovacao` chamar `onSucesso` em vez de mexer no estado do
 * card por dentro do próprio efeito.
 */
function useCompositorDeTimeline(task: Task, texto: string, mencoes: readonly string[], onEnviado: () => void) {
  const run = useRun();
  const lastResult = useLastResult();
  const [erroImediato, setErroImediato] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState<{ readonly id: string; readonly marca: number } | null>(null);

  const confirmado = tentativa !== null && task.comments.some((c) => c.id === tentativa.id);

  // Efeito de NOTIFICAÇÃO, não de cálculo (mesmo padrão de `useDecisaoDeAprovacao`):
  // avisa só quando o Comentário aceito já está em `data`.
  useEffect(() => {
    if (confirmado) onEnviado();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEnviado é recriada a cada render do chamador de propósito; só `confirmado` decide se dispara
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

  return { erro, enviando, enviar };
}

/** O "@" em curso: o que vem depois do último "@" antes do cursor (até dois espaços — nomes têm sobrenome). */
function arrobaEmCurso(texto: string, caret: number): { readonly inicio: number; readonly consulta: string } | null {
  const antes = texto.slice(0, caret);
  const m = /(^|\s)@([^\s@]*(?:\s[^\s@]*){0,2})$/.exec(antes);
  const consulta = m?.[2];
  return consulta !== undefined ? { inicio: antes.length - consulta.length - 1, consulta } : null;
}

function Compositor({ task }: { readonly task: Task }) {
  const members = useData((data) => data.members);
  const [texto, setTexto] = useState("");
  /** Quem foi escolhido pelo "@" — só conta na hora de enviar se o "@Nome" ainda estiver no texto. */
  const [escolhidos, setEscolhidos] = useState<ReadonlyArray<{ readonly id: string; readonly nome: string }>>([]);
  const [caret, setCaret] = useState(0);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [sugestoesFechadas, setSugestoesFechadas] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const mencoes = escolhidos.filter((m) => texto.includes(`@${m.nome}`)).map((m) => m.id);
  const controlador = useCompositorDeTimeline(task, texto, mencoes, () => {
    setTexto("");
    setEscolhidos([]);
    setCaret(0);
  });
  const id = useId();

  const arroba = arrobaEmCurso(texto, caret);
  const sugestoes =
    arroba && !sugestoesFechadas
      ? members
          .filter((m) => m.state === "ativo")
          .filter((m) => normalizarBusca(m.displayName).includes(normalizarBusca(arroba.consulta)))
          .slice(0, 6)
      : [];

  const mencionar = (membro: { readonly id: string; readonly displayName: string }) => {
    if (!arroba) return;
    const antes = texto.slice(0, arroba.inicio);
    const depois = texto.slice(caret);
    const novoCaret = antes.length + membro.displayName.length + 2;
    setTexto(`${antes}@${membro.displayName} ${depois}`);
    setEscolhidos((atual) => (atual.some((m) => m.id === membro.id) ? atual : [...atual, { id: membro.id, nome: membro.displayName }]));
    setCaret(novoCaret);
    setSugestaoAtiva(0);
    // O cursor volta para depois do nome, e o foco continua no campo.
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(novoCaret, novoCaret);
    });
  };

  const rotuloDoEnvio = controlador.enviando ? "Enviando…" : "Comentar";

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        controlador.enviar();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Novo comentário
      </label>
      <div className="relative">
        <textarea
          ref={campo}
          id={id}
          value={texto}
          onChange={(event) => {
            setTexto(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setSugestaoAtiva(0);
            setSugestoesFechadas(false);
          }}
          onSelect={(event) => setCaret((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(event) => {
            // Com o menu de "@" aberto, as setas e o Enter escolhem; Esc fecha só o menu.
            if (sugestoes.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSugestaoAtiva((i) => (i + 1) % sugestoes.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSugestaoAtiva((i) => (i - 1 + sugestoes.length) % sugestoes.length);
                return;
              }
              if ((event.key === "Enter" && !event.ctrlKey && !event.metaKey) || event.key === "Tab") {
                event.preventDefault();
                const escolhido = sugestoes[sugestaoAtiva];
                if (escolhido) mencionar(escolhido);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setSugestoesFechadas(true);
                return;
              }
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              controlador.enviar();
            }
            // Enter sozinho: comportamento padrão do textarea — nova linha.
          }}
          rows={2}
          disabled={controlador.enviando}
          aria-autocomplete="list"
          aria-controls={sugestoes.length > 0 ? `${id}-sugestoes` : undefined}
          placeholder="Escreva um comentário. @ menciona alguém. Ctrl+Enter envia."
          className="campo block"
          // O canto inferior direito é do botão de enviar: o texto não passa por baixo dele.
          style={{ height: "auto", paddingBlock: "var(--e-2)", paddingRight: "var(--controle-h)", resize: "none" }}
        />
        <button
          type="submit"
          aria-label={rotuloDoEnvio}
          title={texto.trim() === "" ? "Escreva o comentário antes de enviar." : `${rotuloDoEnvio} (Ctrl+Enter)`}
          disabled={texto.trim() === "" || controlador.enviando}
          className="btn-icone btn-icone-enviar absolute"
          style={{ right: "var(--e-1)", bottom: "var(--e-1)" }}
        >
          <Icone de={Send} tamanho="xs" />
        </button>
        {sugestoes.length > 0 ? (
          <ul
            id={`${id}-sugestoes`}
            role="listbox"
            aria-label="Pessoas para mencionar"
            className="flutuante surgir-rapido absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-hidden p-1"
          >
            {sugestoes.map((membro, index) => (
              <li key={membro.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === sugestaoAtiva}
                  data-highlighted={index === sugestaoAtiva ? "" : undefined}
                  onMouseEnter={() => setSugestaoAtiva(index)}
                  // pointerdown, não click: o click tiraria o foco do campo antes de escolher.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    mencionar(membro);
                  }}
                  className="item-menu w-full"
                >
                  <ActorAvatar kind="member" name={membro.displayName} />
                  <span className="min-w-0 flex-1 truncate">{membro.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {controlador.erro ? (
        <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
          {controlador.erro}
        </p>
      ) : null}
    </form>
  );
}

/* ───────────────────────────── Painel ─────────────────────────────────────── */

/** Uma sequência de Atividade maior que isto recolhe o miolo em "Mostrar mais". */
const ATIVIDADES_SEM_RECOLHER = 4;

export function Timeline({ task, fmt, readOnly }: { readonly task: Task; readonly fmt: Formatters; readonly readOnly: boolean }) {
  const state = useData((data) => data);
  const [janela, setJanela] = useState(TIMELINE_PAGE_SIZE);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDaAtividade>("tudo");
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());
  const timeZone = state.workspace.locale.timezone;

  const todas = useMemo(() => entradasDaTarefa(state, task), [state, task]);
  const roteamento = useMemo(() => comentariosDeRoteamento(state, task), [state, task]);

  const termo = normalizarBusca(busca.trim());
  const entradas = todas.filter((entrada) => {
    if (filtro === "comentarios" && entrada.tipo !== "comentario") return false;
    if (filtro === "atividade" && entrada.tipo !== "atividade") return false;
    if (termo === "") return true;
    const texto =
      entrada.tipo === "comentario"
        ? `${resolverNomeDoAtor(state, entrada.comment.author)} ${entrada.comment.content}`
        : `${resolverNomeDoAtor(state, entrada.record.actor)} ${entrada.record.action}`;
    return normalizarBusca(texto).includes(termo);
  });
  const temMais = entradas.length > janela;
  const visiveis = entradas.slice(Math.max(0, entradas.length - janela));

  // Sequências de Atividade: o ClickUp mostra a primeira e as duas últimas, e recolhe o miolo.
  const blocos: Array<{ readonly tipo: "comentario"; readonly entrada: EntradaDeComentario } | { readonly tipo: "atividades"; readonly itens: EntradaDeAtividade[] }> = [];
  for (const entrada of visiveis) {
    const ultimo = blocos.at(-1);
    if (entrada.tipo === "comentario") blocos.push({ tipo: "comentario", entrada });
    else if (ultimo && ultimo.tipo === "atividades") ultimo.itens.push(entrada);
    else blocos.push({ tipo: "atividades", itens: [entrada] });
  }

  const linhaDeAtividade = (entrada: EntradaDeAtividade) => (
    <LinhaDeAtividade key={`a-${entrada.record.id}`} state={state} record={entrada.record} timeZone={timeZone} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CabecalhoDaAtividade
        observadores={task.observerMemberIds?.length ?? 0}
        busca={busca}
        onBusca={setBusca}
        filtro={filtro}
        onFiltro={setFiltro}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
        {/* Encostado embaixo, como um chat: o espaço vazio fica em cima. */}
        <div className="flex min-h-full flex-col justify-end">
          {todas.length === 0 ? (
            <EmptyState compact title="Nenhum comentário ou atividade nesta Solicitação." />
          ) : entradas.length === 0 ? (
            <EmptyState compact title="Nada encontrado com esse filtro." />
          ) : (
            <>
              {temMais ? (
                <div className="flex justify-center pb-2">
                  <Button size="sm" variant="ghost" onClick={() => setJanela((atual) => atual + TIMELINE_PAGE_SIZE)}>
                    Carregar atividades anteriores
                  </Button>
                </div>
              ) : null}
              <ol className="grid">
                {blocos.map((bloco) => {
                  if (bloco.tipo === "comentario") {
                    const comment = bloco.entrada.comment;
                    return (
                      <LinhaDeComentario
                        key={`c-${comment.id}`}
                        state={state}
                        fmt={fmt}
                        comment={comment}
                        pai={comment.parentCommentId ? task.comments.find((c) => c.id === comment.parentCommentId) : undefined}
                        ehRoteamento={roteamento.has(comment.id)}
                        timeZone={timeZone}
                      />
                    );
                  }
                  const chave = bloco.itens[0]!.record.id;
                  const recolhe = termo === "" && !abertas.has(chave) && bloco.itens.length > ATIVIDADES_SEM_RECOLHER;
                  if (!recolhe) return <Fragment key={`b-${chave}`}>{bloco.itens.map(linhaDeAtividade)}</Fragment>;
                  const escondidas = bloco.itens.length - 3;
                  return (
                    <Fragment key={`b-${chave}`}>
                      {linhaDeAtividade(bloco.itens[0]!)}
                      <li>
                        <button
                          type="button"
                          onClick={() => setAbertas((atual) => new Set(atual).add(chave))}
                          className="app-sm flex items-center gap-3 py-1.5 hover:underline"
                          style={{ color: "var(--texto-3)" }}
                        >
                          <Icone de={ChevronRight} tamanho="xs" />
                          Mostrar mais <span className="app-numero">({escondidas})</span>
                        </button>
                      </li>
                      {bloco.itens.slice(-2).map(linhaDeAtividade)}
                    </Fragment>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </div>
      {readOnly ? null : (
        <div className="doca-do-robo shrink-0 px-4 py-3" data-robo="acima" style={{ borderTop: "1px solid var(--linha)" }}>
          <Compositor task={task} />
        </div>
      )}
    </div>
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
