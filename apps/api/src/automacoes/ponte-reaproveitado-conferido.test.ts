/**
 * 06-18 Task 2 — o título reaproveitado conferido (crm2:WR-02) e a parada do
 * aviso de reserva (crm2:IN-03).
 *
 *   (i)–(m) com `reaproveitado: true`, a ponte confere o `dePara` que o
 *           `automation/` v1.2 LEU DO TÍTULO contra a tripla da Conferência
 *           relida (conta corrente e código). Diferente ⇒ falha permanente
 *           `TITULO_EXISTENTE_DIVERGENTE` com `tituloDivergente`; ausente (um
 *           `automation/` v1.1) ⇒ `REAPROVEITADO_SEM_DE_PARA`. Nos dois, nada
 *           vira lançamento, a conta volta para "para pagar" (D6-03) e a
 *           Conferência fica. O título novo (`reaproveitado: false`) não
 *           depende do `dePara`;
 *   (n)     `textoDaRecusaPermanente` e `falhaSemVolta` (sem recusa) têm a
 *           MESMA forma: o padrão de `falhaSemVolta` restaura a parada do
 *           aviso de reserva depois de um reinício — sem novo `/lancar`, sem
 *           Comentário novo.
 *
 * A resposta de controle é o exemplo canônico
 * `contratos/contas-a-pagar-v1/lancar.sucesso-reaproveitado.json`. Arquivo
 * novo (CON-05). Sem banco e sem rede real.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { TEXTOS_DA_CONFERENCIA, conferenciaDoResumo, type CampoDivergente } from "@n1/dominio/operations/financeiro";
import type { DataState } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  LANCADO_200,
  LANCAR,
  S,
  buildSeed,
  comentariosDoAgente,
  conferidaEmLancamento,
  erro422,
  executarEmMemoria,
  ponteSobre,
} from "../testes/fixtures-da-ponte";
import {
  PADROES_DAS_PARADAS,
  motivoDoReaproveitadoSemDePara,
  textoDaRecusaPermanente,
  type OpcoesDaPonte,
} from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, "../../../../contratos/contas-a-pagar-v1");
interface CorpoReaproveitado {
  readonly payableId: string;
  readonly reaproveitado: true;
  readonly dePara: {
    readonly contaPorTag: Record<string, string>;
    readonly categoriaPorCampo: Record<string, { readonly veredito: string; readonly nome: string; readonly codigo: string; readonly similaridade?: number }>;
    readonly origem: string;
  };
  readonly anexos: unknown[];
}
const CANONICO = (JSON.parse(readFileSync(path.join(PASTA, "lancar.sucesso-reaproveitado.json"), "utf8")) as { resposta: { corpo: CorpoReaproveitado } }).resposta
  .corpo;
const PAYABLE = CANONICO.payableId;

let servidor: ServidorFalso | undefined;
afterEach(async () => {
  await servidor?.fechar();
  servidor = undefined;
});

function montar(srv: ServidorFalso, estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
  const registros: Registro[] = [];
  const ponte = ponteSobre(srv, estado, {
    registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    ...extra,
  });
  return { ponte, registros };
}

/** O corpo canônico do reaproveitado, com a conta corrente e/ou o código trocados. */
function reaproveitadoCom(troca: { readonly conta?: string; readonly codigo?: string }) {
  const categoria = CANONICO.dePara.categoriaPorCampo.Impostos;
  if (!categoria) throw new Error("o exemplo canônico mudou: sem Impostos");
  return {
    ...CANONICO,
    dePara: {
      ...CANONICO.dePara,
      contaPorTag: troca.conta ? { "conta tria": troca.conta } : CANONICO.dePara.contaPorTag,
      categoriaPorCampo: { Impostos: { ...categoria, ...(troca.codigo ? { codigo: troca.codigo } : {}) } },
    },
  };
}

const lancadoNoOmie = (estado: DataState) => comentariosDoAgente(estado.tasks.find((t) => t.id === "tsk_cp_das")!).filter((c) => c.content.startsWith("✅ Lançado no Omie"));

