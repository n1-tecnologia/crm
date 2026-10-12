/**
 * A Conversa do CRM novo — esqueleto do passo RED (08-05, Task 1). Os tipos e as
 * constantes já são os definitivos; as funções ainda não decidem nada.
 */

import type { OperationResult } from "../state";
import type { TipoComProvedor } from "../provedores-de-canal";
import type { Canal } from "./canais";
import type { TipoIdentificadorContato } from "./contatos";

export const SITUACOES_DA_CONVERSA = ["aberta", "pendente", "resolvida"] as const satisfies readonly SituacaoDaConversa[];
export type SituacaoDaConversa = "aberta" | "pendente" | "resolvida";

export const ESTADOS_DA_CONVERSA = ["ativo", "na_lixeira"] as const satisfies readonly EstadoDaConversa[];
export type EstadoDaConversa = "ativo" | "na_lixeira";

export interface ParticipanteDaConversa {
  readonly id: string;
  readonly sujeito: { readonly tipo: "contato" | "membro" | "agente"; readonly id: string };
  readonly papel: "contato" | "atendente" | "agente" | "observador";
  readonly principal: boolean;
  readonly entrouEm: string;
  readonly saiuEm: string | null;
}

export interface Conversa {
  readonly id: string;
  readonly canalId: string;
  readonly contatoId: string;
  readonly titulo: string;
  readonly tituloEditado: boolean;
  readonly situacao: SituacaoDaConversa;
  readonly estado: EstadoDaConversa;
  readonly filaId: string | null;
  readonly atribuido: { readonly tipo: "membro" | "agente"; readonly id: string } | null;
  readonly adiadaAte: string | null;
  readonly adiamentoMotivo: string | null;
  readonly participantes: readonly ParticipanteDaConversa[];
  readonly resolvidaEm: string | null;
  readonly reabertaEm: string | null;
  readonly reaberturas: number;
  readonly criadoPor: { readonly tipo: string; readonly id: string };
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface ConversaDetalhada {
  readonly conversa: Conversa;
  readonly canal: Pick<Canal, "id" | "nome" | "tipo" | "provedor" | "conexao" | "conexaoSimulada">;
}

export interface NovaConversa {
  readonly canalId: string;
  readonly contatoId: string;
  readonly mensagem: { readonly conteudo: string };
}

export interface FiltroDeConversas {
  readonly estado: EstadoDaConversa;
  readonly limite: number;
  readonly deslocamento: number;
  readonly canalId?: string;
  readonly contatoId?: string;
  readonly situacao?: SituacaoDaConversa;
}

export const TIPO_DE_IDENTIFICADOR_DO_CANAL: Readonly<Record<TipoComProvedor, TipoIdentificadorContato>> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  email: "email",
};

export function validarNovaConversa(_entrada: NovaConversa): OperationResult<NovaConversa> {
  throw new Error("validarNovaConversa: ainda não implementada");
}

export type AcaoDeSituacao = "resolver" | "reabrir";

export function proximaSituacao(
  _conversa: Pick<Conversa, "situacao" | "estado">,
  _acao: AcaoDeSituacao,
): OperationResult<{ readonly situacao: SituacaoDaConversa }> {
  throw new Error("proximaSituacao: ainda não implementada");
}

export function tituloDaConversa(
  _contato: { readonly nome: string | null; readonly sobrenome: string | null },
  _identificadorExibido: string,
): string {
  throw new Error("tituloDaConversa: ainda não implementada");
}
