/**
 * O Funil do CRM novo e as Etapas dele: o processo pelo qual um Negócio
 * progride. Tipos camelCase dos campos de `plataforma.funis` e
 * `plataforma.etapas` (007), mais as regras que valem dos dois lados da
 * fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10). Funil não tem Proprietário (INV-FUN-11): só `criadoPor`.
 *
 * Comparação de nome: `trim().toLocaleLowerCase("pt-BR")`, a mesma de
 * `lower(btrim(nome))` dos índices `funis_nome_uq` e `etapas_nome_uq` da 007.
 */

import { fail, ok, type OperationResult } from "../state";
import { LIMITES_CRM, type EstadoCrm } from "./comum";

/** O teto de Etapas por Funil: a borda HTTP e a tela respeitam o mesmo número. */
export const LIMITE_DE_ETAPAS_POR_FUNIL = 40;

export interface Funil {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: string | null;
  readonly ordem: number;
  /** O Funil que um Negócio recebe sem Funil explícito (D-13). Só muda por `POST /funis/:id/padrao`. */
  readonly padrao: boolean;
  /** D-10: só gravado; nenhuma visibilidade muda por ele nesta fase. */
  readonly privado: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly estado: EstadoCrm;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface Etapa {
  readonly id: string;
  readonly funilId: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidadePadrao: number;
  readonly cor: string | null;
  readonly descricao: string | null;
  readonly criadoEm: string;
}

export interface NovaEtapa {
  readonly nome: string;
  readonly probabilidadePadrao?: number;
  readonly cor?: string;
  readonly descricao?: string;
}

export interface NovoFunil {
  readonly nome: string;
  readonly descricao?: string;
  readonly cor?: string;
  readonly privado?: boolean;
  readonly exigeMotivoPerda?: boolean;
  readonly exigeValorGanho?: boolean;
  readonly etapas: readonly NovaEtapa[];
}

/** O que se muda num Funil existente. Sem `padrao`: o padrão só muda por `POST /funis/:id/padrao`. */
export interface EdicaoDeFunil {
  readonly nome?: string;
  readonly descricao?: string;
  readonly cor?: string;
  readonly privado?: boolean;
  readonly exigeMotivoPerda?: boolean;
  readonly exigeValorGanho?: boolean;
  readonly ordem?: number;
}

export interface EdicaoDeEtapa {
  readonly nome?: string;
  readonly probabilidadePadrao?: number;
  readonly cor?: string;
  readonly descricao?: string;
}

/** Quantos Negócios referenciam uma Etapa (ou um Funil), em todas as situações e estados. */
export interface ContagemDeNegocios {
  readonly abertos: number;
  readonly ganhos: number;
  readonly perdidos: number;
  readonly arquivados: number;
  readonly naLixeira: number;
  readonly total: number;
}

export type EtapaDetalhada = Etapa & { readonly negocios: ContagemDeNegocios };

/** O que a lista mostra por linha. */
export interface FunilResumo {
  readonly funil: Funil;
  readonly totalEtapas: number;
  readonly negociosAbertos: number;
}

export interface FunilDetalhado {
  readonly funil: Funil;
  readonly etapas: readonly EtapaDetalhada[];
}

/** Etapa de origem → Etapa de destino, por id. */
export type MapeamentoDeEtapas = Readonly<Record<string, string>>;

/** A chave de comparação de nomes: a mesma de `lower(btrim(nome))` da 007. */
export function chaveDeNome(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

export function validarNomeDeFunil(nome: string): OperationResult<void> {
  const aparado = nome.trim();
  if (aparado === "") return fail("O Funil precisa de um nome.", "nome");
  if (aparado.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome do Funil tem no máximo ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  return ok(undefined);
}

/** A probabilidade padrão de uma Etapa: inteiro de 0 a 100 (`etapas_probabilidade_ck`). */
export function validarProbabilidadeDeEtapa(probabilidade: number | undefined): OperationResult<void> {
  if (probabilidade === undefined) return ok(undefined);
  if (!Number.isInteger(probabilidade) || probabilidade < 0 || probabilidade > 100) {
    return fail("A probabilidade da Etapa é um número inteiro de 0 a 100.", "probabilidadePadrao");
  }
  return ok(undefined);
}

/** RN-FUN-03: o nome da Etapa é único no Funil, sem distinguir caixa nem espaços nas pontas. */
export function validarNomeDeEtapa(nome: string, existentes: readonly string[]): OperationResult<void> {
  const aparado = nome.trim();
  if (aparado === "") return fail("A Etapa precisa de um nome.", "nome");
  if (aparado.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome da Etapa tem no máximo ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  const chave = chaveDeNome(aparado);
  if (existentes.some((existente) => chaveDeNome(existente) === chave)) {
    return fail(`Já existe uma Etapa chamada "${aparado}" neste Funil.`, "nome");
  }
  return ok(undefined);
}

/**
 * RN-FUN-04: a criação de um Funil é atômica e leva ao menos uma Etapa. Valida
 * o nome do Funil, a quantidade de Etapas, o nome de cada uma (RN-FUN-03) e a
 * probabilidade de cada uma.
 */
export function validarNovoFunil(entrada: NovoFunil): OperationResult<void> {
  const nome = validarNomeDeFunil(entrada.nome);
  if (!nome.ok) return nome;
  if (entrada.etapas.length === 0) return fail("Um Funil precisa de ao menos uma Etapa.", "etapas");
  if (entrada.etapas.length > LIMITE_DE_ETAPAS_POR_FUNIL) {
    return fail(`Um Funil tem no máximo ${LIMITE_DE_ETAPAS_POR_FUNIL} Etapas.`, "etapas");
  }
  const vistos: string[] = [];
  for (const etapa of entrada.etapas) {
    const nomeDaEtapa = validarNomeDeEtapa(etapa.nome, vistos);
    if (!nomeDaEtapa.ok) return fail(nomeDaEtapa.error, "etapas");
    const probabilidade = validarProbabilidadeDeEtapa(etapa.probabilidadePadrao);
    if (!probabilidade.ok) return fail(probabilidade.error, "etapas");
    vistos.push(etapa.nome);
  }
  return ok(undefined);
}

/** RN-FUN-06: a Etapa inicial é a de menor ordem. */
export function etapaInicial<T extends { readonly ordem: number }>(etapas: readonly T[]): T | undefined {
  let menor: T | undefined;
  for (const etapa of etapas) {
    if (menor === undefined || etapa.ordem < menor.ordem) menor = etapa;
  }
  return menor;
}

/**
 * A nova ordem é uma permutação COMPLETA das Etapas do Funil: nenhuma faltando,
 * nenhuma repetida, nenhuma de fora. É o que permite gravar tudo num `UPDATE` só.
 */
export function validarReordenacao(atuais: readonly string[], novos: readonly string[]): OperationResult<void> {
  const conjunto = new Set(novos);
  if (conjunto.size !== novos.length) return fail("A ordem repete uma Etapa.", "etapaIds");
  if (novos.length !== atuais.length) return fail("A ordem precisa listar todas as Etapas do Funil.", "etapaIds");
  const doFunil = new Set(atuais);
  for (const id of novos) {
    if (!doFunil.has(id)) return fail("A ordem cita uma Etapa que não é deste Funil.", "etapaIds");
  }
  return ok(undefined);
}

/** RN-FUN-04 / INV-FUN-02: nenhum Funil fica sem Etapa. */
export function validarRemocaoDeEtapa(totalDeEtapas: number): OperationResult<void> {
  if (totalDeEtapas <= 1) return fail("Um Funil precisa de ao menos uma Etapa.");
  return ok(undefined);
}

/** RN-FUN-16: o Funil padrão fica `ativo` — não é arquivado nem vai para a lixeira. */
export function validarMudancaDeEstado(funil: { readonly padrao: boolean }, alvo: EstadoCrm): OperationResult<void> {
  if (funil.padrao && alvo !== "ativo") {
    return fail("O Funil padrão não pode ser arquivado nem ir para a lixeira. Defina outro Funil como padrão antes.");
  }
  return ok(undefined);
}

/** RN-FUN-16: o Funil padrão nunca é privado (`funis_padrao_ck`). */
export function validarPrivacidade(funil: { readonly padrao: boolean }, privado: boolean): OperationResult<void> {
  if (funil.padrao && privado) {
    return fail("O Funil padrão não pode ser privado. Defina outro Funil como padrão antes.", "privado");
  }
  return ok(undefined);
}

/**
 * D-13: o primeiro Funil não privado de um Espaço sem padrão nasce padrão; os
 * seguintes nascem sem ser. Um Funil privado nunca nasce padrão.
 */
export function deveNascerPadrao(existePadrao: boolean, privado: boolean): boolean {
  return !existePadrao && !privado;
}

/** O padrão aponta para um Funil `ativo` e não privado (RN-FUN-16). */
export function validarNovoPadrao(funil: { readonly estado: EstadoCrm; readonly privado: boolean }): OperationResult<void> {
  if (funil.estado !== "ativo") return fail("Só um Funil ativo pode ser o padrão.");
  if (funil.privado) return fail("Um Funil privado não pode ser o padrão.");
  return ok(undefined);
}

/**
 * Migrar os Negócios de um Funil para outro (D-07, RN-FUN-12/13/15): o destino
 * é outro Funil `ativo`, e cada Etapa de origem que tem Negócios aponta, por
 * mapeamento explícito, para uma Etapa do destino. Não há mapeamento automático.
 */
export function validarMigracao(entrada: {
  readonly origem: { readonly id: string };
  readonly destino: { readonly id: string; readonly estado: EstadoCrm };
  readonly etapasDoDestino: readonly { readonly id: string }[];
  readonly etapasDeOrigemComNegocios: readonly string[];
  readonly mapeamento: MapeamentoDeEtapas;
}): OperationResult<void> {
  if (entrada.destino.id === entrada.origem.id) {
    return fail("O Funil de destino precisa ser outro Funil.", "paraFunilId");
  }
  if (entrada.destino.estado !== "ativo") {
    return fail("Só um Funil ativo recebe Negócios.", "paraFunilId");
  }
  const doDestino = new Set(entrada.etapasDoDestino.map((etapa) => etapa.id));
  for (const [origem, destino] of Object.entries(entrada.mapeamento)) {
    if (!doDestino.has(destino)) {
      return fail(`A Etapa de destino de "${origem}" não é do Funil de destino.`, "mapeamento");
    }
  }
  for (const etapaId of entrada.etapasDeOrigemComNegocios) {
    if (entrada.mapeamento[etapaId] === undefined) {
      return fail("Escolha a Etapa de destino de cada Etapa que tem Negócios.", "mapeamento");
    }
  }
  return ok(undefined);
}

function negocios(total: number, adjetivo = ""): string {
  const palavra = total === 1 ? "Negócio" : "Negócios";
  const complemento = adjetivo === "" ? "" : ` ${total === 1 ? adjetivo : `${adjetivo}s`}`;
  return `${total} ${palavra}${complemento}`;
}

/** D-07: o Funil com Negócio não vai para a lixeira nem é excluído; a saída é migrar. */
export function fraseFunilComNegocios(total: number): string {
  return `Este Funil ainda tem ${negocios(total)}. Migre os Negócios para outro Funil antes de removê-lo.`;
}

/** D-07: a Etapa com Negócio não é removida; a saída é remapear. */
export function fraseEtapaComNegocios(total: number): string {
  return `Esta Etapa ainda tem ${negocios(total)}. Remapeie os Negócios para outra Etapa antes de removê-la.`;
}

/** RN-FUN-12: arquivar exige que nenhum Negócio aberto o referencie. */
export function fraseFunilComNegociosAbertos(total: number): string {
  return `Este Funil ainda tem ${negocios(total, "aberto")}. Migre os Negócios abertos para outro Funil antes de arquivá-lo.`;
}
