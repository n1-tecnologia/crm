/**
 * crm:CR-01 (06-12 Task 1) — a ponte só chama o `/lancar` sobre o que está no
 * banco um instante antes. Entre a hidratação do ciclo e o `/lancar` cabem
 * vários `/resolver` (10 s) e `/lancar` (60 s); por isso, imediatamente antes
 * de cada `/lancar`, a ponte relê o Espaço (`hidratarEstado`, segunda leitura)
 * e pergunta de novo, sobre o estado de AGORA, tudo o que o laço perguntou
 * (`motivoParaNaoLancar`). O corpo sai do estado relido.
 *
 * O snapshot e o estado relido são objetos DIFERENTES: `hidratarEstado`
 * devolve `structuredClone(estado)` na primeira chamada e, na segunda, aplica
 * a mudança em `estado` e devolve `estado` — é sobre ele que a Unidade de
 * Trabalho em memória grava.
 *
 * Arquivo novo (CON-05): regra nova, arquivo novo. Sem banco e sem rede real.
 */

import { afterEach, describe, expect, it } from "vitest";
import { publicarResumoParaConferencia, textoDoLancamentoHumano } from "@n1/dominio/operations/financeiro";
import { addTaskComment, trashTask } from "@n1/dominio/operations/tasks";
import type { DataState } from "@n1/dominio";
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
  arquivo,
  buildSeed,
  comentariosDoAgente,
  conferidaEmLancamento,
  conta,
  dePara200,
  definir,
  executarEmMemoria,
  mover,
  ponteSobre,
  resumosDe,
  vigente,
} from "../testes/fixtures-da-ponte";
import { TENTATIVAS_TRANSITORIAS, TEXTO_SAIU_ANTES_DO_REGISTRO, motivoParaNaoLancar, textoDasTransitorias } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

/** Primeira leitura do ciclo: uma cópia; segunda: a mudança aplicada em `estado`, e o próprio `estado`. Depois, sempre `estado`. */
function releitura(estado: DataState, mudar?: (e: DataState) => void) {
  let leituras = 0;
  return {
    hidratarEstado: async () => {
      leituras += 1;
      if (leituras === 1) return structuredClone(estado);
      if (leituras === 2) mudar?.(estado);
      return estado;
    },
    leituras: () => leituras,
  };
}

const codigos = (registros: readonly Registro[]) => registros.map((r) => r.dados?.code).filter((c): c is string | number => c !== undefined);

describe("motivoParaNaoLancar (l) — puro, um caso por código", () => {
  const criterio = { listId: "lst_contas_a_pagar", integracaoManual: "nao-encosta" as const };

  function pronta() {
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    return { estado, das, conferidaId: vigente(estado, das).id };
  }

  it("caminho feliz: undefined", () => {
    const { estado, das, conferidaId } = pronta();
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBeUndefined();
  });

  it("CONTA_SUMIU — nenhuma conta com o id na Lista", () => {
    const { estado, conferidaId } = pronta();
    expect(motivoParaNaoLancar(estado, "tsk_nao_existe", conferidaId, criterio)).toBe("CONTA_SUMIU");
    const { estado: outro, das, conferidaId: c2 } = pronta();
    expect(motivoParaNaoLancar(outro, das.id, c2, { ...criterio, listId: "lst_outra" })).toBe("CONTA_SUMIU");
  });

  it("INATIVA — na lixeira", () => {
    const { estado, das, conferidaId } = pronta();
    const r = trashTask(estado, MARYANE, das.id);
    if (!r.ok) throw new Error(r.error);
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("INATIVA");
  });

  it("SAIU_DE_EM_LANCAMENTO", () => {
    const { estado, das, conferidaId } = pronta();
    mover(estado, das.id, S.paraPagar);
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("SAIU_DE_EM_LANCAMENTO");
  });

  it("NAO_ENTROU_POR_MOVIMENTO — posta no Status sem Registro", () => {
    const { estado, das, conferidaId } = pronta();
    mover(estado, das.id, S.paraPagar);
    das.statusId = S.emLancamento;
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("NAO_ENTROU_POR_MOVIMENTO");
  });

  it("FORA_DO_ESCOPO — o título não tem o texto de soTitulosCom", () => {
    const { estado, das, conferidaId } = pronta();
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, { ...criterio, soTitulosCom: "TESTE AUTOMATIZADO" })).toBe("FORA_DO_ESCOPO");
  });

  it("MANUAL — só sob nao-encosta; em sem-conferencia a conta Manual é lançada (D6-04)", () => {
    const { estado, das, conferidaId } = pronta();
    definir(das, F.integracaoManual, "Manual");
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("MANUAL");
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, { ...criterio, integracaoManual: "sem-conferencia" })).toBeUndefined();
  });

  it("LANCAMENTO_HUMANO — um Membro registrou o lançamento à mão", () => {
    const { estado, das, conferidaId } = pronta();
    const r = addTaskComment(estado, MARYANE, das.id, { content: textoDoLancamentoHumano({ conta: "TRIA COMPANY - ITAU", categoria: "Impostos e taxas", codigo: "2.06.01" }) });
    if (!r.ok) throw new Error(r.error);
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("LANCAMENTO_HUMANO");
  });

  it("SEM_CONFERENCIA_APROVADA — o Valor mudou depois da conferência", () => {
    const { estado, das, conferidaId } = pronta();
    definir(das, F.valor, "700");
    expect(motivoParaNaoLancar(estado, das.id, conferidaId, criterio)).toBe("SEM_CONFERENCIA_APROVADA");
  });

  it("CONFERENCIA_TROCADA — a vigente conferida não é a que o ciclo leu", () => {
    const { estado, das } = pronta();
    expect(motivoParaNaoLancar(estado, das.id, "apr_outra", criterio)).toBe("CONFERENCIA_TROCADA");
  });
});

