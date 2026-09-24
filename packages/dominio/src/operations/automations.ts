/**
 * Automações de Lista executadas de verdade — o que os processos do
 * Financeiro (contas a pagar e a receber) precisam: reagir a Tarefa criada e
 * a entrada em Status, e disparar por distância do vencimento (antes ou depois). Cada Automação é o registro da ontologia
 * (Automation + versão publicada); o gatilho, as condições e as ações são
 * lidos de `eventType`/`expression`/`params` num vocabulário pequeno e tipado.
 *
 * Toda execução vira `AutomationExecution`, com um passo por ação — é o que a
 * tela de Automações e a Auditoria leem. A Automação age em nome do seu dono
 * (DO-AUT: o delegante é o Proprietário da Automação).
 *
 * AUTO-01 — o vocabulário de controle é fechado: `invocarAgente`,
 * `notificar`, `solicitarAprovacao`, `aguardar` e `encerrar`. Só `ramificar`
 * segue fora de escopo, e é o único que ainda cai em "Controle não
 * suportado". Nenhuma Ação aqui nomeia Lista, Status, Campo ou Membro do
 * Financeiro: o alvo vem sempre de `params` e dos campos tipados de
 * `AutomationAction` — as referências ao Financeiro no arquivo são as do
 * Agente de lançamento, do `{{cnpjEmpresa}}` do template (as duas já
 * existiam), e, desde D5-19 (2026-09-24), o alvo do Canal (`CANAL_LISTA_ID`/
 * `CANAL_CAMPO_EMPRESA_ID`/`CANAL_CAMPO_WHATSAPP_ID`): decisão do dono do
 * produto de que a Lista-alvo de AUTO-02 é "Solicitações de pagamento", não
 * uma Lista genérica — `destinoDeCanal` nomeia essa Lista e esses dois Campos
 * de propósito, derivados do catálogo real da Solicitação.
 *
 * Achado registrado em prosa, sem mudar tipo nenhum: `ApprovalOrigin`
 * (`types/ai.ts`) tem dois ramos — `agentExecution` e `processTask` — e
 * nenhum deles é "Automação". O ramo `solicitarAprovacao` reusa `processTask`,
 * o que é honesto (é uma decisão de processo ancorada numa Tarefa, D-06) mas
 * herda duas consequências: o passo de processo fica sempre `"pagamento"` e a
 * Lista precisa ter o status `em aprovação`. Fechar isso direito pede um
 * terceiro ramo em `ApprovalOrigin`, o que arrasta `types/ai.ts` e os
 * consumidores de `apps/web` — fora da posse de arquivos deste plano.
 */

import { containerAdminRefusal, effectiveLifecycleOfTask, effectiveListConfig, memberSeesTask, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Automation, AutomationAction, AutomationExecution, AutomationTrigger, AutomationVersion, Id, Task } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { CP, clienteDe, runLancamentoAgent, type DeParaDeLancamento } from "./financeiro";
import { contactDisplayName } from "../derive";
import { addTaskComment, assignTask, changeTaskStatus, setTaskFieldValue, unassignTask, watchTask } from "./tasks";
// Sem ciclo: `operations/ai.ts` importa `./tasks` e `../derive`, nunca `./automations`.
import { solicitarAprovacao as solicitarAprovacaoDeProcesso } from "./ai";
// Sem ciclo (D5-19): `./financeiro.ts` não importa nem `../solicitacao-de-pagamento` nem
// `../solicitacao-de-pagamento-evolver`, e nenhum dos dois importa `./automations` — confirmado
// por `npm run typecheck -w @n1/dominio` antes do commit desta Task.
import { LISTA_ID as SOLICITACAO_LISTA_ID } from "../solicitacao-de-pagamento-evolver";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "../solicitacao-de-pagamento";

/**
 * O ÚNICO relógio do módulo. Sem argumento é o instante real — o que um
 * evento merece, porque ele acontece agora. Com argumento é o instante
 * injetado: `runScheduledAutomations` recebe `today` e a Execução que ele
 * produz é carimbada com ele, não com o relógio da máquina. Sem isto,
 * `jaRodou` comparava duas bases de tempo diferentes e "rodar duas vezes no
 * mesmo dia" deixava de ser verificável.
 */
const instante = (quando?: Date): string => (quando ?? new Date()).toISOString();

/** Mesmo ano, mês e dia em horário LOCAL — o dia civil é o do usuário, não o do UTC. */
function mesmoDiaCivil(a: string | Date, b: Date): boolean {
  const x = typeof a === "string" ? new Date(a) : a;
  return x.getFullYear() === b.getFullYear() && x.getMonth() === b.getMonth() && x.getDate() === b.getDate();
}

/** `YYYY-MM-DD` em horário local — a forma em que um dia civil é gravado e lido. */
const diaCivil = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type ListEvent =
  | { readonly kind: "tarefaCriada"; readonly taskId: Id }
  | { readonly kind: "tarefaEntrouEmStatus"; readonly taskId: Id; readonly statusId: Id; readonly previousStatusId?: Id };

/* ───────────────────────────── Vocabulário ───────────────────────────── */

interface ConditionSpec {
  readonly status?: string;
  readonly definitionId?: Id;
  readonly empty?: boolean;
  readonly equals?: string;
}

