/**
 * Repositório de Empresas — molde de `contatos.ts`.
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1` (D-10, T-07-01): o Espaço vem do
 *     serviço, que o tira da sessão;
 *   - valores sempre `$n`, nunca interpolados (T-07-05); a ordenação é fixa e
 *     as colunas do `UPDATE` são uma lista fixa;
 *   - `date` não aparece aqui (vínculos, que têm data, moram em `vinculos.ts`);
 *   - `atualizado_em` é do trigger da 007; os ids vêm do `default gen_random_uuid()::text`.
 */

import type { Pool, PoolClient } from "pg";
import type { CamposAdicionais, Endereco, EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import {
  nomeDeExibicaoDaEmpresa,
  type EdicaoDeEmpresa,
  type Empresa,
  type EmpresaResumo,
  type IdentificadorDeEmpresa,
  type NovaEmpresa,
  type TipoIdentificadorEmpresa,
} from "@n1/dominio/crm/empresas";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";

export type LinhaDeEmpresa = Omit<NovaEmpresa, "identificadores" | "proprietarioId"> & {
  readonly proprietarioId: string;
  readonly criadoPor: string;
};

export interface FiltroDeEmpresas {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface LinhaDeIdentificadorDeEmpresa {
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais?: string | undefined;
  readonly principal: boolean;
}

export interface CamposDeIdentificadorDeEmpresa {
  readonly principal?: boolean | undefined;
  readonly verificado?: boolean | undefined;
  /** Texto vazio limpa o país. */
  readonly pais?: string | undefined;
}

/** Quem já tem o Identificador: o nome é o de exibição, derivado. */
export interface DetentoraDeIdentificador {
  readonly empresaId: string;
  readonly nome: string;
}

export interface EmpresaRelacionada {
  readonly id: string;
  readonly nome: string;
  readonly estado: EstadoCrm;
}

export interface NegociosDaEmpresa {
  readonly total: number;
  /** Até 20, para a tela listar; `total` é o de todos. */
  readonly itens: readonly { readonly id: string; readonly titulo: string }[];
}

export interface RepositorioDeEmpresas {
  inserir(workspaceId: string, linha: LinhaDeEmpresa): Promise<Empresa>;
  /** `travar` faz `select ... for update`: a transação segura o registro contra corrida. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Empresa | undefined>;
  listar(workspaceId: string, filtro: FiltroDeEmpresas): Promise<Pagina<EmpresaResumo>>;
  /** Só as colunas presentes em `campos`; texto vazio limpa a coluna (e a matriz). */
  atualizar(workspaceId: string, id: string, campos: EdicaoDeEmpresa): Promise<Empresa | undefined>;
  definirEstado(workspaceId: string, id: string, estado: EstadoCrm): Promise<Empresa | undefined>;
  excluir(workspaceId: string, id: string): Promise<boolean>;

  /** Os ids acima da Empresa na hierarquia de matrizes (da matriz direta para cima), no máximo 50 níveis. */
  ancestraisDe(workspaceId: string, empresaId: string): Promise<string[]>;
  /** Filiais diretas; `apenasAtivasOuArquivadas` deixa de fora as que estão na lixeira (RN-EMP-09). */
  filiaisDe(
    workspaceId: string,
    empresaId: string,
    opcoes?: { readonly apenasAtivasOuArquivadas?: boolean },
  ): Promise<EmpresaRelacionada[]>;

  listarIdentificadores(workspaceId: string, empresaId: string): Promise<IdentificadorDeEmpresa[]>;
  obterIdentificador(workspaceId: string, empresaId: string, identificadorId: string): Promise<IdentificadorDeEmpresa | undefined>;
  inserirIdentificador(workspaceId: string, empresaId: string, linha: LinhaDeIdentificadorDeEmpresa): Promise<IdentificadorDeEmpresa>;
  atualizarIdentificador(workspaceId: string, identificadorId: string, campos: CamposDeIdentificadorDeEmpresa): Promise<void>;
  /** Tira a marca de principal do Identificador atual do tipo. */
  rebaixarPrincipal(workspaceId: string, empresaId: string, tipo: TipoIdentificadorEmpresa): Promise<void>;
  removerIdentificador(workspaceId: string, identificadorId: string): Promise<void>;
  detentoraDoIdentificador(
    workspaceId: string,
    tipo: TipoIdentificadorEmpresa,
    valor: string,
  ): Promise<DetentoraDeIdentificador | undefined>;

  /** Somente leitura de `plataforma.negocios` — a escrita de Negócio é de 07-08. */
  negociosDaEmpresa(
    workspaceId: string,
    empresaId: string,
    opcoes: { readonly apenasAbertosForaDaLixeira: boolean },
  ): Promise<NegociosDaEmpresa>;
}

const COLUNAS = `id, nome_fantasia, razao_social, descricao, matriz_id, enderecos, campos_adicionais, origem,
  estado, proprietario_id, criado_por, criado_em, atualizado_em`;

/** O nome de exibição na própria consulta: nome fantasia, senão razão social. */
const NOME_SQL = (alias: string): string =>
  `coalesce(nullif(btrim(${alias}.nome_fantasia), ''), nullif(btrim(${alias}.razao_social), ''), 'Empresa sem nome')`;

interface LinhaDoBanco {
  readonly id: string;
  readonly nome_fantasia: string | null;
  readonly razao_social: string | null;
  readonly descricao: string | null;
  readonly matriz_id: string | null;
  readonly enderecos: Endereco[];
  readonly campos_adicionais: CamposAdicionais;
  readonly origem: string | null;
  readonly estado: EstadoCrm;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
export function linhaParaEmpresa(linha: LinhaDoBanco): Empresa {
  return {
    id: linha.id,
    nomeFantasia: linha.nome_fantasia,
    razaoSocial: linha.razao_social,
    descricao: linha.descricao,
    matrizId: linha.matriz_id,
    enderecos: linha.enderecos,
    camposAdicionais: linha.campos_adicionais,
    origem: linha.origem,
    estado: linha.estado,
    proprietarioId: linha.proprietario_id,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

const COLUNAS_IDENTIFICADOR = "id, empresa_id, tipo, valor, pais, verificado, principal, criado_em";

interface LinhaDeIdentificadorNoBanco {
  readonly id: string;
  readonly empresa_id: string;
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criado_em: Date;
}

function linhaParaIdentificador(linha: LinhaDeIdentificadorNoBanco): IdentificadorDeEmpresa {
  return {
    id: linha.id,
    empresaId: linha.empresa_id,
    tipo: linha.tipo,
    valor: linha.valor,
    pais: linha.pais,
    verificado: linha.verificado,
    principal: linha.principal,
    criadoEm: linha.criado_em.toISOString(),
  };
}

/** Texto vazio (depois de aparado) é "sem valor" no banco. */
const textoOuNulo = (texto: string): string | null => (texto.trim() === "" ? null : texto);

export function criarRepositorioDeEmpresasPg(cliente: Pool | PoolClient): RepositorioDeEmpresas {
  return {
    async inserir(workspaceId, linha) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `insert into plataforma.empresas
           (workspace_id, nome_fantasia, razao_social, descricao, matriz_id, enderecos, campos_adicionais,
            origem, proprietario_id, criado_por)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
         returning ${COLUNAS}`,
        [
          workspaceId,
          linha.nomeFantasia ?? null,
          linha.razaoSocial ?? null,
          linha.descricao ?? null,
          linha.matrizId ?? null,
          JSON.stringify(linha.enderecos ?? []),
          JSON.stringify(linha.camposAdicionais ?? {}),
          linha.origem ?? null,
          linha.proprietarioId,
          linha.criadoPor,
        ],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Empresa não devolveu a linha.");
      return linhaParaEmpresa(inserida);
    },

    async obter(workspaceId, id, opcoes) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `select ${COLUNAS} from plataforma.empresas where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaEmpresa(linha) : undefined;
    },

    async listar(workspaceId, filtro) {
      const parametros: unknown[] = [workspaceId, filtro.estado];
      let busca = "";
      const texto = filtro.q?.trim() ?? "";
      if (texto !== "") {
        parametros.push(contemTexto(texto));
        const p = `$${parametros.length}`;
        busca = `and (e.nome_fantasia ilike ${p} ${CLAUSULA_ESCAPE}
                  or e.razao_social ilike ${p} ${CLAUSULA_ESCAPE}
                  or exists (select 1 from plataforma.empresa_identificadores bi
                              where bi.workspace_id = e.workspace_id and bi.empresa_id = e.id
                                and bi.valor ilike ${p} ${CLAUSULA_ESCAPE}))`;
      }
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total from plataforma.empresas e where e.workspace_id = $1 and e.estado = $2 ${busca}`,
        parametros,
      );
      parametros.push(filtro.limite, filtro.deslocamento);
      const pagina = await cliente.query<
        LinhaDoBanco & { dominio_principal: string | null; documento_principal: string | null; matriz_nome: string | null }
      >(
        `select e.id, e.nome_fantasia, e.razao_social, e.descricao, e.matriz_id, e.enderecos, e.campos_adicionais,
                e.origem, e.estado, e.proprietario_id, e.criado_por, e.criado_em, e.atualizado_em,
                (select i.valor from plataforma.empresa_identificadores i
                  where i.workspace_id = e.workspace_id and i.empresa_id = e.id
                    and i.principal and i.tipo = 'dominio') as dominio_principal,
                (select i.valor from plataforma.empresa_identificadores i
                  where i.workspace_id = e.workspace_id and i.empresa_id = e.id
                    and i.principal and i.tipo = 'documento_fiscal') as documento_principal,
                (select ${NOME_SQL("m")} from plataforma.empresas m
                  where m.workspace_id = e.workspace_id and m.id = e.matriz_id) as matriz_nome
           from plataforma.empresas e
          where e.workspace_id = $1 and e.estado = $2 ${busca}
          order by e.atualizado_em desc, e.id
          limit $${parametros.length - 1} offset $${parametros.length}`,
        parametros,
      );
      return {
        total: total.rows[0]?.total ?? 0,
        itens: pagina.rows.map((linha) => {
          const empresa = linhaParaEmpresa(linha);
          return {
            id: empresa.id,
            nomeDeExibicao: nomeDeExibicaoDaEmpresa(empresa),
            dominioPrincipal: linha.dominio_principal,
            documentoPrincipal: linha.documento_principal,
            matriz: empresa.matrizId !== null && linha.matriz_nome !== null ? { id: empresa.matrizId, nome: linha.matriz_nome } : null,
            proprietarioId: empresa.proprietarioId,
            estado: empresa.estado,
            atualizadoEm: empresa.atualizadoEm,
          };
        }),
      };
    },

    async atualizar(workspaceId, id, campos) {
      // Lista FIXA de colunas: nenhum nome de coluna vem do cliente (T-07-05).
      const valores: unknown[] = [workspaceId, id];
      const definicoes: string[] = [];
      const definir = (coluna: string, valor: unknown, conversao = ""): void => {
        valores.push(valor);
        definicoes.push(`${coluna} = $${valores.length}${conversao}`);
      };
      if (campos.nomeFantasia !== undefined) definir("nome_fantasia", textoOuNulo(campos.nomeFantasia));
      if (campos.razaoSocial !== undefined) definir("razao_social", textoOuNulo(campos.razaoSocial));
      if (campos.descricao !== undefined) definir("descricao", textoOuNulo(campos.descricao));
      if (campos.matrizId !== undefined) definir("matriz_id", textoOuNulo(campos.matrizId));
      if (campos.enderecos !== undefined) definir("enderecos", JSON.stringify(campos.enderecos), "::jsonb");
      if (campos.camposAdicionais !== undefined) {
        definir("campos_adicionais", JSON.stringify(campos.camposAdicionais), "::jsonb");
      }
      if (campos.origem !== undefined) definir("origem", textoOuNulo(campos.origem));
      if (campos.proprietarioId !== undefined) definir("proprietario_id", campos.proprietarioId);
      if (definicoes.length === 0) return this.obter(workspaceId, id);
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.empresas set ${definicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS}`,
        valores,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaEmpresa(linha) : undefined;
    },

    async definirEstado(workspaceId, id, estado) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.empresas set estado = $3 where workspace_id = $1 and id = $2 returning ${COLUNAS}`,
        [workspaceId, id, estado],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaEmpresa(linha) : undefined;
    },

    async excluir(workspaceId, id) {
      const resultado = await cliente.query("delete from plataforma.empresas where workspace_id = $1 and id = $2", [workspaceId, id]);
      return (resultado.rowCount ?? 0) > 0;
    },

    async ancestraisDe(workspaceId, empresaId) {
      // Sobe por `matriz_id`; o teto de 50 níveis protege contra um ciclo que o banco deixasse passar.
      const resultado = await cliente.query<{ id: string }>(
        `with recursive acima as (
           select e.matriz_id as id, 1 as nivel
             from plataforma.empresas e
            where e.workspace_id = $1 and e.id = $2 and e.matriz_id is not null
           union all
           select e.matriz_id, a.nivel + 1
             from plataforma.empresas e
             join acima a on e.id = a.id
            where e.workspace_id = $1 and e.matriz_id is not null and a.nivel < 50)
         select id from acima order by nivel`,
        [workspaceId, empresaId],
      );
      return resultado.rows.map((linha) => linha.id);
    },

    async filiaisDe(workspaceId, empresaId, opcoes) {
      const filtro = opcoes?.apenasAtivasOuArquivadas ? "and f.estado <> 'na_lixeira'" : "";
      const resultado = await cliente.query<{ id: string; nome: string; estado: EstadoCrm }>(
        `select f.id, ${NOME_SQL("f")} as nome, f.estado
           from plataforma.empresas f
          where f.workspace_id = $1 and f.matriz_id = $2 ${filtro}
          order by nome, f.id`,
        [workspaceId, empresaId],
      );
      return resultado.rows;
    },

    async listarIdentificadores(workspaceId, empresaId) {
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `select ${COLUNAS_IDENTIFICADOR} from plataforma.empresa_identificadores
          where workspace_id = $1 and empresa_id = $2 order by criado_em, id`,
        [workspaceId, empresaId],
      );
      return resultado.rows.map(linhaParaIdentificador);
    },

    async obterIdentificador(workspaceId, empresaId, identificadorId) {
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `select ${COLUNAS_IDENTIFICADOR} from plataforma.empresa_identificadores
          where workspace_id = $1 and empresa_id = $2 and id = $3`,
        [workspaceId, empresaId, identificadorId],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaIdentificador(linha) : undefined;
    },

    async inserirIdentificador(workspaceId, empresaId, linha) {
      // `clock_timestamp()` e não o `now()` da coluna: dois Identificadores da mesma transação
      // precisam de `criado_em` distintos para "o mais antigo" ter ordem definida.
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `insert into plataforma.empresa_identificadores
           (workspace_id, empresa_id, tipo, valor, pais, principal, criado_em)
         values ($1, $2, $3, $4, $5, $6, clock_timestamp())
         returning ${COLUNAS_IDENTIFICADOR}`,
        [workspaceId, empresaId, linha.tipo, linha.valor, linha.pais ?? null, linha.principal],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Identificador de Empresa não devolveu a linha.");
      return linhaParaIdentificador(inserida);
    },

    async atualizarIdentificador(workspaceId, identificadorId, campos) {
      const valores: unknown[] = [workspaceId, identificadorId];
      const definicoes: string[] = [];
      const definir = (coluna: string, valor: unknown): void => {
        valores.push(valor);
        definicoes.push(`${coluna} = $${valores.length}`);
      };
      if (campos.principal !== undefined) definir("principal", campos.principal);
      if (campos.verificado !== undefined) definir("verificado", campos.verificado);
      if (campos.pais !== undefined) definir("pais", textoOuNulo(campos.pais));
      if (definicoes.length === 0) return;
      await cliente.query(
        `update plataforma.empresa_identificadores set ${definicoes.join(", ")} where workspace_id = $1 and id = $2`,
        valores,
      );
    },

    async rebaixarPrincipal(workspaceId, empresaId, tipo) {
      await cliente.query(
        `update plataforma.empresa_identificadores set principal = false
          where workspace_id = $1 and empresa_id = $2 and tipo = $3 and principal`,
        [workspaceId, empresaId, tipo],
      );
    },

    async removerIdentificador(workspaceId, identificadorId) {
      await cliente.query("delete from plataforma.empresa_identificadores where workspace_id = $1 and id = $2", [
        workspaceId,
        identificadorId,
      ]);
    },

    async detentoraDoIdentificador(workspaceId, tipo, valor) {
      const resultado = await cliente.query<{ empresa_id: string; nome: string }>(
        `select i.empresa_id, ${NOME_SQL("e")} as nome
           from plataforma.empresa_identificadores i
           join plataforma.empresas e on e.workspace_id = i.workspace_id and e.id = i.empresa_id
          where i.workspace_id = $1 and i.tipo = $2 and i.valor = $3`,
        [workspaceId, tipo, valor],
      );
      const linha = resultado.rows[0];
      return linha ? { empresaId: linha.empresa_id, nome: linha.nome } : undefined;
    },

    async negociosDaEmpresa(workspaceId, empresaId, opcoes) {
      const filtro = opcoes.apenasAbertosForaDaLixeira ? "and situacao = 'aberto' and estado <> 'na_lixeira'" : "";
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total from plataforma.negocios where workspace_id = $1 and empresa_id = $2 ${filtro}`,
        [workspaceId, empresaId],
      );
      const itens = await cliente.query<{ id: string; titulo: string }>(
        `select id, titulo from plataforma.negocios where workspace_id = $1 and empresa_id = $2 ${filtro}
          order by criado_em, id limit 20`,
        [workspaceId, empresaId],
      );
      return { total: total.rows[0]?.total ?? 0, itens: itens.rows };
    },
  };
}
