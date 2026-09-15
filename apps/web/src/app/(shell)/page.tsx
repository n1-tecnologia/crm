"use client";

/**
 * T02 — Início.
 *
 * A tela de entrada não é um painel de gráficos: é O QUE É SEU HOJE. Cada bloco
 * é uma consulta filtrada sobre entidade que já existe; nada aqui é conceito
 * novo (PRD I.1).
 *
 * A composição segue o Início do CRM-COMPLETO: a saudação é o título da barra
 * de 44px, a pergunta ao Assistente vive na barra logo abaixo, os quatro
 * números vêm em seguida como peças, e o corpo é uma grade de painéis — cada um
 * uma pilha de peças soltas, com a régua de seção onde há grupo.
 *
 * "Meus Negócios" usa Proprietário, não Responsável: o Negócio não tem
 * Responsável (RN-NEG-02). A agenda do dia são Tarefas de Tipo Reunião com data
 * COM HORA — Evento de calendário é a decisão D8, futura (documento 06, 20.16).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  FileCheck,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { createChatSession, sendChatMessage } from "@n1/dominio/operations";
import {
  contactDisplayName,
  effectiveLifecycleOfTask,
  isOverdue,
  isTerminalCategory,
  statusCategory,
  statusDefinition,
} from "@n1/dominio/derive";
import { APPROVAL_REASON_LABEL, EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CabecalhoDePainel,
  ConditionMarker,
  CorpoDeTela,
  EmptyState,
  Icone,
  Painel,
  Pilula,
  ReguaDeSecao,
  Toast,
} from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";

/** §15 — um corte que esconde linhas sempre diz o corte e oferece o resto. */
const HOME_PAGE_SIZE = 4;