interface ActionSpec {
  readonly memberId?: Id;
  readonly memberIds?: readonly Id[];
  readonly fromFieldDefinitionId?: Id;
  readonly statusName?: string;
  readonly template?: string;
  readonly mentionMemberId?: Id;
  readonly mentionFieldDefinitionId?: Id;
  /** Menciona o dono (no CRM) do Contato vinculado à Tarefa — o Comercial do cliente. */
  readonly mentionClientOwner?: boolean;
  /** `tarefa.definirCampo`: o Campo e o valor; `today` grava o dia civil de hoje. */
  readonly definitionId?: Id;
  readonly value?: string | number;
  readonly today?: boolean;
  /** Só grava se o Campo estiver vazio (R3: o Financeiro pode ter preenchido antes). */
  readonly onlyIfEmpty?: boolean;
  /* ── Vocabulário de controle (AUTO-01) ── */
  /** `notificar`: Membros mencionados no aviso, somados a `memberId` e a `fromFieldDefinitionId`. */
  readonly mentionMemberIds?: readonly Id[];
  /** `encerrar` (e o motivo do roteamento em `solicitarAprovacao`). */
  readonly motivo?: string;
  /** `aguardar`: o prazo declarado. `action.timeoutHours` (campo tipado) vale como alternativa. */
  readonly aguardarDias?: number;
  readonly aguardarHoras?: number;
  /** `aguardar`: de onde o prazo conta — o vencimento da Tarefa (padrão) ou a criação dela. */
  readonly aguardarDesde?: "vencimento" | "criacaoDaTarefa";
  /** `solicitarAprovacao`: Campo do tipo pessoa que nomeia o Aprovador, quando não vem tipado na versão. */
  readonly approverFieldDefinitionId?: Id;
  /* ── Vocabulário de Canal (AUTO-02) ── */
  /** `notificar` por Canal: o único canal desta fase. Sem ele, `notificar` continua in-app. */
  readonly canal?: "whatsapp";
  /** Modo 1 — o destino é o valor de um Campo DA TAREFA (D5-10: vazio é recusa, nunca um padrão). */
  readonly canalCampoDestinoId?: Id;
  /** Modo 2 — o destino são os rótulos declarados em `Integration.avisosPorCanal.whatsapp` da Empresa da Tarefa (D5-10). */
  readonly canalDestinatariosDaEmpresa?: boolean;
  /**
   * Enum de dois valores, deliberado: D5-11 limita AUTO-02 ao que o Marcos
   * Paulo já faz — aviso de gasto novo e relatório. Canal genérico para
   * qualquer Automação é capacidade adiada, não um campo de texto livre.
   */
  readonly canalMensagemId?: "gasto-novo" | "relatorio";
}

