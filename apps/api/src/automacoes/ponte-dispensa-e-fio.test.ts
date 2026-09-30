/**
 * 06-18 Task 2 — a ponte depois de crm2:CR-01 e crm2:WR-03:
 *
 *   (a)–(e) crm2:CR-01 — a dispensa D6-04 (`sem-conferencia`) só vale
 *           enquanto a conta é "Manual". A sonda do review (dispensa →
 *           desmarcar "Manual" → mover para "em lançamento omie") dava 1
 *           `/lancar` e "lançado omie" sem conferência humana; agora dá ZERO
 *           `/lancar` e um Resumo novo, no mesmo fio, para a Maryane — em
 *           `sem-conferencia` e depois de voltar para `nao-encosta`. A decisão
 *           de dispensar usa o estado da gravação: as duas corridas
 *           (desmarcar entre a leitura do ciclo e a gravação, no Resumo e no
 *           passo `pendente`) adiam, sem parada;
 *   (f)–(h) crm2:WR-03 — quem confere pelo fio é quem confere pelo clique:
 *           o aprovador de G3 confere respondendo "ok"; o "ok" da Maryane sob
 *           G3 e o "ok" com a decisão por comentário desligada recebem, no
 *           fio, UMA resposta que diz por quê — nem depois de um reinício ela
 *           sai de novo.
 *
 * "Reiniciar" = uma SEGUNDA ponte sobre o MESMO `estado`. Arquivo novo
 * (CON-05). Sem banco e sem rede real (`servidorFalso`).
 */

import { afterEach, describe, expect, it } from "vitest";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  dispensarConferenciaDoResumo,
  publicarResumoParaConferencia,
} from "@n1/dominio/operations/financeiro";
import { setTaskFieldValue } from "@n1/dominio/operations/tasks";
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
  dePara200,
  executarEmMemoria,
  isolar,
  mover,
  ponteSobre,
  responder,
  resumosDe,
  vigente,
} from "../testes/fixtures-da-ponte";
import { motivoParaNaoLancar, type OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const WALTER = "mem_walter";
const NOME_DO_WALTER = "Walter Galvão Neto";
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
const conferenciasDa = (estado: DataState, t: Task) =>
  estado.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === t.id);

/** A Maryane muda o Campo "Integração manual" (null desmarca). */
function manual(estado: DataState, t: Task, valor: "Manual" | null): void {
  const r = setTaskFieldValue(estado, MARYANE, t.id, F.integracaoManual, valor);
  if (!r.ok) throw new Error(r.error);
}

/** O primeiro ciclo de uma conta Manual sob `sem-conferencia`: Resumo e dispensa. */
async function dispensadaPelaPonte(srv: ServidorFalso, estado: DataState, das: Task) {
  manual(estado, das, "Manual");
  srv.enfileirar(RESOLVIDA);
  const montada = montar(srv, estado, SEM_CONFERENCIA);
  await montada.ponte.processarContas();
  const c1 = vigente(estado, das);
  expect(c1.approverMemberId).toBe(ATOR);
  expect(c1.decision).toBe("aprovada");
  expect(c1.decisionWaiver).toBe("integracaoManual");
  return { ...montada, c1 };
}

