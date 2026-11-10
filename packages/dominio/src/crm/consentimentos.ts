/**
 * O consentimento do Contato (3.2.4): quem consentiu em receber o quê, por qual
 * tipo de Canal, e quando. Tipos camelCase dos campos de
 * `plataforma.contato_consentimentos` (011), mais as regras que valem dos dois
 * lados da fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * O histórico é só inserção (RN de consentimento da ontologia): revogar é
 * registrar um `revogado`, nunca editar nem apagar o `concedido`. O valor de
 * agora, por finalidade e tipo de Canal, é DERIVADO do histórico por
 * `consentimentoVigente`; nenhuma coluna guarda "o consentimento atual".
 *
 * `recusaPorFaltaDeConsentimento` repete, sobre as linhas novas, a conta de
 * `marketingConsentMissing` (`derive.ts`, modelo antigo): o vigente de
 * marketing para o tipo do Canal não ser `concedido` barra o modelo de
 * marketing. Quem aplica a recusa é o envio de Mensagem; este módulo só diz
 * se recusa e com que frase.
 *
 * Os valores discretos abaixo são cópia literal da 011:
 *   - `DecisaoDeConsentimento`      → `contato_consentimentos_decisao_ck`
 *   - `OrigemDeConsentimento`       → `contato_consentimentos_origem_ck`
 *   - `TipoDeCanalDoConsentimento`  → `contato_consentimentos_canal_ck`
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço vem da sessão.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/consentimentos`.
 */

import { fail, ok, type OperationResult } from "../state";
import type { TipoComProvedor } from "../provedores-de-canal";

export const DECISOES_DE_CONSENTIMENTO = ["concedido", "revogado"] as const;
export type DecisaoDeConsentimento = (typeof DECISOES_DE_CONSENTIMENTO)[number];

export const ORIGENS_DE_CONSENTIMENTO = ["mensagem", "formulario", "verbal", "importacao", "automacao"] as const;
export type OrigemDeConsentimento = (typeof ORIGENS_DE_CONSENTIMENTO)[number];

/** `todos` vale para qualquer tipo de Canal; os outros três valem só para o próprio tipo. */
export const TIPOS_DE_CANAL_DO_CONSENTIMENTO = ["whatsapp", "instagram", "email", "todos"] as const;
export type TipoDeCanalDoConsentimento = (typeof TIPOS_DE_CANAL_DO_CONSENTIMENTO)[number];

/** Uma linha do histórico de consentimento do Contato. */
export interface ConsentimentoDoContato {
  readonly id: string;
  readonly contatoId: string;
  /** Item `finalidadeConsentimento` do Catálogo do Espaço. */
  readonly finalidadeId: string;
  readonly tipoDeCanal: TipoDeCanalDoConsentimento;
  readonly decisao: DecisaoDeConsentimento;
  /** Quando a decisão valeu (ISO 8601); pode ser anterior a `registradoEm` (ex.: importação). */
  readonly em: string;
  readonly origem: OrigemDeConsentimento;
  /** A Mensagem que prova a decisão, quando a origem é uma conversa. */
  readonly evidenciaMensagemId: string | null;
  /** O Membro da sessão que registrou: nunca um campo de quem escreve. */
  readonly registradoPor: string;
  readonly registradoEm: string;
}

/** O que o Membro informa. `registradoPor` e `registradoEm` não estão aqui de propósito. */
export interface NovoConsentimento {
  readonly finalidadeId: string;
  readonly tipoDeCanal: TipoDeCanalDoConsentimento;
  readonly decisao: DecisaoDeConsentimento;
  readonly origem: OrigemDeConsentimento;
  /** Ausente: o banco grava agora. */
  readonly em?: string;
  readonly evidenciaMensagemId?: string;
}

/**
 * Folga para o relógio da tela estar adiantado em relação ao servidor: quem
 * registra "agora" não pode tomar 400 por alguns segundos de diferença.
 */
const FOLGA_DE_RELOGIO_MS = 5 * 60_000;

