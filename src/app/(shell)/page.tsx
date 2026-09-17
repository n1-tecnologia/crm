"use client";

/**
 * T02 — Início.
 *
 * A tela de entrada não é um painel de gráficos: é O QUE É SEU HOJE. Cada bloco
 * é uma consulta filtrada sobre entidade que já existe; nada aqui é conceito
 * novo (PRD I.1).
 *
 * A composição: a CAPA (a atmosfera, a saudação, a pergunta ao Assistente, o
 * globo de pontos que reage ao cursor), e abaixo UMA LISTA
 * do dia em ordem de urgência —
 * Agora, Hoje, Esta semana, Depois — com Conversas, Negócios e as Ações
 * rápidas ao lado. Nenhuma caixa dentro de caixa: cada item é uma linha com o
 * ícone do seu tipo, o título, o que importa dele e para onde leva.
 *
 * "Meus Negócios" usa Proprietário, não Responsável: o Negócio não tem
 * Responsável (RN-NEG-02). A agenda do dia são Tarefas de Tipo Reunião com data
 * COM HORA — Evento de calendário é a decisão D8, futura (documento 06, 20.16).
 */

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CheckSquare,
  FileCheck,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import { createChatSession, sendChatMessage } from "@/data/operations";
import {
  contactDisplayName,
  effectiveLifecycleOfTask,
  isOverdue,
  isTerminalCategory,
  statusCategory,
  statusDefinition,
} from "@/data/derive";
import { APPROVAL_REASON_LABEL, EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { useNavegar } from "@/features/shell/navegacao";
import { Selo, SeloDaTarefa } from "@/features/estrutura/icone-de-tipo";
import {
  CorpoDeTela,
  GloboDePontos,
  Icone,
  Pilula,
  ReguaDeSecao,
  Toast,
} from "@/features/shell/ui";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";

/** §15 — um corte que esconde linhas sempre diz o corte e oferece o resto. */
const HOME_PAGE_SIZE = 5;

export default function InicioPage() {
  const { memberId } = useSession();
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  // `pendente` é a espera entre o push e a chegada da rota: o globo "pensa" nela.
  const [navegar, pendente] = useNavegar();
  const [pergunta, setPergunta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const member = state.members.find((m) => m.id === memberId);
  const primeiroNome = member?.displayName.split(" ")[0] ?? "";

  const minhas = state.tasks
    .filter((task) => task.assignees.some((a) => a.kind === "member" && a.id === memberId))
    .filter((task) => effectiveLifecycleOfTask(state, task.id) === "ativo");

  const abertas = minhas.filter((task) => !isTerminalCategory(statusCategory(state, task)));

  // A agenda: Tarefa com HORA marcada, ordenada pelo relógio.
  const agenda = abertas
    .filter((task) => task.dueDate?.form === "instant")
    .sort((a, b) => String(a.dueDate?.value).localeCompare(String(b.dueDate?.value)));

  // O que tem hora vive na agenda; a lista fica com o resto, para a mesma
  // Tarefa não aparecer duas vezes na mesma tela.
  const semHora = abertas.filter((task) => task.dueDate?.form !== "instant");
  const vencidas = semHora.filter((task) => isOverdue(state, task, now));
  const semana = semHora.filter((task) => !vencidas.includes(task) && dueWithinDays(task, now, 7));
  const depois = semHora.filter((task) => !vencidas.includes(task) && !semana.includes(task));
  const concluidas = minhas.filter((task) => statusCategory(state, task) === "concluido");

  const conversas = state.conversations.filter(
    (c) => c.lifecycle === "ativo" && c.assignee?.kind === "member" && c.assignee.id === memberId,
  );
  const negocios = state.deals.filter(
    (d) => d.ownerMemberId === memberId && d.situation === "aberto" && d.lifecycle === "ativo",
  );
  const aprovacoes = state.approvals.filter((a) => a.decision === undefined && a.approverMemberId === memberId);

  /**
   * A pergunta abre uma Sessão de Chat com ela dentro — é a entidade que a
   * ontologia dá para conversar com um Agente (B83). Não há Modelo executando
   * aqui: a resposta nasce de uma Execução, e o protótipo não executa nenhuma.
   */
  const perguntar = () => {
    if (!pergunta.trim()) return;
    const resultado = run((data, actingId) => {
      const sessao = createChatSession(data, actingId, { title: pergunta.trim().slice(0, 60) });
      if (!sessao.ok) return sessao;
      sendChatMessage(data, actingId, sessao.value.id, pergunta);
      return sessao;
    });
    if (resultado.ok) {
      setErro(null);
      setPergunta("");
      navegar(`/ia/chat/${resultado.value.id}`);
    } else {
      setErro(resultado.error);
    }
  };

  // "Agora" é o que não pode esperar: o vencido e o que espera a sua decisão.
  const agora = vencidas.length + aprovacoes.length;

  return (
    <div className="flex h-full flex-col">
      {/*
        O Início é a ÚNICA tela sem a barra de 44px: aqui a capa é o cabeçalho.
        Era assim na concepção original do produto, e é o que faz a entrada
        parecer uma entrada, e não a quinquagésima lista do sistema.
      */}
      <CorpoDeTela>
        <Capa
          saudacao={saudacao(now, state.workspace.locale.timezone)}
          nome={primeiroNome}
          pergunta={pergunta}
          aoEscrever={setPergunta}
          aoPerguntar={perguntar}
          aoFalar={() => navegar("/ia/chat")}
          pendente={pendente}
        />

        {erro ? (
          <div className="mt-3">
            <Toast tone="error" onDismiss={() => setErro(null)}>
              {erro}
            </Toast>
          </div>
        ) : null}


        {/* As seis listas em cascata só começam depois da capa assentar: a
            capa é a porta, as seções chegam pela porta. */}
        <div
          className="mt-6 grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start"
          style={{ "--cascata-inicio": "var(--dur-2)" } as CSSProperties}
        >
          {/* ---------------------------------------------------- o seu dia
              Uma lista só, em ordem de urgência. Cada linha diz o tipo pelo
              ícone, o que é, o que importa e para onde leva. */}
          <div className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0">
              <ReguaDeSecao rotulo="Agora" contagem={agora} cor={agora > 0 ? "var(--erro)" : undefined} />
              {agora === 0 ? (
                <p className="app-meta px-1">Nada vencido e nada esperando a sua decisão.</p>
              ) : (
                <ul className="cascata pilha-solta">
                  {vencidas.slice(0, HOME_PAGE_SIZE).map((task) => (
                    <LinhaDeTarefa key={task.id} task={task} state={state} tom="erro" nota="Vencida" />
                  ))}
                  {aprovacoes.slice(0, 3).map((approval) => (
                    <li key={approval.id}>
                      <Link href={`/ia/aprovacoes?aprovar=${approval.id}:aprovada`} className="item-solto" data-alinhamento="topo" style={{ paddingBlock: "var(--e-2)" }}>
                        <Selo icone={FileCheck} cor="var(--aviso)" lavado="var(--aviso-lavado)" />
                        <span className="min-w-0 flex-1">
                          <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                            Aprovar: {state.tools.find((t) => t.id === approval.object.toolId)?.name ?? approval.object.toolId}
                          </span>
                          <span className="app-base mt-0.5 line-clamp-1" style={{ color: "var(--texto-2)" }}>
                            {approval.object.input}
                          </span>
                          <span className="app-meta block truncate">
                            {APPROVAL_REASON_LABEL[approval.reason] ?? approval.reason} · efeito{" "}
                            {EFFECT_CLASS_LABEL[approval.object.effectClass] ?? approval.object.effectClass}
                          </span>
                        </span>
                        <Pilula tom="aviso" className="shrink-0">
                          decidir
                        </Pilula>
                      </Link>
                    </li>
                  ))}
                  {vencidas.length > HOME_PAGE_SIZE || aprovacoes.length > 3 ? (
                    <Corte mostradas={Math.min(vencidas.length, HOME_PAGE_SIZE) + Math.min(aprovacoes.length, 3)} total={agora} href="/estrutura/tarefas" />
                  ) : null}
                </ul>
              )}
            </section>

            <section>
              <ReguaDeSecao rotulo="Hoje" contagem={agenda.length} cor={agenda.length > 0 ? "var(--info)" : undefined} />
              {agenda.length === 0 ? (
                <p className="app-meta px-1">
                  Nenhum horário marcado. Uma reunião é uma Tarefa de Tipo Reunião com data e hora.
                </p>
              ) : (
                <ul className="cascata pilha-solta">
                  {agenda.slice(0, HOME_PAGE_SIZE).map((task) => {
                    const lista = state.lists.find((l) => l.id === task.listId);
                    const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
                    return (
                      <li key={task.id}>
                        <Link href={`/estrutura/tarefas/${task.id}`} className="item-solto" style={{ paddingBlock: "var(--e-2)" }}>
                          <span className="w-14 shrink-0 text-right">
                            <span className="app-md app-numero block" style={{ color: "var(--texto)" }}>
                              {fmt.taskDate(task.dueDate!).split(" ").at(-1)}
                            </span>
                            {task.estimate ? <span className="app-meta app-numero block">{task.estimate} min</span> : null}
                          </span>
                          <span className="w-px self-stretch shrink-0" style={{ background: "var(--info)" }} aria-hidden="true" />
                          <SeloDaTarefa state={state} task={task} />
                          <span className="min-w-0 flex-1">
                            <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                              {task.title}
                            </span>
                            <span className="app-meta block truncate">
                              {tipo?.name} · {lista?.name}
                            </span>
                          </span>
                          <Icone de={ArrowRight} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                        </Link>
                      </li>
                    );
                  })}
                  {agenda.length > HOME_PAGE_SIZE ? <Corte mostradas={HOME_PAGE_SIZE} total={agenda.length} href="/estrutura/tarefas" /> : null}
                </ul>
              )}
            </section>

            <section>
              <ReguaDeSecao rotulo="Esta semana" contagem={semana.length} />
              {semana.length === 0 ? (
                <p className="app-meta px-1">Nada vence nos próximos 7 dias.</p>
              ) : (
                <ul className="cascata pilha-solta">
                  {semana.slice(0, HOME_PAGE_SIZE).map((task) => (
                    <LinhaDeTarefa key={task.id} task={task} state={state} tom="acento" />
                  ))}
                  {semana.length > HOME_PAGE_SIZE ? <Corte mostradas={HOME_PAGE_SIZE} total={semana.length} href="/estrutura/tarefas" /> : null}
                </ul>
              )}
            </section>

            {depois.length > 0 || concluidas.length > 0 ? (
              <section>
                <ReguaDeSecao rotulo="Depois" contagem={depois.length} />
                <ul className="cascata pilha-solta">
                  {depois.slice(0, HOME_PAGE_SIZE).map((task) => (
                    <LinhaDeTarefa key={task.id} task={task} state={state} tom="neutro" />
                  ))}
                  {depois.length > HOME_PAGE_SIZE ? <Corte mostradas={HOME_PAGE_SIZE} total={depois.length} href="/estrutura/tarefas" /> : null}
                  {concluidas.slice(0, 2).map((task) => (
                    <LinhaDeTarefa key={task.id} task={task} state={state} tom="neutro" concluida />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ------------------------------------------------------ ao lado */}
          <div className="flex min-w-0 flex-col gap-6">
            <section>
              <ReguaDeSecao
                rotulo="Conversas"
                contagem={conversas.length}
                acao={
                  <Link href="/crm/caixa-de-entrada" className="app-sm flex items-center gap-1" style={{ color: "var(--texto-3)" }}>
                    Caixa de Entrada
                    <Icone de={ArrowRight} tamanho="xs" />
                  </Link>
                }
              />
              {conversas.length === 0 ? (
                <p className="app-meta px-1">Nenhuma Conversa atribuída a você.</p>
              ) : (
                <ul className="cascata pilha-solta">
                  {conversas.slice(0, 3).map((conversation) => {
                    const contato = state.contacts.find((c) => c.id === conversation.contactId);
                    const ultima = conversation.messages.at(-1);
                    return (
                      <li key={conversation.id}>
                        <Link href={`/crm/caixa-de-entrada/${conversation.id}`} className="item-solto" data-alinhamento="topo" style={{ paddingBlock: "var(--e-2)" }}>
                          <Selo icone={MessageSquare} cor="var(--info)" lavado="var(--info-lavado)" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="app-md min-w-0 truncate" style={{ color: "var(--texto)" }}>
                                {contato ? contactDisplayName(contato) : conversation.title}
                              </span>
                              {ultima ? <span className="app-meta app-numero shrink-0">{fmt.relative(ultima.createdAt)}</span> : null}
                            </span>
                            <span className="app-base mt-0.5 line-clamp-2" style={{ color: "var(--texto-2)" }}>
                              {ultima?.content}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {conversas.length > 3 ? <Corte mostradas={3} total={conversas.length} href="/crm/caixa-de-entrada" /> : null}
                </ul>
              )}
            </section>

            <section>
              <ReguaDeSecao
                rotulo="Meus Negócios"
                contagem={negocios.length}
                acao={
                  <Link href="/crm/negocios" className="app-sm flex items-center gap-1" style={{ color: "var(--texto-3)" }}>
                    Funil
                    <Icone de={ArrowRight} tamanho="xs" />
                  </Link>
                }
              />
              {negocios.length === 0 ? (
                <p className="app-meta px-1">Você não é Proprietário de nenhum Negócio aberto.</p>
              ) : (
                <ul className="cascata pilha-solta">
                  {negocios.slice(0, 4).map((deal) => (
                    <li key={deal.id}>
                      <Link href={`/crm/negocios/${deal.id}`} className="item-solto">
                        <Selo icone={TrendingUp} cor="var(--sucesso)" lavado="var(--sucesso-lavado)" />
                        <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {deal.title}
                        </span>
                        {deal.value ? (
                          <span className="app-md app-numero shrink-0" style={{ color: "var(--texto)" }}>
                            {fmt.money(deal.value)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                  {negocios.length > 4 ? <Corte mostradas={4} total={negocios.length} href="/crm/negocios" /> : null}
                </ul>
              )}
            </section>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}

/**
 * A hora é lida no fuso da Localidade do Espaço de Trabalho, não no relógio de
 * quem renderiza: `getHours()` responde diferente no servidor e no navegador, e
 * a diferença aparece como erro de hidratação.
 */
function saudacao(now: Date, timezone: string): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: timezone }).format(now));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function dueWithinDays(task: Task, now: Date, days: number): boolean {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate.value);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  limit.setHours(23, 59, 59, 999);
  return due <= limit;
}

/** Seis estrelas fixas da atmosfera: posição em %, tamanho e cor por token. */
const ESTRELAS = [
  { top: "14%", left: "58%", tam: "3px", cor: "var(--estrela-forte)" },
  { top: "26%", left: "84%", tam: "2px", cor: "var(--estrela-media)" },
  { top: "62%", left: "66%", tam: "2px", cor: "var(--estrela-acento)" },
  { top: "78%", left: "90%", tam: "3px", cor: "var(--estrela-fraca)" },
  { top: "40%", left: "95%", tam: "2px", cor: "var(--estrela-info)" },
  { top: "8%", left: "72%", tam: "2px", cor: "var(--estrela-fraca)" },
];

/**
 * A CAPA — a primeira coisa que a pessoa vê no produto.
 *
 * O fundo é a atmosfera do sistema (orbes desfocados, grade de pontos e
 * estrelas) e o globo de pontos é o Assistente: gira, inclina para o cursor,
 * acende perto dele — e abre uma Sessão de Chat no clique. Nada aqui é enfeite
 * sem função: o título dá o contexto, o campo abre uma Sessão de Chat, os
 * atalhos levam às quatro telas mais usadas. A barra de Ações rápidas que
 * fechava a base saiu a pedido — a capa termina na atmosfera.
 *
 * Já foi um laço de vídeo com riscos de neon; saiu porque os riscos chegavam a
 * branco puro e exigiam uma cortina pesada para o texto ler. A atmosfera nunca
 * passa de roxo a 28% sobre o cartão — o texto lê em qualquer ponto.
 */
function Capa({
  saudacao: comoVai,
  nome,
  pergunta,
  aoEscrever,
  aoPerguntar,
  aoFalar,
  pendente,
}: {
  readonly saudacao: string;
  readonly nome: string;
  readonly pergunta: string;
  readonly aoEscrever: (valor: string) => void;
  readonly aoPerguntar: () => void;
  readonly aoFalar: () => void;
  /** Uma navegação a caminho: o globo pensa e o envio diz que está ocupado. */
  readonly pendente: boolean;
}) {
  return (
    <section className="capa revelar flex flex-col" style={{ minHeight: "var(--capa-h)" }}>
      {/*
        A atmosfera: três orbes desfocados, a grade de pontos (no ::after da
        capa) e seis estrelas. Tudo CSS, nada de vídeo — e nada aqui passa de
        roxo a 28% sobre o cartão, então o texto lê em qualquer ponto.
      */}
      <span className="capa-orbe" aria-hidden="true" style={{ top: "-30%", right: "-6%", width: "34rem", height: "34rem", background: "var(--orbe-1)" }} />
      <span className="capa-orbe" aria-hidden="true" style={{ top: "20%", right: "26%", width: "26rem", height: "26rem", background: "var(--orbe-2)" }} />
      <span className="capa-orbe" aria-hidden="true" style={{ bottom: "-40%", left: "30%", width: "30rem", height: "30rem", background: "var(--orbe-3)" }} />
      {ESTRELAS.map((e, i) => (
        <span key={i} className="capa-estrela" aria-hidden="true" style={{ top: e.top, left: e.left, width: e.tam, height: e.tam, background: e.cor }} />
      ))}

      <div className="flex min-h-0 flex-1 items-center justify-between gap-6 p-6 xl:p-8">
        {/*
          O texto chega em degraus de dois passos (saudação, pergunta, atalhos)
          enquanto a capa ainda revela: `surgir` sem blur, porque a capa inteira
          já está sob o filter do `revelar` — dois desfoques somados borram
          demais. Os `--i` são inline para o degrau ser de DOIS passos.
        */}
        <div className="cascata min-w-0 flex-1" style={{ maxWidth: "38rem" }}>
          <h1 className="ed-display" style={{ "--i": 0 } as CSSProperties}>
            {comoVai}, <span style={{ color: "var(--acento)" }}>{nome}</span>.
          </h1>

          {/* A pergunta abre uma Sessão de Chat com ela dentro. É o controle
              principal da tela — daí o aro no acento e a altura maior. */}
          <div
            className="mt-5 flex items-center gap-2 rounded-[var(--r-controle)] px-3"
            style={{
              "--i": 2,
              height: "var(--controle-h-lg)",
              background: "var(--page)",
              border: "1px solid var(--linha-acento)",
            } as CSSProperties}
          >
            <Icone de={Sparkles} tamanho="sm" style={{ color: "var(--acento)" }} />
            <label className="sr-only" htmlFor="pergunta">
              Pergunte ao seu assistente
            </label>
            <input
              id="pergunta"
              value={pergunta}
              onChange={(event) => aoEscrever(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") aoPerguntar();
              }}
              placeholder="Pergunte ao seu assistente…"
              className="app-md min-w-0 flex-1 bg-transparent outline-none"
              style={{ color: "var(--texto)" }}
            />
            <button
              type="button"
              onClick={aoPerguntar}
              disabled={pergunta.trim() === ""}
              aria-busy={pendente || undefined}
              aria-label="Abrir uma Sessão de Chat com esta pergunta"
              title={pergunta.trim() === "" ? "Escreva a pergunta primeiro." : "Abre uma Sessão de Chat com esta pergunta."}
              className="btn-icone shrink-0 disabled:opacity-40"
              style={{
                width: "var(--controle-h-sm)",
                height: "var(--controle-h-sm)",
                border: "none",
                background: "var(--degrade-acento)",
                color: "var(--sobre-degrade)",
              }}
            >
              <Icone de={ArrowRight} tamanho="xs" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2" style={{ "--i": 4 } as CSSProperties}>
            <Atalho href="/ia/chat" icone={Sparkles}>
              Falar com o Assistente
            </Atalho>
            <Atalho href="/estrutura/tarefas" icone={CheckSquare}>
              Minhas Tarefas
            </Atalho>
            <Atalho href="/buscar" icone={Search}>
              Buscar
            </Atalho>
            <Atalho href="/paineis" icone={TrendingUp}>
              Painéis
            </Atalho>
          </div>
        </div>

        {/*
          O globo é o Assistente. Ele abre uma Sessão de Chat — não capta voz, e
          um alvo deste tamanho com cara de microfone prometeria o que o produto
          não faz. Some abaixo de 1024px: ali a coluna de texto ocupa a capa
          inteira e o globo viraria enfeite espremido.
        */}
        <button
          type="button"
          onClick={aoFalar}
          className="aparecer relative hidden shrink-0 lg:block xl:mr-6"
          // Esmaece no tempo da capa; o globo mesmo só nasce quando ela termina.
          style={{ width: "var(--globo-tam)", height: "var(--globo-tam)", animationDuration: "var(--dur-3)" }}
          aria-label="Falar com o Assistente"
          title="Abre uma Sessão de Chat com o Assistente."
        >
          <GloboDePontos className="absolute inset-0" ativo={pendente} />
        </button>
      </div>

    </section>
  );
}

function Atalho({ href, icone, children }: { readonly href: string; readonly icone: LucideIcon; readonly children: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-sutil btn-sm">
      <Icone de={icone} tamanho="xs" />
      {children}
    </Link>
  );
}

/** O ladrilho de ícone na cor do tipo: é ele que se reconhece antes de ler. */
/** Uma Tarefa como linha da lista do dia: ícone do tipo, título, meta, Status. */
function LinhaDeTarefa({
  task,
  state,
  tom,
  nota,
  concluida,
}: {
  readonly task: Task;
  readonly state: DataState;
  readonly tom: "erro" | "acento" | "neutro";
  readonly nota?: string;
  readonly concluida?: boolean;
}) {
  const fmt = useFormat();
  const definition = statusDefinition(state, task.listId, task.statusId);
  const lista = state.lists.find((l) => l.id === task.listId);
  return (
    <li>
      <Link href={`/estrutura/tarefas/${task.id}`} className="item-solto" data-atenuado={concluida ? "true" : undefined}>
        {/* O ícone é o do Tipo da Tarefa; vencida, ele fica vermelho. */}
        <SeloDaTarefa state={state} task={task} {...(tom === "erro" ? { tom: "erro" } : {})} />
        <span className="min-w-0 flex-1">
          <span
            className="app-md block truncate"
            style={{ color: concluida ? "var(--texto-4)" : "var(--texto)", textDecoration: concluida ? "line-through" : undefined }}
          >
            {task.title}
          </span>
          <span className="app-meta flex flex-wrap items-center gap-x-2">
            {task.readableId ? <span className="identificador">{task.readableId}</span> : null}
            {lista ? <span className="truncate">{lista.name}</span> : null}
            {task.dueDate ? (
              <span className="app-numero" style={{ color: tom === "erro" ? "var(--erro)" : undefined }}>
                {nota ? `${nota} · ` : ""}
                {fmt.taskDate(task.dueDate)}
              </span>
            ) : null}
          </span>
        </span>
        {definition ? (
          <Pilula cor={definition.color} className="hidden shrink-0 sm:inline-flex">
            {definition.name}
          </Pilula>
        ) : null}
        <Icone de={ArrowRight} tamanho="xs" style={{ color: "var(--texto-4)" }} />
      </Link>
    </li>
  );
}

/** §15 — o corte é dito, nunca escondido, e oferece o resto. */
function Corte({ mostradas, total, href }: { readonly mostradas: number; readonly total: number; readonly href: string }) {
  return (
    <li className="app-meta app-numero flex items-center justify-between px-1 pt-1">
      <span>
        Mostrando {mostradas} de {total}.
      </span>
      <Link href={href} className="flex items-center gap-1 hover:underline" style={{ color: "var(--texto-3)" }}>
        Ver todas
        <Icone de={ArrowRight} tamanho="xs" />
      </Link>
    </li>
  );
}