describe("crm2:CR-01 — a dispensa só enquanto Manual", () => {
  it("(a) a sonda do review: dispensa, desmarca \"Manual\" e move ⇒ ZERO /lancar e o Resumo novo, no mesmo fio, para a Maryane; conferido por clique, lança", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, c1 } = await dispensadaPelaPonte(srv, estado, das);
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);

    manual(estado, das, null);
    mover(estado, das.id, S.emLancamento);
    srv.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER]);
    const c2 = vigente(estado, das);
    expect(c2.id).not.toBe(c1.id);
    expect(c2.approverMemberId).toBe(MARYANE);
    expect(c2.decision).toBeUndefined();
    expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
    const resumo = das.comments.find((c) => c.id === c2.origin.resumoCommentId);
    expect(resumo?.parentCommentId).toBe(c1.origin.threadCommentId);
    expect(resumo?.mentions).toEqual([{ type: "member", id: MARYANE }]);
    expect(das.statusId).toBe(S.emLancamento);

    const d = decideProcessApproval(estado, MARYANE, c2.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    srv.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER, LANCAR]);
    expect(das.statusId).toBe(S.lancado);
  });

  it("(b) de volta a nao-encosta (uma ponte NOVA): a dispensa antiga numa conta que não é mais Manual não lança", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { c1 } = await dispensadaPelaPonte(srv, estado, das);

    manual(estado, das, null);
    mover(estado, das.id, S.emLancamento);
    srv.enfileirar(RESOLVIDA);
    await montar(srv, estado).ponte.processarContas();
    expect(srv.recebidas.filter((r) => r.caminho === LANCAR)).toHaveLength(0);
    const c2 = vigente(estado, das);
    expect(c2.id).not.toBe(c1.id);
    expect(c2.approverMemberId).toBe(MARYANE);
    expect(c2.decision).toBeUndefined();
    expect(das.statusId).toBe(S.emLancamento);
  });

  it("(c) corrida no Resumo: \"Manual\" desmarcado entre a leitura do ciclo e a gravação ⇒ nada publicado, RESUMO_ADIADO sem parada; o ciclo seguinte chama a Maryane", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    manual(estado, das, "Manual");
    const noMemoria = executarEmMemoria(estado);
    let primeira = true;
    const { ponte, registros } = montar(srv, estado, {
      ...SEM_CONFERENCIA,
      executarOperacao: async (operacao) => {
        if (primeira) {
          primeira = false;
          manual(estado, das, null);
        }
        return noMemoria(operacao);
      },
    });
    srv.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
    expect(resumosDe(das)).toHaveLength(0);
    expect(conferenciasDa(estado, das)).toHaveLength(0);
    const adiado = registros.find((r) => r.dados?.code === "RESUMO_ADIADO");
    expect(adiado?.nivel).toBe("info");

    srv.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER]);
    const c = vigente(estado, das);
    expect(c.approverMemberId).toBe(MARYANE);
    expect(c.decision).toBeUndefined();
    expect(c.decisionWaiver).toBeUndefined();
  });

  it("(d) corrida no passo pendente: a dispensa recusada pelo domínio vira DISPENSA_ADIADA, sem parada; o \"ok\" da Maryane confere no ciclo seguinte", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
    if (!p.ok) throw new Error(p.error);
    manual(estado, das, "Manual");
    const noMemoria = executarEmMemoria(estado);
    let primeira = true;
    const { ponte, registros } = montar(srv, estado, {
      ...SEM_CONFERENCIA,
      executarOperacao: async (operacao) => {
        if (primeira) {
          primeira = false;
          manual(estado, das, null);
        }
        return noMemoria(operacao);
      },
    });
    await ponte.processarContas();
    const c = p.value.conferencia;
    expect(c.decision).toBeUndefined();
    const adiada = registros.find((r) => r.dados?.code === "DISPENSA_ADIADA");
    expect(adiada?.nivel).toBe("info");
    expect(codigos(registros)).not.toContain("DISPENSA_RECUSADA_PELO_DOMINIO");

    responder(estado, das, MARYANE, "ok");
    await ponte.processarContas();
    expect(c.decision).toBe("aprovada");
    expect(c.decidedByMemberId).toBe(MARYANE);
    expect(c.decisionSource).toBe("comment");
    expect(srv.recebidas).toHaveLength(0);
  });

  it("(e) motivoParaNaoLancar: a dispensa sem \"Manual\" é DISPENSA_SEM_MANUAL em qualquer modo", () => {
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    manual(estado, das, "Manual");
    const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara, avisarId: ATOR });
    if (!p.ok) throw new Error(p.error);
    const d = dispensarConferenciaDoResumo(estado, ATOR, p.value.conferencia.id);
    if (!d.ok) throw new Error(d.error);
    mover(estado, das.id, S.emLancamento);
    const criterio = (integracaoManual: "nao-encosta" | "sem-conferencia") => ({ listId: CP.listId, integracaoManual });
    const id = p.value.conferencia.id;

    expect(motivoParaNaoLancar(estado, das.id, id, criterio("sem-conferencia"))).toBeUndefined();
    expect(motivoParaNaoLancar(estado, das.id, id, criterio("nao-encosta"))).toBe("MANUAL");
    manual(estado, das, null);
    expect(motivoParaNaoLancar(estado, das.id, id, criterio("sem-conferencia"))).toBe("DISPENSA_SEM_MANUAL");
    expect(motivoParaNaoLancar(estado, das.id, id, criterio("nao-encosta"))).toBe("DISPENSA_SEM_MANUAL");
  });
});

