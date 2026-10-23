/**
 * Vazamento entre Membros e entre Espaços de Trabalho, por HTTP e contra Postgres
 * local (Fase 9, D-14 camada 1; T-09-76 e T-09-77).
 *
 * A mesma regra que 09-07 provou em `estado.test.ts` e `operacoes.test.ts`, repetida
 * aqui dentro do job `seguranca` do CI: reintroduzir o vazamento deixa o job vermelho
 * mesmo que alguém mexa naqueles arquivos. Sempre se procura no `resposta.body`
 * INTEIRO (string), nunca em campos escolhidos: um dado pode sair por onde ninguém olhou.
 *
 * Só Postgres local (`describeComBanco`): nada é semeado no Supabase do `.env`.
 *
 *   docker run -d --rm --name crm-n1-pg-0915 -e POSTGRES_PASSWORD=x -p 55615:5432 postgres:16
 *   DATABASE_URL=postgres://postgres:x@localhost:55615/postgres npx vitest run src/seguranca/dados-de-outro-membro.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { encerrar } from "../persistencia/conexao";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  limparSegundoEspaco,
  montarEspacoDeVazamento,
  montarSegundoEspaco,
  semearEspacoDeVazamento,
  semearSegundoEspaco,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
  type SegundoEspaco,
} from "../testes/espaco-de-vazamento";

/** As cinco coleções de IA que o Convidado nunca recebe (D-02). */
const COLECOES_DE_IA = ["agents", "automations", "documents", "collections", "skills"] as const;

const TOKEN_SO_DO_SEGUNDO = "token-so-do-segundo";

describeComBanco("vazamento entre Membros — GET /estado e POST /operacoes (D-14, T-09-76)", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("outro-membro");
    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco);
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const pedirEstado = (token: string) => app.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${token}` } });

  const frasesDeA = () => espaco.frases.a;

  it("controle positivo: A recebe as próprias frases (sem isto, 'ninguém vê nada' passaria com a rota quebrada)", async () => {
    const resposta = await pedirEstado(TOKENS_DE_VAZAMENTO.a);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    for (const frase of frasesDeA()) expect(resposta.body, `frase de A para A: ${frase}`).toContain(frase);
  });

  it.each([
    ["B", TOKENS_DE_VAZAMENTO.b],
    ["o Convidado", TOKENS_DE_VAZAMENTO.convidado],
    ["o Administrador", TOKENS_DE_VAZAMENTO.administrador],
  ] as const)("GET /estado como %s: o corpo inteiro não tem a Sessão, a execução nem a Memória de A", async (_quem, token) => {
    const resposta = await pedirEstado(token);
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    for (const frase of frasesDeA()) expect(resposta.body, `frase de A: ${frase}`).not.toContain(frase);
    for (const id of [espaco.ids.a.sessao, espaco.ids.a.pasta, espaco.ids.a.execucao, espaco.ids.a.visao]) {
      expect(resposta.body, `id de A: ${id}`).not.toContain(id);
    }
  });

  it("GET /estado como o Convidado: as cinco coleções de IA chegam vazias (D-02)", async () => {
    const resposta = await pedirEstado(TOKENS_DE_VAZAMENTO.convidado);
    expect(resposta.statusCode).toBe(200);
    const corpo = resposta.json() as { data: Record<string, unknown[]> };
    for (const colecao of COLECOES_DE_IA) {
      expect(corpo.data[colecao], `o Convidado recebeu ${colecao}`).toEqual([]);
    }
  });

  it("controle positivo: o Membro de Papel base `membro` recebe os Agentes do Espaço (o esvaziamento é só do Convidado)", async () => {
    const resposta = await pedirEstado(TOKENS_DE_VAZAMENTO.b);
    const corpo = resposta.json() as { data: { agents: unknown[] } };
    expect(corpo.data.agents.length).toBeGreaterThan(0);
  });

  it("GET /estado como o Administrador: contém o e-mail do convite (ele administra) e nenhuma frase de A", async () => {
    const resposta = await pedirEstado(TOKENS_DE_VAZAMENTO.administrador);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.body, "e-mail do convite").toContain(espaco.convite.email);
    for (const frase of frasesDeA()) expect(resposta.body, `frase de A: ${frase}`).not.toContain(frase);
  });

  it("GET /estado como o Convidado e como B: o e-mail do convite não sai (só quem administra o lê)", async () => {
    for (const token of [TOKENS_DE_VAZAMENTO.convidado, TOKENS_DE_VAZAMENTO.b]) {
      const resposta = await pedirEstado(token);
      expect(resposta.body, "e-mail do convite").not.toContain(espaco.convite.email);
    }
  });

  it("POST /operacoes/setTaskFieldValue como B: o corpo inteiro não traz o segredo do link nem frase de A", async () => {
    const { tarefaComLink, campoGravavelPorB, link, formulario } = espaco.segredos;
    const resposta = await app.inject({
      method: "POST",
      url: "/operacoes/setTaskFieldValue",
      headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.b}` },
      payload: { args: [tarefaComLink, campoGravavelPorB, 7] },
    });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    expect((resposta.json() as { ok: boolean }).ok).toBe(true);
    expect(resposta.body, "segredo do link público").not.toContain(link);
    expect(resposta.body, "segredo do Formulário").not.toContain(formulario);
    for (const frase of frasesDeA()) expect(resposta.body, `frase de A: ${frase}`).not.toContain(frase);
  });
});

