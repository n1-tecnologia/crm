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
 *
 * 07-02 acrescenta o Papel (D-14) e a troca de Proprietário (D-11): a segunda
 * parte semeia os Membros em `plataforma.registros` e usa o acesso REAL, que é
 * o que prova a consulta `members` → `roles`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { ContatoResumo } from "@n1/dominio/crm/contatos";
import { buildApp } from "../../app";
import { encerrar, pool } from "../../persistencia/conexao";
import { sucesso } from "../../servicos/crm/resultado";
import type { ServicoDeContatos } from "../../servicos/crm/contatos";
import type { AcessoAoCrm } from "../../servicos/crm/acesso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";

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

  it("(i) Convidado recebe 403 em POST /contatos com o acesso falso, sem chegar ao banco", async () => {
    const acessoFalso: AcessoAoCrm = {
      papelDe: async () => ({ base: "convidado", estado: "ativo" }),
      membroAtivo: async () => true,
    };
    // Sem `contatos`: o serviço é o real, e a recusa de Papel vem antes de qualquer `pool()`.
    const comAcessoFalso = buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { acesso: acessoFalso } });
    const resposta = await comAcessoFalso.inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Ana" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
  });
});

/** Sessões do bloco com banco: cada token é um Membro, e o `id` dele é o da linha semeada. */
const SESSOES = {
  "token-maryane": { sub: MARYANE, membroId: "mem_maryane" },
  "token-convidado": { sub: "usuario-convidado", membroId: "mem_convidado" },
} as const;

function opcoesComPapeis(workspaceId: string) {
  const base = membros.find((m) => m.id === "mem_maryane");
  return {
    logger: false,
    workspaceId,
    verificarToken: async (token: string) => {
      const sessao = SESSOES[token as keyof typeof SESSOES];
      return sessao ? { sub: sessao.sub } : null;
    },
    resolverMembro: async (_workspaceId: string, userId: string) => {
      const sessao = Object.values(SESSOES).find((s) => s.sub === userId);
      if (!sessao || !base) return undefined;
      return { ...base, id: sessao.membroId, userId, state: "ativo" as const };
    },
  };
}

const AUTORIZACAO_CONVIDADO = { authorization: "Bearer token-convidado" };

describeComBanco("rotas de Contatos — serviço real, Postgres local", () => {
  const espacoA = novoEspacoDeTeste("contatosa");
  const espacoB = novoEspacoDeTeste("contatosb");
  const appA = () => buildApp(opcoesComPapeis(espacoA));
  const appB = () => buildApp(opcoesComPapeis(espacoB));

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [espacoA, espacoB]) {
      await semearMembro(espaco, { id: "mem_maryane", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(espacoA, { id: "mem_outro", base: "membro", state: "ativo" });
    await semearMembro(espacoA, { id: "mem_removido", base: "membro", state: "removido" });
    await semearMembro(espacoB, { id: "mem_so_em_b", base: "membro", state: "ativo" });
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

  it("(g) Convidado ativo recebe 403 em POST /contatos e nada é gravado (D-14, T-07-03)", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO_CONVIDADO,
      payload: { nome: "Do Convidado" },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    expect(resposta.json().error).toContain("Convidado");

    const gravado = await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and nome = $2", [
      espacoA,
      "Do Convidado",
    ]);
    expect(gravado.rowCount).toBe(0);
  });

  it("(g) Convidado ativo lê a lista (consulta é permitida)", async () => {
    const resposta = await appA().inject({ method: "GET", url: "/contatos", headers: AUTORIZACAO_CONVIDADO });
    expect(resposta.statusCode).toBe(200);
  });

  it("(g) Membro com base `membro` cria (a consulta members -> roles resolve a base)", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Bia" },
    });
    expect(resposta.statusCode).toBe(201);
  });

  it("(h) proprietarioId de Membro removido responde 409 PROPRIETARIO_INVALIDO", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Cris", proprietarioId: "mem_removido" },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "PROPRIETARIO_INVALIDO" });
  });

  it("(h) proprietarioId inexistente ou de outro Espaço responde 409 PROPRIETARIO_INVALIDO (T-07-40)", async () => {
    for (const proprietarioId of ["mem_nao_existe", "mem_so_em_b"]) {
      const resposta = await appA().inject({
        method: "POST",
        url: "/contatos",
        headers: AUTORIZACAO,
        payload: { nome: "Dani", proprietarioId },
      });
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ ok: false, codigo: "PROPRIETARIO_INVALIDO" });
    }
  });

  it("(h) proprietarioId de outro Membro ativo grava o Proprietário; criadoPor continua o da sessão", async () => {
    const resposta = await appA().inject({
      method: "POST",
      url: "/contatos",
      headers: AUTORIZACAO,
      payload: { nome: "Edu", proprietarioId: "mem_outro" },
    });
    expect(resposta.statusCode).toBe(201);
    const { contato } = resposta.json().dados;
    expect(contato.proprietarioId).toBe("mem_outro");
    expect(contato.criadoPor).toBe("mem_maryane");
  });
});
