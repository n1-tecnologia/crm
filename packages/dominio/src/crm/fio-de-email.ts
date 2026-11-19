/**
 * O fio do e-mail (D-17-14, D-17-16). Só a assinatura: a regra vem no GREEN.
 */

export interface CabecalhosDoFio {
  readonly inReplyTo: readonly string[];
  readonly references: readonly string[];
  readonly assunto?: string | undefined;
}

export interface MensagemDoFio {
  readonly mensagemId: string;
  readonly conversaId: string;
}

export const MAX_REFERENCIAS_RECEBIDAS = 50;
export const MAX_REFERENCIAS_NA_SAIDA = 20;

export function idLimpo(_valor: string | null | undefined): string | undefined {
  return "";
}

export function idsDoCabecalho(_valor: string | null | undefined): string[] {
  return [];
}

export async function mensagemRespondida(
  _cabecalhos: CabecalhosDoFio,
  _buscarPorIdExterno: (idExterno: string) => Promise<MensagemDoFio | null | undefined>,
): Promise<MensagemDoFio | undefined> {
  return { mensagemId: "", conversaId: "" };
}

export function cabecalhosDaResposta(_entrada: { idsDoFio: readonly string[]; respondida?: string | undefined }): {
  inReplyTo?: string;
  references: readonly string[];
} {
  return { inReplyTo: "", references: [""] };
}

export function assuntoDaResposta(_assunto: string | null | undefined): string {
  return "?";
}

export function messageIdDaMensagem(_mensagemId: string, _enderecoDoCanal: string): string {
  return "";
}
