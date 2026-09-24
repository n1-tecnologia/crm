/**
 * Prova pura de `mapearContaAReceber` — as regras do Plan 05-11, Task 2,
 * cobertas uma a uma sobre fixtures 100% fictícias
 * (`./fixtures/contas-a-receber-sanitizadas.json`), nunca contra o export
 * real. O caso `(l)`, contra o export de verdade, só roda quando a pasta
 * existe em disco (ignorada pelo git por LGPD — um clone limpo não a tem).
 *
 * Os quatro legacyTaskId reais citados nas fixtures (e) e (f) — as duas
 * duplicatas de RN-CR-07 e a subtarefa indevida de RN-CR-06 — são
 * PROPOSITAIS: a regra do mapeador está ligada a esses ids literais
 * (`PAR_DUPLICADO`, `ID_SUBTAREFA_INDEVIDA`), então o teste precisa usá-los.
 * Nenhum outro dado da linha real (nome de cliente, valor, data) foi copiado.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CR } from "@n1/dominio/operations/financeiro";
import fixture from "./fixtures/contas-a-receber-sanitizadas.json";
import {
  comoDiaCivil,
  comoInstanteDeEpoch,
  instanteDaDataDePagamento,
  lerContasAReceberDoExport,
  mapearContaAReceber,
  resolverClienteNoCatalogo,
  type ClassificacaoDeContaAReceber,
  type ContextoDeMapeamento,
} from "./contas-a-receber";
import type { HistoricoClickUpBruto, TarefaClickUpBruta } from "./contas-a-pagar";

interface EntradaDaFixture {
  readonly _caso: string;
  readonly tarefa: TarefaClickUpBruta;
  readonly historico: HistoricoClickUpBruto;
}

const tarefas = fixture.tarefas as unknown as readonly EntradaDaFixture[];

const CATALOGO: ContextoDeMapeamento = {
  catalogoDeClientes: [
    { tipo: "contact", id: "cnt_teste_um", nome: "Cliente Fictício Um" },
    { tipo: "contact", id: "cnt_teste_dois", nome: "Cliente Fictício Dois" },
  ],
};

function porId(id: string): EntradaDaFixture {
  const encontrada = tarefas.find((t) => t.tarefa.id === id);
  if (!encontrada) throw new Error(`Fixture não tem a Tarefa id=${id}.`);
  return encontrada;
}

function classificar(id: string, contexto: ContextoDeMapeamento = CATALOGO): ClassificacaoDeContaAReceber {
  const { tarefa, historico } = porId(id);
  return mapearContaAReceber(tarefa, historico, contexto);
}

describe("mapearContaAReceber", () => {
  it("(a) Data de pagamento pelo Campo tem precedência sobre date_closed — sem a lacuna de fallback; cliente resolvido vira clienteRef", () => {
    const r = classificar("fic_cr_001");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe(comoDiaCivil("1742288100000"));
    expect(r.entrada?.lacunas).not.toContain("data-de-pagamento-por-date-closed");
    expect(r.entrada?.clienteRef).toEqual({ tipo: "contact", id: "cnt_teste_um" });
  });

  it("(b) sem Campo Data de pagamento: cai para date_closed e GERA a lacuna de fallback (D5-16)", () => {
    const r = classificar("fic_cr_002");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe(comoDiaCivil("1709596500000"));
    expect(r.entrada?.lacunas).toContain("data-de-pagamento-por-date-closed");
  });

  it("(c) Saque com Valor 0: o Campo Valor fica VAZIO (nunca 0 gravado) e a lacuna saque-sem-valor nasce (D5-14)", () => {
    const r = classificar("fic_cr_003");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.campos["fd_cp_valor"]).toBeUndefined();
    expect(r.entrada?.lacunas).toContain("saque-sem-valor");
  });

  it("(c) Saque sem Campo Valor nenhum: mesma lacuna saque-sem-valor", () => {
    const r = classificar("fic_cr_004");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.campos["fd_cp_valor"]).toBeUndefined();
    expect(r.entrada?.lacunas).toContain("saque-sem-valor");
  });

  it("(d) RN-CR-07: as duas duplicatas entram AS DUAS, cada uma citando o id legado da outra — nenhuma fusão", () => {
    const a = classificar("868cpd8zg");
    const b = classificar("868ffg91u");
    expect(a.resultado).toBe("valida");
    expect(b.resultado).toBe("valida");
    expect(a.entrada?.lacunas).toContain("parcela-duplicada:868ffg91u");
    expect(b.entrada?.lacunas).toContain("parcela-duplicada:868cpd8zg");
    // As duas viram entradas DISTINTAS — nenhum dos dois legacyTaskId é descartado.
    expect(a.entrada?.legacyTaskId).toBe("868cpd8zg");
    expect(b.entrada?.legacyTaskId).toBe("868ffg91u");
  });

  it("(e) RN-CR-06: a subtarefa indevida entra sem parentTaskId (a interface nem tem esse campo) e com a lacuna citando o pai", () => {
    const r = classificar("868cpdawp");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.lacunas).toContain("subtarefa-desamarrada:868c7qreq");
    expect(Object.prototype.hasOwnProperty.call(r.entrada ?? {}, "parentTaskId")).toBe(false);
  });

  it("(f) nome sem correspondência no catálogo: lacuna cliente-nao-encontrado, clienteRef ausente, NENHUM Contato inventado", () => {
    const r = classificar("fic_cr_007");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.clienteRef).toBeUndefined();
    expect(r.entrada?.lacunas).toContain("cliente-nao-encontrado");
  });

  it("(g) RN-CR-02: sem Campo “Gestão de Clientes” no ClickUp, nenhuma lacuna cliente-nao-encontrado nasce aqui (a “sem-cliente” é da operação de domínio, Task 1)", () => {
    const r = classificar("fic_cr_008");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.clienteRef).toBeUndefined();
    expect(r.entrada?.lacunas).not.toContain("cliente-nao-encontrado");
  });

  it("(h) Status final sem equivalente: rejeitada, sem entrada, Tarefa NÃO importada", () => {
    const r = classificar("fic_cr_009");
    expect(r.resultado).toBe("rejeitada");
    expect(r.motivo).toBe("status-legado-desconhecido");
    expect(r.entrada).toBeUndefined();
    expect(r.legacyTaskId).toBe("fic_cr_009");
  });

  it("(i) Tags → Campo (D5-17): “em cobrança” vira Situação, “conta tria” vira Conta de recebimento — nenhuma das duas é Tag", () => {
    const r = classificar("fic_cr_010");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.campos[CR.fields.situacao]).toBe(CR.situacoes.emCobranca);
    expect(r.entrada?.campos[CR.fields.contaRecebimento]).toBe("TRIA");
    expect(r.entrada?.tags ?? []).toHaveLength(0);
  });

  it("sem nenhuma Tag de cobrança, a Situação por padrão é “em dia”", () => {
    const r = classificar("fic_cr_001");
    expect(r.entrada?.campos[CR.fields.situacao]).toBe(CR.situacoes.emDia);
  });

  it("(j) nome fora do vocabulário de §5 vira Avulso + lacuna tipo-inferido", () => {
    const r = classificar("fic_cr_011");
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.campos[CR.fields.tipo]).toBe(CR.tipos.avulso);
    expect(r.entrada?.lacunas).toContain("tipo-inferido");
  });

  it("Número da parcela extraído do Nome, e a lacuna total-de-parcelas-ausente sempre acompanha uma Parcela (nunca conta as presentes)", () => {
    const r = classificar("fic_cr_001");
    expect(r.entrada?.campos[CR.fields.tipo]).toBe(CR.tipos.parcela);
    expect(r.entrada?.campos[CR.fields.numeroParcela]).toBe(3);
    expect(r.entrada?.lacunas).toContain("total-de-parcelas-ausente");
    expect(Object.keys(r.entrada?.campos ?? {})).not.toContain(CR.fields.totalParcelas);
  });

  it("CR-06: Campo “Data de pagamento” às 22:30 de Brasília (01:30Z do dia seguinte) grava o dia civil de São Paulo, não o UTC", () => {
    // `c41d9418-…` é `ID_CAMPO_DATA_DE_PAGAMENTO` (mesmo id literal da
    // fixture `fic_cr_001`); "1742002200000" = 2025-03-15T01:30:00.000Z =
    // 2025-03-14T22:30 em America/Sao_Paulo (UTC-3).
    const tarefa: TarefaClickUpBruta = {
      id: "fic_cr_cr06_a",
      name: "Entrada – Fronteira de fuso",
      status: { status: "recebido" },
      date_created: "1706918100000",
      custom_fields: [{ id: "c41d9418-824c-4beb-9264-e5b03e815c9d", type: "date", value: "1742002200000" }],
    };
    const historico: HistoricoClickUpBruto = { status_history: [{ status: "recebido", total_time: { since: "1706918100000" } }] };
    const r = mapearContaAReceber(tarefa, historico, CATALOGO);
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe("2025-03-14");
    expect(r.entrada?.lacunas).not.toContain("data-de-pagamento-por-date-closed");
  });

  it("CR-06: date_closed às 02:59:59Z (23:59:59 de Brasília) cai no fallback e grava o dia anterior", () => {
    const tarefa: TarefaClickUpBruta = {
      id: "fic_cr_cr06_b",
      name: "Entrada – Fronteira de fuso (date_closed antes das 03h UTC)",
      status: { status: "recebido" },
      date_created: "1706918100000",
      date_closed: "1742007599000", // 2025-03-15T02:59:59.000Z = 2025-03-14T23:59:59 em São Paulo
    };
    const historico: HistoricoClickUpBruto = { status_history: [{ status: "recebido", total_time: { since: "1706918100000" } }] };
    const r = mapearContaAReceber(tarefa, historico, CATALOGO);
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe("2025-03-14");
    expect(r.entrada?.lacunas).toContain("data-de-pagamento-por-date-closed");
  });

  it("CR-06: date_closed às 03:00:00Z (00:00:00 de Brasília) já é o próximo dia civil", () => {
    const tarefa: TarefaClickUpBruta = {
      id: "fic_cr_cr06_c",
      name: "Entrada – Fronteira de fuso (date_closed a partir das 03h UTC)",
      status: { status: "recebido" },
      date_created: "1706918100000",
      date_closed: "1742007600000", // 2025-03-15T03:00:00.000Z = 2025-03-15T00:00:00 em São Paulo
    };
    const historico: HistoricoClickUpBruto = { status_history: [{ status: "recebido", total_time: { since: "1706918100000" } }] };
    const r = mapearContaAReceber(tarefa, historico, CATALOGO);
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe("2025-03-15");
    expect(r.entrada?.lacunas).toContain("data-de-pagamento-por-date-closed");
  });

  it("CR-06: Campo e date_closed presentes — o Campo vence (D5-16), sem a lacuna de fallback", () => {
    const tarefa: TarefaClickUpBruta = {
      id: "fic_cr_cr06_d",
      name: "Entrada – Campo e date_closed juntos",
      status: { status: "recebido" },
      date_created: "1706918100000",
      date_closed: "1742007600000",
      custom_fields: [{ id: "c41d9418-824c-4beb-9264-e5b03e815c9d", type: "date", value: "1742002200000" }],
    };
    const historico: HistoricoClickUpBruto = { status_history: [{ status: "recebido", total_time: { since: "1706918100000" } }] };
    const r = mapearContaAReceber(tarefa, historico, CATALOGO);
    expect(r.resultado).toBe("valida");
    expect(r.entrada?.dataPagamento).toBe("2025-03-14");
    expect(r.entrada?.lacunas).not.toContain("data-de-pagamento-por-date-closed");
  });

  it("instanteDaDataDePagamento devolve { instante, origem } com a MESMA precedência que mapearContaAReceber usa", () => {
    const { tarefa: tarefaComCampo } = porId("fic_cr_001");
    const comCampo = instanteDaDataDePagamento(tarefaComCampo);
    expect(comCampo).toEqual({ instante: comoInstanteDeEpoch("1742288100000"), origem: "campo" });

    const { tarefa: tarefaSemCampo } = porId("fic_cr_002");
    const semCampo = instanteDaDataDePagamento(tarefaSemCampo);
    expect(semCampo).toEqual({ instante: comoInstanteDeEpoch("1709596500000"), origem: "date_closed" });

    const { tarefa: tarefaSemNenhum } = porId("868cpdawp");
    expect(instanteDaDataDePagamento(tarefaSemNenhum)).toBeUndefined();
  });

  it("resolverClienteNoCatalogo compara por nome normalizado (acento/caixa) e devolve undefined sem candidato", () => {
    expect(resolverClienteNoCatalogo("cliente FICTÍCIO um", CATALOGO)).toEqual({ tipo: "contact", id: "cnt_teste_um", nome: "Cliente Fictício Um" });
    expect(resolverClienteNoCatalogo("ninguém com esse nome", CATALOGO)).toBeUndefined();
  });

  it("nunca lança para entrada ausente/malformada — devolve rejeitada", () => {
    const r = mapearContaAReceber({ id: "", name: "", status: { status: "para receber" } }, {}, CATALOGO);
    expect(r.resultado).toBe("rejeitada");
    expect(r.motivo).toBe("taskid_ausente");
  });
});

describe("comoInstanteDeEpoch / comoDiaCivil (reaproveitados de ./contas-a-pagar)", () => {
  it("continuam disponíveis pelo módulo de Contas a receber", () => {
    expect(comoInstanteDeEpoch("1742288100000")).toBe(new Date(1742288100000).toISOString());
    expect(comoDiaCivil("1742288100000")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/* ─────────────── (l) Contra o export real, quando ele existir ─────────────── */

