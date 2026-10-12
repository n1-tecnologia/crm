/**
 * A ponte de Canais (D-11, 08-01).
 *
 * Sem banco: a guarda `to_regclass` (um banco sem a 008 devolve `[]` sem lançar),
 * a projeção vazia e a forma de `canalParaChannel`. Com banco local
 * (`describeComBanco`, que aplica a 008): o caminho inteiro do traçador por HTTP
 * (POST /canais → GET /estado) e a 008 pelo repositório, com o `CHECK` que
 * espelha a tabela de provedores do domínio (D-01).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal } from "@n1/dominio/crm/canais";
import { PROVEDORES, PROVEDORES_DE_CANAL, TIPOS_COM_PROVEDOR } from "@n1/dominio/provedores-de-canal";
import { buildApp } from "../app";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";
import { encerrar, pool } from "./conexao";
import {
  acrescentarCanaisProjetados,
  canalParaChannel,
  carregarCanaisProjetados,
  redefinirGuardaDaTabelaDeCanais,
} from "./canais-projetados";
import { semear } from "./repositorio";

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
