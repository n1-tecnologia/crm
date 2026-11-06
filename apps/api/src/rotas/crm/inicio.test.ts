/**
 * Rotas GET /crm/inicio/* (15-18, 3.4.7, UCR-07), com serviço falso e sem banco:
 * autenticação, forma do `querystring` (`.strict()`: o Membro e o Espaço nunca vêm de fora),
 * a janela das estatísticas (fuso, ordem, 400 dias) e o envelope. A leitura contra o Postgres
 * local, por Espaço, Membro e Papel, está em `servicos/crm/inicio.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { JANELA_MAXIMA_DE_ESTATISTICAS_DIAS, QUALIFICACOES_MAXIMAS, type EstatisticasDoCrm, type LeadAAtenderDoCrm, type PanoramaDoCrm } from "@n1/dominio/crm/inicio";
import { usuarioDoSeed } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../../app";
import type { JanelaDeEstatisticas, ServicoDoInicio } from "../../servicos/crm/inicio";
import { recusa, sucesso, type ResultadoCrm } from "../../servicos/crm/resultado";

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

const PANORAMA: PanoramaDoCrm = {
  contatosRecentes: [{ id: "c1", nome: "Maria Silva" }],
  contatosTotal: 1,
  negociosAbertos: { quantidade: 2, valorPonderado: 700, moeda: "BRL" },
  conversasAbertas: 2,
};

const JANELA = { desde: "2026-03-01T00:00:00Z", ate: "2026-03-31T23:59:59Z", fuso: "America/Sao_Paulo" };

describe("rotas GET /crm/inicio/* — serviço falso, sem banco", () => {
  /** Serviço falso: registra cada chamada e devolve as respostas dadas (ou um padrão). */
  function novoFalso(respostas: { readonly panorama?: ResultadoCrm<PanoramaDoCrm>; readonly leads?: ResultadoCrm<readonly LeadAAtenderDoCrm[]> } = {}) {
    const chamadas = { panorama: [] as unknown[], leads: [] as [unknown, readonly string[]][], estatisticas: [] as [unknown, JanelaDeEstatisticas][] };
    const servico: ServicoDoInicio = {
      panorama: (membro) => {
        chamadas.panorama.push(membro);
        return Promise.resolve(respostas.panorama ?? sucesso(PANORAMA));
      },
      leadsAAtender: (membro, qualificacoes) => {
        chamadas.leads.push([membro, qualificacoes]);
        return Promise.resolve(respostas.leads ?? sucesso([]));
      },
      estatisticas: (membro, janela) => {
        chamadas.estatisticas.push([membro, janela]);
        const vazia: EstatisticasDoCrm = { ...janela, mensagensEnviadas: [], conversasResolvidas: [], negociosGanhos: [] };
        return Promise.resolve(sucesso(vazia));
      },
    };
    return { servico, chamadas };
  }
  const pedir = (servico: ServicoDoInicio, url: string, headers: Record<string, string> = AUTORIZACAO) =>
    buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { inicio: servico } }).inject({ method: "GET", url, headers });

  const estatisticasUrl = (parametros: Record<string, string>) => `/crm/inicio/estatisticas?${new URLSearchParams(parametros).toString()}`;
  const diasAntes = (ate: string, dias: number) => new Date(Date.parse(ate) - dias * 86_400_000).toISOString();

  describe("autenticação", () => {
    it.each(["/crm/inicio/panorama", "/crm/inicio/leads-a-atender?qualificacao=q1", estatisticasUrl(JANELA)])("sem Authorization %s responde 401 e não chega ao serviço", async (url) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, url, {});
      expect(resposta.statusCode).toBe(401);
      expect(chamadas.panorama).toHaveLength(0);
      expect(chamadas.leads).toHaveLength(0);
      expect(chamadas.estatisticas).toHaveLength(0);
    });
  });

  describe("panorama", () => {
    it("devolve { ok, dados } e repassa o Membro da sessão", async () => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, "/crm/inicio/panorama");
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ ok: true, dados: PANORAMA });
      expect(chamadas.panorama[0]).toMatchObject({ id: "mem_maryane" });
    });

    it.each(["membroId=mem_outro", "workspaceId=ws_de_outro", "x=1"])("parâmetro desconhecido (%s) responde 400 e não chega ao serviço", async (consulta) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, `/crm/inicio/panorama?${consulta}`);
      expect(resposta.statusCode).toBe(400);
      expect(chamadas.panorama).toHaveLength(0);
    });

    it("a recusa do serviço sai com o status e o envelope de erro", async () => {
      const { servico } = novoFalso({ panorama: recusa<never>(403, "Membro não encontrado neste Espaço de Trabalho.", { codigo: "PERMISSAO" }) });
      const resposta = await pedir(servico, "/crm/inicio/panorama");
      expect(resposta.statusCode).toBe(403);
      expect(resposta.json()).toEqual({ ok: false, error: "Membro não encontrado neste Espaço de Trabalho.", codigo: "PERMISSAO" });
    });
  });

  describe("leads a atender", () => {
    it("devolve { ok, itens, total } e repassa as Qualificações (uma ou várias) como lista", async () => {
      const lead: LeadAAtenderDoCrm = { contatoId: "c1", nome: "Maria", motivo: "semContato", conversaId: null, desde: "2026-01-10T12:00:00.000Z" };
      const { servico, chamadas } = novoFalso({ leads: sucesso([lead]) });

      const uma = await pedir(servico, "/crm/inicio/leads-a-atender?qualificacao=q1");
      expect(uma.statusCode).toBe(200);
      expect(uma.json()).toEqual({ ok: true, itens: [lead], total: 1 });
      const varias = await pedir(servico, "/crm/inicio/leads-a-atender?qualificacao=q2&qualificacao=q1");

      expect(varias.statusCode).toBe(200);
      expect(chamadas.leads.map(([, qualificacoes]) => qualificacoes)).toEqual([["q1"], ["q2", "q1"]]);
      expect(chamadas.leads[0]?.[0]).toMatchObject({ id: "mem_maryane" });
    });

    it("sem Qualificação a lista é vazia e o serviço responde", async () => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, "/crm/inicio/leads-a-atender");
      expect(resposta.statusCode).toBe(200);
      expect(chamadas.leads[0]?.[1]).toEqual([]);
    });

    it.each([
      ["membroId (o Membro nunca vem do cliente)", "qualificacao=q1&membroId=mem_outro"],
      ["workspaceId", "qualificacao=q1&workspaceId=ws_de_outro"],
      ["Qualificação vazia", "qualificacao="],
      ["Qualificação comprida demais", `qualificacao=${"x".repeat(65)}`],
      [`mais de ${QUALIFICACOES_MAXIMAS} Qualificações`, Array.from({ length: QUALIFICACOES_MAXIMAS + 1 }, (_, i) => `qualificacao=q${i}`).join("&")],
    ])("%s responde 400 e não chega ao serviço", async (_rotulo, consulta) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, `/crm/inicio/leads-a-atender?${consulta}`);
      expect(resposta.statusCode).toBe(400);
      expect(chamadas.leads).toHaveLength(0);
    });

    it(`exatamente ${QUALIFICACOES_MAXIMAS} Qualificações passam`, async () => {
      const { servico, chamadas } = novoFalso();
      const consulta = Array.from({ length: QUALIFICACOES_MAXIMAS }, (_, i) => `qualificacao=q${i}`).join("&");
      expect((await pedir(servico, `/crm/inicio/leads-a-atender?${consulta}`)).statusCode).toBe(200);
      expect(chamadas.leads[0]?.[1]).toHaveLength(QUALIFICACOES_MAXIMAS);
    });
  });

  describe("estatísticas", () => {
    it("devolve { ok, dados } e repassa a janela e o fuso, com o Membro da sessão", async () => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, estatisticasUrl(JANELA));
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ ok: true, dados: { ...JANELA, mensagensEnviadas: [], conversasResolvidas: [], negociosGanhos: [] } });
      expect(chamadas.estatisticas[0]?.[0]).toMatchObject({ id: "mem_maryane" });
      expect(chamadas.estatisticas[0]?.[1]).toEqual(JANELA);
    });

    it("fuso desconhecido (Marte/Base) responde 400 no campo fuso e não chega ao serviço", async () => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, estatisticasUrl({ ...JANELA, fuso: "Marte/Base" }));
      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toMatchObject({ ok: false, codigo: "VALOR_INVALIDO", campo: "fuso" });
      expect(chamadas.estatisticas).toHaveLength(0);
    });

    it("desde depois de ate responde 400 e não chega ao serviço", async () => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, estatisticasUrl({ ...JANELA, desde: JANELA.ate, ate: JANELA.desde }));
      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toMatchObject({ ok: false, campo: "desde" });
      expect(chamadas.estatisticas).toHaveLength(0);
    });

    it(`a janela de ${JANELA_MAXIMA_DE_ESTATISTICAS_DIAS} dias passa e a de ${JANELA_MAXIMA_DE_ESTATISTICAS_DIAS + 1} responde 400`, async () => {
      const { servico, chamadas } = novoFalso();
      const ate = "2027-04-05T00:00:00Z";
      expect((await pedir(servico, estatisticasUrl({ desde: diasAntes(ate, JANELA_MAXIMA_DE_ESTATISTICAS_DIAS), ate, fuso: "UTC" }))).statusCode).toBe(200);
      const longa = await pedir(servico, estatisticasUrl({ desde: diasAntes(ate, JANELA_MAXIMA_DE_ESTATISTICAS_DIAS + 1), ate, fuso: "UTC" }));
      expect(longa.statusCode).toBe(400);
      expect(chamadas.estatisticas).toHaveLength(1);
    });

    it.each([
      ["membroId (o Membro nunca vem do cliente)", { ...JANELA, membroId: "mem_outro" }],
      ["workspaceId", { ...JANELA, workspaceId: "ws_de_outro" }],
      ["sem desde", { ate: JANELA.ate, fuso: JANELA.fuso }],
      ["sem ate", { desde: JANELA.desde, fuso: JANELA.fuso }],
      ["sem fuso", { desde: JANELA.desde, ate: JANELA.ate }],
      ["desde que não é instante", { ...JANELA, desde: "ontem" }],
      ["ate sem fuso horário no instante", { ...JANELA, ate: "2026-03-31T23:59:59" }],
    ])("%s responde 400 e não chega ao serviço", async (_rotulo, parametros) => {
      const { servico, chamadas } = novoFalso();
      const resposta = await pedir(servico, estatisticasUrl(parametros));
      expect(resposta.statusCode).toBe(400);
      expect(chamadas.estatisticas).toHaveLength(0);
    });
  });
});
