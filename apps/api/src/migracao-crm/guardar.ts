/**
 * Copiar, conferir e apagar: as três pontas do "guardar" (D-15-01, D-15-02, F14-D-03).
 *
 * Tudo roda no `PoolClient` da transação de `executar()`; nenhuma função abre ou fecha transação.
 * Valores entram só por `$n`; os nomes de tabela e de coluna são constantes deste arquivo (T-15-66).
 *
 * O que sai de `registros` é o `alvo` de apagar; o que se copia é o `alvo` de copiar (as mesmas
 * oito coleções e `conversations` INTEIRA, com as de Grupo). A conferência exige, para cada linha a
 * apagar, uma cópia IDÊNTICA (dados e ordem): sem isso nada é apagado.
 */

import type { PoolClient } from "pg";
import { COLECAO_DE_CONVERSAS, SQL_E_CONVERSA_DE_GRUPO } from "./colecoes";

/** Uma linha de `registros` pela chave: coleção e id. */
export interface ChaveDeRegistro {
  readonly colecao: string;
  readonly id: string;
}

/** O conjunto de linhas de `registros` de um Espaço que uma etapa copia ou apaga. */
export interface Alvo {
  /** Coleções inteiras. */
  readonly colecoes: readonly string[];
  /** `conversations` só nas Conversas SEM Grupo (as de Grupo ficam). */
  readonly conversasSemGrupo: boolean;
  /** Linhas avulsas (a Pasta "Meus negócios", D-15-14). */
  readonly extras: readonly ChaveDeRegistro[];
}

/**
 * O `where` de um `Alvo` sobre `plataforma.registros r`. `$1` é o Espaço; os parâmetros vêm de
 * `parametrosDoAlvo`, sempre os mesmos seis, na mesma ordem.
 */
const ONDE_DO_ALVO = `r.workspace_id = $1 and (
  r.colecao = any($2::text[])
  or ($6::boolean and r.colecao = $3 and not (${SQL_E_CONVERSA_DE_GRUPO}))
  or (r.colecao, r.id) in (select x.colecao, x.id from unnest($4::text[], $5::text[]) as x(colecao, id))
)`;

function parametrosDoAlvo(espaco: string, alvo: Alvo): unknown[] {
  return [
    espaco,
    [...alvo.colecoes],
    COLECAO_DE_CONVERSAS,
    alvo.extras.map((e) => e.colecao),
    alvo.extras.map((e) => e.id),
    alvo.conversasSemGrupo,
  ];
}

/**
 * Copia as linhas do alvo para `registros_crm_antigo`, como estão (`dados` e `ordem`), sem sobrescrever
 * uma cópia que já exista (`on conflict do nothing`: rodar de novo não copia nada). Devolve quantas
 * linhas entraram AGORA.
 */
export async function copiarParaRegistrosCrmAntigo(cliente: PoolClient, espaco: string, alvo: Alvo): Promise<number> {
  const resultado = await cliente.query(
    `insert into plataforma.registros_crm_antigo (workspace_id, colecao, id, dados, ordem)
     select r.workspace_id, r.colecao, r.id, r.dados, r.ordem
       from plataforma.registros r
      where ${ONDE_DO_ALVO}
     on conflict do nothing`,
    parametrosDoAlvo(espaco, alvo),
  );
  return resultado.rowCount ?? 0;
}

interface ContagemDeConferencia {
  readonly origem: string;
  readonly conferem: string;
}

/**
 * Confere a cópia ANTES de qualquer `delete` e lança se ela não bate (a transação inteira volta):
 *
 *  1. toda linha do alvo de copiar tem uma cópia com a mesma chave (inclusive as Conversas de Grupo);
 *  2. toda linha do alvo de apagar tem uma cópia IDÊNTICA — `dados` e `ordem` iguais. Uma cópia velha
 *     que difere (linha reinserida e mudada depois do primeiro guardar) barra o apagar em vez de
 *     perder a versão nova.
 *
 * O texto da exceção traz só contagens: nunca id nem conteúdo (T-15-67).
 */
export async function conferirCopia(cliente: PoolClient, espaco: string, copiar: Alvo, apagar: Alvo): Promise<void> {
  const chaves = await cliente.query<ContagemDeConferencia>(
    `select count(*)::text as origem, count(c.id)::text as conferem
       from plataforma.registros r
       left join plataforma.registros_crm_antigo c
         on c.workspace_id = r.workspace_id and c.colecao = r.colecao and c.id = r.id
      where ${ONDE_DO_ALVO}`,
    parametrosDoAlvo(espaco, copiar),
  );
  const daChave = chaves.rows[0]!;
  if (daChave.origem !== daChave.conferem) {
    throw new Error(
      `A cópia de segurança não confere: ${daChave.conferem} de ${daChave.origem} linha(s) de registros têm cópia em registros_crm_antigo. Nada foi apagado.`,
    );
  }
  const conteudo = await cliente.query<ContagemDeConferencia>(
    `select count(*)::text as origem,
            (count(*) filter (where c.dados = r.dados and c.ordem = r.ordem))::text as conferem
       from plataforma.registros r
       left join plataforma.registros_crm_antigo c
         on c.workspace_id = r.workspace_id and c.colecao = r.colecao and c.id = r.id
      where ${ONDE_DO_ALVO}`,
    parametrosDoAlvo(espaco, apagar),
  );
  const doConteudo = conteudo.rows[0]!;
  if (doConteudo.origem !== doConteudo.conferem) {
    throw new Error(
      `A cópia de segurança não confere: ${doConteudo.conferem} de ${doConteudo.origem} linha(s) a apagar têm cópia idêntica. Nada foi apagado.`,
    );
  }
}

/** Quantas linhas do alvo existem em `registros`, por coleção. */
export async function contarDoAlvo(cliente: PoolClient, espaco: string, alvo: Alvo): Promise<Record<string, number>> {
  const resultado = await cliente.query<{ colecao: string; n: string }>(
    `select r.colecao, count(*)::text as n from plataforma.registros r where ${ONDE_DO_ALVO} group by r.colecao order by r.colecao`,
    parametrosDoAlvo(espaco, alvo),
  );
  return Object.fromEntries(resultado.rows.map((linha) => [linha.colecao, Number(linha.n)]));
}

/** Quantas Conversas de Grupo (que ficam em `registros`) o Espaço tem. */
export async function contarConversasDeGrupo(cliente: PoolClient, espaco: string): Promise<number> {
  const resultado = await cliente.query<{ n: string }>(
    `select count(*)::text as n from plataforma.registros r
      where r.workspace_id = $1 and r.colecao = $2 and ${SQL_E_CONVERSA_DE_GRUPO}`,
    [espaco, COLECAO_DE_CONVERSAS],
  );
  return Number(resultado.rows[0]!.n);
}

/** Apaga de `registros` as linhas do alvo e devolve quantas saíram por coleção. Só depois de `conferirCopia`. */
export async function apagarDoRegistros(cliente: PoolClient, espaco: string, alvo: Alvo): Promise<Record<string, number>> {
  const resultado = await cliente.query<{ colecao: string }>(
    `delete from plataforma.registros r where ${ONDE_DO_ALVO} returning r.colecao`,
    parametrosDoAlvo(espaco, alvo),
  );
  const porColecao: Record<string, number> = {};
  for (const linha of resultado.rows) porColecao[linha.colecao] = (porColecao[linha.colecao] ?? 0) + 1;
  return porColecao;
}
