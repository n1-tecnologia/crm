/**
 * `POST /webhooks/mensageria/:canalId` (16-03, 3.6.3, MSG-01, D-16-03), contra o Postgres LOCAL (Docker, porta 55718):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55718/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55718/postgres npx vitest run src/rotas/webhooks-de-mensageria.test.ts
 *
 * Provas: a mesma 401 para as seis causas de recusa (T-16-08) sem gravar nada; o mesmo id de Canal em dois
 * Espaços dá 401; o teto por IP responde 429 antes de qualquer consulta (T-16-09); corpo grande dá 413 e JSON
 * inválido, 400; a chave `apikey` do topo não é guardada (T-16-10); a mesma chamada duas vezes grava uma linha
 * (T-16-11); a rota acorda o processador só depois de gravar.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp } from "../app";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { encerrar, pool } from "../persistencia/conexao";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import type { OpcoesDeWebhooksDeMensageria } from "./webhooks-de-mensageria";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SEGREDO = "s1-do-canal";
const NAO_AUTORIZADO = { ok: false, error: "Não autorizado." };

const evento = (idExterno: string) => ({
  tipo: "mensagem",
  idExterno,
  remetente: { tipo: "whatsapp", valor: "+5511987654321", nomeExibido: "Ana" },
  conteudo: "oi",
});
const corpo = (idExterno = "e1") => ({ eventos: [evento(idExterno)] });

describeComBanco("webhook de mensageria por Canal — Postgres local", () => {
  const espacos: string[] = [];

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    return ws;
  }

  let contador = 0;

  /** Nome e número são únicos por Espaço (RN-CXE-31, INV-CXE-01): cada Canal leva o seu. */
  async function canal(ws: string, opcoes: { simulado?: boolean; segredo?: string | null } = {}) {
    const simulado = opcoes.simulado ?? true;
    contador += 1;
    const id = await semearCanal(ws, {
      nome: `Comercial ${contador}`,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: `+551197777${String(contador).padStart(4, "0")}`,
      conexao: "conectada",
      conexaoSimulada: simulado,
      configuradoPor: "mem_dona",
    });
    if (opcoes.segredo !== null) {
      await guardarCredencial(pool(), chaves, {
        workspaceId: ws,
        donoTipo: "canal",
        donoId: id,
        tipo: TIPO_DO_SEGREDO_DO_WEBHOOK,
        segredo: opcoes.segredo ?? SEGREDO,
      });
    }
    return id;
  }

  const app = (ws: string, opcoes: OpcoesDeWebhooksDeMensageria = {}) =>
    buildApp({ logger: false, workspaceId: ws, webhooksDeMensageria: { chaves, ...opcoes } });

  const chamar = (a: ReturnType<typeof app>, canalId: string, cabecalhos: Record<string, string>, payload: unknown = corpo()) =>
    a.inject({ method: "POST", url: `/webhooks/mensageria/${canalId}`, headers: cabecalhos, payload: payload as object });

  const linhas = async (ws: string) =>
    (await pool().query<{ corpo: Record<string, unknown>; chave: string | null }>("select corpo, chave from plataforma.webhooks_recebidos where workspace_id = $1", [ws])).rows;

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  it("Canal inexistente, arquivado, real sem provedor, sem segredo, segredo errado e sem cabeçalho: a mesma 401 e nada gravado", async () => {
    const ws = await espaco("recusas");
    const arquivado = await canal(ws);
    await pool().query(
      "update plataforma.canais set conexao = 'desconectada', conexao_simulada = false, estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2",
      [ws, arquivado],
    );
    const real = await canal(ws, { simulado: false });
    const semSegredo = await canal(ws, { segredo: null });
    const bom = await canal(ws);
    const a = app(ws);
    const certo = { [CABECALHO_DO_SEGREDO]: SEGREDO };

    const respostas = [
      await chamar(a, randomUUID(), certo),
      await chamar(a, arquivado, certo),
      await chamar(a, real, certo),
      await chamar(a, semSegredo, certo),
      await chamar(a, bom, { [CABECALHO_DO_SEGREDO]: "outro-segredo" }),
      await chamar(a, bom, {}),
    ];
    for (const r of respostas) {
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual(NAO_AUTORIZADO);
      // Nenhuma pista no cabeçalho de resposta sobre qual causa foi.
      expect(r.headers["www-authenticate"]).toBeUndefined();
    }
    expect(new Set(respostas.map((r) => r.body)).size).toBe(1);
    expect(await linhas(ws)).toHaveLength(0);
  });

  it("o mesmo id de Canal em dois Espaços: 401, mesmo com o segredo certo", async () => {
    const wsA = await espaco("ambigua");
    const wsB = await espaco("ambigub");
    const id = await canal(wsA);
    // Semeado à mão: o id é gerado por Canal, então só uma cópia da linha cria a colisão entre Espaços.
    await pool().query(
      `insert into plataforma.canais (id, workspace_id, nome, tipo, provedor, identificador_externo, conexao, conexao_simulada, configurado_por, criado_por)
       values ($1, $2, 'Comercial', 'whatsapp', 'whatsapp-nao-oficial', '+5511977770009', 'conectada', true, 'mem_dona', 'mem_dona')`,
      [id, wsB],
    );
    await guardarCredencial(pool(), chaves, { workspaceId: wsB, donoTipo: "canal", donoId: id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });

    const resposta = await chamar(app(wsA), id, { [CABECALHO_DO_SEGREDO]: SEGREDO });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual(NAO_AUTORIZADO);
    expect(await linhas(wsA)).toHaveLength(0);
    expect(await linhas(wsB)).toHaveLength(0);
  });

  it("o teto por IP responde 429 antes de qualquer consulta ao banco", async () => {
    const ws = await espaco("limite");
    const id = await canal(ws);
    let consultas = 0;
    const a = app(ws, {
      limitePorIp: { janelaMs: 60_000, maximo: 3 },
      pool: () => {
        consultas += 1;
        return pool();
      },
    });
    const certo = { [CABECALHO_DO_SEGREDO]: SEGREDO };

    for (let i = 0; i < 3; i += 1) expect((await chamar(a, id, certo, corpo(`e${i}`))).statusCode).toBe(200);
    const antes = consultas;
    expect(antes).toBeGreaterThan(0);

    const quarta = await chamar(a, id, certo, corpo("e9"));
    expect(quarta.statusCode).toBe(429);
    expect(quarta.json()).toEqual({ ok: false, error: "Muitas chamadas. Tente de novo em instantes." });
    expect(consultas).toBe(antes);
    expect(await linhas(ws)).toHaveLength(3);
  });

  it("corpo de 3 MiB dá 413 e JSON inválido dá 400, sem gravar", async () => {
    const ws = await espaco("corpo");
    const id = await canal(ws);
    const a = app(ws);
    const certo = { [CABECALHO_DO_SEGREDO]: SEGREDO, "content-type": "application/json" };

    const grande = await a.inject({ method: "POST", url: `/webhooks/mensageria/${id}`, headers: certo, payload: `{"texto":"${"x".repeat(3 * 1024 * 1024)}"}` });
    expect(grande.statusCode).toBe(413);

    const quebrado = await a.inject({ method: "POST", url: `/webhooks/mensageria/${id}`, headers: certo, payload: "{ não é json" });
    expect(quebrado.statusCode).toBe(400);
    expect(await linhas(ws)).toHaveLength(0);
  });

  it("a chave `apikey` do topo do corpo não é guardada; o resto do corpo fica", async () => {
    const ws = await espaco("apikey");
    const id = await canal(ws);

    const r = await chamar(app(ws), id, { [CABECALHO_DO_SEGREDO]: SEGREDO }, { apikey: "chave-da-instancia", ...corpo() });
    expect(r.statusCode).toBe(200);

    const [linha, ...resto] = await linhas(ws);
    expect(resto).toHaveLength(0);
    expect(linha!.corpo).not.toHaveProperty("apikey");
    expect(JSON.stringify(linha!.corpo)).not.toContain("chave-da-instancia");
    expect(linha!.corpo).toMatchObject({ eventos: [{ idExterno: "e1" }] });
  });

  it("a mesma chamada do provedor duas vezes: duas 200 e uma linha só", async () => {
    const ws = await espaco("dedup");
    const id = await canal(ws);
    const a = app(ws);
    const certo = { [CABECALHO_DO_SEGREDO]: SEGREDO };

    expect((await chamar(a, id, certo)).statusCode).toBe(200);
    expect((await chamar(a, id, certo)).statusCode).toBe(200);
    const gravadas = await linhas(ws);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]!.chave).toBe("e1");

    // Outro idExterno é outra chamada.
    expect((await chamar(a, id, certo, corpo("e2"))).statusCode).toBe(200);
    expect(await linhas(ws)).toHaveLength(2);
  });

  it("acorda o processador depois de gravar o 200, e nunca numa recusa; um acordador que lança não derruba a resposta", async () => {
    const ws = await espaco("acordar");
    const id = await canal(ws);
    let acordadas = 0;
    const a = app(ws, {
      acordarProcessador: () => {
        acordadas += 1;
        throw new Error("o acordador quebrou");
      },
    });

    expect((await chamar(a, id, { [CABECALHO_DO_SEGREDO]: "errado" })).statusCode).toBe(401);
    expect(acordadas).toBe(0);

    const r = await chamar(a, id, { [CABECALHO_DO_SEGREDO]: SEGREDO });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(acordadas).toBe(1);
    expect(await linhas(ws)).toHaveLength(1);
  });
});
