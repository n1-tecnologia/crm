/**
 * O critério da Fase 8 do lado do servidor, ponta a ponta, sem navegador (ver
 * `CONTEXT.md` desta pasta): "dois WhatsApps lado a lado" — um oficial e um não
 * oficial, o mesmo Contato com uma Conversa em cada — por `app.inject()` sobre
 * `buildApp()` com serviços, repositórios e acesso REAIS, contra o Postgres
 * LOCAL (`testes/banco-crm.ts`, nunca o pooler do Supabase). Só o JWT
 * (`verificarToken`) e a resolução do Membro (`resolverMembro`) são injetados.
 *
 * Um cenário só, em `it`s sequenciais que compartilham estado:
 *
 *   (a) o Administrador conecta "Comercial" (WhatsApp oficial) e "Suporte"
 *       (WhatsApp não oficial) com DOIS números distintos; ambos nascem
 *       `desconectada` (D-01, D-08).
 *   (b) o número de "Comercial" no provedor não oficial é recusado: 409
 *       `CANAL_CONTA_EM_USO` (INV-CXE-01, Pitfall 12 — a unicidade é da conta,
 *       não do par provedor+conta).
 *   (c) Membro não conecta nem simula (B35): 403.
 *   (d) "Simular conexão" leva os dois a `conectada`, marcada como simulada (D-08).
 *   (e) `GET /estado` traz os dois Canais relacionais ao lado dos do seed
 *       (D-11), e `plataforma.registros` não ganha linha de `channels` (D-12).
 *   (f) o mesmo Contato abre uma Conversa em cada Canal; a 2ª no mesmo Canal é
 *       recusada (CONVERSA_JA_ABERTA).
 *   (g) o oficial recusa texto livre fora da janela de 24 h (409
 *       `JANELA_EXPIRADA`) e o não oficial envia (D-02); nenhuma resposta leva
 *       a carga bruta do provedor (A9).
 *   (h) depois de "Desconectar", a Mensagem `enviada` nasce `pendente` (B69).
 *   (i) um Membro de OUTRO Espaço recebe 404 e lista vazia (T-08-50).
 *
 * Números: nenhum colide com o seed (`chn_wpp` usa `+5511987654321`).
 *
 * Rode com `TZ=America/Sao_Paulo` (Pitfall 5) e `DATABASE_URL` local:
 *
 *   TZ=America/Sao_Paulo DATABASE_URL=postgres://postgres:x@localhost:55593/postgres \
 *     npx vitest run src/e2e/canais-fluxo.test.ts
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeMensagens } from "../servicos/crm/mensagens";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";

/** Token → quem é a sessão. O `sub` é o Usuário; o `membroId` é a linha de `members` que `semearMembro` grava. */
const SESSOES = {
  "token-admin": { sub: "usuario-admin", membroId: "mem_admin" },
  "token-membro": { sub: "usuario-ana", membroId: "mem_ana" },
  "token-de-fora": { sub: "usuario-bia", membroId: "mem_bia" },
} as const;

const ADMIN = { authorization: "Bearer token-admin" };
const MEMBRO = { authorization: "Bearer token-membro" };
const DE_FORA = { authorization: "Bearer token-de-fora" };

const NUMERO_COMERCIAL = "+55 11 96666-0001";
const NUMERO_SUPORTE = "+55 11 96666-0002";
const WHATSAPP_DA_ANA = "+55 11 95555-0001";

const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

/** Um `buildApp()` real por Espaço: o `workspaceId` vem da configuração do servidor, nunca do cliente (T-1-02). */
function appDoEspaco(workspaceId: string) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => {
      const sessao = SESSOES[token as keyof typeof SESSOES];
      return sessao ? { sub: sessao.sub } : null;
    },
    resolverMembro: async (_workspaceId, userId) => {
      const sessao = Object.values(SESSOES).find((s) => s.sub === userId);
      return sessao ? { ...membroBase, id: sessao.membroId, userId, state: "ativo" as const } : undefined;
    },
  });
}

interface Envelope {
  ok: boolean;
  dados?: Record<string, unknown>;
  itens?: unknown[];
  total?: number;
  error?: string;
  codigo?: string;
  campo?: string;
}

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface CanalHttp {
  id: string;
  nome: string;
  provedor: string;
  conexao: string;
  conexaoSimulada: boolean;
}

interface ConversaCriada {
  conversa: { id: string };
  primeiraMensagem: { statusEntrega: string | null };
}

interface MensagemHttp {
  id: string;
  direcao: string;
  statusEntrega: string | null;
}

