/**
 * 06-12 Task 2 — a ponte sobre o domínio estrito de 06-11. O que 06-11
 * tornou estrito no domínio só chega ao processo se a ponte o usar:
 *
 *   - crm:WR-04 — o fio é lido em lote (`decisaoDasRespostasPendentes`):
 *     todas as respostas pendentes contam, o primeiro ajuste vence a
 *     aprovação do mesmo lote, e nada é relido sem resposta nova;
 *   - crm:WR-12 — o Resumo só sai sobre o snapshot certo: se a conta mudou
 *     entre a leitura do ciclo e a gravação, nada é publicado
 *     (`RESUMO_ADIADO`), e o ciclo seguinte refaz o `/resolver`;
 *   - crm:WR-03 — um Resumo sem código de Categoria recebe, na mesma
 *     gravação, a resposta `recusaSemCodigo` no fio; numa conta Manual com
 *     `sem-conferencia`, a ponte não tenta dispensar o que o domínio recusaria.
 *
 * O snapshot é uma cópia (`structuredClone`) a cada ciclo; a Unidade de
 * Trabalho em memória grava no `estado` do teste — como o banco.
 *
 * Arquivo novo (CON-05): regra nova, arquivo novo. Sem banco e sem rede real.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CP, TEXTOS_DA_CONFERENCIA, conferenciaDoResumo, publicarResumoParaConferencia } from "@n1/dominio/operations/financeiro";
import type { ApprovalRequest, DataState } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  ATOR,
  F,
  MARYANE,
  RESOLVER,
  RESOLVIDA,
  buildSeed,
  comentariosDoAgente,
  dePara200,
  definir,
  executarEmMemoria,
  isolar,
  ponteSobre,
  responder,
  resumosDe,
  vigente,
} from "../testes/fixtures-da-ponte";
import { MOTIVO_DA_DISPENSA, TEXTO_SEM_CODIGO_CONFERIDO, type OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

/** O de-para sem a Categoria: o Resumo sai `ausente`, com o código de preenchimento `9.99.99`. */
const SEM_CODIGO = { kind: "ok", status: 200, corpo: { dePara: { contaPorTag: { "conta tria": "TRIA COMPANY - ITAU" }, categoriaPorCampo: {}, origem: "omie" } } } as const;

