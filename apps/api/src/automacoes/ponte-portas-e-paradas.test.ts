/**
 * 06-13 Task 2 — as portas de teste fechadas e as paradas que valem de verdade:
 *
 *   (a)–(c) crm:WR-01 — `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` que não é Membro
 *           ativo deixa a ponte PARADA (antes, falhava aberto e mencionava o
 *           Financeiro real); e a API recusa subir com `AVISAR_ID` sem
 *           `SO_TITULOS_COM`;
 *   (d)–(f) crm:WR-02 — a chave da ponte vê TODOS os Valores de Campo
 *           ativos (arquivos e Integração manual entre eles) e os anexos;
 *   (g)–(l) crm:WR-07 — os avisos "uma vez só" sobrevivem ao reinício: o fio
 *           é a memória.
 *
 * "Reiniciar" = criar uma SEGUNDA ponte (`criarPonteDoAgente`) sobre o MESMO
 * `estado` e o mesmo servidor falso: a memória em processo começa vazia, o
 * fio não.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real.
 */

import { afterEach, describe, expect, it } from "vitest";
import { importarContaAPagarHistorica } from "@n1/dominio/operations/importacao-contas-a-pagar";
import { statusDefinition } from "@n1/dominio/derive";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  conferenciaDoResumo,
  erpMissingFields,
  publicarResumoParaConferencia,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment, setTaskFieldValue } from "@n1/dominio/operations/tasks";
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
  arquivo,
  buildSeed,
  comentariosDoAgente,
  conferidaEmLancamento,
  conta,
  dePara200,
  definir,
  erro422,
  isolar,
  mover,
  ponteSobre,
  prepararEmLancamento,
  responder,
  resumosDe,
  sairEVoltar,
} from "../testes/fixtures-da-ponte";
import {
  PADROES_DAS_PARADAS,
  TEXTO_LANCAMENTO_NAO_CONFIRMADO,
  TEXTO_NASCEU_EM_LANCAMENTO,
  TEXTO_SEM_CENTRO_DE_CUSTO,
  TEXTO_SEM_CODIGO_CONFERIDO,
  TEXTO_VALOR_INVALIDO,
  chaveDaPonte,
  recusaDasPortasDeTeste,
  textoDaRecusaDoResumo,
  textoDasTransitorias,
  textoDoDadoFaltando,
  textoDoRegistroEmConflito,
  textoDoRegistroRecusado,
  textoDosAnexosAcimaDoLimite,
  type OpcoesDaPonte,
} from "./invocar-agente";

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

let servidor: ServidorFalso;
let jaFechado: ServidorFalso | undefined;
afterEach(async () => {
  // Os casos puros não abrem servidor: fecha só o que este caso abriu.
  if (servidor && servidor !== jaFechado) await servidor.fechar();
  jaFechado = servidor;
});

function montar(estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
  const registros: Registro[] = [];
  const ponte = ponteSobre(servidor, estado, {
    registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    ...extra,
  });
  return { ponte, registros };
}

const codigos = (registros: readonly Registro[]) => registros.map((r) => r.dados?.code).filter((c) => c !== undefined);
const aprovacoesDa = (estado: DataState, t: Task) =>
  estado.approvals.filter((a) => a.origin.kind === "processTask" && a.origin.taskId === t.id);

function campo(estado: DataState, t: Task, definitionId: string, valor: string | null): void {
  const r = setTaskFieldValue(estado, MARYANE, t.id, definitionId, valor);
  if (!r.ok) throw new Error(r.error);
}

/**
 * Liga um Arquivo já confirmado a um Campo de arquivo, como o envio ao
 * Storage faz (`anexarArquivoEnviado`): o id nunca entra por
 * `setTaskFieldValue` em texto (revisão de código do 7.3).
 */
function ligarArquivo(t: Task, definitionId: string, fileId: string): void {
  const existente = t.fieldValues.find((v) => v.definitionId === definitionId);
  if (existente) existente.value = [fileId];
  else t.fieldValues.push({ definitionId, value: [fileId], state: "ativo" });
}

