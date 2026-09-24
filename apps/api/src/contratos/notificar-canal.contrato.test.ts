/**
 * Contrato ponta a ponta de `automacao.notificar-canal.v1` (AUTO-02, D5-19,
 * fechamento de lacunas de CR-02 — Critério 4 do `05-VERIFICATION.md`): o
 * `missing` era "um teste de contrato ponta a ponta que monte a Tarefa pelo
 * seed real, rode `pedidosDeNotificacaoPorCanal`, passe o payload pelo
 * schema do `automation/` e resolva o destino contra o DTO real — hoje cada
 * lado testa só a própria metade".
 *
 * Este arquivo é o lado GERADOR/VERIFICADOR (`crm-n1`): monta o Estado pelo
 * seed real (`buildSeed` + `evoluirConfiguracaoDeSolicitacoes` +
 * `evoluirConfiguracaoPorEmpresa`), publica as duas Automações de Canal que
 * o Marcos Paulo usa de verdade (modo campo e modo rótulos, D5-19), dispara
 * o gatilho `tarefaCriada` e deriva o evento de outbox
 * (`eventosDeNotificacaoPorCanal`) e o DTO v1 (`paraDtoV1`) REAIS — nunca
 * fabricados à mão. O par deste teste,
 * `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts`
 * (Task 2 do mesmo plano), consome as MESMAS fixtures
 * (`../../../../contratos/notificar-canal-v1/`, lidas pelo caminho relativo
 * entre os dois repositórios irmãos — o mesmo precedente de
 * `contratos/payment-requests-v1/`) pela rota real e pelo adapter real.
 *
 * `ATUALIZAR_CONTRATO=1` reescreve as três fixtures a partir do que este
 * teste gera — regenerar é um ato DELIBERADO, feito no MESMO commit que
 * muda o lado que derivou (domínio, DTO ou schema do outbox), e só depois de
 * regenerar é que o teste do `automation/` volta a passar (ele lê as MESMAS
 * fixtures). Sem a variável, o gerado (normalizado) é comparado por
 * `toEqual` contra o JSON já versionado — qualquer deriva silenciosa no
 * domínio, no DTO ou no schema do outbox fica vermelha AQUI primeiro.
 *
 * Normalização (aplicada ANTES de comparar/gravar, nunca depois): `eventId`,
 * `occurredAt`, `taskId`, `executionId` e `readableId` viram literais fixos
 * — são identidade de instância de teste, não o que o contrato fixa. O que
 * o contrato FIXA (`campoDestinoId`, `destinoTipo`, `rotulos`, `mensagemId`,
 * `fields.company`, `fields.requesterWhatsApp`) nunca é normalizado — é
 * lido direto do resultado real do domínio/DTO.
 *
 * `sem-canal.tria.json` não nasce de uma execução real: o domínio recusa as
 * DUAS Automações para a Tria Company (Empresa sem `avisosPorCanal`) — zero
 * eventos, afirmado abaixo. O `evento` desta fixture é montado À MÃO, no
 * MESMO formato de payload (validado pelo mesmo `EVENTOS[...]` schema do
 * outbox que as outras duas fixtures usam) e marcado `"sintetico": true` —
 * um marcador de documentação que o consumidor (Task 2) remove antes de
 * postar, porque o schema `.strict()` da rota não o conhece.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Automation, AutomationAction, AutomationTrigger, AutomationVersion, DataState, Id, Task } from "@n1/dominio";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio";
import { evoluirConfiguracaoPorEmpresa } from "@n1/dominio/configuracao-por-empresa-evolver";
import { CP } from "@n1/dominio/operations/financeiro";
import { CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID, CANAL_LISTA_ID, runListAutomations } from "@n1/dominio/operations/automations";
import { createTask, setTaskFieldValue } from "@n1/dominio/operations/tasks";
import { buildSeed } from "@n1/dominio/seed";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { eventosDeNotificacaoPorCanal, execucoesNovas } from "../persistencia/eventos-de-canal";
import { EVENTOS, type EventoDeSaida } from "../persistencia/outbox";
import { paraDtoV1, type PaymentRequestDtoV1 } from "../servicos/dto-solicitacao";
import { EsquemasV1 } from "./v1";

const FIXTURES_DIR = fileURLToPath(new URL("../../../../contratos/notificar-canal-v1/", import.meta.url));
/** Único jeito de regenerar — ver doutrina no cabeçalho do arquivo. */
const ATUALIZAR = process.env.ATUALIZAR_CONTRATO === "1";