describe("a ponte sobre o domínio estrito de 06-11 — servidorFalso, sem DATABASE_URL", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  const caminhos = () => servidor.recebidas.map((r) => r.caminho);

  /**
   * `das` isolada em "para pagar"; a ponte lê uma cópia por ciclo e grava em
   * `estado`. `antesDaProxima` roda uma vez, logo antes da próxima gravação
   * (a mudança que acontece "entre a leitura do ciclo e a gravação").
   */
  async function montar(extra: Partial<OpcoesDaPonte> = {}) {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const registros: Registro[] = [];
    const emMemoria = executarEmMemoria(estado);
    const controle = { gravacoes: 0, antesDaProxima: undefined as ((e: DataState) => void) | undefined };
    const ponte = ponteSobre(servidor, estado, {
      modo: "conferencia",
      hidratarEstado: async () => structuredClone(estado),
      executarOperacao: async (op) => {
        controle.gravacoes += 1;
        const antes = controle.antesDaProxima;
        controle.antesDaProxima = undefined;
        antes?.(estado);
        return emMemoria(op);
      },
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      ...extra,
    });
    return { estado, das, ponte, registros, controle };
  }

  async function comResumoPendente(extra: Partial<OpcoesDaPonte> = {}) {
    const m = await montar(extra);
    servidor.enfileirar(RESOLVIDA);
    await m.ponte.processarContas();
    expect(conferenciaDoResumo(m.estado, m.das).estado).toBe("pendente");
    return m;
  }

  describe("crm:WR-04 — o fio em lote", () => {
    it("(e) \"mude a categoria para comercial\" e depois \"pode ver?\": rejeitada com o pedido; o ciclo seguinte pede /resolver com ele", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      const primeira = vigente(estado, das);
      responder(estado, das, MARYANE, "mude a categoria para comercial");
      responder(estado, das, MARYANE, "pode ver?");

      await ponte.processarContas();
      const decidida = estado.approvals.find((a) => a.id === primeira.id) as ApprovalRequest;
      expect(decidida.decision).toBe("rejeitada");
      expect(decidida.decisionReason).toBe("mude a categoria para comercial");

      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);
      expect((servidor.recebidas[1]?.corpo as Record<string, unknown>).pedidoDeRevisao).toBe("mude a categoria para comercial");
    });

    it("(f) \"troque o vencimento\" (Maryane) e \"ok\" (outro revisor) no mesmo intervalo: rejeitada em nome da Maryane", async () => {
      const { estado, das, ponte } = await comResumoPendente();
      const c = vigente(estado, das);
      responder(estado, das, MARYANE, "troque o vencimento");
      responder(estado, das, "mem_thiago", "ok");
      await ponte.processarContas();
      const decidida = estado.approvals.find((a) => a.id === c.id) as ApprovalRequest;
      expect(decidida.decision).toBe("rejeitada");
      expect(decidida.decidedByMemberId).toBe(MARYANE);
    });

    it.each(["⚠️ o valor está errado", "certo, mas o vencimento é dia 15"])("(f) %o da Maryane: rejeitada, nunca aprovada", async (texto) => {
      const { estado, das, ponte } = await comResumoPendente();
      const c = vigente(estado, das);
      responder(estado, das, MARYANE, texto);
      await ponte.processarContas();
      expect((estado.approvals.find((a) => a.id === c.id) as ApprovalRequest).decision).toBe("rejeitada");
    });

    it("(g) nada novo no fio desde a última leitura: nenhuma gravação no ciclo", async () => {
      const { estado, das, ponte, controle } = await comResumoPendente();
      const depoisDoResumo = controle.gravacoes;
      await ponte.processarContas();
      expect(controle.gravacoes).toBe(depoisDoResumo);

      responder(estado, das, MARYANE, "pode ver?"); // não é decisão: lida e deixada de lado
      await ponte.processarContas();
      await ponte.processarContas();
      expect(controle.gravacoes).toBe(depoisDoResumo);
      expect(vigente(estado, das).decision).toBeUndefined();
    });
  });

  describe("crm:WR-12 — o Resumo sobre o snapshot certo", () => {
    it("(h) a Categoria muda entre a leitura e a gravação: nenhum Resumo, nenhuma parada, RESUMO_ADIADO; o ciclo seguinte resolve de novo e publica sobre a nova", async () => {
      const { estado, das, ponte, registros, controle } = await montar();
      servidor.enfileirar(RESOLVIDA);
      controle.antesDaProxima = (e) => definir(e.tasks.find((t) => t.id === "tsk_cp_das")!, F.categoria, "Tráfego Pago");

      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER]);
      expect(resumosDe(das)).toHaveLength(0);
      expect(comentariosDoAgente(das)).toHaveLength(0);
      expect(registros.some((r) => r.nivel === "info" && r.dados?.code === "RESUMO_ADIADO")).toBe(true);

      servidor.enfileirar({ kind: "ok", status: 200, corpo: dePara200("Tráfego Pago", { veredito: "resolvida" }) });
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);
      expect((servidor.recebidas[1]?.corpo as Record<string, unknown>).categoriaDePagamento).toBe("Tráfego Pago");
      expect(resumosDe(das)).toHaveLength(1);
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
    });

    it("(i) com C1 rejeitada, outro publicador solta o Resumo revisado entre a leitura e a gravação: RESUMO_ADIADO, dois Resumos no fio", async () => {
      const { estado, das, ponte, registros, controle } = await comResumoPendente();
      const c1 = vigente(estado, das);
      responder(estado, das, MARYANE, "é comercial");
      await ponte.processarContas();
      expect(conferenciaDoResumo(estado, das).estado).toBe("ajuste-pedido");

      servidor.enfileirar(RESOLVIDA);
      controle.antesDaProxima = (e) => {
        const p = publicarResumoParaConferencia(e, ATOR, "tsk_cp_das", { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara, conferenciaRejeitadaId: c1.id });
        if (!p.ok) throw new Error(p.error);
      };
      await ponte.processarContas();

      expect(registros.some((r) => r.dados?.code === "RESUMO_ADIADO")).toBe(true);
      expect(resumosDe(das)).toHaveLength(2);
      await ponte.processarContas();
      expect(resumosDe(das)).toHaveLength(2);
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
    });
  });

  describe("crm:WR-03 — o Resumo sem código", () => {
    it("(j) Categoria ausente: na mesma gravação, recusaSemCodigo no fio com Menção; um \"ok\" recusado recebe a mesma resposta, uma vez", async () => {
      const { estado, das, ponte, controle } = await montar();
      servidor.enfileirar(SEM_CODIGO);
      await ponte.processarContas();
      expect(controle.gravacoes).toBe(1);
      const c = vigente(estado, das);
      expect(c.origin.lancamento.veredito).toBe("ausente");
      const recusas = () => comentariosDoAgente(das).filter((x) => x.content === TEXTOS_DA_CONFERENCIA.recusaSemCodigo);
      expect(recusas()).toHaveLength(1);
      expect(recusas()[0]?.parentCommentId).toBe(c.origin.threadCommentId);
      expect(recusas()[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);

      responder(estado, das, MARYANE, "ok");
      await ponte.processarContas();
      await ponte.processarContas();
      expect(recusas()).toHaveLength(2);
      expect(recusas()[1]?.parentCommentId).toBe(c.origin.threadCommentId);
      expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
    });

    it("(k) sem-conferencia + Categoria ausente (Manual): Conferência normal do Financeiro com recusaSemCodigo; o ajuste com código gera o Resumo revisado, dispensado", async () => {
      const { estado, das, ponte } = await montar({ decisoes: { integracaoManual: "sem-conferencia" } });
      definir(das, F.integracaoManual, "Manual");
      servidor.enfileirar(SEM_CODIGO);
      await ponte.processarContas();

      const c1 = vigente(estado, das) as ApprovalRequest;
      expect(c1.approverMemberId).toBe(MARYANE);
      expect(c1.decision).toBeUndefined();
      expect(comentariosDoAgente(das).filter((x) => x.content === TEXTOS_DA_CONFERENCIA.recusaSemCodigo)).toHaveLength(1);

      responder(estado, das, MARYANE, "use 2.06.01");
      await ponte.processarContas();
      expect((estado.approvals.find((a) => a.id === c1.id) as ApprovalRequest).decision).toBe("rejeitada");

      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(caminhos()).toEqual([RESOLVER, RESOLVER]);
      expect((servidor.recebidas[1]?.corpo as Record<string, unknown>).codigoCategoriaConfirmado).toBe("2.06.01");
      const c2 = vigente(estado, das) as ApprovalRequest;
      expect(c2.id).not.toBe(c1.id);
      expect(c2.approverMemberId).toBe(ATOR);
      expect(c2.decision).toBe("aprovada");
      expect(c2.decisionReason).toBe(MOTIVO_DA_DISPENSA);
      expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
    });
  });
});

describe("crm:WR-03 — a guarda do Momento 2 (l)", () => {
  it("(l) a guarda do Momento 2 é lancamentoSemCodigo do domínio, e o aviso da Conferência antiga aponta a saída", () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const fonte = readFileSync(path.join(aqui, "invocar-agente.ts"), "utf8");
    expect(fonte.includes("REGEX_CODIGO_DE_CATEGORIA")).toBe(false);
    expect(fonte).toContain("lancamentoSemCodigo(conferida.origin.lancamento)");
    expect(TEXTO_SEM_CODIGO_CONFERIDO).toContain("não tem um código de Categoria");
    expect(TEXTO_SEM_CODIGO_CONFERIDO).toContain("Altere");
    expect(TEXTO_SEM_CODIGO_CONFERIDO).not.toContain("Responda no fio");
    expect(CP.fields.categoria).toBe(F.categoria);
  });
});
