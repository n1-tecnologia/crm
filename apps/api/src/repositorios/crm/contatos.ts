/**
 * Repositório de Contatos — inaugura `repositorios/`: uma interface por
 * agregado, a implementação `pg` atrás dela.
 *
 * Regras que valem em todo método:
 *   - todo `WHERE` leva `workspace_id = $1` (D-10, T-07-01): o Espaço vem do
 *     serviço, que o tira da sessão; nada aqui o deduz de outro lugar;
 *   - valores sempre `$n`, nunca interpolados (T-07-05); a ordenação é fixa;
 *   - `date` volta como texto (`::text`, Pitfall 5) — nunca
 *     `types.setTypeParser` global, que mudaria o resto da api;
 *   - `atualizado_em` é do trigger da 007; os ids vêm do
 *     `default gen_random_uuid()::text`.
 */

import type { Pool, PoolClient } from "pg";
import type { CamposAdicionais, Endereco, EstadoCrm, ModoDeCriacao, Pagina } from "@n1/dominio/crm/comum";
import {
  nomeDeExibicaoDoContato,
  type Contato,
  type ContatoResumo,
  type EdicaoDeContato,
  type IdentificadorDeContato,
  type NovoContato,
  type TipoIdentificadorContato,
} from "@n1/dominio/crm/contatos";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";

export type LinhaDeContato = Omit<NovoContato, "identificadores" | "proprietarioId"> & {
  readonly proprietarioId: string;
  readonly criadoPor: string;
};

export interface FiltroDeContatos {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

/** Quem já tem o Identificador (RN-CON-11): o nome é o de exibição, derivado. */
export interface DetentorDeIdentificador {
  readonly contatoId: string;
  readonly nome: string;
}

export interface NegociosDoContato {
  readonly total: number;
  /** Até 20, para a tela listar; `total` é o de todos. */
  readonly itens: readonly { readonly id: string; readonly titulo: string }[];
}

export interface ConversasDoContato {
  readonly total: number;
  /** Até 5, as mais novas primeiro; `total` é o de todas. */
  readonly itens: readonly { readonly id: string; readonly titulo: string }[];
}

export interface LinhaDeIdentificador {
  readonly tipo: TipoIdentificadorContato;
  readonly valor: string;
  readonly valorExibido?: string | undefined;
  readonly rotuloCanal?: string | undefined;
  readonly principal: boolean;
}

export interface CamposDeIdentificador {
  readonly principal?: boolean | undefined;
  readonly verificado?: boolean | undefined;
  readonly valorExibido?: string | undefined;
  readonly rotuloCanal?: string | undefined;
}

export interface RepositorioDeContatos {
  inserir(workspaceId: string, linha: LinhaDeContato): Promise<Contato>;
  /** `travar` faz `select ... for update`: a transação segura o registro contra corrida. */
  obter(workspaceId: string, id: string, opcoes?: { readonly travar?: boolean }): Promise<Contato | undefined>;
  listar(workspaceId: string, filtro: FiltroDeContatos): Promise<Pagina<ContatoResumo>>;
  /** Só as colunas presentes em `campos`; texto vazio limpa a coluna. */
  atualizar(workspaceId: string, id: string, campos: EdicaoDeContato): Promise<Contato | undefined>;
  definirEstado(workspaceId: string, id: string, estado: EstadoCrm): Promise<Contato | undefined>;
  excluir(workspaceId: string, id: string): Promise<boolean>;

  listarIdentificadores(workspaceId: string, contatoId: string): Promise<IdentificadorDeContato[]>;
  obterIdentificador(workspaceId: string, contatoId: string, identificadorId: string): Promise<IdentificadorDeContato | undefined>;
  inserirIdentificador(workspaceId: string, contatoId: string, linha: LinhaDeIdentificador): Promise<IdentificadorDeContato>;
  atualizarIdentificador(workspaceId: string, identificadorId: string, campos: CamposDeIdentificador): Promise<void>;
  /** Tira a marca de principal do Identificador atual do tipo (INV-CON-03). */
  rebaixarPrincipal(workspaceId: string, contatoId: string, tipo: TipoIdentificadorContato): Promise<void>;
  removerIdentificador(workspaceId: string, identificadorId: string): Promise<void>;
  detentorDoIdentificador(workspaceId: string, tipo: TipoIdentificadorContato, valor: string): Promise<DetentorDeIdentificador | undefined>;