describe("crm2:WR-03 — quem confere pelo fio é quem confere pelo clique", () => {
  it("(f) G3: o mem_walter, aprovador designado sem papel de Administrador, confere respondendo \"ok\"", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    srv.enfileirar(RESOLVIDA);
    const { ponte } = montar(srv, estado, { avisarId: WALTER });
    await ponte.processarContas();
    const c = vigente(estado, das);
    expect(c.approverMemberId).toBe(WALTER);

    responder(estado, das, WALTER, "ok");
    await ponte.processarContas();
    expect(c.decision).toBe("aprovada");
    expect(c.decidedByMemberId).toBe(WALTER);
    expect(c.decisionSource).toBe("comment");
  });

  it("(g) G3: o \"ok\" da Maryane não confere, e ela recebe UMA resposta — nem mais ciclos nem o reinício a repetem", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    srv.enfileirar(RESOLVIDA);
    const { ponte, registros } = montar(srv, estado, { avisarId: WALTER });
    await ponte.processarContas();
    const c = vigente(estado, das);

    responder(estado, das, MARYANE, "ok");
    await ponte.processarContas();
    // A resposta dela nem chega a ser tentada como decisão: não é de quem confere.
    expect(codigos(registros)).not.toContain("RESPOSTA_RECUSADA_PELO_DOMINIO");
    expect(codigos(registros)).toContain("RESPOSTA_SEM_EFEITO");
    const texto = TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(NOME_DO_WALTER);
    const respostas = () => comentariosDoAgente(das).filter((x) => x.content === texto);
    expect(c.decision).toBeUndefined();
    expect(respostas()).toHaveLength(1);
    expect(respostas()[0]?.parentCommentId).toBe(c.origin.threadCommentId);

    await ponte.processarContas();
    await ponte.processarContas();
    await montar(srv, estado, { avisarId: WALTER }).ponte.processarContas();
    expect(respostas()).toHaveLength(1);
    expect(c.decision).toBeUndefined();
    expect(srv.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
  });

  it("(h) CONFERENCIA_POR_COMENTARIO=false: o Resumo não pede \"ok\"; o \"ok\" recebe okPeloFioDesligado, uma vez; o ajuste pelo fio continua aberto", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    srv.enfileirar(RESOLVIDA);
    const { ponte } = montar(srv, estado, { decisoes: { conferenciaPorComentario: false } });
    await ponte.processarContas();
    const c = vigente(estado, das);
    const resumo = das.comments.find((x) => x.id === c.origin.resumoCommentId)?.content ?? "";
    expect(resumo).not.toContain('responda "ok"');
    expect(c.origin.aprovacaoPeloFio).toBe(false);

    responder(estado, das, MARYANE, "ok");
    await ponte.processarContas();
    await ponte.processarContas();
    expect(c.decision).toBeUndefined();
    expect(comentariosDoAgente(das).filter((x) => x.content === TEXTOS_DA_CONFERENCIA.okPeloFioDesligado)).toHaveLength(1);

    responder(estado, das, MARYANE, "troque o vencimento");
    await ponte.processarContas();
    expect(c.decision).toBe("rejeitada");
    expect(comentariosDoAgente(das).filter((x) => x.content === TEXTOS_DA_CONFERENCIA.okPeloFioDesligado)).toHaveLength(1);
  });
});