interface TemporalSpec {
  readonly dueDateOffsetDays: number;
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

function publishedVersion(automation: Automation): AutomationVersion | undefined {
  return [...automation.versions].reverse().find((v) => v.state === "publicada");
}

function fieldValueOf(task: Task, definitionId: Id): unknown {
  const value = task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
  return value ?? undefined;
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

function conditionsHold(state: DataState, task: Task, version: AutomationVersion): boolean {
  return version.conditions.every((condition) => {
    if (condition.kind === "hibrida" || condition.kind === "temporal") return true;
    const spec = parseJson<ConditionSpec>(condition.expression);
    if (!spec) return true;
    if (spec.status !== undefined) {
      const atual = statusDefinition(state, task.listId, task.statusId)?.name.trim().toLocaleLowerCase("pt-BR");
      if (atual !== spec.status.trim().toLocaleLowerCase("pt-BR")) return false;
    }
    if (spec.definitionId) {
      const valor = fieldValueOf(task, spec.definitionId);
      if (spec.empty === true && !isEmpty(valor)) return false;
      if (spec.empty === false && isEmpty(valor)) return false;
      if (spec.equals !== undefined && String(valor ?? "") !== spec.equals) return false;
    }
    return true;
  });
}

/**
 * Substitui `{{campo:<id>}}` (um Campo de pessoa vira o nome), `{{cnpjEmpresa}}`,
 * `{{titulo}}`, `{{vencimento}}`, `{{cliente}}` e `{{donoDoCliente}}` no
 * texto de um Comentário.
 *
 * `cnpjPorEmpresa` (PAG-04) é o mapa real injetado pela ponte do `apps/api`
 * (03-11) — o domínio não busca CNPJ nenhum, só recebe. Sem mapa, ou com a
 * Empresa da Tarefa ausente dele, o fallback textual (`da Empresa <nome>`)
 * é o mesmo de antes: nenhum número inventado sobrevive à falta de configuração.
 */
function fillTemplate(state: DataState, task: Task, template: string, cnpjPorEmpresa?: Readonly<Record<string, string>>): string {
  const cliente = clienteDe(state, task);
  return template
    .replace(/\{\{cliente\}\}/g, () => (cliente ? contactDisplayName(cliente) : "o cliente"))
    .replace(/\{\{donoDoCliente\}\}/g, () => (cliente ? (state.members.find((m) => m.id === cliente.ownerMemberId)?.displayName ?? "—") : "—"))
    .replace(/\{\{campo:([a-zA-Z0-9_]+)\}\}/g, (_, id: string) => {
      const valor = fieldValueOf(task, id);
      if (Array.isArray(valor)) return valor.join(", ");
      if (valor === undefined) return "—";
      const definition = state.fieldDefinitions.find((d) => d.id === id);
      if (definition?.type === "person") return state.members.find((m) => m.id === valor)?.displayName ?? String(valor);
      return String(valor);
    })
    .replace(/\{\{cnpjEmpresa\}\}/g, () => {
      const empresa = fieldValueOf(task, CP.fields.empresa);
      const cnpj = typeof empresa === "string" ? cnpjPorEmpresa?.[empresa] : undefined;
      return cnpj ? `${cnpj} (${String(empresa)})` : `da Empresa ${String(empresa ?? "—")}`;
    })
    .replace(/\{\{titulo\}\}/g, task.title)
    .replace(/\{\{vencimento\}\}/g, task.dueDate ? task.dueDate.value.slice(0, 10).split("-").reverse().join("/") : "—");
}

/* ───────────────────────────── Execução ───────────────────────────── */

/**
 * A costura entre a ponte HTTP do `apps/api` (03-11) e o motor: o que uma
 * rodada da agenda recebe de fora, quando recebe algo. `cnpjPorEmpresa` é
 * independente do lançamento (PAG-04 usa mesmo sem A7 estar em jogo);
 * `lancamento` é a união discriminada que decide se A7 ensaia ou lança.
 *
 * É união, não `rehearsal?: boolean`, de propósito: **lançar de verdade sem
 * dizer quais Tarefas o Omie confirmou não pode compilar.** `/lancar`
 * acontece FORA da transação (é rede); se uma conta falhasse lá e o domínio
 * publicasse o RESUMO e deixasse A8 mover o Status, a Tarefa diria "lançado
 * omie" sem nada lançado. `tarefasLancadas` é obrigatória exatamente no ramo
 * em que a caneta está na mão — o mesmo princípio do portão
 * `Confere<Igual<…>>` de 03-04: o erro dói na compilação, não em produção.
 */
export type OpcoesDaAgenda = { readonly cnpjPorEmpresa?: Readonly<Record<string, string>> } & (
  | { readonly lancamento?: undefined }
  | { readonly lancamento: { readonly dePara: DeParaDeLancamento; readonly rehearsal: true } }
  | { readonly lancamento: { readonly dePara: DeParaDeLancamento; readonly rehearsal: false; readonly tarefasLancadas: readonly Id[] } }
);

/**
 * O que uma Ação sabe da rodada em que está — montado por `execute` e passado
 * a `runAction`. Interno ao módulo de propósito: nenhuma assinatura exportada
 * muda por causa dele.
 *
 * `quando` é a base de tempo ÚNICA da Execução (relógio real pelo evento, o
 * `today` injetado pela agenda); `trigger` e `indice` são o que `aguardar`
 * precisa para recusar o que não pode retomar.
 */
interface ContextoDeExecucao {
  readonly quando: Date;
  readonly trigger: AutomationTrigger | undefined;
  readonly indice: number;
}

/** O que uma Ação devolve. `halt` é interno ao módulo: nenhuma assinatura exportada o conhece. */
interface ResultadoDeAcao {
  readonly ok: boolean;
  readonly output: string;
  readonly halt?: "encerrar" | "aguardar";
}

/**
 * Os alvos de uma Ação de controle, sem repetição e sem inventar Membro: de
 * `memberId`, de `mentionMemberIds` e de um Campo do tipo pessoa da Tarefa —
 * a mesma forma de resolução de `tarefa.adicionarObservadores`, mas em helper
 * próprio, para que nenhum caminho antigo mude de resultado.
 */
function membrosMencionados(state: DataState, task: Task, spec: ActionSpec): Id[] {
  const ids = new Set<Id>();
  if (spec.memberId) ids.add(spec.memberId);
  for (const id of spec.mentionMemberIds ?? []) ids.add(id);
  if (spec.fromFieldDefinitionId) {
    const pessoa = fieldValueOf(task, spec.fromFieldDefinitionId);
    if (typeof pessoa === "string" && pessoa) ids.add(pessoa);
  }
  return [...ids].filter((id) => state.members.some((m) => m.id === id));
}

/**
 * `aguardar` — três recusas antes de qualquer cálculo, porque a retomada de
 * uma Execução pendente roda a Execução do COMEÇO:
 *
 * 1. sob gatilho de evento não há quem retome;
 * 2. depois da primeira Ação, retomar repetiria o que já aconteceu;
 * 3. sem prazo declarado não há o que esperar.
 *
 * Cumprido o prazo, a Execução segue; não cumprido, ela para em `pendente` e
 * o dia seguinte reavalia.
 */
function esperaCumprida(task: Task, spec: ActionSpec, action: AutomationAction, contexto: ContextoDeExecucao): ResultadoDeAcao {
  if (contexto.trigger?.kind !== "condicaoTemporal") {
    return { ok: false, output: "“aguardar” exige gatilho de agenda: uma Execução de evento não tem quem a retome." };
  }
  if (contexto.indice > 0) {
    return { ok: false, output: "“aguardar” precisa ser a primeira Ação: a retomada roda a Execução do começo, então nada pode ter acontecido antes dela." };
  }
  const dias = spec.aguardarDias;
  const horas = spec.aguardarHoras ?? action.timeoutHours;
  if (dias === undefined && horas === undefined) {
    return { ok: false, output: "“aguardar” sem prazo: declare aguardarDias, aguardarHoras ou timeoutHours." };
  }
  const desde = spec.aguardarDesde ?? "vencimento";
  let base: Date | undefined;
  if (desde === "criacaoDaTarefa") base = new Date(task.createdAt);
  else if (task.dueDate) {
    const [y, m, d] = task.dueDate.value.slice(0, 10).split("-").map(Number);
    base = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  }
  if (!base) return { ok: false, output: `“aguardar” conta a partir do ${desde === "vencimento" ? "vencimento" : "início"}, e esta Tarefa não o tem.` };
  const prazo = new Date(base.getTime() + (dias ?? 0) * 86_400_000 + (horas ?? 0) * 3_600_000);
  if (contexto.quando.getTime() >= prazo.getTime()) return { ok: true, output: `Espera cumprida em ${diaCivil(prazo)}` };
  return { ok: true, halt: "aguardar", output: `Aguardando até ${diaCivil(prazo)}` };
}

/**
 * O alvo do Canal (D5-19, 2026-09-24, fechamento de lacunas de CR-02): a
 * Lista-alvo de AUTO-02 é "Solicitações de pagamento", nunca Contas a pagar
 * — o `automation/` só consegue ler Solicitações pelo contrato v1
 * (`apps/api/src/servicos/dto-solicitacao.ts`), e nenhuma combinação antiga
 * entregava uma mensagem. Derivadas do catálogo real (nunca literais soltos)
 * para que uma mudança no catálogo sem espelhar aqui quebre em
 * typecheck/import, não em produção — `campoDoCatalogo` também confere que o
 * id aponta para o Campo do rótulo esperado, não só que ele existe.
 */
export const CANAL_LISTA_ID: Id = SOLICITACAO_LISTA_ID;

function campoDoCatalogo(id: Id, rotuloEsperado: string): Id {
  const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.id === id);
  if (!campo || campo.rotulo !== rotuloEsperado) {
    throw new Error(`Catálogo da Solicitação sem o Campo "${rotuloEsperado}" (${id}) — CANAL_* de automations.ts desalinhado do catálogo real.`);
  }
  return campo.id;
}

/** `fld_sp_c_empresa` — a Empresa da Solicitação (nunca mais o Campo homônimo de Contas a pagar). */
export const CANAL_CAMPO_EMPRESA_ID: Id = campoDoCatalogo("fld_sp_c_empresa", "Empresa");
/** `fld_sp_z_whatsapp` — "Contato do solicitante" (D5-19): o único Campo aceito no modo `campo`. */
export const CANAL_CAMPO_WHATSAPP_ID: Id = campoDoCatalogo("fld_sp_z_whatsapp", "WhatsApp");

/**
 * O destino resolvido de uma notificação por Canal — nunca um número de
 * telefone (D5-03/D5-10): no modo `campo`, o que fica é o VALOR do Campo que
 * o Financeiro preencheu (o domínio só o lê para mascarar); no modo
 * `rotulos`, o que fica são os rótulos estáveis da Empresa (`mari`,
 * `marcos`, `grupo-financeiro`), nunca o número que eles representam no
 * ambiente do `automation/`.
 */
type DestinoDeCanal =
  | { readonly tipo: "campo"; readonly campoDestinoId: Id; readonly valor: string }
  | { readonly tipo: "rotulos"; readonly rotulos: readonly string[] };

/**
 * Resolve o destino de uma Ação de Canal, ou devolve o motivo da recusa.
 * PURA — nenhuma leitura de relógio, nenhum I/O. Em NENHUM caminho devolve
 * um destino padrão: destino vazio é sempre recusa (D5-10), nunca um
 * número/rótulo inventado.
 *
 * Ordem (D5-19): XOR dos dois modos → só Lista de Solicitações → Empresa
 * (lida de `fld_sp_c_empresa`) → Integração da Empresa com canal declarado
 * (vale para os DOIS modos — o par, no domínio, de `EMPRESA_SEM_CANAL` do
 * `automation/`, WR-02/plano 05-18: a instância Evolution é a do Marcos
 * Paulo, só Empresa com canal declarado pode ser notificada) → só então o
 * modo escolhido resolve o próprio destino.
 */
function destinoDeCanal(state: DataState, task: Task, spec: ActionSpec): DestinoDeCanal | { readonly recusa: string } {
  const porCampo = spec.canalCampoDestinoId !== undefined;
  const porEmpresa = spec.canalDestinatariosDaEmpresa === true;
  if (porCampo === porEmpresa) {
    return { recusa: "“notificar” por Canal sem destino declarado: escolha canalCampoDestinoId ou canalDestinatariosDaEmpresa, nunca os dois." };
  }
  if (task.listId !== CANAL_LISTA_ID) {
    return { recusa: "“notificar” por WhatsApp recusado: o Canal só notifica Solicitações de pagamento — nada foi enviado." };
  }
  const empresaValor = fieldValueOf(task, CANAL_CAMPO_EMPRESA_ID);
  const empresa = typeof empresaValor === "string" ? empresaValor.trim() : "";
  if (!empresa) {
    return { recusa: "“notificar” por WhatsApp recusado: a Tarefa não tem Empresa — nada foi enviado." };
  }
  const integracao = state.integrations.find((i) => i.empresa === empresa);
  if (!integracao) {
    return { recusa: `“notificar” por WhatsApp recusado: a Empresa “${empresa}” não tem Integração configurada — nada foi enviado.` };
  }
  const rotulosDaEmpresa = integracao.avisosPorCanal?.whatsapp;
  if (!rotulosDaEmpresa || rotulosDaEmpresa.length === 0) {
    return { recusa: `“notificar” por WhatsApp recusado: a Empresa “${empresa}” não declara destinatário de WhatsApp — nada foi enviado.` };
  }
  if (porCampo) {
    const campoDestinoId = spec.canalCampoDestinoId as Id;
    if (campoDestinoId !== CANAL_CAMPO_WHATSAPP_ID) {
      return { recusa: "“notificar” por WhatsApp recusado: o destino por Campo é o WhatsApp do solicitante — nada foi enviado." };
    }
    const valor = fieldValueOf(task, campoDestinoId);
    const texto = typeof valor === "string" ? valor.trim() : "";
    if (!texto) {
      const nome = state.fieldDefinitions.find((d) => d.id === campoDestinoId)?.name ?? campoDestinoId;
      return { recusa: `“notificar” por WhatsApp recusado: Campo “${nome}” vazio — nada foi enviado.` };
    }
    return { tipo: "campo", campoDestinoId, valor: texto };
  }
  return { tipo: "rotulos", rotulos: rotulosDaEmpresa };
}

/** Os quatro últimos caracteres, com `••••` fixo — nunca o valor por inteiro (T-5-18). */
const mascararDestino = (valor: string): string => (valor.length >= 4 ? `•••• ${valor.slice(-4)}` : "••••");

function runAction(
  state: DataState,
  automation: Automation,
  task: Task,
  action: AutomationAction,
  contexto: ContextoDeExecucao,
  opcoes?: OpcoesDaAgenda,
): ResultadoDeAcao {
  const owner = automation.ownerMemberId;
  const spec = parseJson<ActionSpec>(action.params) ?? {};
  if (action.kind === "controle") {
    switch (action.controlKind) {
      case "invocarAgente": {
        if (!action.agentId) break;
        // D3-03 — o Ensaio não encadeia A8: quem decide "ensaiar ou lançar" é
        // `opcoes.lancamento`, nunca um default. Ausente, o comportamento é
        // idêntico ao de antes desta task (5 argumentos, sem de-para injetado).
        if (opcoes?.lancamento?.rehearsal === false && !opcoes.lancamento.tarefasLancadas.includes(task.id)) {
          return { ok: false, output: "Lançamento não confirmado pelo Omie para esta conta." };
        }
        const opcoesDeLancamento = opcoes?.lancamento
          ? { dePara: opcoes.lancamento.dePara, rehearsal: opcoes.lancamento.rehearsal }
          : undefined;
        const r = runLancamentoAgent(state, owner, action.agentId, task.id, automation.id, opcoesDeLancamento);
        if (!r.ok) return { ok: false, output: r.error };
        // Ensaio: a Execução fecha "concluida" com UM passo (a Automação fez
        // exatamente o que lhe foi pedido — ensaiar) e o laço não alcança A8.
        // `ok: false` mentiria na direção oposta (falhou) e acionaria `jaRodou`
        // de dia falhado — por isso o canal é `halt`, não a recusa.
        if (opcoes?.lancamento?.rehearsal === true) return { ok: true, output: r.value, halt: "encerrar" };
        return { ok: true, output: r.value };
      }
      case "notificar": {
        // Canal (AUTO-02, D5-09/D3-02): a entrega por WhatsApp acontece FORA
        // do domínio — outbox → apps/api → automation/ → Evolution. Este
        // ramo só resolve o destino e produz texto/estado; nenhuma chamada
        // de rede, nenhum `await`, nenhum import novo de transporte aqui.
        if (spec.canal === "whatsapp") {
          if (!spec.canalMensagemId) {
            return { ok: false, output: '“notificar” por Canal sem mensagem: declare canalMensagemId ("gasto-novo" ou "relatorio").' };
          }
          const destino = destinoDeCanal(state, task, spec);
          if ("recusa" in destino) {
            // A recusa vira Registro de Atividade, nunca Comentário fantasma
            // (UI-SPEC §5): quem enxerga a Tarefa vê que a tentativa aconteceu
            // e por que ela não saiu.
            recordActivity(state, {
              actor: { kind: "automation", id: automation.id },
              action: "tentou notificar por WhatsApp e recusou",
              objectType: "task",
              objectId: task.id,
              objectName: task.title,
              detail: destino.recusa,
            });
            return { ok: false, output: destino.recusa };
          }
          // O número completo nunca vai para `detail` — a Timeline é vista
          // por todo Membro que enxerga a Tarefa (T-5-18); só os quatro
          // últimos caracteres, com `••••` fixo.
          const detail =
            destino.tipo === "campo"
              ? `Campo “${state.fieldDefinitions.find((d) => d.id === destino.campoDestinoId)?.name ?? destino.campoDestinoId}”: ${mascararDestino(destino.valor)}`
              : `destinatários: ${destino.rotulos.join(", ")}`;
          recordActivity(state, {
            actor: { kind: "automation", id: automation.id },
            action: "notificou por WhatsApp",
            objectType: "task",
            objectId: task.id,
            objectName: task.title,
            detail,
          });
          return { ok: true, output: `Notificação por WhatsApp enfileirada · ${detail}` };
        }
        if (!spec.template) return { ok: false, output: "“notificar” sem texto: declare `template` nos parâmetros da Ação." };
        const alvos = membrosMencionados(state, task, spec);
        if (!alvos.length) return { ok: false, output: "“notificar” sem alvo: declare memberId, mentionMemberIds ou fromFieldDefinitionId." };
        // O aviso é in-app nesta fase: um Comentário com Menção, que `pendingMentions`
        // entrega a quem ENXERGA a Tarefa. O canal WhatsApp está acima, neste mesmo `case`.
        const r = addTaskComment(state, owner, task.id, {
          content: fillTemplate(state, task, spec.template, opcoes?.cnpjPorEmpresa),
          mentions: alvos.map((id) => ({ type: "member", id })),
          actor: { kind: "automation", id: automation.id },
        });
        if (!r.ok) return { ok: false, output: r.error };
        return { ok: true, output: `Notificados: ${alvos.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ")}` };
      }
      case "solicitarAprovacao": {
        // T-3-07 — o Aprovador é NOMEADO: campo tipado da versão publicada ou
        // Campo do tipo pessoa da Tarefa. Nunca o dono da Automação por omissão.
        const doCampo = spec.approverFieldDefinitionId ? fieldValueOf(task, spec.approverFieldDefinitionId) : undefined;
        const aprovador = action.approverMemberId ?? (typeof doCampo === "string" && doCampo ? doCampo : undefined);
        if (!aprovador) return { ok: false, output: "“solicitarAprovacao” sem Aprovador: declare approverMemberId na versão ou approverFieldDefinitionId nos parâmetros." };
        if (!spec.template) return { ok: false, output: "“solicitarAprovacao” sem texto de roteamento: declare `template` nos parâmetros da Ação." };
        const comentario = addTaskComment(state, owner, task.id, {
          content: fillTemplate(state, task, spec.template, opcoes?.cnpjPorEmpresa),
          mentions: [{ type: "member", id: aprovador }],
          actor: { kind: "automation", id: automation.id },
        });
        if (!comentario.ok) return { ok: false, output: comentario.error };
        const r = solicitarAprovacaoDeProcesso(state, owner, {
          taskId: task.id,
          approverMemberId: aprovador,
          threadCommentId: comentario.value.id,
          ...(spec.motivo ? { reason: spec.motivo } : {}),
        });
        if (!r.ok) return { ok: false, output: r.error };
        return { ok: true, output: `Aprovação roteada a ${state.members.find((m) => m.id === r.value.approverMemberId)?.displayName ?? aprovador}` };
      }
      case "aguardar":
        return esperaCumprida(task, spec, action, contexto);
      case "encerrar":
        return { ok: true, halt: "encerrar", output: spec.motivo ?? "Encerrada pela própria Automação" };
      default:
        break;
    }
    // `ramificar` segue fora de escopo — e `invocarAgente` sem Agente cai aqui, como sempre caiu.
    return { ok: false, output: `Controle não suportado: ${action.controlKind ?? "?"}` };
  }
  switch (action.toolId) {
    case "tarefa.definirResponsavel": {
      if (!spec.memberId) return { ok: false, output: "Sem memberId." };
      for (const a of task.assignees.filter((x) => x.kind === "member" && x.id !== spec.memberId)) {
        const r = unassignTask(state, owner, task.id, a);
        if (!r.ok) return { ok: false, output: r.error };
      }
      const r = assignTask(state, owner, task.id, { kind: "member", id: spec.memberId });
      return r.ok ? { ok: true, output: `Responsável: ${state.members.find((m) => m.id === spec.memberId)?.displayName ?? spec.memberId}` } : { ok: false, output: r.error };
    }
    case "tarefa.removerResponsavel": {
      if (!spec.memberId) return { ok: false, output: "Sem memberId." };
      const atual = task.assignees.find((x) => x.kind === "member" && x.id === spec.memberId);
      if (!atual) return { ok: true, output: "Já não era Responsável" };
      const r = unassignTask(state, owner, task.id, atual);
      return r.ok ? { ok: true, output: `Saiu de Responsável: ${state.members.find((m) => m.id === spec.memberId)?.displayName ?? spec.memberId}` } : { ok: false, output: r.error };
    }
    case "tarefa.adicionarObservadores": {
      const ids = new Set<Id>(spec.memberIds ?? []);
      if (spec.fromFieldDefinitionId) {
        const pessoa = fieldValueOf(task, spec.fromFieldDefinitionId);
        if (typeof pessoa === "string" && pessoa) ids.add(pessoa);
      }
      const adicionados: string[] = [];
      for (const id of ids) {
        if (task.observerMemberIds.includes(id)) continue;
        const r = watchTask(state, owner, task.id, id, true);
        if (r.ok) adicionados.push(state.members.find((m) => m.id === id)?.displayName ?? id);
      }
      return { ok: true, output: adicionados.length ? `Observadores: ${adicionados.join(", ")}` : "Nenhum Observador novo" };
    }
    case "tarefa.alterarStatus": {
      const config = effectiveListConfig(state, task.listId);
      const alvo = config?.statusSet.definitions.find((d) => d.name.trim().toLocaleLowerCase("pt-BR") === (spec.statusName ?? "").trim().toLocaleLowerCase("pt-BR"));
      if (!alvo) return { ok: false, output: `Status “${spec.statusName ?? ""}” não existe nesta Lista.` };
      if (task.statusId === alvo.id) return { ok: true, output: `Já em “${alvo.name}”` };
      const r = changeTaskStatus(state, owner, task.id, alvo.id);
      if (r.ok) {
        // A Auditoria diz quem moveu de verdade: a Automação, em nome do dono.
        const registro = state.activity.find((a) => a.objectId === task.id && a.action === "Status alterado");
        if (registro) {
          const indice = state.activity.indexOf(registro);
          state.activity[indice] = { ...registro, actor: { kind: "automation", id: automation.id }, delegate: memberActor(owner) };
        }
      }
      return r.ok ? { ok: true, output: `Status: ${alvo.name}` } : { ok: false, output: r.error };
    }
    case "tarefa.comentar": {
      if (!spec.template) return { ok: false, output: "Sem texto." };
      const mentions: Array<{ type: string; id: Id }> = [];
      if (spec.mentionMemberId) mentions.push({ type: "member", id: spec.mentionMemberId });
      if (spec.mentionFieldDefinitionId) {
        const pessoa = fieldValueOf(task, spec.mentionFieldDefinitionId);
        if (typeof pessoa === "string" && pessoa) mentions.push({ type: "member", id: pessoa });
      }
      if (spec.mentionClientOwner) {
        const cliente = clienteDe(state, task);
        if (cliente) mentions.push({ type: "member", id: cliente.ownerMemberId });
      }
      // O autor é a Automação (em nome do dono): uma Menção ao próprio dono é lida como aviso, não como monólogo.
      const r = addTaskComment(state, owner, task.id, { content: fillTemplate(state, task, spec.template, opcoes?.cnpjPorEmpresa), mentions, actor: { kind: "automation", id: automation.id } });
      return r.ok ? { ok: true, output: "Comentário publicado" } : { ok: false, output: r.error };
    }
    case "tarefa.definirCampo": {
      if (!spec.definitionId) return { ok: false, output: "Sem definitionId." };
      const nome = state.fieldDefinitions.find((d) => d.id === spec.definitionId)?.name ?? spec.definitionId;
      if (spec.onlyIfEmpty && !isEmpty(fieldValueOf(task, spec.definitionId))) return { ok: true, output: `${nome} já preenchido` };
      // O dia civil de `today` é o da EXECUÇÃO — relógio real pelo evento, dia injetado pela agenda.
      const valor = spec.today ? diaCivil(contexto.quando) : spec.value;
      if (valor === undefined) return { ok: false, output: "Sem valor." };
      const r = setTaskFieldValue(state, owner, task.id, spec.definitionId, valor);
      return r.ok ? { ok: true, output: `${nome}: ${String(valor)}` } : { ok: false, output: r.error };
    }
    default:
      return { ok: false, output: `Ferramenta não suportada: ${action.toolId ?? "?"}` };
  }
}

function execute(state: DataState, automation: Automation, version: AutomationVersion, task: Task, quando?: Date, opcoes?: OpcoesDaAgenda): AutomationExecution {
  const base = new Date(instante(quando));
  const execution: AutomationExecution = {
    id: nextId("aex"),
    workspaceId: state.workspace.id,
    automationId: automation.id,
    automationVersion: version.number,
    state: "executando",
    triggerKind: version.trigger?.kind ?? "evento",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    invokedBy: { kind: "automation", id: automation.id },
    delegate: memberActor(automation.ownerMemberId),
    chain: { depth: 0, visitedAgentIds: [], visitedAutomationObjects: [{ automationId: automation.id, objectId: task.id }] },
    steps: [],
    childAgentExecutionIds: [],
    cost: { modelUnits: 0, toolCalls: 0, childExecutions: 0, durationMs: 0 },
    startedAt: instante(quando),
  };
  state.automationExecutions.push(execution);
  // `durationMs` é DURAÇÃO, não data civil: nenhum comportamento se ramifica
  // nela e nenhum teste pode ler o dia através dela. É a única leitura de
  // relógio que sobrevive neste arquivo fora de `instante`, e é deliberada.
  const inicio = Date.now();
  const acoes = [...version.actions].sort((a, b) => a.order - b.order);
  for (const [indice, action] of acoes.entries()) {
    const contexto: ContextoDeExecucao = { quando: base, trigger: version.trigger, indice };
    const result = runAction(state, automation, task, action, contexto, opcoes);
    execution.steps.push({
      index: execution.steps.length,
      kind: action.kind === "controle" ? "raciocinio" : "ferramenta",
      ...(action.toolId ? { toolId: action.toolId } : {}),
      input: action.params,
      output: result.output,
      toolAllowed: true,
      resourcePermitted: result.ok,
      result: result.halt === "aguardar" ? "aguardando" : result.ok ? "concluido" : "falhou",
      at: instante(quando),
    });
    if (action.kind === "controle" && action.agentId) execution.childAgentExecutionIds.push(...state.agentExecutions.filter((e) => e.invokedBy.kind === "automation" && e.invokedBy.id === automation.id && e.anchor?.id === task.id).map((e) => e.id).slice(-1));
    if (result.halt) {
      // Parou por desenho da própria Automação: o que vinha depois não
      // aconteceu, e a Execução diz isso passo a passo em vez de sumir com eles.
      for (const restante of acoes.slice(indice + 1)) {
        execution.steps.push({
          index: execution.steps.length,
          kind: restante.kind === "controle" ? "raciocinio" : "ferramenta",
          ...(restante.toolId ? { toolId: restante.toolId } : {}),
          input: restante.params,
          output: result.halt === "encerrar" ? "Pulado: a Automação encerrou antes." : "Pulado: a Automação está aguardando.",
          toolAllowed: true,
          resourcePermitted: true,
          result: "pulado",
          at: instante(quando),
        });
      }
      execution.state = result.halt === "encerrar" ? "concluida" : "pendente";
      execution.terminationReason = result.output;
      break;
    }
    if (!result.ok) {
      execution.state = "falhou";
      execution.terminationReason = result.output;
      break;
    }
  }
  if (execution.state === "executando") execution.state = "concluida";
  execution.endedAt = instante(quando);
  execution.cost = { ...execution.cost, toolCalls: execution.steps.length, durationMs: Date.now() - inicio };
  recordActivity(state, {
    actor: { kind: "automation", id: automation.id },
    action: execution.state === "falhou" ? "Automação falhou" : execution.state === "pendente" ? "Automação aguardando" : "Automação executada",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: automation.name,
    ...(execution.terminationReason ? { after: execution.terminationReason } : {}),
  });
  return execution;
}

function listAutomationsFor(state: DataState, task: Task): Array<{ automation: Automation; version: AutomationVersion }> {
  return state.automations
    .filter((a) => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === task.listId)
    .map((automation) => ({ automation, version: publishedVersion(automation) }))
    .filter((x): x is { automation: Automation; version: AutomationVersion } => x.version !== undefined);
}

/**
 * Reage a um evento de Tarefa. Chamada pelas operações que geram o evento
 * (`createTask`, `changeTaskStatus`) — nunca pela tela. Uma Automação não
 * reage aos próprios eventos (DO-AUT-11): a corrente é cortada pela pilha.
 */
let profundidade = 0;
export function runListAutomations(state: DataState, event: ListEvent): AutomationExecution[] {
  if (profundidade > 3) return [];
  const task = state.tasks.find((t) => t.id === event.taskId);
  if (!task) return [];
  const executions: AutomationExecution[] = [];
  profundidade += 1;
  try {
    for (const { automation, version } of listAutomationsFor(state, task)) {
      const trigger = version.trigger;
      if (!trigger || trigger.kind !== "evento" || trigger.eventType !== event.kind) continue;
      if (event.kind === "tarefaEntrouEmStatus") {
        const nome = statusDefinition(state, task.listId, event.statusId)?.name.trim().toLocaleLowerCase("pt-BR");
        if ((trigger.eventSubtype ?? "").trim().toLocaleLowerCase("pt-BR") !== nome) continue;
      }
      if (!conditionsHold(state, task, version)) continue;
      executions.push(execute(state, automation, version, task));
    }
  } finally {
    profundidade -= 1;
  }
  return executions;
}

/**
 * Gatilhos por proximidade do vencimento — o relógio do protótipo é a
 * chamada explícita com "hoje". Cada par (Automação, Tarefa) dispara uma vez.
 *
 * WR-11 — barreira do histórico importado. `MARCO_ZERO` (o instante que a
 * agenda usa para decidir A PARTIR DE QUE DIA semear `automacao_agenda`)
 * limita quais DIAS a agenda alcança, não quais TAREFAS o motor processa:
 * sem regra própria aqui, a primeira volta real depois de
 * `automacoes:liberar` trataria as ~240 contas importadas por
 * `importarContaAReceberHistorica` como se tivessem acabado de vencer — R2
 * moveria histórico "para receber" já resolvido para "pendente" (e R2b
 * marcaria Situação "em cobrança" atrás dele), e R4/R5 comentariam cobrança
 * sobre parcelas fechadas em 2025. A barreira: uma Tarefa com
 * `provenance.kind === "import"` nunca dispara um gatilho temporal cujo
 * `disparo` (vencimento + offset) seja anterior ao início do dia civil em
 * que ela foi importada (`provenance.at`) — estrita, então um disparo NO
 * PRÓPRIO dia da importação ainda executa.
 *
 * Por que `provenance.at` e não "passar o `MARCO_ZERO` para esta função":
 * as duas regras coincidem para as importações reais (as três importações —
 * Contas a pagar, Contas a receber, Solicitações — gravam `provenance.at`
 * com o instante real da importação, e `MARCO_ZERO` de
 * `(ws_n1, lst_contas_a_receber)` é o mesmo dia). Mas esta função tem TRÊS
 * chamadores — a agenda (`scheduler-worker.ts`), a operação
 * `POST /operacoes/runScheduledAutomations` e o botão da tela
 * (`bulk-status-bar.tsx`/`contas-view.tsx`) — e só o primeiro conhece
 * `automacao_agenda`. Uma regra por proveniência (dado da própria Tarefa) é
 * pura, não muda a assinatura desta função, e fecha os três caminhos de uma
 * vez só.
 */
export function runScheduledAutomations(
  state: DataState,
  actingMemberId: Id,
  listId: Id,
  today: Date,
  opcoes?: OpcoesDaAgenda,
): OperationResult<{ readonly executed: number; readonly failed: number; readonly skipped: number; readonly failures: ReadonlyArray<{ readonly taskId: Id; readonly title: string; readonly reason: string }> }> {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return fail("Só um Membro ativo roda as Automações.");
  const list = state.lists.find((l) => l.id === listId);
  if (!list) return fail("Lista não encontrada.");
  // Rodar o relógio da Lista é administrá-la: as Automações agem em nome dos donos.
  const admin = containerAdminRefusal(state, actingMemberId, "list", listId);
  if (admin) return fail(admin);
  const hoje = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let executed = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ taskId: Id; title: string; reason: string }> = [];
  for (const task of state.tasks.filter((t) => t.listId === listId && !t.parentTaskId && effectiveLifecycleOfTask(state, t.id) === "ativo")) {
    if (!memberSeesTask(state, actingMemberId, task.id)) continue;
    for (const { automation, version } of listAutomationsFor(state, task)) {
      const trigger = version.trigger;
      if (!trigger || trigger.kind !== "condicaoTemporal") continue;
      const spec = parseJson<TemporalSpec>(trigger.temporalPredicate);
      if (!spec || !task.dueDate) continue;
      const [y, m, d] = task.dueDate.value.slice(0, 10).split("-").map(Number);
      const disparo = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + spec.dueDateOffsetDays).getTime();
      if (hoje < disparo) continue;
      // WR-11 — barreira do histórico importado (ver o doc-comment da
      // função): o disparo é estritamente ANTERIOR ao início do dia civil
      // da importação, nunca "anterior ou igual" — no próprio dia da
      // importação, o gatilho ainda executa normalmente.
      if (task.provenance?.kind === "import") {
        const importado = new Date(task.provenance.at);
        const inicioDoDiaDaImportacao = new Date(importado.getFullYear(), importado.getMonth(), importado.getDate()).getTime();
        if (disparo < inicioDoDiaDaImportacao) {
          skipped += 1;
          continue;
        }
      }
      // Concluída: nunca repete. Falhou ou ficou pendente: reavalia só em
      // outro dia — senão cada clique em "rodar" gera outro Comentário de
      // "falta X", ou empilha uma segunda espera que ainda não venceu.
      const jaRodou = state.automationExecutions.some(
        (e) =>
          e.automationId === automation.id &&
          e.objectId === task.id &&
          (e.state === "concluida" || ((e.state === "falhou" || e.state === "pendente") && mesmoDiaCivil(e.startedAt, today))),
      );
      if (jaRodou) {
        skipped += 1;
        continue;
      }
      if (!conditionsHold(state, task, version)) {
        skipped += 1;
        continue;
      }
      // A linha que amarra o relógio injetado à Execução que ele produz.
      const execution = execute(state, automation, version, task, today, opcoes);
      if (execution.state === "concluida") executed += 1;
      else {
        failed += 1;
        failures.push({ taskId: task.id, title: task.title, reason: execution.terminationReason ?? automation.name });
      }
    }
  }
  return ok({ executed, failed, skipped, failures });
}

