/**
 * 06-13 Task 1 — o ciclo da ponte diante dos timeouts que a prova de 06-06
 * mostrou (3 × `Query read timeout`, 1 × timeout de conexão, enquanto a tela
 * gravava; diagnóstico H1–H6 no `06-13-SUMMARY.md`):
 *
 *   (a) single-flight — um ciclo por vez, venha de onde vier;
 *   (b) nenhuma hidratação nem gravação aberta durante HTTP;
 *   (c)–(f) erro de banco no ciclo: código fixo, o laço para, UM ciclo de
 *       recuperação com recuo, nunca contado como falha do Omie; erro
 *       desconhecido não agenda recuperação;
 *   (g) crm:WR-11 — nenhum `registrar()` recebe texto do domínio;
 *   (h) orçamento de gravações por ciclo;
 *   (i) a medição do ciclo lento — só números;
 *   (j) `codigoDaFalhaDoCiclo`, puro.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real: servidor HTTP local e a
 * Unidade de Trabalho em memória de `fixtures-da-ponte.ts`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { importarContaAPagarHistorica } from "@n1/dominio/operations/importacao-contas-a-pagar";
import { publicarResumoParaConferencia } from "@n1/dominio/operations/financeiro";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  ATOR,
  F,
  LANCADO_200,
  LANCAR,
  MARYANE,
  RESOLVER,
  RESOLVIDA,
  S,
  buildSeed,
  comentariosDoAgente,
  conferidaEmLancamento,
  conta,
  dePara200,
  definir,
  executarEmMemoria,
  isolar,
  mover,
  ponteSobre,
  responder,
  resumosDe,
} from "../testes/fixtures-da-ponte";
import {
  ATRASO_MAXIMO_DE_RECUPERACAO_MS,
  MAXIMO_DE_GRAVACOES_POR_CICLO,
  TENTATIVAS_TRANSITORIAS,
  codigoDaFalhaDoCiclo,
  textoDasTransitorias,
  type OpcoesDaPonte,
} from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera até `condicao()` valer (ou o prazo acabar) — os ciclos de recuperação e de continuação rodam sozinhos. */
async function ate(condicao: () => boolean, prazoMs = 2_000): Promise<void> {
  const fim = Date.now() + prazoMs;
  while (!condicao() && Date.now() < fim) await esperar(10);
}

function erroDoBanco(code: string, mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code });
}

const MENSAGEM_DA_FALHA_DE_BANCO = "Falha de banco no ciclo do Agente de lançamento.";

/** `das` e `trafego` completas em "para pagar" — o caso G2 sem o escopo. */
function duasCompletas(estado: DataState): { readonly das: Task; readonly trafego: Task } {
  const das = isolar(estado, "tsk_cp_das");
  const trafego = conta(estado, "tsk_cp_trafego");
  trafego.statusId = S.paraPagar;
  definir(trafego, F.categoria, "Impostos");
  return { das, trafego };
}

