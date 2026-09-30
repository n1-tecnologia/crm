/**
 * 06-22 — crm2:WR-01 residual (06-REVIEW-4 Aviso): a guarda de resposta
 * pendente (06-21, `pendenteNoFio`/`dispensarConferenciaDoResumo`) usava
 * `aprovacaoPorComentario: true` fixo mesmo quando a política REAL do espaço
 * de trabalho (`conferenciaPorComentario`, D6-02) está desligada — travando
 * a dispensa `sem-conferencia` (D6-04) para sempre, em silêncio, atrás de um
 * "ok" trivial que a própria política já diz não valer como decisão.
 *
 * A sequência exata que `06-REVIEW-4.md` achou por sonda, agora como teste
 * permanente: dispensa automática (ciclo 1, `conferenciaPorComentario: false`
 * + `sem-conferencia`) → desmarcar "Manual" (ciclo 2, Resumo novo no mesmo
 * fio) → humano responde "ok" no fio (sem rodar ciclo, sob a política que diz
 * que esse "ok" não decide nada) → remarcar "Manual" → o ciclo seguinte volta
 * a DISPENSAR normalmente, em vez de travar para sempre.
 *
 * Molde de fixtures: `ponte-dispensa-com-resposta.test.ts` (06-21, NÃO
 * editado por este plano). Arquivo novo (CON-05). Sem banco e sem rede real
 * (`servidorFalso`).
 */

import { afterEach, describe, expect, it } from "vitest";
import { CP, MOTIVO_DA_DISPENSA } from "@n1/dominio/operations/financeiro";
import { setTaskFieldValue } from "@n1/dominio/operations/tasks";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { ATOR, MARYANE, RESOLVIDA, buildSeed, isolar, ponteSobre, responder, vigente } from "../testes/fixtures-da-ponte";
import type { OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

/** D6-04 `sem-conferencia` + D6-02 `conferenciaPorComentario: false` — a combinação que 06-REVIEW-4 achou. */
const SEM_CONFERENCIA_SEM_COMENTARIO = { decisoes: { integracaoManual: "sem-conferencia" as const, conferenciaPorComentario: false as const } };

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

/** O primeiro ciclo de uma conta Manual sob `sem-conferencia` + comentário desligado: Resumo e dispensa (c1). */
async function dispensadaPelaPonte(srv: ServidorFalso, estado: DataState, das: Task) {
  manual(estado, das, "Manual");
  srv.enfileirar(RESOLVIDA);
  const montada = montar(srv, estado, SEM_CONFERENCIA_SEM_COMENTARIO);
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

describe('06-REVIEW-4 Aviso — a checagem de resposta pendente respeita a política real de conferência por comentário', () => {
  it('(e) sequência completa: "ok" trivial sob a política desligada não trava mais a dispensa sem-conferência — o ciclo seguinte dispensa normalmente', async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);

    // A Maryane diz "ok" no fio — sob a política real (desligada), isso NÃO decide nada.
    responder(estado, das, MARYANE, "ok");

    manual(estado, das, "Manual");
    await ponte.processarContas();

    expect(c2.decision).toBe("aprovada");
    expect(c2.decisionWaiver).toBe("integracaoManual");
    expect(c2.decisionSource).toBe("click");
    expect(c2.decisionReason).toBe(MOTIVO_DA_DISPENSA);
    expect(c2.decidedByMemberId).toBe(ATOR);
    expect(c2.decidedByMemberId).not.toBe(MARYANE);
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
    expect(codigos(registros)).not.toContain("DISPENSA_ADIADA_RESPOSTA_PENDENTE");
  });

  it("(f) mesma sequência, mas a resposta é um AJUSTE: a ponte continua indo para lerRespostas, NÃO dispensa — o Crítico original não reabre", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);

    responder(estado, das, MARYANE, "ajuste: usa a conta 1.02.02");

    manual(estado, das, "Manual");
    await ponte.processarContas();

    expect(c2.decision).toBe("rejeitada");
    expect(c2.decisionReason).toBe("ajuste: usa a conta 1.02.02");
    expect(c2.decisionSource).toBe("comment");
    expect(c2.decidedByMemberId).toBe(MARYANE);
    expect(c2.decidedByMemberId).not.toBe(ATOR);
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
    expect(codigos(registros)).not.toContain("DISPENSA_ADIADA_RESPOSTA_PENDENTE");
  });

  it("(g) depois de (e) resolver, mais 3 ciclos sem ação humana nova não produzem erro nem log novo — a conta não fica presa", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);
    responder(estado, das, MARYANE, "ok");
    manual(estado, das, "Manual");
    await ponte.processarContas();
    expect(c2.decision).toBe("aprovada");

    const antesDeMaisCiclos = registros.length;
    await ponte.processarContas();
    await ponte.processarContas();
    await ponte.processarContas();

    expect(c2.decision).toBe("aprovada");
    expect(c2.decisionWaiver).toBe("integracaoManual");
    const novosRegistros = registros.slice(antesDeMaisCiclos);
    expect(codigos(novosRegistros)).not.toContain("RESPOSTA_SEM_EFEITO");
    expect(codigos(novosRegistros)).not.toContain("DISPENSA_ADIADA_RESPOSTA_PENDENTE");
    expect(codigos(novosRegistros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
  });

  it("(h) regressão permanente da sonda de 06-REVIEW-4: com a correção, 5 ciclos depois de remarcar Manual NUNCA deixam c2.decision indefinido (sem a correção, a sonda mostrou undefined para sempre)", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros } = await dispensadaPelaPonte(srv, estado, das);
    const c2 = await desmarcarEPublicarNovo(srv, estado, das, ponte);
    responder(estado, das, MARYANE, "ok");
    manual(estado, das, "Manual");

    for (let ciclo = 1; ciclo <= 5; ciclo++) {
      await ponte.processarContas();
      expect(c2.decision, `ciclo ${ciclo}: c2.decision não pode ficar indefinido (era a trava silenciosa de 06-REVIEW-4)`).not.toBeUndefined();
    }

    expect(c2.decision).toBe("aprovada");
    expect(c2.decisionWaiver).toBe("integracaoManual");
    expect(c2.decidedByMemberId).toBe(ATOR);
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");
    expect(codigos(registros)).not.toContain("DISPENSA_ADIADA_RESPOSTA_PENDENTE");
  });
});