/* ───────────────────────── Pedido de Canal (AUTO-02) ───────────────────────── */

/**
 * O pedido pobre que o `apps/api` (05-07) lê para gravar no outbox — nunca o
 * VALOR do Campo nem o número que um rótulo representa: a mesma doutrina de
 * payload pobre de `apps/api/src/persistencia/outbox.ts`, quem precisa do
 * número de verdade busca a Tarefa de volta com a credencial de serviço.
 */
export interface PedidoDeNotificacaoPorCanal {
  readonly taskId: Id;
  readonly automationId: Id;
  readonly executionId: Id;
  /**
   * WR-04 — a posição deste passo em `execucao.steps` (o mesmo `step.index`
   * que `execute()` grava). Uma Execução com dois passos de Canal produz dois
   * pedidos com o MESMO `executionId` e `indicePasso` 0/1 — é só o que
   * alimenta `aggregateId = <executionId>:<indicePasso>` no `apps/api`
   * (05-13 Task 2); nada disso atravessa o payload de
   * `automacao.notificar-canal.v1`, que não muda.
   */
  readonly indicePasso: number;
  readonly canal: "whatsapp";
  readonly destinoTipo: "campo" | "rotulos";
  readonly campoDestinoId?: Id;
  readonly rotulos?: readonly string[];
  readonly mensagemId: "gasto-novo" | "relatorio";
}