/** Uma conta importada do ClickUp já em "em lançamento omie" — cópia de `importarNoStatus` de `invocar-agente.test.ts`. */
function importarEmLancamento(estado: DataState): Task {
  const r = importarContaAPagarHistorica(estado, MARYANE, {
    legacyTaskId: "868legado7",
    titulo: "Conta importada do ClickUp",
    statusFinalId: S.emLancamento,
    criadaEm: "2026-08-01T12:00:00.000Z",
    vencimento: { form: "civilDay", value: "2026-10-10" },
    transicoes: [
      { em: "2026-08-01T12:00:00.000Z", statusId: S.paraPagar, nomeLegado: "para pagar" },
      { em: "2026-08-20T12:00:00.000Z", statusId: S.emLancamento, nomeLegado: "em lançamento omie" },
    ],
    campos: {
      [F.centroDeCusto]: "TRIA",
      [F.categoria]: "Impostos",
      [F.valor]: 10,
      [F.forma]: "Chave Pix",
      [F.chavePix]: "financeiro@exemplo.com.br",
      [F.fornecedor]: "CNPJ",
      [F.cnpj]: "11.222.333/0001-81",
      [F.nomeFornecedor]: "Receita Federal do Brasil",
    },
    tags: ["tag_cp_1"],
    lacunas: [],
  });
  if (!r.ok) throw new Error(r.error);
  const indice = estado.tasks.findIndex((t) => t.id === r.value.id);
  const importada = estado.tasks[indice]!;
  estado.tasks[indice] = { ...importada, provenance: { ...importada.provenance!, at: "2026-09-01T00:00:00.000Z" } };
  return estado.tasks[indice]!;
}

describe("crm:WR-01 — a porta de teste fecha", () => {
  const INVALIDO = "mem_nao_existe";

  it("(a) conferencia: dois ciclos ⇒ ZERO requisições, ZERO Comentários, ZERO Conferências; um aviso por ciclo, sem o id", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    servidor.enfileirar(RESOLVIDA);
    const { ponte, registros } = montar(estado, { modo: "conferencia", avisarId: INVALIDO });
    await ponte.processarContas();
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das)).toHaveLength(0);
    expect(aprovacoesDa(estado, das)).toHaveLength(0);
    const avisos = registros.filter((r) => r.dados?.code === "AVISAR_ID_INVALIDO");
    expect(avisos).toHaveLength(2);
    expect(avisos.every((r) => r.nivel === "warn")).toBe(true);
    expect(JSON.stringify(registros)).not.toContain(INVALIDO);
  });

  it("(a) ensaio: ZERO /resolver", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    isolar(estado, "tsk_cp_das");
    servidor.enfileirar(RESOLVIDA);
    const { ponte, registros } = montar(estado, { modo: "ensaio", avisarId: INVALIDO });
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("AVISAR_ID_INVALIDO");
  });

  it("(a) lancar, conta conferida em \"em lançamento omie\": ZERO /lancar", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    const antes = comentariosDoAgente(das).length;
    servidor.enfileirar(LANCADO_200);
    const { ponte, registros } = montar(estado, { avisarId: INVALIDO });
    await ponte.processarContas();
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);
    expect(comentariosDoAgente(das)).toHaveLength(antes);
    expect(das.statusId).toBe(S.emLancamento);
    expect(registros.filter((r) => r.dados?.code === "AVISAR_ID_INVALIDO")).toHaveLength(2);
  });

  it("(b) o Membro indicado é desativado entre a leitura do ciclo e a releitura: ZERO /lancar, AVISAR_ID_INVALIDO", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    conferidaEmLancamento(estado);
    const TESTE = "mem_marcos_paulo";
    let leituras = 0;
    servidor.enfileirar(LANCADO_200);
    const { ponte, registros } = montar(estado, {
      avisarId: TESTE,
      hidratarEstado: async () => {
        leituras += 1;
        if (leituras === 1) return structuredClone(estado);
        const membro = estado.members.find((m) => m.id === TESTE)!;
        membro.state = "suspenso";
        return estado;
      },
    });
    await ponte.processarContas();
    expect(leituras).toBe(2);
    expect(servidor.recebidas).toHaveLength(0);
    expect(codigos(registros)).toContain("AVISAR_ID_INVALIDO");
  });

  it("(c) recusaDasPortasDeTeste: AVISAR_ID sem SO_TITULOS_COM é recusado pelo nome das variáveis, sem o valor; o resto passa", () => {
    const recusa = recusaDasPortasDeTeste({ avisarId: "mem_x" });
    expect(recusa).toBeDefined();
    expect(recusa).toContain("AGENTE_CONTAS_A_PAGAR_AVISAR_ID");
    expect(recusa).toContain("AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM");
    expect(recusa).not.toContain("mem_x");
    expect(recusaDasPortasDeTeste({ avisarId: "mem_x", soTitulosCom: "TESTE AUTOMATIZADO" })).toBeUndefined();
    expect(recusaDasPortasDeTeste({ soTitulosCom: "TESTE AUTOMATIZADO" })).toBeUndefined();
    expect(recusaDasPortasDeTeste({})).toBeUndefined();
  });
});