const DONO = CP.financeiroId;
const CARIMBO_AUTOMACAO = "2026-01-01T12:00:00.000Z";
/** O instante fixo que toda fixture normalizada usa — nunca `new Date()` (não determinístico, `now()` do domínio é relógio real). */
const INSTANTE_FIXO = "2026-01-01T00:00:00.000Z";

const AUTOMACAO_CAMPO_ID: Id = "aut_contrato_canal_campo";
const AUTOMACAO_ROTULOS_ID: Id = "aut_contrato_canal_rotulos";

// WhatsApp de teste (T-5-79): nunca uma sequência que pareça telefone real — texto com
// hífens, não dígitos corridos.
const WHATSAPP_MARCOS_PAULO = "whatsapp-fixture-canal-mp-01";
const WHATSAPP_TRIA = "whatsapp-fixture-canal-tria-01";

interface IdsDeNormalizacao {
  readonly taskId: string;
  readonly readableId: string;
  readonly executionId: string;
  readonly eventId: string;
}

const IDS_CAMPO: IdsDeNormalizacao = {
  taskId: "tsk-fixture-canal-marcos-paulo",
  readableId: "SP-FIXTURE-CANAL-MP",
  executionId: "aex-fixture-canal-campo",
  eventId: "evt-fixture-canal-campo",
};
const IDS_ROTULOS: IdsDeNormalizacao = {
  taskId: "tsk-fixture-canal-marcos-paulo",
  readableId: "SP-FIXTURE-CANAL-MP",
  executionId: "aex-fixture-canal-rotulos",
  eventId: "evt-fixture-canal-rotulos",
};
const IDS_SEM_CANAL: IdsDeNormalizacao = {
  taskId: "tsk-fixture-canal-tria",
  readableId: "SP-FIXTURE-CANAL-TRIA",
  executionId: "aex-fixture-canal-sem-canal-sintetico",
  eventId: "evt-fixture-canal-sem-canal",
};

/** `deps.urlDeDownload` de `paraDtoV1` — nunca chamado de verdade (nenhuma Tarefa deste teste tem Anexo), mas a assinatura exige a porta. */
async function urlDeDownloadStub(objectKey: string): Promise<{ readonly downloadUrl: string; readonly expiresAt: Date }> {
  return { downloadUrl: `https://fixture.invalida.exemplo/${objectKey}`, expiresAt: new Date(INSTANTE_FIXO) };
}

function campoPorRotulo(rotulo: string): Id {
  const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === rotulo);
  if (!campo) throw new Error(`fixture: Catálogo da Solicitação sem o Campo "${rotulo}" — divergiu do que este teste espera.`);
  return campo.id;
}

const CAMPO_FORNECEDOR_ID = campoPorRotulo("Nome do fornecedor");
const CAMPO_VALOR_ID = campoPorRotulo("Valor");
const CAMPO_VENCIMENTO_ID = campoPorRotulo("Data Vencimento");

/** Publica uma Automação de Canal de um passo só, gatilho `tarefaCriada`, escopo `CANAL_LISTA_ID` — o mesmo molde de `automations-canal.test.ts` (05-13). */
function publicarCanal(state: DataState, id: Id, params: object): Automation {
  const trigger: AutomationTrigger = { kind: "evento", eventType: "tarefaCriada" };
  const action: AutomationAction = { order: 1, kind: "controle", controlKind: "notificar", params: JSON.stringify(params) };
  const version: AutomationVersion = {
    number: 1,
    state: "publicada",
    trigger,
    conditions: [],
    actions: [action],
    errorPolicy: { onActionFailure: "interromper", retries: 0 },
    publishedBy: DONO,
    publishedAt: CARIMBO_AUTOMACAO,
    createdAt: CARIMBO_AUTOMACAO,
  };
  const automation: Automation = {
    id,
    workspaceId: state.workspace.id,
    createdBy: { kind: "member", id: DONO },
    createdAt: CARIMBO_AUTOMACAO,
    lifecycle: "ativo",
    name: id,
    description: id,
    scopeType: "list",
    scopeId: CANAL_LISTA_ID,
    ownerMemberId: DONO,
    reactsToAutomationEvents: false,
    versions: [version],
  };
  state.automations.push(automation);
  return automation;
}

