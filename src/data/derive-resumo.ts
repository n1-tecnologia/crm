/**
 * O resumo do Membro no Início: mensagens novas, Leads a atender e as
 * estatísticas do período. Tudo derivado dos registros que já existem —
 * nada aqui é gravado (B100: o que se mostra é recalculado a cada leitura).
 *
 * Funções puras, sem React: `agora` vem de fora, para o teste fixar o relógio
 * e para o HTML do servidor não depender da hora de quem renderiza.
 */

import { diaCivilNoFuso } from "@/features/estrutura/recortes-de-tarefas";
import { effectiveLifecycleOfTask, lastInteraction, memberSeesTask } from "./derive";
import type { DataState } from "./state";
import type { ActorRef, Contact, Conversation, Id, Instant, Message, Money } from "./types";

const doMembro = (ator: ActorRef | undefined, memberId: Id): boolean =>
  ator?.kind === "member" && ator.id === memberId;

/** A última Mensagem trocada com o Contato na Conversa: nota interna não conta (mesma leitura de `lastInteraction`). */
function ultimaMensagemExterna(conversa: Conversation): Message | undefined {
  let ultima: Message | undefined;
  for (const mensagem of conversa.messages) {
    if (mensagem.direction === "interna") continue;
    if (!ultima || mensagem.createdAt >= ultima.createdAt) ultima = mensagem;
  }
  return ultima;
}

/* ───────────────────────────── Mensagens novas ───────────────────────────── */

/**
 * "Não lida" é DERIVADA das Mensagens: quantas recebidas ainda não têm leitura
 * registrada deste Membro. Um campo `lida` na Conversa poderia divergir das
 * Mensagens, e aí a Caixa mentiria para quem atende. É a MESMA conta da Caixa
 * de Entrada — ela lê daqui.
 */
export function naoLidas(conversa: Conversation, memberId: Id): number {
  return conversa.messages.filter(
    (mensagem) =>
      mensagem.direction === "recebida" &&
      !mensagem.internalReads.some((leitura) => doMembro(leitura.actor, memberId)),
  ).length;
}