export default function InicioPage() {
  const { memberId } = useSession();
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const router = useRouter();
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
      router.push(`/ia/chat/${resultado.value.id}`);
    } else {
      setErro(resultado.error);
    }
  };

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
          aoFalar={() => router.push("/ia/chat")}
        />

        {erro ? (
          <div className="mt-3">
            <Toast tone="error" onDismiss={() => setErro(null)}>
              {erro}
            </Toast>
          </div>
        ) : null}

        {/* ------------------------------------------------------- números
            Cada número é botão, não enfeite: diz quanto e leva até quais. */}
        <div className="grade-solta mt-3 grid-cols-2 xl:grid-cols-4">
          <Numero
            href="/estrutura/tarefas"
            icone={CheckSquare}
            rotulo="Tarefas abertas"
            valor={abertas.length}
            detalhe={vencidas.length > 0 ? `${vencidas.length} vencida(s)` : undefined}
            alarme={vencidas.length > 0}
          />
          <Numero href="/ia/aprovacoes" icone={FileCheck} rotulo="Aprovações pendentes" valor={aprovacoes.length} />
          <Numero href="/crm/caixa-de-entrada" icone={MessageSquare} rotulo="Minhas Conversas" valor={conversas.length} />
          <Numero href="/crm/negocios" icone={TrendingUp} rotulo="Meus Negócios abertos" valor={negocios.length} />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-3 xl:items-start">
          {/* -------------------------------------------------- minhas tarefas */}
          <Bloco titulo="Minhas Tarefas" contagem={semHora.length} href="/estrutura/tarefas">
            {semHora.length === 0 ? (
              <EmptyState compact title="Nada atribuído a você." hint="Uma Tarefa aparece aqui quando alguém a atribui a você." />
            ) : (
              <>
                <Grupo label="Vencidas" cor="var(--erro)" tasks={vencidas} state={state} vencida />
                <Grupo label="Esta semana" cor="var(--acento)" tasks={semana} state={state} />
                <Grupo label="Depois" tasks={depois} state={state} />
                {concluidas.length > 0 ? <Grupo label="Concluídas" tasks={concluidas.slice(0, 2)} state={state} concluida /> : null}
              </>
            )}
          </Bloco>

          {/* -------------------------------------------------- agenda de hoje */}
          <Bloco titulo="Agenda de hoje" contagem={agenda.length} href="/estrutura/tarefas">
            {agenda.length === 0 ? (
              <EmptyState
                compact
                title="Nenhum horário marcado."
                hint="Uma reunião é uma Tarefa de Tipo Reunião com data e hora — Evento de calendário é decisão futura da ontologia (D8)."
              />
            ) : (
              <div className="pilha-solta">
                {agenda.slice(0, HOME_PAGE_SIZE).map((task) => {
                  const lista = state.lists.find((l) => l.id === task.listId);
                  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
                  return (
                    <Link key={task.id} href={`/estrutura/tarefas/${task.id}`} className="item-solto" data-alinhamento="topo" style={{ paddingBlock: "var(--e-2)" }}>
                      <span className="w-14 shrink-0 text-right">
                        <span className="app-md app-numero block" style={{ color: "var(--texto)" }}>
                          {fmt.taskDate(task.dueDate!).split(" ").at(-1)}
                        </span>
                        {task.estimate ? <span className="app-meta app-numero block">{task.estimate} min</span> : null}
                      </span>
                      <span className="w-px self-stretch shrink-0" style={{ background: "var(--acento)" }} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                          {task.title}
                        </span>
                        <span className="app-meta block truncate">
                          {tipo?.name} · {lista?.name}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {agenda.length > HOME_PAGE_SIZE ? <Corte mostradas={HOME_PAGE_SIZE} total={agenda.length} /> : null}
              </div>
            )}
          </Bloco>

          {/* A coluna inteira rola junto com a página: três cartões rolando cada
              um por si dariam três barras concorrendo no mesmo palmo de tela. */}
          <div className="grid content-start gap-3">
            <Bloco titulo="Aprovações pendentes" contagem={aprovacoes.length} href="/ia/aprovacoes">
              {aprovacoes.length === 0 ? (
                <EmptyState compact title="Nenhuma Solicitação esperando por você." />
              ) : (
                <div className="pilha-solta">
                  {aprovacoes.slice(0, 2).map((approval) => (
                    <Link key={approval.id} href={`/ia/aprovacoes?aprovar=${approval.id}:aprovada`} className="item-solto" data-bloco="true">
                      <p className="app-md" style={{ color: "var(--texto)" }}>
                        {state.tools.find((t) => t.id === approval.object.toolId)?.name ?? approval.object.toolId}
                      </p>
                      <p className="app-base mt-1 line-clamp-2" style={{ color: "var(--texto-2)" }}>
                        {approval.object.input}
                      </p>
                      <p className="app-meta mt-1">
                        motivo: {APPROVAL_REASON_LABEL[approval.reason] ?? approval.reason} · classe de efeito{" "}
                        {EFFECT_CLASS_LABEL[approval.object.effectClass] ?? approval.object.effectClass}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Bloco>

            <Bloco titulo="Conversas atribuídas a mim" contagem={conversas.length} href="/crm/caixa-de-entrada">
              {conversas.length === 0 ? (
                <EmptyState compact title="Nenhuma Conversa atribuída a você." />
              ) : (
                <div className="pilha-solta">
                  {conversas.slice(0, 2).map((conversation) => {
                    const contato = state.contacts.find((c) => c.id === conversation.contactId);
                    const ultima = conversation.messages.at(-1);
                    return (
                      <Link key={conversation.id} href={`/crm/caixa-de-entrada/${conversation.id}`} className="item-solto" data-bloco="true">
                        <p className="flex items-center justify-between gap-2">
                          <span className="app-md truncate" style={{ color: "var(--texto)" }}>
                            {contato ? contactDisplayName(contato) : conversation.title}
                          </span>
                          {ultima ? <span className="app-meta app-numero shrink-0">{fmt.instant(ultima.createdAt)}</span> : null}
                        </p>
                        <p className="app-base mt-1 line-clamp-2" style={{ color: "var(--texto-2)" }}>
                          {ultima?.content}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Bloco>

            <Bloco titulo="Meus Negócios abertos" contagem={negocios.length} href="/crm/negocios">
              {negocios.length === 0 ? (
                <EmptyState
                  compact
                  title="Você não é Proprietário de nenhum Negócio aberto."
                  hint="O Negócio não tem Responsável: quem responde por ele é o Proprietário."
                />
              ) : (
                <div className="pilha-solta">
                  {negocios.slice(0, 3).map((deal) => (
                    <Link key={deal.id} href={`/crm/negocios/${deal.id}`} className="item-solto">
                      <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                        {deal.title}
                      </span>
                      {deal.value ? (
                        <span className="app-md app-numero shrink-0" style={{ color: "var(--texto)" }}>
                          {fmt.money(deal.value)}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </Bloco>
          </div>
        </div>

        {/* -------------------------------------------------- ações rápidas */}
        <section className="mt-2">
          <ReguaDeSecao rotulo="Ações rápidas" />
          <div className="grade-solta grid-cols-2 xl:grid-cols-4">
            <AcaoRapida href="/estrutura" icone={Plus}>
              Criar na Estrutura
            </AcaoRapida>
            <AcaoRapida href="/ia/chat" icone={Sparkles}>
              Nova Sessão de Chat
            </AcaoRapida>
            <AcaoRapida href="/crm/contatos" icone={MessageSquare}>
              Importar Contatos
            </AcaoRapida>
            <AcaoRapida href="/paineis" icone={CalendarDays}>
              Ver Painéis
            </AcaoRapida>
          </div>
        </section>
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

/** Os quatro pilares do manifesto da marca — no manual, quatro círculos que se
 *  entrelaçam. Aqui viram a régua da base da capa, na mesma ordem. */
const PILARES = ["Propósito", "Criatividade", "Tecnologia", "Transformação"];

/**
 * A CAPA — a primeira coisa que a pessoa vê no produto.
 *
 * O laço de vídeo é o motivo da capa do manual (riscos de neon roxo) e a orbe é
 * o Assistente. Nada aqui é enfeite sem função: o título dá o contexto, o campo
 * abre uma Sessão de Chat, os atalhos levam às quatro telas mais usadas e a
 * orbe é o mesmo caminho do Assistente para quem prefere um alvo grande.
 *
 * ONDE O TEXTO PODE FICAR — não é gosto, é medida. Amostrando 12 quadros do
 * laço: a luminância máxima é 1.00 (branco puro) no terço da esquerda e no da
 * direita, e 0.0096 no meio. Com a cor do cartão por cortina, texto branco só
 * atinge AA a partir de 82% de opacidade. Por isso o texto vive na coluna
 * fechada à esquerda e na régua OPACA da base, e a janela do vídeo abre onde só
 * há decoração: em volta da orbe.
 */
function Capa({
  saudacao: comoVai,
  nome,
  pergunta,
  aoEscrever,
  aoPerguntar,
  aoFalar,
}: {
  readonly saudacao: string;
  readonly nome: string;
  readonly pergunta: string;
  readonly aoEscrever: (valor: string) => void;
  readonly aoPerguntar: () => void;
  readonly aoFalar: () => void;
}) {
  return (
    <section className="capa revelar flex flex-col" style={{ minHeight: "var(--capa-h)" }}>
      {/*
        O laço. `muted` e `playsInline` porque autoplay com som é bloqueado e,
        num painel de trabalho, seria hostil de qualquer forma. O `poster` cobre
        o intervalo até o vídeo carregar — sem ele a capa pisca vazia na
        primeira visita. Some por completo em `prefers-reduced-motion` e abaixo
        de 768px (ver componentes.css).
      */}
      <video
        className="capa-video"
        src="/marca/fundo-heroi.mp4"
        poster="/marca/fundo-heroi.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />
      <span className="capa-cortina" aria-hidden="true" />

      <div className="flex min-h-0 flex-1 items-center gap-6 p-6 xl:p-8">
        <div className="min-w-0 flex-1" style={{ maxWidth: "38rem" }}>
          <p className="ed-secao">Seu copiloto de gestão</p>
          <h1 className="ed-display mt-2">
            {comoVai}, <span style={{ color: "var(--acento)" }}>{nome}</span>.
          </h1>
          <p className="ed-corpo mt-1">O que é seu hoje, a gente resolve junto.</p>

          {/* A pergunta abre uma Sessão de Chat com ela dentro. É o controle
              principal da tela — daí o aro no acento e a altura maior. */}
          <div
            className="mt-5 flex items-center gap-2 rounded-[var(--r-controle)] px-3"
            style={{
              height: "var(--controle-h-lg)",
              background: "var(--page)",
              border: "1px solid var(--linha-acento)",
            }}
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
          A orbe é o Assistente. Ela abre uma Sessão de Chat — não capta voz, e
          um alvo deste tamanho com cara de microfone prometeria o que o produto
          não faz. Some abaixo de 1024px: ali a coluna de texto ocupa a capa
          inteira e a orbe viraria enfeite espremido.
        */}
        <button
          type="button"
          onClick={aoFalar}
          className="orbe-assistente hidden shrink-0 lg:grid"
          aria-label="Falar com o Assistente"
          title="Abre uma Sessão de Chat com o Assistente."
        >
          <span className="orbe-anel" style={{ width: "100%", height: "100%" }} aria-hidden="true" />
          <span className="orbe-anel" style={{ width: "78%", height: "78%" }} aria-hidden="true" />
          <span className="orbe-anel" style={{ width: "56%", height: "56%" }} aria-hidden="true" />
          <span className="orbe-varredura" style={{ width: "92%", height: "92%" }} aria-hidden="true" />
          <span className="orbe-nucleo" style={{ width: "42%", height: "42%" }}>
            <Icone de={Sparkles} tamanho="md" style={{ color: "var(--sobre-degrade)" }} />
          </span>
        </button>
      </div>

      {/*
        A régua da base: OPACA de propósito. É o único lugar da capa onde texto
        pode encostar no terço direito do vídeo, e resolver isso com uma barra
        sólida é mais honesto que confiar num degradê para segurar o contraste.
      */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 xl:px-8"
        style={{ background: "var(--card)", borderTop: "1px solid var(--linha)" }}
      >
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {PILARES.map((pilar) => (
            <li key={pilar} className="ed-secao flex items-center gap-2">
              <span aria-hidden="true" className="pilula-ponto" style={{ background: "var(--acento)" }} />
              {pilar}
            </li>
          ))}
        </ul>
        <span className="flex-1" />
        <p className="app-meta">Mais produtividade para o que realmente importa. Juntos, vamos mais longe.</p>
      </div>
    </section>
  );
}

function Atalho({ href, icone, children }: { readonly href: string; readonly icone: typeof Sparkles; readonly children: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-sutil btn-sm">
      <Icone de={icone} tamanho="xs" />
      {children}
    </Link>
  );
}

/**
 * O número do resumo é uma PEÇA que leva à tela: o rótulo em caixa-alta, o
 * valor grande em tabular e, quando há alarme, o detalhe na cor do erro.
 */
function Numero({
  href,
  icone,
  rotulo,
  valor,
  detalhe,
  alarme,
}: {
  readonly href: string;
  readonly icone: typeof Sparkles;
  readonly rotulo: string;
  readonly valor: number;
  readonly detalhe?: string;
  readonly alarme?: boolean;
}) {
  return (
    <Link href={href} className="item-solto" data-bloco="true" data-atenuado={valor === 0 ? "true" : undefined}>
      <span className="flex items-center justify-between gap-2">
        <span className="app-coluna">{rotulo}</span>
        <Icone de={icone} tamanho="xs" style={{ color: "var(--texto-4)" }} />
      </span>
      <span className="mt-1 flex items-baseline gap-2">
        <span className="ed-titulo app-numero" style={{ color: valor === 0 ? "var(--texto-4)" : "var(--texto)" }}>
          {valor}
        </span>
        {detalhe ? (
          <span className="app-meta" style={{ color: alarme ? "var(--erro)" : "var(--texto-4)" }}>
            {detalhe}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function Bloco({
  titulo,
  contagem,
  href,
  children,
}: {
  readonly titulo: string;
  readonly contagem: number;
  readonly href: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Painel className="flex min-w-0 flex-col">
      <CabecalhoDePainel
        titulo={titulo}
        contagem={contagem}
        acao={
          <Link href={href} className="app-sm flex shrink-0 items-center gap-1 transition-colors hover:text-[var(--acento)]" style={{ color: "var(--texto-3)" }}>
            Ver todas
            <Icone de={ArrowRight} tamanho="xs" />
          </Link>
        }
      />
      <div className="p-3">{children}</div>
    </Painel>
  );
}

function Grupo({
  label,
  cor,
  tasks,
  state,
  vencida,
  concluida,
}: {
  readonly label: string;
  readonly cor?: string;
  readonly tasks: readonly Task[];
  readonly state: DataState;
  readonly vencida?: boolean;
  readonly concluida?: boolean;
}) {
  const fmt = useFormat();
  if (tasks.length === 0) return null;
  const mostradas = tasks.slice(0, HOME_PAGE_SIZE);

  return (
    <section>
      <ReguaDeSecao rotulo={label} contagem={tasks.length} cor={cor} />
      <div className="pilha-solta">
        {mostradas.map((task) => {
          const definition = statusDefinition(state, task.listId, task.statusId);
          const lista = state.lists.find((l) => l.id === task.listId);
          return (
            <Link key={task.id} href={`/estrutura/tarefas/${task.id}`} className="item-solto" data-atenuado={concluida ? "true" : undefined}>
              <span
                className="shrink-0 rounded-full"
                style={{
                  width: "0.75rem",
                  height: "0.75rem",
                  border: `2px solid ${definition?.color ?? "var(--texto-4)"}`,
                  background: concluida ? (definition?.color ?? "var(--texto-4)") : "transparent",
                }}
                title={definition?.name}
              />
              <span className="min-w-0 flex-1">
                <span
                  className="app-base block truncate"
                  style={{ color: concluida ? "var(--texto-4)" : "var(--texto-1)", textDecoration: concluida ? "line-through" : undefined }}
                >
                  {task.title}
                </span>
                <span className="app-meta flex flex-wrap items-center gap-2">
                  {task.readableId ? <span className="identificador">{task.readableId}</span> : null}
                  {lista ? <span className="truncate">{lista.name}</span> : null}
                  {task.dueDate ? (
                    <span className="app-numero" style={{ color: vencida ? "var(--erro)" : undefined }}>
                      {fmt.taskDate(task.dueDate)}
                    </span>
                  ) : null}
                  {vencida ? <ConditionMarker tone="danger">Vencida</ConditionMarker> : null}
                </span>
              </span>
              {definition ? (
                <Pilula cor={definition.color} comPonto className="hidden shrink-0 sm:inline-flex">
                  {definition.name}
                </Pilula>
              ) : null}
            </Link>
          );
        })}
        {tasks.length > mostradas.length ? <Corte mostradas={mostradas.length} total={tasks.length} /> : null}
      </div>
    </section>
  );
}

/** §15 — o corte é dito, nunca escondido. */
function Corte({ mostradas, total }: { readonly mostradas: number; readonly total: number }) {
  return (
    <p className="app-meta app-numero px-1 pt-1">
      Mostrando {mostradas} de {total}.
    </p>
  );
}

function AcaoRapida({ href, icone, children }: { readonly href: string; readonly icone: typeof Sparkles; readonly children: React.ReactNode }) {
  return (
    <Link href={href} className="contents">
      <Button variant="secondary" full icon={<Icone de={icone} tamanho="xs" />}>
        {children}
      </Button>
    </Link>
  );
}
