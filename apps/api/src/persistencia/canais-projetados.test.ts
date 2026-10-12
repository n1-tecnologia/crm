/**
 * A ponte de Canais (D-11, 08-01).
 *
 * Sem banco: a guarda `to_regclass` (um banco sem a 008 devolve `[]` sem lançar),
 * a projeção vazia e a forma de `canalParaChannel`. Com banco local
 * (`describeComBanco`, que aplica a 008): o caminho inteiro do traçador por HTTP
 * (POST /canais → GET /estado) e a 008 pelo repositório, com o `CHECK` que
 * espelha a tabela de provedores do domínio (D-01).
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { usuarioDoSeed } from "@n1/dominio";
import { sendMessage, startConversation } from "@n1/dominio/operations";
import { buildSeed } from "@n1/dominio/seed";
import { ok } from "@n1/dominio/state";
import type { Canal } from "@n1/dominio/crm/canais";
import { PROVEDORES, PROVEDORES_DE_CANAL, TIPOS_COM_PROVEDOR } from "@n1/dominio/provedores-de-canal";
import { buildApp } from "../app";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import {
  describeComBanco,
  limparEspaco,
  novoEspacoDeTeste,
  prepararBancoCrm,
  semearCanal,
  semearMembro,
} from "../testes/banco-crm";
import { encerrar, pool } from "./conexao";
import {
  acrescentarCanaisProjetados,
  canalParaChannel,
  carregarCanaisProjetados,
  redefinirGuardaDaTabelaDeCanais,
  semCanaisProjetados,
} from "./canais-projetados";
import { semear } from "./repositorio";
import { executar } from "./unidade-de-trabalho";

/** Um cliente cujas consultas devolvem sempre `resposta` e contam as chamadas. */
function clienteFalso(resposta: { rows: unknown[] }) {
  const consultas: string[] = [];
  const cliente = {
    query: async (texto: string) => {
      consultas.push(texto);
      return resposta;
    },
  };
  return { cliente: cliente as unknown as Parameters<typeof carregarCanaisProjetados>[0], consultas };
}

const CANAL: Canal = {
  id: "9b2f6c1e-0801-4c3a-9f00-000000000099",
  nome: "Com erro",
  tipo: "email",
  provedor: "email-imap-smtp",
  identificadorExterno: "erro@empresa.com",
  conexao: "com_erro",
  conexaoSimulada: false,
  conectadaEm: null,
  estado: "ativo",
  arquivadoEm: null,
  configuradoPor: "mem_admin",
  filaPadraoId: null,
  proprietarioPadraoId: null,
  origemPadraoId: null,
  gruposHabilitados: false,
  criadoPor: "mem_admin",
  criadoEm: "2026-10-12T00:00:00.000Z",
  atualizadoEm: "2026-10-12T00:00:00.000Z",
};

describe("ponte de Canais — sem banco", () => {
  beforeEach(() => redefinirGuardaDaTabelaDeCanais());

  it("(j) sem a tabela (to_regclass nulo) devolve [] com UMA consulta só", async () => {
    const { cliente, consultas } = clienteFalso({ rows: [{ existe: null }] });
    await expect(carregarCanaisProjetados(cliente, "ws")).resolves.toEqual([]);
    expect(consultas).toHaveLength(1);
  });

  it("(k) cliente sem linhas devolve []", async () => {
    const { cliente, consultas } = clienteFalso({ rows: [] });
    await expect(carregarCanaisProjetados(cliente, "ws")).resolves.toEqual([]);
    expect(consultas).toHaveLength(1);
  });

  it("(l) lista vazia num estado sem channels não lança e não cria a chave", () => {
    const estado = {} as DataState;
    const fotografia = acrescentarCanaisProjetados(estado, []);
    expect(fotografia.ids.size).toBe(0);
    expect(fotografia.json.size).toBe(0);
    expect("channels" in estado).toBe(false);
  });

  it("(m) um Canal com_erro vira comErro, relacional, com o provedor", () => {
    const channel = canalParaChannel(CANAL, "ws");
    expect(channel).toMatchObject({
      id: CANAL.id,
      workspaceId: "ws",
      name: "Com erro",
      channelType: "email",
      externalId: "erro@empresa.com",
      connection: "comErro",
      lifecycle: "ativo",
      provider: "email-imap-smtp",
      relational: true,
      simulatedConnection: false,
      messageTemplates: [],
    });
    expect(channel.defaultQueueId).toBeUndefined();
  });

  it("acrescenta ao fim e pula o Canal cujo id já foi hidratado", () => {
    const seed = buildSeed();
    const estado = { channels: [...seed.channels] } as DataState;
    const projetado = canalParaChannel(CANAL, "ws");
    const colide = { ...canalParaChannel(CANAL, "ws"), id: seed.channels[0]!.id };
    const fotografia = acrescentarCanaisProjetados(estado, [projetado, colide]);
    expect(estado.channels.at(-1)?.id).toBe(CANAL.id);
    expect(estado.channels).toHaveLength(seed.channels.length + 1);
    expect([...fotografia.ids]).toEqual([CANAL.id]);
  });
});