describeComBanco("Fase 8 ponta a ponta: dois WhatsApps lado a lado, pelo HTTP, com acesso e isolamento no backend", () => {
  const espacoA = novoEspacoDeTeste("canaisa");
  const espacoB = novoEspacoDeTeste("canaisb");

  async function chamar(metodo: Metodo, url: string, headers: Record<string, string>, payload?: unknown, workspaceId = espacoA) {
    const resposta = await appDoEspaco(workspaceId).inject({
      method: metodo,
      url,
      headers,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: resposta.statusCode, texto: resposta.body, corpo: resposta.json() as Envelope };
  }

  const dados = <T>(corpo: Envelope): T => corpo.dados as T;

  async function canaisNoRegistro(workspaceId: string): Promise<number> {
    const r = await pool().query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'channels'",
      [workspaceId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  let canaisDoSeed: number;
  let comercialId: string;
  let suporteId: string;
  let anaId: string;
  let conversaComercialId: string;
  let conversaSuporteId: string;

  beforeAll(async () => {
    await prepararBancoCrm();
    const cliente = await pool().connect();
    try {
      await semear(cliente, espacoA, buildSeed());
    } finally {
      cliente.release();
    }
    await semearMembro(espacoA, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(espacoA, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(espacoB, { id: "mem_bia", base: "membro", state: "ativo" });
    canaisDoSeed = await canaisNoRegistro(espacoA);
  });

  afterAll(async () => {
    await limparEspaco(espacoA);
    await limparEspaco(espacoB);
    await encerrar();
  });

  it("(a) o Administrador conecta Comercial (oficial) e Suporte (não oficial) com números distintos; ambos nascem desconectados", async () => {
    expect(canaisDoSeed).toBeGreaterThan(0);

    const comercial = await chamar("POST", "/canais", ADMIN, {
      provedor: "whatsapp-cloud",
      nome: "Comercial",
      identificador: NUMERO_COMERCIAL,
    });
    expect(comercial.status).toBe(201);
    const c = dados<CanalHttp>(comercial.corpo);
    expect(c).toMatchObject({ nome: "Comercial", provedor: "whatsapp-cloud", conexao: "desconectada" });
    comercialId = c.id;

    const suporte = await chamar("POST", "/canais", ADMIN, {
      provedor: "whatsapp-nao-oficial",
      nome: "Suporte",
      identificador: NUMERO_SUPORTE,
    });
    expect(suporte.status).toBe(201);
    const s = dados<CanalHttp>(suporte.corpo);
    expect(s).toMatchObject({ nome: "Suporte", provedor: "whatsapp-nao-oficial", conexao: "desconectada" });
    suporteId = s.id;
  });

  it("(b) o número do Comercial no provedor não oficial é recusado: a conta é única entre provedores (INV-CXE-01)", async () => {
    const recusado = await chamar("POST", "/canais", ADMIN, {
      provedor: "whatsapp-nao-oficial",
      nome: "Outro",
      identificador: NUMERO_COMERCIAL,
    });
    expect(recusado.status).toBe(409);
    expect(recusado.corpo).toMatchObject({ ok: false, codigo: "CANAL_CONTA_EM_USO" });
  });

  it("(c) Membro não conecta nem simula conexão (B35)", async () => {
    const cria = await chamar("POST", "/canais", MEMBRO, {
      provedor: "whatsapp-cloud",
      nome: "Do Membro",
      identificador: "+55 11 96666-0099",
    });
    expect(cria.status).toBe(403);

    const simula = await chamar("POST", `/canais/${comercialId}/simular-conexao`, MEMBRO);
    expect(simula.status).toBe(403);
  });

  it('(d) "Simular conexão" leva os dois a conectada, marcada como simulada (D-08)', async () => {
    for (const id of [comercialId, suporteId]) {
      const r = await chamar("POST", `/canais/${id}/simular-conexao`, ADMIN);
      expect(r.status).toBe(200);
      expect(dados<CanalHttp>(r.corpo)).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
    }
  });

  it("(e) GET /estado traz os dois Canais relacionais ao lado do seed e plataforma.registros não ganha `channels` (D-11, D-12)", async () => {
    const r = await chamar("GET", "/estado", ADMIN);
    expect(r.status).toBe(200);
    const estado = (r.corpo as unknown as { data: { channels: Array<Record<string, unknown>> } }).data;
    const porNome = (nome: string) => estado.channels.find((c) => c.name === nome);

    expect(porNome("Comercial")).toMatchObject({
      id: comercialId,
      relational: true,
      provider: "whatsapp-cloud",
      connection: "conectada",
      simulatedConnection: true,
    });
    expect(porNome("Suporte")).toMatchObject({
      id: suporteId,
      relational: true,
      provider: "whatsapp-nao-oficial",
      connection: "conectada",
      simulatedConnection: true,
    });
    const seed = estado.channels.find((c) => c.id === "chn_wpp");
    expect(seed).toBeDefined();
    expect(seed?.relational).toBeUndefined();

    expect(await canaisNoRegistro(espacoA)).toBe(canaisDoSeed);
  });

  it("(f) o mesmo Contato abre uma Conversa em cada Canal; a 2ª no mesmo Canal é recusada", async () => {
    const ana = await chamar("POST", "/contatos", MEMBRO, {
      nome: "Ana",
      identificadores: [{ tipo: "whatsapp", valor: WHATSAPP_DA_ANA }],
    });
    expect(ana.status).toBe(201);
    anaId = dados<{ contato: { id: string } }>(ana.corpo).contato.id;

    const noComercial = await chamar("POST", "/conversas", MEMBRO, {
      canalId: comercialId,
      contatoId: anaId,
      mensagem: { conteudo: "Olá, aqui é do Comercial." },
    });
    expect(noComercial.status).toBe(201);
    const cc = dados<ConversaCriada>(noComercial.corpo);
    expect(cc.primeiraMensagem.statusEntrega).toBe("enviada");
    conversaComercialId = cc.conversa.id;

    const noSuporte = await chamar("POST", "/conversas", MEMBRO, {
      canalId: suporteId,
      contatoId: anaId,
      mensagem: { conteudo: "Olá, aqui é do Suporte." },
    });
    expect(noSuporte.status).toBe(201);
    const cs = dados<ConversaCriada>(noSuporte.corpo);
    expect(cs.primeiraMensagem.statusEntrega).toBe("enviada");
    conversaSuporteId = cs.conversa.id;
    expect(conversaSuporteId).not.toBe(conversaComercialId);

    const repetida = await chamar("POST", "/conversas", MEMBRO, {
      canalId: comercialId,
      contatoId: anaId,
      mensagem: { conteudo: "De novo." },
    });
    expect(repetida.status).toBe(409);
    expect(repetida.corpo).toMatchObject({ ok: false, codigo: "CONVERSA_JA_ABERTA" });
  });

  it("(g) fora da janela de 24 h o oficial recusa texto livre e o não oficial envia (D-02); a carga bruta nunca sai (A9)", async () => {
    const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });
    const haTrintaHoras = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    for (const [conversaId, idExterno] of [
      [conversaComercialId, "wamid.comercial.1"],
      [conversaSuporteId, "wamid.suporte.1"],
    ] as const) {
      const recebida = await servico.registrarRecebida(espacoA, {
        conversaId,
        idExterno,
        criadoEm: haTrintaHoras,
        conteudo: "Oi, preciso de ajuda.",
        cargaBruta: { segredo: "payload cru do provedor", telefone: WHATSAPP_DA_ANA },
      });
      expect(recebida.ok).toBe(true);
    }

    const oficial = await chamar("POST", "/mensagens", MEMBRO, {
      conversaId: conversaComercialId,
      direcao: "enviada",
      conteudo: "Texto livre fora da janela.",
    });
    expect(oficial.status).toBe(409);
    expect(oficial.corpo).toMatchObject({ ok: false, codigo: "JANELA_EXPIRADA" });

    const naoOficial = await chamar("POST", "/mensagens", MEMBRO, {
      conversaId: conversaSuporteId,
      direcao: "enviada",
      conteudo: "Texto livre, sem janela.",
    });
    expect(naoOficial.status).toBe(201);
    expect(dados<MensagemHttp>(naoOficial.corpo).statusEntrega).toBe("enviada");

    const fio = await chamar("GET", `/mensagens?conversaId=${conversaSuporteId}`, MEMBRO);
    expect(fio.status).toBe(200);
    expect(fio.corpo.total).toBeGreaterThanOrEqual(3);
    expect(fio.texto).not.toContain("carga_bruta");
    expect(fio.texto).not.toContain("cargaBruta");
    expect(fio.texto).not.toContain("payload cru");
    expect((fio.corpo.itens as MensagemHttp[]).some((m) => m.direcao === "recebida")).toBe(true);
  });

  it('(h) depois de "Desconectar" o Suporte, a Mensagem enviada nasce pendente (B69)', async () => {
    const desconecta = await chamar("POST", `/canais/${suporteId}/desconectar`, ADMIN);
    expect(desconecta.status).toBe(200);
    expect(dados<CanalHttp>(desconecta.corpo).conexao).toBe("desconectada");

    const enviada = await chamar("POST", "/mensagens", MEMBRO, {
      conversaId: conversaSuporteId,
      direcao: "enviada",
      conteudo: "Enviada com o Canal desconectado.",
    });
    expect(enviada.status).toBe(201);
    expect(dados<MensagemHttp>(enviada.corpo).statusEntrega).toBe("pendente");
  });

  it("(i) um Membro de OUTRO Espaço recebe 404 no Canal, na Conversa e na Mensagem, e lista vazia (T-08-50)", async () => {
    const canal = await chamar("GET", `/canais/${comercialId}`, DE_FORA, undefined, espacoB);
    expect(canal.status).toBe(404);

    const conversas = await chamar("GET", "/conversas", DE_FORA, undefined, espacoB);
    expect(conversas.status).toBe(200);
    expect(conversas.corpo.total).toBe(0);

    const conversa = await chamar("GET", `/conversas/${conversaComercialId}`, DE_FORA, undefined, espacoB);
    expect(conversa.status).toBe(404);

    const mensagem = await chamar(
      "POST",
      "/mensagens",
      DE_FORA,
      { conversaId: conversaComercialId, direcao: "interna", conteudo: "Invasão." },
      espacoB,
    );
    expect(mensagem.status).toBe(404);
  });
});
