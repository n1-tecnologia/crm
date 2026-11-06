/**
 * As leituras por SQL do mapeador (15-28): as linhas antigas de `plataforma.registros` e o que o CRM novo
 * do Espaço já tem. Tudo em `plataforma`, sempre com `workspace_id = $1`; nada daqui é impresso.
 */

import type { PoolClient } from "pg";
import { COLECOES_DO_CRM_ANTIGO } from "./colecoes";
import type { RegistroAntigo } from "./formatos-antigos";
import { chaveDeContaDeCanal, chaveDeIdentificadorDeContato, chaveDeIdentificadorDeEmpresa, chaveDeParDeConversa, type CrmNovoDoEspaco } from "./mapeador";

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

/** O que o CRM novo do Espaço já tem e o mapeador não pode repetir: ids que colidiriam e chaves de unicidade. */
export async function lerCrmNovoDoEspaco(cliente: PoolClient, espaco: string, antigas: readonly RegistroAntigo[]): Promise<CrmNovoDoEspaco> {
  const idsDe = (colecao: string): string[] => antigas.filter((l) => l.colecao === colecao).map((l) => l.id);
  // As Mensagens moram dentro da Conversa antiga: o id de cada uma é o que pode colidir.
  const idsDeMensagens = antigas
    .filter((l) => l.colecao === "conversations")
    .flatMap((l) => ((l.dados as { messages?: Array<{ id?: unknown }> }).messages ?? []).map((m) => m.id))
    .filter((id): id is string => typeof id === "string");

  const idsExistentes = async (tabela: "contatos" | "empresas" | "negocios" | "canais" | "conversas" | "mensagens", candidatos: string[]): Promise<Set<string>> => {
    if (candidatos.length === 0) return new Set();
    const resultado = await cliente.query<{ id: string }>(`select id from plataforma.${tabela} where workspace_id = $1 and id = any($2::text[])`, [espaco, candidatos]);
    return new Set(resultado.rows.map((l) => l.id));
  };

  const identificadoresDeContato = await cliente.query<{ tipo: string; valor: string }>(
    "select tipo, valor from plataforma.contato_identificadores where workspace_id = $1",
    [espaco],
  );
  const identificadoresDeEmpresa = await cliente.query<{ tipo: string; valor: string }>(
    "select tipo, valor from plataforma.empresa_identificadores where workspace_id = $1",
    [espaco],
  );
  const canaisAtivos = await cliente.query<{ nome: string; tipo: string; identificador_externo: string }>(
    "select nome, tipo, identificador_externo from plataforma.canais where workspace_id = $1 and estado = 'ativo'",
    [espaco],
  );
  const naoResolvidas = await cliente.query<{ contato_id: string; canal_id: string }>(
    "select contato_id, canal_id from plataforma.conversas where workspace_id = $1 and situacao in ('aberta', 'pendente') and estado = 'ativo'",
    [espaco],
  );

  return {
    idsDeContato: await idsExistentes("contatos", idsDe("contacts")),
    identificadoresDeContato: new Set(identificadoresDeContato.rows.map((i) => chaveDeIdentificadorDeContato(i.tipo, i.valor))),
    idsDeEmpresa: await idsExistentes("empresas", idsDe("companies")),
    identificadoresDeEmpresa: new Set(identificadoresDeEmpresa.rows.map((i) => chaveDeIdentificadorDeEmpresa(i.tipo, i.valor))),
    idsDeNegocio: await idsExistentes("negocios", idsDe("deals")),
    idsDeCanal: await idsExistentes("canais", idsDe("channels")),
    // `lower(btrim(nome))`, como o índice `canais_nome_uq`.
    nomesDeCanalAtivo: new Set(canaisAtivos.rows.map((l) => l.nome.trim().toLowerCase())),
    contasDeCanalAtivo: new Set(canaisAtivos.rows.map((l) => chaveDeContaDeCanal(l.tipo, l.identificador_externo))),
    idsDeConversa: await idsExistentes("conversas", idsDe("conversations")),
    conversasNaoResolvidas: new Set(naoResolvidas.rows.map((l) => chaveDeParDeConversa(l.contato_id, l.canal_id))),
    idsDeMensagem: await idsExistentes("mensagens", idsDeMensagens),
  };
}