describe("crm:WR-02 — a chave vê arquivos, Manual e anexos", () => {
  it("(d) o Boleto que faltava (exigência de saída de \"em lançamento omie\"): pedido uma vez; subir o arquivo destrava na MESMA ponte", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    // O seed não exige arquivo para SAIR de "em lançamento omie"; em ws_n1 o
    // Status pode exigir (é o caminho de WR-02: `unmetRequirements`).
    const def = statusDefinition(estado, CP.listId, S.emLancamento) as { exitRequirements?: unknown } | undefined;
    if (!def) throw new Error("sem o Status");
    def.exitRequirements = [{ definitionId: F.boleto, whenDefinitionId: F.forma, whenValue: "Boleto" }];
    if (valorDo(das, F.forma) !== "Boleto") throw new Error("pré-condição: a forma do seed deveria ser Boleto");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.boleto);
    if (!erpMissingFields(estado, das).includes("Boleto")) throw new Error("pré-condição: o Boleto deveria faltar");

    const { ponte } = montar(estado);
    await ponte.processarContas();
    await ponte.processarContas();
    const pedidos = comentariosDoAgente(das).filter((c) => c.content.startsWith("Não consegui lançar no Omie: falta"));
    expect(pedidos).toHaveLength(1);
    expect(servidor.recebidas).toHaveLength(0);

    const boleto = arquivo(estado, "fil_boleto_novo", "boleto-outubro.pdf");
    ligarArquivo(das, F.boleto, boleto.id);
    expect(conferenciaDoResumo(estado, das).estado).toBe("conferida"); // o arquivo não está na impressão
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([LANCAR]);
    expect(das.statusId).toBe(S.lancado);
  });

  it("(e) Integração manual = Manual: nada; a Maryane desmarca ⇒ no ciclo seguinte, /resolver e Resumo", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    definir(das, F.integracaoManual, "Manual");
    const { ponte } = montar(estado, { modo: "conferencia" });
    await ponte.processarContas();
    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(0);

    campo(estado, das, F.integracaoManual, null);
    servidor.enfileirar(RESOLVIDA);
    await ponte.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
    expect(resumosDe(das)).toHaveLength(1);
  });

  it("(f) chaveDaPonte: muda com Campo de arquivo, Integração manual e anexos; NÃO muda com um Comentário", () => {
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const base = chaveDaPonte(estado, das);

    const r = addTaskComment(estado, MARYANE, das.id, { content: "vou conferir amanhã" });
    if (!r.ok) throw new Error(r.error);
    expect(chaveDaPonte(estado, das)).toBe(base);

    definir(das, F.boleto, "fil_outro_boleto");
    const comBoleto = chaveDaPonte(estado, das);
    expect(comBoleto).not.toBe(base);

    definir(das, F.integracaoManual, "Manual");
    const comManual = chaveDaPonte(estado, das);
    expect(comManual).not.toBe(comBoleto);

    das.attachments = [...das.attachments, { fileId: "fil_anexo_novo", order: 99, mediaType: "document", displayName: "nf.pdf" }];
    expect(chaveDaPonte(estado, das)).not.toBe(comManual);
  });
});

