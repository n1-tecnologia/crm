/**
 * O que é comum aos quatro agregados do CRM novo (Contato, Empresa, Funil e
 * Negócio): estados, situações, endereço, campos adicionais, página e limites.
 *
 * Este módulo espelha `apps/api/migracoes/007-crm.sql` e convive com o modelo
 * inglês de `types/crm.ts` até a fase de unificação (D-01). Os valores
 * discretos abaixo são cópia literal da 007 — quem mudar um, muda o outro no
 * mesmo commit:
 *
 *   - `EstadoCrm`        → `contatos_estado_ck` (007:69)
 *   - `ModoDeCriacao`    → `contatos_modo_criacao_ck` (007:70-71)
 *   - `SituacaoNegocio`  → `negocios_situacao_ck` (007:404)
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/comum`.
 */

import { ok, type OperationResult } from "../state";

/** Ciclo de vida de um registro do CRM (007:69). `na_lixeira` volta; apagar de vez é outro ato. */
export const ESTADOS_CRM = ["ativo", "arquivado", "na_lixeira"] as const satisfies readonly EstadoCrm[];
export type EstadoCrm = "ativo" | "arquivado" | "na_lixeira";

/** De onde o Contato nasceu (007:70-71). */
export const MODOS_DE_CRIACAO = [
  "manual",
  "importacao",
  "automatico_mensagem",
  "automatico_automacao",
] as const satisfies readonly ModoDeCriacao[];
export type ModoDeCriacao = "manual" | "importacao" | "automatico_mensagem" | "automatico_automacao";

/** Em que pé está um Negócio (007:404). */
export const SITUACOES_NEGOCIO = ["aberto", "ganho", "perdido"] as const satisfies readonly SituacaoNegocio[];
export type SituacaoNegocio = "aberto" | "ganho" | "perdido";

export type RotuloDeEndereco = "residencial" | "comercial" | "outro";

/** Objeto de valor 0..N de Contato e Empresa (ontologia de contatos, 7.3). Sem identidade. */
export interface Endereco {
  readonly rotulo: RotuloDeEndereco;
  readonly logradouro?: string;
  readonly numero?: string;
  readonly complemento?: string;
  readonly bairro?: string;
  readonly cidade?: string;
  readonly estado?: string;
  readonly pais?: string;
  readonly codigoPostal?: string;
  readonly principal: boolean;
}

export type ValorDeCampoAdicional = string | number | boolean;

/** Chave → valor livres que o usuário cria à vontade (`{ "signo": "leão" }`). */
export type CamposAdicionais = Readonly<Record<string, ValorDeCampoAdicional>>;

/** Uma página de uma lista; `total` é o de todas as páginas. */
export interface Pagina<T> {
  readonly itens: readonly T[];
  readonly total: number;
}

/**
 * O que impede um arquivamento ou uma exclusão: quem ainda depende do registro.
 * Viaja no corpo de um 409 para a tela dizer exatamente o que desfazer.
 */
export interface BloqueiosCrm {
  readonly negocios?: {
    readonly total: number;
    readonly itens: ReadonlyArray<{ readonly id: string; readonly titulo: string }>;
  };
  readonly empresas?: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  readonly filiais?: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  /** O Contato detentor de um Identificador já em uso (RN-CON-11). */
  readonly contatos?: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
}

/** Os tetos que a borda HTTP e a tela respeitam — um só lugar, para não divergirem. */
export const LIMITES_CRM = {
  paginaPadrao: 50,
  paginaMaxima: 200,
  textoCurto: 200,
  textoLongo: 5000,
  camposAdicionaisMaximo: 50,
  chaveDeCampoMaxima: 60,
  valorDeCampoMaximo: 500,
  enderecosMaximo: 10,
  identificadoresMaximo: 20,
} as const;

// Esqueleto do RED (07-03): compila e erra. O GREEN o substitui.
export function validarEnderecos(_enderecos: readonly Endereco[] | undefined): OperationResult<void> {
  return ok(undefined);
}
export function validarCamposAdicionais(_campos: CamposAdicionais | undefined): OperationResult<void> {
  return ok(undefined);
}
