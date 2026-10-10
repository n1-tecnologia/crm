/**
 * O Negócio do CRM novo: a oportunidade comercial. Tipos camelCase dos campos
 * de `plataforma.negocios` (007), mais as regras que valem dos dois lados da
 * fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10). `valor` trafega como texto decimal
 * (`numeric(15,2)` → `valor::text`, nunca `number`) e as datas como
 * `AAAA-MM-DD`.
 */

import { fail, type OperationResult } from "../state";
import type { CivilDate } from "../types/primitives";
import type { EstadoCrm, SituacaoNegocio } from "./comum";

/** Cabe em `numeric(15,2)`: até 13 dígitos inteiros e 2 casas. */
export const VALOR_DECIMAL = /^\d{1,13}(\.\d{1,2})?$/;
/** Código ISO 4217 em maiúsculas (`char(3)`). */
export const MOEDA = /^[A-Z]{3}$/;

export interface Negocio {
  readonly id: string;
  readonly titulo: string;
  readonly objeto: string | null;
  readonly descricao: string | null;
  readonly empresaId: string | null;
  readonly contatoId: string | null;
  readonly funilId: string;
  readonly etapaId: string;
  readonly valor: string | null;
  readonly moeda: string;
  /** Sobrescreve a probabilidade padrão da Etapa; `null` = usa a da Etapa. */
  readonly probabilidade: number | null;
  readonly situacao: SituacaoNegocio;
  readonly motivoPerda: string | null;
  readonly motivoGanho: string | null;
  readonly notaEncerramento: string | null;
  readonly origem: string | null;
  readonly dataPrevistaFechamento: CivilDate | null;
  readonly encerradoEm: string | null;
  readonly estado: EstadoCrm;
  readonly proprietarioId: string;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** O que a lista e o quadro mostram por linha. */
export interface NegocioResumo {
  readonly id: string;
  readonly titulo: string;
  readonly valor: string | null;
  readonly moeda: string;
  readonly probabilidadeEfetiva: number;
  readonly situacao: SituacaoNegocio;
  readonly estado: EstadoCrm;
  readonly funilId: string;
  readonly etapaId: string;
  readonly empresa: { readonly id: string; readonly nome: string } | null;
  readonly contato: { readonly id: string; readonly nome: string } | null;
  readonly proprietarioId: string;
  readonly dataPrevistaFechamento: CivilDate | null;
  readonly encerradoEm: string | null;
  readonly atualizadoEm: string;
}

export interface NegocioDetalhado {
  readonly negocio: Negocio;
  readonly funil: {
    readonly id: string;
    readonly nome: string;
    readonly estado: EstadoCrm;
    readonly exigeMotivoPerda: boolean;
    readonly exigeValorGanho: boolean;
  };
  readonly etapa: { readonly id: string; readonly nome: string; readonly probabilidadePadrao: number };
  readonly etapasDoFunil: readonly { readonly id: string; readonly nome: string; readonly ordem: number }[];
  readonly empresa: { readonly id: string; readonly nome: string; readonly estado: EstadoCrm } | null;
  readonly contato: { readonly id: string; readonly nome: string; readonly estado: EstadoCrm } | null;
  readonly probabilidadeEfetiva: number;
}

/** Empresa OU Contato (`negocios_dono_ck`); sem Funil, o padrão; sem Etapa, a inicial (RN-NEG-03). */
export interface NovoNegocio {
  readonly titulo: string;
  readonly objeto?: string;
  readonly descricao?: string;
  readonly empresaId?: string;
  readonly contatoId?: string;
  readonly funilId?: string;
  readonly etapaId?: string;
  readonly valor?: string;
  readonly moeda?: string;
  readonly probabilidade?: number;
  readonly origem?: string;
  readonly dataPrevistaFechamento?: CivilDate;
  readonly proprietarioId?: string;
}

/**
 * Escalares + troca de dono. `null` limpa; `empresaId`/`contatoId` juntos
 * trocam o dono (`{ empresaId: "e1", contatoId: null }`). Funil, Etapa e
 * situação NÃO são editáveis aqui: mudam por `mover`/`ganhar`/`perder`/`reabrir`.
 */
export interface EdicaoDeNegocio {
  readonly titulo?: string;
  readonly objeto?: string | null;
  readonly descricao?: string | null;
  readonly empresaId?: string | null;
  readonly contatoId?: string | null;
  readonly valor?: string | null;
  readonly moeda?: string;
  readonly probabilidade?: number | null;
  readonly origem?: string | null;
  readonly dataPrevistaFechamento?: CivilDate | null;
  readonly proprietarioId?: string;
}

export interface Movimento {
  readonly etapaId: string;
  readonly funilId?: string;
}

export interface Ganho {
  readonly valor?: string;
  readonly motivoGanho?: string;
  readonly notaEncerramento?: string;
}

export interface Perda {
  readonly motivoPerda?: string;
  readonly notaEncerramento?: string;
}

export interface Reabertura {
  readonly etapaId?: string;
  readonly funilId?: string;
}

/** O Funil, no que as Regras de encerramento e o destino precisam. */
export interface FunilDeNegocio {
  readonly id: string;
  readonly estado: EstadoCrm;
  readonly exigeMotivoPerda?: boolean;
  readonly exigeValorGanho?: boolean;
}

export function validarValor(_valor: string): OperationResult<void> {
  return fail("pendente");
}

export function validarNovoNegocio(_entrada: NovoNegocio): OperationResult<void> {
  return fail("pendente");
}

export function validarEdicao(
  _negocio: Pick<Negocio, "estado" | "empresaId" | "contatoId">,
  _edicao: EdicaoDeNegocio,
): OperationResult<void> {
  return fail("pendente");
}

export function validarMovimento(_entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado" | "funilId">;
  readonly funilDestino: FunilDeNegocio;
  readonly etapaDestino?: { readonly id: string; readonly funilId: string } | undefined;
}): OperationResult<void> {
  return fail("pendente");
}

export function validarGanho(_entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado" | "valor">;
  readonly funil: Pick<FunilDeNegocio, "exigeValorGanho">;
  readonly entrada: Ganho;
}): OperationResult<void> {
  return fail("pendente");
}

export function validarPerda(_entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado">;
  readonly funil: Pick<FunilDeNegocio, "exigeMotivoPerda">;
  readonly entrada: Perda;
}): OperationResult<void> {
  return fail("pendente");
}

export function validarReabertura(_entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado">;
  readonly funil: Pick<FunilDeNegocio, "estado">;
  readonly destino?: { readonly funil: FunilDeNegocio; readonly etapa: { readonly id: string; readonly funilId: string } } | undefined;
}): OperationResult<void> {
  return fail("pendente");
}

export function probabilidadeEfetiva(
  _negocio: Pick<Negocio, "situacao" | "probabilidade">,
  _etapa: { readonly probabilidadePadrao: number },
): number {
  return -1;
}

export function valorPonderado(_valor: string | null, _probabilidade: number): number {
  return -1;
}
