/**
 * O resumo do Membro no Início: mensagens novas, Leads a atender e as
 * estatísticas do período. Tudo derivado — nada aqui é gravado (B100: o que se
 * mostra é recalculado a cada leitura).
 *
 * Desde o 15-23 (3.4.7, UCR-07) o que é do CRM NÃO sai do store: as linhas de
 * Conversa, os Leads e as ocorrências por dia chegam por argumento, lidas das
 * rotas (`GET /conversas`, `GET /crm/inicio/*`). Do store só ficam o Catálogo (as
 * Qualificações "Lead") e as Tarefas. As funções `naoLidas` e `ultimaAtividade`
 * seguem sobre a Conversa do modelo antigo porque a Caixa de Entrada ainda as usa.
 *
 * Funções puras, sem React: `agora` vem de fora, para o teste fixar o relógio
 * e para o HTML do servidor não depender da hora de quem renderiza.
 */

import { diaCivilNoFuso } from "./recortes-de-tarefas";
import type { ConversaNaLista } from "./crm/conversas";
import type { EstatisticasDoCrm } from "./crm/inicio";
import { effectiveLifecycleOfTask, memberSeesTask } from "./derive";
import type { DataState } from "./state";
import type { ActorRef, ConversaDeGrupo, Id, Instant, Money } from "./types";

const doMembro = (ator: ActorRef | undefined, memberId: Id): boolean =>
  ator?.kind === "member" && ator.id === memberId;

/* ───────────────────────────── Mensagens novas ───────────────────────────── */

/**
 * "Não lida" é DERIVADA das Mensagens: quantas recebidas ainda não têm leitura
 * registrada deste Membro. Um campo `lida` na Conversa poderia divergir das
 * Mensagens, e aí a Caixa mentiria para quem atende. É a MESMA conta da Caixa
 * de Entrada — ela lê daqui.
 */
export function naoLidas(conversa: ConversaDeGrupo, memberId: Id): number {
  return conversa.messages.filter(
    (mensagem) =>
      mensagem.direction === "recebida" &&
      !mensagem.internalReads.some((leitura) => doMembro(leitura.actor, memberId)),
  ).length;
}