/**
 * A forma do consentimento novo: finalidade preenchida, vocabulários do banco e
 * `em` que seja um instante que não está no futuro (`campo: "em"`). Que a
 * finalidade exista no Catálogo e que a evidência seja do Contato, o domínio
 * não sabe: é do serviço.
 */
export function validarNovoConsentimento(entrada: NovoConsentimento, agoraIso: string): OperationResult<NovoConsentimento> {
  const finalidadeId = entrada.finalidadeId.trim();
  if (finalidadeId === "") return fail("Escolha a finalidade do consentimento.", "finalidadeId");
  if (!(TIPOS_DE_CANAL_DO_CONSENTIMENTO as readonly string[]).includes(entrada.tipoDeCanal)) {
    return fail("Escolha o tipo de Canal do consentimento.", "tipoDeCanal");
  }
  if (!(DECISOES_DE_CONSENTIMENTO as readonly string[]).includes(entrada.decisao)) {
    return fail("A decisão é concedido ou revogado.", "decisao");
  }
  if (!(ORIGENS_DE_CONSENTIMENTO as readonly string[]).includes(entrada.origem)) {
    return fail("Informe de onde veio o consentimento.", "origem");
  }
  if (entrada.em !== undefined) {
    const em = Date.parse(entrada.em);
    if (Number.isNaN(em)) return fail("Informe a data e a hora do consentimento.", "em");
    if (em > Date.parse(agoraIso) + FOLGA_DE_RELOGIO_MS) return fail("O consentimento não pode ser de uma data futura.", "em");
  }
  return ok({ ...entrada, finalidadeId });
}

/**
 * O consentimento que vale agora: o registro mais recente (por `em`) da
 * finalidade para o tipo do Canal OU para `todos`. No empate de `em`, vale o
 * registrado depois (`registradoEm`). `undefined` quando nunca houve decisão.
 */
export function consentimentoVigente(
  registros: readonly ConsentimentoDoContato[],
  finalidadeId: string,
  tipoDeCanal: TipoComProvedor,
): ConsentimentoDoContato | undefined {
  let vigente: ConsentimentoDoContato | undefined;
  for (const registro of registros) {
    if (registro.finalidadeId !== finalidadeId) continue;
    if (registro.tipoDeCanal !== "todos" && registro.tipoDeCanal !== tipoDeCanal) continue;
    if (vigente === undefined || maisRecente(registro, vigente)) vigente = registro;
  }
  return vigente;
}

function maisRecente(a: ConsentimentoDoContato, b: ConsentimentoDoContato): boolean {
  const porEm = Date.parse(a.em) - Date.parse(b.em);
  if (porEm !== 0) return porEm > 0;
  return Date.parse(a.registradoEm) > Date.parse(b.registradoEm);
}

/** A frase que o envio devolve quando o modelo de marketing não tem consentimento. */
const SEM_CONSENTIMENTO_DE_MARKETING = "Este Contato não consentiu receber marketing por este Canal.";

/**
 * `undefined` quando o envio pode seguir; a frase quando não. Só o modelo de
 * categoria `marketing` passa pela regra; sem categoria (texto livre, ou ainda
 * sem modelos) e as demais categorias seguem. Sem a finalidade de marketing no
 * Catálogo não há como provar consentimento, e a conta recusa — a mesma de
 * `marketingConsentMissing`.
 */
export function recusaPorFaltaDeConsentimento(entrada: {
  readonly categoriaDoModelo: string | undefined;
  readonly registros: readonly ConsentimentoDoContato[];
  readonly finalidadeDeMarketingId: string | undefined;
  readonly tipoDoCanal: TipoComProvedor;
}): string | undefined {
  if (entrada.categoriaDoModelo !== "marketing") return undefined;
  const vigente =
    entrada.finalidadeDeMarketingId === undefined
      ? undefined
      : consentimentoVigente(entrada.registros, entrada.finalidadeDeMarketingId, entrada.tipoDoCanal);
  return vigente?.decisao === "concedido" ? undefined : SEM_CONSENTIMENTO_DE_MARKETING;
}
