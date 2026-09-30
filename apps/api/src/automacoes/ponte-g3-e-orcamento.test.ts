/**
 * 06-19 Task 3 — a porta G3 fechada no meio do ciclo (crm2:WR-04) e o
 * orçamento de gravações justo (crm2:WR-05).
 *
 *   - G3: a porta de teste (`avisarId`) é conferida no começo do ciclo
 *     (06-13) e, desde 06-19, DENTRO de cada gravação que avisa alguém: a
 *     publicação e a falha pelo domínio (`avisarEstrito`), e todo Comentário
 *     da ponte. O Membro de teste desativado no meio do ciclo para a ponte ali
 *     (`AVISAR_ID_INVALIDO`), sem nenhuma Menção nem aprovação cair na
 *     Maryane, e sem mencionar um Membro inativo;
 *   - orçamento: o laço começa de onde o ciclo anterior parou (cursor), a
 *     continuação espera `atrasoDaCutucadaMs`, e o Comentário pendente que
 *     falha sempre é desistido depois de `TENTATIVAS_TRANSITORIAS` tentativas.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real.
 */

import { afterEach, describe, expect, it } from "vitest";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { CP, erpMissingFields, movidaDepoisDaImportacao, publicarResumoParaConferencia } from "@n1/dominio/operations/financeiro";
import type { DataState, Member, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  ATOR,
  F,
  LANCAR,
  MARYANE,
  RESOLVIDA,
  S,
  buildSeed,
  comentariosDoAgente,
  conta,
  dePara200,
  definir,
  erro422,
  executarEmMemoria,
  isolar,
  mover,
  ponteSobre,
  resumosDe,
} from "../testes/fixtures-da-ponte";
import { TENTATIVAS_TRANSITORIAS, textoDoDadoFaltando, type OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const WALTER = "mem_walter";
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ate(condicao: () => boolean, prazoMs = 2_000): Promise<void> {
  const fim = Date.now() + prazoMs;
  while (!condicao() && Date.now() < fim) await esperar(10);
}

function walterDe(estado: DataState): Member {
  const w = estado.members.find((m) => m.id === WALTER);
  if (!w) throw new Error("sem mem_walter");
  return w;
}

const mencionaAMaryane = (t: Task) => t.comments.some((c) => c.mentions.some((m) => m.id === MARYANE));
const AVISO_GENERICO = "Não consegui gravar o Comentário do Agente; tento de novo no próximo ciclo.";

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

const portaFechada = (registros: readonly Registro[]) => registros.filter((r) => r.nivel === "warn" && r.dados?.code === "AVISAR_ID_INVALIDO");

describe("crm2:WR-04 — G3 fechado no meio do ciclo", () => {
  it("(a) mem_walter desativado depois da primeira gravação: a segunda conta não ganha Resumo; nada cai na Maryane; o ciclo para ali (a terceira nem é lida), e o seguinte para no começo", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const trafego = conta(estado, "tsk_cp_trafego");
    trafego.statusId = S.paraPagar;
    definir(trafego, F.categoria, "Impostos");
    // Uma terceira conta completa: os mesmos Campos, vencimento e Tags da `das`.
    const energia = conta(estado, "tsk_cp_energia");
    energia.statusId = S.paraPagar;
    energia.fieldValues = structuredClone(das.fieldValues);
    energia.tagIds = [...das.tagIds];
    if (das.dueDate) energia.dueDate = das.dueDate;
    expect(erpMissingFields(estado, energia)).toEqual([]);
    for (let n = 0; n < 3; n += 1) servidor.enfileirar(RESOLVIDA);
    let gravacoes = 0;
    const emMemoria = executarEmMemoria(estado);
    const { ponte, registros } = montar(estado, {
      modo: "conferencia",
      avisarId: WALTER,
      executarOperacao: async (op) => {
        gravacoes += 1;
        const r = await emMemoria(op);
        if (gravacoes === 1) walterDe(estado).state = "removido";
        return r;
      },
    });

    await ponte.processarContas();
    const tres = [das, trafego, energia];
    expect(tres.reduce((n, t) => n + resumosDe(t).length, 0)).toBe(1);
    for (const t of tres) expect(mencionaAMaryane(t)).toBe(false);
    const ids = tres.map((t) => t.id);
    const aprovadores = estado.approvals.filter((a) => a.origin?.kind === "processTask" && ids.includes((a.origin as { taskId: string }).taskId)).map((a) => a.approverMemberId);
    expect(aprovadores).toEqual([WALTER]);
    expect(portaFechada(registros)).toHaveLength(1);
    // A recusa foi a última gravação do ciclo, e a conta seguinte nem pediu o de-para.
    expect(gravacoes).toBe(2);
    expect(servidor.recebidas).toHaveLength(2);

    const antes = registros.length;
    await ponte.processarContas();
    expect(gravacoes).toBe(2);
    expect(portaFechada(registros.slice(antes))).toHaveLength(1);
  });

  it("(b) lancar: mem_walter desativado durante o /lancar 422 — a falha é recusada (estrita), o aviso de reserva não sai, nenhuma Menção à Maryane, um /lancar", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara, avisarId: WALTER });
    if (!p.ok) throw new Error(p.error);
    expect(p.value.conferencia.approverMemberId).toBe(WALTER);
    const d = decideProcessApproval(estado, WALTER, p.value.conferencia.id, "aprovada", { source: "click" });
    if (!d.ok) throw new Error(d.error);
    mover(estado, das.id, S.emLancamento);
    const comentariosAntes = das.comments.length;

    servidor.enfileirar({ kind: "atraso", ms: 300, status: 422, corpo: erro422("OMIE_RECUSOU", "Fornecedor bloqueado no Omie.").corpo });
    const { ponte, registros } = montar(estado, { avisarId: WALTER });
    const emVoo = ponte.processarContas();
    for (let espera = 0; servidor.recebidas.length < 1 && espera < 200; espera += 1) await esperar(10);
    walterDe(estado).state = "removido";
    await emVoo;

    expect(servidor.recebidas.filter((r) => r.caminho === LANCAR)).toHaveLength(1);
    expect(das.statusId).toBe(S.emLancamento);
    expect(das.comments.length).toBe(comentariosAntes);
    expect(mencionaAMaryane(das)).toBe(false);
    expect(estado.activity.some((a) => a.objectId === das.id && a.action === "Lançamento no Omie falhou")).toBe(false);
    expect(portaFechada(registros).length).toBeGreaterThanOrEqual(1);
  }, 10_000);

  it("(c) Comentário com o Membro de G3 inativo: recusado na operação e guardado; com ele ativo de novo, o ciclo seguinte grava o aviso com Menção a ele", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    das.statusId = S.emLancamento;
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.centroDeCusto);
    const faltando = erpMissingFields(estado, das);
    expect(faltando.length).toBeGreaterThan(0);
    const emMemoria = executarEmMemoria(estado);
    let primeira = true;
    const { ponte, registros } = montar(estado, {
      avisarId: WALTER,
      executarOperacao: async (op) => {
        if (primeira) walterDe(estado).state = "removido";
        primeira = false;
        return emMemoria(op);
      },
    });

    await ponte.processarContas();
    expect(comentariosDoAgente(das)).toHaveLength(0);
    expect(mencionaAMaryane(das)).toBe(false);
    expect(portaFechada(registros)).toHaveLength(1);
    expect(registros.some((r) => r.mensagem === AVISO_GENERICO)).toBe(false);

    walterDe(estado).state = "ativo";
    await ponte.processarContas();
    const avisos = comentariosDoAgente(das);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.content).toBe(textoDoDadoFaltando(faltando));
    expect(avisos[0]?.mentions).toEqual([{ type: "member", id: WALTER }]);
  });
});

