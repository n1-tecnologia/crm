/**
 * Leituras derivadas da área de IA (docs 17–20). Nada aqui é gravado:
 * Versão corrente, Disponibilidade de Concessão e de Agente, Conhecimento
 * acessível e "inoperante" são recomputados do estado a cada leitura, como
 * a ontologia exige (18, 7.2; 17, 11.4; 20, DO-CNH-12; 19, 11.1). Telas e
 * operações leem daqui a mesma verdade.
 */

import type { DataState } from "./state";
import type {
  Agent,
  AgentVersion,
  Automation,
  AutomationVersion,
  Collection,
  Fragment,
  Id,
  Lifecycle,
  Skill,
  SkillGrant,
  SkillVersion,
  Tool,
} from "./types";
import { containerPath, type PathNode } from "./derive";
import { nextId } from "./operations/activity";
import { recusaDeGovernarAgente } from "./operations/ia/permissoes-ia";
import { escopoExiste, eventoDoCatalogo } from "./operations/ia/automacoes-catalogo";

// ── Habilidade ─────────────────────────────────────────────────────────────

/** 18, 6 — a corrente é a `publicada` de maior número; podem coexistir várias (B71). */
export function versaoCorrenteDaHabilidade(skill: Skill): SkillVersion | undefined {
  let corrente: SkillVersion | undefined;
  for (const v of skill.versions) {
    if (v.state === "publicada" && (!corrente || v.number > corrente.number)) corrente = v;
  }
  return corrente;
}

/** RN-HAB-04 — no máximo um rascunho por Habilidade. */
export const rascunhoDaHabilidade = (skill: Skill): SkillVersion | undefined =>
  skill.versions.find((v) => v.state === "rascunho");

/** A Versão que uma Dependência exerce: a fixada, ou a corrente. */
function versaoDaDependencia(skill: Skill, pinnedVersion: number | undefined): SkillVersion | undefined {
  if (pinnedVersion === undefined) return versaoCorrenteDaHabilidade(skill);
  return skill.versions.find((v) => v.number === pinnedVersion);
}

export type EfeitoDeclarado = "nenhum" | "reversivel" | "irreversivel" | "externa";

const GRAU_DO_EFEITO: Record<EfeitoDeclarado, number> = { nenhum: 0, reversivel: 1, irreversivel: 2, externa: 3 };

const efeitoDaFerramenta = (tool: Tool | undefined): EfeitoDeclarado => {
  switch (tool?.effectClass) {
    case "escritaReversivel":
      return "reversivel";
    case "escritaIrreversivel":
      return "irreversivel";
    case "externa":
      return "externa";
    default:
      return "nenhum";
  }
};

const maiorEfeito = (a: EfeitoDeclarado, b: EfeitoDeclarado): EfeitoDeclarado => (GRAU_DO_EFEITO[a] >= GRAU_DO_EFEITO[b] ? a : b);

/** B73 — as Dependências formam um grafo acíclico de até 3 níveis; o fecho para aí. */
const PROFUNDIDADE_MAXIMA = 3;

/**
 * O efeito que a Versão declara: o máximo entre as classes das Ferramentas
 * requeridas e das Dependências (fecho ≤ 3 níveis). É o que o diálogo de
 * Concessão mostra antes de conceder a um Agente `autonomo` (RN-HAB-11).
 */
export function efeitoDeclarado(state: DataState, version: SkillVersion): EfeitoDeclarado {
  const visitadas = new Set<Id>();
  const efeitoDe = (v: SkillVersion, nivel: number): EfeitoDeclarado => {
    let efeito: EfeitoDeclarado = "nenhum";
    for (const req of v.toolRequirements) {
      efeito = maiorEfeito(efeito, efeitoDaFerramenta(state.tools.find((t) => t.id === req.toolId)));
    }
    if (nivel >= PROFUNDIDADE_MAXIMA) return efeito;
    for (const dep of v.dependencies) {
      if (visitadas.has(dep.skillId)) continue;
      visitadas.add(dep.skillId);
      const skill = state.skills.find((s) => s.id === dep.skillId);
      const alvo = skill ? versaoDaDependencia(skill, dep.pinnedVersion) : undefined;
      if (alvo) efeito = maiorEfeito(efeito, efeitoDe(alvo, nivel + 1));
    }
    return efeito;
  };
  return efeitoDe(version, 0);
}

export type Disponibilidade = { readonly disponivel: true } | { readonly disponivel: false; readonly motivos: readonly string[] };

const disponibilidadeDe = (motivos: readonly string[]): Disponibilidade => (motivos.length === 0 ? { disponivel: true } : { disponivel: false, motivos });

