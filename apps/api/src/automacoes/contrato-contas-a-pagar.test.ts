/**
 * Contrato `contas-a-pagar-v1` visto pela ponte do Agente de lançamento.
 *
 * O PRODUTOR é o `automation/` (financeiro-tria): os exemplos canônicos de
 * `contratos/contas-a-pagar-v1/` nascem lá, e o teste de lá prova que cada um
 * é exatamente o que o handler real de `/resolver` e `/lancar` devolve. Esta
 * pasta é cópia VERBATIM daquela (a igualdade é conferida por hash quando o
 * repositório irmão está ao lado, ver o último `describe`). Aqui se prova o
 * outro lado: que a ponte age sobre cada exemplo do jeito que o contrato
 * declara — sem isso, o produtor podia mudar um código ou a forma do motivo e
 * a ponte seguiria "verde" contra os seus próprios exemplos inventados.
 *
 * Sem banco e sem rede real: servidor HTTP falso em loopback e Unidade de
 * Trabalho em memória, como `invocar-agente.test.ts`.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import { changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { classificar, criarPonteDoAgente, motivoDoEnvelope } from "./invocar-agente";

interface Exemplo {
  readonly descricao: string;
  readonly requisicao: { readonly metodo: string; readonly caminho: string; readonly headers: Record<string, string>; readonly body: unknown };
  readonly resposta: { readonly status: number; readonly corpo: Record<string, unknown> };
}

interface EnvelopeDeErro {
  readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean; readonly details?: { readonly motivo?: string } };
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_MONOREPO = path.resolve(AQUI, "../../../../");
const PASTA = path.join(RAIZ_MONOREPO, "contratos", "contas-a-pagar-v1");
// Mesma convenção de `e2e/dois-servicos-suporte.ts`: o repositório irmão ao lado, ou FINANCEIRO_TRIA_DIR.
const FINANCEIRO_TRIA_DIR = process.env.FINANCEIRO_TRIA_DIR
  ? path.resolve(RAIZ_MONOREPO, process.env.FINANCEIRO_TRIA_DIR)
  : path.resolve(RAIZ_MONOREPO, "..", "financeiro-tria");
const PASTA_DO_PRODUTOR = path.join(FINANCEIRO_TRIA_DIR, "automation", "contratos", "contas-a-pagar-v1");

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".json")).sort();
const exemplos = arquivos.map((arquivo) => ({ arquivo, exemplo: JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as Exemplo }));
const exemplo = (arquivo: string): Exemplo => {
  const achado = exemplos.find((e) => e.arquivo === arquivo);
  if (!achado) throw new Error(`exemplo ausente: ${arquivo}`);
  return achado.exemplo;
};
const erros = exemplos.filter(({ exemplo }) => exemplo.resposta.status >= 400);
/** A Categoria (`categoriaDePagamento`) de todos os exemplos canônicos. */
const CATEGORIA_DOS_EXEMPLOS = "Impostos";

/** A mesma normalização que a ponte aplica antes de pôr o motivo num Comentário. */
function motivoEsperado(corpo: EnvelopeDeErro): string | undefined {
  const bruto = corpo.error.details?.motivo ?? corpo.error.message;
  const limpo = bruto.replace(/\s+/g, " ").trim();
  return limpo.length > 300 ? `${limpo.slice(0, 299)}…` : limpo || undefined;
}

describe("contratos/contas-a-pagar-v1 — a pasta", () => {
  it("tem os exemplos das duas rotas, de sucesso e de erro", () => {
    expect(arquivos.some((f) => f.startsWith("resolver.sucesso"))).toBe(true);
    expect(arquivos.some((f) => f.startsWith("lancar.sucesso"))).toBe(true);
    expect(erros.length).toBeGreaterThanOrEqual(8);
  });
});

describe("contrato — cada erro é classificado como o produtor declara", () => {
  it.each(erros.map((e) => [e.arquivo, e.exemplo] as const))("%s", (_arquivo, exemplo) => {
    const corpo = exemplo.resposta.corpo as unknown as EnvelopeDeErro;
    const classificacao = classificar(exemplo.resposta.status, corpo, undefined);
    expect(classificacao.code).toBe(corpo.error.code);
    // `retryable: false` é permanente (a ponte comenta e para); `true` é transitório (conta tentativas).
    expect(classificacao.permanente).toBe(corpo.error.retryable === false);
    if (classificacao.permanente) expect(motivoDoEnvelope(corpo)).toBe(motivoEsperado(corpo));
  });
});

