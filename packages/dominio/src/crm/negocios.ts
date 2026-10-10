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

import { fail, ok, type OperationResult } from "../state";
import type { CivilDate } from "../types/primitives";
import { LIMITES_CRM, type EstadoCrm, type SituacaoNegocio } from "./comum";

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

const FRASE_DONO = "Um Negócio é de uma Empresa ou de um Contato.";

/** `numeric(15,2)` não negativo, escrito com ponto (`1234.5`); vírgula, sinal e excesso de dígitos não valem. */
export function validarValor(valor: string): OperationResult<void> {
  if (!VALOR_DECIMAL.test(valor)) {
    return fail("O valor é um número com até 2 casas decimais, escrito com ponto (ex.: 1234.50).", "valor");
  }
  return ok(undefined);
}

function validarTitulo(titulo: string): OperationResult<void> {
  const aparado = titulo.trim();
  if (aparado === "") return fail("O Negócio precisa de um título.", "titulo");
  if (aparado.length > LIMITES_CRM.textoCurto) {
    return fail(`O título do Negócio tem no máximo ${LIMITES_CRM.textoCurto} caracteres.`, "titulo");
  }
  return ok(undefined);
}

function validarMoeda(moeda: string): OperationResult<void> {
  if (!MOEDA.test(moeda)) return fail("A moeda é um código de 3 letras maiúsculas (ex.: BRL).", "moeda");
  return ok(undefined);
}

/** Inteiro de 0 a 100 (`negocios_probabilidade_ck`). */
function validarProbabilidade(probabilidade: number): OperationResult<void> {
  if (!Number.isInteger(probabilidade) || probabilidade < 0 || probabilidade > 100) {
    return fail("A probabilidade é um número inteiro de 0 a 100.", "probabilidade");
  }
  return ok(undefined);
}

/** `AAAA-MM-DD` de um dia que existe. */
function validarDataPrevista(data: string): OperationResult<void> {
  const [ano, mes, dia] = data.split("-").map(Number);
  const calendario = new Date(Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1));
  const existe =
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    calendario.getUTCFullYear() === ano &&
    calendario.getUTCMonth() === (mes ?? 1) - 1 &&
    calendario.getUTCDate() === dia;
  if (!existe) return fail("Use uma data válida no formato AAAA-MM-DD.", "dataPrevistaFechamento");
  return ok(undefined);
}

function validarEscalares(entrada: {
  readonly valor?: string | null | undefined;
  readonly moeda?: string | undefined;
  readonly probabilidade?: number | null | undefined;
  readonly dataPrevistaFechamento?: string | null | undefined;
}): OperationResult<void> {
  if (entrada.valor !== undefined && entrada.valor !== null) {
    const valor = validarValor(entrada.valor);
    if (!valor.ok) return valor;
  }
  if (entrada.moeda !== undefined) {
    const moeda = validarMoeda(entrada.moeda);
    if (!moeda.ok) return moeda;
  }
  if (entrada.probabilidade !== undefined && entrada.probabilidade !== null) {
    const probabilidade = validarProbabilidade(entrada.probabilidade);
    if (!probabilidade.ok) return probabilidade;
  }
  if (entrada.dataPrevistaFechamento !== undefined && entrada.dataPrevistaFechamento !== null) {
    const data = validarDataPrevista(entrada.dataPrevistaFechamento);
    if (!data.ok) return data;
  }
  return ok(undefined);
}

/** `negocios_dono_ck`: exatamente um entre Empresa e Contato. */
function validarDono(empresaId: string | null | undefined, contatoId: string | null | undefined): OperationResult<void> {
  const temEmpresa = empresaId !== undefined && empresaId !== null;
  const temContato = contatoId !== undefined && contatoId !== null;
  if (temEmpresa === temContato) return fail(FRASE_DONO);
  return ok(undefined);
}

