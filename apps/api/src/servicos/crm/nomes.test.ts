/**
 * Serviço de nomes do CRM novo em lote (15-10, 3.4.9 e 3.4.10, UCR-08), contra o
 * Postgres LOCAL.
 *
 * O traçador: o nome de um Negócio da tabela sai de `nomes`, e o que é de outro
 * Espaço ou de um tipo que o Papel não lê volta `null`, na ordem pedida (T-15-29).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NOMES_MAXIMO, type AlvoDoCrm } from "@n1/dominio/crm/nomes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg, type AcessoAoCrm } from "./acesso";
import { criarServicoDeNomes } from "./nomes";
import type { ResultadoCrm } from "./resultado";

// A matriz de hoje (`podeNoCrm`) não tem Papel que leia um recurso e não outro. Para provar que o nome
// é negado POR TIPO, o Convidado perde `ler` em `negocio` só neste arquivo; o resto da matriz é a de verdade.
vi.mock("@n1/dominio/crm/permissoes", async (original) => {
  const real = await original<typeof import("@n1/dominio/crm/permissoes")>();
  return {
    ...real,
    podeNoCrm: ((base, estado, acao, recurso, contexto) =>
      base === "convidado" && acao === "ler" && recurso === "negocio"
        ? "O Convidado não consulta Negócios (papel de teste)."
        : real.podeNoCrm(base, estado, acao, recurso, contexto)) satisfies typeof real.podeNoCrm,
  };
});

const acesso = criarAcessoAoCrmPg(pool);
const servico = criarServicoDeNomes({ pool, acesso });

function membro(workspaceId: string, id = "mem_ana"): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeNomes — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcnomes");
  const outroWs = novoEspacoDeTeste("svcnomesb");
  const eu = membro(ws);

  async function inserir(sql: string, parametros: readonly unknown[]): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(sql, [...parametros]);
    return rows[0]!.id;
  }

  const semearContato = (workspaceId: string, nome: string | null, sobrenome: string | null = null, estado = "ativo", id?: string) =>
    inserir(
      `insert into plataforma.contatos (workspace_id, id, nome, sobrenome, estado, proprietario_id, criado_por)
       values ($1, coalesce($5, gen_random_uuid()::text), $2, $3, $4, 'mem_ana', 'mem_ana') returning id`,
      [workspaceId, nome, sobrenome, estado, id ?? null],
    );

  /** Empresa por SQL. O banco exige um Contato admin vigente (trigger deferido): o admin entra na mesma instrução. */
  const semearEmpresa = async (workspaceId: string, nomeFantasia: string | null, razaoSocial: string | null = null) => {
    const adminId = await semearContato(workspaceId, "Admin da Empresa");
    return inserir(
      `with nova as (
         insert into plataforma.empresas (workspace_id, nome_fantasia, razao_social, proprietario_id, criado_por)
         values ($1, $2, $3, 'mem_ana', 'mem_ana') returning id
       ), vinculo as (
         insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por)
         select $1, $4, id, true, 'mem_ana' from nova
       )
       select id from nova`,
      [workspaceId, nomeFantasia, razaoSocial, adminId],
    );
  };

  const semearFunil = (workspaceId: string, nome: string) =>
    inserir(`insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, $2, 'mem_ana') returning id`, [workspaceId, nome]);

  /** Negócio por SQL: o serviço de Negócios não é o assunto aqui. Cria o Funil e a Etapa que ele exige. */
  async function semearNegocio(workspaceId: string, titulo: string, contatoId: string, id?: string): Promise<string> {
    const funilId = await semearFunil(workspaceId, `Funil de ${titulo}`);
    const etapaId = await inserir(
      `insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Inicio', 1) returning id`,
      [workspaceId, funilId],
    );
    return inserir(
      `insert into plataforma.negocios (workspace_id, id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por)
       values ($1, coalesce($6, gen_random_uuid()::text), $2, $3, $4, $5, 'mem_ana', 'mem_ana') returning id`,
      [workspaceId, titulo, contatoId, funilId, etapaId, id ?? null],
    );
  }

  const semearConversa = (workspaceId: string, titulo: string, canalId: string, contatoId: string) =>
    inserir(
      `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, $4, 'membro', 'mem_ana') returning id`,
      [workspaceId, canalId, contatoId, titulo],
    );

  const revisaoDe = async (workspaceId: string) =>
    (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [workspaceId])).rows[0]?.revisao;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    await semearMembro(ws, { id: "mem_saiu", base: "membro", state: "removido" });
    await semearMembro(outroWs, { id: "mem_ana", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) traçador: o título do Negócio da tabela sai na ordem pedida, e o de outro Espaço ou desconhecido volta null", async () => {
    const contatoNosso = await semearContato(ws, "Cliente do traçador");
    const negocioId = await semearNegocio(ws, "Proposta Acme", contatoNosso);
    const contatoDeFora = await semearContato(outroWs, "Contato de OUTRO Espaço");

    const alvos: AlvoDoCrm[] = [
      { tipo: "deal", id: negocioId },
      { tipo: "contact", id: contatoDeFora },
      { tipo: "deal", id: "nao-existe" },
    ];
    const nomes = valor(await servico.nomes(eu, alvos));

    expect(nomes).toEqual([
      { tipo: "deal", id: negocioId, nome: "Proposta Acme" },
      { tipo: "contact", id: contatoDeFora, nome: null },
      { tipo: "deal", id: "nao-existe", nome: null },
    ]);
  });

  it("(b) Papel sem `ler` num tipo: aquele tipo volta null (nunca 403 por item) e os outros continuam com nome", async () => {
    const contatoId = await semearContato(ws, "Maria", "Silva");
    const negocioId = await semearNegocio(ws, "Negócio protegido", contatoId);
    const convidado = membro(ws, "mem_convidado");

    const nomes = valor(
      await servico.nomes(convidado, [
        { tipo: "deal", id: negocioId },
        { tipo: "contact", id: contatoId },
      ]),
    );
    expect(nomes).toEqual([
      { tipo: "deal", id: negocioId, nome: null },
      { tipo: "contact", id: contatoId, nome: "Maria Silva" },
    ]);

    // E quem pode ler o recebe: o null veio do Papel, não do dado.
    expect(valor(await servico.nomes(eu, [{ tipo: "deal", id: negocioId }]))[0]?.nome).toBe("Negócio protegido");
  });

  it("(c) os seis tipos têm nome: Contato (nome e sobrenome), Empresa (fantasia, senão razão social), Negócio, Conversa, Funil e Canal", async () => {
    const contatoId = await semearContato(ws, "Joana", "Prado");
    const empresaFantasia = await semearEmpresa(ws, "Padaria Sol", "Sol Alimentos LTDA");
    const empresaSoRazao = await semearEmpresa(ws, null, "Razão Social Pura SA");
    const funilId = await semearFunil(ws, "Funil de Vendas");
    const canalId = await semearCanal(ws, { nome: "WhatsApp Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511999990001" });
    const conversaId = await semearConversa(ws, "Dúvida sobre o plano", canalId, contatoId);
    const negocioId = await semearNegocio(ws, "Renovação anual", contatoId);

    const nomes = valor(
      await servico.nomes(eu, [
        { tipo: "contact", id: contatoId },
        { tipo: "company", id: empresaFantasia },
        { tipo: "company", id: empresaSoRazao },
        { tipo: "deal", id: negocioId },
        { tipo: "conversation", id: conversaId },
        { tipo: "funnel", id: funilId },
        { tipo: "channel", id: canalId },
      ]),
    );
    expect(nomes.map((n) => n.nome)).toEqual([
      "Joana Prado",
      "Padaria Sol",
      "Razão Social Pura SA",
      "Renovação anual",
      "Dúvida sobre o plano",
      "Funil de Vendas",
      "WhatsApp Comercial",
    ]);
  });

  it("(d) o mesmo id em dois Espaços responde o nome do Espaço da sessão, e quem é do outro Espaço enxerga o dele (T-15-29)", async () => {
    const id = "contato-com-id-compartilhado";
    await semearContato(ws, "Nome do Espaço A", null, "ativo", id);
    await semearContato(outroWs, "Nome do Espaço B", null, "ativo", id);

    expect(valor(await servico.nomes(eu, [{ tipo: "contact", id }]))).toEqual([{ tipo: "contact", id, nome: "Nome do Espaço A" }]);
    expect(valor(await servico.nomes(membro(outroWs), [{ tipo: "contact", id }]))).toEqual([{ tipo: "contact", id, nome: "Nome do Espaço B" }]);
  });

  it("(e) o que está na lixeira ainda tem nome: a Auditoria e a IA mostram o objeto que foi eliminado", async () => {
    const id = await semearContato(ws, "Contato eliminado", null, "na_lixeira");
    expect(valor(await servico.nomes(eu, [{ tipo: "contact", id }]))[0]?.nome).toBe("Contato eliminado");
  });

  it("(f) Membro removido ou desconhecido não lê nada: tudo null, sem 403 por item", async () => {
    const contatoId = await semearContato(ws, "Contato do removido");
    for (const quem of [membro(ws, "mem_saiu"), membro(ws, "mem_que_nao_existe")]) {
      expect(valor(await servico.nomes(quem, [{ tipo: "contact", id: contatoId }]))).toEqual([{ tipo: "contact", id: contatoId, nome: null }]);
    }
  });

  it("(g) a mesma lista pedida duas vezes dá o mesmo resultado, e o id repetido na lista é respondido nas duas posições (UCR-08)", async () => {
    const contatoId = await semearContato(ws, "Repetido");
    const alvos: AlvoDoCrm[] = [
      { tipo: "contact", id: contatoId },
      { tipo: "funnel", id: "nao-existe" },
      { tipo: "contact", id: contatoId },
    ];
    const primeira = valor(await servico.nomes(eu, alvos));
    const segunda = valor(await servico.nomes(eu, alvos));
    expect(segunda).toEqual(primeira);
    expect(primeira.map((n) => n.nome)).toEqual(["Repetido", null, "Repetido"]);
  });

  it("(h) é leitura: não grava Atividade nem sobe a revisão do Espaço", async () => {
    const contatoId = await semearContato(ws, "Só leitura");
    const atividadesAntes = Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1", [ws])).rows[0]!.n);
    const revisaoAntes = await revisaoDe(ws);

    valor(await servico.nomes(eu, [{ tipo: "contact", id: contatoId }]));

    const atividadesDepois = Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.crm_atividades where workspace_id = $1", [ws])).rows[0]!.n);
    expect(atividadesDepois).toBe(atividadesAntes);
    expect(await revisaoDe(ws)).toBe(revisaoAntes);
  });

  it("(i) lista vazia não vai ao banco; mais que o teto é 400 e tipo desconhecido é 400", async () => {
    const semBanco = criarServicoDeNomes({
      pool: () => {
        throw new Error("a lista vazia não pode abrir conexão");
      },
      acesso: {
        papelDe: () => {
          throw new Error("a lista vazia não precisa nem do Papel");
        },
        membroAtivo: () => {
          throw new Error("a lista vazia não precisa nem do Membro");
        },
      } satisfies AcessoAoCrm,
    });
    expect(valor(await semBanco.nomes(eu, []))).toEqual([]);

    const demais = Array.from({ length: NOMES_MAXIMO + 1 }, (_, i) => ({ tipo: "contact" as const, id: `c-${i}` }));
    expect(await servico.nomes(eu, demais)).toMatchObject({ ok: false, status: 400, campo: "alvos" });

    const torto = [{ tipo: "tarefa", id: "x" }] as unknown as AlvoDoCrm[];
    expect(await servico.nomes(eu, torto)).toMatchObject({ ok: false, status: 400, campo: "alvos" });
  });

  it("(j) o lote de 200 ids de um tipo responde numa consulta e na ordem pedida", async () => {
    const contatoId = await semearContato(ws, "Último do lote");
    const alvos: AlvoDoCrm[] = Array.from({ length: NOMES_MAXIMO - 1 }, (_, i) => ({ tipo: "contact" as const, id: `inexistente-${i}` }));
    alvos.push({ tipo: "contact", id: contatoId });

    const nomes = valor(await servico.nomes(eu, alvos));
    expect(nomes).toHaveLength(NOMES_MAXIMO);
    expect(nomes.slice(0, -1).every((n) => n.nome === null)).toBe(true);
    expect(nomes[NOMES_MAXIMO - 1]).toEqual({ tipo: "contact", id: contatoId, nome: "Último do lote" });
  });
});