describe("contrato — os sucessos têm o que a ponte lê", () => {
  it("/lancar devolve payableId real (nunca mock-) e o flag reaproveitado", () => {
    for (const arquivo of arquivos.filter((f) => f.startsWith("lancar.sucesso"))) {
      const corpo = exemplo(arquivo).resposta.corpo as { payableId?: unknown; reaproveitado?: unknown };
      expect(typeof corpo.payableId, arquivo).toBe("string");
      expect(String(corpo.payableId).startsWith("mock-"), arquivo).toBe(false);
      expect(typeof corpo.reaproveitado, arquivo).toBe("boolean");
    }
    expect((exemplo("lancar.sucesso-reaproveitado.json").resposta.corpo as { reaproveitado: boolean }).reaproveitado).toBe(true);
  });

  it("/resolver devolve o de-para na forma do domínio", () => {
    for (const arquivo of arquivos.filter((f) => f.startsWith("resolver.sucesso"))) {
      const dePara = (exemplo(arquivo).resposta.corpo as { dePara?: Record<string, unknown> }).dePara;
      expect(dePara, arquivo).toBeDefined();
      expect(Object.keys(dePara ?? {}).sort(), arquivo).toEqual(["categoriaPorCampo", "contaPorTag", "origem"]);
    }
  });
});

describe("contrato — a ponte de ponta a ponta com as respostas canônicas", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  const S = CP.status;
  const MARYANE = CP.financeiroId;
  // A Categoria dos exemplos canônicos de `/resolver` e de `/lancar`.
  const CATEGORIA = "Impostos";

  /** Só a DAS do seed fica em "em lançamento omie", e ENTRA lá por movimento, como a ponte exige. */
  function dasEmLancamento(estado: DataState): Task {
    for (const t of estado.tasks) {
      if (t.listId === CP.listId && t.id !== "tsk_cp_das" && t.statusId === S.emLancamento) t.statusId = S.lancado;
    }
    const das = estado.tasks.find((t) => t.id === "tsk_cp_das");
    if (!das) throw new Error("sem tsk_cp_das no seed");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== CP.fields.categoria);
    das.fieldValues.push({ definitionId: CP.fields.categoria, value: CATEGORIA, state: "ativo" });
    const movida = changeTaskStatus(estado, MARYANE, das.id, S.emLancamento);
    if (!movida.ok) throw new Error(movida.error);
    return das;
  }

  function ponte(estado: DataState) {
    return criarPonteDoAgente({
      destinoUrl: servidor.url,
      token: "tok-lancar",
      workspaceId: estado.workspace.id,
      listId: CP.listId,
      modo: "lancar",
      hidratarEstado: async () => estado,
      resolverAtor: async () => MARYANE,
      executarOperacao: async (operacao) => {
        const r = operacao(estado);
        return r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "recusado" } as const);
      },
    });
  }

  const responder = (arquivo: string) => {
    const { status, corpo } = exemplo(arquivo).resposta;
    return { kind: "ok", status, corpo } as const;
  };

  it("resolver.sucesso-resolvida + lancar.sucesso: Resumo publicado e a conta vai para \"lançado omie\"", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = dasEmLancamento(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    servidor.enfileirar(responder("lancar.sucesso.json"));

    await ponte(estado).lancarContasEmLancamento();

    expect(das.statusId).toBe(S.lancado);
    expect(das.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
  });

  it("resolver.sucesso-resolvida + lancar.sucesso-reaproveitado: título já existente também é sucesso", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = dasEmLancamento(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    servidor.enfileirar(responder("lancar.sucesso-reaproveitado.json"));

    await ponte(estado).lancarContasEmLancamento();

    expect(das.statusId).toBe(S.lancado);
  });

  it.each([
    "lancar.erro-422-omie-recusou.json",
    "lancar.erro-422-fornecedor-nao-resolvido.json",
    "lancar.erro-422-conta-corrente-nao-resolvida.json",
  ])("%s: a conta fica, o motivo do automation/ vira Comentário, e a ponte não chama de novo", async (arquivo) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = dasEmLancamento(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    servidor.enfileirar(responder(arquivo));
    const p = ponte(estado);

    await p.lancarContasEmLancamento();
    await p.lancarContasEmLancamento();

    const motivo = motivoEsperado(exemplo(arquivo).resposta.corpo as unknown as EnvelopeDeErro) ?? "";
    expect(das.statusId).toBe(S.emLancamento);
    expect(das.comments.filter((c) => c.author.kind === "agent" && c.content.includes(motivo))).toHaveLength(1);
    expect(servidor.recebidas).toHaveLength(2); // o segundo ciclo não chama o automation/
  });

  it("lancar.erro-500-omie-indisponivel: transitório — sem Comentário na primeira falha, a conta fica", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = dasEmLancamento(estado);
    const comentariosAntes = das.comments.length;
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    servidor.enfileirar(responder("lancar.erro-500-omie-indisponivel.json"));

    await ponte(estado).lancarContasEmLancamento();

    expect(das.statusId).toBe(S.emLancamento);
    expect(das.comments.length).toBe(comentariosAntes);
  });
});