describe("a releitura antes do /lancar (CR-01) — servidorFalso, sem DATABASE_URL", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  const lancamentos = () => servidor.recebidas.filter((r) => r.caminho === LANCAR);

  async function cenario(mudar: (e: DataState) => void, extra: Parameters<typeof ponteSobre>[2] = {}, preparar?: (e: DataState) => void) {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    preparar?.(estado);
    const das = conferidaEmLancamento(estado);
    const leitura = releitura(estado, mudar);
    const registros: Registro[] = [];
    const ponte = ponteSobre(servidor, estado, {
      hidratarEstado: leitura.hidratarEstado,
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      ...extra,
    });
    return { estado, das, ponte, registros, leituras: leitura.leituras, doAgente: comentariosDoAgente(das).length };
  }

  it("(a) saiu para \"para pagar\" entre as duas leituras: ZERO /lancar, nenhum Comentário, SAIU_DE_EM_LANCAMENTO; o ciclo seguinte espera o humano", async () => {
    const { estado, das, ponte, registros, leituras, doAgente } = await cenario((e) => mover(e, "tsk_cp_das", S.paraPagar));
    await ponte.processarContas();
    expect(leituras()).toBe(2);
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das)).toHaveLength(doAgente);
    expect(registros.some((r) => r.nivel === "info" && r.dados?.code === "SAIU_DE_EM_LANCAMENTO")).toBe(true);

    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das)).toHaveLength(doAgente);
    expect(conta(estado, das.id).statusId).toBe(S.paraPagar);
  });

  it("(b) o Valor mudou (desatualizada no relido): ZERO /lancar, SEM_CONFERENCIA_APROVADA; o ciclo seguinte faz o Momento 1", async () => {
    const { das, ponte, registros } = await cenario((e) => definir(conta(e, "tsk_cp_das"), F.valor, "700"));
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("SEM_CONFERENCIA_APROVADA");

    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
    expect(resumosDe(das).at(-1)?.content).toContain("Os dados da conta mudaram depois da conferência.");
    expect(lancamentos()).toHaveLength(0);
  });

  it("(c) virou Manual no relido, com nao-encosta: ZERO /lancar, MANUAL", async () => {
    const { ponte, registros } = await cenario((e) => definir(conta(e, "tsk_cp_das"), F.integracaoManual, "Manual"));
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("MANUAL");
  });

  it("(c) controle — Manual desde o começo com sem-conferencia: o /lancar sai como hoje", async () => {
    const { das, ponte } = await cenario(() => undefined, { decisoes: { integracaoManual: "sem-conferencia" } }, (e) => definir(conta(e, "tsk_cp_das"), F.integracaoManual, "Manual"));
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(1);
    expect(das.statusId).toBe(S.lancado);
  });

  it("(d) lançamento humano registrado no relido: ZERO /lancar, LANCAMENTO_HUMANO", async () => {
    const { ponte, registros } = await cenario((e) => {
      const r = addTaskComment(e, MARYANE, "tsk_cp_das", { content: textoDoLancamentoHumano({ conta: "TRIA COMPANY - ITAU", categoria: "Impostos e taxas", codigo: "2.06.01" }) });
      if (!r.ok) throw new Error(r.error);
    });
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("LANCAMENTO_HUMANO");
  });

  it("(d) lançamento humano no snapshot — a parada é pelo snapshot, sem releitura", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const r = addTaskComment(estado, MARYANE, das.id, { content: textoDoLancamentoHumano({ conta: "TRIA COMPANY - ITAU", categoria: "Impostos e taxas", codigo: "2.06.01" }) });
    if (!r.ok) throw new Error(r.error);
    const leitura = releitura(estado);
    const registros: Registro[] = [];
    const ponte = ponteSobre(servidor, estado, {
      hidratarEstado: leitura.hidratarEstado,
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    });
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(leitura.leituras()).toBe(1);
    expect(codigos(registros)).toContain("LANCAMENTO_HUMANO");
  });

  it("(e) a vigente do relido é outra (Resumo revisado pendente): ZERO /lancar, SEM_CONFERENCIA_APROVADA", async () => {
    const { ponte, registros } = await cenario((e) => {
      const p = publicarResumoParaConferencia(e, ATOR, "tsk_cp_das", { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara, pedidoDeRevisao: "é comercial" });
      if (!p.ok) throw new Error(p.error);
    });
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("SEM_CONFERENCIA_APROVADA");
  });

  it("(f) foi para a lixeira no relido: ZERO /lancar, INATIVA", async () => {
    const { ponte, registros } = await cenario((e) => {
      const r = trashTask(e, MARYANE, "tsk_cp_das");
      if (!r.ok) throw new Error(r.error);
    });
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("INATIVA");
  });

  it("(f) o título saiu do escopo de soTitulosCom no relido: ZERO /lancar, FORA_DO_ESCOPO", async () => {
    const { ponte, registros } = await cenario(
      (e) => {
        conta(e, "tsk_cp_das").title = "DAS";
      },
      { soTitulosCom: "TESTE AUTOMATIZADO" },
      (e) => {
        conta(e, "tsk_cp_das").title = "DAS — TESTE AUTOMATIZADO";
      },
    );
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("FORA_DO_ESCOPO");
  });

  it("(g) o corpo vem do relido: um arquivo novo no Campo Anexo entre as leituras vai em corpo.anexos", async () => {
    const { ponte } = await cenario((e) => {
      arquivo(e, "fil_novo", "NF nova.pdf");
      conta(e, "tsk_cp_das").fieldValues.push({ definitionId: F.anexo, value: ["fil_novo"], state: "ativo" });
    });
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(1);
    const corpo = lancamentos()[0]?.corpo as { anexos?: Array<{ nome: string }> };
    expect(corpo.anexos?.map((a) => a.nome)).toContain("NF nova.pdf");
  });

  it("(h) a releitura falha: ZERO /lancar, o ciclo resolve, RELEITURA_FALHOU sem a mensagem; na terceira seguida, o aviso de sempre", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    let leituras = 0;
    const registros: Registro[] = [];
    const ponte = ponteSobre(servidor, estado, {
      hidratarEstado: async () => {
        leituras += 1;
        if (leituras % 2 === 0) throw new Error("conexão caiu: senha=segredo-do-banco");
        return structuredClone(estado);
      },
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    });
    const antes = comentariosDoAgente(das).length;

    await expect(ponte.processarContas()).resolves.toBeUndefined();
    expect(servidor.recebidas).toHaveLength(0);
    expect(registros.some((r) => r.nivel === "warn" && r.dados?.code === "RELEITURA_FALHOU")).toBe(true);
    expect(JSON.stringify(registros)).not.toContain("senha=");
    expect(JSON.stringify(registros)).not.toContain("conexão caiu");
    expect(comentariosDoAgente(das)).toHaveLength(antes);

    for (let n = 1; n < TENTATIVAS_TRANSITORIAS; n += 1) await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das).slice(antes).map((c) => c.content)).toEqual([textoDasTransitorias("RELEITURA_FALHOU")]);
  });

  it("(i) o Valor muda DURANTE o /lancar: o título existe, o registro é recusado ⇒ um aviso com o id do título; um /lancar só", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    servidor.enfileirar({ kind: "atraso", ms: 300, status: 200, corpo: LANCADO_200.corpo });
    const ponte = ponteSobre(servidor, estado);
    const emVoo = ponte.processarContas();
    for (let espera = 0; servidor.recebidas.length < 1 && espera < 100; espera += 1) await new Promise((r) => setTimeout(r, 10));
    expect(lancamentos()).toHaveLength(1);
    definir(das, F.valor, "700");
    await emVoo;

    const avisos = comentariosDoAgente(das).filter((c) => c.content.includes("pay_das_1"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.content.endsWith("Confira e mova à mão.")).toBe(true);
    expect(das.statusId).toBe(S.emLancamento);

    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(1);
  }, 10_000);

  it("(j) conflito de revisão três ciclos seguidos no registro depois do título: o aviso cita o título e o código", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) servidor.enfileirar(LANCADO_200);
    let gravacoes = 0;
    const emMemoria = executarEmMemoria(estado);
    const ponte = ponteSobre(servidor, estado, {
      executarOperacao: async (op) => {
        gravacoes += 1;
        if (gravacoes % 2 === 0 && gravacoes <= 2 * TENTATIVAS_TRANSITORIAS) return { ok: false, error: "conflito", conflito: true };
        return emMemoria(op);
      },
    });
    for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) await ponte.processarContas();
    const aviso = comentariosDoAgente(das).at(-1)?.content ?? "";
    expect(aviso).toContain("pay_das_1");
    expect(aviso).toContain("(CONFLITO_DE_REVISAO)");
    expect(aviso.endsWith("Confira e mova à mão.")).toBe(true);
  });

});

describe("os textos depois do título (k)", () => {
  it("(k) TEXTO_SAIU_ANTES_DO_REGISTRO não promete o que a ponte não garante", () => {
    expect(TEXTO_SAIU_ANTES_DO_REGISTRO).not.toContain("sem lançar de novo");
    expect(TEXTO_SAIU_ANTES_DO_REGISTRO).toContain("Confira");
    expect(TEXTO_SAIU_ANTES_DO_REGISTRO).toContain("dados da Conferência");
  });
});
