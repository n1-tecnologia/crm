/**
 * O consentimento do Contato (3.2.4): quem consentiu em receber o quê, por qual
 * tipo de Canal, e quando. Tipos camelCase dos campos de
 * `plataforma.contato_consentimentos` (011), mais as regras que valem dos dois
 * lados da fronteira.
 *
 * ESQUELETO do RED (14-08): os tipos e as constantes já são os definitivos; as
 * três funções ainda não têm a regra.
 */

import { ok, type OperationResult } from "../state";
import type { TipoComProvedor } from "../provedores-de-canal";

export const DECISOES_DE_CONSENTIMENTO = ["concedido", "revogado"] as const;
export type DecisaoDeConsentimento = (typeof DECISOES_DE_CONSENTIMENTO)[number];

export const ORIGENS_DE_CONSENTIMENTO = ["mensagem", "formulario", "verbal", "importacao", "automacao"] as const;
export type OrigemDeConsentimento = (typeof ORIGENS_DE_CONSENTIMENTO)[number];

export const TIPOS_DE_CANAL_DO_CONSENTIMENTO = ["whatsapp", "instagram", "email", "todos"] as const;
export type TipoDeCanalDoConsentimento = (typeof TIPOS_DE_CANAL_DO_CONSENTIMENTO)[number];

export interface ConsentimentoDoContato {
  readonly id: string;
  readonly contatoId: string;
  readonly finalidadeId: string;
  readonly tipoDeCanal: TipoDeCanalDoConsentimento;
  readonly decisao: DecisaoDeConsentimento;
  readonly em: string;
  readonly origem: OrigemDeConsentimento;
  readonly evidenciaMensagemId: string | null;
  readonly registradoPor: string;
  readonly registradoEm: string;
}

export interface NovoConsentimento {
  readonly finalidadeId: string;
  readonly tipoDeCanal: TipoDeCanalDoConsentimento;
  readonly decisao: DecisaoDeConsentimento;
  readonly origem: OrigemDeConsentimento;
  readonly em?: string;
  readonly evidenciaMensagemId?: string;
}

export function validarNovoConsentimento(entrada: NovoConsentimento, _agoraIso: string): OperationResult<NovoConsentimento> {
  return ok(entrada);
}

export function consentimentoVigente(
  _registros: readonly ConsentimentoDoContato[],
  _finalidadeId: string,
  _tipoDeCanal: TipoComProvedor,
): ConsentimentoDoContato | undefined {
  return undefined;
}

export function recusaPorFaltaDeConsentimento(_entrada: {
  readonly categoriaDoModelo: string | undefined;
  readonly registros: readonly ConsentimentoDoContato[];
  readonly finalidadeDeMarketingId: string | undefined;
  readonly tipoDoCanal: TipoComProvedor;
}): string | undefined {
  return undefined;
}
