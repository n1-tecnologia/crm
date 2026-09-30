/**
 * 06-21 Task 1 — crm2:CR-01 residual (06-REVIEW-3, Crítico): remarcar
 * "Integração manual" depois de um humano já ter respondido no fio (ajuste ou
 * aprovação) para a Conferência vigente NUNCA dispensa essa resposta.
 *
 * A sequência do review, que a suíte de 06-18/06-19 e a jornada
 * `cp-dispensa-manual` nunca cobriram: dispensa automática (ciclo 1) →
 * desmarcar "Manual" (ciclo 2, Resumo novo no mesmo fio) → humano responde no
 * fio (sem rodar ciclo) → remarcar "Manual" → ciclo 3 — ANTES da correção, a
 * ponte dispensava por cima da resposta humana; DEPOIS, ela lê o fio.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real (`servidorFalso`).
 */

import { afterEach, describe, expect, it } from "vitest";
import { CP, TEXTOS_DA_CONFERENCIA } from "@n1/dominio/operations/financeiro";
import { setTaskFieldValue } from "@n1/dominio/operations/tasks";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { ATOR, MARYANE, RESOLVIDA, buildSeed, executarEmMemoria, isolar, ponteSobre, responder, vigente } from "../testes/fixtures-da-ponte";
import type { OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const SEM_CONFERENCIA = { decisoes: { integracaoManual: "sem-conferencia" as const } };

let servidor: ServidorFalso | undefined;
afterEach(async () => {
  await servidor?.fechar();
  servidor = undefined;
});

async function abrirServidor(): Promise<ServidorFalso> {
  servidor = await criarServidorFalso();
  return servidor;
}

function montar(srv: ServidorFalso, estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
  const registros: Registro[] = [];
  const ponte = ponteSobre(srv, estado, {
    registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    ...extra,
  });
  return { ponte, registros };
}

const codigos = (registros: readonly Registro[]) => registros.map((r) => r.dados?.code).filter((c) => c !== undefined);

/** A Maryane muda o Campo "Integração manual" (null desmarca). */
function manual(estado: DataState, t: Task, valor: "Manual" | null): void {
  const r = setTaskFieldValue(estado, MARYANE, t.id, CP.fields.integracaoManual, valor);
  if (!r.ok) throw new Error(r.error);
}

/** O primeiro ciclo de uma conta Manual sob `sem-conferencia`: Resumo e dispensa (c1). */
async function dispensadaPelaPonte(srv: ServidorFalso, estado: DataState, das: Task) {
  manual(estado, das, "Manual");
  srv.enfileirar(RESOLVIDA);
  const montada = montar(srv, estado, SEM_CONFERENCIA);
  await montada.ponte.processarContas();
  const c1 = vigente(estado, das);
  expect(c1.decision).toBe("aprovada");
  expect(c1.decisionWaiver).toBe("integracaoManual");
  return { ...montada, c1 };
}

/** Desmarca "Manual": ciclo seguinte publica um Resumo novo no mesmo fio, para a Maryane. */
async function desmarcarEPublicarNovo(srv: ServidorFalso, estado: DataState, das: Task, ponte: ReturnType<typeof ponteSobre>) {
  manual(estado, das, null);
  srv.enfileirar(RESOLVIDA);
  await ponte.processarContas();
  const c2 = vigente(estado, das);
  expect(c2.decision).toBeUndefined();
  expect(c2.approverMemberId).toBe(MARYANE);
  return c2;
}

describe("crm2:CR-01 residual (06-REVIEW-3 Crítico) — remarcar Manual não engole uma resposta pendente", () => {
  it('(f) humano pede ajuste no fio, sem rodar ciclo; remarcar "Manual"; o ciclo seguinte LÊ o ajuste, não dispensa', async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);

    // O humano responde no fio ANTES de qualquer ciclo novo rodar.
    responder(estado, das, MARYANE, "ajuste: usa a conta 1.02.02");

    manual(estado, das, "Manual");
    await ponte.processarContas();

    expect(c2.decision).toBe("rejeitada");
    expect(c2.decisionReason).toBe("ajuste: usa a conta 1.02.02");
    expect(c2.decisionSource).toBe("comment");
    expect(c2.decidedByMemberId).toBe(MARYANE);
    expect(c2.decidedByMemberId).not.toBe(ATOR);
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
    expect(codigos(registros)).not.toContain("DISPENSA_ADIADA");
  });

  it('(g) humano responde "ok" no fio, sem rodar ciclo; remarcar "Manual"; o ciclo seguinte LÊ o "ok" — aprovada pelo humano, não pela dispensa', async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);

    responder(estado, das, MARYANE, "ok");

    manual(estado, das, "Manual");
    await ponte.processarContas();

    expect(c2.decision).toBe("aprovada");
    expect(c2.decisionSource).toBe("comment");
    expect(c2.decidedByMemberId).toBe(MARYANE);
    expect(c2.decidedByMemberId).not.toBe(ATOR);
    expect(c2.decisionReason).not.toBe(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
  });

  it("(h) corrida: a resposta só existe dentro de executarOperacao (depois do sinal lido pela ponte) — o domínio recusa na transação, e a ponte adia sem parada", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);
    manual(estado, das, "Manual");

    // A ponte lê o estado (sinal `pendenteNoFio`) SEM a resposta ainda: ela só
    // é injetada dentro de `executarOperacao`, depois desse sinal já ter sido
    // calculado como `false` — a mesma corrida que a leitura fora da Unidade
    // de Trabalho não vê.
    const noMemoria = executarEmMemoria(estado);
    let primeira = true;
    const { ponte: ponteDaCorrida, registros: registrosDaCorrida } = montar(srv, estado, {
      ...SEM_CONFERENCIA,
      executarOperacao: async (operacao) => {
        if (primeira) {
          primeira = false;
          responder(estado, das, MARYANE, "ajuste: revisar o vencimento");
        }
        return noMemoria(operacao);
      },
    });
    await ponteDaCorrida.processarContas();

    expect(c2.decision).toBeUndefined();
    const adiada = registrosDaCorrida.find((r) => r.dados?.code === "DISPENSA_ADIADA_RESPOSTA_PENDENTE");
    expect(adiada?.nivel).toBe("info");
    expect(codigos(registrosDaCorrida)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");

    // O ciclo seguinte relê o fio normalmente: o ajuste decide, em nome de quem respondeu.
    await ponteDaCorrida.processarContas();
    expect(c2.decision).toBe("rejeitada");
    expect(c2.decidedByMemberId).toBe(MARYANE);
    expect(codigos([...registros, ...registrosDaCorrida])).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
  });
});