describe("crm:WR-07 — o fio é a memória", () => {
  it("(g) o aviso do modo conferência: um por entrada no Status — nem o reinício nem um Campo fora da impressão o repetem; sair e voltar, sim", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    servidor.enfileirar(RESOLVIDA);
    const avisos = () => comentariosDoAgente(das).filter((c) => c.content === TEXTOS_DA_CONFERENCIA.modoConferencia);

    const a = montar(estado, { modo: "conferencia" }).ponte;
    await a.processarContas(); // Resumo
    responder(estado, das, MARYANE, "ok");
    await a.processarContas(); // conferido pelo fio
    mover(estado, das.id, S.emLancamento);
    await a.processarContas(); // o aviso
    expect(avisos()).toHaveLength(1);

    const b = montar(estado, { modo: "conferencia" }).ponte; // reinício
    await b.processarContas();
    expect(avisos()).toHaveLength(1);

    const anexo = arquivo(estado, "fil_anexo_nf", "nf.pdf");
    ligarArquivo(das, F.anexo, anexo.id); // fora da impressão
    expect(conferenciaDoResumo(estado, das).estado).toBe("conferida");
    await b.processarContas();
    expect(avisos()).toHaveLength(1);

    sairEVoltar(estado, das.id);
    await b.processarContas();
    expect(avisos()).toHaveLength(2);
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER]);
  });

  it("(h) recusa permanente no /resolver: o reinício restaura a parada (ZERO requisições, ZERO Comentários, PARADA_RESTAURADA); um Campo mudado pela Maryane destrava", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    servidor.enfileirar(erro422("CONTA_CORRENTE_NAO_RESOLVIDA", 'Nenhuma conta corrente do Omie casa com "TRIA".'));
    const a = montar(estado, { modo: "conferencia" }).ponte;
    await a.processarContas();
    expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([
      textoDaRecusaDoResumo('Nenhuma conta corrente do Omie casa com "TRIA".', "CONTA_CORRENTE_NAO_RESOLVIDA"),
    ]);

    const { ponte: b, registros } = montar(estado, { modo: "conferencia" });
    await b.processarContas();
    await b.processarContas();
    expect(servidor.recebidas).toHaveLength(1);
    expect(comentariosDoAgente(das)).toHaveLength(1);
    const restauradas = registros.filter((r) => r.dados?.code === "PARADA_RESTAURADA");
    expect(restauradas).toHaveLength(1);
    expect(restauradas[0]?.nivel).toBe("info");

    campo(estado, das, F.cnpj, "11.222.333/0001-82");
    servidor.enfileirar(RESOLVIDA);
    await b.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER]);
    expect(resumosDe(das)).toHaveLength(1);
  });

  it("(i) a mudança humana ANTES do reinício vale: nada restaurado, B chama o /resolver", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    servidor.enfileirar(erro422("CONTA_CORRENTE_NAO_RESOLVIDA", "sem conta"));
    await montar(estado, { modo: "conferencia" }).ponte.processarContas();
    campo(estado, das, F.cnpj, "11.222.333/0001-82");

    servidor.enfileirar(RESOLVIDA);
    const { ponte: b, registros } = montar(estado, { modo: "conferencia" });
    await b.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([RESOLVER, RESOLVER]);
    expect(codigos(registros)).not.toContain("PARADA_RESTAURADA");
    expect(resumosDe(das)).toHaveLength(1);
  });

  it("(j) lancar — a importada em \"em lançamento omie\" e o pedido de dado não se repetem depois do reinício", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    for (const t of estado.tasks) if (t.listId === CP.listId && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
    const importada = importarEmLancamento(estado);
    await montar(estado).ponte.processarContas();
    expect(comentariosDoAgente(conta(estado, importada.id)).map((c) => c.content)).toEqual([TEXTO_NASCEU_EM_LANCAMENTO]);
    await montar(estado).ponte.processarContas(); // reinício
    expect(comentariosDoAgente(conta(estado, importada.id))).toHaveLength(1);
    expect(servidor.recebidas).toHaveLength(0);

    const outro = buildSeed();
    const das = prepararEmLancamento(outro, "tsk_cp_das", "Impostos");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.nomeFornecedor);
    await montar(outro).ponte.processarContas();
    expect(comentariosDoAgente(das).map((c) => c.content)).toEqual([textoDoDadoFaltando(["Nome do fornecedor"])]);
    await montar(outro).ponte.processarContas(); // reinício
    expect(comentariosDoAgente(das)).toHaveLength(1);
    expect(servidor.recebidas).toHaveLength(0);
  });

  it("(k) PADROES_DAS_PARADAS: cada texto de parada casa com exatamente um padrão; os que não param, com nenhum", () => {
    const casam = (texto: string) => PADROES_DAS_PARADAS.filter((p) => p.test(texto)).length;
    const paradas = [
      textoDaRecusaDoResumo('Nenhuma conta corrente do Omie casa com "TRIA".', "CONTA_CORRENTE_NAO_RESOLVIDA"),
      textoDaRecusaDoResumo(undefined, "HTTP_404"),
      textoDasTransitorias("OMIE_INDISPONIVEL"),
      TEXTO_NASCEU_EM_LANCAMENTO,
      TEXTO_SEM_CODIGO_CONFERIDO,
      textoDoDadoFaltando(["Nome do fornecedor", "CNPJ"]),
      TEXTO_SEM_CENTRO_DE_CUSTO,
      TEXTO_VALOR_INVALIDO,
      TEXTO_LANCAMENTO_NAO_CONFIRMADO,
      textoDoRegistroRecusado("pay_das_1", "Só um Membro ativo altera Tarefa."),
      textoDoRegistroEmConflito("pay_das_1"),
      TEXTOS_DA_CONFERENCIA.falhaSemVolta("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU"),
      TEXTOS_DA_CONFERENCIA.falhaSemVolta("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU", "Só um Membro ativo altera Tarefa."),
    ];
    for (const texto of paradas) expect([texto, casam(texto)]).toEqual([texto, 1]);

    const estado = buildSeed();
    const das = isolar(estado, "tsk_cp_das");
    const p = publicarResumoParaConferencia(estado, ATOR, das.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
    if (!p.ok) throw new Error(p.error);
    const resumo = resumosDe(das)[0]?.content;
    if (!resumo) throw new Error("sem Resumo");
    const naoParam = [
      TEXTOS_DA_CONFERENCIA.falha("Fornecedor bloqueado no Omie.", "OMIE_RECUSOU"),
      resumo,
      TEXTOS_DA_CONFERENCIA.recusaSemCodigo,
      textoDosAnexosAcimaDoLimite(1),
      textoDosAnexosAcimaDoLimite(3),
      TEXTOS_DA_CONFERENCIA.modoConferencia,
    ];
    for (const texto of naoParam) expect([texto, casam(texto)]).toEqual([texto, 0]);
  });

  it("(l) lancar, 422 CONTA_DIVERGENTE e o reinício ANTES do ciclo seguinte: a falha que devolveu a conta não é parada — B publica o Resumo novo", async () => {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    const das = conferidaEmLancamento(estado);
    servidor.enfileirar({
      kind: "ok",
      status: 422,
      corpo: { error: { code: "CONTA_DIVERGENTE", message: "A conta corrente mudou.", requestId: "req_9", retryable: false, details: { conferida: "TRIA COMPANY - ITAU", resolvida: "TRIA - BRADESCO" } } },
    });
    await montar(estado).ponte.processarContas();
    expect(das.statusId).toBe(S.paraPagar);
    expect(conferenciaDoResumo(estado, das).estado).toBe("sem-resumo");
    const resumosAntes = resumosDe(das).length;

    servidor.enfileirar(RESOLVIDA);
    const { ponte: b, registros } = montar(estado);
    await b.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([LANCAR, RESOLVER]);
    expect(resumosDe(das)).toHaveLength(resumosAntes + 1);
    expect(codigos(registros)).not.toContain("PARADA_RESTAURADA");
  });
});

function valorDo(t: Task, definitionId: string): unknown {
  return t.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
}