describe("semCanaisProjetados — sem banco (08-07)", () => {
  const projetado = canalParaChannel(CANAL, "ws");

  function estadoComProjetado() {
    const seed = buildSeed();
    const estado = { channels: [...seed.channels] } as DataState;
    const fotografia = acrescentarCanaisProjetados(estado, [projetado]);
    return { estado, fotografia, doSeed: seed.channels.length };
  }

  it("fotografia vazia devolve o próprio estado", () => {
    const estado = { channels: [] } as unknown as DataState;
    const fotografia = acrescentarCanaisProjetados(estado, []);
    expect(semCanaisProjetados(estado, fotografia)).toBe(estado);
  });

  it("projetado intacto: cópia rasa sem ele, e o estado original ainda o contém", () => {
    const { estado, fotografia, doSeed } = estadoComProjetado();
    const limpo = semCanaisProjetados(estado, fotografia);
    expect(limpo).not.toBe(estado);
    expect(limpo.channels).toHaveLength(doSeed);
    expect(limpo.channels.some((c) => c.id === CANAL.id)).toBe(false);
    expect(estado.channels.some((c) => c.id === CANAL.id)).toBe(true);
    expect(estado.channels).toHaveLength(doSeed + 1);
  });

  it("projetado alterado lança a frase da ponte", () => {
    const { estado, fotografia } = estadoComProjetado();
    estado.channels.find((c) => c.id === CANAL.id)!.name = "Renomeado por uma operação";
    expect(() => semCanaisProjetados(estado, fotografia)).toThrow(
      `Uma operação alterou o Canal ${CANAL.id} da tabela própria; ele só muda pela api de Canais.`,
    );
  });

  it("projetado removido do estado também lança (a mudança não some em silêncio)", () => {
    const { estado, fotografia } = estadoComProjetado();
    estado.channels = estado.channels.filter((c) => c.id !== CANAL.id);
    expect(() => semCanaisProjetados(estado, fotografia)).toThrow(/Uma operação alterou o Canal/);
  });
});

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;