describe("contrato v1.1 (aditiva, Plan 06-02) — os exemplos novos têm o que a ponte vai mandar e ler", () => {
  interface CorpoDeLancar {
    readonly codigoCategoriaConfirmado?: string;
    readonly anexos?: ReadonlyArray<string | { readonly url: string; readonly nome: string }>;
  }
  interface AnexoRelatado {
    readonly url: string;
    readonly nome?: string;
    readonly ok: boolean;
    readonly erro?: string;
  }
  const categoriaDe = (arquivo: string) =>
    (exemplo(arquivo).resposta.corpo as { dePara: { categoriaPorCampo: Record<string, Record<string, unknown>> } }).dePara.categoriaPorCampo;

  it("os três exemplos v1.1 estão na pasta, e os v1 continuam lá", () => {
    for (const arquivo of [
      "resolver.sucesso-pedido-de-revisao.json",
      "resolver.sucesso-codigo-confirmado.json",
      "lancar.sucesso-anexos-nomeados.json",
      "resolver.sucesso-resolvida.json",
      "lancar.sucesso.json",
    ]) {
      expect(arquivos, arquivo).toContain(arquivo);
    }
  });

  it("pedidoDeRevisao só no pedido: nunca ecoado na resposta", () => {
    const { requisicao, resposta } = exemplo("resolver.sucesso-pedido-de-revisao.json");
    const pedido = (requisicao.body as { pedidoDeRevisao?: string }).pedidoDeRevisao;
    expect(typeof pedido).toBe("string");
    expect(JSON.stringify(resposta.corpo)).not.toContain(pedido);
  });

  it("codigoCategoriaConfirmado volta resolvido com similaridade 1 — em /resolver e no dePara do /lancar", () => {
    for (const arquivo of ["resolver.sucesso-codigo-confirmado.json", "lancar.sucesso-anexos-nomeados.json"]) {
      const codigo = (exemplo(arquivo).requisicao.body as CorpoDeLancar).codigoCategoriaConfirmado;
      expect(codigo, arquivo).toMatch(/^\d(\.\d{2}){2,3}$/);
      expect(categoriaDe(arquivo)[CATEGORIA_DOS_EXEMPLOS], arquivo).toMatchObject({ veredito: "resolvida", codigo, similaridade: 1 });
    }
  });

  it("anexos: string (v1) e { url, nome } (v1.1) na mesma lista; a resposta devolve o nome só de quem o mandou", () => {
    const { requisicao, resposta } = exemplo("lancar.sucesso-anexos-nomeados.json");
    const pedidos = (requisicao.body as CorpoDeLancar).anexos ?? [];
    const relatados = (resposta.corpo as { anexos: AnexoRelatado[] }).anexos;
    expect(pedidos.some((a) => typeof a === "string")).toBe(true);
    expect(pedidos.some((a) => typeof a !== "string")).toBe(true);
    expect(relatados).toHaveLength(pedidos.length);
    pedidos.forEach((pedido, i) => {
      const relatado = relatados[i];
      if (!relatado) throw new Error(`anexo ${i} sem relato na resposta`);
      if (typeof pedido === "string") {
        expect(relatado.url).toBe(pedido);
        expect(relatado).not.toHaveProperty("nome");
      } else {
        expect(relatado).toMatchObject({ url: pedido.url, nome: pedido.nome });
      }
      if (!relatado.ok) expect(typeof relatado.erro).toBe("string");
    });
  });
});

describe.skipIf(!existsSync(PASTA_DO_PRODUTOR))("contrato — cópia verbatim da pasta do produtor (financeiro-tria)", () => {
  const hash = (arquivo: string) => createHash("sha256").update(readFileSync(arquivo)).digest("hex");

  it("mesmos arquivos, mesmo conteúdo", () => {
    const doProdutor = readdirSync(PASTA_DO_PRODUTOR).sort();
    expect(readdirSync(PASTA).sort()).toEqual(doProdutor);
    for (const arquivo of doProdutor) {
      expect(hash(path.join(PASTA, arquivo)), arquivo).toBe(hash(path.join(PASTA_DO_PRODUTOR, arquivo)));
    }
  });
});
