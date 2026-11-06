/**
 * `POST /tarefas-conversacionais`, `/resumo`, `/:taskId/canal`, `/:taskId/negocio` e `/:taskId/negocio/novo` (14-13 e 14-14, 3.3.1 e 3.3.3 a 3.3.6), com serviço falso e sem banco:
 * autenticação, forma do corpo (`.strict()`: referências conferidas e `workspaceId`
 * nunca vêm do navegador, T-14-31) e o envelope. A criação contra o Postgres local
 * está em `servicos/crm/tarefas-conversacionais.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import { RESUMO_MAXIMO, type ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";
import type { RespostaDaTarefaConversacional, ServicoDeTarefasConversacionais } from "../../servicos/crm/tarefas-conversacionais";

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

/** Os gestos do 14-14 que o bloco em teste não chama: o falso recusa se alguém os chamar. */
const FORA_DO_ESCOPO = {
  trocarCanal: () => Promise.reject(new Error("fora do escopo deste bloco")),
  vincularNegocio: () => Promise.reject(new Error("fora do escopo deste bloco")),
  criarNegocio: () => Promise.reject(new Error("fora do escopo deste bloco")),
} satisfies Pick<ServicoDeTarefasConversacionais, "trocarCanal" | "vincularNegocio" | "criarNegocio">;

const CORPO = { listId: "lst_pos_venda", contatoId: "c1", canalId: "k1", mensagem: { conteudo: "Olá!" } };

const resposta = { ok: true, value: { task: { id: "tsk_1" } }, diferenca: {}, revisao: 3, revisaoAnterior: 2, sequencia: 10, conversa: { id: "cv1", aberta: true } };