/** O instante da Mensagem mais recente (de qualquer direção); sem Mensagem, o nascimento da Conversa. */
export function ultimaAtividade(conversa: Conversation): Instant {
  const ultima = [...conversa.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  return ultima?.createdAt ?? conversa.createdAt;
}

export interface ConversaComNovas {
  readonly conversa: Conversation;
  readonly contato: Contact | undefined;
  readonly naoLidas: number;
  /** A última Mensagem trocada com o Contato (recebida ou enviada; nota interna não conta). */
  readonly ultima: Message | undefined;
  readonly ultimaAtividade: Instant;
}

/**
 * As Conversas que esperam por quem olha: ativas, atribuídas a ele e com
 * Mensagem recebida que ele ainda não leu — a mais recente primeiro. Uma
 * resolvida com não lida CONTA: é a mesma conta da aba "Não lidos" da Caixa
 * de Entrada, o destino do atalho — os dois números têm de bater
 * (PENDENCIAS-FRONTEND P32). Ser Atribuído exige `ver` na Conversa (a Fila é a origem da
 * permissão por referência operacional, B70), então não há filtro de
 * permissão a mais aqui.
 */
export function conversasComMensagensNovas(state: DataState, memberId: Id): ConversaComNovas[] {
  const encontradas: ConversaComNovas[] = [];
  for (const conversa of state.conversations) {
    if (conversa.lifecycle !== "ativo") continue;
    if (!doMembro(conversa.assignee, memberId)) continue;
    const novas = naoLidas(conversa, memberId);
    if (novas === 0) continue;
    encontradas.push({
      conversa,
      contato: state.contacts.find((c) => c.id === conversa.contactId),
      naoLidas: novas,
      ultima: ultimaMensagemExterna(conversa),
      ultimaAtividade: ultimaAtividade(conversa),
    });
  }
  return encontradas.sort(
    (a, b) => b.ultimaAtividade.localeCompare(a.ultimaAtividade) || a.conversa.id.localeCompare(b.conversa.id),
  );
}

/* ───────────────────────────── Leads a atender ───────────────────────────── */

export type MotivoDoLead = "semContato" | "aguardandoResposta";

export interface LeadAAtender {
  readonly contato: Contact;
  readonly motivo: MotivoDoLead;
  /** Só em `aguardandoResposta`: a Conversa em que a bola está com a organização. */
  readonly conversa: Conversation | undefined;
  /** Desde quando espera: o nascimento do Contato, ou a Mensagem recebida sem resposta. */
  readonly desde: Instant;
}

const normalizar = (texto: string): string =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

/**
 * As Definições de Qualificação chamadas "Lead". Lead não é entidade nem
 * Etapa de Negócio: é uma Qualificação do Contato (contatos.md, seção 6;
 * negocios.md; Glossário; DO-CON-05). Sem categoria fixa de Qualificação
 * ainda (C23 aberta), a única leitura possível é pelo NOME — sem distinguir
 * maiúsculas nem acentos. A Definição arquivada continua valendo para quem já
 * a tem.
 */
function qualificacoesDeLead(state: DataState): ReadonlySet<Id> {
  return new Set(
    state.catalog.filter((item) => item.kind === "qualificacao" && normalizar(item.name) === "lead").map((item) => item.id),
  );
}

/**
 * Os Leads do Membro que pedem ação dele: Contatos ativos de que ele é o
 * Proprietário, com Qualificação "Lead", e
 * - `semContato`: ninguém falou com eles ainda — nenhuma Mensagem (fora nota
 *   interna) em Conversa nenhuma (a "Última interação" vazia, documento 10);
 *   esperam desde o nascimento do Contato; ou
 * - `aguardandoResposta`: têm Conversa ativa `aberta` cuja última Mensagem é
 *   `recebida` — a bola está com a organização (DO-CXE-07); esperam desde essa
 *   Mensagem, e com várias Conversas assim vale a que espera há mais tempo.
 *
 * O Lead cuja última Mensagem é `enviada` espera pelo Contato, não por nós, e
 * fica fora. A ordem é de quem espera há mais tempo primeiro.
 */
export function leadsAAtender(state: DataState, memberId: Id): LeadAAtender[] {
  const lead = qualificacoesDeLead(state);
  const encontrados: LeadAAtender[] = [];
  for (const contato of state.contacts) {
    if (contato.lifecycle !== "ativo" || contato.ownerMemberId !== memberId) continue;
    if (contato.qualificationId === undefined || !lead.has(contato.qualificationId)) continue;

    if (lastInteraction(state, contato.id) === null) {
      encontrados.push({ contato, motivo: "semContato", conversa: undefined, desde: contato.createdAt });
      continue;
    }

    let esperando: { readonly conversa: Conversation; readonly desde: Instant } | undefined;
    for (const conversa of state.conversations) {
      if (conversa.contactId !== contato.id || conversa.lifecycle !== "ativo" || conversa.state !== "aberta") continue;
      const ultima = ultimaMensagemExterna(conversa);
      if (ultima?.direction !== "recebida") continue;
      if (!esperando || ultima.createdAt < esperando.desde) esperando = { conversa, desde: ultima.createdAt };
    }
    if (esperando) encontrados.push({ contato, motivo: "aguardandoResposta", ...esperando });
  }
  return encontrados.sort((a, b) => a.desde.localeCompare(b.desde) || a.contato.id.localeCompare(b.contato.id));
}

/* ───────────────────────────── Estatísticas do período ───────────────────────────── */

export type PeriodoDoResumo = "semana" | "mes" | "trimestre" | "ano";

export const PERIODOS_DO_RESUMO: readonly PeriodoDoResumo[] = ["semana", "mes", "trimestre", "ano"];

export type MetricaDoResumo = "tarefasConcluidas" | "mensagensEnviadas" | "conversasResolvidas" | "negociosGanhos";

export const METRICAS_DO_RESUMO: readonly MetricaDoResumo[] = [
  "tarefasConcluidas",
  "mensagensEnviadas",
  "conversasResolvidas",
  "negociosGanhos",
];

export interface BaldeDoResumo {
  readonly inicio: Date;
  /** Exclusivo — exceto no último balde, que termina em `agora` e o inclui. */
  readonly fim: Date;
  /** Rótulo curto do eixo, em pt-BR ("seg", "21", "15/09", "set"). */
  readonly rotulo: string;
  /** Por extenso, para leitor de tela e dica ("segunda-feira, 21 de setembro"). */
  readonly rotuloLongo: string;
}

export interface JanelaDoResumo {
  readonly periodo: PeriodoDoResumo;
  /** 00:00, no fuso do Espaço de Trabalho, do primeiro dia do primeiro balde. */
  readonly inicio: Date;
  /** = agora. */
  readonly fim: Date;
  /** A janela anterior, de MESMA duração: `[anteriorInicio, inicio)`. */
  readonly anteriorInicio: Date;
  /** Do mais antigo ao mais recente, contíguos, cobrindo `[inicio, fim]`. */
  readonly baldes: readonly BaldeDoResumo[];
}

type PartesDoDia = readonly [ano: number, mes: number, dia: number];

function partesDoDia(dia: string): PartesDoDia {
  const [ano, mes, d] = dia.split("-").map(Number);
  return [ano ?? 1970, mes ?? 1, d ?? 1];
}

const doisDigitos = (n: number): string => String(n).padStart(2, "0");

/** Aritmética de calendário puro: somar dias a um dia civil não depende de fuso. */
function somarDias(dia: string, dias: number): string {
  const [ano, mes, d] = partesDoDia(dia);
  return new Date(Date.UTC(ano, mes - 1, d + dias)).toISOString().slice(0, 10);
}

/** O dia civil como um instante ao meio-dia UTC — para o `Intl` dar nome ao dia sem nenhum fuso no caminho. */
function comoMeioDiaUtc(dia: string): Date {
  const [ano, mes, d] = partesDoDia(dia);
  return new Date(Date.UTC(ano, mes - 1, d, 12));
}

const semPontoFinal = (texto: string): string => texto.replace(/\.$/, "");

const formatoPtBr = (opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: "UTC" });

