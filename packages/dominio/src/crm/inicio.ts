/**
 * O agregado do Início no CRM novo (15-18, 3.4.7, UCR-07): o que `derive-resumo` e o
 * panorama do robô somavam sobre o store passa a ser somado no servidor, sobre as
 * tabelas. Aqui só os tipos, os limites e as duas conferências de forma que a rota e
 * o serviço aplicam.
 *
 * Três leituras, uma por bloco do Início:
 *   - `PanoramaDoCrm`: Contatos recentes, Negócios abertos e Conversas ativas não resolvidas;
 *   - `LeadAAtenderDoCrm`: os Contatos do Membro com Qualificação "Lead" que pedem ação;
 *   - `EstatisticasDoCrm`: o que o Membro fez por dia (Mensagens, Conversas resolvidas, Negócios ganhos).
 *
 * "Meu" é SEMPRE o Membro da sessão: nenhum tipo carrega o id do Membro nem o do Espaço,
 * e a rota recusa um `membroId` que o cliente tente mandar (UCR-07, privacidade).
 *
 * Um bloco do panorama ou da estatística vem `null` quando o Papel não lê o recurso dele
 * (um Convidado sem `ler` em Negócio não vê o bloco de Negócios, nem o número dele).
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa pelo
 * subcaminho `@n1/dominio/crm/inicio`.
 */

/** Quantos Contatos recentes o panorama traz. */
export const CONTATOS_RECENTES_DO_PANORAMA = 5;

/** O teto de Leads devolvidos (os que esperam há mais tempo vêm primeiro). */
export const LIMITE_DE_LEADS = 50;

/** Quantas Qualificações a rota de Leads aceita num pedido. */
export const QUALIFICACOES_MAXIMAS = 20;

/** A janela máxima das estatísticas, em dias: o teto que segura o `group by` por dia (T-15-46). */
export const JANELA_MAXIMA_DE_ESTATISTICAS_DIAS = 400;

/** Um dia civil `YYYY-MM-DD` no fuso pedido. */
export type DiaCivil = string;

export interface ContatoRecenteDoCrm {
  readonly id: string;
  /** O nome de exibição (nome e sobrenome, senão o Identificador principal, senão "Contato sem nome"). */
  readonly nome: string;
}

export interface NegociosAbertosDoCrm {
  readonly quantidade: number;
  /**
   * A soma de `valor × probabilidade / 100` (a do Negócio, senão a padrão da Etapa) dos
   * Negócios abertos que têm Valor. `null` quando há mais de uma moeda (moedas não se somam,
   * RN-PAI-13) ou nenhum Valor.
   */
  readonly valorPonderado: number | null;
  /** A moeda única de `valorPonderado`; `null` quando ele é `null`. */
  readonly moeda: string | null;
}

export interface PanoramaDoCrm {
  /** Os Contatos ativos mais recentes (até `CONTATOS_RECENTES_DO_PANORAMA`); `null` sem `ler` em Contato. */
  readonly contatosRecentes: readonly ContatoRecenteDoCrm[] | null;
  /** Quantos Contatos ativos o Espaço tem; `null` sem `ler` em Contato. */
  readonly contatosTotal: number | null;
  /** `null` sem `ler` em Negócio. */
  readonly negociosAbertos: NegociosAbertosDoCrm | null;
  /** Conversas ativas (fora da lixeira) que não estão resolvidas; `null` sem `ler` em Conversa. */
  readonly conversasAbertas: number | null;
}

export type MotivoDoLead = "semContato" | "aguardandoResposta";

export interface LeadAAtenderDoCrm {
  readonly contatoId: string;
  readonly nome: string;
  readonly motivo: MotivoDoLead;
  /** Só em `aguardandoResposta`: a Conversa em que a bola está com a organização. */
  readonly conversaId: string | null;
  /** Desde quando espera: o nascimento do Contato, ou a Mensagem recebida sem resposta (ISO 8601 UTC). */
  readonly desde: string;
}

export interface ContagemDoDia {
  readonly dia: DiaCivil;
  readonly quantidade: number;
}

export interface GanhosDoDia {
  readonly dia: DiaCivil;
  readonly moeda: string;
  readonly quantidade: number;
  /** A soma dos Valores dos Negócios ganhos nesse dia e nessa moeda (Negócio sem Valor soma 0). */
  readonly valor: number;
}

export interface EstatisticasDoCrm {
  readonly desde: string;
  readonly ate: string;
  readonly fuso: string;
  /** Mensagens `enviada` de que o Membro é o Ator, em Conversa fora da lixeira; `null` sem `ler` em Mensagem. */
  readonly mensagensEnviadas: readonly ContagemDoDia[] | null;
  /**
   * Conversas `resolvida` de que o Membro é o Atribuído, pelo momento de resolução. O modelo novo não guarda
   * quem clicou em resolver; `null` sem `ler` em Conversa.
   */
  readonly conversasResolvidas: readonly ContagemDoDia[] | null;
  /** Negócios `ganho` de que o Membro é o Proprietário, pelo momento de encerramento, por dia e moeda; `null` sem `ler` em Negócio. */
  readonly negociosGanhos: readonly GanhosDoDia[] | null;
}

/** Os pedidos de estatística que o domínio sabe recusar sozinho. */
export type ConferenciaDaJanela = { readonly ok: true } | { readonly ok: false; readonly error: string; readonly field: "desde" | "ate" | "fuso" };

const MS_POR_DIA = 86_400_000;

/**
 * Fuso IANA que o Node conhece (`America/Sao_Paulo`, `UTC`, …). Só a lista de nomes entra no SQL, e
 * mesmo assim como parâmetro `$n`, nunca no texto (T-15-47).
 */
export function fusoValido(fuso: string): boolean {
  if (fuso === "UTC") return true;
  return Intl.supportedValuesOf("timeZone").includes(fuso);
}

/**
 * A janela das estatísticas: instantes ISO que existem, `desde` não depois de `ate`, no máximo
 * `JANELA_MAXIMA_DE_ESTATISTICAS_DIAS` dias entre eles e fuso conhecido. A mesma regra vale na rota
 * e no serviço (que também é chamado sem ela).
 */
export function conferirJanelaDeEstatisticas(desde: string, ate: string, fuso: string): ConferenciaDaJanela {
  const inicio = Date.parse(desde);
  const fim = Date.parse(ate);
  if (Number.isNaN(inicio)) return { ok: false, error: "O início da janela não é um instante válido.", field: "desde" };
  if (Number.isNaN(fim)) return { ok: false, error: "O fim da janela não é um instante válido.", field: "ate" };
  if (inicio > fim) return { ok: false, error: "O início da janela não pode ser depois do fim.", field: "desde" };
  if ((fim - inicio) / MS_POR_DIA > JANELA_MAXIMA_DE_ESTATISTICAS_DIAS) {
    return { ok: false, error: `A janela das estatísticas tem no máximo ${JANELA_MAXIMA_DE_ESTATISTICAS_DIAS} dias.`, field: "desde" };
  }
  if (!fusoValido(fuso)) return { ok: false, error: "Fuso horário desconhecido.", field: "fuso" };
  return { ok: true };
}
