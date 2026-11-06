/**
 * O script `migrar:crm-antigo` (15-27, UCR-09): guardar o CRM antigo de UM Espaço.
 *
 * Cada modo que escreve roda numa única `executar()` do Espaço (a trava padrão): a trava da
 * linha do Espaço, `revisao + 1` (os navegadores abertos se re-hidratam), os prazos do servidor e o
 * `rollback` em qualquer falha vêm de graça. A ordem dentro da transação é a de F14-D-03:
 *
 *   1. `lerDoCrm`     — copia para `registros_crm_antigo` e CONFERE a cópia (lança se não bate);
 *   2. `operacao`     — pura; NÃO toca nas nove coleções antigas (a remoção delas é só SQL), para o
 *                       script sobreviver à remoção do modelo antigo (3.5.4) sem mudança;
 *   3. `aoConfirmar`  — apaga de `registros` por SQL e, no `--migrar`, insere o Funil.
 *
 * Toda leitura das coleções antigas é por SQL em `plataforma.registros`, tipada por
 * `formatos-antigos.ts`, nunca pelo `state`. Nada aqui lê nem imprime dado pessoal: só ids,
 * contagens e nomes de configuração.
 */

import type { PoolClient } from "pg";
import { fail, ok } from "@n1/dominio/state";
import { pool } from "../persistencia/conexao";
import { executar } from "../persistencia/unidade-de-trabalho";
import { COLECAO_DE_CONVERSAS, COLECOES_DO_CRM_ANTIGO, COLECOES_SEM_GRUPO, ErroDeUso, validarEspaco } from "./colecoes";
import { type Alvo, apagarDoRegistros, conferirCopia, contarConversasDeGrupo, contarDoAlvo, copiarParaRegistrosCrmAntigo } from "./guardar";

/** Ganchos só dos testes: provam a volta atrás (rollback) injetando falha entre duas etapas. */
export interface GanchosDeTeste {
  /** Roda depois da cópia e antes da conferência. */
  readonly antesDeConferir?: (cliente: PoolClient) => Promise<void>;
  /** Roda no `aoConfirmar` do `--migrar`, logo depois de inserir o Funil. */
  readonly depoisDeInserirFunis?: (cliente: PoolClient) => Promise<void>;
}

export interface OpcoesDeEscrita {
  readonly ganchosDeTeste?: GanchosDeTeste;
  /** `--funil=migrar|guardar`: o que fazer com o Funil antigo (só no `--migrar`). */
  readonly funil?: "migrar" | "guardar";
}

export interface ResultadoDeEscrita {
  readonly espaco: string;
  /** Verdadeiro quando não havia o que copiar, apagar ou inserir: nada foi escrito, nem a revisão do Espaço subiu. */
  readonly nadaAFazer: boolean;
  /** Linhas que entraram em `registros_crm_antigo` NESTA execução. */
  readonly copiadas: number;
  /** Linhas apagadas de `registros` nesta execução, por coleção. */
  readonly apagadas: Readonly<Record<string, number>>;
  /** Conversas de Grupo que continuam em `registros` (F14-D-05). */
  readonly conversasDeGrupoQueFicaram: number;
  /** A revisão do Espaço depois da escrita; indefinida quando não houve escrita. */
  readonly revisao: number | undefined;
  /** O resumo em português, só com contagens e nomes de coleção. */
  readonly mensagem: string;
}

/** A marca que `operacao` devolve quando não há nada a fazer: `executar()` desfaz sem subir a revisão. */
const NADA_A_FAZER = "nada a fazer";

/** O que `lerDoCrm` decide e `operacao`/`aoConfirmar` executam. */
interface Plano {
  readonly recusa: string | undefined;
  readonly nadaAFazer: boolean;
  readonly copiadas: number;
  readonly aApagar: Readonly<Record<string, number>>;
  readonly conversasDeGrupo: number;
  readonly apagar: Alvo;
}

/** As linhas que se copiam: as nove coleções INTEIRAS, as Conversas de Grupo também. */
function alvoDeCopiar(): Alvo {
  return { colecoes: COLECOES_DO_CRM_ANTIGO, conversasSemGrupo: false, extras: [] };
}

/** As linhas que saem de `registros`: as oito coleções e as Conversas sem Grupo. */
function alvoDeApagar(): Alvo {
  return { colecoes: COLECOES_SEM_GRUPO, conversasSemGrupo: true, extras: [] };
}

