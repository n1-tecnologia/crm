/**
 * 06-21 Task 2 — crm2:WR-05 residual (06-REVIEW-3, "WR-01" no relatório):
 * `lerRespostas` só registra `RESPOSTA_SEM_EFEITO` ("a ponte respondeu por
 * quê") quando o Comentário foi DE FATO gravado. Antes, `comentar()` falhando
 * ainda assim disparava o log e limpava o pendente — a ponte "respondia" sem
 * responder, para sempre, gastando orçamento por tempo indeterminado.
 *
 * Depois de `TENTATIVAS_TRANSITORIAS` falhas SEGUIDAS para a MESMA resposta
 * (pelo id do Comentário, `respostaSemEfeitoNoFio`), a ponte para de tentar
 * RESPONDER A ELA — nunca a conta inteira: `estado.parada` não é tocado por
 * esta correção (ver a Nota de desenho do plano 06-21, Task 2). Uma resposta
 * nova (outro id) ou uma decisão de verdade no mesmo fio continuam sendo
 * lidas e processadas normalmente, no mesmo ciclo ou nos seguintes.
 *
 * (f) cobre o Informativo IN-01 (o cursor rotativo também grava quando é a
 * porta G3 que fecha o ciclo, não só o orçamento).
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real (`servidorFalso`).
 */