describeComBanco("ponte de Canais — Postgres local", () => {
  const espaco = novoEspacoDeTeste("canaisponte");
  const appHttp = () =>
    buildApp({
      logger: false,
      workspaceId: espaco,
      verificarToken: async (token: string) => (token === "token-admin" ? { sub: MARYANE } : null),
      resolverMembro: async (_workspaceId: string, userId: string) => {
        const base = membros.find((m) => m.userId === userId);
        return base ? { ...base, id: "mem_admin", userId, state: "ativo" as const } : undefined;
      },
    });
  const ADMIN = { authorization: "Bearer token-admin" };

  beforeAll(async () => {
    await prepararBancoCrm();
    redefinirGuardaDaTabelaDeCanais();
    const cliente = await pool().connect();
    try {
      await semear(cliente, espaco, buildSeed());
    } finally {
      cliente.release();
    }
    await semearMembro(espaco, { id: "mem_admin", base: "administrador", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await encerrar();
  });

  async function colecaoDeCanais(): Promise<number> {
    const { rows } = await pool().query<{ n: number }>(
      "select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = 'channels'",
      [espaco],
    );
    return rows[0]!.n;
  }

  it("(n) POST /canais e depois GET /estado: o Canal relacional chega em channels sem ir para registros", async () => {
    const antes = await colecaoDeCanais();

    const criado = await appHttp().inject({
      method: "POST",
      url: "/canais",
      headers: ADMIN,
      payload: { provedor: "whatsapp-cloud", nome: "Comercial", identificador: "+55 11 97777-0002" },
    });
    expect(criado.statusCode).toBe(201);
    const id = (criado.json() as { dados: Canal }).dados.id;

    const estado = await appHttp().inject({ method: "GET", url: "/estado", headers: ADMIN });
    expect(estado.statusCode).toBe(200);
    const canais = (estado.json() as { data: { channels: Array<Record<string, unknown>> } }).data.channels;

    const doSeed = canais.find((c) => c["id"] === "chn_wpp");
    expect(doSeed).toBeDefined();
    expect(doSeed?.["relational"]).toBeUndefined();

    const projetado = canais.find((c) => c["id"] === id);
    expect(projetado).toMatchObject({
      name: "Comercial",
      relational: true,
      provider: "whatsapp-cloud",
      connection: "desconectada",
      channelType: "whatsapp",
    });

    expect(await colecaoDeCanais()).toBe(antes);
  });

  it("(o) a 008 pelo repositório: defaults, projeção e o CHECK do provedor", async () => {
    const criado = await criarRepositorioDeCanaisPg(pool()).inserir(espaco, {
      nome: "Caixa",
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: "caixa@empresa.com",
      configuradoPor: "mem_teste",
      criadoPor: "mem_teste",
    });
    expect(criado).toMatchObject({ conexao: "desconectada", conexaoSimulada: false, estado: "ativo", arquivadoEm: null });

    const projetados = await carregarCanaisProjetados(pool(), espaco);
    expect(projetados.find((c) => c.id === criado.id)).toMatchObject({
      relational: true,
      provider: "email-imap-smtp",
    });

    for (const provedor of PROVEDORES_DE_CANAL) {
      const errado = TIPOS_COM_PROVEDOR.find((tipo) => tipo !== PROVEDORES[provedor].tipo)!;
      const tentativa = pool().query(
        `insert into plataforma.canais (workspace_id, nome, tipo, provedor, identificador_externo, configurado_por, criado_por)
         values ($1, $2, $3, $4, $5, 'mem_teste', 'mem_teste')`,
        [espaco, `Errado ${provedor}`, errado, provedor, `errado-${provedor}`],
      );
      await expect(tentativa).rejects.toMatchObject({ code: "23514", constraint: "canais_provedor_tipo_ck" });
    }
  });
});

const PASTA_DE_MIGRACOES = fileURLToPath(new URL("../../migracoes", import.meta.url));

describeComBanco("a ponte em executar() — Postgres local (08-07)", () => {
  const espaco = novoEspacoDeTeste("canaisexec");
  const seed = buildSeed();
  const administrador = seed.members.find((m) => seed.roles.find((r) => r.id === m.roleId)?.base === "administrador")!;
  const contato = seed.contacts.find((c) => c.lifecycle === "ativo" && c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"))!;
  let idComercial = "";

  beforeAll(async () => {
    await prepararBancoCrm();
    redefinirGuardaDaTabelaDeCanais();
    const cliente = await pool().connect();
    try {
      await semear(cliente, espaco, buildSeed());
    } finally {
      cliente.release();
    }
    idComercial = await semearCanal(espaco, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: "+55 11 97777-0007",
      conexao: "conectada",
    });
  });

  afterAll(async () => {
    await limparEspaco(espaco);
    await encerrar();
  });

  async function contar(colecao: string): Promise<number> {
    const { rows } = await pool().query<{ n: number }>(
      "select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = $2",
      [espaco, colecao],
    );
    return rows[0]!.n;
  }

  async function revisao(): Promise<number> {
    const { rows } = await pool().query<{ revisao: string }>(
      "select revisao from plataforma.workspaces where workspace_id = $1",
      [espaco],
    );
    return Number(rows[0]!.revisao);
  }

  it("startConversation e sendMessage sobre o Canal relacional gravam a Conversa em registros sem copiar o Canal", async () => {
    const canaisAntes = await contar("channels");

    const aberta = await executar(espaco, (s) => startConversation(s, administrador.id, idComercial, contato.id));
    expect(aberta.ok).toBe(true);
    if (!("value" in aberta) || !aberta.ok) throw new Error("startConversation devia ter dado certo");
    const idDaConversa = aberta.value.id;

    const { rows } = await pool().query<{ canal: string }>(
      "select dados->>'channelId' as canal from plataforma.registros where workspace_id = $1 and colecao = 'conversations' and id = $2",
      [espaco, idDaConversa],
    );
    expect(rows[0]?.canal).toBe(idComercial);
    expect(await contar("channels")).toBe(canaisAntes);

    const enviada = await executar(espaco, (s) =>
      sendMessage(s, administrador.id, { conversationId: idDaConversa, content: "Olá" }),
    );
    expect(enviada.ok).toBe(true);
    expect(await contar("channels")).toBe(canaisAntes);
  });

  it("uma operação que altera o Canal projetado lança e a revisão do Espaço não muda", async () => {
    const antes = await revisao();
    await expect(
      executar(espaco, (s) => {
        s.channels.find((c) => c.id === idComercial)!.name = "Mudado pelo modelo antigo";
        return ok(undefined);
      }),
    ).rejects.toThrow(`Uma operação alterou o Canal ${idComercial} da tabela própria; ele só muda pela api de Canais.`);
    expect(await revisao()).toBe(antes);
    const { rows } = await pool().query<{ nome: string }>("select nome from plataforma.canais where id = $1", [idComercial]);
    expect(rows[0]?.nome).toBe("Comercial");
  });

  it("banco só com 001..007: carregarCanaisProjetados devolve [] sem lançar", async () => {
    const nome = `sem008_${randomUUID().slice(0, 8)}`;
    await pool().query(`create database ${nome}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${nome}`;
    const aparte = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      await aparte.query("create schema if not exists plataforma");
      const arquivos = readdirSync(PASTA_DE_MIGRACOES)
        .filter((f) => f.endsWith(".sql") && !f.startsWith("008-"))
        .sort();
      for (const arquivo of arquivos) await aparte.query(readFileSync(`${PASTA_DE_MIGRACOES}/${arquivo}`, "utf8"));
      expect((await aparte.query("select to_regclass('plataforma.canais') as existe")).rows[0].existe).toBeNull();

      redefinirGuardaDaTabelaDeCanais();
      await expect(carregarCanaisProjetados(aparte, "qualquer")).resolves.toEqual([]);
    } finally {
      await aparte.end();
      await pool().query(`drop database ${nome}`);
      redefinirGuardaDaTabelaDeCanais();
    }
  });
});