/** A Versão que vale para o Agente: a de maior número (B74). */
export function versaoCorrenteDoAgente(agent: Agent): AgentVersion | undefined {
  let corrente: AgentVersion | undefined;
  for (const v of agent.versions) if (!corrente || v.number > corrente.number) corrente = v;
  return corrente;
}

function motivosDaConcessao(
  state: DataState,
  grant: Pick<SkillGrant, "agentId" | "skillId" | "pinnedVersion">,
  visitadas: Set<Id>,
): string[] {
  const motivos: string[] = [];
  const skill = state.skills.find((s) => s.id === grant.skillId);
  if (!skill) return ["Habilidade não encontrada"];
  if (skill.lifecycle === "arquivado") motivos.push("Habilidade arquivada");
  if (skill.lifecycle === "naLixeira") motivos.push("Habilidade na lixeira");

  // 18, 7.2 — a Versão exercível: a fixada precisa continuar publicada; sem fixação, a corrente.
  let version: SkillVersion | undefined;
  if (grant.pinnedVersion !== undefined) {
    version = skill.versions.find((v) => v.number === grant.pinnedVersion);
    if (!version) motivos.push(`Versão fixada ${grant.pinnedVersion} inexistente`);
    else if (version.state === "obsoleta") motivos.push(`Versão fixada ${grant.pinnedVersion} obsoleta`);
    else if (version.state === "rascunho") motivos.push(`Versão fixada ${grant.pinnedVersion} não publicada`);
  } else {
    version = versaoCorrenteDaHabilidade(skill);
    if (!version) motivos.push("sem Versão publicada");
  }
  if (!version) return motivos;

  // RN-HAB-13 / RN-HAB-18 — cada Ferramenta obrigatória: permitida ao Agente E, se de Integração, conectada.
  const agent = state.agents.find((a) => a.id === grant.agentId);
  const permitidas = agent ? (versaoCorrenteDoAgente(agent)?.allowedToolIds ?? []) : [];
  for (const req of version.toolRequirements) {
    if (!req.mandatory) continue;
    const tool = state.tools.find((t) => t.id === req.toolId);
    const nome = tool?.name ?? req.toolId;
    if (!permitidas.includes(req.toolId)) motivos.push(`Ferramenta obrigatória “${nome}” não permitida ao Agente`);
    if (tool?.origin === "integracao") {
      const integration = state.integrations.find((i) => i.id === tool.integrationId);
      if (!integration || integration.state !== "conectada") motivos.push(`Ferramenta “${nome}” de Integração desconectada`);
    }
  }

  // B73 — uma Dependência indisponível para este Agente torna a Concessão indisponível.
  for (const dep of version.dependencies) {
    if (visitadas.has(dep.skillId)) continue;
    visitadas.add(dep.skillId);
    const dependente = state.skills.find((s) => s.id === dep.skillId);
    const nome = dependente?.name ?? dep.skillId;
    const sub = motivosDaConcessao(
      state,
      { agentId: grant.agentId, skillId: dep.skillId, ...(dep.pinnedVersion !== undefined ? { pinnedVersion: dep.pinnedVersion } : {}) },
      visitadas,
    );
    if (sub.length > 0) motivos.push(`Dependência “${nome}” indisponível`);
  }
  return motivos;
}

/**
 * 18, 7.2 — a Disponibilidade é da Concessão, não da Habilidade: a mesma
 * Habilidade é `disponível` para um Agente e `indisponível` para outro.
 * Recalculada a cada consulta; nunca gravada.
 */
export function disponibilidadeDaConcessao(state: DataState, grant: Pick<SkillGrant, "agentId" | "skillId" | "pinnedVersion">): Disponibilidade {
  return disponibilidadeDe(motivosDaConcessao(state, grant, new Set<Id>([grant.skillId])));
}

// ── Agente ─────────────────────────────────────────────────────────────────

const ESTADO_DO_AGENTE: Record<Agent["lifecycle"], string | undefined> = {
  ativo: undefined,
  rascunho: "Agente em rascunho",
  pausado: "Agente pausado",
  arquivado: "Agente arquivado",
  naLixeira: "Agente na lixeira",
};

/**
 * 17, 11.4 — não ativo, Modelo descontinuado ou inexistente, sem objetivo ou
 * instruções (RN-AGE-07). É o que a ficha mostra e o que ativar verifica.
 */
export function disponibilidadeDoAgente(state: DataState, agent: Agent): Disponibilidade {
  const motivos: string[] = [];
  const estado = ESTADO_DO_AGENTE[agent.lifecycle];
  if (estado) motivos.push(estado);
  if (state.workspace.state === "suspenso") motivos.push("Espaço de Trabalho suspenso");
  const version = versaoCorrenteDoAgente(agent);
  if (!version) {
    motivos.push("sem Versão");
    return disponibilidadeDe(motivos);
  }
  if (version.modelId !== "padraoDaPlataforma") {
    const model = state.models.find((m) => m.id === version.modelId);
    if (!model) motivos.push("Modelo inexistente");
    else if (model.discontinued) motivos.push(`Modelo “${model.name}” descontinuado`);
  }
  if (!version.objective.trim()) motivos.push("sem objetivo");
  if (!version.instructions.trim()) motivos.push("sem instruções");
  return disponibilidadeDe(motivos);
}