/** Título, Empresa OU Contato, valor, moeda e probabilidade. Funil e Etapa a service resolve (RN-NEG-03). */
export function validarNovoNegocio(entrada: NovoNegocio): OperationResult<void> {
  const titulo = validarTitulo(entrada.titulo);
  if (!titulo.ok) return titulo;
  const dono = validarDono(entrada.empresaId, entrada.contatoId);
  if (!dono.ok) return dono;
  return validarEscalares(entrada);
}

/** RN-NEG-16: só Negócio `ativo` se edita; a troca de dono não pode deixar os dois (ou nenhum). */
export function validarEdicao(
  negocio: Pick<Negocio, "estado" | "empresaId" | "contatoId">,
  edicao: EdicaoDeNegocio,
): OperationResult<void> {
  if (negocio.estado !== "ativo") {
    return fail(
      negocio.estado === "arquivado"
        ? "Um Negócio arquivado é somente leitura. Restaure-o antes de editar (RN-NEG-16)."
        : "Restaure o Negócio da lixeira antes de editar.",
    );
  }
  if (edicao.titulo !== undefined) {
    const titulo = validarTitulo(edicao.titulo);
    if (!titulo.ok) return titulo;
  }
  const escalares = validarEscalares(edicao);
  if (!escalares.ok) return escalares;
  const empresaFinal = edicao.empresaId !== undefined ? edicao.empresaId : negocio.empresaId;
  const contatoFinal = edicao.contatoId !== undefined ? edicao.contatoId : negocio.contatoId;
  return validarDono(empresaFinal, contatoFinal);
}

function exigirAbertoEAtivo(negocio: Pick<Negocio, "situacao" | "estado">, acao: string): OperationResult<void> {
  if (negocio.estado !== "ativo") {
    return fail(`Só um Negócio ativo pode ser ${acao}. Restaure-o antes (RN-NEG-16).`);
  }
  if (negocio.situacao !== "aberto") {
    return fail(`Só um Negócio aberto pode ser ${acao}. Reabra-o antes (RN-NEG-04).`);
  }
  return ok(undefined);
}

/**
 * Mover de Etapa (e, se for o caso, de Funil): Negócio `aberto` e `ativo`
 * (RN-NEG-04/16), Funil de destino `ativo` (RN-FUN-14), Etapa do Funil de
 * destino (INV-FUN-06) e, para trocar de Funil, Etapa explícita (RN-FUN-15).
 */
export function validarMovimento(entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado" | "funilId">;
  readonly funilDestino: FunilDeNegocio;
  readonly etapaDestino?: { readonly id: string; readonly funilId: string } | undefined;
}): OperationResult<void> {
  const aberto = exigirAbertoEAtivo(entrada.negocio, "movido de Etapa");
  if (!aberto.ok) return aberto;
  if (entrada.funilDestino.estado !== "ativo") {
    return fail("Um Funil arquivado ou na lixeira não recebe Negócios (RN-FUN-14).", "funilId");
  }
  if (entrada.etapaDestino === undefined) {
    const trocaDeFunil = entrada.funilDestino.id !== entrada.negocio.funilId;
    return fail(
      trocaDeFunil ? "Para trocar de Funil, escolha a Etapa de destino (RN-FUN-15)." : "Escolha a Etapa de destino.",
      "etapaId",
    );
  }
  if (entrada.etapaDestino.funilId !== entrada.funilDestino.id) {
    return fail("A Etapa de destino não é deste Funil (INV-FUN-06).", "etapaId");
  }
  return ok(undefined);
}

/**
 * Ganhar (RN-NEG-09): Negócio `aberto` e `ativo`; com a Regra "exigir valor"
 * do Funil, o valor efetivo (o da entrada, senão o do Negócio) é maior que zero.
 */