/**
 * Três contas em "em lançamento omie" sem Centro de Custo (pedem o aviso de
 * dado faltando), com o Agente PAUSADO: todo Comentário do Agente falha
 * ("O Agente autor precisa existir e estar ativo").
 */
function tresQueFalhamSempre(estado: DataState): Task[] {
  isolar(estado, "tsk_cp_das");
  const contas = ["tsk_cp_das", "tsk_cp_trafego", "tsk_cp_energia"].map((id) => conta(estado, id));
  for (const t of contas) {
    t.statusId = S.emLancamento;
    // Sem Centro de Custo (o aviso de dado faltando) e sem "Integração manual" (o Agente encosta).
    t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== F.centroDeCusto && v.definitionId !== F.integracaoManual);
    if (erpMissingFields(estado, t).length === 0) throw new Error(`pré-condição: ${t.id} deveria ter Campo faltando`);
    if (!movidaDepoisDaImportacao(estado, t)) throw new Error(`pré-condição: ${t.id} não deveria ser importada parada`);
  }
  const agente = estado.agents.find((a) => a.id === CP.agentId);
  if (!agente) throw new Error("sem Agente");
  agente.lifecycle = "pausado";
  return contas;
}

/**
 * A hidratação com um macrotask no meio: se a ponte voltar a girar sem espera
 * (o laço quente de crm2:WR-05), os relógios do teste continuam andando e o
 * caso FALHA em vez de travar o processo num laço de microtasks.
 */