/** DO-CNH-12 — "Conhecimento acessível" é visão derivada das Concessões gravadas na Coleção; uma Coleção não ativa não é consultável. */
export function conhecimentoAcessivel(state: DataState, agentId: Id): Collection[] {
  const ids = new Set(state.collectionGrants.filter((g) => g.agentId === agentId).map((g) => g.collectionId));
  return state.collections.filter((c) => ids.has(c.id) && c.lifecycle === "ativo");
}

/** Os Agentes que o Membro governa (`editar`) e que ainda recebem Concessões — os diálogos "Dar a um Agente". */
export function agentesGovernaveisPor(state: DataState, memberId: Id): Agent[] {
  return state.agents.filter(
    (a) => a.lifecycle !== "arquivado" && a.lifecycle !== "naLixeira" && recusaDeGovernarAgente(state, memberId, a, "editar") === undefined,
  );
}

// ── Automação ──────────────────────────────────────────────────────────────

/** DO-AUT-19 — só uma `publicada` por vez; a vigente é a de maior número. */
export function versaoVigenteDaAutomacao(automation: Automation): AutomationVersion | undefined {
  let vigente: AutomationVersion | undefined;
  for (const v of automation.versions) {
    if (v.state === "publicada" && (!vigente || v.number > vigente.number)) vigente = v;
  }
  return vigente;
}

/** INV-AUT-02 — no máximo um rascunho por Automação. */
export const rascunhoDaAutomacao = (automation: Automation): AutomationVersion | undefined =>
  automation.versions.find((v) => v.state === "rascunho");

const ROTULO_DO_ESCOPO: Record<Automation["scopeType"], string> = {
  workspace: "Espaço de Trabalho",
  space: "Espaço",
  folder: "Pasta",
  list: "Lista",
  funnel: "Funil",
  inbox: "Caixa de Entrada",
  queue: "Fila",
  grupo: "Grupo",
  comunidade: "Comunidade",
  flow: "Flow",
};

const RESTRICAO: Record<Lifecycle, number> = { ativo: 0, arquivado: 1, naLixeira: 2 };

/** B36 — o estado efetivo de um contêiner é o mais restritivo da sua cadeia, do Espaço até ele. */
function estadoEfetivoDoConteiner(state: DataState, type: PathNode["type"], id: Id): Lifecycle | undefined {
  const cadeia = containerPath(state, type, id);
  if (cadeia.length === 0 || cadeia[cadeia.length - 1]?.id !== id) return undefined;
  let efetivo: Lifecycle = "ativo";
  for (const node of cadeia) {
    const registro =
      node.type === "space" ? state.spaces.find((s) => s.id === node.id) : node.type === "folder" ? state.folders.find((f) => f.id === node.id) : state.lists.find((l) => l.id === node.id);
    const proprio = registro?.lifecycle ?? "ativo";
    if (RESTRICAO[proprio] > RESTRICAO[efetivo]) efetivo = proprio;
  }
  return efetivo;
}

/** O estado efetivo do escopo: Lista/Pasta/Espaço pela cadeia (B36); o resto pelo próprio registro. */
function estadoDoEscopo(state: DataState, automation: Automation): Lifecycle | "suspenso" | "encerrado" | undefined {
  const id = automation.scopeId;
  switch (automation.scopeType) {
    case "workspace":
      return state.workspace.id === id ? state.workspace.state : undefined;
    case "list":
    case "folder":
    case "space":
      return estadoEfetivoDoConteiner(state, automation.scopeType, id);
    case "funnel":
      return state.funnels.find((f) => f.id === id)?.lifecycle;
    case "inbox":
      return state.inbox.id === id ? "ativo" : undefined;
    case "queue":
      return state.queues.find((q) => q.id === id)?.lifecycle;
    case "grupo":
      return state.grupos.find((g) => g.id === id)?.lifecycle;
    case "comunidade":
      return state.comunidades.find((c) => c.id === id)?.lifecycle;
    case "flow":
      return state.flows.find((f) => f.id === id)?.lifecycle;
  }
}

/**
 * RN-AUT-21 — a Habilidade indicada numa Condição híbrida ou numa Ação
 * "invocar Agente" que já não serve: inexistente, não concedida ao Agente ou
 * com a Concessão indisponível (arquivada, sem Versão corrente, Versão fixada
 * obsoleta, Ferramenta obrigatória não permitida — 18, 7.2 e 12.3).
 */