/** Uma conta importada do ClickUp em "para pagar" (G1) — cópia de `importarNoStatus` de `invocar-agente.test.ts`. */
function importarEmParaPagar(estado: DataState): Task {
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId: "868legado9",
    titulo: "Conta importada do ClickUp",
    statusFinalId: S.paraPagar,
    criadaEm: "2026-08-01T12:00:00.000Z",
    vencimento: { form: "civilDay", value: "2026-10-10" },
    transicoes: [{ em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" }],
    campos: {
      [F.centroDeCusto]: "TRIA",
      [F.categoria]: "Impostos",
      [F.valor]: 10,
      [F.forma]: "Chave Pix",
      [F.chavePix]: "financeiro@exemplo.com.br",
      [F.fornecedor]: "CNPJ",
      [F.cnpj]: "11.222.333/0001-81",
      [F.nomeFornecedor]: "Receita Federal do Brasil",
    },
    tags: ["tag_cp_1"],
    lacunas: [],
  });
  if (!r.ok) throw new Error(r.error);
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

let servidor: ServidorFalso;
const pontes: Array<{ parar(): Promise<void> }> = [];

afterEach(async () => {
  for (const p of pontes.splice(0)) await p.parar();
  await servidor?.fechar();
});

function montar(estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
  const registros: Registro[] = [];
  const ponte = ponteSobre(servidor, estado, {
    registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    ...extra,
  });
  pontes.push(ponte);
  return { ponte, registros };
}

const falhasDeBanco = (registros: readonly Registro[]) => registros.filter((r) => r.mensagem === MENSAGEM_DA_FALHA_DE_BANCO);

describe("(j) codigoDaFalhaDoCiclo — puro", () => {
  it.each([
    [new Error("Query read timeout"), "TEMPO_DE_CONSULTA_ESGOTADO", true],
    [new Error("Connection terminated due to connection timeout"), "TEMPO_DE_CONEXAO_ESGOTADO", true],
    [new Error("timeout exceeded when trying to connect"), "TEMPO_DE_CONEXAO_ESGOTADO", true],
    [new Error("Connection terminated unexpectedly"), "CONEXAO_CAIU", true],
    [erroDoBanco("55P03", "canceling statement due to lock timeout"), "TRAVA_ESGOTADA", true],
    [erroDoBanco("57014", "canceling statement due to statement timeout"), "CONSULTA_CANCELADA_PELO_BANCO", true],
    [erroDoBanco("23505", "duplicate key value violates unique constraint"), "ERRO_DE_BANCO", true],
    [new Error("Fornecedor Sigiloso Ltda — R$ 662,67"), "ERRO_NO_CICLO", false],
    ["texto solto", "ERRO_NO_CICLO", false],
    [undefined, "ERRO_NO_CICLO", false],
  ] as const)("%s ⇒ %s", (erro, code, deBanco) => {
    const r = codigoDaFalhaDoCiclo(erro);
    expect(r.code).toBe(code);
    expect(r.deBanco).toBe(deBanco);
  });

  it("o SQLSTATE vai junto só em ERRO_DE_BANCO; nada da mensagem sai", () => {
    expect(codigoDaFalhaDoCiclo(erroDoBanco("23505", "Key (id)=(Fornecedor Sigiloso) already exists"))).toEqual({ code: "ERRO_DE_BANCO", deBanco: true, sqlstate: "23505" });
    expect(codigoDaFalhaDoCiclo(erroDoBanco("55P03", "x"))).toEqual({ code: "TRAVA_ESGOTADA", deBanco: true });
    // "connection timeout" é perguntado ANTES do genérico "Connection terminated".
    expect(codigoDaFalhaDoCiclo(new Error("Connection terminated due to connection timeout")).code).toBe("TEMPO_DE_CONEXAO_ESGOTADO");
  });

  it("os padrões exportados", () => {
    expect(ATRASO_MAXIMO_DE_RECUPERACAO_MS).toBe(60_000);
    expect(MAXIMO_DE_GRAVACOES_POR_CICLO).toBe(20);
  });
});

describe("(a) single-flight", () => {
  it("processarContas() com um ciclo em voo devolve ESSE ciclo; o alias continua o mesmo", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    let hidratacoes = 0;
    const { ponte } = montar(estado, {
      modo: "ensaio",
      soTitulosCom: "nenhuma conta tem este título",
      hidratarEstado: async () => {
        hidratacoes += 1;
        await esperar(50);
        return estado;
      },
    });
    const p1 = ponte.processarContas();
    const p2 = ponte.processarContas();
    expect(p2).toBe(p1);
    await p1;
    expect(hidratacoes).toBe(1);
    expect(ponte.lancarContasEmLancamento).toBe(ponte.processarContas);
  });

  it("relógio, cutucada e chamada direta juntos: nunca duas hidratações ao mesmo tempo", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    let emCurso = 0;
    let maximo = 0;
    let hidratacoes = 0;
    const { ponte } = montar(estado, {
      modo: "ensaio",
      soTitulosCom: "nenhuma conta tem este título",
      intervaloMs: 60_000,
      atrasoDaCutucadaMs: 10,
      hidratarEstado: async () => {
        hidratacoes += 1;
        emCurso += 1;
        maximo = Math.max(maximo, emCurso);
        await esperar(200);
        emCurso -= 1;
        return estado;
      },
    });
    ponte.iniciar();
    ponte.cutucar();
    const direta = ponte.processarContas();
    ponte.cutucar();
    await direta;
    await esperar(500);
    await ponte.parar();
    expect(maximo).toBe(1);
    // O ciclo do relógio (que a chamada direta reaproveitou) e UM a mais pela cutucada em voo.
    expect(hidratacoes).toBe(2);
  });
});

