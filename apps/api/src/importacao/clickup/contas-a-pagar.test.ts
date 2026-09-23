/**
 * Prova pura de `classificarTarefaLegada` — os casos (a)-(j) do Plan 03-10,
 * Task 1. Roda sempre, sobre a fixture 100% fictícia (`./fixtures/contas-a-pagar-sanitizadas.json`),
 * nunca abre o export real. O caso (k), contra o export de verdade, só roda
 * quando a pasta existe em disco (ela é ignorada pelo git por LGPD — um
 * clone limpo não a tem).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/contas-a-pagar-sanitizadas.json";
import {
  classificarTarefaLegada,
  comoDiaCivil,
  comoInstanteDeEpoch,
  lerTarefasDoExport,
  type HistoricoClickUpBruto,
  type TarefaClickUpBruta,
} from "./contas-a-pagar";

interface EntradaDaFixture {
  readonly _caso: string;
  readonly tarefa: TarefaClickUpBruta;
  readonly historico: HistoricoClickUpBruto;
}

const tarefas = fixture.tarefas as unknown as readonly EntradaDaFixture[];
const instanteDaExportacao = fixture.instanteDaExportacao;

function porId(id: string): EntradaDaFixture {
  const encontrada = tarefas.find((t) => t.tarefa.id === id);
  if (!encontrada) throw new Error(`Fixture não tem a Tarefa id=${id}.`);
  return encontrada;
}

function classificar(id: string) {
  const { tarefa, historico } = porId(id);
  return classificarTarefaLegada(tarefa, historico, { instanteDaExportacao });
}

describe("classificarTarefaLegada", () => {
  it("(a) vencimento nativo, nunca duplicado — nenhuma chave de campos carrega a data de vencimento", () => {
    const r = classificar("fic_001");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.vencimento).toEqual({ form: "civilDay", value: "2026-01-20" });
    expect(Object.keys(r.entrada?.campos ?? {})).not.toContain("fd_cp_data_vencimento");
  });

  it("(b) precedência do vencimento — L diverge do nativo vira lacuna auditável, nativo vence", () => {
    const r = classificar("fic_002");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.vencimento).toEqual({ form: "civilDay", value: "2026-02-10" });
    expect(r.entrada?.lacunas).toContain("vencimento_l_diverge_do_nativo");
  });

  it("(b) sem due_date nativo e sem L: vencimento ausente, lacuna vencimento_ausente", () => {
    const r = classificar("fic_003");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.vencimento).toBeUndefined();
    expect(r.entrada?.lacunas).toContain("vencimento_ausente");
  });

  it("(c) transições reordenáveis: cada `em` em ISO-8601; nome desconhecido vira só nomeLegado", () => {
    const r = classificar("fic_004");
    expect(r.resultado).toBe("valida");
    const transicoes = r.entrada?.transicoes ?? [];
    expect(transicoes).toHaveLength(3);
    for (const t of transicoes) expect(t.em).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const legado = transicoes.find((t) => t.nomeLegado === "to do");
    expect(legado?.statusId).toBeUndefined();
    const resolvida = transicoes.find((t) => t.nomeLegado === "em lançamento omie");
    expect(resolvida?.statusId).toBe("st_cp_em_lancamento");
  });

  it("(d) Status final sem equivalente devolve rejeitada, sem entrada", () => {
    const r = classificar("fic_005");
    expect(r.resultado).toBe("rejeitada");
    expect(r.motivo).toBe("status_final_sem_equivalente");
    expect(r.entrada).toBeUndefined();
    expect(r.legacyTaskId).toBe("fic_005");
  });

  it("(e) opção com espaço em branco ao final resolve depois do .trim()", () => {
    const r = classificar("fic_006");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.campos.fd_cp_categoria).toBe("Ferramentas");
    expect(r.entrada?.lacunas).not.toContain("opcao_fora_do_dominio");
  });

  it("(f) Tag sem equivalente fica de fora de `tags` e vira lacuna; a conhecida entra", () => {
    const r = classificar("fic_007");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.tags).toEqual(["tag_cp_1"]);
    expect(r.entrada?.lacunas).toContain("tag_sem_equivalente");
  });

  it("(g) PREP-04: autoria conhecida entra; responsável/observador sem memberIdConhecido viram lacuna", () => {
    const r = classificar("fic_008");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.autoriaConhecida).toEqual({ memberId: "mem_maryane" });
    expect(r.entrada?.responsaveis).toEqual(["mem_maryane"]);
    expect(r.entrada?.lacunas).toContain("responsavel_nao_resolvido");
    expect(r.entrada?.lacunas).toContain("observador_nao_resolvido");
    expect(r.entrada?.observadores ?? []).toHaveLength(0);
  });

  it("(h)+(i) Anexo nunca produz valor; Centro de Custo ausente é lacuna, não recusa", () => {
    const r = classificar("fic_009");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.lacunas).toContain("anexo_nao_importado");
    expect(r.entrada?.lacunas).toContain("centro_de_custo_ausente");
    expect(Object.keys(r.entrada?.campos ?? {})).not.toContain("fd_cp_anexo");
  });

  it("(j) reentrada de status detectada quando by_minute excede o intervalo contíguo em mais de 60 minutos", () => {
    const r = classificar("fic_010");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.lacunas).toContain("tempo_acumulado_maior_que_o_intervalo");
  });

  it("nenhuma entrada da fixture deixa `entrada.vencimento` vazar para dentro de `entrada.campos`", () => {
    for (const { tarefa, historico } of tarefas) {
      const r = classificarTarefaLegada(tarefa, historico, { instanteDaExportacao });
      if (r.resultado !== "valida" || !r.entrada?.vencimento) continue;
      const serializado = JSON.stringify(r.entrada.campos);
      expect(serializado.includes(r.entrada.vencimento.value)).toBe(false);
    }
  });

  it("nunca lança para entrada ausente/malformada — devolve rejeitada", () => {
    expect(() => classificarTarefaLegada({ id: "", name: "", status: { status: "para pagar" } }, {}, { instanteDaExportacao })).not.toThrow();
    const r = classificarTarefaLegada({ id: "", name: "", status: { status: "para pagar" } }, {}, { instanteDaExportacao });
    expect(r.resultado).toBe("rejeitada");
    expect(r.motivo).toBe("taskid_ausente");
  });
});

describe("comoInstanteDeEpoch / comoDiaCivil", () => {
  it("epoch-ms em string ou número converte; não-numérico devolve undefined", () => {
    expect(comoInstanteDeEpoch("1767625200000")).toBe(new Date(1767625200000).toISOString());
    expect(comoInstanteDeEpoch(1767625200000)).toBe(new Date(1767625200000).toISOString());
    expect(comoInstanteDeEpoch("não é número")).toBeUndefined();
    expect(comoInstanteDeEpoch(undefined)).toBeUndefined();
    expect(comoInstanteDeEpoch(null)).toBeUndefined();
  });

  it("epoch-ms vira dia civil em America/Sao_Paulo", () => {
    expect(comoDiaCivil("1768921200000")).toBe("2026-01-20");
    expect(comoDiaCivil("não é número")).toBeUndefined();
  });
});

/* ─────────────── (k) Contra o export real, quando ele existir ─────────────── */