describe("crm2:WR-02 — o reaproveitado só vira lançamento se o título tem a conta e o código conferidos", () => {
  it("(i) o dePara do exemplo canônico confere: registra e move para \"lançado omie\"", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    servidor.enfileirar({ kind: "ok", status: 200, corpo: CANONICO });
    await montar(servidor, estado).ponte.processarContas();
    expect(das.statusId).toBe(S.lancado);
    expect(lancadoNoOmie(estado)).toHaveLength(1);
    expect(lancadoNoOmie(estado)[0]?.content).toContain("(título já existia)");
  });

  it("(j) outro código no título: nada registrado, TITULO_EXISTENTE_DIVERGENTE [categoria], \"para pagar\", a Conferência fica; o log só com code e payableId", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const conferida = conferenciaDoResumo(estado, das).conferencia;
    servidor.enfileirar({ kind: "ok", status: 200, corpo: reaproveitadoCom({ codigo: "2.04.01" }) });
    const { ponte, registros } = montar(servidor, estado);
    await ponte.processarContas();

    expect(lancadoNoOmie(estado)).toHaveLength(0);
    const avisos = comentariosDoAgente(das).filter((c) => c.content.includes("(TITULO_EXISTENTE_DIVERGENTE)"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.content).toContain(TEXTOS_DA_CONFERENCIA.tituloDivergente(PAYABLE, ["categoria"]));
    expect(das.statusId).toBe(S.paraPagar);
    expect(conferenciaDoResumo(estado, das)).toMatchObject({ estado: "conferida", conferencia: { id: conferida?.id } });
    expect(servidor.recebidas.filter((r) => r.caminho === LANCAR)).toHaveLength(1);

    const doAviso = registros.find((r) => r.nivel === "warn" && r.dados?.code === "TITULO_EXISTENTE_DIVERGENTE");
    expect(Object.keys(doAviso?.dados ?? {}).sort()).toEqual(["code", "listId", "payableId", "taskId", "workspaceId"]);
    expect(doAviso?.dados?.payableId).toBe(PAYABLE);
    const log = JSON.stringify(registros);
    expect(log).not.toContain("2.04.01");
    expect(log).not.toContain("Impostos e taxas");
    expect(log).not.toContain("TRIA COMPANY");
  });

  it.each([
    [{ conta: "TRIA COMPANY - BRADESCO" }, ["contaCorrente"]],
    [{ conta: "TRIA COMPANY - BRADESCO", codigo: "2.04.01" }, ["categoria", "contaCorrente"]],
  ] as const)("(k) título com %o: tituloDivergente com %o, nessa ordem", async (troca, campos) => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    servidor.enfileirar({ kind: "ok", status: 200, corpo: reaproveitadoCom(troca) });
    await montar(servidor, estado).ponte.processarContas();
    expect(lancadoNoOmie(estado)).toHaveLength(0);
    const texto = TEXTOS_DA_CONFERENCIA.tituloDivergente(PAYABLE, campos as readonly CampoDivergente[]);
    expect(comentariosDoAgente(das).filter((c) => c.content.includes(texto))).toHaveLength(1);
    expect(das.statusId).toBe(S.paraPagar);
  });

  it("(l) reaproveitado SEM dePara (um automation/ v1.1): nada registrado, REAPROVEITADO_SEM_DE_PARA, \"para pagar\", a Conferência fica", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const { dePara: _semDePara, ...v11 } = CANONICO;
    void _semDePara;
    servidor.enfileirar({ kind: "ok", status: 200, corpo: v11 });
    const { ponte, registros } = montar(servidor, estado);
    await ponte.processarContas();

    expect(lancadoNoOmie(estado)).toHaveLength(0);
    const avisos = comentariosDoAgente(das).filter((c) => c.content.includes("(REAPROVEITADO_SEM_DE_PARA)"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.content).toContain(motivoDoReaproveitadoSemDePara(PAYABLE));
    expect(das.statusId).toBe(S.paraPagar);
    expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
    const doAviso = registros.find((r) => r.nivel === "warn" && r.dados?.code === "REAPROVEITADO_SEM_DE_PARA");
    expect(Object.keys(doAviso?.dados ?? {}).sort()).toEqual(["code", "listId", "payableId", "taskId", "workspaceId"]);
  });

  it("(m) título novo (reaproveitado: false) sem dePara: registra como sempre", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    servidor.enfileirar(LANCADO_200);
    await montar(servidor, estado).ponte.processarContas();
    expect(das.statusId).toBe(S.lancado);
    expect(lancadoNoOmie(estado)).toHaveLength(1);
  });
});

describe("crm2:IN-03 — o aviso de reserva restaura a parada", () => {
  it("(n) casa com exatamente um padrão; é a forma de falhaSemVolta; e o reinício não chama o /lancar de novo nem comenta", async () => {
    const casam = (texto: string) => PADROES_DAS_PARADAS.filter((p) => p.test(texto)).length;
    expect(casam(textoDaRecusaPermanente("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU"))).toBe(1);
    expect(casam(textoDaRecusaPermanente(undefined, "OMIE_RECUSOU"))).toBe(1);
    for (const [motivo, code] of [
      ["Fornecedor bloqueado no Omie.", "OMIE_RECUSOU"],
      ["o título 4100000001 já existe no Omie com outros dados (valor)", "TITULO_EXISTENTE_DIVERGENTE"],
      ["falta a conta corrente", "CONTA_CORRENTE_NAO_RESOLVIDA"],
    ] as const) {
      expect(textoDaRecusaPermanente(motivo, code)).toBe(TEXTOS_DA_CONFERENCIA.falhaSemVolta(motivo, code));
    }

    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const noMemoria = executarEmMemoria(estado);
    let gravacoes = 0;
    servidor.enfileirar(erro422("OMIE_RECUSOU", "Fornecedor bloqueado no Omie."));
    const { ponte } = montar(servidor, estado, {
      executarOperacao: async (operacao) => {
        gravacoes += 1;
        // A primeira gravação do ciclo é o registro da falha: recusada.
        if (gravacoes === 1) return { ok: false, error: "recusado pelo teste" };
        return noMemoria(operacao);
      },
    });
    await ponte.processarContas();
    const reserva = textoDaRecusaPermanente("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU");
    expect(comentariosDoAgente(das).map((c) => c.content)).toContain(reserva);
    expect(das.statusId).toBe(S.emLancamento);
    const comentariosAntes = das.comments.length;

    const { ponte: b, registros } = montar(servidor, estado);
    await b.processarContas();
    expect(registros.map((r) => r.dados?.code)).toContain("PARADA_RESTAURADA");
    expect(servidor.recebidas.filter((r) => r.caminho === LANCAR)).toHaveLength(1);
    expect(das.comments).toHaveLength(comentariosAntes);
  });
});