describe("(b) nada do banco em voo durante HTTP", () => {
  it("Momento 1 e Momento 2 (lancar): nenhum intervalo de banco cruza um intervalo de requisição", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const intervalosDeBanco: Array<[number, number]> = [];
    const intervalosDeRede: Array<[number, number]> = [];
    const noMemoria = executarEmMemoria(estado);
    const { ponte } = montar(estado, {
      fetchImpl: async (...args: Parameters<typeof fetch>) => {
        const inicio = performance.now();
        try {
          return await fetch(...args);
        } finally {
          intervalosDeRede.push([inicio, performance.now()]);
        }
      },
      hidratarEstado: async () => {
        const inicio = performance.now();
        await esperar(50);
        intervalosDeBanco.push([inicio, performance.now()]);
        return structuredClone(estado);
      },
      executarOperacao: async (operacao) => {
        const inicio = performance.now();
        await esperar(50);
        const r = await noMemoria(operacao);
        intervalosDeBanco.push([inicio, performance.now()]);
        return r;
      },
    });

    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas(); // Momento 1: /resolver + Resumo
    responder(estado, das, MARYANE, "ok");
    await ponte.processarContas(); // o fio vira decisão
    mover(estado, das.id, S.emLancamento);
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas(); // Momento 2: releitura, /lancar, registro

    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, LANCAR]);
    expect(das.statusId).toBe(S.lancado);
    expect(intervalosDeRede).toHaveLength(2);
    expect(intervalosDeBanco.length).toBeGreaterThanOrEqual(6);
    for (const [ri, rf] of intervalosDeRede) {
      for (const [bi, bf] of intervalosDeBanco) expect(bf <= ri || bi >= rf).toBe(true);
    }
  });
});