  /** Somente leitura de `plataforma.negocios` — a escrita de Negócio é de 07-08. */
  negociosDoContato(workspaceId: string, contatoId: string, opcoes: { readonly incluirLixeira: boolean }): Promise<NegociosDoContato>;
  /** Somente leitura de `plataforma.conversas` (008): total e até 5 Conversas, as mais novas primeiro. */
  conversasDoContato(workspaceId: string, contatoId: string): Promise<ConversasDoContato>;
}

/** As colunas de `plataforma.contatos` na forma que `linhaParaContato` lê (data como texto). */
const COLUNAS = `id, nome, sobrenome, data_nascimento::text as data_nascimento, idioma, fuso_horario,
  foto_url, descricao, enderecos, campos_adicionais, origem, qualificacao, modo_criacao, estado,
  proprietario_id, criado_por, criado_em, atualizado_em`;

interface LinhaDoBanco {
  readonly id: string;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  readonly data_nascimento: string | null;
  readonly idioma: string | null;
  readonly fuso_horario: string | null;
  readonly foto_url: string | null;
  readonly descricao: string | null;
  readonly enderecos: Endereco[];
  readonly campos_adicionais: CamposAdicionais;
  readonly origem: string | null;
  readonly qualificacao: string | null;
  readonly modo_criacao: ModoDeCriacao;
  readonly estado: EstadoCrm;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: Date;
  readonly atualizado_em: Date;
}

/** snake_case → camelCase; `Date` → ISO 8601. */
export function linhaParaContato(linha: LinhaDoBanco): Contato {
  return {
    id: linha.id,
    nome: linha.nome,
    sobrenome: linha.sobrenome,
    dataNascimento: linha.data_nascimento,
    idioma: linha.idioma,
    fusoHorario: linha.fuso_horario,
    fotoUrl: linha.foto_url,
    descricao: linha.descricao,
    enderecos: linha.enderecos,
    camposAdicionais: linha.campos_adicionais,
    origem: linha.origem,
    qualificacao: linha.qualificacao,
    modoCriacao: linha.modo_criacao,
    estado: linha.estado,
    proprietarioId: linha.proprietario_id,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em.toISOString(),
    atualizadoEm: linha.atualizado_em.toISOString(),
  };
}

const COLUNAS_IDENTIFICADOR = "id, contato_id, tipo, valor, valor_exibido, rotulo_canal, verificado, principal, criado_em";

interface LinhaDeIdentificadorNoBanco {
  readonly id: string;
  readonly contato_id: string;
  readonly tipo: TipoIdentificadorContato;
  readonly valor: string;
  readonly valor_exibido: string | null;
  readonly rotulo_canal: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criado_em: Date;
}

function linhaParaIdentificador(linha: LinhaDeIdentificadorNoBanco): IdentificadorDeContato {
  return {
    id: linha.id,
    contatoId: linha.contato_id,
    tipo: linha.tipo,
    valor: linha.valor,
    valorExibido: linha.valor_exibido,
    rotuloCanal: linha.rotulo_canal,
    verificado: linha.verificado,
    principal: linha.principal,
    criadoEm: linha.criado_em.toISOString(),
  };
}

/** Texto vazio (depois de aparado) é "sem valor" no banco. */
const textoOuNulo = (texto: string): string | null => (texto.trim() === "" ? null : texto);

export function criarRepositorioDeContatosPg(cliente: Pool | PoolClient): RepositorioDeContatos {
  return {
    async inserir(workspaceId, linha) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `insert into plataforma.contatos
           (workspace_id, nome, sobrenome, data_nascimento, idioma, fuso_horario, foto_url, descricao,
            enderecos, campos_adicionais, origem, qualificacao, modo_criacao, proprietario_id, criado_por)
         values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15)
         returning ${COLUNAS}`,
        [
          workspaceId,
          linha.nome ?? null,
          linha.sobrenome ?? null,
          linha.dataNascimento ?? null,
          linha.idioma ?? null,
          linha.fusoHorario ?? null,
          linha.fotoUrl ?? null,
          linha.descricao ?? null,
          JSON.stringify(linha.enderecos ?? []),
          JSON.stringify(linha.camposAdicionais ?? {}),
          linha.origem ?? null,
          linha.qualificacao ?? null,
          linha.modoCriacao ?? "manual",
          linha.proprietarioId,
          linha.criadoPor,
        ],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Contato não devolveu a linha.");
      return linhaParaContato(inserida);
    },

    async obter(workspaceId, id, opcoes) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `select ${COLUNAS} from plataforma.contatos where workspace_id = $1 and id = $2${opcoes?.travar ? " for update" : ""}`,
        [workspaceId, id],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaContato(linha) : undefined;
    },