function criarSolicitacao(state: DataState, titulo: string): Task {
  const r = createTask(state, DONO, { listId: CANAL_LISTA_ID, title: titulo }, { runAutomations: false });
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
  return r.value;
}

function setCampo(state: DataState, taskId: Id, definitionId: Id, valor: string | number | boolean | readonly string[]): void {
  const r = setTaskFieldValue(state, DONO, taskId, definitionId, valor);
  if (!r.ok) throw new Error(`fixture: ${r.error}`);
}

function naoNulo<T>(valor: T | null, mensagem: string): T {
  if (valor === null) throw new Error(`fixture: ${mensagem}`);
  return valor;
}

/** Type guard — `EventoDeSaida` é uma união discriminada por `type`; sem isto, `payload.automationId` não tipa. */
function ehEventoDeCanal(e: EventoDeSaida): e is Extract<EventoDeSaida, { type: "automacao.notificar-canal.v1" }> {
  return e.type === "automacao.notificar-canal.v1";
}

type PayloadNotificarCanalV1 = Extract<EventoDeSaida, { type: "automacao.notificar-canal.v1" }>["payload"];

/** `{ eventId, occurredAt, ...payload }` — a MESMA forma que `outbox-worker.ts::entregar` monta no corpo da entrega real (Idempotency-Key = eventId = id da linha do outbox). */
function eventoNormalizado(payload: PayloadNotificarCanalV1, ids: IdsDeNormalizacao): Record<string, unknown> {
  return {
    eventId: ids.eventId,
    occurredAt: INSTANTE_FIXO,
    ...payload,
    taskId: ids.taskId,
    executionId: ids.executionId,
  };
}

function tarefaNormalizada(dto: PaymentRequestDtoV1, ids: IdsDeNormalizacao): PaymentRequestDtoV1 {
  return { ...dto, id: ids.taskId, readableId: ids.readableId, createdAt: INSTANTE_FIXO, updatedAt: INSTANTE_FIXO };
}

interface FixtureCanal {
  readonly versao: 1;
  readonly caso: string;
  readonly evento: Record<string, unknown>;
  readonly tarefa: PaymentRequestDtoV1;
  readonly esperado: Record<string, unknown>;
}

function montarFixture(caso: string, evento: Record<string, unknown>, tarefa: PaymentRequestDtoV1, esperado: Record<string, unknown>): FixtureCanal {
  return { versao: 1, caso, evento, tarefa, esperado };
}

function caminhoFixture(nome: string): string {
  return `${FIXTURES_DIR}${nome}`;
}

function lerFixtureVersionada(nome: string): unknown {
  return JSON.parse(readFileSync(caminhoFixture(nome), "utf8"));
}

