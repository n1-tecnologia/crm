"use client";

/**
 * O RESUMO DO INÍCIO (2026-09-24: "conforme for rolando, a tela muda e vira
 * uma tela de informações e acesso rápido: minhas tarefas, tasks atuais se
 * tiver, quantas estão em atraso e afins, leads a serem atendidos, se há
 * novas mensagens e um menu de estatística daquele user na semana, mês e
 * afins"). Vem depois do palco e sobe por cima dele, que fica preso no topo
 * enquanto o robô sai (`saida-do-palco.ts`).
 *
 * Só LÊ e LEVA — não altera nada nem inventa conceito (PRD I.1). Cada número
 * vem de UMA derivação que outra tela também usa, para os números nunca
 * discordarem:
 *  - Tarefas abertas: `tarefasAbertasDoMembro` (a da barra global); Vencidas
 *    e Para hoje: os recortes de Minhas Tarefas (`recortesDeTarefas`) — cada
 *    atalho leva ao recorte com o MESMO número.
 *  - Leads a atender: `leadsAAtender` — Contatos de que sou Proprietário com
 *    a Qualificação "Lead" (lead é Qualificação, não entidade: DO-CON-05)
 *    ainda sem contato ou esperando resposta nossa.
 *  - Mensagens novas: `conversasComMensagensNovas` — a mesma "não lida" da
 *    Caixa de Entrada, nas Conversas atribuídas a mim.
 *  - Estatísticas: `estatisticasDoMembro` — o que EU fiz no período, contra o
 *    período anterior do mesmo tamanho, no fuso do Espaço de Trabalho.
 * "Vencida", nunca "em atraso" (GLOSSÁRIO). Nada de contagem do que a pessoa
 * não vê (B103). Sem lanterna nos cartões: luz que segue o cursor é só a do
 * palco, atrás do robô.
 *
 * Os números só existem depois da hidratação — a casca já garante (o miolo
 * da tela só monta hidratado) — e o "agora" é conferido a cada minuto.
 */

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  ListTodo,
  MessageSquare,
  Minus,
  TrendingDown,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useData, useSession } from "@/data/store";
import { contactDisplayName, isOverdue, statusDefinition, tarefasAbertasDoMembro } from "@/data/derive";
import {
  METRICAS_DO_RESUMO,
  conversasComMensagensNovas,
  estatisticasDoMembro,
  leadsAAtender,
  type ConversaComNovas,
  type LeadAAtender,
  type MetricaDoResumo,
  type PeriodoDoResumo,
} from "@/data/derive-resumo";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";
import { reduzido } from "@/design/movimento";
import { ContactAvatar } from "@/features/crm/contact-card";
import { ICONE_DE_OBJETO, Selo, SeloDaTarefa } from "@/features/estrutura/icone-de-tipo";
import { diaDoVencimento, gruposDeTarefas, recortesDeTarefas, type GruposDeTarefas } from "@/features/estrutura/recortes-de-tarefas";
import { Colunas } from "@/features/paineis/graficos";
import { marcarSeMuda } from "@/features/shell/navegacao";
import { relogio } from "@/features/shell/relogio";
import { ConditionMarker, EmptyState, Icone, Pilula, ReguaDeSecao, Segmentos, type Segmento } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** O título do resumo: o atalho do palco (e o robô flutuante que some) levam o foco a ele. */
export const ID_DO_TITULO_DO_RESUMO = "inicio-resumo-titulo";
const ID_DO_TITULO = ID_DO_TITULO_DO_RESUMO;
/** A seção dos Leads: o atalho "Leads a atender" rola até ela. */
const ID_DOS_LEADS = "inicio-leads";
/** Quantas linhas cada bloco mostra antes de "Mostrando n de m" (PADROES §15). */
const POR_BLOCO = 5;
/** De quanto em quanto o "agora" do resumo é conferido (ms). */
const CONFERIR_A_CADA = 60_000;