describe("(c)–(f) erro de banco no ciclo", () => {
  it("(c) Query read timeout na publicação do Resumo: o ciclo para ali, código fixo, nenhum Comentário; a recuperação publica os dois", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const { das, trafego } = duasCompletas(estado);
    let gravacoes = 0;
    const noMemoria = executarEmMemoria(estado);
    const { ponte, registros } = montar(estado, {
      modo: "conferencia",
      atrasoDeRecuperacaoMs: 50,
      intervaloMs: 60_000,
      executarOperacao: async (operacao) => {
        gravacoes += 1;
        if (gravacoes === 1) throw new Error("Query read timeout");
        return noMemoria(operacao);
      },
    });
    for (let i = 0; i < 3; i += 1) servidor.enfileirar(RESOLVIDA);

    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(1); // a segunda conta não foi processada neste ciclo
    expect(comentariosDoAgente(das)).toHaveLength(0);
    expect(comentariosDoAgente(trafego)).toHaveLength(0);
    const falhas = falhasDeBanco(registros);
    expect(falhas).toHaveLength(1);
    expect(falhas[0]?.nivel).toBe("warn");
    expect(falhas[0]?.dados?.code).toBe("TEMPO_DE_CONSULTA_ESGOTADO");
    expect(falhas[0]?.dados).not.toHaveProperty("summary");
    expect(falhas[0]?.dados?.recuperacaoEmMs).toBe(50);

    // Sem cutucada e sem relógio: o ciclo de recuperação roda sozinho.
    await ate(() => resumosDe(das).length === 1 && resumosDe(trafego).length === 1);
    expect(resumosDe(das)).toHaveLength(1);
    expect(resumosDe(trafego)).toHaveLength(1);
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER, RESOLVER]);
  });

  it("(c) falhas de banco seguidas NÃO são falhas do Omie: três seguidas não viram o aviso de transitórias, e a quarta publica", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    let gravacoes = 0;
    const noMemoria = executarEmMemoria(estado);
    const { ponte, registros } = montar(estado, {
      modo: "conferencia",
      atrasoDeRecuperacaoMs: 60_000, // os ciclos aqui são os diretos
      executarOperacao: async (operacao) => {
        gravacoes += 1;
        if (gravacoes <= TENTATIVAS_TRANSITORIAS) throw new Error("Query read timeout");
        return noMemoria(operacao);
      },
    });
    for (let i = 0; i <= TENTATIVAS_TRANSITORIAS; i += 1) servidor.enfileirar(RESOLVIDA);
    for (let i = 0; i <= TENTATIVAS_TRANSITORIAS; i += 1) await ponte.processarContas();
    expect(falhasDeBanco(registros)).toHaveLength(TENTATIVAS_TRANSITORIAS);
    expect(comentariosDoAgente(das).map((c) => c.content)).not.toContain(textoDasTransitorias("TEMPO_DE_CONSULTA_ESGOTADO"));
    expect(resumosDe(das)).toHaveLength(1);
  });

  it("(c) o recuo: 50 → 100 → teto; um ciclo bom zera; parar() cancela a recuperação agendada", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    let falhar = true;
    let hidratacoes = 0;
    const { ponte, registros } = montar(estado, {
      modo: "ensaio",
      soTitulosCom: "nenhuma conta tem este título",
      intervaloMs: 60_000,
      atrasoDeRecuperacaoMs: 50,
      atrasoMaximoDeRecuperacaoMs: 150,
      hidratarEstado: async () => {
        hidratacoes += 1;
        if (falhar) throw new Error("Query read timeout");
        return estado;
      },
    });
    await ponte.processarContas();
    await ate(() => falhasDeBanco(registros).length >= 4);
    expect(falhasDeBanco(registros).slice(0, 4).map((r) => r.dados?.recuperacaoEmMs)).toEqual([50, 100, 150, 150]);

    falhar = false;
    const antes = hidratacoes;
    await ate(() => hidratacoes > antes, 1_000); // a recuperação agendada roda e é um ciclo bom
    await esperar(20);
    falhar = true;
    const falhasAntes = falhasDeBanco(registros).length;
    await ponte.processarContas();
    expect(falhasDeBanco(registros).at(-1)?.dados?.recuperacaoEmMs).toBe(50); // zerado pelo ciclo bom
    expect(falhasDeBanco(registros)).toHaveLength(falhasAntes + 1);

    const agora = hidratacoes;
    await ponte.parar();
    await esperar(200);
    expect(hidratacoes).toBe(agora);
  });

  it("(d) Query read timeout no REGISTRO depois de um /lancar 200: a recuperação repete o /lancar com a mesma chave e registra uma vez", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    let gravacoes = 0;
    const noMemoria = executarEmMemoria(estado);
    const { ponte, registros } = montar(estado, {
      atrasoDeRecuperacaoMs: 30,
      intervaloMs: 60_000,
      executarOperacao: async (operacao) => {
        gravacoes += 1;
        if (gravacoes === 1) throw new Error("Query read timeout");
        return noMemoria(operacao);
      },
    });
    servidor.enfileirar(LANCADO_200);
    servidor.enfileirar({ ...LANCADO_200, corpo: { ...LANCADO_200.corpo, reaproveitado: true, dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara } });

    await ponte.processarContas();
    expect(das.statusId).toBe(S.emLancamento);
    expect(falhasDeBanco(registros)[0]?.dados?.code).toBe("TEMPO_DE_CONSULTA_ESGOTADO");

    await ate(() => das.statusId === S.lancado);
    const lancamentos = servidor.recebidas.filter((r) => r.caminho === LANCAR);
    expect(lancamentos).toHaveLength(2);
    expect(lancamentos[0]?.cabecalhos["idempotency-key"]).toBe(lancamentos[1]?.cabecalhos["idempotency-key"]);
    expect(das.statusId).toBe(S.lancado);
    expect(comentariosDoAgente(das).filter((c) => c.content.startsWith("✅ Lançado no Omie"))).toHaveLength(1);
  });

  it.each([
    [new Error("Connection terminated due to connection timeout"), "TEMPO_DE_CONEXAO_ESGOTADO", undefined],
    [erroDoBanco("55P03", "canceling statement due to lock timeout"), "TRAVA_ESGOTADA", undefined],
    [erroDoBanco("57014", "canceling statement due to statement timeout"), "CONSULTA_CANCELADA_PELO_BANCO", undefined],
    [erroDoBanco("23505", "duplicate key value"), "ERRO_DE_BANCO", "23505"],
  ] as const)("(e) hidratarEstado lança %s ⇒ %s, e a recuperação roda", async (erro, code, sqlstate) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    let hidratacoes = 0;
    const { ponte, registros } = montar(estado, {
      modo: "ensaio",
      soTitulosCom: "nenhuma conta tem este título",
      intervaloMs: 60_000,
      atrasoDeRecuperacaoMs: 30,
      hidratarEstado: async () => {
        hidratacoes += 1;
        if (hidratacoes === 1) throw erro;
        return estado;
      },
    });
    await expect(ponte.processarContas()).resolves.toBeUndefined();
    const [falha] = falhasDeBanco(registros);
    expect(falha?.dados?.code).toBe(code);
    if (sqlstate) expect(falha?.dados?.sqlstate).toBe(sqlstate);
    else expect(falha?.dados).not.toHaveProperty("sqlstate");
    expect(JSON.stringify(registros)).not.toContain(erro.message);
    await ate(() => hidratacoes >= 2, 1_000);
    expect(hidratacoes).toBe(2);
  });

  it("(f) erro desconhecido: ERRO_NO_CICLO, nada do texto chega a registrar(), e NENHUMA recuperação", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    let hidratacoes = 0;
    const { ponte, registros } = montar(estado, {
      modo: "ensaio",
      intervaloMs: 60_000,
      atrasoDeRecuperacaoMs: 30,
      hidratarEstado: async () => {
        hidratacoes += 1;
        throw new Error("Fornecedor Sigiloso Ltda — R$ 662,67");
      },
    });
    // Chamada direta: a exceção sobe como antes (quem chama decide).
    await expect(ponte.processarContas()).rejects.toThrow("Fornecedor Sigiloso");
    // Pelo relógio: o `catch` do ciclo registra só o código.
    ponte.iniciar();
    await ate(() => registros.some((r) => r.dados?.code === "ERRO_NO_CICLO"), 1_000);
    await esperar(150);
    expect(hidratacoes).toBe(2);
    const doCiclo = registros.filter((r) => r.dados?.code === "ERRO_NO_CICLO");
    expect(doCiclo).toHaveLength(1);
    expect(doCiclo[0]?.dados).not.toHaveProperty("summary");
    expect(falhasDeBanco(registros)).toHaveLength(0);
    const tudo = JSON.stringify(registros);
    expect(tudo).not.toContain("Sigiloso");
    expect(tudo).not.toContain("662");
  });
});

