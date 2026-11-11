/**
 * Rotas de Canal da Sessão 4, SEM banco (serviço falso injetado por `buildApp({ crm: { canais } })`):
 *   - `POST /canais/:id/conectar` (4.2.3): o envelope, a ausência de corpo, a autenticação e a recusa do Membro suspenso;
 *   - `POST /canais/:id/simular-conexao` só existe com `PERMITIR_CONEXAO_SIMULADA=true` (4.3.4): em PRODUÇÃO a rota responde 404 e o
 *     serviço nunca é chamado. O setup dos testes da api liga a variável; aqui ela é tirada de propósito para provar o comportamento
 *     de produção, e restaurada no fim.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import type { Canal, CanalNaFicha } from "@n1/dominio/crm/canais";
import { buildApp } from "../../app";
import { recusa, sucesso } from "../../servicos/crm/resultado";
import type { ServicoDeCanais } from "../../servicos/crm/canais";

const MARYANE = usuarioDoSeed("mem_maryane");
const membros = buildSeed().members;
const AUTORIZACAO = { authorization: "Bearer token-maryane" };

function opcoes(estado: "ativo" | "suspenso" = "ativo") {
  return {
    logger: false,
    workspaceId: "ws_falso",
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId: string, userId: string) => {
      const membro = membros.find((m) => m.userId === userId);
      return membro ? { ...membro, state: estado } : undefined;
    },
  };
}

function novoFalso(resposta: () => ReturnType<ServicoDeCanais["conectar"]> = () => Promise.resolve(sucesso({ situacao: "aguardando" as const }))) {
  const chamadas: unknown[][] = [];
  const registrar = (nome: string) => (...a: unknown[]) => {
    chamadas.push([nome, ...a]);
    return Promise.resolve(sucesso({} as Canal));
  };
  const servico: ServicoDeCanais = {
    listar: () => Promise.resolve(sucesso({ itens: [], total: 0 })),
    criar: registrar("criar"),
    obter: () => Promise.resolve(sucesso({} as CanalNaFicha)),
    editar: registrar("editar"),
    conectar: (...a) => {
      chamadas.push(["conectar", ...a]);
      return resposta();
    },
    simularConexao: registrar("simularConexao"),
    desconectar: registrar("desconectar"),
    arquivar: registrar("arquivar"),
  };
  return { servico, chamadas };
}

describe("POST /canais/:id/conectar (4.2.3)", () => {
  it("responde 200 no envelope { ok: true, dados } e entrega ao serviço o Membro da SESSÃO e o id da rota (nada do corpo)", async () => {
    const { servico, chamadas } = novoFalso(() => Promise.resolve(sucesso({ situacao: "qrcode" as const, qrcode: { imagem: "data:image/png;base64,AAAA", codigoDePareamento: "ABCD1234" } })));
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/conectar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { situacao: "qrcode", qrcode: { imagem: "data:image/png;base64,AAAA", codigoDePareamento: "ABCD1234" } } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]![0]).toBe("conectar");
    expect(chamadas[0]![1]).toMatchObject({ workspaceId: "ws_falso" });
    expect(chamadas[0]![2]).toBe("c1");
  });

  it("não declara corpo: a chamada sem content-type e sem corpo (como a tela faz) passa", async () => {
    const { servico } = novoFalso();
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/conectar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
  });

  it("sem token: 401, e o serviço não é chamado", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/conectar" });
    expect(resposta.statusCode).toBe(401);
    expect(chamadas).toEqual([]);
  });

  it("Membro suspenso: 403 SUSPENSO antes do serviço (12.1.5 B)", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await buildApp({ ...opcoes("suspenso"), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/conectar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ ok: false, codigo: "SUSPENSO" });
    expect(chamadas).toEqual([]);
  });

  it.each([
    [409, "TRANSICAO_INVALIDA", "O Canal já está conectado."],
    [409, "PROVEDOR_ERRADO", "Este Canal não se conecta lendo um QR code."],
    [502, "EVOLUTION_INDISPONIVEL", "Não foi possível falar com o WhatsApp. Tente de novo."],
    [503, "EVOLUTION_NAO_CONFIGURADA", "A integração com o WhatsApp não está configurada neste ambiente. Falta no servidor: EVOLUTION_API_KEY."],
    [404, "CANAL_NAO_ENCONTRADO", "Canal não encontrado."],
  ] as const)("a recusa do serviço (%s %s) sai no envelope { ok: false, error, codigo }", async (status, codigo, frase) => {
    const { servico } = novoFalso(() => Promise.resolve(recusa(status, frase, { codigo })));
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/conectar", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(status);
    expect(resposta.json()).toEqual({ ok: false, error: frase, codigo });
  });
});

describe("POST /canais/:id/simular-conexao só existe onde o ambiente a liga (4.3.4)", () => {
  const original = process.env.PERMITIR_CONEXAO_SIMULADA;
  beforeEach(() => {
    delete process.env.PERMITIR_CONEXAO_SIMULADA;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.PERMITIR_CONEXAO_SIMULADA;
    else process.env.PERMITIR_CONEXAO_SIMULADA = original;
  });

  it("PRODUÇÃO (variável ausente): a rota responde 404 e o serviço NUNCA é chamado; as outras ações seguem funcionando", async () => {
    const { servico, chamadas } = novoFalso();
    const app = buildApp({ ...opcoes(), crm: { canais: servico } });
    const simular = await app.inject({ method: "POST", url: "/canais/c1/simular-conexao", headers: AUTORIZACAO });
    expect(simular.statusCode).toBe(404);
    expect(chamadas.filter((c) => c[0] === "simularConexao")).toEqual([]);
    expect((await app.inject({ method: "POST", url: "/canais/c1/desconectar", headers: AUTORIZACAO })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/canais/c1/conectar", headers: AUTORIZACAO })).statusCode).toBe(200);
  });

  it.each(["false", "", "1", "TRUE"])("o valor %j também desliga: só 'true' liga", async (valor) => {
    process.env.PERMITIR_CONEXAO_SIMULADA = valor;
    const { servico } = novoFalso();
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/simular-conexao", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(404);
  });

  it("com PERMITIR_CONEXAO_SIMULADA=true (desenvolvimento, testes, homologação): a rota existe e chama o serviço", async () => {
    process.env.PERMITIR_CONEXAO_SIMULADA = "true";
    const { servico, chamadas } = novoFalso();
    const resposta = await buildApp({ ...opcoes(), crm: { canais: servico } }).inject({ method: "POST", url: "/canais/c1/simular-conexao", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas.filter((c) => c[0] === "simularConexao")).toHaveLength(1);
  });
});