const DIA_DA_SEMANA_CURTO = formatoPtBr({ weekday: "short" });
const DIA_POR_EXTENSO = formatoPtBr({ weekday: "long", day: "numeric", month: "long" });
const MES_CURTO = formatoPtBr({ month: "short" });
const MES_E_ANO = formatoPtBr({ month: "long", year: "numeric" });

const formatosDeDeslocamento = new Map<string, Intl.DateTimeFormat>();

/** Quanto o relógio de parede do fuso está à frente do UTC naquele instante (ms; negativo a oeste). */
function deslocamentoNoFuso(instante: number, fuso: string): number {
  let formato = formatosDeDeslocamento.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatosDeDeslocamento.set(fuso, formato);
  }
  const partes = formato.formatToParts(new Date(instante));
  const parte = (tipo: Intl.DateTimeFormatPartTypes): number => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const paredeComoUtc = Date.UTC(parte("year"), parte("month") - 1, parte("day"), parte("hour"), parte("minute"), parte("second"));
  return paredeComoUtc - (instante - (((instante % 1000) + 1000) % 1000));
}

/**
 * O primeiro instante do dia civil no fuso. Duas passagens pelo deslocamento
 * cobrem a troca de horário de verão; num dia em que a meia-noite não existe
 * (o relógio pulou de 23:59 para 01:00), o dia começa no primeiro instante que
 * cai nele.
 */