describeComBanco("vazamento entre Espaços de Trabalho — o WORKSPACE_ID é do servidor (D-14, T-09-77)", () => {
  let primeiro: EspacoDeVazamento;
  let segundo: SegundoEspaco;
  let appDoPrimeiro: ReturnType<typeof buildApp>;
  let appDoSegundo: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    await prepararBancoCrm();
    primeiro = montarEspacoDeVazamento("espaco-1");
    segundo = montarSegundoEspaco("espaco-2");
    await semearEspacoDeVazamento(primeiro);
    await semearSegundoEspaco(segundo);

    // Resolve o Membro de verdade (`membroPorUsuario`, SQL por `workspace_id` + `userId`): é ela que impede o cruzamento.
    const usuarios: Record<string, string | undefined> = {
      [TOKENS_DE_VAZAMENTO.a]: primeiro.membros.a.userId,
      [TOKENS_DE_VAZAMENTO.administrador]: primeiro.membros.administrador.userId,
      [TOKEN_SO_DO_SEGUNDO]: segundo.usuarioSoDoSegundo,
    };
    const verificarToken = async (token: string) => (usuarios[token] ? { sub: usuarios[token] } : null);
    appDoPrimeiro = buildApp({ logger: false, workspaceId: primeiro.workspaceId, verificarToken });
    appDoSegundo = buildApp({ logger: false, workspaceId: segundo.workspaceId, verificarToken });
  });

  afterAll(async () => {
    await appDoPrimeiro?.close();
    await appDoSegundo?.close();
    if (primeiro) await limparEspacoDeVazamento(primeiro);
    if (segundo) await limparSegundoEspaco(segundo);
    await encerrar();
  });

  it("nenhum Usuário do segundo Espaço é Membro do primeiro (a fábrica não deixa Usuário em comum)", () => {
    const usuariosDoPrimeiro = new Set(primeiro.estado.members.map((m) => m.userId).filter((u): u is string => u !== undefined));
    for (const membro of segundo.estado.members) {
      if (membro.userId !== undefined) expect(usuariosDoPrimeiro.has(membro.userId), membro.id).toBe(false);
    }
    expect(usuariosDoPrimeiro.has(segundo.usuarioSoDoSegundo)).toBe(false);
  });

  it("controle positivo: o Usuário que só é Membro do segundo Espaço entra no segundo (200) e lê a frase dele", async () => {
    const resposta = await appDoSegundo.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${TOKEN_SO_DO_SEGUNDO}` } });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    for (const frase of segundo.frases) expect(resposta.body, `frase do segundo Espaço: ${frase}`).toContain(frase);
  });

  it("o Usuário que só é Membro do segundo Espaço recebe 403 no app do primeiro, e o corpo não carrega nada do primeiro", async () => {
    const resposta = await appDoPrimeiro.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${TOKEN_SO_DO_SEGUNDO}` } });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(403);
    expect(resposta.body).toContain("não é Membro deste Espaço");
    for (const frase of [...primeiro.frases.a, ...primeiro.frases.b]) expect(resposta.body).not.toContain(frase);
  });

  it("o 403 vale também para a escrita: o mesmo Usuário não grava no primeiro Espaço", async () => {
    const resposta = await appDoPrimeiro.inject({
      method: "POST",
      url: "/operacoes/trashContact",
      headers: { authorization: `Bearer ${TOKEN_SO_DO_SEGUNDO}` },
      payload: { args: [primeiro.estado.contacts.find((c) => c.lifecycle === "ativo")?.id ?? "x"] },
    });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(403);
  });

  it("o GET /estado de A, no primeiro Espaço, não contém nenhuma frase do segundo", async () => {
    const resposta = await appDoPrimeiro.inject({ method: "GET", url: "/estado", headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.a}` } });
    expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
    for (const frase of segundo.frases) expect(resposta.body, `frase do segundo Espaço: ${frase}`).not.toContain(frase);
  });

  it("um Contato do segundo Espaço dá 404 em GET /contatos/:id pelo app do primeiro; um Contato do primeiro dá 200 (controle)", async () => {
    const cabecalho = { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.administrador}` };

    const criado = await appDoPrimeiro.inject({ method: "POST", url: "/contatos", headers: cabecalho, payload: { nome: "Contato do primeiro Espaço" } });
    expect(criado.statusCode, criado.body.slice(0, 200)).toBe(201);
    const idDoPrimeiro = (criado.json() as { dados?: { contato?: { id?: string } } }).dados?.contato?.id;
    expect(idDoPrimeiro, criado.body.slice(0, 200)).toBeTypeOf("string");

    const doPrimeiro = await appDoPrimeiro.inject({ method: "GET", url: `/contatos/${idDoPrimeiro}`, headers: cabecalho });
    expect(doPrimeiro.statusCode, doPrimeiro.body.slice(0, 200)).toBe(200);

    const doSegundo = await appDoPrimeiro.inject({ method: "GET", url: `/contatos/${segundo.contatoId}`, headers: cabecalho });
    expect(doSegundo.statusCode, doSegundo.body.slice(0, 200)).toBe(404);
    expect(doSegundo.body).not.toContain(segundo.frases[0]!);
  });
});
