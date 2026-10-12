/**
 * Serviço de Canais (08-03, Task 2), contra o Postgres LOCAL.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55583/postgres npx vitest run src/servicos/crm/canais.test.ts
 *
 * Fila, Origem, Canal do seed e a linha de `plataforma.workspaces` entram por
 * SQL direto: são do Espaço antigo (`plataforma.registros`), que o Canal
 * relacional ainda lê para validar referências e unicidade (A5) e que o
 * serviço avança a revisão (A4).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeCanais } from "./canais";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

async function semearRegistro(ws: string, colecao: string, id: string, dados: Record<string, unknown>): Promise<void> {
  await pool().query(
    `insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, $2, $3, $4::jsonb)
     on conflict (workspace_id, colecao, id) do update set dados = excluded.dados`,
    [ws, colecao, id, JSON.stringify({ id, ...dados })],
  );
}

async function revisao(ws: string): Promise<number> {
  const r = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws]);
  return Number(r.rows[0]!.revisao);
}

describeComBanco("ServicoDeCanais — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo, com os três Papéis e a linha de revisão. */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return { ws, admin: sessao(ws, "mem_admin"), membro: sessao(ws, "mem_ana"), convidado: sessao(ws, "mem_convidado") };
  }
  type Contexto = Awaited<ReturnType<typeof espaco>>;

  const criar = async (c: Contexto, nome: string, identificador: string, extras: { filaPadraoId?: string; origemPadraoId?: string } = {}) =>
    servico.criar(c.admin, { provedor: "whatsapp-cloud", nome, identificador, ...extras });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  describe("Fila e Origem padrão (D-07)", () => {
    it("aceita Fila e Origem ativas do Espaço e as grava", async () => {
      const c = await espaco("refs");
      await semearRegistro(c.ws, "queues", "fila_1", { lifecycle: "ativo" });
      await semearRegistro(c.ws, "catalog", "origem_1", { kind: "origem", lifecycle: "ativo" });
      const canal = valor(await criar(c, "Comercial", "+55 11 97777-0010", { filaPadraoId: "fila_1", origemPadraoId: "origem_1" }));
      expect(canal).toMatchObject({ filaPadraoId: "fila_1", origemPadraoId: "origem_1", conexao: "desconectada" });
    });

    it("Fila inexistente, arquivada ou de outro Espaço → 409 FILA_INVALIDA com campo", async () => {
      const c = await espaco("filainv");
      const outro = await espaco("filaoutro");
      await semearRegistro(outro.ws, "queues", "fila_de_fora", { lifecycle: "ativo" });
      await semearRegistro(c.ws, "queues", "fila_arq", { lifecycle: "arquivado" });
      for (const id of ["nao_existe", "fila_de_fora", "fila_arq"]) {
        const r = recusado(await criar(c, `Canal ${id}`, "+55 11 97777-0011", { filaPadraoId: id }));
        expect(r).toMatchObject({ status: 409, codigo: "FILA_INVALIDA", campo: "filaPadraoId" });
      }
    });

    it("Origem inexistente, de outro kind ou de outro Espaço → 409 ORIGEM_INVALIDA com campo", async () => {
      const c = await espaco("originv");
      const outro = await espaco("origoutro");
      await semearRegistro(outro.ws, "catalog", "origem_de_fora", { kind: "origem", lifecycle: "ativo" });
      await semearRegistro(c.ws, "catalog", "tag_1", { kind: "tag", lifecycle: "ativo" });
      for (const id of ["nao_existe", "origem_de_fora", "tag_1"]) {
        const r = recusado(await criar(c, `Canal ${id}`, "+55 11 97777-0012", { origemPadraoId: id }));
        expect(r).toMatchObject({ status: 409, codigo: "ORIGEM_INVALIDA", campo: "origemPadraoId" });
      }
    });
  });

  describe("unicidade entre o acervo novo e o do seed (A5)", () => {
    it("nome ou conta de um Canal antigo ativo → 409 com bloqueios.canais apontando o detentor", async () => {
      const c = await espaco("antigo");
      await semearRegistro(c.ws, "channels", "chn_antigo", {
        name: "Comercial SP",
        channelType: "whatsapp",
        externalId: "+5511987654321",
        lifecycle: "ativo",
      });
      const porNome = recusado(await criar(c, "comercial sp ", "+55 11 97777-0020"));
      expect(porNome).toMatchObject({ status: 409, codigo: "CANAL_NOME_EM_USO", campo: "nome" });
      expect(porNome.bloqueios?.canais?.[0]?.id).toBe("chn_antigo");

      const porConta = recusado(await criar(c, "Outro nome", "+55 11 98765-4321"));
      expect(porConta).toMatchObject({ status: 409, codigo: "CANAL_CONTA_EM_USO", campo: "identificador" });
      expect(porConta.bloqueios?.canais?.[0]?.id).toBe("chn_antigo");
    });

    it("um Canal antigo arquivado não bloqueia", async () => {
      const c = await espaco("antigoarq");
      await semearRegistro(c.ws, "channels", "chn_arq", {
        name: "Velho",
        channelType: "whatsapp",
        externalId: "+5511955550001",
        lifecycle: "arquivado",
      });
      valor(await criar(c, "Velho", "+55 11 95555-0001"));
    });

    it("renomear para o nome de um Canal antigo ativo → 409 CANAL_NOME_EM_USO", async () => {
      const c = await espaco("renomear");
      await semearRegistro(c.ws, "channels", "chn_antigo", {
        name: "Vendas",
        channelType: "email",
        externalId: "v@x.com",
        lifecycle: "ativo",
      });
      const canal = valor(await criar(c, "Comercial", "+55 11 97777-0021"));
      const r = recusado(await servico.editar(c.admin, canal.id, { nome: "vendas" }));
      expect(r).toMatchObject({ status: 409, codigo: "CANAL_NOME_EM_USO" });
      expect(r.bloqueios?.canais?.[0]?.id).toBe("chn_antigo");
    });

    it("renomear para o próprio nome (outra caixa) ou para o de um Canal novo repetido", async () => {
      const c = await espaco("renomear2");
      const a = valor(await criar(c, "Alfa", "+55 11 97777-0022"));
      valor(await criar(c, "Beta", "+55 11 97777-0023"));
      valor(await servico.editar(c.admin, a.id, { nome: "ALFA" }));
      const r = recusado(await servico.editar(c.admin, a.id, { nome: "beta" }));
      expect(r).toMatchObject({ status: 409, codigo: "CANAL_NOME_EM_USO" });
    });
  });

  describe("conexão em dois atos (D-08)", () => {
    it("simular conecta marcando; desconectar volta e apaga a marca; simular duas vezes → 409 TRANSICAO_INVALIDA", async () => {
      const c = await espaco("conexao");
      const nasceu = valor(await criar(c, "Comercial", "+55 11 97777-0030"));
      expect(nasceu).toMatchObject({ conexao: "desconectada", conexaoSimulada: false, conectadaEm: null });

      const conectado = valor(await servico.simularConexao(c.admin, nasceu.id));
      expect(conectado).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
      expect(conectado.conectadaEm).not.toBeNull();

      expect(recusado(await servico.simularConexao(c.admin, nasceu.id))).toMatchObject({
        status: 409,
        codigo: "TRANSICAO_INVALIDA",
      });

      const desconectado = valor(await servico.desconectar(c.admin, nasceu.id));
      expect(desconectado).toMatchObject({ conexao: "desconectada", conexaoSimulada: false, conectadaEm: null });

      expect(recusado(await servico.desconectar(c.admin, nasceu.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
    });

    it("um Canal com_erro também conecta", async () => {
      const c = await espaco("comerro");
      const nasceu = valor(await criar(c, "Comercial", "+55 11 97777-0031"));
      await pool().query("update plataforma.canais set conexao = 'com_erro' where id = $1", [nasceu.id]);
      expect(valor(await servico.simularConexao(c.admin, nasceu.id))).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
    });
  });

  describe("arquivar (11.1)", () => {
    it("arquiva desconectando na mesma linha, libera o número e bloqueia a edição", async () => {
      const c = await espaco("arquivar");
      const nasceu = valor(await criar(c, "Comercial", "+55 11 97777-0040"));
      valor(await servico.simularConexao(c.admin, nasceu.id));

      const arquivado = valor(await servico.arquivar(c.admin, nasceu.id));
      expect(arquivado).toMatchObject({ estado: "arquivado", conexao: "desconectada", conexaoSimulada: false });
      expect(arquivado.arquivadoEm).not.toBeNull();

      valor(await criar(c, "Comercial", "+55 11 97777-0040"));

      expect(recusado(await servico.editar(c.admin, nasceu.id, { nome: "Outro" }))).toMatchObject({
        status: 409,
        codigo: "CANAL_ARQUIVADO",
      });
      expect(recusado(await servico.simularConexao(c.admin, nasceu.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
      expect(recusado(await servico.arquivar(c.admin, nasceu.id))).toMatchObject({ status: 409, codigo: "TRANSICAO_INVALIDA" });
    });
  });

  describe("editar (INV-CXE-02)", () => {
    it("muda nome, Fila e Origem; null limpa o padrão", async () => {
      const c = await espaco("editar");
      await semearRegistro(c.ws, "queues", "fila_1", { lifecycle: "ativo" });
      await semearRegistro(c.ws, "catalog", "origem_1", { kind: "origem", lifecycle: "ativo" });
      const nasceu = valor(await criar(c, "Comercial", "+55 11 97777-0050"));
      const editado = valor(await servico.editar(c.admin, nasceu.id, { nome: "Vendas", filaPadraoId: "fila_1", origemPadraoId: "origem_1" }));
      expect(editado).toMatchObject({ nome: "Vendas", filaPadraoId: "fila_1", origemPadraoId: "origem_1", tipo: "whatsapp" });
      const limpo = valor(await servico.editar(c.admin, nasceu.id, { filaPadraoId: null }));
      expect(limpo).toMatchObject({ nome: "Vendas", filaPadraoId: null, origemPadraoId: "origem_1" });
    });

    it("Fila inválida na edição → 409 FILA_INVALIDA; nome em branco → 400 com campo", async () => {
      const c = await espaco("editarinv");
      const nasceu = valor(await criar(c, "Comercial", "+55 11 97777-0051"));
      expect(recusado(await servico.editar(c.admin, nasceu.id, { filaPadraoId: "nao_existe" }))).toMatchObject({
        status: 409,
        codigo: "FILA_INVALIDA",
        campo: "filaPadraoId",
      });
      expect(recusado(await servico.editar(c.admin, nasceu.id, { nome: "   " }))).toMatchObject({
        status: 400,
        codigo: "VALOR_INVALIDO",
        campo: "nome",
      });
    });
  });

  describe("revisão do Espaço (A4)", () => {
    it("cada escrita bem-sucedida soma 1; uma recusa não soma", async () => {
      const c = await espaco("revisao");
      const inicial = await revisao(c.ws);
      const canal = valor(await criar(c, "Comercial", "+55 11 97777-0060"));
      expect(await revisao(c.ws)).toBe(inicial + 1);
      valor(await servico.editar(c.admin, canal.id, { nome: "Vendas" }));
      expect(await revisao(c.ws)).toBe(inicial + 2);
      valor(await servico.simularConexao(c.admin, canal.id));
      expect(await revisao(c.ws)).toBe(inicial + 3);
      valor(await servico.desconectar(c.admin, canal.id));
      expect(await revisao(c.ws)).toBe(inicial + 4);
      valor(await servico.arquivar(c.admin, canal.id));
      expect(await revisao(c.ws)).toBe(inicial + 5);

      recusado(await servico.arquivar(c.admin, canal.id));
      recusado(await criar(c, "Duplicado", "bobagem"));
      recusado(await servico.editar(c.admin, canal.id, { nome: "X" }));
      expect(await revisao(c.ws)).toBe(inicial + 5);
    });

    it("um Espaço sem linha em plataforma.workspaces não falha", async () => {
      const c = await espaco("semlinha");
      await pool().query("delete from plataforma.workspaces where workspace_id = $1", [c.ws]);
      valor(await criar(c, "Comercial", "+55 11 97777-0061"));
    });
  });

  describe("Papel (B35) e isolamento entre Espaços", () => {
    it("Membro e Convidado recebem 403 em criar, editar, simular, desconectar e arquivar; todos leem", async () => {
      const c = await espaco("papel");
      const canal = valor(await criar(c, "Comercial", "+55 11 97777-0070"));
      for (const quem of [c.membro, c.convidado]) {
        const todas = [
          await servico.criar(quem, { provedor: "email-imap-smtp", nome: "X", identificador: "x@y.co" }),
          await servico.editar(quem, canal.id, { nome: "Y" }),
          await servico.simularConexao(quem, canal.id),
          await servico.desconectar(quem, canal.id),
          await servico.arquivar(quem, canal.id),
        ];
        for (const r of todas) expect(recusado(r)).toMatchObject({ status: 403, codigo: "PERMISSAO" });
        expect(valor(await servico.obter(quem, canal.id)).id).toBe(canal.id);
      }
      expect((await pool().query("select nome, estado, conexao from plataforma.canais where id = $1", [canal.id])).rows[0]).toEqual({
        nome: "Comercial",
        estado: "ativo",
        conexao: "desconectada",
      });
    });

    it("id de outro Espaço → 404 CANAL_NAO_ENCONTRADO em toda operação", async () => {
      const a = await espaco("espacoA");
      const b = await espaco("espacoB");
      const canal: Canal = valor(await criar(a, "Comercial", "+55 11 97777-0071"));
      const respostas = [
        await servico.obter(b.admin, canal.id),
        await servico.editar(b.admin, canal.id, { nome: "Y" }),
        await servico.simularConexao(b.admin, canal.id),
        await servico.desconectar(b.admin, canal.id),
        await servico.arquivar(b.admin, canal.id),
      ];
      for (const r of respostas) expect(recusado(r)).toMatchObject({ status: 404, codigo: "CANAL_NAO_ENCONTRADO" });
    });
  });

  describe("listar com filtros", () => {
    it("filtra por tipo, provedor, conexão e q (com % e _ literais)", async () => {
      const c = await espaco("listar");
      const wa = valor(await criar(c, "Suporte 50%", "+55 11 97777-0080"));
      valor(await servico.criar(c.admin, { provedor: "email-imap-smtp", nome: "Caixa", identificador: "c@x.co" }));
      valor(await servico.simularConexao(c.admin, wa.id));
      const base = { estado: "ativo" as const, limite: 50, deslocamento: 0 };
      const ler = async (filtro: object) => valor(await servico.listar(c.admin, { ...base, ...filtro })).itens.map((i) => i.nome);
      expect(await ler({})).toEqual(["Caixa", "Suporte 50%"]);
      expect(await ler({ tipo: "email" })).toEqual(["Caixa"]);
      expect(await ler({ provedor: "whatsapp-cloud" })).toEqual(["Suporte 50%"]);
      expect(await ler({ conexao: "conectada" })).toEqual(["Suporte 50%"]);
      expect(await ler({ conexao: "desconectada" })).toEqual(["Caixa"]);
      expect(await ler({ q: "50%" })).toEqual(["Suporte 50%"]);
      expect(await ler({ q: "%" })).toEqual(["Suporte 50%"]);
      expect(await ler({ q: "_" })).toEqual([]);
    });
  });
});