/**
 * PURA e determinística: para cada Execução da lista, para cada passo de
 * Canal `concluido`, re-resolve o destino chamando a MESMA `destinoDeCanal`
 * usada em `runAction` — nunca lendo o texto de `step.output`, que é para
 * humano, não contrato.
 */
export function pedidosDeNotificacaoPorCanal(state: DataState, execucoes: readonly AutomationExecution[]): readonly PedidoDeNotificacaoPorCanal[] {
  const pedidos: PedidoDeNotificacaoPorCanal[] = [];
  for (const execucao of execucoes) {
    const task = state.tasks.find((t) => t.id === execucao.objectId);
    if (!task) continue;
    for (const step of execucao.steps) {
      if (step.result !== "concluido") continue;
      const spec = parseJson<ActionSpec>(step.input);
      if (!spec || spec.canal !== "whatsapp" || !spec.canalMensagemId) continue;
      // A resolução falhar aqui não deveria acontecer (o passo só chega a
      // `concluido` quando `destinoDeCanal` já devolveu um destino) — a
      // guarda é barata e evita depender de invariante silenciosa.
      const destino = destinoDeCanal(state, task, spec);
      if ("recusa" in destino) continue;
      pedidos.push({
        taskId: task.id,
        automationId: execucao.automationId,
        executionId: execucao.id,
        indicePasso: step.index,
        canal: "whatsapp",
        destinoTipo: destino.tipo,
        ...(destino.tipo === "campo" ? { campoDestinoId: destino.campoDestinoId } : { rotulos: destino.rotulos }),
        mensagemId: spec.canalMensagemId,
      });
    }
  }
  return pedidos;
}

