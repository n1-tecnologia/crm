/**
 * Rotas REST de Canal (08-01).
 *
 * Duas partes. A primeira roda sempre, com um serviço falso injetado por
 * `buildApp({ crm: { canais } })` (sem banco): autenticação e forma do corpo
 * (`.strict()`, T-08-02). A segunda (`describeComBanco`) usa o serviço real
 * contra o Postgres LOCAL (`testes/banco-crm.ts`, que aplica a 008): o Canal
 * nasce `desconectada`, o Membro recebe 403 (B35), a conta e o nome repetidos
 * dão 409 e o outro Espaço não vê nada (T-08-01).
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { FRASE_DO_CANAL_REAL, type Canal, type CanalNaFicha } from "@n1/dominio/crm/canais";
import { buildApp } from "../../app";
import { encerrar, pool } from "../../persistencia/conexao";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../mensageria/provedor";
import { guardarCredencial, type ChavesDoCofre } from "../../servicos/cofre";
import { sucesso } from "../../servicos/crm/resultado";
import type { ServicoDeCanais } from "../../servicos/crm/canais";
import type { ConectorDaEvolution } from "../../mensageria/provedores/evolution/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";

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

describe("rotas de Canais — serviço falso, sem banco", () => {
  function novoFalso() {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeCanais = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve(sucesso({ itens: [], total: 0 }));
      },
      criar: (...a) => {
        chamadas.push(["criar", ...a]);
        return Promise.resolve(sucesso({} as Canal));
      },
      obter: (...a) => {
        chamadas.push(["obter", ...a]);
        return Promise.resolve(sucesso({} as CanalNaFicha));
      },
      editar: (...a) => {
        chamadas.push(["editar", ...a]);
        return Promise.resolve(sucesso({} as Canal));
      },
      conectar: (...a) => {
        chamadas.push(["conectar", ...a]);
        return Promise.resolve(sucesso({ situacao: "aguardando" as const }));
      },
      simularConexao: (...a) => {
        chamadas.push(["simularConexao", ...a]);
        return Promise.resolve(sucesso({} as Canal));
      },
      desconectar: (...a) => {
        chamadas.push(["desconectar", ...a]);
        return Promise.resolve(sucesso({} as Canal));
      },
      arquivar: (...a) => {
        chamadas.push(["arquivar", ...a]);
        return Promise.resolve(sucesso({} as Canal));
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeCanais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { canais: servico } });

  it("(a) GET /canais sem Authorization responde 401", async () => {
    const resposta = await appCom(novoFalso().servico).inject({ method: "GET", url: "/canais" });
    expect(resposta.statusCode).toBe(401);
  });

  it.each(["workspaceId", "tipo", "conexao", "estado", "configuradoPor", "conexaoSimulada"])(
    "(b) POST /canais com %s no corpo responde 400 e o serviço não é chamado",
    async (campo) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await appCom(servico).inject({
        method: "POST",
        url: "/canais",
        headers: AUTORIZACAO,
        payload: { provedor: "whatsapp-cloud", nome: "Suporte", identificador: "+55 11 98765-4321", [campo]: "x" },
      });
      expect(resposta.statusCode).toBe(400);
      expect(chamadas).toEqual([]);
    },
  );

  it("(c) POST /canais com provedor desconhecido responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/canais",
      headers: AUTORIZACAO,
      payload: { provedor: "telegram", nome: "Suporte", identificador: "x" },
    });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("(d) GET /canais?estado=na_lixeira responde 400: Canal não tem lixeira", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/canais?estado=na_lixeira", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });
});

describe("rotas de Canais (08-03) — serviço falso, sem banco", () => {
  function novoFalso(devolve?: Awaited<ReturnType<ServicoDeCanais["arquivar"]>>) {
    const chamadas: unknown[][] = [];
    const resposta = () => Promise.resolve(devolve ?? sucesso({ id: "c1" } as Canal));
    const registrar =
      (nome: string) =>
      (...a: unknown[]) => {
        chamadas.push([nome, ...a]);
        return resposta();
      };
    const servico: ServicoDeCanais = {
      listar: (...a) => {
        chamadas.push(["listar", ...a]);
        return Promise.resolve(sucesso({ itens: [], total: 0 }));
      },
      criar: registrar("criar"),
      obter: (...a) => {
        chamadas.push(["obter", ...a]);
        return Promise.resolve(sucesso({ id: "c1" } as CanalNaFicha));
      },
      editar: registrar("editar"),
      // O envelope é o mesmo; só o tipo do valor muda (a resposta programada devolve um Canal ou uma recusa).
      conectar: registrar("conectar") as unknown as ServicoDeCanais["conectar"],
      simularConexao: registrar("simularConexao"),
      desconectar: registrar("desconectar"),
      arquivar: registrar("arquivar"),
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeCanais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { canais: servico } });

  it.each(["tipo", "provedor", "identificador", "conexao", "workspaceId", "estado"])(
    "(a) PATCH /canais/c1 com %s no corpo responde 400 e o serviço não é chamado (INV-CXE-02)",
    async (campo) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await appCom(servico).inject({
        method: "PATCH",
        url: "/canais/c1",
        headers: AUTORIZACAO,
        payload: { nome: "Novo", [campo]: "x" },
      });
      expect(resposta.statusCode).toBe(400);
      expect(chamadas).toEqual([]);
    },
  );

  it("(b) PATCH /canais/c1 com corpo vazio responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "PATCH", url: "/canais/c1", headers: AUTORIZACAO, payload: {} });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("PATCH /canais/c1 aceita nome, Fila e Origem, e null limpa o padrão", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "PATCH",
      url: "/canais/c1",
      headers: AUTORIZACAO,
      payload: { nome: "Vendas", filaPadraoId: null, origemPadraoId: "origem_1" },
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[0]).toBe("editar");
    expect(chamadas[0]?.[2]).toBe("c1");
    expect(chamadas[0]?.[3]).toEqual({ nome: "Vendas", filaPadraoId: null, origemPadraoId: "origem_1" });
  });

  it.each([
    ["simular-conexao", "simularConexao"],
    ["desconectar", "desconectar"],
    ["arquivar", "arquivar"],
  ])("(c) POST /canais/c1/%s sem content-type e sem corpo responde 200 e chama %s", async (acao, metodo) => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "POST", url: `/canais/c1/${acao}`, headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, dados: { id: "c1" } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.[0]).toBe(metodo);
    expect(chamadas[0]?.[1]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[2]).toBe("c1");
  });

  it("(d) uma recusa 409 TRANSICAO_INVALIDA do serviço sai no envelope { ok: false, error, codigo }", async () => {
    const { servico } = novoFalso({ ok: false, status: 409, error: "O Canal já está conectado.", codigo: "TRANSICAO_INVALIDA" });
    const resposta = await appCom(servico).inject({ method: "POST", url: "/canais/c1/simular-conexao", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toEqual({ ok: false, error: "O Canal já está conectado.", codigo: "TRANSICAO_INVALIDA" });
  });

  it("(e) GET /canais?conexao=talvez responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "GET", url: "/canais?conexao=talvez", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(400);
    expect(chamadas).toEqual([]);
  });

  it("GET /canais repassa tipo, provedor, conexao e q ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "GET",
      url: "/canais?tipo=whatsapp&provedor=whatsapp-cloud&conexao=conectada&q=sup",
      headers: AUTORIZACAO,
    });
    expect(resposta.statusCode).toBe(200);
    expect(chamadas[0]?.[2]).toMatchObject({ tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada", q: "sup", estado: "ativo" });
  });

  it("não há DELETE /canais/:id: Canal não tem lixeira (DO-CXE-03)", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({ method: "DELETE", url: "/canais/c1", headers: AUTORIZACAO });
    expect(resposta.statusCode).toBe(404);
    expect(chamadas).toEqual([]);
  });

  it("POST /canais aceita filaPadraoId e origemPadraoId", async () => {
    const { servico, chamadas } = novoFalso();
    const resposta = await appCom(servico).inject({
      method: "POST",
      url: "/canais",
      headers: AUTORIZACAO,
      payload: { provedor: "whatsapp-cloud", nome: "Suporte", identificador: "+55 11 98765-4321", filaPadraoId: "f1", origemPadraoId: "o1" },
    });
    expect(resposta.statusCode).toBe(201);
    expect(chamadas[0]?.[2]).toMatchObject({ filaPadraoId: "f1", origemPadraoId: "o1" });
  });
});

/** Sessões do bloco com banco: cada token é um Membro, e o `id` dele é o da linha semeada. */
const SESSOES = {
  "token-admin": { sub: MARYANE, membroId: "mem_admin" },
  "token-membro": { sub: "usuario-membro", membroId: "mem_ana" },
} as const;