const PASTA_DA_LISTA = path.join(import.meta.dirname, "../../../exportacoes/clickup/901107648977");
const descreverComExportReal = existsSync(PASTA_DA_LISTA) ? describe : describe.skip;

descreverComExportReal("mapearContaAReceber — contra o export real da Lista 901107648977", () => {
  it("(l) 240 lidas, 240 válidas, 0 rejeitadas; as duas duplicatas e a subtarefa aparecem exatamente onde a spec diz", async () => {
    // Catálogo vazio de propósito: resolver o CRM real é responsabilidade da
    // orquestração (Task 3) contra `ws_n1` hidratado, não deste teste
    // estrutural — aqui só se prova a FORMA da classificação.
    const contexto: ContextoDeMapeamento = { catalogoDeClientes: [] };
    let total = 0;
    let validas = 0;
    let rejeitadas = 0;
    const duplicatas = new Map<string, string>();
    const subtarefas: string[] = [];
    let saqueSemValor = 0;

    for await (const { tarefa, historico } of lerContasAReceberDoExport(PASTA_DA_LISTA)) {
      total += 1;
      const r = mapearContaAReceber(tarefa, historico, contexto);
      if (r.resultado === "rejeitada") {
        rejeitadas += 1;
        continue;
      }
      validas += 1;
      for (const l of r.entrada?.lacunas ?? []) {
        if (l.startsWith("parcela-duplicada:")) duplicatas.set(r.legacyTaskId!, l.split(":")[1]!);
        if (l.startsWith("subtarefa-desamarrada:")) subtarefas.push(`${r.legacyTaskId}->${l.split(":")[1]}`);
        if (l === "saque-sem-valor") saqueSemValor += 1;
      }
    }

    expect(total).toBe(240);
    expect(validas).toBe(240);
    expect(rejeitadas).toBe(0);

    // RN-CR-07 — as duas "7ª Parcela – Gabriela Melo" e as duas "2ª Parcela – Sidney Garcês".
    expect(duplicatas.get("868cpd8zg")).toBe("868ffg91u");
    expect(duplicatas.get("868ffg91u")).toBe("868cpd8zg");
    expect(duplicatas.get("868cpdatn")).toBe("868dg4wy3");
    expect(duplicatas.get("868dg4wy3")).toBe("868cpdatn");
    expect(duplicatas.size).toBe(4);

    // RN-CR-06 — a única Subtarefa indevida.
    expect(subtarefas).toEqual(["868cpdawp->868c7qreq"]);

    // D5-14 — achado real (ver 05-11-SUMMARY.md): 4 das 9 Tarefas "Saque"
    // têm Valor ausente ou zero no export atual — diferente do "todos 0" que
    // `docs/07-processos/contas-a-receber.md` §12 registrou antes da carga
    // completa da Lista; o Campo nunca grava 0 como valor legítimo.
    expect(saqueSemValor).toBe(4);
  }, 60_000);
});