describe("(g) crm:WR-11 — recusa do domínio vira código fixo no log", () => {
  const RECUSA = "já foi aprovada por Maryane Sigilosa";

  function recusando(estado: DataState) {
    const noMemoria = executarEmMemoria(estado);
    const controle = { recusar: false };
    const executarOperacao: NonNullable<OpcoesDaPonte["executarOperacao"]> = async (operacao) =>
      controle.recusar ? { ok: false, error: RECUSA } : noMemoria(operacao);
    return { controle, executarOperacao };
  }

  it("leitura do fio, dispensa, publicação do Resumo e registro do lançamento: só códigos, nunca o texto", async () => {
    servidor = await criarServidorFalso();
    const todos: Registro[] = [];

    // 1. A leitura do fio: "ok" da Maryane, e o domínio recusa a decisão.
    {
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
      if (!p.ok) throw new Error(p.error);
      responder(estado, das, MARYANE, "ok");
      const { controle, executarOperacao } = recusando(estado);
      controle.recusar = true;
      const { ponte, registros } = montar(estado, { modo: "conferencia", executarOperacao });
      await ponte.processarContas();
      expect(registros.map((r) => r.dados?.code)).toContain("RESPOSTA_RECUSADA_PELO_DOMINIO");
      todos.push(...registros);
    }

    // 2. A dispensa (D6-04 sem-conferencia) de uma conta Manual com Resumo pendente.
    {
      const estado = buildSeed();
      const das = isolar(estado, "tsk_cp_das");
      definir(das, F.integracaoManual, "Manual");
      const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
      if (!p.ok) throw new Error(p.error);
      const { controle, executarOperacao } = recusando(estado);
      controle.recusar = true;
      const { ponte, registros } = montar(estado, { modo: "conferencia", decisoes: { integracaoManual: "sem-conferencia" }, executarOperacao });
      await ponte.processarContas();
      expect(registros.map((r) => r.dados?.code)).toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
      todos.push(...registros);
    }

    // 3. A publicação do Resumo.
    {
      const estado = buildSeed();
      isolar(estado, "tsk_cp_das");
      const { controle, executarOperacao } = recusando(estado);
      controle.recusar = true;
      servidor.enfileirar(RESOLVIDA);
      const { ponte, registros } = montar(estado, { modo: "conferencia", executarOperacao });
      await ponte.processarContas();
      expect(registros.map((r) => r.dados?.code)).toContain("RESUMO_RECUSADO_PELO_DOMINIO");
      todos.push(...registros);
    }

    // 4. O registro do lançamento depois de um /lancar 200.
    {
      const estado = buildSeed();
      conferidaEmLancamento(estado);
      const { controle, executarOperacao } = recusando(estado);
      controle.recusar = true;
      servidor.enfileirar(LANCADO_200);
      const { ponte, registros } = montar(estado, { executarOperacao });
      await ponte.processarContas();
      expect(registros.map((r) => r.dados?.code)).toContain("REGISTRO_RECUSADO_PELO_DOMINIO");
      todos.push(...registros);
    }

    expect(JSON.stringify(todos)).not.toContain("Sigilosa");
  });
});

