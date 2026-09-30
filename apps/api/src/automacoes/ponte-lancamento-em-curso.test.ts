/**
 * 06-19 Task 2 — a ponte fecha a janela de dupla emissão DURANTE o `/lancar`
 * (crm2:WR-01) e não sobe a revisão do Espaço à toa (crm2:IN-02).
 *
 *   - antes de cada `/lancar`, uma gravação que pergunta de novo, sobre o
 *     estado DA GRAVAÇÃO, se a conta ainda pode ser lançada (a impressão do
 *     corpo e `motivoParaNaoLancar`) e só então grava a marca "Lançamento no
 *     Omie em curso" (`marcarLancamentoEmCurso`). Enquanto ela vale, a
 *     Maryane não move a conta nem registra o lançamento à mão;
 *   - a marca sai em todo desfecho: o registro, a falha permanente, e
 *     "Lançamento no Omie interrompido" (com o código) na transitória, no
 *     título não confirmado, na saída antes do registro; no conflito ainda em
 *     repetição ela FICA até a repetição registrar;
 *   - os ramos que não mudam nada devolvem `SEM_EFEITO` (a Unidade de
 *     Trabalho desfaz sem subir a revisão), com os mesmos logs e Comentários.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real: `servidorFalso` e a
 * Unidade de Trabalho em memória.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  PRAZO_DO_LANCAMENTO_EM_CURSO_MS,
  RECUSA_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_INTERROMPIDO,
  lancamentoEmCursoDe,
  textoDoLancamentoHumano,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
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
  dePara200,
  definir,
  erro422,
  erro503,
  executarEmMemoria,
  isolar,
  mover,
  ponteSobre,
  resumosDe,
} from "../testes/fixtures-da-ponte";
import { SEM_EFEITO, TEXTO_LANCAMENTO_NAO_CONFIRMADO, TEXTO_SAIU_ANTES_DO_REGISTRO, TIMEOUT_LANCAR_MS, type OpcoesDaPonte } from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };
type Resultado = { readonly ok: boolean; readonly error?: string; readonly conflito?: boolean };

const HUMANO = textoDoLancamentoHumano({ conta: "TRIA COMPANY - ITAU", categoria: "Impostos e taxas", codigo: "2.06.01" });

const registrosDa = (estado: DataState, t: Task, acao: string) =>
  estado.activity.filter((a) => a.objectType === "task" && a.objectId === t.id && a.action === acao);

async function esperarRequisicao(servidor: ServidorFalso, n = 1): Promise<void> {
  for (let espera = 0; servidor.recebidas.length < n && espera < 200; espera += 1) await new Promise((r) => setTimeout(r, 10));
}

describe("a marca de lançamento em curso — servidorFalso, sem DATABASE_URL", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  const lancamentos = () => servidor.recebidas.filter((r) => r.caminho === LANCAR);

  /**
   * `das` conferida em "em lançamento omie"; a ponte lê uma cópia do
   * `estado` do teste e grava nele. `antesDaMarca` roda uma vez, logo antes
   * da PRIMEIRA gravação (a da marca); `falhar(n)` pode trocar o resultado da
   * gravação `n` (1, 2, …); `resultados` guarda o que cada gravação devolveu.
   */
  async function montar(
    extra: Partial<OpcoesDaPonte> = {},
    antesDaMarca?: (e: DataState) => void,
    falhar?: (n: number) => Resultado | undefined,
  ) {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const registros: Registro[] = [];
    const resultados: Resultado[] = [];
    const emMemoria = executarEmMemoria(estado);
    let pendente = antesDaMarca;
    let gravacoes = 0;
    const ponte = ponteSobre(servidor, estado, {
      hidratarEstado: async () => structuredClone(estado),
      executarOperacao: async (op) => {
        gravacoes += 1;
        const antes = pendente;
        pendente = undefined;
        antes?.(estado);
        const trocado = falhar?.(gravacoes);
        const r = trocado ? (trocado.conflito ? { ok: false as const, error: trocado.error ?? "conflito", conflito: true } : { ok: false as const, error: trocado.error ?? "recusado" }) : await emMemoria(op);
        resultados.push(r);
        return r;
      },
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      ...extra,
    });
    return { estado, das: () => estado.tasks.find((t) => t.id === das.id)!, ponte, registros, resultados };
  }

  it("(a) a requisição parada no meio: a Maryane não move nem registra à mão; depois do 200, lançada e sem marca", async () => {
    const { estado, das, ponte, registros } = await montar();
    servidor.enfileirar({ kind: "atraso", ms: 300, status: 200, corpo: LANCADO_200.corpo });
    const emVoo = ponte.processarContas();
    await esperarRequisicao(servidor);
    expect(lancamentos()).toHaveLength(1);

    const emCurso = lancamentoEmCursoDe(estado, das());
    expect(emCurso?.porMembroId).toBe("mem_thiago");
    const movida = changeTaskStatus(estado, MARYANE, das().id, S.paraPagar);
    expect(movida.ok).toBe(false);
    if (!movida.ok) expect(movida.error).toBe(RECUSA_LANCAMENTO_EM_CURSO);
    const humano = addTaskComment(estado, MARYANE, das().id, { content: HUMANO });
    expect(humano.ok).toBe(false);
    if (!humano.ok) expect(humano.error).toBe(RECUSA_LANCAMENTO_EM_CURSO);

    await emVoo;
    expect(das().statusId).toBe(S.lancado);
    expect(comentariosDoAgente(das()).some((c) => c.content.startsWith("✅ Lançado no Omie"))).toBe(true);
    expect(lancamentoEmCursoDe(estado, das())).toBeUndefined();
    expect(lancamentos()).toHaveLength(1);
    expect(comentariosDoAgente(das()).some((c) => c.content === TEXTO_SAIU_ANTES_DO_REGISTRO)).toBe(false);
    expect(registros.some((r) => r.dados?.code === "MARCA_NAO_ENCERRADA")).toBe(false);
  }, 10_000);

  describe("(b) a reconferência NA gravação da marca", () => {
    it.each([
      ["(b1) lançamento humano pelo diálogo", "LANCAMENTO_HUMANO", (e: DataState) => {
        const r = addTaskComment(e, MARYANE, "tsk_cp_das", { content: HUMANO });
        if (!r.ok) throw new Error(r.error);
      }],
      ["(b2) a Maryane volta a conta para \"para pagar\"", "SAIU_DE_EM_LANCAMENTO", (e: DataState) => mover(e, "tsk_cp_das", S.paraPagar)],
      ["(b3) outro Valor", "IMPRESSAO_MUDOU", (e: DataState) => definir(e.tasks.find((t) => t.id === "tsk_cp_das")!, F.valor, "98765")],
    ] as const)("%s: zero /lancar, nenhuma marca, \"Lançamento adiado\" com o código, e a gravação devolveu SEM_EFEITO", async (_nome, code, mudar) => {
      const { estado, das, ponte, registros, resultados } = await montar({}, mudar);
      await ponte.processarContas();
      expect(lancamentos()).toHaveLength(0);
      expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_EM_CURSO)).toHaveLength(0);
      const adiado = registros.find((r) => r.mensagem.startsWith("Lançamento adiado"));
      expect(adiado?.nivel).toBe("info");
      expect(adiado?.dados?.code).toBe(code);
      expect(resultados[0]).toEqual({ ok: false, error: SEM_EFEITO });
    });
  });

  it("(c) 503: um \"em curso\" e um \"interrompido\" com OMIE_INDISPONIVEL; a conta fica e a Maryane a move", async () => {
    const { estado, das, ponte } = await montar();
    servidor.enfileirar(erro503());
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(1);
    expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_EM_CURSO)).toHaveLength(1);
    const interrompidos = registrosDa(estado, das(), REGISTRO_LANCAMENTO_INTERROMPIDO);
    expect(interrompidos).toHaveLength(1);
    expect(interrompidos[0]?.detail).toBe("OMIE_INDISPONIVEL");
    expect(lancamentoEmCursoDe(estado, das())).toBeUndefined();
    expect(das().statusId).toBe(S.emLancamento);
    const m = changeTaskStatus(estado, MARYANE, das().id, S.paraPagar);
    expect(m.ok, m.ok ? "" : m.error).toBe(true);
  });

  it("(d) 422 permanente: \"para pagar\" pelo Membro de serviço, \"falhou\" encerra, nenhum \"interrompido\"", async () => {
    const { estado, das, ponte } = await montar();
    servidor.enfileirar(erro422("CATEGORIA_INVALIDA", "a categoria não existe no Omie"));
    await ponte.processarContas();
    expect(das().statusId).toBe(S.paraPagar);
    expect(registrosDa(estado, das(), "Lançamento no Omie falhou")).toHaveLength(1);
    expect(lancamentoEmCursoDe(estado, das())).toBeUndefined();
    expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_INTERROMPIDO)).toHaveLength(0);
  });

  it("(e) payableId mock-: \"interrompido\" com LANCAMENTO_NAO_CONFIRMADO e o aviso no fio", async () => {
    const { estado, das, ponte } = await montar();
    servidor.enfileirar({ kind: "ok", status: 200, corpo: { payableId: "mock-payable-1730000000000", reaproveitado: false, anexos: [] } });
    await ponte.processarContas();
    const interrompidos = registrosDa(estado, das(), REGISTRO_LANCAMENTO_INTERROMPIDO);
    expect(interrompidos.map((a) => a.detail)).toEqual(["LANCAMENTO_NAO_CONFIRMADO"]);
    expect(comentariosDoAgente(das()).some((c) => c.content === TEXTO_LANCAMENTO_NAO_CONFIRMADO)).toBe(true);
    expect(lancamentoEmCursoDe(estado, das())).toBeUndefined();
  });

  it("(f) o registro em conflito uma vez: a marca FICA; o ciclo seguinte renova, repete o /lancar com a mesma chave e registra", async () => {
    // A primeira gravação é a marca; a segunda, o registro — em conflito.
    const { estado, das, ponte: ponteComConflito } = await montar({}, undefined, (n) => (n === 2 ? { ok: false, error: "conflito", conflito: true } : undefined));
    servidor.enfileirar(LANCADO_200);
    servidor.enfileirar({ ...LANCADO_200, corpo: { ...LANCADO_200.corpo, reaproveitado: true, dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara } });

    await ponteComConflito.processarContas();
    expect(das().statusId).toBe(S.emLancamento);
    expect(lancamentoEmCursoDe(estado, das())?.porMembroId).toBe("mem_thiago");
    expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_INTERROMPIDO)).toHaveLength(0);

    await ponteComConflito.processarContas();
    expect(lancamentos()).toHaveLength(2);
    expect(lancamentos()[0]?.cabecalhos["idempotency-key"]).toBe(lancamentos()[1]?.cabecalhos["idempotency-key"]);
    expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_EM_CURSO)).toHaveLength(2);
    expect(das().statusId).toBe(S.lancado);
    expect(lancamentoEmCursoDe(estado, das())).toBeUndefined();
  });

  describe("(g) crm2:IN-02 — os ramos sem mudança devolvem SEM_EFEITO", () => {
    it("Resumo adiado (a Categoria muda entre a leitura e a gravação): SEM_EFEITO, e RESUMO_ADIADO no log", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      isolar(estado, "tsk_cp_das");
      const registros: Registro[] = [];
      const resultados: Resultado[] = [];
      const emMemoria = executarEmMemoria(estado);
      let antes: ((e: DataState) => void) | undefined = (e) => definir(e.tasks.find((t) => t.id === "tsk_cp_das")!, F.categoria, "Tráfego Pago");
      const ponte = ponteSobre(servidor, estado, {
        modo: "conferencia",
        hidratarEstado: async () => structuredClone(estado),
        executarOperacao: async (op) => {
          antes?.(estado);
          antes = undefined;
          const r = await emMemoria(op);
          resultados.push(r);
          return r;
        },
        registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      });
      servidor.enfileirar(RESOLVIDA);
      await ponte.processarContas();
      expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
      expect(resultados).toEqual([{ ok: false, error: SEM_EFEITO }]);
      expect(registros.some((r) => r.nivel === "info" && r.dados?.code === "RESUMO_ADIADO")).toBe(true);
      const das = estado.tasks.find((t) => t.id === "tsk_cp_das")!;
      expect(resumosDe(das)).toHaveLength(0);
      expect(registros.some((r) => r.dados?.code === "RESUMO_RECUSADO_PELO_DOMINIO")).toBe(false);
    });

    it("saída antes do registro (o Status trocado por fora do domínio no meio do /lancar): SEM_EFEITO, o Comentário de sempre e a marca encerrada", async () => {
      servidor = await criarServidorFalso();
      const estado = buildSeed();
      const das = conferidaEmLancamento(estado);
      const resultados: Resultado[] = [];
      const emMemoria = executarEmMemoria(estado);
      const ponte = ponteSobre(servidor, estado, {
        executarOperacao: async (op) => {
          const r = await emMemoria(op);
          resultados.push(r);
          return r;
        },
      });
      servidor.enfileirar({ kind: "atraso", ms: 300, status: 200, corpo: LANCADO_200.corpo });
      const emVoo = ponte.processarContas();
      await esperarRequisicao(servidor);
      das.statusId = S.paraPagar;
      await emVoo;

      expect(resultados[1]).toEqual({ ok: false, error: SEM_EFEITO });
      expect(comentariosDoAgente(das).some((c) => c.content === TEXTO_SAIU_ANTES_DO_REGISTRO)).toBe(true);
      expect(registrosDa(estado, das, REGISTRO_LANCAMENTO_INTERROMPIDO).map((a) => a.detail)).toEqual(["SAIU_ANTES_DO_REGISTRO"]);
      expect(lancamentoEmCursoDe(estado, das)).toBeUndefined();
    }, 10_000);
  });

  it.each(["ensaio", "conferencia"] as const)("(h) modo %s com a conta conferida em \"em lançamento omie\": nenhuma marca em dois ciclos", async (modo) => {
    const { estado, das, ponte } = await montar({ modo });
    await ponte.processarContas();
    await ponte.processarContas();
    expect(registrosDa(estado, das(), REGISTRO_LANCAMENTO_EM_CURSO)).toHaveLength(0);
    expect(lancamentos()).toHaveLength(0);
  });
});

describe("(i) o prazo", () => {
  it("a marca cobre com folga o /lancar", () => {
    expect(PRAZO_DO_LANCAMENTO_EM_CURSO_MS).toBeGreaterThanOrEqual(2 * TIMEOUT_LANCAR_MS);
  });
});