const hidratarCedendo = (estado: DataState, contar: () => void = () => undefined) => async () => {
  contar();
  await esperar(1);
  return estado;
};

const avisosDe = (registros: readonly Registro[], taskId: string) => registros.filter((r) => r.mensagem === AVISO_GENERICO && r.dados?.taskId === taskId);
const orcamentos = (registros: readonly Registro[]) => registros.filter((r) => r.dados?.code === "ORCAMENTO_DO_CICLO_ESGOTADO");

describe("crm2:WR-05 — o orçamento justo", () => {
  it("(d) fome: com maximoDeGravacoesPorCiclo 2, nos dois primeiros ciclos as TRÊS contas têm ao menos uma tentativa", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const contas = tresQueFalhamSempre(estado);
    const { ponte, registros } = montar(estado, { maximoDeGravacoesPorCiclo: 2, atrasoDaCutucadaMs: 30, intervaloMs: 60_000, hidratarEstado: hidratarCedendo(estado) });

    await ponte.processarContas();
    expect(orcamentos(registros)).toHaveLength(1);
    // O segundo ciclo: a continuação agendada (ou este, se ela ainda não rodou).
    await ate(() => orcamentos(registros).length >= 2 || contas.every((t) => avisosDe(registros, t.id).length > 0));
    for (const t of contas) expect(avisosDe(registros, t.id).length, t.id).toBeGreaterThanOrEqual(1);
  });

  it("(e) laço quente: depois de um ciclo que esgota o orçamento, nenhuma hidratação antes de atrasoDaCutucadaMs", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    tresQueFalhamSempre(estado);
    let hidratacoes = 0;
    const { ponte, registros } = montar(estado, {
      maximoDeGravacoesPorCiclo: 2,
      atrasoDaCutucadaMs: 200,
      intervaloMs: 60_000,
      hidratarEstado: hidratarCedendo(estado, () => {
        hidratacoes += 1;
      }),
    });
    await ponte.processarContas();
    expect(orcamentos(registros)).toHaveLength(1);
    const depoisDoPrimeiro = hidratacoes;
    await esperar(100);
    expect(hidratacoes).toBe(depoisDoPrimeiro);
    await ate(() => hidratacoes > depoisDoPrimeiro, 600);
    expect(hidratacoes).toBe(depoisDoPrimeiro + 1);
  });

  it("(f) desistência: no máximo TENTATIVAS_TRANSITORIAS tentativas por conta, UM COMENTARIO_PENDENTE_DESISTIDO cada; depois, nenhuma gravação e nenhum orçamento esgotado", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const contas = tresQueFalhamSempre(estado);
    let gravacoes = 0;
    const emMemoria = executarEmMemoria(estado);
    const { ponte, registros } = montar(estado, {
      maximoDeGravacoesPorCiclo: 2,
      atrasoDaCutucadaMs: 60_000,
      intervaloMs: 60_000,
      hidratarEstado: hidratarCedendo(estado),
      executarOperacao: async (op) => {
        gravacoes += 1;
        return emMemoria(op);
      },
    });
    const desistidos = (taskId: string) => registros.filter((r) => r.nivel === "info" && r.dados?.code === "COMENTARIO_PENDENTE_DESISTIDO" && r.dados?.taskId === taskId);

    for (let n = 0; n < 12 && !contas.every((t) => desistidos(t.id).length > 0); n += 1) await ponte.processarContas();
    for (const t of contas) {
      expect(avisosDe(registros, t.id), t.id).toHaveLength(TENTATIVAS_TRANSITORIAS);
      expect(desistidos(t.id), t.id).toHaveLength(1);
    }
    expect(gravacoes).toBe(contas.length * TENTATIVAS_TRANSITORIAS);

    const orcamentosAntes = orcamentos(registros).length;
    for (let n = 0; n < 3; n += 1) await ponte.processarContas();
    expect(gravacoes).toBe(contas.length * TENTATIVAS_TRANSITORIAS);
    expect(orcamentos(registros)).toHaveLength(orcamentosAntes);
    for (const t of contas) expect(desistidos(t.id)).toHaveLength(1);
  });
});