/** JSON com 2 espaços e `\n` final — a mesma convenção de `contratos/payment-requests-v1/`. */
function escreverFixture(nome: string, fixture: FixtureCanal): void {
  writeFileSync(caminhoFixture(nome), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
}

interface Cenario {
  readonly campo: FixtureCanal;
  readonly rotulos: FixtureCanal;
  readonly semCanal: FixtureCanal;
  readonly eventosDaTriaCompany: number;
}

async function montarCenario(): Promise<Cenario> {
  const state = buildSeed();
  const solicitacoes = evoluirConfiguracaoDeSolicitacoes(state, DONO);
  if (!solicitacoes.ok) throw new Error(`fixture (Solicitações): ${solicitacoes.error}`);
  const empresas = evoluirConfiguracaoPorEmpresa(state, DONO);
  if (!empresas.ok) throw new Error(`fixture (Empresas): ${empresas.error}`);

  publicarCanal(state, AUTOMACAO_CAMPO_ID, { canal: "whatsapp", canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID, canalMensagemId: "gasto-novo" });
  publicarCanal(state, AUTOMACAO_ROTULOS_ID, { canal: "whatsapp", canalDestinatariosDaEmpresa: true, canalMensagemId: "gasto-novo" });

  // ── Marcos Paulo: as DUAS Automações publicadas disparam na MESMA
  // Solicitação — o par consumidor lê o Estado de UMA Tarefa real, não duas.
  const marcosPaulo = criarSolicitacao(state, "Solicitação de teste (05-24, contrato notificar-canal)");
  setCampo(state, marcosPaulo.id, CANAL_CAMPO_EMPRESA_ID, "Marcos Paulo");
  setCampo(state, marcosPaulo.id, CANAL_CAMPO_WHATSAPP_ID, WHATSAPP_MARCOS_PAULO);
  setCampo(state, marcosPaulo.id, CAMPO_FORNECEDOR_ID, "Fornecedor Fictício LTDA");
  setCampo(state, marcosPaulo.id, CAMPO_VALOR_ID, 1234.56);
  setCampo(state, marcosPaulo.id, CAMPO_VENCIMENTO_ID, "2026-12-31");

  const idsAntesMp = new Set(state.automationExecutions.map((e) => e.id));
  runListAutomations(state, { kind: "tarefaCriada", taskId: marcosPaulo.id });
  const execucoesMp = execucoesNovas(state, idsAntesMp);
  if (execucoesMp.length !== 2) {
    throw new Error(`fixture: esperava 2 Execuções novas do Marcos Paulo (campo + rótulos), achou ${execucoesMp.length}.`);
  }
  const eventosMp = eventosDeNotificacaoPorCanal(state, execucoesMp).filter(ehEventoDeCanal);
  const eventoCampo = eventosMp.find((e) => e.payload.automationId === AUTOMACAO_CAMPO_ID);
  const eventoRotulos = eventosMp.find((e) => e.payload.automationId === AUTOMACAO_ROTULOS_ID);
  if (!eventoCampo || !eventoRotulos) {
    throw new Error("fixture: esperava um evento de Canal por Automação (modo campo e modo rótulos) do Marcos Paulo.");
  }
  // Prova, ANTES de gravar a fixture, que os dois payloads passam no MESMO schema que `gravarEventos()` usaria.
  EVENTOS["automacao.notificar-canal.v1"].parse(eventoCampo.payload);
  EVENTOS["automacao.notificar-canal.v1"].parse(eventoRotulos.payload);

  const dtoMarcosPaulo = await paraDtoV1(state, marcosPaulo, { urlDeDownload: urlDeDownloadStub });
  if (!dtoMarcosPaulo) throw new Error("fixture: paraDtoV1 devolveu undefined para a Solicitação do Marcos Paulo.");
  EsquemasV1.getTask.resposta.parse(dtoMarcosPaulo);

  const requesterWhatsApp = naoNulo(dtoMarcosPaulo.fields.requesterWhatsApp, "fields.requesterWhatsApp vazio no DTO do Marcos Paulo.");
  const rotulosResolvidos = [...(eventoRotulos.payload.rotulos ?? [])];
  if (rotulosResolvidos.length === 0) throw new Error("fixture: evento em modo rótulos sem rótulos.");

  const campoFixture = montarFixture(
    "campo.gasto-novo",
    eventoNormalizado(eventoCampo.payload, IDS_CAMPO),
    tarefaNormalizada(dtoMarcosPaulo, IDS_CAMPO),
    { destinos: [requesterWhatsApp] },
  );
  const rotulosFixture = montarFixture(
    "rotulos.gasto-novo",
    eventoNormalizado(eventoRotulos.payload, IDS_ROTULOS),
    tarefaNormalizada(dtoMarcosPaulo, IDS_ROTULOS),
    { rotulos: rotulosResolvidos },
  );

  // ── Tria Company: as MESMAS duas Automações, sobre uma Empresa sem
  // `avisosPorCanal` declarado — o domínio recusa nos dois modos, zero
  // eventos (D5-19: o par, no domínio, de `422 EMPRESA_SEM_CANAL` do
  // `automation/`, WR-02/05-18).
  const tria = criarSolicitacao(state, "Solicitação de teste (05-24, contrato notificar-canal, sem canal)");
  setCampo(state, tria.id, CANAL_CAMPO_EMPRESA_ID, "Tria Company");
  setCampo(state, tria.id, CANAL_CAMPO_WHATSAPP_ID, WHATSAPP_TRIA);
  setCampo(state, tria.id, CAMPO_FORNECEDOR_ID, "Fornecedor Fictício Dois LTDA");
  setCampo(state, tria.id, CAMPO_VALOR_ID, 987.65);
  setCampo(state, tria.id, CAMPO_VENCIMENTO_ID, "2026-11-30");

  const idsAntesTria = new Set(state.automationExecutions.map((e) => e.id));
  runListAutomations(state, { kind: "tarefaCriada", taskId: tria.id });
  const execucoesTria = execucoesNovas(state, idsAntesTria);
  if (execucoesTria.length !== 2) {
    throw new Error(`fixture: esperava 2 Execuções novas da Tria Company (ambas recusadas), achou ${execucoesTria.length}.`);
  }
  const eventosTria = eventosDeNotificacaoPorCanal(state, execucoesTria);

  const dtoTria = await paraDtoV1(state, tria, { urlDeDownload: urlDeDownloadStub });
  if (!dtoTria) throw new Error("fixture: paraDtoV1 devolveu undefined para a Solicitação da Tria Company.");
  EsquemasV1.getTask.resposta.parse(dtoTria);

  // Sem execução concluída de Canal — o payload é montado À MÃO, no mesmo
  // formato validado pelo schema real do outbox, e marcado "sintetico": true
  // (ver doutrina no cabeçalho do arquivo).
  const corePayloadSemCanal = EVENTOS["automacao.notificar-canal.v1"].parse({
    taskId: tria.id,
    automationId: AUTOMACAO_CAMPO_ID,
    executionId: "exec-placeholder-sem-canal",
    canal: "whatsapp",
    destinoTipo: "campo",
    campoDestinoId: CANAL_CAMPO_WHATSAPP_ID,
    mensagemId: "gasto-novo",
  });
  const semCanalFixture = montarFixture(
    "sem-canal.tria",
    { ...eventoNormalizado(corePayloadSemCanal, IDS_SEM_CANAL), sintetico: true },
    tarefaNormalizada(dtoTria, IDS_SEM_CANAL),
    { http: 422, code: "EMPRESA_SEM_CANAL" },
  );

  return { campo: campoFixture, rotulos: rotulosFixture, semCanal: semCanalFixture, eventosDaTriaCompany: eventosTria.length };
}

let cenario: Cenario;

beforeAll(async () => {
  cenario = await montarCenario();
  if (ATUALIZAR) {
    escreverFixture("campo.gasto-novo.json", cenario.campo);
    escreverFixture("rotulos.gasto-novo.json", cenario.rotulos);
    escreverFixture("sem-canal.tria.json", cenario.semCanal);
  }
});

describe("Tria Company (Integração sem avisosPorCanal) — zero eventos de Canal, afirmado (D5-19)", () => {
  it("as duas Automações (campo e rótulos) recusam; eventosDeNotificacaoPorCanal devolve lista vazia", () => {
    expect(cenario.eventosDaTriaCompany).toBe(0);
  });
});

describe("Contrato notificar-canal-v1 — o gerado (do seed real) bate com o versionado", () => {
  it("campo.gasto-novo.json", () => {
    expect(cenario.campo).toEqual(lerFixtureVersionada("campo.gasto-novo.json"));
  });

  it("rotulos.gasto-novo.json", () => {
    expect(cenario.rotulos).toEqual(lerFixtureVersionada("rotulos.gasto-novo.json"));
  });

  it("sem-canal.tria.json", () => {
    expect(cenario.semCanal).toEqual(lerFixtureVersionada("sem-canal.tria.json"));
  });

  it('controle de mutação: campoDestinoId trocado por "fd_cp_whatsapp" reprova o toEqual (a comparação não é vazia)', () => {
    const versionada = lerFixtureVersionada("campo.gasto-novo.json");
    const mutado = { ...cenario.campo, evento: { ...cenario.campo.evento, campoDestinoId: "fd_cp_whatsapp" } };
    expect(mutado).not.toEqual(versionada);
  });
});