describe("POST /tarefas-conversacionais — serviço falso, sem banco", () => {
  function novoFalso(desfecho: ResultadoCrm<RespostaDaTarefaConversacional> = sucesso(resposta as unknown as RespostaDaTarefaConversacional)) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeTarefasConversacionais = {
      criar: (...a) => {
        chamadas.push(a);
        return Promise.resolve(desfecho);
      },
      resumo: () => Promise.reject(new Error("fora do escopo deste bloco")),
      ...FORA_DO_ESCOPO,
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeTarefasConversacionais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { tarefasConversacionais: servico } });
  const criar = (servico: ServicoDeTarefasConversacionais, payload?: Record<string, unknown>) =>
    appCom(servico).inject(
      payload === undefined
        ? { method: "POST", url: "/tarefas-conversacionais", headers: AUTORIZACAO }
        : { method: "POST", url: "/tarefas-conversacionais", headers: AUTORIZACAO, payload },
    );

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await appCom(servico).inject({ method: "POST", url: "/tarefas-conversacionais", payload: CORPO });
    expect(r.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("repassa o Membro da sessão e o corpo, e devolve 201 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await criar(servico, CORPO);
    expect(r.statusCode).toBe(201);
    expect(r.json()).toEqual({ ok: true, dados: resposta });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toEqual(CORPO);
  });

  it("a Mensagem é opcional (D-07 é regra do serviço, que olha o par) e os campos da Tarefa passam", async () => {
    const { servico, chamadas } = novoFalso();
    const completo = {
      listId: "lst_pos_venda",
      contatoId: "c1",
      canalId: "k1",
      negocioId: "n1",
      title: "Renovação",
      statusId: "st1",
      assignees: [{ kind: "member", id: "mem_maryane" }],
      priority: "alta",
      dueDate: { form: "civilDay", value: "2026-12-01" },
      taskTypeId: "tt1",
    };
    const r = await criar(servico, completo);
    expect(r.statusCode).toBe(201);
    expect(chamadas[0]?.[1]).toEqual(completo);
  });

  it.each([
    ["alvoConferido no corpo", { ...CORPO, alvoConferido: true }],
    ["referencias no corpo", { ...CORPO, referencias: { contato: { id: "c1", nome: "Falso" } } }],
    ["workspaceId no corpo", { ...CORPO, workspaceId: "ws_de_outro" }],
    ["nome do Contato no corpo", { ...CORPO, contatoNome: "Falso" }],
    ["campo a mais na Mensagem", { ...CORPO, mensagem: { conteudo: "Oi", direcao: "recebida" } }],
    ["Mensagem vazia", { ...CORPO, mensagem: { conteudo: "" } }],
    ["sem Lista", { contatoId: "c1", canalId: "k1" }],
    ["sem Contato", { listId: "l1", canalId: "k1" }],
    ["sem Canal", { listId: "l1", contatoId: "c1" }],
    ["prioridade inválida", { ...CORPO, priority: "altíssima" }],
    ["Contato que não é texto", { ...CORPO, contatoId: 7 }],
  ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const r = await criar(servico, payload);
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("sem corpo responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await criar(servico);
    expect(r.statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    [400, "Escreva a primeira Mensagem: este Contato não tem Conversa aberta neste Canal.", "VALOR_INVALIDO", "mensagem"],
    [404, "Contato não encontrado.", "CONTATO_NAO_ENCONTRADO", "contatoId"],
    [409, "Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.", "CONTATO_MESCLADO", "contatoId"],
    [409, "Este Negócio não é deste Contato.", "NEGOCIO_DE_OUTRO_CONTATO", "negocioId"],
    [409, "Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.", "RECUSA_DO_DOMINIO", "lista"],
    [403, "Seu Papel não pode criar Conversas.", "PERMISSAO", undefined],
  ] as const)("a recusa %i do serviço chega com status e frase, sem nome de constraint", async (status, frase, codigo, campo) => {
    const { servico } = novoFalso(recusa(status, frase, { codigo, ...(campo !== undefined ? { campo } : {}) }));
    const r = await criar(servico, CORPO);
    expect(r.statusCode).toBe(status);
    expect(r.json()).toEqual({ ok: false, error: frase, codigo, ...(campo !== undefined ? { campo } : {}) });
    expect(JSON.stringify(r.json())).not.toMatch(/_fk|_uq|_ck|constraint/i);
  });
});

const itemDeResumo: ResumoDaTarefaConversacional = {
  taskId: "tsk_1",
  contato: { id: "c1", nome: "Marina" },
  canal: { id: "k1", nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada" },
  ultimaMensagem: { trecho: "Oi", direcao: "recebida", criadoEm: "2026-03-01T10:00:00.000Z" },
  negocio: null,
  empresa: null,
  qualificacaoId: null,
  conversa: null,
};

describe("POST /tarefas-conversacionais/resumo — serviço falso, sem banco", () => {
  function novoFalso(desfecho: ResultadoCrm<readonly ResumoDaTarefaConversacional[]> = sucesso([itemDeResumo])) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeTarefasConversacionais = {
      criar: () => Promise.reject(new Error("fora do escopo deste bloco")),
      resumo: (...a) => {
        chamadas.push(a);
        return Promise.resolve(desfecho);
      },
      ...FORA_DO_ESCOPO,
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeTarefasConversacionais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { tarefasConversacionais: servico } });
  const resumir = (servico: ServicoDeTarefasConversacionais, payload?: Record<string, unknown>) =>
    appCom(servico).inject(
      payload === undefined
        ? { method: "POST", url: "/tarefas-conversacionais/resumo", headers: AUTORIZACAO }
        : { method: "POST", url: "/tarefas-conversacionais/resumo", headers: AUTORIZACAO, payload },
    );
  const vinculo = (i: number) => ({ taskId: `tsk_${i}`, contatoId: "c1", conversaId: "cv1", negocioId: "n1" });

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await appCom(servico).inject({ method: "POST", url: "/tarefas-conversacionais/resumo", payload: { vinculos: [] } });
    expect(r.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("repassa o Membro e os Vínculos, e devolve 200 { ok, itens, total }", async () => {
    const { servico, chamadas } = novoFalso();
    const vinculos = [vinculo(1), { taskId: "tsk_2" }];
    const r = await resumir(servico, { vinculos });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, itens: [itemDeResumo], total: 1 });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toEqual(vinculos);
  });

  it(`aceita ${RESUMO_MAXIMO} Vínculos e recusa ${RESUMO_MAXIMO + 1} com 400 antes do serviço`, async () => {
    const { servico, chamadas } = novoFalso();
    expect((await resumir(servico, { vinculos: Array.from({ length: RESUMO_MAXIMO }, (_, i) => vinculo(i)) })).statusCode).toBe(200);
    expect((await resumir(servico, { vinculos: Array.from({ length: RESUMO_MAXIMO + 1 }, (_, i) => vinculo(i)) })).statusCode).toBe(400);
    expect(chamadas).toHaveLength(1);
  });

  it.each([
    ["Vínculo com campo a mais", { vinculos: [{ ...vinculo(1), workspaceId: "ws_de_outro" }] }],
    ["Vínculo sem taskId", { vinculos: [{ contatoId: "c1" }] }],
    ["id que não é texto", { vinculos: [{ taskId: "t", contatoId: 7 }] }],
    ["workspaceId no corpo", { vinculos: [], workspaceId: "ws_de_outro" }],
    ["sem vinculos", {}],
    ["vinculos que não é lista", { vinculos: "tsk_1" }],
  ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const r = await resumir(servico, payload);
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("a recusa do serviço chega com status e frase", async () => {
    const { servico } = novoFalso(recusa(403, "Seu Papel não pode ler Contatos.", { codigo: "PERMISSAO" }));
    const r = await resumir(servico, { vinculos: [vinculo(1)] });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({ ok: false, error: "Seu Papel não pode ler Contatos.", codigo: "PERMISSAO" });
  });
});

const respostaDoCanal = {
  ok: true,
  value: { task: { id: "tsk_1" }, mudou: true },
  diferenca: {},
  revisao: 4,
  revisaoAnterior: 3,
  sequencia: 11,
  conversa: { id: "cv2", aberta: true },
};

describe("POST /tarefas-conversacionais/:taskId/canal — serviço falso, sem banco", () => {
  function novoFalso(desfecho: ResultadoCrm<unknown> = sucesso(respostaDoCanal)) {
    const chamadas: unknown[][] = [];
    const servico: ServicoDeTarefasConversacionais = {
      criar: () => Promise.reject(new Error("fora do escopo deste bloco")),
      resumo: () => Promise.reject(new Error("fora do escopo deste bloco")),
      ...FORA_DO_ESCOPO,
      trocarCanal: (...a) => {
        chamadas.push(a);
        return Promise.resolve(desfecho as never);
      },
    };
    return { servico, chamadas };
  }
  const appCom = (servico: ServicoDeTarefasConversacionais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { tarefasConversacionais: servico } });
  const trocar = (servico: ServicoDeTarefasConversacionais, payload?: Record<string, unknown>, taskId = "tsk_1") =>
    appCom(servico).inject(
      payload === undefined
        ? { method: "POST", url: `/tarefas-conversacionais/${taskId}/canal`, headers: AUTORIZACAO }
        : { method: "POST", url: `/tarefas-conversacionais/${taskId}/canal`, headers: AUTORIZACAO, payload },
    );

  it("sem Authorization responde 401 e não chega ao serviço", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await appCom(servico).inject({ method: "POST", url: "/tarefas-conversacionais/tsk_1/canal", payload: { canalId: "k2" } });
    expect(r.statusCode).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it("repassa o Membro da sessão, o taskId do caminho e o corpo, e devolve 200 { ok, dados }", async () => {
    const { servico, chamadas } = novoFalso();
    const corpo = { canalId: "k2", mensagem: { conteudo: "Escrevo por e-mail." } };
    const r = await trocar(servico, corpo, "tsk_77");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, dados: respostaDoCanal });
    expect(chamadas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    expect(chamadas[0]?.[1]).toBe("tsk_77");
    expect(chamadas[0]?.[2]).toEqual(corpo);
  });

  it("a Mensagem é opcional (D-07 é regra do serviço)", async () => {
    const { servico, chamadas } = novoFalso();
    const r = await trocar(servico, { canalId: "k2" });
    expect(r.statusCode).toBe(200);
    expect(chamadas[0]?.[2]).toEqual({ canalId: "k2" });
  });

  it.each([
    ["sem Canal", {}],
    ["Canal que não é texto", { canalId: 7 }],
    ["workspaceId no corpo", { canalId: "k2", workspaceId: "ws_de_outro" }],
    ["contatoId no corpo (o Contato vem do Vínculo)", { canalId: "k2", contatoId: "c1" }],
    ["conversaId no corpo", { canalId: "k2", conversaId: "cv9" }],
    ["campo a mais na Mensagem", { canalId: "k2", mensagem: { conteudo: "Oi", direcao: "recebida" } }],
    ["Mensagem vazia", { canalId: "k2", mensagem: { conteudo: "" } }],
  ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
    const { servico, chamadas } = novoFalso();
    const r = await trocar(servico, payload);
    expect(r.statusCode).toBe(400);
    expect(r.json().ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("sem corpo responde 400", async () => {
    const { servico, chamadas } = novoFalso();
    expect((await trocar(servico)).statusCode).toBe(400);
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    [400, "Escreva a primeira Mensagem: este Contato não tem Conversa aberta neste Canal.", "VALOR_INVALIDO", "mensagem"],
    [404, "Canal não encontrado.", "CANAL_NAO_ENCONTRADO", "canalId"],
    [409, "O Canal Antigo está desconectado: escolha outro Canal ou reconecte-o.", "RECUSA_DO_DOMINIO", "canal"],
    [409, "Esta Tarefa não tem Contato vinculado.", "RECUSA_DO_DOMINIO", undefined],
    [403, "Seu Papel não pode criar Conversas.", "PERMISSAO", undefined],
  ] as const)("a recusa %i do serviço chega com status e frase, sem nome de constraint", async (status, frase, codigo, campo) => {
    const { servico } = novoFalso(recusa(status, frase, { codigo, ...(campo !== undefined ? { campo } : {}) }));
    const r = await trocar(servico, { canalId: "k2" });
    expect(r.statusCode).toBe(status);
    expect(r.json()).toEqual({ ok: false, error: frase, codigo, ...(campo !== undefined ? { campo } : {}) });
    expect(JSON.stringify(r.json())).not.toMatch(/_fk|_uq|_ck|constraint/i);
  });
});

const respostaDoNegocio = { ok: true, value: { id: "tsk_1" }, diferenca: {}, revisao: 5, revisaoAnterior: 4, sequencia: 12 };

describe("POST /tarefas-conversacionais/:taskId/negocio e /negocio/novo — serviço falso, sem banco", () => {
  function novoFalso(desfecho: ResultadoCrm<unknown> = sucesso(respostaDoNegocio)) {
    const ligar: unknown[][] = [];
    const criar: unknown[][] = [];
    const servico: ServicoDeTarefasConversacionais = {
      criar: () => Promise.reject(new Error("fora do escopo deste bloco")),
      resumo: () => Promise.reject(new Error("fora do escopo deste bloco")),
      ...FORA_DO_ESCOPO,
      vincularNegocio: (...a) => {
        ligar.push(a);
        return Promise.resolve(desfecho as never);
      },
      criarNegocio: (...a) => {
        criar.push(a);
        return Promise.resolve(desfecho as never);
      },
    };
    return { servico, ligar, criar };
  }
  const appCom = (servico: ServicoDeTarefasConversacionais) => buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { tarefasConversacionais: servico } });
  const postar = (servico: ServicoDeTarefasConversacionais, url: string, payload?: Record<string, unknown>) =>
    appCom(servico).inject(payload === undefined ? { method: "POST", url, headers: AUTORIZACAO } : { method: "POST", url, headers: AUTORIZACAO, payload });

  describe("/negocio", () => {
    it("sem Authorization responde 401 e não chega ao serviço", async () => {
      const { servico, ligar } = novoFalso();
      const r = await appCom(servico).inject({ method: "POST", url: "/tarefas-conversacionais/tsk_1/negocio", payload: { negocioId: "n1" } });
      expect(r.statusCode).toBe(401);
      expect(ligar).toHaveLength(0);
    });

    it("repassa o Membro, o taskId do caminho e o negocioId (ou null, que desliga) e devolve 200 { ok, dados }", async () => {
      const { servico, ligar } = novoFalso();
      const r = await postar(servico, "/tarefas-conversacionais/tsk_9/negocio", { negocioId: "n1" });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ ok: true, dados: respostaDoNegocio });
      expect(ligar[0]?.[0]).toMatchObject({ id: "mem_maryane" });
      expect(ligar[0]?.[1]).toBe("tsk_9");
      expect(ligar[0]?.[2]).toEqual({ negocioId: "n1" });

      expect((await postar(servico, "/tarefas-conversacionais/tsk_9/negocio", { negocioId: null })).statusCode).toBe(200);
      expect(ligar[1]?.[2]).toEqual({ negocioId: null });
    });

    it.each([
      ["sem negocioId", {}],
      ["negocioId que não é texto nem null", { negocioId: 7 }],
      ["negocioId vazio", { negocioId: "" }],
      ["contatoId no corpo (o Contato vem do Vínculo)", { negocioId: "n1", contatoId: "c1" }],
      ["workspaceId no corpo", { negocioId: "n1", workspaceId: "ws_de_outro" }],
    ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
      const { servico, ligar } = novoFalso();
      const r = await postar(servico, "/tarefas-conversacionais/tsk_1/negocio", payload);
      expect(r.statusCode).toBe(400);
      expect(r.json().ok).toBe(false);
      expect(ligar).toHaveLength(0);
    });

    it("sem corpo responde 400", async () => {
      const { servico, ligar } = novoFalso();
      expect((await postar(servico, "/tarefas-conversacionais/tsk_1/negocio")).statusCode).toBe(400);
      expect(ligar).toHaveLength(0);
    });

    it("a recusa 409 do serviço chega com a frase e o campo", async () => {
      const { servico } = novoFalso(recusa(409, "Este Negócio não é deste Contato.", { codigo: "NEGOCIO_DE_OUTRO_CONTATO", campo: "negocioId" }));
      const r = await postar(servico, "/tarefas-conversacionais/tsk_1/negocio", { negocioId: "n1" });
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ ok: false, error: "Este Negócio não é deste Contato.", codigo: "NEGOCIO_DE_OUTRO_CONTATO", campo: "negocioId" });
    });
  });

  describe("/negocio/novo", () => {
    it("sem Authorization responde 401 e não chega ao serviço", async () => {
      const { servico, criar } = novoFalso();
      const r = await appCom(servico).inject({ method: "POST", url: "/tarefas-conversacionais/tsk_1/negocio/novo", payload: { funilId: "f1" } });
      expect(r.statusCode).toBe(401);
      expect(criar).toHaveLength(0);
    });

    it("repassa o Membro, o taskId e o corpo, e devolve 201 { ok, dados }", async () => {
      const { servico, criar } = novoFalso();
      const corpo = { funilId: "f1", titulo: "Renovação", valor: "1500.50" };
      const r = await postar(servico, "/tarefas-conversacionais/tsk_9/negocio/novo", corpo);
      expect(r.statusCode).toBe(201);
      expect(r.json()).toEqual({ ok: true, dados: respostaDoNegocio });
      expect(criar[0]?.[0]).toMatchObject({ id: "mem_maryane" });
      expect(criar[0]?.[1]).toBe("tsk_9");
      expect(criar[0]?.[2]).toEqual(corpo);
    });

    it("só o Funil é obrigatório (título e valor são opcionais)", async () => {
      const { servico, criar } = novoFalso();
      expect((await postar(servico, "/tarefas-conversacionais/tsk_1/negocio/novo", { funilId: "f1" })).statusCode).toBe(201);
      expect(criar[0]?.[2]).toEqual({ funilId: "f1" });
    });

    it.each([
      ["sem Funil", { titulo: "Renovação" }],
      ["valor com vírgula", { funilId: "f1", valor: "1500,50" }],
      ["valor como número", { funilId: "f1", valor: 1500 }],
      ["título vazio", { funilId: "f1", titulo: "" }],
      ["contatoId no corpo (o Contato vem do Vínculo)", { funilId: "f1", contatoId: "c1" }],
      ["etapaId no corpo (nasce na 1ª Etapa)", { funilId: "f1", etapaId: "e1" }],
      ["proprietarioId no corpo", { funilId: "f1", proprietarioId: "mem_outro" }],
      ["workspaceId no corpo", { funilId: "f1", workspaceId: "ws_de_outro" }],
    ])("com %s responde 400 e não chega ao serviço", async (_rotulo, payload) => {
      const { servico, criar } = novoFalso();
      const r = await postar(servico, "/tarefas-conversacionais/tsk_1/negocio/novo", payload);
      expect(r.statusCode).toBe(400);
      expect(r.json().ok).toBe(false);
      expect(criar).toHaveLength(0);
    });

    it.each([
      [404, "Funil não encontrado.", "FUNIL_NAO_ENCONTRADO", "funilId"],
      [409, "Esta Tarefa já tem Negócio vinculado.", "RECUSA_DO_DOMINIO", undefined],
      [403, "Seu Papel não pode criar Negócios.", "PERMISSAO", undefined],
    ] as const)("a recusa %i do serviço chega com status e frase, sem nome de constraint", async (status, frase, codigo, campo) => {
      const { servico } = novoFalso(recusa(status, frase, { codigo, ...(campo !== undefined ? { campo } : {}) }));
      const r = await postar(servico, "/tarefas-conversacionais/tsk_1/negocio/novo", { funilId: "f1" });
      expect(r.statusCode).toBe(status);
      expect(r.json()).toEqual({ ok: false, error: frase, codigo, ...(campo !== undefined ? { campo } : {}) });
      expect(JSON.stringify(r.json())).not.toMatch(/_fk|_uq|_ck|constraint/i);
    });
  });
});