    async listar(workspaceId, filtro) {
      const parametros: unknown[] = [workspaceId, filtro.estado];
      let busca = "";
      const texto = filtro.q?.trim() ?? "";
      if (texto !== "") {
        parametros.push(contemTexto(texto));
        const p = `$${parametros.length}`;
        busca = `and (concat_ws(' ', c.nome, c.sobrenome) ilike ${p} ${CLAUSULA_ESCAPE}
                  or exists (select 1 from plataforma.contato_identificadores bi
                              where bi.workspace_id = c.workspace_id and bi.contato_id = c.id
                                and bi.valor ilike ${p} ${CLAUSULA_ESCAPE}))`;
      }
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total from plataforma.contatos c where c.workspace_id = $1 and c.estado = $2 ${busca}`,
        parametros,
      );
      parametros.push(filtro.limite, filtro.deslocamento);
      const pagina = await cliente.query<LinhaDoBanco & { email_principal: string | null; telefone_principal: string | null }>(
        `select ${COLUNAS},
                (select i.valor from plataforma.contato_identificadores i
                  where i.workspace_id = c.workspace_id and i.contato_id = c.id
                    and i.principal and i.tipo = 'email') as email_principal,
                (select i.valor from plataforma.contato_identificadores i
                  where i.workspace_id = c.workspace_id and i.contato_id = c.id
                    and i.principal and i.tipo = 'telefone') as telefone_principal
           from plataforma.contatos c
          where c.workspace_id = $1 and c.estado = $2 ${busca}
          order by c.atualizado_em desc, c.id
          limit $${parametros.length - 1} offset $${parametros.length}`,
        parametros,
      );
      return {
        total: total.rows[0]?.total ?? 0,
        itens: pagina.rows.map((linha) => {
          const contato = linhaParaContato(linha);
          return {
            id: contato.id,
            nomeDeExibicao: nomeDeExibicaoDoContato(contato, linha.email_principal ?? linha.telefone_principal),
            estado: contato.estado,
            proprietarioId: contato.proprietarioId,
            emailPrincipal: linha.email_principal,
            telefonePrincipal: linha.telefone_principal,
            atualizadoEm: contato.atualizadoEm,
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
      if (campos.nome !== undefined) definir("nome", textoOuNulo(campos.nome));
      if (campos.sobrenome !== undefined) definir("sobrenome", textoOuNulo(campos.sobrenome));
      if (campos.dataNascimento !== undefined) definir("data_nascimento", textoOuNulo(campos.dataNascimento), "::date");
      if (campos.idioma !== undefined) definir("idioma", textoOuNulo(campos.idioma));
      if (campos.fusoHorario !== undefined) definir("fuso_horario", textoOuNulo(campos.fusoHorario));
      if (campos.fotoUrl !== undefined) definir("foto_url", textoOuNulo(campos.fotoUrl));
      if (campos.descricao !== undefined) definir("descricao", textoOuNulo(campos.descricao));
      if (campos.enderecos !== undefined) definir("enderecos", JSON.stringify(campos.enderecos), "::jsonb");
      if (campos.camposAdicionais !== undefined) {
        definir("campos_adicionais", JSON.stringify(campos.camposAdicionais), "::jsonb");
      }
      if (campos.origem !== undefined) definir("origem", textoOuNulo(campos.origem));
      if (campos.qualificacao !== undefined) definir("qualificacao", textoOuNulo(campos.qualificacao));
      if (campos.proprietarioId !== undefined) definir("proprietario_id", campos.proprietarioId);
      if (definicoes.length === 0) return this.obter(workspaceId, id);
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.contatos set ${definicoes.join(", ")} where workspace_id = $1 and id = $2 returning ${COLUNAS}`,
        valores,
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaContato(linha) : undefined;
    },

    async definirEstado(workspaceId, id, estado) {
      const resultado = await cliente.query<LinhaDoBanco>(
        `update plataforma.contatos set estado = $3 where workspace_id = $1 and id = $2 returning ${COLUNAS}`,
        [workspaceId, id, estado],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaContato(linha) : undefined;
    },

    async excluir(workspaceId, id) {
      const resultado = await cliente.query("delete from plataforma.contatos where workspace_id = $1 and id = $2", [workspaceId, id]);
      return (resultado.rowCount ?? 0) > 0;
    },

    async listarIdentificadores(workspaceId, contatoId) {
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `select ${COLUNAS_IDENTIFICADOR} from plataforma.contato_identificadores
          where workspace_id = $1 and contato_id = $2 order by criado_em, id`,
        [workspaceId, contatoId],
      );
      return resultado.rows.map(linhaParaIdentificador);
    },

