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
  type NovoContato,
} from "@n1/dominio/crm/contatos";

export type LinhaDeContato = Omit<NovoContato, "identificadores" | "proprietarioId"> & {
  readonly proprietarioId: string;
  readonly criadoPor: string;
};

export interface RepositorioDeContatos {
  inserir(workspaceId: string, linha: LinhaDeContato): Promise<Contato>;
  listar(
    workspaceId: string,
    filtro: { readonly estado: EstadoCrm; readonly limite: number; readonly deslocamento: number },
  ): Promise<Pagina<ContatoResumo>>;
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

    async listar(workspaceId, filtro) {
      const total = await cliente.query<{ total: number }>(
        "select count(*)::int as total from plataforma.contatos where workspace_id = $1 and estado = $2",
        [workspaceId, filtro.estado],
      );
      const pagina = await cliente.query<LinhaDoBanco & { email_principal: string | null; telefone_principal: string | null }>(
        `select ${COLUNAS},
                (select i.valor from plataforma.contato_identificadores i
                  where i.workspace_id = c.workspace_id and i.contato_id = c.id
                    and i.principal and i.tipo = 'email') as email_principal,
                (select i.valor from plataforma.contato_identificadores i
                  where i.workspace_id = c.workspace_id and i.contato_id = c.id
                    and i.principal and i.tipo = 'telefone') as telefone_principal
           from plataforma.contatos c
          where c.workspace_id = $1 and c.estado = $2
          order by c.atualizado_em desc, c.id
          limit $3 offset $4`,
        [workspaceId, filtro.estado, filtro.limite, filtro.deslocamento],
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
  };
}