/** O instante da Mensagem mais recente (de qualquer direção); sem Mensagem, o nascimento da Conversa. */
export function ultimaAtividade(conversa: ConversaDeGrupo): Instant {
  const ultima = [...conversa.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  return ultima?.createdAt ?? conversa.createdAt;
}

/** Uma Conversa do bloco "Mensagens novas", como `GET /conversas?naoLidas=true` a devolve. */
export interface MensagemNovaDaConversa {
  readonly conversaId: string;
  /** `null` só quando o Contato não é achado neste Espaço. */
  readonly contatoNome: string | null;
  /** As Mensagens recebidas que o Membro ainda não leu nesta Conversa. */
  readonly naoLidas: number;
  /** Quando chegou a Mensagem recebida mais recente; sem ela, a última mudança da Conversa (ISO 8601 UTC). */
  readonly ultimaAtividade: Instant;
}

export interface MensagensNovasDoMembro {
  /** A mais recente primeiro. */
  readonly linhas: readonly MensagemNovaDaConversa[];
  /** Soma das não lidas das linhas lidas. Com `parcial`, é um piso, não o total do Espaço. */
  readonly naoLidas: number;
  /** Quantas Conversas têm Mensagem nova: o `total` da api, não o tamanho da página. */
  readonly conversas: number;
  /** A api tem mais Conversas do que as linhas lidas: o número de mensagens é só das lidas. */
  readonly parcial: boolean;
}

/**
 * As Conversas que esperam por quem olha, como a api as listou
 * (`naoLidas=true&atribuidoId=<Membro>`: ativas, atribuídas a ele e com Mensagem
 * recebida depois do ponto de leitura dele). Uma resolvida com não lida CONTA: é
 * a mesma conta da aba "Não lidos" da Caixa de Entrada, o destino do atalho — os
 * dois números têm de bater (PENDENCIAS-FRONTEND P32).
 *
 * Ninguém soma páginas no navegador sem dizer: a soma das não lidas é só das
 * linhas lidas, e `parcial` avisa quando a api tem mais Conversas do que veio
 * (`total` maior que as linhas).
 */
export function mensagensNovasDasConversas(itens: readonly ConversaNaLista[], total: number): MensagensNovasDoMembro {
  const linhas = itens
    .filter((conversa) => conversa.naoLidas > 0)
    .map(
      (conversa): MensagemNovaDaConversa => ({
        conversaId: conversa.id,
        contatoNome: conversa.contatoNome,
        naoLidas: conversa.naoLidas,
        ultimaAtividade: conversa.ultimaRecebidaEm ?? conversa.atualizadoEm,
      }),
    )
    .sort((a, b) => b.ultimaAtividade.localeCompare(a.ultimaAtividade) || a.conversaId.localeCompare(b.conversaId));
  return {
    linhas,
    naoLidas: linhas.reduce((soma, linha) => soma + linha.naoLidas, 0),
    conversas: total,
    parcial: total > itens.length,
  };
}

/* ───────────────────────────── Leads a atender ───────────────────────────── */

const normalizar = (texto: string): string =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");

/**
 * Os ids das Definições de Qualificação chamadas "Lead". Lead não é entidade nem
 * Etapa de Negócio: é uma Qualificação do Contato (contatos.md, seção 6;
 * negocios.md; Glossário; DO-CON-05). Sem categoria fixa de Qualificação
 * ainda (C23 aberta), a única leitura possível é pelo NOME — sem distinguir
 * maiúsculas nem acentos. A Definição arquivada continua valendo para quem já
 * a tem.
 *
 * Os Leads em si (Contatos do Membro com essa Qualificação que nunca tiveram
 * Mensagem ou esperam resposta nossa) saem do servidor:
 * `GET /crm/inicio/leads-a-atender?qualificacao=<id>` (15-18). O Catálogo é a
 * única parte que a tela ainda lê do store.
 */
export function qualificacoesDeLead(state: DataState): readonly Id[] {
  return state.catalog.filter((item) => item.kind === "qualificacao" && normalizar(item.name) === "lead").map((item) => item.id);
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

interface Ocorrencia {
  readonly instante: number;
  /** Quantas ocorrências este ponto representa; o CRM entrega a contagem do dia, não uma linha por ato. */
  readonly quantidade?: number;
  readonly valor?: Money;
}

function somaNumaMoeda(ocorrencias: readonly Ocorrencia[]): Money | null {
  const valores = ocorrencias.flatMap((o) => (o.valor ? [o.valor] : []));
  const moeda = valores[0]?.currency;
  if (moeda === undefined || valores.some((v) => v.currency !== moeda)) return null;
  return { amount: valores.reduce((soma, v) => soma + v.amount, 0), currency: moeda };
}

function lerMetrica(
  metrica: MetricaDoResumo,
  ocorrencias: readonly Ocorrencia[],
  janela: JanelaDoResumo,
  /** Onde a janela anterior começa; as contagens por dia a abrem no início do dia que contém `anteriorInicio`. */
  anteriorDesde: number = janela.anteriorInicio.getTime(),
): LeituraDaMetrica {
  const inicio = janela.inicio.getTime();
  const fim = janela.fim.getTime();
  const porBalde = janela.baldes.map(() => 0);
  const contadas: Ocorrencia[] = [];
  let valor = 0;
  let anterior = 0;
  for (const ocorrencia of ocorrencias) {
    const t = ocorrencia.instante;
    const quantidade = ocorrencia.quantidade ?? 1;
    if (t >= inicio && t <= fim) {
      contadas.push(ocorrencia);
      valor += quantidade;
      // Os baldes são contíguos a partir de `inicio`: o do instante é o último que já começou.
      for (let i = janela.baldes.length - 1; i >= 0; i -= 1) {
        if (t >= (janela.baldes[i]?.inicio.getTime() ?? Number.POSITIVE_INFINITY)) {
          porBalde[i] = (porBalde[i] ?? 0) + quantidade;
          break;
        }
      }
    } else if (t >= anteriorDesde && t < inicio) {
      anterior += quantidade;
    }
  }
  return {
    metrica,
    valor,
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
 * - `tarefasConcluidas` (do store): Tarefas com Momento de conclusão, das quais
 *   ele é Responsável, fora da lixeira (estado efetivo, B36) e que ele VÊ hoje —
 *   nunca se conta o que quem olha não vê (RN-PAI-10; B103);
 * - as outras três vêm do servidor (`GET /crm/inicio/estatisticas`, 15-18), já
 *   somadas por dia no fuso do Espaço e SÓ do Membro da sessão, e entram por
 *   `crm` (3.4.7, UCR-07):
 *   - `mensagensEnviadas`: Mensagens `enviada` de que ele é o Ator, em Conversas
 *     fora da lixeira;
 *   - `conversasResolvidas`: Conversas `resolvida` de que ele é o Atribuído, pelo
 *     momento de resolução (o modelo novo não guarda quem clicou em resolver);
 *   - `negociosGanhos`: Negócios `ganho` de que ele é o Proprietário, pelo
 *     Momento de encerramento, fora da lixeira; com a soma dos Valores numa moeda
 *     só (RN-PAI-13).
 *
 * `crm` é `undefined` enquanto a api não respondeu (ou se recusou) e uma série é
 * `null` quando o Papel não lê o recurso: as duas leituras valem zero, nunca um
 * número inventado. Um dia do CRM é um ponto só, no início do dia civil no fuso do
 * Espaço: entra na janela atual quando esse início está em `[inicio, agora]` e na
 * anterior quando está entre o início do dia que contém `anteriorInicio` e `inicio`
 * (a comparação é por dia inteiro; as janelas de `janelasDeConsultaDoCrm` pedem ao
 * servidor exatamente esses dias).
 */
export function estatisticasDoMembro(
  state: DataState,
  memberId: Id,
  periodo: PeriodoDoResumo,
  agora: Date,
  crm: EstatisticasDoCrm | undefined,
): EstatisticasDoMembro {
  const fuso = state.workspace.locale.timezone;
  const janela = janelaDoResumo(periodo, agora, fuso);
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

  const inicioDoDiaDoCrm = (dia: string): number | null =>
    /^\d{4}-\d{2}-\d{2}$/.test(dia) ? inicioDoDiaNoFuso(dia, fuso).getTime() : null;
  const doCrm = <T extends { readonly dia: string; readonly quantidade: number }>(
    linhas: readonly T[] | null | undefined,
    comoOcorrencia: (linha: T) => Omit<Ocorrencia, "instante">,
  ): Ocorrencia[] =>
    (linhas ?? []).flatMap((linha) => {
      const instante = inicioDoDiaDoCrm(linha.dia);
      return instante === null ? [] : [{ instante, ...comoOcorrencia(linha) }];
    });
  const anteriorDesdeDoCrm = inicioDoDiaNoFuso(diaCivilNoFuso(janela.anteriorInicio, fuso), fuso).getTime();

  const mensagensEnviadas = doCrm(crm?.mensagensEnviadas, (linha) => ({ quantidade: linha.quantidade }));
  const conversasResolvidas = doCrm(crm?.conversasResolvidas, (linha) => ({ quantidade: linha.quantidade }));
  // Negócio ganho sem Valor soma 0 e não escolhe moeda: só o Valor positivo entra na soma de uma moeda só (RN-PAI-13).
  const negociosGanhos = doCrm(crm?.negociosGanhos, (linha) => ({
    quantidade: linha.quantidade,
    ...(linha.valor > 0 ? { valor: { amount: linha.valor, currency: linha.moeda } } : {}),
  }));

  return {
    janela,
    metricas: {
      tarefasConcluidas: lerMetrica("tarefasConcluidas", tarefasConcluidas, janela),
      mensagensEnviadas: lerMetrica("mensagensEnviadas", mensagensEnviadas, janela, anteriorDesdeDoCrm),
      conversasResolvidas: lerMetrica("conversasResolvidas", conversasResolvidas, janela, anteriorDesdeDoCrm),
      negociosGanhos: lerMetrica("negociosGanhos", negociosGanhos, janela, anteriorDesdeDoCrm),
    },
  };
}

/** Uma janela de consulta de `GET /crm/inicio/estatisticas`: instantes ISO 8601. */
export interface JanelaDeConsultaDoCrm {
  readonly desde: string;
  readonly ate: string;
}

/**
 * As duas consultas que as estatísticas pedem ao servidor: a janela ATUAL e a
 * ANTERIOR, cada uma sozinha. Duas e não uma porque a api aceita no máximo 400
 * dias entre `desde` e `ate`, e o "ano" com o ano anterior para comparar passa de
 * 700. As duas são estáveis o dia inteiro (viram a chave do SWR): a atual vai do
 * início do primeiro balde ao fim do dia de hoje (não ao "agora", que muda a cada
 * minuto) e a anterior começa no início de um dia do fuso e termina um milissegundo
 * antes da atual. `agora` mexe em `anteriorInicio` só quando cruza a meia-noite
 * local, e nesse instante `desde` também troca de dia.
 */
export function janelasDeConsultaDoCrm(
  janela: JanelaDoResumo,
  fuso: string,
): { readonly atual: JanelaDeConsultaDoCrm; readonly anterior: JanelaDeConsultaDoCrm } {
  const hoje = diaCivilNoFuso(janela.fim, fuso);
  const fimDeHoje = inicioDoDiaNoFuso(somarDias(hoje, 1), fuso).getTime() - 1;
  return {
    atual: { desde: janela.inicio.toISOString(), ate: new Date(fimDeHoje).toISOString() },
    anterior: {
      desde: inicioDoDiaNoFuso(diaCivilNoFuso(janela.anteriorInicio, fuso), fuso).toISOString(),
      ate: new Date(janela.inicio.getTime() - 1).toISOString(),
    },
  };
}

const juntarSeries = <T>(anterior: readonly T[] | null, atual: readonly T[] | null): readonly T[] | null =>
  anterior === null ? atual : atual === null ? anterior : [...anterior, ...atual];

/**
 * As respostas das duas janelas numa só, para `estatisticasDoMembro`. Janelas que
 * não se encostam não repetem dia, então basta concatenar. Sem uma das respostas
 * (ainda carregando, ou recusada), vale a outra; sem nenhuma, `undefined`.
 */
export function juntarEstatisticasDoCrm(
  atual: EstatisticasDoCrm | undefined,
  anterior: EstatisticasDoCrm | undefined,
): EstatisticasDoCrm | undefined {
  if (atual === undefined) return anterior;
  if (anterior === undefined) return atual;
  return {
    desde: anterior.desde < atual.desde ? anterior.desde : atual.desde,
    ate: anterior.ate > atual.ate ? anterior.ate : atual.ate,
    fuso: atual.fuso,
    mensagensEnviadas: juntarSeries(anterior.mensagensEnviadas, atual.mensagensEnviadas),
    conversasResolvidas: juntarSeries(anterior.conversasResolvidas, atual.conversasResolvidas),
    negociosGanhos: juntarSeries(anterior.negociosGanhos, atual.negociosGanhos),
  };
}