    async obterIdentificador(workspaceId, contatoId, identificadorId) {
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `select ${COLUNAS_IDENTIFICADOR} from plataforma.contato_identificadores
          where workspace_id = $1 and contato_id = $2 and id = $3`,
        [workspaceId, contatoId, identificadorId],
      );
      const linha = resultado.rows[0];
      return linha ? linhaParaIdentificador(linha) : undefined;
    },

    async inserirIdentificador(workspaceId, contatoId, linha) {
      // `clock_timestamp()` e não o `now()` da coluna: dois Identificadores da mesma transação
      // precisam de `criado_em` distintos para "o mais antigo" ter ordem definida.
      const resultado = await cliente.query<LinhaDeIdentificadorNoBanco>(
        `insert into plataforma.contato_identificadores
           (workspace_id, contato_id, tipo, valor, valor_exibido, rotulo_canal, principal, criado_em)
         values ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())
         returning ${COLUNAS_IDENTIFICADOR}`,
        [workspaceId, contatoId, linha.tipo, linha.valor, linha.valorExibido ?? null, linha.rotuloCanal ?? null, linha.principal],
      );
      const inserida = resultado.rows[0];
      if (!inserida) throw new Error("O INSERT de Identificador não devolveu a linha.");
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
      if (campos.valorExibido !== undefined) definir("valor_exibido", textoOuNulo(campos.valorExibido));
      if (campos.rotuloCanal !== undefined) definir("rotulo_canal", textoOuNulo(campos.rotuloCanal));
      if (definicoes.length === 0) return;
      await cliente.query(
        `update plataforma.contato_identificadores set ${definicoes.join(", ")} where workspace_id = $1 and id = $2`,
        valores,
      );
    },

    async rebaixarPrincipal(workspaceId, contatoId, tipo) {
      await cliente.query(
        `update plataforma.contato_identificadores set principal = false
          where workspace_id = $1 and contato_id = $2 and tipo = $3 and principal`,
        [workspaceId, contatoId, tipo],
      );
    },

    async removerIdentificador(workspaceId, identificadorId) {
      await cliente.query("delete from plataforma.contato_identificadores where workspace_id = $1 and id = $2", [
        workspaceId,
        identificadorId,
      ]);
    },

    async detentorDoIdentificador(workspaceId, tipo, valor) {
      const resultado = await cliente.query<{ contato_id: string; nome: string | null; sobrenome: string | null }>(
        `select i.contato_id, c.nome, c.sobrenome
           from plataforma.contato_identificadores i
           join plataforma.contatos c on c.workspace_id = i.workspace_id and c.id = i.contato_id
          where i.workspace_id = $1 and i.tipo = $2 and i.valor = $3`,
        [workspaceId, tipo, valor],
      );
      const linha = resultado.rows[0];
      if (!linha) return undefined;
      return { contatoId: linha.contato_id, nome: nomeDeExibicaoDoContato(linha, valor) };
    },

    async negociosDoContato(workspaceId, contatoId, opcoes) {
      const filtro = opcoes.incluirLixeira ? "" : "and estado <> 'na_lixeira'";
      const total = await cliente.query<{ total: number }>(
        `select count(*)::int as total from plataforma.negocios where workspace_id = $1 and contato_id = $2 ${filtro}`,
        [workspaceId, contatoId],
      );
      const itens = await cliente.query<{ id: string; titulo: string }>(
        `select id, titulo from plataforma.negocios where workspace_id = $1 and contato_id = $2 ${filtro}
          order by criado_em, id limit 20`,
        [workspaceId, contatoId],
      );
      return { total: total.rows[0]?.total ?? 0, itens: itens.rows };
    },

    async conversasDoContato(workspaceId, contatoId) {
      const total = await cliente.query<{ total: number }>(
        "select count(*)::int as total from plataforma.conversas where workspace_id = $1 and contato_id = $2",
        [workspaceId, contatoId],
      );
      const itens = await cliente.query<{ id: string; titulo: string }>(
        `select id, titulo from plataforma.conversas where workspace_id = $1 and contato_id = $2
          order by criado_em desc, id limit 5`,
        [workspaceId, contatoId],
      );
      return { total: total.rows[0]?.total ?? 0, itens: itens.rows };
    },
  };
}