const PASTA_DA_LISTA = path.join(import.meta.dirname, "../../../exportacoes/clickup/901107637383");
const descreverComExportReal = existsSync(PASTA_DA_LISTA) ? describe : describe.skip;

descreverComExportReal("classificarTarefaLegada — contra o export real da Lista 901107637383", () => {
  it("(k) 2.861 válidas, 0 rejeitadas, 12.490 transições, 2.830 com vencimento, 0 sem equivalente/fora do domínio", async () => {
    // O MANIFESTO.md registra o export como gerado em 2026-09-17T02:40:34.413Z —
    // é o teto usado para medir a reentrada de Status (passo 9).
    const opcoes = { instanteDaExportacao: "2026-09-17T02:40:34.413Z" };
    let total = 0;
    let validas = 0;
    let rejeitadas = 0;
    let somaDeTransicoes = 0;
    let comVencimento = 0;
    let semEquivalente = 0;
    let foraDoDominio = 0;

    for await (const { tarefa, historico } of lerTarefasDoExport(PASTA_DA_LISTA)) {
      total += 1;
      const r = classificarTarefaLegada(tarefa, historico, opcoes);
      if (r.resultado === "valida") {
        validas += 1;
        somaDeTransicoes += r.entrada?.transicoes.length ?? 0;
        if (r.entrada?.vencimento) comVencimento += 1;
        if (r.entrada?.lacunas.includes("opcao_fora_do_dominio")) foraDoDominio += 1;
      } else {
        rejeitadas += 1;
        if (r.motivo === "status_final_sem_equivalente") semEquivalente += 1;
      }
    }

    expect(total).toBe(2861);
    expect(validas).toBe(2861);
    expect(rejeitadas).toBe(0);
    expect(somaDeTransicoes).toBe(12490);
    expect(comVencimento).toBe(2830);
    expect(semEquivalente).toBe(0);
    expect(foraDoDominio).toBe(0);
  }, 60_000);
});