function inicioDoDiaNoFuso(dia: string, fuso: string): Date {
  const [ano, mes, d] = partesDoDia(dia);
  const meiaNoiteUtc = Date.UTC(ano, mes - 1, d);
  const primeiro = meiaNoiteUtc - deslocamentoNoFuso(meiaNoiteUtc, fuso);
  const segundo = meiaNoiteUtc - deslocamentoNoFuso(primeiro, fuso);
  const noDia = [primeiro, segundo].filter((instante) => diaCivilNoFuso(new Date(instante), fuso) === dia);
  return new Date(noDia.length > 0 ? Math.min(...noDia) : primeiro);
}

/**
 * A janela do período, terminando em `agora` e fatiada por dia civil no fuso
 * do Espaço de Trabalho (Localidade, B34; os Painéis usam o mesmo fuso para
 * Períodos). Nunca o fuso de quem renderiza.
 * - `semana`: os 7 últimos dias civis, hoje incluso — 7 baldes diários;
 * - `mes`: os 30 últimos dias civis — 30 baldes diários;
 * - `trimestre`: as 13 últimas semanas (91 dias civis) — 13 baldes de 7 dias;
 * - `ano`: os 12 últimos meses do calendário, o corrente (parcial) incluso.
 * O último balde termina em `agora`. A janela anterior tem a MESMA duração
 * (`agora − inicio`) e termina onde esta começa: comparar uma semana que ainda
 * não acabou com uma inteira seria comparar coisas diferentes.
 */
export function janelaDoResumo(periodo: PeriodoDoResumo, agora: Date, fuso: string): JanelaDoResumo {
  const hoje = diaCivilNoFuso(agora, fuso);
  const fatias: Array<{ readonly primeiroDia: string; readonly rotulo: string; readonly rotuloLongo: string }> = [];

  if (periodo === "ano") {
    const [ano, mes] = partesDoDia(hoje);
    for (let atras = 11; atras >= 0; atras -= 1) {
      const indice = ano * 12 + (mes - 1) - atras;
      const primeiroDia = `${Math.floor(indice / 12)}-${doisDigitos((indice % 12) + 1)}-01`;
      const meio = comoMeioDiaUtc(primeiroDia);
      fatias.push({ primeiroDia, rotulo: semPontoFinal(MES_CURTO.format(meio)), rotuloLongo: MES_E_ANO.format(meio) });
    }
  } else {
    const dias = periodo === "semana" ? 7 : periodo === "mes" ? 30 : 91;
    const passo = periodo === "trimestre" ? 7 : 1;
    const primeiro = somarDias(hoje, -(dias - 1));
    for (let deslocamento = 0; deslocamento < dias; deslocamento += passo) {
      const primeiroDia = somarDias(primeiro, deslocamento);
      if (periodo === "trimestre") {
        const [, mesInicial, diaInicial] = partesDoDia(primeiroDia);
        const [, mesFinal, diaFinal] = partesDoDia(somarDias(primeiroDia, passo - 1));
        const inicioCurto = `${doisDigitos(diaInicial)}/${doisDigitos(mesInicial)}`;
        fatias.push({
          primeiroDia,
          rotulo: inicioCurto,
          rotuloLongo: `semana de ${inicioCurto} a ${doisDigitos(diaFinal)}/${doisDigitos(mesFinal)}`,
        });
      } else {
        const meio = comoMeioDiaUtc(primeiroDia);
        fatias.push({
          primeiroDia,
          rotulo: periodo === "semana" ? semPontoFinal(DIA_DA_SEMANA_CURTO.format(meio)) : String(partesDoDia(primeiroDia)[2]),
          rotuloLongo: DIA_POR_EXTENSO.format(meio),
        });
      }
    }
  }

  const inicios = fatias.map((fatia) => inicioDoDiaNoFuso(fatia.primeiroDia, fuso));
  const baldes: BaldeDoResumo[] = fatias.map((fatia, i) => ({
    inicio: inicios[i] ?? agora,
    fim: inicios[i + 1] ?? agora,
    rotulo: fatia.rotulo,
    rotuloLongo: fatia.rotuloLongo,
  }));
  const inicio = inicios[0] ?? agora;
  return {
    periodo,
    inicio,
    fim: agora,
    anteriorInicio: new Date(inicio.getTime() - (agora.getTime() - inicio.getTime())),
    baldes,
  };
}

