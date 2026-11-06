/**
 * As leituras por SQL do mapeador (15-28): as linhas antigas de `plataforma.registros` e o que o CRM novo
 * do Espaço já tem. Tudo em `plataforma`, sempre com `workspace_id = $1`; nada daqui é impresso.
 */

import type { PoolClient } from "pg";
import { COLECOES_DO_CRM_ANTIGO } from "./colecoes";
import type { RegistroAntigo } from "./formatos-antigos";
import { chaveDeIdentificadorDeContato, type CrmNovoDoEspaco } from "./mapeador";

/** As linhas das nove coleções do Espaço, como estão em `registros` (as Conversas de Grupo vêm junto; o mapeador as ignora). */
export async function lerLinhasAntigas(cliente: PoolClient, espaco: string): Promise<RegistroAntigo[]> {
  const resultado = await cliente.query<RegistroAntigo>(
    `select colecao, id, dados, ordem
       from plataforma.registros
      where workspace_id = $1 and colecao = any($2::text[])
      order by colecao, ordem, id`,
    [espaco, [...COLECOES_DO_CRM_ANTIGO]],
  );
  return resultado.rows;
}

/** O que o CRM novo do Espaço já tem e o mapeador não pode repetir. */
export async function lerCrmNovoDoEspaco(cliente: PoolClient, espaco: string, antigas: readonly RegistroAntigo[]): Promise<CrmNovoDoEspaco> {
  const idsDe = (colecao: string): string[] => antigas.filter((l) => l.colecao === colecao).map((l) => l.id);

  const contatos = await cliente.query<{ id: string }>(
    "select id from plataforma.contatos where workspace_id = $1 and id = any($2::text[])",
    [espaco, idsDe("contacts")],
  );
  const identificadores = await cliente.query<{ tipo: string; valor: string }>(
    "select tipo, valor from plataforma.contato_identificadores where workspace_id = $1",
    [espaco],
  );
  return {
    identificadoresDeContato: new Set(identificadores.rows.map((i) => chaveDeIdentificadorDeContato(i.tipo, i.valor))),
    idsDeContato: new Set(contatos.rows.map((l) => l.id)),
  };
}