function habilidadeInvalida(state: DataState, agent: Agent, skillId: Id, onde: "Condição híbrida" | "Ação"): string | undefined {
  const skill = state.skills.find((s) => s.id === skillId);
  if (!skill) return `Habilidade da ${onde} não existe`;
  const grant = state.skillGrants.find((g) => g.agentId === agent.id && g.skillId === skill.id);
  if (!grant) return `Habilidade “${skill.name}” não concedida ao Agente “${agent.name}”`;
  const disponibilidade = disponibilidadeDaConcessao(state, grant);
  if (!disponibilidade.disponivel) return `Habilidade “${skill.name}” indisponível para o Agente “${agent.name}” (${disponibilidade.motivos.join(" · ")})`;
  return undefined;
}

/** RN-AUT-21 — a primeira referência inválida da Versão vigente, com motivo. */
function referenciaInvalida(state: DataState, version: AutomationVersion): string | undefined {
  if (version.trigger?.kind === "evento" && !eventoDoCatalogo(version.trigger.eventType)) {
    return `Evento “${version.trigger.eventType ?? "—"}” fora do catálogo`;
  }
  for (const condition of version.conditions) {
    if (condition.kind !== "hibrida") continue;
    const agent = state.agents.find((a) => a.id === condition.agentId);
    if (!agent) return "Agente da Condição híbrida não existe";
    if (agent.lifecycle !== "ativo") return `Agente “${agent.name}” não está ativo`;
    const habilidade = condition.skillId ? habilidadeInvalida(state, agent, condition.skillId, "Condição híbrida") : undefined;
    if (habilidade) return habilidade;
  }
  for (const action of [...version.actions].sort((a, b) => a.order - b.order)) {
    if (action.kind === "escrita") {
      const tool = state.tools.find((t) => t.id === action.toolId);
      if (!tool) return `Ferramenta “${action.toolId ?? "—"}” não existe no Catálogo`;
      if (tool.origin === "integracao") {
        const integration = state.integrations.find((i) => i.id === tool.integrationId);
        if (!integration || integration.state !== "conectada") return `Integração da Ferramenta “${tool.name}” desconectada`;
      }
    }
    if (action.controlKind === "invocarAgente") {
      const agent = state.agents.find((a) => a.id === action.agentId);
      if (!agent) return "Agente da Ação não existe";
      if (agent.lifecycle !== "ativo") return `Agente “${agent.name}” não está ativo`;
      const habilidade = action.skillId ? habilidadeInvalida(state, agent, action.skillId, "Ação") : undefined;
      if (habilidade) return habilidade;
    }
  }
  return undefined;
}

/**
 * 19, 11.1 — "inoperante" não é estado gravado: é a condição de uma Automação
 * `ativo` cujo escopo não está efetivamente ativo (B41), cujo Espaço de
 * Trabalho ou Proprietário está suspenso (B31, RN-AUT-04) ou cuja Versão
 * vigente contém referência inválida (RN-AUT-21). Devolve o motivo; cessa sem
 * ato quando a causa cessa.
 */
export function inoperante(state: DataState, automation: Automation): string | undefined {
  if (automation.lifecycle !== "ativo") return undefined;
  if (state.workspace.state === "suspenso") return "Espaço de Trabalho suspenso";
  const rotulo = ROTULO_DO_ESCOPO[automation.scopeType];
  if (!escopoExiste(state, automation.scopeType, automation.scopeId)) return `escopo eliminado (${rotulo})`;
  const estado = estadoDoEscopo(state, automation);
  if (estado === "arquivado") return `escopo arquivado (${rotulo})`;
  if (estado === "naLixeira") return `escopo na lixeira (${rotulo})`;
  if (estado === "suspenso" || estado === "encerrado") return "Espaço de Trabalho suspenso";
  const owner = state.members.find((m) => m.id === automation.ownerMemberId);
  if (!owner || owner.state === "removido") return "Proprietário removido";
  if (owner.state === "suspenso") return "Proprietário suspenso";
  if (owner.state === "pendente") return "Proprietário pendente";
  const vigente = versaoVigenteDaAutomacao(automation);
  if (!vigente) return "sem Versão vigente";
  const invalida = referenciaInvalida(state, vigente);
  return invalida ? `referência inválida: ${invalida}` : undefined;
}

// ── Conhecimento ───────────────────────────────────────────────────────────

/**
 * D9 — o processamento simulado: um Fragmento por parágrafo (linhas em
 * branco separam), com localizador `p<n>`. B97: derivado e regenerável, criado
 * só pelo Sistema.
 */
export function fragmentarTexto(texto: string): Fragment[] {
  return texto
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((derivedContent, order) => ({
      id: nextId("frg"),
      position: { order, locator: `p${order + 1}` },
      derivedContent,
    }));
}