describe("(h) orçamento de gravações por ciclo", () => {
  it("maximoDeGravacoesPorCiclo: 1 — um Resumo por ciclo, o resto no ciclo de continuação; a contagem G1 só no ciclo que terminou o laço", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const { das, trafego } = duasCompletas(estado);
    importarEmParaPagar(estado);
    const { ponte, registros } = montar(estado, { modo: "conferencia", maximoDeGravacoesPorCiclo: 1, intervaloMs: 60_000, atrasoDaCutucadaMs: 10 });
    servidor.enfileirar(RESOLVIDA);
    servidor.enfileirar(RESOLVIDA);

    await ponte.processarContas();
    expect(resumosDe(das).length + resumosDe(trafego).length).toBe(1);
    const contagem = () => registros.filter((r) => r.mensagem.startsWith("Contas importadas sem movimento"));
    expect(contagem()).toHaveLength(0);

    await ate(() => resumosDe(das).length === 1 && resumosDe(trafego).length === 1 && contagem().length === 1);
    expect(resumosDe(das)).toHaveLength(1);
    expect(resumosDe(trafego)).toHaveLength(1);
    expect(contagem()).toHaveLength(1);
    expect(contagem()[0]?.dados?.contas).toBe(1);
    // Nenhum ciclo interrompido pelo orçamento registrou a contagem: ela vem depois do último corte.
    const cortes = registros.map((r, i) => (r.dados?.code === "ORCAMENTO_DO_CICLO_ESGOTADO" ? i : -1)).filter((i) => i >= 0);
    expect(cortes.length).toBeGreaterThanOrEqual(1);
    expect(registros.indexOf(contagem()[0]!)).toBeGreaterThan(cortes.at(-1)!);
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER]);
  });
});

describe("(i) a medição do ciclo lento — só números", () => {
  it("ciclo acima do limiar: \"Ciclo da ponte demorou.\" com ms, hidratacoes, gravacoes, conflitos, requisicoes", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const { ponte, registros } = montar(estado, {
      modo: "ensaio",
      soTitulosCom: "nenhuma conta tem este título",
      limiarDoCicloLentoMs: 20,
      hidratarEstado: async () => {
        await esperar(30);
        return estado;
      },
    });
    await ponte.processarContas();
    const lentos = registros.filter((r) => r.mensagem === "Ciclo da ponte demorou.");
    expect(lentos).toHaveLength(1);
    expect(lentos[0]?.nivel).toBe("info");
    const dados = lentos[0]!.dados!;
    expect(Object.keys(dados).sort()).toEqual(["conflitos", "gravacoes", "hidratacoes", "listId", "ms", "requisicoes", "workspaceId"]);
    for (const [chave, valor] of Object.entries(dados)) {
      if (chave !== "workspaceId" && chave !== "listId") expect(typeof valor).toBe("number");
    }
    expect(dados.hidratacoes).toBe(1);
    expect(dados.ms).toBeGreaterThanOrEqual(20);
  });

  it("abaixo do limiar (padrão 5 s): nada", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const { ponte, registros } = montar(estado, { modo: "ensaio", soTitulosCom: "nenhuma conta tem este título" });
    await ponte.processarContas();
    expect(registros.filter((r) => r.mensagem === "Ciclo da ponte demorou.")).toHaveLength(0);
  });
});
