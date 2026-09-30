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
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { CP, TEXTOS_DA_CONFERENCIA, conferenciaDoResumo } from "@n1/dominio/operations/financeiro";
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

  const RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
  const LANCAR = "/v1/integrations/contas-a-pagar/lancar";

  /**
   * Plan 06-03 (exceção a CON-05 estendida pelo orquestrador): o fluxo com
   * Conferência. Só a DAS fica nos Status que a ponte olha — as outras contas
   * de "para pagar" e "em lançamento omie" saem do jogo, senão o Momento 1
   * publicaria um Resumo em cada conta completa do seed —, em "para pagar",
   * com a Categoria dos exemplos.
   */
  function dasEmParaPagar(estado: DataState): Task {
    for (const t of estado.tasks) {
      if (t.listId === CP.listId && t.id !== "tsk_cp_das" && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
    }
    const das = estado.tasks.find((t) => t.id === "tsk_cp_das");
    if (!das) throw new Error("sem tsk_cp_das no seed");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== CP.fields.categoria);
    das.fieldValues.push({ definitionId: CP.fields.categoria, value: CATEGORIA, state: "ativo" });
    return das;
  }

  /**
   * 1º ciclo: `resolver.sucesso-resolvida` ⇒ Resumo publicado e Conferência
   * pendente. A Maryane (revisora e aprovadora) confere por clique e move a
   * conta para "em lançamento omie" — a entrada por movimento que o Momento 2
   * exige. Devolve a ponte pronta para o 2º ciclo, o do `/lancar`.
   */
  async function conferidaEmLancamento(estado: DataState, das: Task) {
    const p = ponte(estado);
    servidor.enfileirar(responder("resolver.sucesso-resolvida.json"));
    await p.lancarContasEmLancamento();
    const conferencia = conferenciaDoResumo(estado, das).conferencia;
    if (!conferencia) throw new Error("o 1º ciclo não publicou o Resumo");
    const decidida = decideProcessApproval(estado, MARYANE, conferencia.id, "aprovada", { source: "click" });
    if (!decidida.ok) throw new Error(decidida.error);
    const movida = changeTaskStatus(estado, MARYANE, das.id, S.emLancamento);
    if (!movida.ok) throw new Error(movida.error);
    expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
    return { p, conferencia };
  }

  it.each(["lancar.sucesso.json", "lancar.sucesso-reaproveitado.json"])(
    "resolver.sucesso-resolvida + %s: Resumo conferido, depois lançado — a conta vai para \"lançado omie\" com a confirmação canônica",
    async (arquivo) => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = dasEmParaPagar(estado);
      const { p, conferencia } = await conferidaEmLancamento(estado, das);
      servidor.enfileirar(responder(arquivo));

      await p.lancarContasEmLancamento();

      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
      expect(das.statusId).toBe(S.lancado);
      expect(das.comments.some((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"))).toBe(true);
      const corpo = exemplo(arquivo).resposta.corpo as { payableId: string; reaproveitado: boolean };
      const { conta, categoria, codigo } = conferencia.origin.lancamento;
      const esperado = TEXTOS_DA_CONFERENCIA.lancado({ payableId: corpo.payableId, conta, categoria, codigo, reaproveitado: corpo.reaproveitado, anexos: [] });
      expect(das.comments.filter((c) => c.author.kind === "agent" && c.content === esperado)).toHaveLength(1);
    },
  );

  it.each([
    "lancar.erro-422-omie-recusou.json",
    "lancar.erro-422-fornecedor-nao-resolvido.json",
    "lancar.erro-422-conta-corrente-nao-resolvida.json",
  ])("%s: com o Resumo conferido, o motivo do automation/ vira UM Comentário, a conta volta para \"para pagar\" (D6-03), e a ponte não chama de novo", async (arquivo) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = dasEmParaPagar(estado);
    const { p } = await conferidaEmLancamento(estado, das);
    servidor.enfileirar(responder(arquivo));

    await p.lancarContasEmLancamento(); // 2º ciclo: /lancar recusado
    await p.lancarContasEmLancamento(); // 3º ciclo: nada

    const motivo = motivoEsperado(exemplo(arquivo).resposta.corpo as unknown as EnvelopeDeErro) ?? "";
    expect(das.statusId).toBe(S.paraPagar);
    expect(das.comments.filter((c) => c.author.kind === "agent" && c.content.includes(motivo))).toHaveLength(1);
    // Exatamente: o /resolver do 1º ciclo e o /lancar do 2º. No 3º, a conta
    // está em "para pagar" com a Conferência ainda aprovada para os mesmos
    // dados — a ponte espera o humano movê-la de novo (passo 7), e a parada
    // por chave também a seguraria: nenhuma requisição nova.
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
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
  /** A forma v1.2 (06-07): sem `url`, `nome` sempre presente, `erro` como código. */
  interface AnexoRelatado {
    readonly nome: string;
    readonly ok: boolean;
    readonly jaExistia?: true;
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

  it("anexos: string (v1) e { url, nome } (v1.1) na mesma lista; a resposta v1.2 devolve o nome de todos, nunca a url, e o erro como código", () => {
    const { requisicao, resposta } = exemplo("lancar.sucesso-anexos-nomeados.json");
    const pedidos = (requisicao.body as CorpoDeLancar).anexos ?? [];
    const relatados = (resposta.corpo as { anexos: AnexoRelatado[] }).anexos;
    expect(pedidos.some((a) => typeof a === "string")).toBe(true);
    expect(pedidos.some((a) => typeof a !== "string")).toBe(true);
    expect(relatados).toHaveLength(pedidos.length);
    pedidos.forEach((pedido, i) => {
      const relatado = relatados[i];
      if (!relatado) throw new Error(`anexo ${i} sem relato na resposta`);
      expect(relatado).not.toHaveProperty("url");
      if (typeof pedido === "string") {
        expect(relatado.nome).toBe(ultimoSegmentoDaUrl(pedido));
      } else {
        expect(relatado.nome).toBe(pedido.nome);
      }
      if (!relatado.ok) expect(CODIGOS_DO_ANEXO).toContain(relatado.erro);
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

/* ── Contrato v1.2 (06-07): anexos seguros e honestos no /lancar ─────────── */

/** Os únicos valores de `anexos[].erro` (v1.2) — espelho de `CODIGOS_DO_ANEXO` do produtor. */
const CODIGOS_DO_ANEXO = [
  "ANEXO_HOST_NAO_PERMITIDO",
  "ANEXO_DOWNLOAD_FALHOU",
  "ANEXO_TEMPO_ESGOTADO",
  "ANEXO_GRANDE_DEMAIS",
  "ANEXO_OMIE_RECUSOU",
] as const;

/** O `nome` de um anexo `string` na resposta: o último segmento do caminho, sem query. */
function ultimoSegmentoDaUrl(url: string): string {
  const segmento = new URL(url).pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(segmento);
  } catch {
    return segmento;
  }
}

describe("contrato v1.2 (06-07) — anexos", () => {
  interface AnexoV12 {
    readonly nome?: unknown;
    readonly ok?: unknown;
    readonly jaExistia?: unknown;
    readonly erro?: unknown;
    readonly url?: unknown;
  }
  const sucessosDeLancar = arquivos.filter((f) => f.startsWith("lancar.sucesso"));

  it("os exemplos v1.2 estão na pasta", () => {
    for (const arquivo of [
      "lancar.sucesso-anexos-com-falhas.json",
      "lancar.sucesso-reaproveitado-com-anexos.json",
      "lancar.erro-400-schema-invalido-anexos.json",
    ]) {
      expect(arquivos, arquivo).toContain(arquivo);
    }
  });

  it.each(sucessosDeLancar.map((f) => [f] as const))("%s: nenhum anexo com url nem token, erro só como código, ok e jaExistia coerentes", (arquivo) => {
    const { requisicao, resposta } = exemplo(arquivo);
    const corpo = resposta.corpo as { reaproveitado: boolean; anexos: AnexoV12[] };
    const texto = JSON.stringify(resposta.corpo);
    expect(texto).not.toContain("assinatura=");
    expect(texto).not.toContain("token=");
    expect(Array.isArray(corpo.anexos)).toBe(true);
    const pedidos = ((requisicao.body as { anexos?: unknown[] }).anexos ?? []) as Array<string | { url: string; nome: string }>;
    expect(corpo.anexos).toHaveLength(pedidos.length);
    corpo.anexos.forEach((anexo, i) => {
      expect(anexo, `${arquivo} #${i}`).not.toHaveProperty("url");
      expect(typeof anexo.nome, `${arquivo} #${i}`).toBe("string");
      expect(anexo.ok === false, `${arquivo} #${i}: ok false ⇔ erro`).toBe(anexo.erro !== undefined);
      if (anexo.erro !== undefined) expect(CODIGOS_DO_ANEXO, `${arquivo} #${i}`).toContain(anexo.erro);
      if (anexo.jaExistia !== undefined) {
        expect(anexo.jaExistia).toBe(true);
        expect(anexo.ok, `${arquivo} #${i}: jaExistia só com ok`).toBe(true);
        expect(corpo.reaproveitado, `${arquivo} #${i}: jaExistia só no reaproveitado`).toBe(true);
      }
      const pedido = pedidos[i];
      if (typeof pedido === "string") expect(anexo.nome, `${arquivo} #${i}`).toBe(ultimoSegmentoDaUrl(pedido));
      else if (pedido) expect(anexo.nome, `${arquivo} #${i}`).toBe(pedido.nome);
    });
  });

  it("lancar.sucesso-anexos-com-falhas cobre os cinco códigos, e o título sai assim mesmo", () => {
    const corpo = exemplo("lancar.sucesso-anexos-com-falhas.json").resposta.corpo as { payableId: string; anexos: AnexoV12[] };
    expect(corpo.payableId).toMatch(/^\d+$/);
    const codigos = new Set(corpo.anexos.map((a) => a.erro).filter((e) => e !== undefined));
    expect([...codigos].sort()).toEqual([...CODIGOS_DO_ANEXO].sort());
  });

  it("lancar.sucesso-reaproveitado-com-anexos: o que já estava no título volta jaExistia, o que faltava sobe — nunca anexos: []", () => {
    const corpo = exemplo("lancar.sucesso-reaproveitado-com-anexos.json").resposta.corpo as { reaproveitado: boolean; anexos: AnexoV12[] };
    expect(corpo.reaproveitado).toBe(true);
    expect(corpo.anexos.length).toBeGreaterThan(0);
    expect(corpo.anexos.some((a) => a.jaExistia === true)).toBe(true);
    expect(corpo.anexos.every((a) => a.ok === true)).toBe(true);
  });

  it("lancar.erro-400-schema-invalido-anexos: anexo que não é URL é 400 SCHEMA_INVALIDO, permanente", () => {
    const { requisicao, resposta } = exemplo("lancar.erro-400-schema-invalido-anexos.json");
    expect(resposta.status).toBe(400);
    expect((resposta.corpo as unknown as EnvelopeDeErro).error).toMatchObject({ code: "SCHEMA_INVALIDO", retryable: false });
    const anexos = (requisicao.body as { anexos: unknown[] }).anexos;
    expect(anexos.some((a) => typeof a === "string" && !/^https?:\/\//.test(a))).toBe(true);
  });
});

/* ── Contrato v1.2 (06-08): o /lancar só aceita o que a Conferência conferiu ── */

describe("contrato v1.2 (06-08) — título e conta conferidos", () => {
  const CAMPOS_DO_TITULO = ["valor", "vencimento", "categoria", "fornecedor", "contaCorrente"] as const;
  interface DetalhesV12 {
    readonly motivo?: unknown;
    readonly payableId?: unknown;
    readonly campos?: unknown;
    readonly conferida?: unknown;
    readonly resolvida?: unknown;
  }
  const erroDe = (arquivo: string) => {
    const { resposta } = exemplo(arquivo);
    const corpo = resposta.corpo as unknown as { error: { code: string; retryable: boolean; details: DetalhesV12 } };
    return { status: resposta.status, error: corpo.error };
  };

  it("os exemplos v1.2 de 06-08 estão na pasta, e o reaproveitado v1 continua lá", () => {
    for (const arquivo of [
      "lancar.erro-422-titulo-existente-divergente.json",
      "lancar.erro-422-conta-divergente.json",
      "lancar.sucesso-conta-confirmada.json",
      "resolver.sucesso-codigo-confirmado-nao-despesa.json",
      "lancar.sucesso-reaproveitado.json",
    ]) {
      expect(arquivos, arquivo).toContain(arquivo);
    }
  });

  it("TITULO_EXISTENTE_DIVERGENTE: 422 permanente; details só com motivo, payableId e campos (nomes dos cinco, nunca valores)", () => {
    const { status, error } = erroDe("lancar.erro-422-titulo-existente-divergente.json");
    expect(status).toBe(422);
    expect(error.code).toBe("TITULO_EXISTENTE_DIVERGENTE");
    expect(error.retryable).toBe(false);
    expect(Object.keys(error.details).sort()).toEqual(["campos", "motivo", "payableId"]);
    expect(typeof error.details.payableId).toBe("string");
    expect(String(error.details.payableId)).toMatch(/^\d+$/);
    const campos = error.details.campos as string[];
    expect(Array.isArray(campos) && campos.length > 0).toBe(true);
    for (const campo of campos) expect(CAMPOS_DO_TITULO as readonly string[]).toContain(campo);
    // Nenhum valor do pedido nos details.
    const { requisicao } = exemplo("lancar.erro-422-titulo-existente-divergente.json");
    const corpo = requisicao.body as { valorCentavos: number; chavePix: string; fornecedor: { documento: string }; vencimento: string };
    const texto = JSON.stringify(error.details);
    for (const valor of [String(corpo.valorCentavos), (corpo.valorCentavos / 100).toFixed(2), corpo.chavePix, corpo.fornecedor.documento, corpo.vencimento]) {
      expect(texto, valor).not.toContain(valor);
    }
  });

  it("CONTA_DIVERGENTE: 422 permanente; details só com motivo, conferida e resolvida, e conferida ≠ resolvida", () => {
    const { status, error } = erroDe("lancar.erro-422-conta-divergente.json");
    expect(status).toBe(422);
    expect(error.code).toBe("CONTA_DIVERGENTE");
    expect(error.retryable).toBe(false);
    expect(Object.keys(error.details).sort()).toEqual(["conferida", "motivo", "resolvida"]);
    expect(typeof error.details.conferida).toBe("string");
    expect(typeof error.details.resolvida).toBe("string");
    expect(error.details.conferida).not.toBe(error.details.resolvida);
    const pedido = exemplo("lancar.erro-422-conta-divergente.json").requisicao.body as { contaConfirmada?: string };
    expect(error.details.conferida).toBe(pedido.contaConfirmada);
  });

  it("lancar.sucesso-conta-confirmada: contaConfirmada do pedido é o dePara.contaPorTag[tagDaConta] da resposta — o campo é o dePara.conta", () => {
    const { requisicao, resposta } = exemplo("lancar.sucesso-conta-confirmada.json");
    const pedido = requisicao.body as { contaConfirmada?: string; tagDaConta?: string; codigoCategoriaConfirmado?: string };
    const corpo = resposta.corpo as { dePara: { contaPorTag: Record<string, string>; categoriaPorCampo: Record<string, Record<string, unknown>> } };
    expect(resposta.status).toBe(200);
    expect(typeof pedido.contaConfirmada).toBe("string");
    expect(pedido.tagDaConta).toBeDefined();
    expect(corpo.dePara.contaPorTag[pedido.tagDaConta ?? ""]).toBe(pedido.contaConfirmada);
    expect(corpo.dePara.categoriaPorCampo[CATEGORIA_DOS_EXEMPLOS]).toMatchObject({ veredito: "resolvida", codigo: pedido.codigoCategoriaConfirmado });
  });

  it("resolver.sucesso-codigo-confirmado-nao-despesa: o código conferido de receita volta revisar, com o motivo de despesa", () => {
    const { requisicao, resposta } = exemplo("resolver.sucesso-codigo-confirmado-nao-despesa.json");
    const codigo = (requisicao.body as { codigoCategoriaConfirmado?: string }).codigoCategoriaConfirmado;
    const categoria = (resposta.corpo as { dePara: { categoriaPorCampo: Record<string, { veredito: string; codigo: string; motivo?: string }> } })
      .dePara.categoriaPorCampo[CATEGORIA_DOS_EXEMPLOS];
    expect(resposta.status).toBe(200);
    expect(categoria?.veredito).toBe("revisar");
    expect(categoria?.codigo).toBe(codigo);
    expect(categoria?.motivo).toMatch(/despesa/);
  });
});