/** Rola o corpo do Início até um alvo e leva o foco a ele — sem rolar duas vezes. */
function irPara(origem: HTMLElement, alvo: HTMLElement | null, topo?: number) {
  const corpo = origem.closest<HTMLElement>(".corpo-de-tela");
  if (!corpo || !alvo) return;
  const destino = topo ?? corpo.scrollTop + alvo.getBoundingClientRect().top - corpo.getBoundingClientRect().top;
  alvo.focus({ preventScroll: true });
  corpo.scrollTo({ top: destino, behavior: reduzido() ? "auto" : "smooth" });
}

/**
 * O ATALHO DO PALCO para o resumo: no alto à direita do palco, espelhando a
 * saudação. Rolar também leva — este é o caminho do teclado e de quem não
 * sabe que a tela rola. Some com os outros controles do palco na saída.
 */
export function AtalhoDoResumo() {
  const ir = (evento: MouseEvent<HTMLButtonElement>) => {
    // Até a altura DO PALCO (a do corpo, ou a mínima dele): onde o resumo começa.
    const palco = evento.currentTarget.closest<HTMLElement>(".inicio-capa");
    irPara(evento.currentTarget, document.getElementById(ID_DO_TITULO), palco?.offsetHeight);
  };
  return (
    <button type="button" className="app-sm inicio-atalho-resumo" onClick={ir}>
      Seu resumo
      <Icone de={ChevronDown} tamanho="xs" />
    </button>
  );
}

