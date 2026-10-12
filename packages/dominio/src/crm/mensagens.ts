/**
 * A Mensagem do CRM novo — esqueleto do passo RED (08-05, Task 2). Os tipos e as
 * constantes já são os definitivos; as funções ainda não decidem nada.
 */

import type { OperationResult } from "../state";
import type { ConexaoDoCanal } from "./canais";

export const DIRECOES_DA_MENSAGEM = ["recebida", "enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];
export type DirecaoDaMensagem = "recebida" | "enviada" | "interna";

export const DIRECOES_DE_ENVIO = ["enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];

export const STATUS_DE_ENTREGA = [
  "pendente",
  "enviada",
  "entregue",
  "lida",
  "falhou",
] as const satisfies readonly StatusDeEntrega[];
export type StatusDeEntrega = "pendente" | "enviada" | "entregue" | "lida" | "falhou";

export const TIPOS_DE_ATOR_DA_MENSAGEM = [
  "member",
  "agent",
  "automation",
  "integration",
  "system",
] as const satisfies readonly TipoDeAtorDaMensagem[];
export type TipoDeAtorDaMensagem = "member" | "agent" | "automation" | "integration" | "system";

export interface AtorDaMensagem {
  readonly tipo: TipoDeAtorDaMensagem;
  readonly id: string;
}

export interface AnexoDaMensagem {
  readonly tipoDeMidia: string;
  readonly nome: string;
  readonly referenciaExterna?: string;
}

export interface EnderecoAdicional {
  readonly tipo: "para" | "copia" | "copiaOculta";
  readonly endereco: string;
  readonly nomeExibido?: string;
}

export interface Mensagem {
  readonly id: string;
  readonly conversaId: string;
  readonly canalId: string;
  readonly seq: number;
  readonly direcao: DirecaoDaMensagem;
  readonly ator: AtorDaMensagem;
  readonly delegante: AtorDaMensagem | null;
  readonly remetenteParticipanteId: string | null;
  readonly identificadorId: string | null;
  readonly remetenteExterno: string | null;
  readonly conteudo: string | null;
  readonly anexos: readonly AnexoDaMensagem[];
  readonly assunto: string | null;
  readonly enderecosAdicionais: readonly EnderecoAdicional[];
  readonly emRespostaAId: string | null;
  readonly modeloUsado: { readonly idNoProvedor: string; readonly nome: string } | null;
  readonly idExterno: string | null;
  readonly statusEntrega: StatusDeEntrega | null;
  readonly statusEntregaEm: string | null;
  readonly motivoFalha: string | null;
  readonly leiturasInternas: readonly unknown[];
  readonly reacoes: readonly unknown[];
  readonly marcacaoExclusao: unknown | null;
  readonly edicoesExternas: readonly unknown[];
  readonly anonimizada: boolean;
  readonly criadoEm: string;
  readonly registradoEm: string;
}

export interface NovaMensagem {
  readonly conversaId: string;
  readonly direcao: "enviada" | "interna";
  readonly conteudo: string;
  readonly emRespostaAId?: string;
}

export interface MensagemRecebidaDoProvedor {
  readonly conversaId: string;
  readonly idExterno: string;
  readonly criadoEm: string;
  readonly conteudo?: string;
  readonly anexos?: readonly AnexoDaMensagem[];
  readonly assunto?: string;
  readonly enderecosAdicionais?: readonly EnderecoAdicional[];
  readonly remetenteExterno?: string;
  readonly identificadorId?: string;
  readonly cargaBruta: unknown;
}

export function validarNovaMensagem(_entrada: NovaMensagem): OperationResult<NovaMensagem> {
  throw new Error("validarNovaMensagem: ainda não implementada");
}

export interface EntradaDeEnvio {
  readonly capacidades: {
    readonly responseWindowHours?: number;
    readonly requiresTemplateOutsideWindow: boolean;
  };
  readonly ultimaRecebidaEm: string | null;
  readonly agora: number;
  readonly modeloId?: string;
  readonly modelosAprovados: readonly string[];
}

export function validarEnvio(_entrada: EntradaDeEnvio): OperationResult<void> {
  throw new Error("validarEnvio: ainda não implementada");
}

export function statusInicialDeEnvio(_conexao: ConexaoDoCanal): StatusDeEntrega {
  throw new Error("statusInicialDeEnvio: ainda não implementada");
}