export interface LeituraDaMetrica {
  readonly metrica: MetricaDoResumo;
  /** Quantos na janela `[inicio, agora]`. */
  readonly valor: number;
  /** Quantos na janela anterior `[anteriorInicio, inicio)`. */
  readonly anterior: number;
  /** A contagem de cada balde, na ordem dos baldes; soma `valor`. */
  readonly porBalde: readonly number[];
  /**
   * Só em `negociosGanhos`: a soma dos Valores dos Negócios contados, quando
   * todos os que têm Valor estão numa mesma moeda. Moedas não se somam entre
   * si (RN-PAI-13): com mais de uma, `null`. Também `null` sem Valor nenhum e
   * nas outras métricas.
   */
  readonly valorMonetario: Money | null;
}

export interface EstatisticasDoMembro {
  readonly janela: JanelaDoResumo;
  readonly metricas: Readonly<Record<MetricaDoResumo, LeituraDaMetrica>>;
}

/**
 * A ação que o Registro de Atividade grava quando um Membro resolve uma
 * Conversa (`resolveConversation` e a resolução no ato de mover Conversa,
 * `operations/conversations.ts`). A Conversa guarda `resolvedAt` mas não
 * quem resolveu: o Ator do Registro é a única atribuição.
 */
const ACAO_CONVERSA_RESOLVIDA = "Conversa resolvida";

interface Ocorrencia {
  readonly instante: number;
  readonly valor?: Money;
}

function somaNumaMoeda(ocorrencias: readonly Ocorrencia[]): Money | null {
  const valores = ocorrencias.flatMap((o) => (o.valor ? [o.valor] : []));
  const moeda = valores[0]?.currency;
  if (moeda === undefined || valores.some((v) => v.currency !== moeda)) return null;
  return { amount: valores.reduce((soma, v) => soma + v.amount, 0), currency: moeda };
}

function lerMetrica(metrica: MetricaDoResumo, ocorrencias: readonly Ocorrencia[], janela: JanelaDoResumo): LeituraDaMetrica {
  const inicio = janela.inicio.getTime();
  const fim = janela.fim.getTime();
  const anteriorInicio = janela.anteriorInicio.getTime();
  const porBalde = janela.baldes.map(() => 0);
  const contadas: Ocorrencia[] = [];
  let anterior = 0;
  for (const ocorrencia of ocorrencias) {
    const t = ocorrencia.instante;
    if (t >= inicio && t <= fim) {
      contadas.push(ocorrencia);
      // Os baldes são contíguos a partir de `inicio`: o do instante é o último que já começou.
      for (let i = janela.baldes.length - 1; i >= 0; i -= 1) {
        if (t >= (janela.baldes[i]?.inicio.getTime() ?? Number.POSITIVE_INFINITY)) {
          porBalde[i] = (porBalde[i] ?? 0) + 1;
          break;
        }
      }
    } else if (t >= anteriorInicio && t < inicio) {
      anterior += 1;
    }
  }
  return {
    metrica,
    valor: contadas.length,
    anterior,
    porBalde,
    valorMonetario: metrica === "negociosGanhos" ? somaNumaMoeda(contadas) : null,
  };
}

