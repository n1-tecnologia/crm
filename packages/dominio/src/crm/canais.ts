/**
 * O Canal do CRM novo: a conta conectada de um provedor (um número de
 * WhatsApp, uma caixa de e-mail, um perfil de Instagram). Tipos camelCase dos
 * campos de `plataforma.canais` (008), mais as regras que valem dos dois lados
 * da fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com o `Channel` inglês de `types/crm.ts` (seed e `criarCanal`
 * antigo) até a fase de unificação (D-11, D-12). Nenhum tipo aqui carrega
 * `workspaceId`: o Espaço de Trabalho vem da sessão, nunca do corpo.
 *
 * Os valores discretos abaixo são cópia literal da 008:
 *   - `ConexaoDoCanal` → `canais_conexao_ck`
 *   - `EstadoDoCanal`  → `canais_estado_ck`
 *
 * O Canal nasce `desconectada` (D-08; ontologia 12.2) — `validarNovoCanal` não
 * devolve `conexao`, e o INSERT da api não a envia.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/canais`.
 */

import { fail, ok, type OperationResult } from "../state";
import { FORMA_DO_IDENTIFICADOR, identificadorCanonico } from "../operations/canais";
import { PROVEDORES, PROVEDORES_DE_CANAL, type TipoComProvedor } from "../provedores-de-canal";
import type { ProvedorDeCanal } from "../types/crm";
import { LIMITES_CRM } from "./comum";

export const CONEXOES_DO_CANAL = ["conectada", "desconectada", "com_erro"] as const;
export type ConexaoDoCanal = (typeof CONEXOES_DO_CANAL)[number];

export const ESTADOS_DO_CANAL = ["ativo", "arquivado"] as const;
export type EstadoDoCanal = (typeof ESTADOS_DO_CANAL)[number];

export interface Canal {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly identificadorExterno: string;
  readonly conexao: ConexaoDoCanal;
  /** D-08: a conexão veio do botão "Simular conexão". */
  readonly conexaoSimulada: boolean;
  readonly conectadaEm: string | null;
  readonly estado: EstadoDoCanal;
  readonly arquivadoEm: string | null;
  /** B35 — rastreabilidade, não governança: o Canal não tem Proprietário. */
  readonly configuradoPor: string;
  readonly filaPadraoId: string | null;
  readonly proprietarioPadraoId: string | null;
  readonly origemPadraoId: string | null;
  readonly gruposHabilitados: boolean;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface NovoCanal {
  readonly provedor: ProvedorDeCanal;
  readonly nome: string;
  readonly identificador: string;
  readonly filaPadraoId?: string;
  readonly origemPadraoId?: string;
}

export interface FiltroDeCanais {
  readonly estado: EstadoDoCanal;
  readonly limite: number;
  readonly deslocamento: number;
  readonly tipo?: TipoComProvedor;
  readonly provedor?: ProvedorDeCanal;
  readonly conexao?: ConexaoDoCanal;
  readonly q?: string;
}

/**
 * Valida um Canal novo: o `tipo` sai do provedor (nunca do cliente) e o
 * identificador vira a forma canônica que o índice `canais_conta_uq` compara
 * (INV-CXE-01).
 */
export function validarNovoCanal(entrada: NovoCanal): OperationResult<{
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly nome: string;
  readonly identificadorExterno: string;
}> {
  const nome = entrada.nome.trim();
  if (nome === "") return fail("Dê um nome ao Canal.", "nome");
  if (nome.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome do Canal vai até ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  const provedor = entrada.provedor as string;
  if (!(PROVEDORES_DE_CANAL as readonly string[]).includes(provedor)) {
    return fail("Este provedor de Canal não existe.", "provedor");
  }
  const tipo = PROVEDORES[entrada.provedor].tipo;
  const identificadorExterno = identificadorCanonico(tipo, entrada.identificador);
  if (identificadorExterno === undefined) return fail(FORMA_DO_IDENTIFICADOR[tipo].dica, "identificador");
  return ok({ tipo, provedor: entrada.provedor, nome, identificadorExterno });
}

/**
 * O que a configuração de um Canal pode mudar (INV-CXE-02): o nome e os dois
 * padrões. `tipo`, `provedor`, `identificador` e `conexao` não estão aqui de
 * propósito — trocar a conta é arquivar e criar outro Canal. `null` limpa o
 * padrão; ausente não mexe.
 */
export interface EdicaoDeCanal {
  readonly nome?: string;
  readonly filaPadraoId?: string | null;
  readonly origemPadraoId?: string | null;
}

export function validarEdicaoDeCanal(edicao: EdicaoDeCanal): OperationResult<EdicaoDeCanal> {
  if (edicao.nome === undefined) return ok(edicao);
  const nome = edicao.nome.trim();
  if (nome === "") return fail("Dê um nome ao Canal.", "nome");
  if (nome.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome do Canal vai até ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  return ok({ ...edicao, nome });
}

/**
 * A conexão em dois atos (ontologia 12.2): o Canal nasce `desconectada` e
 * conecta depois. Sem provedor real, a conexão é simulada e MARCADA como
 * simulada (D-08) — `conexaoSimulada` só vale com `conectada`, e desconectar
 * apaga a marca.
 */
export type AcaoDeConexao = "simular_conexao" | "desconectar";

export function proximaConexao(
  canal: Pick<Canal, "conexao" | "estado">,
  acao: AcaoDeConexao,
): OperationResult<{ readonly conexao: ConexaoDoCanal; readonly conexaoSimulada: boolean }> {
  if (acao === "simular_conexao") {
    if (canal.estado === "arquivado") return fail("Um Canal arquivado não se conecta.");
    if (canal.conexao === "conectada") return fail("O Canal já está conectado.");
    return ok({ conexao: "conectada", conexaoSimulada: true });
  }
  if (canal.conexao === "desconectada") return fail("O Canal já está desconectado.");
  return ok({ conexao: "desconectada", conexaoSimulada: false });
}

/**
 * 11.1: arquivar tira o Canal de uso e o libera para o mesmo número entrar
 * noutro. O Canal arquivado é sempre desconectado — o serviço faz as duas
 * mudanças na mesma escrita.
 */
export function validarArquivamento(canal: Pick<Canal, "estado">): OperationResult<void> {
  if (canal.estado === "arquivado") return fail("O Canal já está arquivado.");
  return ok(undefined);
}