export function validarGanho(entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado" | "valor">;
  readonly funil: Pick<FunilDeNegocio, "exigeValorGanho">;
  readonly entrada: Ganho;
}): OperationResult<void> {
  const aberto = exigirAbertoEAtivo(entrada.negocio, "marcado como ganho");
  if (!aberto.ok) return aberto;
  if (entrada.entrada.valor !== undefined) {
    const valor = validarValor(entrada.entrada.valor);
    if (!valor.ok) return valor;
  }
  if (entrada.funil.exigeValorGanho) {
    const efetivo = entrada.entrada.valor ?? entrada.negocio.valor;
    if (efetivo === null || efetivo === undefined || !(Number(efetivo) > 0)) {
      return fail("Este Funil exige um valor maior que zero para marcar o Negócio como ganho.", "valor");
    }
  }
  return ok(undefined);
}

/** Perder (RN-NEG-09): Negócio `aberto` e `ativo`; com a Regra "exigir Motivo de Perda", motivo não vazio. */
export function validarPerda(entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado">;
  readonly funil: Pick<FunilDeNegocio, "exigeMotivoPerda">;
  readonly entrada: Perda;
}): OperationResult<void> {
  const aberto = exigirAbertoEAtivo(entrada.negocio, "marcado como perdido");
  if (!aberto.ok) return aberto;
  if (entrada.funil.exigeMotivoPerda && (entrada.entrada.motivoPerda ?? "").trim() === "") {
    return fail("Este Funil exige o motivo da perda para marcar o Negócio como perdido.", "motivoPerda");
  }
  return ok(undefined);
}

/**
 * Reabrir (RN-NEG-10/11): Negócio encerrado e `ativo`. Se o Funil dele está
 * `arquivado` (ou na lixeira), tem de vir um destino `ativo` com Etapa dele
 * (RN-FUN-14). Quem pode reabrir `ganho` é do Papel (`podeNoCrm`), não daqui.
 */
export function validarReabertura(entrada: {
  readonly negocio: Pick<Negocio, "situacao" | "estado">;
  readonly funil: Pick<FunilDeNegocio, "estado">;
  readonly destino?: { readonly funil: FunilDeNegocio; readonly etapa: { readonly id: string; readonly funilId: string } } | undefined;
}): OperationResult<void> {
  if (entrada.negocio.estado !== "ativo") {
    return fail("Só um Negócio ativo pode ser reaberto. Restaure-o antes (RN-NEG-16).");
  }
  if (entrada.negocio.situacao === "aberto") return fail("O Negócio já está aberto.");
  if (entrada.destino === undefined) {
    if (entrada.funil.estado !== "ativo") {
      return fail("O Funil deste Negócio está arquivado. Escolha um Funil ativo e uma Etapa para reabri-lo (RN-FUN-14).", "funilId");
    }
    return ok(undefined);
  }
  if (entrada.destino.funil.estado !== "ativo") {
    return fail("Um Funil arquivado ou na lixeira não recebe Negócios (RN-FUN-14).", "funilId");
  }
  if (entrada.destino.etapa.funilId !== entrada.destino.funil.id) {
    return fail("A Etapa de destino não é deste Funil (INV-FUN-06).", "etapaId");
  }
  return ok(undefined);
}

/** INV-NEG-09: `ganho` é 100, `perdido` é 0, `aberto` é a sobrescrita ou, sem ela, a padrão da Etapa. Derivada, nunca gravada. */
export function probabilidadeEfetiva(
  negocio: Pick<Negocio, "situacao" | "probabilidade">,
  etapa: { readonly probabilidadePadrao: number },
): number {
  if (negocio.situacao === "ganho") return 100;
  if (negocio.situacao === "perdido") return 0;
  return negocio.probabilidade ?? etapa.probabilidadePadrao;
}

/** `valor × probabilidade / 100`, em centavos para não acumular erro de ponto flutuante. Sem valor, 0. */
export function valorPonderado(valor: string | null, probabilidade: number): number {
  if (valor === null) return 0;
  const centavos = Math.round(Number(valor) * 100);
  return Math.round((centavos * probabilidade) / 100) / 100;
}
