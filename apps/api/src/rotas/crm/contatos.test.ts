/**
 * `GET/POST /contatos` — o traçador do CRM (07-01).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { contatos } })` (sem banco, D-DEC-09): autenticação, forma
 * do corpo (`.strict()`, T-07-02) e envelope da lista. A segunda
 * (`describeComBanco`) usa o serviço real contra o Postgres LOCAL — nunca
 * contra o banco remoto do `.env` (D-12, `testes/banco-crm.ts`) — e prova a
 * gravação em `plataforma.contatos` com o `workspace_id` da sessão (T-07-01) e
 * o isolamento entre Espaços de Trabalho.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import { buildApp } from "../../app";
import { encerrar, pool } from "../../persistencia/conexao";
import { sucesso } from "../../servicos/crm/resultado";
import type { ServicoDeContatos } from "../../servicos/crm/contatos";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../../testes/banco-crm";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };

function opcoesDeAutenticacao(workspaceId: string) {
  return {
    logger: false,
    workspaceId,
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => membros.find((m) => m.userId === userId),
  };
}

describe("rotas de Contatos — serviço falso, sem banco", () => {
  const resumo: ContatoResumo = {
    id: "c1",
    nomeDeExibicao: "Falso",
    estado: "ativo",
    proprietarioId: "mem_maryane",
    emailPrincipal: null,
    telefonePrincipal: null,
    atualizadoEm: "2026-10-09T00:00:00.000Z",
  };
  const falso: ServicoDeContatos = {
    listar: async () => sucesso({ itens: [resumo], total: 1 }),
    criar: async () => {
      throw new Error("não deveria chegar ao serviço");
    },
  };
  const app = () => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { contatos: falso } });

  it("(a) GET /contatos sem Authorization responde 401", async () => {
    const resposta = await app().inject({ method: "GET", url: "/contatos" });
    expect(resposta.statusCode).toBe(401);
  });

  it("(b) POST /contatos com workspaceId no corpo responde 400", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana", workspaceId: "ws_de_outro" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().ok).toBe(false);
  });

  it("(b) POST /contatos com criadoPor no corpo responde 400", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana", criadoPor: "mem_outro" },
    });
    expect(resposta.statusCode).toBe(400);
  });

  it("(c) GET /contatos devolve { ok, itens, total } do serviço", async () => {
    const resposta = await app().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [resumo], total: 1 });
  });
});

describeComBanco("rotas de Contatos — serviço real, Postgres local", () => {
  const espacoA = novoEspacoDeTeste("contatosa");
  const espacoB = novoEspacoDeTeste("contatosb");
  const appA = () => buildApp(opcoesDeAutenticacao(espacoA));
  const appB = () => buildApp(opcoesDeAutenticacao(espacoB));

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    await limparEspaco(espacoA);
    await limparEspaco(espacoB);
    await encerrar();
  });

  it("(d) POST /contatos cria o Contato no Espaço da sessão, com o Membro como Proprietário e criador", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana" },
    });
    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.dados.contato.proprietarioId).toBe("mem_maryane");
    expect(corpo.dados.contato.criadoPor).toBe("mem_maryane");
    expect(corpo.dados.contato.estado).toBe("ativo");

    const gravado = await pool().query<{ workspace_id: string }>(
      "select workspace_id from plataforma.contatos where id = $1",
      [corpo.dados.contato.id],
    );
    expect(gravado.rows[0]?.workspace_id).toBe(espacoA);
  });

  it("(e) GET /contatos no Espaço A lista Ana com o nome de exibição", async () => {
    const resposta = await appA().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json();
    expect(corpo.total).toBe(1);
    expect(corpo.itens[0].nomeDeExibicao).toBe("Ana");
  });

  it("(f) GET /contatos no Espaço B não lista o Contato do Espaço A (D-10)", async () => {
    const resposta = await appB().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, itens: [], total: 0 });
  });

  it("(g) POST /contatos {} responde 409 com o código de INV-CON-01", async () => {
    const resposta = await appA().inject({ method: "POST", url: "/contatos", headers: AUTORIZACAO, payload: {} });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR", campo: "nome" });
  });
});
