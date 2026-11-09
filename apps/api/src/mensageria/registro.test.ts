/**
 * Registro de provedores e provedor de teste (16-02, MSG-05, D-16-03): o Canal simulado com segredo
 * no cofre resolve o provedor de teste, que verifica e interpreta a chamada; o Canal real sem
 * implementação registrada dá `PROVEDOR_INDISPONIVEL`.
 *
 * A parte do cofre roda só contra Postgres LOCAL (Docker, porta 55717):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55717/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55717/postgres npx vitest run src/mensageria/registro.test.ts
 *
 * Nenhuma chave nem segredo vem do `.env`: tudo é gerado aqui, em memória.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { CABECALHO_DO_SEGREDO, ErroDeProvedor, TIPO_DO_SEGREDO_DO_WEBHOOK, type CanalParaProvedor } from "./provedor";
import { provedorDeTeste } from "./provedores/teste";
import { canalParaProvedor, provedorDoCanal, registroPadrao } from "./registro";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };

function canalDeMentira(extras: Partial<Canal> = {}): Canal {
  return {
    id: "canal_1",
    nome: "Comercial",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: true,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_teste",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_teste",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...extras,
  };
}

function paraProvedor(segredoDoWebhook: string | undefined): CanalParaProvedor {
  return { workspaceId: "ws_x", canal: canalDeMentira(), ...(segredoDoWebhook === undefined ? {} : { segredoDoWebhook }) };
}

function chamada(cabecalhos: Record<string, string | undefined>, corpo: unknown = {}) {
  return { cabecalhos, corpoCru: Buffer.from(JSON.stringify(corpo)), corpo };
}

describe("provedorDoCanal (D-16-03) — sem banco", () => {
  it("devolve o provedor de teste só para Canal simulado", () => {
    const registro = registroPadrao();
    expect(provedorDoCanal({ conexaoSimulada: true, provedor: "whatsapp-nao-oficial" }, registro)).toBe(registro.teste);
    expect(registro.teste.provedor).toBe("teste");
  });

  it("Canal real sem implementação registrada lança PROVEDOR_INDISPONIVEL", () => {
    const real = { conexaoSimulada: false, provedor: "whatsapp-nao-oficial" } as const;
    expect(() => provedorDoCanal(real, registroPadrao())).toThrow(ErroDeProvedor);
    try {
      provedorDoCanal(real, registroPadrao());
    } catch (erro) {
      expect((erro as ErroDeProvedor).codigo).toBe("PROVEDOR_INDISPONIVEL");
    }
  });

  it("Canal real nunca recebe o provedor de teste, mesmo com um provedor registrado para outro", () => {
    const registro = registroPadrao();
    const outro = { ...registro.teste, provedor: "whatsapp-nao-oficial" as const };
    const comOutro = { ...registro, porProvedor: { "whatsapp-nao-oficial": outro } };
    expect(provedorDoCanal({ conexaoSimulada: false, provedor: "whatsapp-nao-oficial" }, comOutro)).toBe(outro);
    expect(() => provedorDoCanal({ conexaoSimulada: false, provedor: "instagram-graph" }, comOutro)).toThrow(ErroDeProvedor);
  });
});

describe("provedor de teste: verificarChamada — sem banco", () => {
  it("aceita o cabeçalho com o segredo do Canal", () => {
    expect(provedorDeTeste.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "s1" }), paraProvedor("s1"))).toBe(true);
  });

  it("recusa outro segredo, cabeçalho ausente e Canal sem segredo", () => {
    expect(provedorDeTeste.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "s2" }), paraProvedor("s1"))).toBe(false);
    expect(provedorDeTeste.verificarChamada(chamada({}), paraProvedor("s1"))).toBe(false);
    expect(provedorDeTeste.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "s1" }), paraProvedor(undefined))).toBe(false);
    expect(provedorDeTeste.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "" }), paraProvedor(""))).toBe(false);
  });
});

describe("provedor de teste: interpretarChamada — sem banco", () => {
  it("uma mensagem vira um evento mensagem com criadoEm ISO", () => {
    const eventos = provedorDeTeste.interpretarChamada(
      { eventos: [{ tipo: "mensagem", idExterno: "e1", remetente: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "oi" }] },
      paraProvedor("s1"),
    );
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    expect(evento).toMatchObject({ tipo: "mensagem", idExterno: "e1", conteudo: "oi", remetente: { valor: "+5511987654321" } });
    if (evento.tipo !== "mensagem") throw new Error("esperava mensagem");
    expect(new Date(evento.criadoEm).toISOString()).toBe(evento.criadoEm);
  });

  it("corpo fora do formato vira ignorado, sem lançar", () => {
    for (const corpo of [null, "texto", 7, {}, { eventos: "x" }, { eventos: [{ tipo: "mensagem" }] }, { eventos: [], extra: 1 }]) {
      expect(provedorDeTeste.interpretarChamada(corpo, paraProvedor("s1"))).toEqual([{ tipo: "ignorado", motivo: "formato_invalido" }]);
    }
  });

  it("status e conexão passam como eventos próprios", () => {
    const eventos = provedorDeTeste.interpretarChamada(
      {
        eventos: [
          { tipo: "status", idExterno: "e2", status: "entregue", em: "2026-11-09T10:00:00.000Z" },
          { tipo: "conexao", conexao: "desconectada" },
        ],
      },
      paraProvedor("s1"),
    );
    expect(eventos).toEqual([
      { tipo: "status", idExterno: "e2", status: "entregue", em: "2026-11-09T10:00:00.000Z" },
      { tipo: "conexao", conexao: "desconectada" },
    ]);
  });

  it("a chave da chamada é o idExterno do primeiro evento", () => {
    const corpo = { eventos: [{ tipo: "status", idExterno: "e9", status: "lida", em: "2026-11-09T10:00:00.000Z" }] };
    expect(provedorDeTeste.chaveDaChamada?.(corpo)).toBe("e9");
    expect(provedorDeTeste.chaveDaChamada?.({})).toBeUndefined();
  });
});

describe("provedor de teste: enviar — sem banco", () => {
  const envio = { mensagemId: "m1", destino: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "oi" } as const;

  it("Canal simulado: grava o envio e devolve um idExterno de teste", async () => {
    provedorDeTeste.limpar();
    const r = await provedorDeTeste.enviar(paraProvedor("s1"), envio);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.idExterno).toMatch(/^teste-/);
    expect(provedorDeTeste.enviados).toHaveLength(1);
    provedorDeTeste.limpar();
  });

  it("Canal real nunca é dado como enviado pelo provedor de teste (MSG-05)", async () => {
    provedorDeTeste.limpar();
    const real: CanalParaProvedor = { workspaceId: "ws_x", canal: canalDeMentira({ conexaoSimulada: false }) };
    const r = await provedorDeTeste.enviar(real, envio);
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "PROVEDOR_INDISPONIVEL" });
    expect(provedorDeTeste.enviados).toHaveLength(0);
  });
});

describeComBanco("canalParaProvedor + provedorDoCanal — Postgres local", () => {
  const espacos: string[] = [];

  async function canalNoBanco(ws: string, opcoes: { simulado: boolean; provedor?: "whatsapp-nao-oficial" | "whatsapp-cloud" }) {
    const id = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: opcoes.provedor ?? "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: opcoes.simulado,
    });
    const canal = await criarRepositorioDeCanaisPg(pool()).obter(ws, id);
    if (!canal) throw new Error("Canal semeado não encontrado");
    return canal;
  }

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

  it("Canal simulado com segredo no cofre: segredoDoWebhook vem do cofre e o provedor é o de teste", async () => {
    const ws = novoEspacoDeTeste("regsim");
    espacos.push(ws);
    const canal = await canalNoBanco(ws, { simulado: true });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canal.id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "s1" });

    const paraOProvedor = await canalParaProvedor(pool(), chaves, ws, canal);
    expect(paraOProvedor.segredoDoWebhook).toBe("s1");
    expect(paraOProvedor.workspaceId).toBe(ws);
    expect(paraOProvedor.credencial).toBeUndefined();

    const provedor = provedorDoCanal(paraOProvedor.canal);
    expect(provedor).toBe(registroPadrao().teste);
    expect(provedor.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "s1" }), paraOProvedor)).toBe(true);
    expect(provedor.verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "s2" }), paraOProvedor)).toBe(false);
  });

  it("Canal simulado sem segredo no cofre: o provedor de teste recusa qualquer chamada", async () => {
    const ws = novoEspacoDeTeste("regsem");
    espacos.push(ws);
    const canal = await canalNoBanco(ws, { simulado: true });

    const paraOProvedor = await canalParaProvedor(pool(), chaves, ws, canal);
    expect(paraOProvedor.segredoDoWebhook).toBeUndefined();
    expect(provedorDoCanal(canal).verificarChamada(chamada({ [CABECALHO_DO_SEGREDO]: "qualquer" }), paraOProvedor)).toBe(false);
  });

  it("Canal real: lê a credencial do provedor e o provedor de teste não vale (PROVEDOR_INDISPONIVEL)", async () => {
    const ws = novoEspacoDeTeste("regreal");
    espacos.push(ws);
    const canal = await canalNoBanco(ws, { simulado: false });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canal.id, tipo: "whatsapp-nao-oficial", segredo: "token-da-instancia" });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canal.id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "s-real" });

    const paraOProvedor = await canalParaProvedor(pool(), chaves, ws, canal);
    expect(paraOProvedor).toMatchObject({ segredoDoWebhook: "s-real", credencial: "token-da-instancia" });
    expect(() => provedorDoCanal(paraOProvedor.canal)).toThrow(ErroDeProvedor);
  });

  it("Canal que deixou de ser simulado perde o provedor de teste", async () => {
    const ws = novoEspacoDeTeste("regdesc");
    espacos.push(ws);
    const canal = await canalNoBanco(ws, { simulado: true });
    expect(() => provedorDoCanal(canal)).not.toThrow();
    await pool().query("update plataforma.canais set conexao_simulada = false where workspace_id = $1 and id = $2", [ws, canal.id]);
    const depois = await criarRepositorioDeCanaisPg(pool()).obter(ws, canal.id);
    expect(() => provedorDoCanal(depois!)).toThrow(ErroDeProvedor);
  });
});