import { afterEach, describe, expect, it } from "vitest";
import { CP, TEXTOS_DA_CONFERENCIA, erpMissingFields } from "@n1/dominio/operations/financeiro";
import type { DataState, Member, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  F,
  MARYANE,
  RESOLVIDA,
  S,
  buildSeed,
  comentariosDoAgente,
  conta,
  definir,
  executarEmMemoria,
  isolar,
  ponteSobre,
  responder,
  resumosDe,
  vigente,
} from "../testes/fixtures-da-ponte";
import { TENTATIVAS_TRANSITORIAS, type OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const WALTER = "mem_walter";
const NOME_DO_WALTER = "Walter Galvão Neto";

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

function walterDe(estado: DataState): Member {
  const w = estado.members.find((m) => m.id === WALTER);
  if (!w) throw new Error("sem mem_walter");
  return w;
}

function agenteDe(estado: DataState) {
  const a = estado.agents.find((x) => x.id === CP.agentId);
  if (!a) throw new Error("sem Agente");
  return a;
}

const pausarAgente = (estado: DataState): void => {
  agenteDe(estado).lifecycle = "pausado";
};
const reativarAgente = (estado: DataState): void => {
  agenteDe(estado).lifecycle = "ativo";
};

/** G3 com avisarId: WALTER — publica o Resumo (WALTER aprovador) e faz a Maryane responder "ok" (não confere). */
async function publicarEResponder(srv: ServidorFalso, estado: DataState, das: Task, texto = "ok") {
  srv.enfileirar(RESOLVIDA);
  const { ponte, registros } = montar(srv, estado, { avisarId: WALTER });
  await ponte.processarContas();
  const c = vigente(estado, das);
  responder(estado, das, MARYANE, texto);
  return { ponte, registros, c };
}

describe("crm2:WR-05 residual (06-REVIEW-3 WR-01) — RESPOSTA_SEM_EFEITO só quando o Comentário foi gravado", () => {
  it("(a) comentar() falha nos primeiros TENTATIVAS_TRANSITORIAS ciclos: nenhum RESPOSTA_SEM_EFEITO, nenhum Comentário novo do Agente", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros, c } = await publicarEResponder(srv, estado, das);
    pausarAgente(estado);
    const texto = TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(NOME_DO_WALTER);
    const respostas = () => comentariosDoAgente(das).filter((x) => x.content === texto);

    for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) {
      await ponte.processarContas();
      expect(registros.some((r) => r.dados?.code === "RESPOSTA_SEM_EFEITO"), `ciclo ${n + 1}`).toBe(false);
      expect(respostas(), `ciclo ${n + 1}`).toHaveLength(0);
    }
    expect(registros.some((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO")).toBe(false);
    expect(c.decision).toBeUndefined();
  });

  it("(b) na tentativa TENTATIVAS_TRANSITORIAS+1, a ponte desiste SÓ desta resposta: log honesto, sem gravação nova, sem parar a conta", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros, c } = await publicarEResponder(srv, estado, das);
    pausarAgente(estado);
    for (let n = 0; n < TENTATIVAS_TRANSITORIAS; n += 1) await ponte.processarContas();

    const comentariosAntes = das.comments.length;
    const antes = registros.length;
    await ponte.processarContas();
    const novos = registros.slice(antes);
    const desistido = novos.find((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO");
    expect(desistido?.nivel).toBe("info");
    expect(desistido?.mensagem).not.toMatch(/respondeu por qu/);
    expect(novos.some((r) => r.dados?.code === "RESPOSTA_SEM_EFEITO")).toBe(false);
    expect(das.comments.length).toBe(comentariosAntes);

    // A conta continua sendo processada nos ciclos seguintes — não pulada por
    // `if (estado.parada) continue`: rodar mais um ciclo não produz um SEGUNDO
    // SEM_EFEITO_DESISTIDO (a desistência já aconteceu; a conta segue, só
    // ignorando essa resposta específica).
    const antes2 = registros.length;
    await ponte.processarContas();
    expect(registros.slice(antes2).some((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO")).toBe(false);
    expect(registros.filter((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO")).toHaveLength(1);
    expect(c.decision).toBeUndefined();
  });

  it('(c) se comentar() volta a funcionar antes do threshold, RESPOSTA_SEM_EFEITO sai UMA vez, com exatamente 1 Comentário novo', async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros, c } = await publicarEResponder(srv, estado, das);
    pausarAgente(estado);
    await ponte.processarContas(); // falha 1
    await ponte.processarContas(); // falha 2 (< TENTATIVAS_TRANSITORIAS)
    reativarAgente(estado);

    const texto = TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(NOME_DO_WALTER);
    const antes = registros.length;
    await ponte.processarContas();
    const novos = registros.slice(antes);
    expect(novos.filter((r) => r.dados?.code === "RESPOSTA_SEM_EFEITO")).toHaveLength(1);
    expect(comentariosDoAgente(das).filter((x) => x.content === texto)).toHaveLength(1);

    // Mais um ciclo não duplica a resposta: o fio é a memória.
    await ponte.processarContas();
    expect(comentariosDoAgente(das).filter((x) => x.content === texto)).toHaveLength(1);
    expect(c.decision).toBeUndefined();
  });

  it("(d) depois de desistir de r1, uma resposta nova (r2) ganha orçamento PRÓPRIO; uma decisão de verdade no mesmo ciclo é lida normalmente — a conta nunca ficou parada", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const { ponte, registros, c } = await publicarEResponder(srv, estado, das); // r1 = "ok" da Maryane
    pausarAgente(estado);
    for (let n = 0; n < TENTATIVAS_TRANSITORIAS + 1; n += 1) await ponte.processarContas();
    const desistidos = () => registros.filter((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO");
    expect(desistidos()).toHaveLength(1);

    // r2: outro "ok" da Maryane (não confere), mais recente que r1; no MESMO
    // ciclo, o Walter — o aprovador de verdade desta Conferência — pede ajuste.
    responder(estado, das, MARYANE, "ok, pode lançar");
    responder(estado, das, WALTER, "ajuste: revisar o valor");
    const antes = registros.length;
    await ponte.processarContas();
    const novos = registros.slice(antes);

    // r2 ainda é TENTADA (orçamento do zero: não herda a desistência de r1).
    expect(novos.some((r) => r.dados?.code === "SEM_EFEITO_DESISTIDO")).toBe(false);
    expect(desistidos()).toHaveLength(1); // ainda só a de r1

    // A decisão de verdade é lida e processada — a conta nunca ficou parada
    // (senão `if (estado.parada) continue` teria pulado `lerRespostas` inteiro
    // e este `decision` continuaria undefined).
    expect(c.decision).toBe("rejeitada");
    expect(c.decidedByMemberId).toBe(WALTER);
    expect(c.decisionReason).toBe("ajuste: revisar o valor");
  });
});

describe("crm2:IN-01 — o cursor também é gravado quando é a porta G3 que fecha o ciclo", () => {
  it("(f) o ciclo seguinte recomeça exatamente pela conta em que a porta fechou, não da conta 1", async () => {
    const srv = await abrirServidor();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const trafego = conta(estado, "tsk_cp_trafego");
    trafego.statusId = S.paraPagar;
    definir(trafego, F.categoria, "Impostos");
    const energia = conta(estado, "tsk_cp_energia");
    energia.statusId = S.paraPagar;
    energia.fieldValues = structuredClone(das.fieldValues);
    energia.tagIds = [...das.tagIds];
    if (das.dueDate) energia.dueDate = das.dueDate;
    expect(erpMissingFields(estado, energia)).toEqual([]);

    // A ORDEM real que a ponte usa é a de `state.tasks` (não alfabética, nem a
    // da declaração acima): deriva da mesma predicate que `processarContas`
    // usa, para não supor uma ordem que o seed não garante.
    const ordem = estado.tasks.filter((t) => t.listId === CP.listId && t.lifecycle === "ativo" && (t.statusId === S.paraPagar || t.statusId === S.emLancamento));
    expect(ordem.map((t) => t.id)).toEqual(expect.arrayContaining([das.id, trafego.id, energia.id]));
    const [primeira, segunda, terceira] = ordem;
    if (!primeira || !segunda || !terceira) throw new Error("esperava 3 contas na ordem do ciclo");

    for (let n = 0; n < 4; n += 1) srv.enfileirar(RESOLVIDA);
    let gravacoes = 0;
    const emMemoria = executarEmMemoria(estado);
    const { ponte } = montar(srv, estado, {
      modo: "conferencia",
      avisarId: WALTER,
      executarOperacao: async (op) => {
        gravacoes += 1;
        const r = await emMemoria(op);
        if (gravacoes === 1) walterDe(estado).state = "removido";
        return r;
      },
    });

    // Ciclo 1: a PRIMEIRA conta da ordem recebe o Resumo (1ª gravação, WALTER
    // ainda ativo); ao tentar a SEGUNDA, a porta G3 já fechou (WALTER
    // inativo) — a falha é a 2ª gravação; a TERCEIRA nem chega a ser
    // visitada (a porta fecha ANTES dela).
    await ponte.processarContas();
    expect(resumosDe(primeira)).toHaveLength(1);
    expect(resumosDe(segunda)).toHaveLength(0);
    expect(resumosDe(terceira)).toHaveLength(0);
    expect(srv.recebidas).toHaveLength(2);

    walterDe(estado).state = "ativo";
    await ponte.processarContas();
    expect(srv.recebidas).toHaveLength(4);
    const taskIdDe = (i: number) => (srv.recebidas[i]?.corpo as { readonly taskId?: string } | undefined)?.taskId;
    // Com o cursor gravado no fechamento de G3 (IN-01), o ciclo 2 recomeça
    // pela conta em que a porta fechou (a TERCEIRA) — não da PRIMEIRA de novo.
    expect(taskIdDe(2)).toBe(terceira.id);
    expect(taskIdDe(3)).toBe(segunda.id);
    expect(resumosDe(terceira)).toHaveLength(1);
    expect(resumosDe(segunda)).toHaveLength(1);
  });
});