/**
 * O que o Membro fez no período, com a janela anterior de mesma duração para
 * comparar. Um registro conta quando o seu instante está em `[inicio, agora]`
 * e vai para "anterior" quando está em `[anteriorInicio, inicio)`. A lixeira
 * nunca conta (INV-PAI-04).
 * - `tarefasConcluidas`: Tarefas com Momento de conclusão, das quais ele é
 *   Responsável, fora da lixeira (estado efetivo, B36) e que ele VÊ hoje —
 *   nunca se conta o que quem olha não vê (RN-PAI-10; B103);
 * - `mensagensEnviadas`: Mensagens `enviada` cujo Ator é ele, pelo momento de
 *   criação, em Conversas fora da lixeira;
 * - `conversasResolvidas`: Registros de Atividade "Conversa resolvida" com
 *   resultado `ok` e Ator = ele, pelo instante do Registro — cada ato de
 *   resolver conta (resolver, reabrir e resolver de novo são dois). O
 *   Registro de uma Conversa hoje na lixeira ou eliminada não entra
 *   (INV-PAI-04; RN-PAI-30);
 * - `negociosGanhos`: Negócios `ganho` de que ele é o Proprietário (o Negócio
 *   tem Proprietário, nunca Responsável), pelo Momento de encerramento, fora
 *   da lixeira; com a soma dos Valores numa moeda só (RN-PAI-13).
 */
export function estatisticasDoMembro(
  state: DataState,
  memberId: Id,
  periodo: PeriodoDoResumo,
  agora: Date,
): EstatisticasDoMembro {
  const janela = janelaDoResumo(periodo, agora, state.workspace.locale.timezone);
  const desde = janela.anteriorInicio.getTime();
  const ate = janela.fim.getTime();
  // Recorte barato primeiro: só o que cai numa das duas janelas passa às
  // regras caras (permissão, estado efetivo). Fora delas, `null`.
  const noAlcance = (instante: Instant | undefined): number | null => {
    if (instante === undefined) return null;
    const t = Date.parse(instante);
    return t >= desde && t <= ate ? t : null;
  };

  const tarefasConcluidas: Ocorrencia[] = [];
  for (const task of state.tasks) {
    const t = noAlcance(task.completedAt);
    if (t === null || !task.assignees.some((a) => doMembro(a, memberId))) continue;
    if (effectiveLifecycleOfTask(state, task.id) === "naLixeira") continue;
    if (!memberSeesTask(state, memberId, task.id)) continue;
    tarefasConcluidas.push({ instante: t });
  }

  const mensagensEnviadas: Ocorrencia[] = [];
  for (const conversa of state.conversations) {
    if (conversa.lifecycle === "naLixeira") continue;
    for (const mensagem of conversa.messages) {
      if (mensagem.direction !== "enviada" || !doMembro(mensagem.actor, memberId)) continue;
      const t = noAlcance(mensagem.createdAt);
      if (t !== null) mensagensEnviadas.push({ instante: t });
    }
  }

  const conversasResolvidas: Ocorrencia[] = [];
  for (const registro of state.activity) {
    if (registro.action !== ACAO_CONVERSA_RESOLVIDA || registro.objectType !== "conversation") continue;
    if (registro.result !== "ok" || !doMembro(registro.actor, memberId)) continue;
    const t = noAlcance(registro.at);
    if (t === null) continue;
    const conversa = state.conversations.find((c) => c.id === registro.objectId);
    if (!conversa || conversa.lifecycle === "naLixeira") continue;
    conversasResolvidas.push({ instante: t });
  }

  const negociosGanhos: Ocorrencia[] = [];
  for (const deal of state.deals) {
    if (deal.ownerMemberId !== memberId || deal.situation !== "ganho" || deal.lifecycle === "naLixeira") continue;
    const t = noAlcance(deal.closedAt);
    if (t !== null) negociosGanhos.push(deal.value ? { instante: t, valor: deal.value } : { instante: t });
  }

  return {
    janela,
    metricas: {
      tarefasConcluidas: lerMetrica("tarefasConcluidas", tarefasConcluidas, janela),
      mensagensEnviadas: lerMetrica("mensagensEnviadas", mensagensEnviadas, janela),
      conversasResolvidas: lerMetrica("conversasResolvidas", conversasResolvidas, janela),
      negociosGanhos: lerMetrica("negociosGanhos", negociosGanhos, janela),
    },
  };
}