function soma(porColecao: Readonly<Record<string, number>>): number {
  return Object.values(porColecao).reduce((total, n) => total + n, 0);
}

/** `--espaco` existe em `plataforma.workspaces`? Sem Espaço não há o que guardar, e `executar()` lançaria um erro genérico. */
async function exigirEspacoExistente(espaco: string): Promise<void> {
  validarEspaco(espaco);
  const achou = await pool().query("select 1 from plataforma.workspaces where workspace_id = $1", [espaco]);
  if ((achou.rowCount ?? 0) === 0) throw new ErroDeUso(`Espaço não encontrado: ${espaco}.`);
}

function textoDasContagens(porColecao: Readonly<Record<string, number>>): string {
  const partes = Object.entries(porColecao).map(([colecao, n]) => `${colecao} ${n}`);
  return partes.length > 0 ? partes.join(", ") : "nenhuma";
}

/**
 * `--guardar`: copia as nove coleções do CRM antigo do Espaço para `registros_crm_antigo`, confere e
 * só então apaga de `registros` (D-15-01). Não cria linha no CRM novo. Repetir não faz nada.
 */
export async function guardarCrmAntigo(espaco: string, opcoes: OpcoesDeEscrita = {}): Promise<ResultadoDeEscrita> {
  await exigirEspacoExistente(espaco);
  const copiar = alvoDeCopiar();

  let apagadas: Readonly<Record<string, number>> = {};
  const resultado = await executar<Plano, Plano>(
    espaco,
    (_state, plano) => {
      if (plano.recusa) return fail(plano.recusa);
      if (plano.nadaAFazer) return fail(NADA_A_FAZER);
      return ok(plano);
    },
    {
      lerDoCrm: async (cliente) => {
        const apagar = alvoDeApagar();
        const copiadas = await copiarParaRegistrosCrmAntigo(cliente, espaco, copiar);
        if (opcoes.ganchosDeTeste?.antesDeConferir) await opcoes.ganchosDeTeste.antesDeConferir(cliente);
        await conferirCopia(cliente, espaco, copiar, apagar);
        const aApagar = await contarDoAlvo(cliente, espaco, apagar);
        return {
          recusa: undefined,
          nadaAFazer: copiadas === 0 && soma(aApagar) === 0,
          copiadas,
          aApagar,
          conversasDeGrupo: await contarConversasDeGrupo(cliente, espaco),
          apagar,
        };
      },
      aoConfirmar: async (cliente, plano) => {
        apagadas = await apagarDoRegistros(cliente, espaco, plano.apagar);
      },
    },
  );

  if ("conflito" in resultado) throw new Error(resultado.error);
  if (!resultado.ok) {
    if (resultado.error !== NADA_A_FAZER) throw new ErroDeUso(resultado.error);
    return {
      espaco,
      nadaAFazer: true,
      copiadas: 0,
      apagadas: {},
      conversasDeGrupoQueFicaram: 0,
      revisao: undefined,
      mensagem: `Espaço ${espaco}: nada a fazer. O CRM antigo já está guardado e não há linha dele para apagar em registros.`,
    };
  }
  const plano = resultado.value;
  return {
    espaco,
    nadaAFazer: false,
    copiadas: plano.copiadas,
    apagadas,
    conversasDeGrupoQueFicaram: plano.conversasDeGrupo,
    revisao: resultado.revisao,
    mensagem:
      `Espaço ${espaco}: guardado. ${plano.copiadas} linha(s) copiadas para registros_crm_antigo; ` +
      `apagadas de registros: ${textoDasContagens(apagadas)}. ` +
      `${plano.conversasDeGrupo} Conversa(s) de Grupo continuam em registros (${COLECAO_DE_CONVERSAS}, F14-D-05).`,
  };
}

// --- esqueleto do RED (Task 2): a forma pública, sem o comportamento ---

export async function migrarCrmAntigo(espaco: string, _opcoes: OpcoesDeEscrita = {}): Promise<ResultadoDeEscrita> {
  return { espaco, nadaAFazer: true, copiadas: 0, apagadas: {}, conversasDeGrupoQueFicaram: 0, revisao: undefined, mensagem: "" };
}

export async function relatorioSeco(_espaco: string): Promise<string> {
  return "";
}

export async function emTransacaoSoLeitura<T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool().connect();
  try {
    return await fn(cliente);
  } finally {
    cliente.release();
  }
}