/**
 * O conector da Evolution do serviço REAL de Canais, trocado por um que não fala com ninguém: estes testes são do REST e da
 * regra de Canal, não da Evolution (o conector tem os seus em `mensageria/provedores/evolution/conexao.test.ts`). Sem isto,
 * desconectar um Canal ligado a um provedor real tentaria a rede.
 */
const CONECTOR_FALSO: ConectorDaEvolution = {
  conectar: async () => sucesso({ situacao: "aguardando" as const }),
  desligar: async () => undefined,
};

function opcoesComPapeis(workspaceId: string) {
  const base = membros.find((m) => m.id === "mem_maryane");
  return {
    logger: false,
    workspaceId,
    crm: { conectoresDeCanal: { whatsappNaoOficial: CONECTOR_FALSO } },
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

const ADMIN = { authorization: "Bearer token-admin" };
const MEMBRO = { authorization: "Bearer token-membro" };

describeComBanco("rotas de Canais — serviço real, Postgres local", () => {
  const espacoA = novoEspacoDeTeste("canaisA");
  const espacoB = novoEspacoDeTeste("canaisB");
  const appA = () => buildApp(opcoesComPapeis(espacoA));
  const appB = () => buildApp(opcoesComPapeis(espacoB));

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [espacoA, espacoB]) {
      await semearMembro(espaco, { id: "mem_admin", base: "administrador", state: "ativo" });
      await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
    }
  });

  afterAll(async () => {
    // O cofre não tem FK para o Espaço e `limparEspaco` não o conhece: as credenciais do CR-01 saem aqui.
    await pool().query("delete from plataforma.credenciais where workspace_id in ($1, $2)", [espacoA, espacoB]);
    await limparEspaco(espacoA);
    await limparEspaco(espacoB);
    await encerrar();
  });

  async function criar(payload: unknown, headers = ADMIN) {
    const resposta = await appA().inject({ method: "POST", url: "/canais", headers, payload: payload as object });
    return {
      status: resposta.statusCode,
      corpo: resposta.json() as { ok: boolean; dados?: Canal; error?: string; codigo?: string; campo?: string },
    };
  }

  it("(e) o Administrador cria um Canal que nasce desconectada, no Espaço da sessão", async () => {
    const { status, corpo } = await criar({
      provedor: "whatsapp-nao-oficial",
      nome: "Suporte",
      identificador: "+55 11 97777-0001",
    });
    expect(status).toBe(201);
    expect(corpo.dados).toMatchObject({
      conexao: "desconectada",
      conexaoSimulada: false,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      estado: "ativo",
      configuradoPor: "mem_admin",
    });
    const { rows } = await pool().query<{ workspace_id: string; conexao: string }>(
      "select workspace_id, conexao from plataforma.canais where id = $1",
      [corpo.dados!.id],
    );
    expect(rows).toEqual([{ workspace_id: espacoA, conexao: "desconectada" }]);
  });

  it("(f) nome repetido com outro número → 409 CANAL_NOME_EM_USO; o mesmo número em outro provedor de WhatsApp → 409 CANAL_CONTA_EM_USO", async () => {
    const nome = await criar({ provedor: "whatsapp-cloud", nome: "  suporte ", identificador: "+55 11 97777-0099" });
    expect(nome.status).toBe(409);
    expect(nome.corpo).toMatchObject({ ok: false, codigo: "CANAL_NOME_EM_USO" });

    const conta = await criar({ provedor: "whatsapp-cloud", nome: "Outro nome", identificador: "+55 11 97777-0001" });
    expect(conta.status).toBe(409);
    expect(conta.corpo).toMatchObject({ ok: false, codigo: "CANAL_CONTA_EM_USO" });
    expect(conta.corpo.error).not.toContain("canais_conta_uq");
  });

  it("(g) um Membro recebe 403 PERMISSAO em POST /canais e ainda lê a lista (B35)", async () => {
    const escrita = await criar({ provedor: "email-imap-smtp", nome: "Do Membro", identificador: "m@empresa.com" }, MEMBRO);
    expect(escrita.status).toBe(403);
    expect(escrita.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    const leitura = await appA().inject({ method: "GET", url: "/canais", headers: MEMBRO });
    expect(leitura.statusCode).toBe(200);
  });

  it("(h) o Canal do Espaço A aparece em GET /canais de A e não aparece no de B", async () => {
    const deA = await appA().inject({ method: "GET", url: "/canais", headers: ADMIN });
    expect(deA.statusCode).toBe(200);
    expect((deA.json() as { itens: Canal[] }).itens.map((c) => c.nome)).toContain("Suporte");
    const deB = await appB().inject({ method: "GET", url: "/canais", headers: ADMIN });
    expect(deB.statusCode).toBe(200);
    expect(deB.json()).toEqual({ ok: true, itens: [], total: 0 });
  });

  it("(i) número sem DDI → 400 com campo identificador", async () => {
    const { status, corpo } = await criar({ provedor: "whatsapp-cloud", nome: "Sem DDI", identificador: "11 98765-4321" });
    expect(status).toBe(400);
    expect(corpo).toMatchObject({ ok: false, codigo: "VALOR_INVALIDO", campo: "identificador" });
  });

  it("(f) GET /canais/:id de um Canal do Espaço A pelo app do Espaço B → 404; pelo de A → 200; Membro lê (B35)", async () => {
    const criado = await criar({ provedor: "email-imap-smtp", nome: "Caixa de A", identificador: "a@empresa.com" });
    expect(criado.status).toBe(201);
    const id = criado.corpo.dados!.id;

    const deB = await appB().inject({ method: "GET", url: `/canais/${id}`, headers: ADMIN });
    expect(deB.statusCode).toBe(404);
    expect(deB.json()).toMatchObject({ ok: false, codigo: "CANAL_NAO_ENCONTRADO" });

    const deA = await appA().inject({ method: "GET", url: `/canais/${id}`, headers: MEMBRO });
    expect(deA.statusCode).toBe(200);
    expect((deA.json() as { dados: Canal }).dados.nome).toBe("Caixa de A");
  });

  it("(g) o ciclo pela API: simular → 409 ao repetir → desconectar → arquivar; Membro recebe 403 nas ações", async () => {
    const criado = await criar({ provedor: "whatsapp-nao-oficial", nome: "Ciclo", identificador: "+55 11 97777-0090" });
    const id = criado.corpo.dados!.id;
    const acao = (caminho: string, headers = ADMIN) => appA().inject({ method: "POST", url: `/canais/${id}/${caminho}`, headers });

    for (const caminho of ["simular-conexao", "desconectar", "arquivar"]) {
      const negado = await acao(caminho, MEMBRO);
      expect(negado.statusCode).toBe(403);
      expect(negado.json()).toMatchObject({ ok: false, codigo: "PERMISSAO" });
    }

    const conectado = await acao("simular-conexao");
    expect(conectado.statusCode).toBe(200);
    expect((conectado.json() as { dados: Canal }).dados).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
    const repetido = await acao("simular-conexao");
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json()).toMatchObject({ ok: false, codigo: "TRANSICAO_INVALIDA" });

    const desconectado = await acao("desconectar");
    expect((desconectado.json() as { dados: Canal }).dados).toMatchObject({ conexao: "desconectada", conexaoSimulada: false });

    const arquivado = await acao("arquivar");
    expect(arquivado.statusCode).toBe(200);
    expect((arquivado.json() as { dados: Canal }).dados).toMatchObject({ estado: "arquivado", conexao: "desconectada" });
  });

  describe("CR-01 (16-17): Simular conexão num Canal já ligado a um provedor real", () => {
    const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
    let sequencia = 0;

    /** Um Canal `whatsapp-nao-oficial` conectado de verdade (como `canal:ligar-evolution` o deixa), com o que o cofre guardar. */
    async function canalReal(cofre: "provedor" | "so-webhook" | "provedor-revogada" | "nada") {
      sequencia += 1;
      const id = await semearCanal(espacoA, {
        nome: `Real ${sequencia}`,
        tipo: "whatsapp",
        provedor: "whatsapp-nao-oficial",
        identificadorExterno: `+55119888${String(sequencia).padStart(5, "0")}`,
        conexao: "conectada",
        conexaoSimulada: false,
        configuradoPor: "mem_admin",
      });
      const dono = { workspaceId: espacoA, donoTipo: "canal", donoId: id } as const;
      if (cofre === "provedor" || cofre === "provedor-revogada") {
        await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: "chave-de-teste" });
      }
      if (cofre === "provedor-revogada") {
        await pool().query(
          "update plataforma.credenciais set revogado_em = now() where workspace_id = $1 and dono_id = $2 and tipo = 'whatsapp-nao-oficial'",
          [espacoA, id],
        );
      }
      if (cofre === "so-webhook") await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-de-teste" });
      return id;
    }

    const acao = (id: string, caminho: string) => appA().inject({ method: "POST", url: `/canais/${id}/${caminho}`, headers: ADMIN });
    const linha = async (id: string) =>
      (await pool().query<{ conexao: string; conexao_simulada: boolean }>("select conexao, conexao_simulada from plataforma.canais where id = $1", [id])).rows[0];
    const revisao = async () =>
      (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [espacoA])).rows[0]?.revisao;
    const outbox = async (id: string) =>
      Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.integration_outbox where aggregate_id = $1", [id])).rows[0]!.n);

    beforeAll(async () => {
      await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [espacoA]);
    });

    it("CR-01: desconectar e simular o Canal com credencial do provedor → 409 TRANSICAO_INVALIDA, e ele continua real", async () => {
      const id = await canalReal("provedor");
      expect((await acao(id, "desconectar")).statusCode).toBe(200);
      const antes = await revisao();
      const outboxAntes = await outbox(id);

      const resposta = await acao(id, "simular-conexao");
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ ok: false, codigo: "TRANSICAO_INVALIDA", error: FRASE_DO_CANAL_REAL });
      expect(await linha(id)).toEqual({ conexao: "desconectada", conexao_simulada: false });
      expect(await revisao()).toBe(antes);
      expect(await outbox(id)).toBe(outboxAntes);
    });

    it("CR-01: GET /canais/:id devolve ligadoAoProvedor true com a credencial ativa do provedor e false sem ela", async () => {
      const real = await canalReal("provedor");
      const demonstracao = await canalReal("so-webhook");
      const ler = async (id: string) => ((await appA().inject({ method: "GET", url: `/canais/${id}`, headers: ADMIN })).json() as { dados: CanalNaFicha }).dados;
      expect((await ler(real)).ligadoAoProvedor).toBe(true);
      expect((await ler(demonstracao)).ligadoAoProvedor).toBe(false);
    });

    it.each(["so-webhook", "nada", "provedor-revogada"] as const)(
      "CR-01: o Canal sem credencial ATIVA do provedor (%s) continua simulando",
      async (cofre) => {
        const id = await canalReal(cofre);
        expect((await acao(id, "desconectar")).statusCode).toBe(200);
        const resposta = await acao(id, "simular-conexao");
        expect(resposta.statusCode).toBe(200);
        expect((resposta.json() as { dados: Canal }).dados).toMatchObject({ conexao: "conectada", conexaoSimulada: true });
        expect(await linha(id)).toEqual({ conexao: "conectada", conexao_simulada: true });
      },
    );
  });
});