export function ResumoDoInicio() {
  const { memberId } = useSession();
  const state = useData((dados) => dados);
  const fmt = useFormat();
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogioDoResumo = window.setInterval(() => setAgora(new Date()), CONFERIR_A_CADA);
    return () => window.clearInterval(relogioDoResumo);
  }, []);
  const fuso = state.workspace.locale.timezone;

  // O armazém muda no lugar e só a revisão avisa: `useData` já re-renderiza a
  // cada operação, então estas contas rodam por render — sem memo por `state`.
  const abertas = tarefasAbertasDoMembro(state, memberId);
  const recortes = recortesDeTarefas(state, memberId, agora);
  const grupos = gruposDeTarefas(state, memberId, agora);
  const leads = leadsAAtender(state, memberId);
  const conversas = conversasComMensagensNovas(state, memberId);

  const naoLidas = conversas.reduce((soma, conversa) => soma + conversa.naoLidas, 0);
  const semContato = leads.filter((lead) => lead.motivo === "semContato").length;
  // A vencida mais antiga, pelo DIA do vencimento no fuso do Espaço de Trabalho
  // (um dia civil e um instante não se comparam como texto).
  const vencidaMaisAntiga = [...recortes.vencidas]
    .filter((task): task is Task & { readonly dueDate: NonNullable<Task["dueDate"]> } => task.dueDate !== undefined)
    .sort((a, b) => (diaDoVencimento(a, fuso) ?? "").localeCompare(diaDoVencimento(b, fuso) ?? "") || a.dueDate.value.localeCompare(b.dueDate.value))[0]?.dueDate;
  // "venceu há 9 horas" para um instante; um dia civil não é um instante (à
  // meia-noite UTC daria "anteontem" para ontem): "venceu em 23/09/2026".
  const venceu = vencidaMaisAntiga
    ? vencidaMaisAntiga.form === "civilDay"
      ? `em ${fmt.civilDate(vencidaMaisAntiga.value)}`
      : fmt.relative(vencidaMaisAntiga.value, agora.getTime())
    : null;
  // A agenda de hoje: o próximo horário que ainda não passou, ou quantos já passaram.
  const proximaDeHoje = recortes.hoje.find((task) => !isOverdue(state, task, agora));
  const jaPassaram = recortes.hoje.length - recortes.hoje.filter((task) => !isOverdue(state, task, agora)).length;
  const horaDe = (instante: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso }).format(new Date(instante));
  const dataDeHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: fuso }).format(agora);
  const hoje = dataDeHoje.charAt(0).toLocaleUpperCase("pt-BR") + dataDeHoje.slice(1);

  const atalhos: readonly DadosDoAtalho[] = [
    {
      chave: "abertas",
      // O recorte "Abertas" de Minhas Tarefas: o MESMO número deste atalho.
      href: "/estrutura/tarefas?recorte=abertas",
      icone: ListTodo,
      cor: "var(--acento)",
      lavado: "var(--acento-lavado)",
      rotulo: abertas.length === 1 ? "Tarefa aberta" : "Tarefas abertas",
      valor: abertas.length,
      // O grupo "Em andamento" do bloco abaixo (as vencidas ficam em Vencidas).
      detalhe: grupos.emAndamento.length > 0 ? `${fmt.number(grupos.emAndamento.length)} em andamento` : "nenhuma em andamento",
    },
    {
      chave: "vencidas",
      href: "/estrutura/tarefas?recorte=vencidas",
      icone: CircleAlert,
      cor: recortes.vencidas.length > 0 ? "var(--erro)" : "var(--texto-3)",
      lavado: recortes.vencidas.length > 0 ? "var(--erro-lavado)" : "var(--neutro-lavado)",
      rotulo: recortes.vencidas.length === 1 ? "Vencida" : "Vencidas",
      valor: recortes.vencidas.length,
      detalhe: venceu ? (recortes.vencidas.length === 1 ? `venceu ${venceu}` : `a mais antiga venceu ${venceu}`) : "nada vencido",
      alarme: recortes.vencidas.length > 0,
    },
    {
      chave: "hoje",
      href: "/estrutura/tarefas?recorte=hoje",
      icone: CalendarClock,
      cor: "var(--aviso)",
      lavado: "var(--aviso-lavado)",
      rotulo: "Para hoje",
      valor: recortes.hoje.length,
      // O detalhe fala do MESMO conjunto do número (a agenda de hoje, com hora).
      detalhe:
        proximaDeHoje && proximaDeHoje.dueDate
          ? `próxima às ${horaDe(proximaDeHoje.dueDate.value)}`
          : jaPassaram > 0
            ? `${fmt.number(jaPassaram)} já ${jaPassaram === 1 ? "passou" : "passaram"}`
            : "nenhum horário hoje",
    },
    {
      chave: "leads",
      href: `#${ID_DOS_LEADS}`,
      noResumo: true,
      icone: UserRound,
      cor: "var(--sucesso)",
      lavado: "var(--sucesso-lavado)",
      rotulo: "Leads a atender",
      valor: leads.length,
      detalhe:
        leads.length === 0
          ? "nenhum esperando"
          : semContato === leads.length
            ? "sem contato ainda"
            : `${fmt.number(leads.length - semContato)} esperando resposta`,
    },
    {
      chave: "mensagens",
      href: "/crm/caixa-de-entrada?escopo=minhas",
      icone: MessageSquare,
      cor: "var(--info)",
      lavado: "var(--info-lavado)",
      rotulo: naoLidas === 1 ? "Mensagem nova" : "Mensagens novas",
      valor: naoLidas,
      detalhe:
        conversas.length === 0
          ? "nada novo nas suas Conversas"
          : `em ${fmt.number(conversas.length)} ${conversas.length === 1 ? "Conversa" : "Conversas"}`,
    },
  ];

  return (
    <section id="inicio-resumo" className="inicio-resumo" aria-labelledby={ID_DO_TITULO}>
      <header className="inicio-resumo-cabeca">
        {/* Focável por código: o atalho do palco leva o foco até aqui. */}
        <h2 id={ID_DO_TITULO} className="ed-titulo" tabIndex={-1}>
          Seu resumo
        </h2>
        <p className="app-meta">
          <span className="inicio-resumo-data">{hoje}</span> · atualizado às {relogio(agora, fuso).hora}
        </p>
      </header>

      <div className="@container flex flex-col gap-10">
        <ul className="grade-solta grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-5" aria-label="Acesso rápido">
          {atalhos.map((atalho) => (
            <Atalho key={atalho.chave} dados={atalho} fmtNumero={fmt.number} />
          ))}
        </ul>

        <div className="grid gap-x-8 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_24rem]">
          <BlocoDeTarefas state={state} abertas={abertas} grupos={grupos} />
          <div className="flex min-w-0 flex-col gap-10">
            <BlocoDeLeads leads={leads} agora={agora} />
            <BlocoDeMensagens conversas={conversas} naoLidas={naoLidas} agora={agora} />
          </div>
        </div>

        <Estatisticas state={state} memberId={memberId} agora={agora} />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────── acesso rápido */

type DadosDoAtalho = {
  readonly chave: string;
  readonly href: string;
  /** O alvo é um bloco do próprio resumo (rola até ele, sem trocar o endereço). */
  readonly noResumo?: boolean;
  readonly icone: LucideIcon;
  readonly cor: string;
  readonly lavado: string;
  readonly rotulo: string;
  readonly valor: number;
  readonly detalhe: string;
  readonly alarme?: boolean;
};

/**
 * Um ATALHO: o número, o que ele conta e uma linha de contexto — um link
 * para onde a leitura continua. Zero fica recolhido (`data-atenuado`) e o
 * número em `--texto-4`; um alarme (Vencidas) recolore o ícone e a linha, e
 * diz em texto — a cor nunca é o único sinal.
 */
function Atalho({ dados, fmtNumero }: { readonly dados: DadosDoAtalho; readonly fmtNumero: (n: number) => string }) {
  const zero = dados.valor === 0;
  const conteudo = (
    <>
      <span className="inicio-atalho-topo">
        <span aria-hidden="true" className="inicio-atalho-icone" style={{ background: dados.lavado, color: dados.cor }}>
          <Icone de={dados.icone} tamanho="md" />
        </span>
        <Icone de={ArrowRight} tamanho="xs" style={{ color: "var(--texto-4)" }} />
      </span>
      <span className="ed-titulo app-numero" style={{ color: zero ? "var(--texto-4)" : "var(--texto)" }}>
        {fmtNumero(dados.valor)}
      </span>
      <span className="app-base truncate" style={{ color: "var(--texto-1)" }}>
        {dados.rotulo}
      </span>
      <span className="app-meta flex min-w-0 items-center gap-1" style={dados.alarme ? { color: "var(--erro)" } : undefined}>
        {dados.alarme ? <Icone de={CircleAlert} tamanho="xs" /> : null}
        <span className="truncate">{dados.detalhe}</span>
      </span>
    </>
  );
  return (
    <li>
      {dados.noResumo ? (
        <a
          href={dados.href}
          className="item-solto inicio-atalho"
          data-atenuado={zero ? "true" : undefined}
          onClick={(evento) => {
            // Um bloco do próprio resumo: rola até ele e leva o foco ao título,
            // sem pôr o "#" no endereço (o Início não tem estado na URL).
            evento.preventDefault();
            const secao = document.getElementById(dados.href.slice(1));
            irPara(evento.currentTarget, secao?.querySelector<HTMLElement>("h3") ?? null);
          }}
        >
          {conteudo}
        </a>
      ) : (
        <Link
          href={dados.href}
          onNavigate={() => marcarSeMuda(dados.href)}
          className="item-solto inicio-atalho"
          data-atenuado={zero ? "true" : undefined}
        >
          {conteudo}
        </Link>
      )}
    </li>
  );
}

/* ─────────────────────────────────────────────────── os blocos */

/**
 * O cabeçalho de um bloco: a régua de seção do sistema (rótulo em caixa, a
 * contagem, o hairline), mas com um TÍTULO de verdade (`h3`) — a régua não é
 * cabeçalho, e o resumo se navega por eles.
 */
function CabecaDoBloco({
  id,
  titulo,
  contagem,
  acao,
}: {
  readonly id: string;
  readonly titulo: string;
  readonly contagem?: number;
  readonly acao?: ReactNode;
}) {
  return (
    <div className="inicio-bloco-cabeca">
      <h3 id={id} className="app-coluna" tabIndex={-1}>
        {titulo}
      </h3>
      {contagem !== undefined ? <span className="app-meta app-numero">{contagem}</span> : null}
      <span className="inicio-bloco-linha" aria-hidden="true" />
      {acao}
    </div>
  );
}

/** "Ver tudo" de um bloco: o destino, com a seta. */
function AcaoDoBloco({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-sm inicio-bloco-acao">
      {children}
      <Icone de={ArrowRight} tamanho="xs" />
    </Link>
  );
}

/** O que foi cortado, dito (PADROES §15): "Mostrando 5 de 8." e o caminho para o resto. */
function Corte({
  mostrando,
  total,
  href,
  rotulo = "Ver todas",
}: {
  readonly mostrando: number;
  readonly total: number;
  readonly href: string;
  /** "Ver todas" (Tarefas, Conversas) ou "Ver todos" (Contatos). */
  readonly rotulo?: string;
}) {
  if (total <= mostrando) return null;
  return (
    <p className="app-meta app-numero inicio-corte">
      Mostrando {mostrando} de {total}.{" "}
      <Link href={href} onNavigate={() => marcarSeMuda(href)} className="inicio-bloco-acao">
        {rotulo}
        <Icone de={ArrowRight} tamanho="xs" />
      </Link>
    </p>
  );
}

/** O recorte "Abertas" de Minhas Tarefas: o mesmo número do bloco. */
const ABERTAS = "/estrutura/tarefas?recorte=abertas";

/**
 * As TAREFAS abertas da pessoa em quatro grupos (`gruposDeTarefas`), do mais
 * urgente ao mais folgado — cada uma num grupo só: Vencidas; Em andamento
 * (as "tasks atuais" do pedido: categoria `em andamento`); Próximos 7 dias
 * (o recorte "Esta semana" de Minhas Tarefas, fora as já em andamento); e
 * Depois (o resto). Um grupo vazio não aparece. O "Ver todas" de cada grupo
 * leva ao recorte mais próximo — Vencidas e Esta semana ao recorte deles
 * (Esta semana conta também as em andamento), os outros a Abertas.
 */
function BlocoDeTarefas({ state, abertas, grupos: { vencidas, emAndamento, proximas, depois } }: { readonly state: DataState; readonly abertas: readonly Task[]; readonly grupos: GruposDeTarefas }) {
  const grupos = [
    { chave: "vencidas", rotulo: "Vencidas", cor: "var(--erro)", tarefas: vencidas, href: "/estrutura/tarefas?recorte=vencidas", vencida: true },
    { chave: "andamento", rotulo: "Em andamento", cor: undefined, tarefas: emAndamento, href: ABERTAS, vencida: false },
    { chave: "proximas", rotulo: "Próximos 7 dias", cor: undefined, tarefas: proximas, href: "/estrutura/tarefas?recorte=semana", vencida: false },
    { chave: "depois", rotulo: "Depois", cor: undefined, tarefas: depois, href: ABERTAS, vencida: false },
  ] as const;

  return (
    <section aria-labelledby="inicio-tarefas-titulo" className="min-w-0">
      <CabecaDoBloco
        id="inicio-tarefas-titulo"
        titulo="Suas Tarefas"
        contagem={abertas.length}
        acao={<AcaoDoBloco href={ABERTAS}>Minhas Tarefas</AcaoDoBloco>}
      />
      {abertas.length === 0 ? (
        <EmptyState compact title="Nenhuma Tarefa aberta com você." hint="As Tarefas atribuídas a você aparecem aqui." />
      ) : (
        grupos
          .filter((grupo) => grupo.tarefas.length > 0)
          .map((grupo) => (
            <div key={grupo.chave} className="inicio-grupo">
              <ReguaDeSecao rotulo={grupo.rotulo} contagem={grupo.tarefas.length} cor={grupo.cor} />
              <ul className="pilha-solta" aria-label={grupo.rotulo}>
                {grupo.tarefas.slice(0, POR_BLOCO).map((task) => (
                  <LinhaDeTarefa key={task.id} state={state} task={task} vencida={grupo.vencida} />
                ))}
              </ul>
              <Corte mostrando={Math.min(POR_BLOCO, grupo.tarefas.length)} total={grupo.tarefas.length} href={grupo.href} />
            </div>
          ))
      )}
    </section>
  );
}

function LinhaDeTarefa({ state, task, vencida }: { readonly state: DataState; readonly task: Task; readonly vencida: boolean }) {
  const fmt = useFormat();
  const lista = state.lists.find((list) => list.id === task.listId);
  const status = statusDefinition(state, task.listId, task.statusId);
  const href = `/estrutura/tarefas/${task.id}`;
  const meta = [task.readableId, lista?.name, task.dueDate ? `vence ${fmt.taskDate(task.dueDate)}` : "sem vencimento"]
    .filter((parte): parte is string => Boolean(parte))
    .join(" · ");
  return (
    <li>
      <Link href={href} onNavigate={() => marcarSeMuda(href)} className="item-solto py-3">
        <SeloDaTarefa state={state} task={task} {...(vencida ? { tom: "erro" as const } : {})} />
        <span className="min-w-0 flex-1">
          <span className="app-base block truncate text-[var(--texto)]">{task.title}</span>
          <span className="app-sm block truncate text-[var(--texto-3)]">{meta}</span>
        </span>
        {vencida ? (
          <ConditionMarker tone="danger">Vencida</ConditionMarker>
        ) : status ? (
          <Pilula cor={status.color} comPonto className="hidden shrink-0 @md:inline-flex">
            {status.name}
          </Pilula>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Os LEADS A ATENDER: sem contato ainda leva à ficha do Contato (para abrir a
 * conversa); esperando resposta leva direto à Conversa.
 */
function BlocoDeLeads({ leads, agora }: { readonly leads: readonly LeadAAtender[]; readonly agora: Date }) {
  const fmt = useFormat();
  return (
    <section id={ID_DOS_LEADS} aria-labelledby="inicio-leads-titulo" className="min-w-0">
      <CabecaDoBloco
        id="inicio-leads-titulo"
        titulo="Leads a atender"
        contagem={leads.length}
        acao={<AcaoDoBloco href="/crm/contatos">Contatos</AcaoDoBloco>}
      />
      {leads.length === 0 ? (
        <EmptyState compact title="Nenhum Lead esperando por você." hint="Os Contatos seus com a Qualificação Lead aparecem aqui até serem atendidos." />
      ) : (
        <>
          <ul className="pilha-solta">
            {leads.slice(0, POR_BLOCO).map((lead) => {
              const aguardando = lead.motivo === "aguardandoResposta" && lead.conversa;
              const href = aguardando && lead.conversa ? `/crm/caixa-de-entrada/${lead.conversa.id}` : `/crm/contatos/${lead.contato.id}`;
              return (
                <li key={lead.contato.id}>
                  <Link href={href} onNavigate={() => marcarSeMuda(href)} className="item-solto py-3">
                    <ContactAvatar contact={lead.contato} />
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate text-[var(--texto)]">{contactDisplayName(lead.contato)}</span>
                      <span className="app-sm block truncate text-[var(--texto-3)]">
                        {aguardando
                          ? `Esperando resposta · ${fmt.relative(lead.desde, agora.getTime())}`
                          : `Sem contato · Contato criado ${fmt.relative(lead.desde, agora.getTime())}`}
                      </span>
                    </span>
                    {aguardando ? <ConditionMarker tone="warning">Aguardando você</ConditionMarker> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Corte mostrando={Math.min(POR_BLOCO, leads.length)} total={leads.length} href="/crm/contatos" rotulo="Ver todos" />
        </>
      )}
    </section>
  );
}

/** As MENSAGENS NOVAS: as Conversas atribuídas a mim com Mensagem não lida, a mais recente primeiro. */
function BlocoDeMensagens({
  conversas,
  naoLidas,
  agora,
}: {
  readonly conversas: readonly ConversaComNovas[];
  readonly naoLidas: number;
  readonly agora: Date;
}) {
  const fmt = useFormat();
  const caixa = "/crm/caixa-de-entrada?escopo=minhas";
  return (
    <section aria-labelledby="inicio-mensagens-titulo" className="min-w-0">
      <CabecaDoBloco
        id="inicio-mensagens-titulo"
        titulo="Mensagens novas"
        contagem={naoLidas}
        acao={<AcaoDoBloco href={caixa}>Caixa de Entrada</AcaoDoBloco>}
      />
      {conversas.length === 0 ? (
        <EmptyState compact title="Nenhuma Mensagem nova." hint="As Conversas atribuídas a você com Mensagem não lida aparecem aqui." />
      ) : (
        <>
          <ul className="pilha-solta">
            {conversas.slice(0, POR_BLOCO).map(({ conversa, contato, naoLidas: n, ultima, ultimaAtividade }) => {
              const href = `/crm/caixa-de-entrada/${conversa.id}`;
              return (
                <li key={conversa.id}>
                  <Link href={href} onNavigate={() => marcarSeMuda(href)} className="item-solto py-3" data-destacado="true" data-alinhamento="topo">
                    <Selo icone={ICONE_DE_OBJETO.conversa} cor="var(--info)" lavado="var(--info-lavado)" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="app-base min-w-0 flex-1 truncate text-[var(--texto)]">
                          {contato ? contactDisplayName(contato) : "Contato não resolvido"}
                        </span>
                        <span className="app-meta shrink-0">{fmt.relative(ultimaAtividade, agora.getTime())}</span>
                      </span>
                      <span className="app-sm app-numero block text-[var(--info)]">
                        {n === 1 ? "1 não lida" : `${fmt.number(n)} não lidas`}
                      </span>
                      {ultima ? <span className="app-sm line-clamp-2 text-[var(--texto-3)]">{ultima.content}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Corte mostrando={Math.min(POR_BLOCO, conversas.length)} total={conversas.length} href={caixa} />
        </>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────── as estatísticas */

const PERIODOS: readonly Segmento<PeriodoDoResumo>[] = [
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "trimestre", rotulo: "Trimestre" },
  { valor: "ano", rotulo: "Ano" },
];

/** A janela de cada período, em palavras — e o eixo: quantas colunas pulam rótulo. */
const JANELA: Record<
  PeriodoDoResumo,
  { readonly descricao: string; readonly comparacao: string; readonly anterior: string; readonly unidade: string; readonly rotulosACada: number }
> = {
  semana: { descricao: "Últimos 7 dias", comparacao: "comparados ao período anterior, de mesma duração", anterior: "no período anterior", unidade: "por dia", rotulosACada: 1 },
  mes: { descricao: "Últimos 30 dias", comparacao: "comparados ao período anterior, de mesma duração", anterior: "no período anterior", unidade: "por dia", rotulosACada: 5 },
  trimestre: { descricao: "Últimas 13 semanas", comparacao: "comparadas ao período anterior, de mesma duração", anterior: "no período anterior", unidade: "por semana", rotulosACada: 2 },
  ano: { descricao: "Últimos 12 meses", comparacao: "comparados ao período anterior, de mesma duração", anterior: "no período anterior", unidade: "por mês", rotulosACada: 1 },
};

// As cores por nome inteiro: a sentinela de tokens lê cada `var(--…)` literal.
const METRICA: Record<MetricaDoResumo, { readonly rotulo: string; readonly cor: string }> = {
  tarefasConcluidas: { rotulo: "Tarefas concluídas", cor: "var(--serie-1)" },
  mensagensEnviadas: { rotulo: "Mensagens enviadas", cor: "var(--serie-2)" },
  conversasResolvidas: { rotulo: "Conversas resolvidas", cor: "var(--serie-3)" },
  negociosGanhos: { rotulo: "Negócios ganhos", cor: "var(--serie-4)" },
};

/**
 * As ESTATÍSTICAS da pessoa: o período (Semana, Mês, Trimestre, Ano — sempre
 * os últimos N, contra os N anteriores), quatro métricas do que ela FEZ e um
 * gráfico em colunas da métrica escolhida. Cada métrica é um botão que
 * escolhe o gráfico (`aria-pressed`); a primeira escolhida é a que mais tem
 * o que mostrar na semana. Trocar não anima além das colunas mudando de
 * altura.
 */
function Estatisticas({ state, memberId, agora }: { readonly state: DataState; readonly memberId: string; readonly agora: Date }) {
  const fmt = useFormat();
  const [periodo, setPeriodo] = useState<PeriodoDoResumo>("semana");
  const [metrica, setMetrica] = useState<MetricaDoResumo>(() => {
    const semana = estatisticasDoMembro(state, memberId, "semana", agora).metricas;
    return METRICAS_DO_RESUMO.reduce((melhor, chave) => (semana[chave].valor > semana[melhor].valor ? chave : melhor), METRICAS_DO_RESUMO[0] ?? "tarefasConcluidas");
  });
  // Por render, sem memo por `state`: o armazém muda no lugar (só a revisão avisa).
  const leitura = estatisticasDoMembro(state, memberId, periodo, agora);
  const janela = JANELA[periodo];
  const escolhida = leitura.metricas[metrica];

  return (
    <section aria-labelledby="inicio-estatisticas-titulo" className="min-w-0">
      <CabecaDoBloco
        id="inicio-estatisticas-titulo"
        titulo="Estatísticas"
        acao={<Segmentos rotulo="Período das estatísticas" opcoes={PERIODOS} valor={periodo} aoTrocar={setPeriodo} />}
      />
      <p className="app-meta inicio-estatisticas-janela">
        {janela.descricao}, {janela.comparacao}.
      </p>
      <ul className="grade-solta grid-cols-2 @4xl:grid-cols-4" aria-label="Métricas">
        {METRICAS_DO_RESUMO.map((chave) => {
          const leituraDaMetrica = leitura.metricas[chave];
          const diferenca = leituraDaMetrica.valor - leituraDaMetrica.anterior;
          const escolhidaAgora = chave === metrica;
          const IconeDaVariacao = diferenca > 0 ? TrendingUp : diferenca < 0 ? TrendingDown : Minus;
          const variacao = diferenca > 0 ? `+${fmt.number(diferenca)}` : diferenca < 0 ? `−${fmt.number(-diferenca)}` : "igual";
          const frase =
            diferenca === 0
              ? `o mesmo que ${janela.anterior}`
              : `${fmt.number(Math.abs(diferenca))} a ${diferenca > 0 ? "mais" : "menos"} que ${janela.anterior} (${fmt.number(leituraDaMetrica.anterior)})`;
          return (
            <li key={chave}>
              <button
                type="button"
                className="item-solto inicio-metrica"
                aria-pressed={escolhidaAgora}
                data-destacado={escolhidaAgora ? "true" : undefined}
                data-atenuado={leituraDaMetrica.valor === 0 && !escolhidaAgora ? "true" : undefined}
                onClick={() => setMetrica(chave)}
              >
                <span className="app-coluna flex items-center gap-2">
                  <span aria-hidden="true" className="inicio-metrica-ponto" style={{ background: METRICA[chave].cor }} />
                  {METRICA[chave].rotulo}
                </span>
                <span className="ed-subtitulo app-numero" style={{ color: leituraDaMetrica.valor === 0 ? "var(--texto-4)" : "var(--texto)" }}>
                  {fmt.number(leituraDaMetrica.valor)}
                </span>
                {leituraDaMetrica.valorMonetario ? (
                  <span className="app-sm app-numero text-[var(--texto-2)]">{fmt.money(leituraDaMetrica.valorMonetario)}</span>
                ) : null}
                <span className="app-meta flex items-center gap-1" title={frase}>
                  <Icone de={IconeDaVariacao} tamanho="xs" />
                  <span aria-hidden="true">{variacao} vs. antes</span>
                  <span className="sr-only">{frase}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="item-solto inicio-grafico" data-bloco="true" data-estatico="true">
        <p className="app-sm inicio-grafico-titulo">
          {METRICA[metrica].rotulo} {janela.unidade}
          <span className="app-meta"> · {fmt.number(escolhida.valor)} no período</span>
        </p>
        <Colunas
          colunas={leitura.janela.baldes.map((balde, i) => ({
            rotulo: balde.rotulo,
            rotuloLongo: balde.rotuloLongo,
            valor: escolhida.porBalde[i] ?? 0,
          }))}
          formata={fmt.number}
          legenda={`${METRICA[metrica].rotulo} ${janela.unidade}, ${janela.descricao.toLocaleLowerCase("pt-BR")}`}
          cor={METRICA[metrica].cor}
          rotulosACada={janela.rotulosACada}
        />
      </div>
    </section>
  );
}
