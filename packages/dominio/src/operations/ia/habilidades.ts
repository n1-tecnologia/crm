/**
 * As operações sobre Habilidades (18): criar, copiar da plataforma, editar
 * nome e descrição, as Versões (um rascunho por vez — RN-HAB-04; publicar
 * valida — RN-HAB-06; a publicada anterior permanece — B71; obsoletar;
 * descartar), arquivar/restaurar e as Concessões a Agentes (conceder, fixar
 * Versão, revogar — RN-HAB-12). Conceder e revogar criam Versão de Agente
 * (D8, RN-AGE-06), porque mudam o comportamento dele.
 *
 * Toda recusa fala pela voz de `permissoes-ia`; as leituras (corrente,
 * rascunho, Disponibilidade) vêm de `derive-ia`. Versões não têm id (D4):
 * o realce das telas acende a Habilidade ou o Agente.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { ActorRef, Agent, AgentVersion, Id, Skill, SkillGrant, SkillParameter, SkillVersion } from "../../types";
import { rascunhoDaHabilidade, versaoCorrenteDaHabilidade, versaoCorrenteDoAgente } from "../../derive-ia";
import { memberActor, nextId, recordActivity } from "../activity";
import { copiarConteudoDaVersao, montarVersaoDoAgente } from "./agentes";
import { recusaDeConvidado, recusaDeGovernarAgente, recusaDeGovernarHabilidade, recusaDeMembroAtivo } from "./permissoes-ia";

const now = (): string => new Date().toISOString();

const skillPorId = (state: DataState, id: Id): Skill | undefined => state.skills.find((s) => s.id === id);
const agentePorId = (state: DataState, id: Id): Agent | undefined => state.agents.find((a) => a.id === id);

function registrarNaHabilidade(
  state: DataState,
  skill: Skill,
  input: { readonly actor: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string },
): void {
  recordActivity(state, { ...input, objectType: "skill", objectId: skill.id, objectName: skill.name });
}

function registrarNoAgente(
  state: DataState,
  agent: Agent,
  input: { readonly actor: ActorRef; readonly action: string; readonly before?: string; readonly after?: string; readonly detail?: string },
): void {
  recordActivity(state, { ...input, objectType: "agent", objectId: agent.id, objectName: agent.name });
}

// ── Nome (RN-HAB-02) ───────────────────────────────────────────────────────

const nomeNormalizado = (nome: string): string => nome.trim().toLocaleLowerCase("pt-BR");

/**
 * RN-HAB-02 — único entre Habilidades `ativo` ou `arquivado` do Espaço de
 * Trabalho, sem distinção de maiúsculas e espaços nas extremidades; `na
 * lixeira` não reserva; as da plataforma têm espaço de nomes próprio.
 */
function nomeEmUso(state: DataState, nome: string, excetoId?: Id): boolean {
  const alvo = nomeNormalizado(nome);
  return state.skills.some((s) => s.id !== excetoId && s.ownership === "workspace" && s.lifecycle !== "naLixeira" && nomeNormalizado(s.name) === alvo);
}

// ── Versões (imutáveis depois de publicadas: copiar é a única forma de partir de uma) ──

const copiarParametro = (p: SkillParameter): SkillParameter => ({ name: p.name.trim(), type: p.type, required: p.required, description: p.description });

type Dependencia = SkillVersion["dependencies"][number];
type Ferramenta = SkillVersion["toolRequirements"][number];

const copiarDependencia = (d: Dependencia): Dependencia => ({ skillId: d.skillId, ...(d.pinnedVersion !== undefined ? { pinnedVersion: d.pinnedVersion } : {}) });
const copiarFerramenta = (f: Ferramenta): Ferramenta => ({ toolId: f.toolId, mandatory: f.mandatory });

/** A Versão 1 de uma Habilidade nova: rascunho vazio, que só devolve texto. */
function versaoVazia(number: number): SkillVersion {
  return {
    number,
    state: "rascunho",
    instructions: "",
    inputContract: [],
    outputContract: { structured: [], text: true },
    toolRequirements: [],
    dependencies: [],
    recommendedCollectionIds: [],
    createdAt: now(),
  };
}

/** Cópia profunda de uma Versão como rascunho novo; Publicador e momento de publicação não acompanham. */
function copiarComoRascunho(origem: SkillVersion, number: number): SkillVersion {
  return {
    number,
    state: "rascunho",
    instructions: origem.instructions,
    inputContract: origem.inputContract.map(copiarParametro),
    outputContract: { structured: origem.outputContract.structured.map(copiarParametro), text: origem.outputContract.text },
    toolRequirements: origem.toolRequirements.map(copiarFerramenta),
    dependencies: origem.dependencies.map(copiarDependencia),
    recommendedCollectionIds: [...origem.recommendedCollectionIds],
    createdAt: now(),
  };
}

const ultimaVersao = (skill: Skill): SkillVersion | undefined => {
  let ultima: SkillVersion | undefined;
  for (const v of skill.versions) if (!ultima || v.number > ultima.number) ultima = v;
  return ultima;
};

const proximoNumero = (skill: Skill): number => (ultimaVersao(skill)?.number ?? 0) + 1;

// ── Dependências (RN-HAB-08) ───────────────────────────────────────────────

/** B73 — as Dependências formam um grafo acíclico de até 3 níveis abaixo da raiz. */
const PROFUNDIDADE_MAXIMA = 3;

/**
 * A Versão que uma Dependência exerce: a fixada, senão a corrente, senão a
 * última — um rascunho conta enquanto nada foi publicado, porque é a cadeia
 * que ele abrirá ao ser publicado.
 */
function versaoExercida(skill: Skill, pinnedVersion: number | undefined): SkillVersion | undefined {
  if (pinnedVersion !== undefined) return skill.versions.find((v) => v.number === pinnedVersion);
  return versaoCorrenteDaHabilidade(skill) ?? ultimaVersao(skill);
}

/**
 * A profundidade da cadeia que uma Dependência abre abaixo da raiz (1 = só
 * ela), ou `ciclo` quando o fecho volta à raiz — ou a um nó já no caminho.
 */
function profundidadeDaCadeia(state: DataState, raizId: Id, dep: Dependencia, caminho: Set<Id>): number | "ciclo" {
  if (dep.skillId === raizId || caminho.has(dep.skillId)) return "ciclo";
  const skill = skillPorId(state, dep.skillId);
  const versao = skill ? versaoExercida(skill, dep.pinnedVersion) : undefined;
  if (!versao) return 1;
  caminho.add(dep.skillId);
  let maior = 0;
  for (const sub of versao.dependencies) {
    const r = profundidadeDaCadeia(state, raizId, sub, caminho);
    if (r === "ciclo") return "ciclo";
    if (r > maior) maior = r;
  }
  caminho.delete(dep.skillId);
  return 1 + maior;
}

const nomeDaHabilidade = (state: DataState, id: Id): string => skillPorId(state, id)?.name ?? id;

/** RN-HAB-08 sobre uma Dependência: a frase da recusa, ou nada. Rejeitada no rascunho e revalidada na publicação. */
function recusaDaDependencia(state: DataState, skill: Skill, dep: Dependencia): string | undefined {
  if (dep.skillId === skill.id) return "Uma Habilidade não depende de si mesma (RN-HAB-08).";
  const r = profundidadeDaCadeia(state, skill.id, dep, new Set<Id>());
  if (r === "ciclo") return `Esta Dependência fecharia um ciclo com “${nomeDaHabilidade(state, dep.skillId)}” (RN-HAB-08).`;
  if (r > PROFUNDIDADE_MAXIMA) return "A cadeia de Dependências passa de 3 níveis (RN-HAB-08).";
  return undefined;
}

// ── Validação (RN-HAB-06) ──────────────────────────────────────────────────

export type CampoDeHabilidade = "instrucoes" | "entrada" | "saida" | "ferramentas" | "dependencias" | "colecoes";

export interface ProblemaDeHabilidade {
  readonly regra: "RN-HAB-06" | "RN-HAB-08";
  readonly campo: CampoDeHabilidade;
  readonly mensagem: string;
}

/** Um nome de Parâmetro é um identificador: letras, dígitos e sublinhado, começando por letra. */
const NOME_DE_PARAMETRO = /^[A-Za-z][A-Za-z0-9_]*$/;

function problemasDoContrato(parametros: readonly SkillParameter[], campo: "entrada" | "saida"): ProblemaDeHabilidade[] {
  const problemas: ProblemaDeHabilidade[] = [];
  const vistos = new Set<string>();
  for (const p of parametros) {
    const nome = p.name.trim();
    if (!NOME_DE_PARAMETRO.test(nome)) {
      problemas.push({ regra: "RN-HAB-06", campo, mensagem: `O nome de Parâmetro “${nome}” só admite letras, dígitos e sublinhado, começando por letra.` });
    }
    if (vistos.has(nome)) {
      problemas.push({ regra: "RN-HAB-06", campo, mensagem: `O Parâmetro “${nome}” se repete no contrato de ${campo}.` });
    }
    vistos.add(nome);
  }
  return problemas;
}

/**
 * RN-HAB-06 — puro, sem efeito: os problemas que impedem publicar a Versão.
 * A tela lista todos; publicar recusa se houver um. O rascunho admite tudo
 * isso (instruções vazias, Ferramenta inexistente…) — só RN-HAB-08 é
 * rejeitada no ato de editar.
 */
export function validarRascunhoDaHabilidade(state: DataState, skill: Skill, version: SkillVersion): ProblemaDeHabilidade[] {
  const problemas: ProblemaDeHabilidade[] = [];
  if (!version.instructions.trim()) problemas.push({ regra: "RN-HAB-06", campo: "instrucoes", mensagem: "As Instruções estão vazias." });
  problemas.push(...problemasDoContrato(version.inputContract, "entrada"));
  problemas.push(...problemasDoContrato(version.outputContract.structured, "saida"));
  for (const req of version.toolRequirements) {
    // Uma Ferramenta de Integração desconectada existe no Catálogo: a Disponibilidade, não a validação, acusa (RN-HAB-18).
    if (!state.tools.some((t) => t.id === req.toolId)) {
      problemas.push({ regra: "RN-HAB-06", campo: "ferramentas", mensagem: `A Ferramenta “${req.toolId}” não existe no Catálogo.` });
    }
  }
  for (const dep of version.dependencies) {
    const requerida = skillPorId(state, dep.skillId);
    if (!requerida) {
      problemas.push({ regra: "RN-HAB-06", campo: "dependencias", mensagem: `A Habilidade requerida “${dep.skillId}” não existe.` });
      continue;
    }
    const oitava = recusaDaDependencia(state, skill, dep);
    if (oitava) {
      problemas.push({ regra: "RN-HAB-08", campo: "dependencias", mensagem: oitava });
      continue;
    }
    if (requerida.lifecycle !== "ativo") {
      problemas.push({ regra: "RN-HAB-06", campo: "dependencias", mensagem: `A Habilidade requerida “${requerida.name}” não está ativa.` });
    }
    if (dep.pinnedVersion !== undefined) {
      const fixada = requerida.versions.find((v) => v.number === dep.pinnedVersion);
      if (!fixada || fixada.state !== "publicada") {
        problemas.push({ regra: "RN-HAB-06", campo: "dependencias", mensagem: `“${requerida.name}” fixa a versão ${dep.pinnedVersion}, que não está publicada.` });
      }
    } else if (!versaoCorrenteDaHabilidade(requerida)) {
      problemas.push({ regra: "RN-HAB-06", campo: "dependencias", mensagem: `“${requerida.name}” não tem Versão publicada.` });
    }
  }
  for (const id of version.recommendedCollectionIds) {
    if (!state.collections.some((c) => c.id === id)) {
      problemas.push({ regra: "RN-HAB-06", campo: "colecoes", mensagem: `A Coleção recomendada “${id}” não existe.` });
    }
  }
  return problemas;
}

// ── Criar, copiar, editar ──────────────────────────────────────────────────

export interface CriarHabilidadeInput {
  readonly name: string;
  readonly description?: string;
}

/** 18, 12.1 — nasce `ativo`, com a Versão 1 em rascunho, Criador = Membro, sem Concessões. */
export function criarHabilidade(state: DataState, actingMemberId: Id, input: CriarHabilidadeInput): OperationResult<Skill> {
  const recusa = recusaDeConvidado(state, actingMemberId, "cria Habilidade");
  if (recusa) return fail(recusa);
  const name = input.name.trim();
  if (!name) return fail("Dê um nome à Habilidade.", "nome");
  if (nomeEmUso(state, name)) return fail(`Já existe uma Habilidade chamada “${name}”.`, "nome");
  const ator = memberActor(actingMemberId);
  const skill: Skill = {
    id: nextId("skl"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: now(),
    lifecycle: "ativo",
    name,
    description: input.description?.trim() ?? "",
    ownership: "workspace",
    versions: [versaoVazia(1)],
  };
  state.skills.push(skill);
  registrarNaHabilidade(state, skill, { actor: ator, action: "Habilidade criada", detail: "Versão 1 em rascunho" });
  return ok(skill, skill.id);
}

/**
 * DO-HAB-07 — a cópia nasce `ativo` com a Versão 1 em rascunho IDÊNTICA à
 * Versão da plataforma escolhida (a corrente por padrão), com Proveniência.
 * Nada é exercível sem publicação explícita (RN-HAB-05); as Concessões à
 * Habilidade da plataforma não migram.
 */
export function copiarHabilidadeDaPlataforma(state: DataState, actingMemberId: Id, skillId: Id, versao?: number): OperationResult<Skill> {
  const recusa = recusaDeConvidado(state, actingMemberId, "cria Habilidade");
  if (recusa) return fail(recusa);
  const origem = skillPorId(state, skillId);
  if (!origem) return fail("Habilidade não encontrada.");
  if (origem.ownership !== "plataforma") return fail("Só uma Habilidade da plataforma é copiada por aqui; as do Espaço de Trabalho são editadas.");
  const base = versao !== undefined ? origem.versions.find((v) => v.number === versao) : versaoCorrenteDaHabilidade(origem);
  if (!base || base.state !== "publicada") return fail("A Habilidade da plataforma não tem Versão publicada para copiar.", "versao");
  const name = `${origem.name} (cópia)`;
  if (nomeEmUso(state, name)) return fail(`Já existe uma Habilidade chamada “${name}”.`, "nome");
  const momento = now();
  const ator = memberActor(actingMemberId);
  const copia: Skill = {
    id: nextId("skl"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    name,
    description: origem.description,
    ownership: "workspace",
    versions: [copiarComoRascunho(base, 1)],
    provenance: { kind: "copy", sourceId: origem.id, sourceName: origem.name, at: momento },
  };
  state.skills.push(copia);
  registrarNaHabilidade(state, copia, { actor: ator, action: "Habilidade copiada da plataforma", detail: `de “${origem.name}” (v${base.number}) · Versão 1 em rascunho` });
  return ok(copia, copia.id);
}

export interface EditarHabilidadeInput {
  readonly name?: string;
  readonly description?: string;
}

/** 18, 12.3 — renomear e alterar a descrição são atos sobre a Habilidade, sem Versão nova. */
export function editarHabilidade(state: DataState, actingMemberId: Id, skillId: Id, input: EditarHabilidadeInput): OperationResult<Skill> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "editar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle === "naLixeira") return fail("Restaure a Habilidade antes de editar.");
  const ator = memberActor(actingMemberId);
  if (input.name !== undefined && input.name.trim() !== skill.name) {
    const name = input.name.trim();
    if (!name) return fail("Dê um nome à Habilidade.", "nome");
    if (nomeEmUso(state, name, skill.id)) return fail(`Já existe uma Habilidade chamada “${name}”.`, "nome");
    const antes = skill.name;
    skill.name = name;
    registrarNaHabilidade(state, skill, { actor: ator, action: "Habilidade renomeada", before: antes, after: name });
  }
  if (input.description !== undefined && input.description.trim() !== skill.description) {
    skill.description = input.description.trim();
    registrarNaHabilidade(state, skill, { actor: ator, action: "Descrição da Habilidade alterada" });
  }
  return ok(skill, skill.id);
}

// ── Rascunho (RN-HAB-04: um por vez) ───────────────────────────────────────

/**
 * 18, 12.2 — o rascunho parte de uma Versão: a pedida, senão a corrente,
 * senão a última. A numeração nunca retrocede.
 */
export function criarRascunhoDaHabilidade(state: DataState, actingMemberId: Id, skillId: Id, deVersao?: number): OperationResult<SkillVersion> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "editar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle !== "ativo") return fail("Restaure a Habilidade antes de editar.");
  if (rascunhoDaHabilidade(skill)) return fail("A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04).");
  const origem = deVersao !== undefined ? skill.versions.find((v) => v.number === deVersao) : (versaoCorrenteDaHabilidade(skill) ?? ultimaVersao(skill));
  if (!origem) return fail("Versão não encontrada.");
  const rascunho = copiarComoRascunho(origem, proximoNumero(skill));
  skill.versions.push(rascunho);
  registrarNaHabilidade(state, skill, { actor: memberActor(actingMemberId), action: "Rascunho criado a partir de Versão", after: `v${rascunho.number}`, detail: `a partir da v${origem.number} (${origem.state})` });
  return ok(rascunho, skill.id);
}

export type PatchDoRascunhoDaHabilidade = Partial<Pick<SkillVersion, "instructions" | "inputContract" | "outputContract" | "toolRequirements" | "dependencies" | "recommendedCollectionIds">>;

/**
 * 18, 12.2 — só o rascunho é editável (RN-HAB-07). Rejeita no ato apenas
 * RN-HAB-08 (ciclo e profundidade); o resto fica para a validação, para a
 * pessoa poder gravar um rascunho pela metade.
 */
export function editarRascunhoDaHabilidade(state: DataState, actingMemberId: Id, skillId: Id, patch: PatchDoRascunhoDaHabilidade): OperationResult<SkillVersion> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "editar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle !== "ativo") return fail("Restaure a Habilidade antes de editar.");
  const rascunho = rascunhoDaHabilidade(skill);
  if (!rascunho) return fail("Não há rascunho: crie um a partir de uma Versão (12.2).");
  if (patch.dependencies !== undefined) {
    for (const dep of patch.dependencies) {
      const oitava = recusaDaDependencia(state, skill, dep);
      if (oitava) return fail(oitava, "dependencias");
    }
  }
  const campos: string[] = [];
  if (patch.instructions !== undefined) {
    rascunho.instructions = patch.instructions;
    campos.push("instruções");
  }
  if (patch.inputContract !== undefined) {
    rascunho.inputContract = patch.inputContract.map(copiarParametro);
    campos.push("contrato de entrada");
  }
  if (patch.outputContract !== undefined) {
    rascunho.outputContract = { structured: patch.outputContract.structured.map(copiarParametro), text: patch.outputContract.text };
    campos.push("contrato de saída");
  }
  if (patch.toolRequirements !== undefined) {
    rascunho.toolRequirements = patch.toolRequirements.map(copiarFerramenta);
    campos.push("Ferramentas requeridas");
  }
  if (patch.dependencies !== undefined) {
    rascunho.dependencies = patch.dependencies.map(copiarDependencia);
    campos.push("Dependências");
  }
  if (patch.recommendedCollectionIds !== undefined) {
    rascunho.recommendedCollectionIds = [...patch.recommendedCollectionIds];
    campos.push("Coleções recomendadas");
  }
  if (campos.length === 0) return ok(rascunho);
  registrarNaHabilidade(state, skill, { actor: memberActor(actingMemberId), action: "Rascunho da Habilidade editado", detail: `v${rascunho.number} · ${campos.join(", ")}` });
  return ok(rascunho, skill.id);
}

/** INV-HAB-01 — descartar o único rascunho deixaria a Habilidade sem Versão. A numeração não é reutilizada. */
export function descartarRascunhoDaHabilidade(state: DataState, actingMemberId: Id, skillId: Id): OperationResult<Skill> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "editar");
  if (recusa) return fail(recusa);
  const rascunho = rascunhoDaHabilidade(skill);
  if (!rascunho) return fail("Não há rascunho para descartar.");
  if (skill.versions.length === 1) return fail("Este é a única Versão da Habilidade: descartá-la a deixaria vazia (INV-HAB-01).");
  skill.versions = skill.versions.filter((v) => v !== rascunho);
  registrarNaHabilidade(state, skill, { actor: memberActor(actingMemberId), action: "Rascunho descartado", before: `v${rascunho.number}` });
  return ok(skill, skill.id);
}

// ── Publicar e obsoletar (`administrar`) ───────────────────────────────────

/**
 * 18, 12.2 — `administrar` vem ANTES da validação, para quem não pode
 * publicar não descobrir pela mensagem o que falta no rascunho. Valida
 * (RN-HAB-06) sem efeito na falha; a publicada anterior PERMANECE publicada,
 * exercível pelas Concessões que a fixaram (B71).
 */
export function publicarVersaoDaHabilidade(state: DataState, actingMemberId: Id, skillId: Id): OperationResult<SkillVersion> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "administrar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle !== "ativo") return fail("Restaure a Habilidade antes de publicar.");
  const rascunho = rascunhoDaHabilidade(skill);
  if (!rascunho) return fail("Não há rascunho para publicar.");
  const ator = memberActor(actingMemberId);
  const problemas = validarRascunhoDaHabilidade(state, skill, rascunho);
  if (problemas.length > 0) {
    const n = problemas.length;
    registrarNaHabilidade(state, skill, {
      actor: ator,
      action: "Validação falhou",
      result: "failed",
      detail: `v${rascunho.number}: ${n} problema${n > 1 ? "s" : ""} — ${problemas.slice(0, 3).map((p) => p.mensagem).join(" · ")}${n > 3 ? " …" : ""}`,
    });
    return fail(`O rascunho tem ${n} problema${n > 1 ? "s" : ""} de validação. Corrija antes de publicar (RN-HAB-06).`, "validacao");
  }
  const anterior = versaoCorrenteDaHabilidade(skill);
  rascunho.state = "publicada";
  rascunho.publishedBy = actingMemberId;
  rascunho.publishedAt = now();
  registrarNaHabilidade(state, skill, {
    actor: ator,
    action: "Versão de Habilidade publicada",
    after: `versão ${rascunho.number}`,
    detail: anterior ? `A v${anterior.number} permanece publicada para as Concessões que a fixaram (B71).` : "Primeira Versão publicada: as Concessões que seguem a corrente passam a exercê-la.",
  });
  return ok(rascunho, skill.id);
}

/**
 * 18, 12.2 — obsoletar é decisão de governança: permitido mesmo com
 * Concessões fixadas nela, que passam a `indisponível` com motivo (20.7).
 * Execuções passadas ficam íntegras (INV-HAB-03).
 */
export function obsoletarVersaoDaHabilidade(state: DataState, actingMemberId: Id, skillId: Id, numero: number): OperationResult<SkillVersion> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "administrar");
  if (recusa) return fail(recusa);
  const versao = skill.versions.find((v) => v.number === numero);
  if (!versao) return fail("Versão não encontrada.");
  if (versao.state !== "publicada") return fail("Só uma Versão publicada é obsoletada.");
  const fixadas = state.skillGrants.filter((g) => g.skillId === skill.id && g.pinnedVersion === numero).length;
  versao.state = "obsoleta";
  registrarNaHabilidade(state, skill, {
    actor: memberActor(actingMemberId),
    action: "Versão de Habilidade obsoletada",
    before: `versão ${numero} publicada`,
    after: `versão ${numero} obsoleta`,
    detail:
      fixadas === 0
        ? "Nenhuma Concessão fixada nesta Versão."
        : fixadas === 1
          ? "1 Concessão fixada nesta Versão fica indisponível."
          : `${fixadas} Concessões fixadas nesta Versão ficam indisponíveis.`,
  });
  return ok(versao, skill.id);
}

// ── Ciclo de vida (12.3) ───────────────────────────────────────────────────

/** 18, 12.3 — todas as Concessões passam a `indisponível`; o rascunho é preservado. */
export function arquivarHabilidade(state: DataState, actingMemberId: Id, skillId: Id): OperationResult<Skill> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "administrar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle !== "ativo") return fail("Só uma Habilidade ativa é arquivada.");
  const concessoes = state.skillGrants.filter((g) => g.skillId === skill.id).length;
  skill.lifecycle = "arquivado";
  skill.archivedAt = now();
  registrarNaHabilidade(state, skill, {
    actor: memberActor(actingMemberId),
    action: "Habilidade arquivada",
    detail: `${concessoes === 1 ? "1 Concessão fica indisponível" : `${concessoes} Concessões ficam indisponíveis`}; exercícios em curso terminam com a Versão carregada (RN-HAB-14).`,
  });
  return ok(skill, skill.id);
}

/** 18, 12.3 — desarquivar: as Concessões voltam a ser avaliadas. O nome continuava reservado (RN-HAB-02), então não há colisão. */
export function restaurarHabilidade(state: DataState, actingMemberId: Id, skillId: Id): OperationResult<Skill> {
  const skill = skillPorId(state, skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  const recusa = recusaDeGovernarHabilidade(state, actingMemberId, skill, "administrar");
  if (recusa) return fail(recusa);
  if (skill.lifecycle !== "arquivado") return fail("Só uma Habilidade arquivada é restaurada por aqui.");
  skill.lifecycle = "ativo";
  delete skill.archivedAt;
  registrarNaHabilidade(state, skill, { actor: memberActor(actingMemberId), action: "Habilidade restaurada", detail: "As Concessões voltam a ser avaliadas." });
  return ok(skill, skill.id);
}

// ── Concessões (RN-HAB-12) ─────────────────────────────────────────────────

/**
 * D8 / RN-AGE-06 — conceder e revogar mudam o comportamento do Agente: nasce
 * uma Versão, cópia da corrente com as Habilidades concedidas relidas das
 * Concessões (a fábrica única de `agentes.ts`) e o motivo. Vale a partir da
 * próxima Execução (B74).
 */
function novaVersaoDoAgente(state: DataState, agent: Agent, corrente: AgentVersion, actingMemberId: Id, reason: string): AgentVersion {
  const versao = montarVersaoDoAgente(state, agent.id, agent.versions, actingMemberId, copiarConteudoDaVersao(corrente), reason);
  agent.versions.push(versao);
  return versao;
}

export interface ConcederHabilidadeInput {
  readonly agentId: Id;
  readonly skillId: Id;
  /** Sem fixação, a Concessão segue a Versão corrente. */
  readonly pinnedVersion?: number;
}

/**
 * RN-HAB-12 — a Concessão é a única origem de `executar`; conceder exige
 * `editar` no Agente. Não amplia permissão alguma (INV-HAB-06): a
 * Disponibilidade é recalculada a cada leitura em `derive-ia`.
 */
export function concederHabilidade(state: DataState, actingMemberId: Id, input: ConcederHabilidadeInput): OperationResult<SkillGrant> {
  const ativo = recusaDeMembroAtivo(state, actingMemberId);
  if (ativo) return fail(ativo);
  const agent = agentePorId(state, input.agentId);
  if (!agent) return fail("Agente não encontrado.", "agente");
  if (agent.lifecycle === "arquivado" || agent.lifecycle === "naLixeira") return fail("Um Agente arquivado ou na lixeira não recebe Concessões.", "agente");
  const governar = recusaDeGovernarAgente(state, actingMemberId, agent, "editar");
  if (governar) return fail(governar, "agente");
  const skill = skillPorId(state, input.skillId);
  if (!skill) return fail("Habilidade não encontrada.", "habilidade");
  if (skill.lifecycle !== "ativo") return fail("Só uma Habilidade ativa é concedida.", "habilidade");
  if (state.skillGrants.some((g) => g.agentId === agent.id && g.skillId === skill.id)) return fail("Esta Habilidade já está concedida a este Agente.", "habilidade");
  if (input.pinnedVersion !== undefined) {
    const fixada = skill.versions.find((v) => v.number === input.pinnedVersion);
    if (!fixada || fixada.state !== "publicada") return fail("Só uma Versão publicada pode ser fixada (RN-HAB-03).", "versao");
  }
  const corrente = versaoCorrenteDoAgente(agent);
  if (!corrente) return fail("O Agente não tem Versão.", "agente");

  const grant: SkillGrant = {
    id: nextId("sgr"),
    agentId: agent.id,
    skillId: skill.id,
    ...(input.pinnedVersion !== undefined ? { pinnedVersion: input.pinnedVersion } : {}),
    grantedBy: actingMemberId,
    grantedAt: now(),
  };
  state.skillGrants.push(grant);
  const versao = novaVersaoDoAgente(state, agent, corrente, actingMemberId, `Habilidade “${skill.name}” concedida`);
  registrarNoAgente(state, agent, {
    actor: memberActor(actingMemberId),
    action: "Habilidade concedida",
    after: `versão ${versao.number}`,
    detail: `${skill.name}${input.pinnedVersion !== undefined ? ` · versão fixada ${input.pinnedVersion}` : ""}`,
  });
  return ok(grant, grant.id);
}

/** Fixar (só `publicada` — RN-HAB-03) ou liberar (`null`: segue a corrente) a Versão de uma Concessão. Não muda o comportamento do Agente: sem Versão nova. */
export function fixarVersaoDaConcessao(state: DataState, actingMemberId: Id, grantId: Id, numero: number | null): OperationResult<SkillGrant> {
  const ativo = recusaDeMembroAtivo(state, actingMemberId);
  if (ativo) return fail(ativo);
  const grant = state.skillGrants.find((g) => g.id === grantId);
  if (!grant) return fail("Concessão não encontrada.");
  const agent = agentePorId(state, grant.agentId);
  if (!agent) return fail("Agente não encontrado.");
  const governar = recusaDeGovernarAgente(state, actingMemberId, agent, "editar");
  if (governar) return fail(governar);
  const skill = skillPorId(state, grant.skillId);
  if (!skill) return fail("Habilidade não encontrada.");
  if (numero !== null) {
    const fixada = skill.versions.find((v) => v.number === numero);
    if (!fixada || fixada.state !== "publicada") return fail("Só uma Versão publicada pode ser fixada (RN-HAB-03).", "versao");
  }
  if ((numero ?? undefined) === grant.pinnedVersion) return ok(grant);
  const antes = grant.pinnedVersion !== undefined ? `versão fixada ${grant.pinnedVersion}` : "segue a corrente";
  if (numero === null) delete grant.pinnedVersion;
  else grant.pinnedVersion = numero;
  registrarNoAgente(state, agent, {
    actor: memberActor(actingMemberId),
    action: numero === null ? "Concessão liberada para a Versão corrente" : "Versão fixada na Concessão",
    before: antes,
    after: numero === null ? "segue a corrente" : `versão fixada ${numero}`,
    detail: skill.name,
  });
  return ok(grant, grant.id);
}

/** Revogar remove a Concessão e cria Versão de Agente (D8). Exercícios em curso terminam com a Versão carregada (RN-HAB-14). */
export function revogarHabilidade(state: DataState, actingMemberId: Id, grantId: Id): OperationResult<SkillGrant> {
  const ativo = recusaDeMembroAtivo(state, actingMemberId);
  if (ativo) return fail(ativo);
  const grant = state.skillGrants.find((g) => g.id === grantId);
  if (!grant) return fail("Concessão não encontrada.");
  const agent = agentePorId(state, grant.agentId);
  if (!agent) return fail("Agente não encontrado.");
  const governar = recusaDeGovernarAgente(state, actingMemberId, agent, "editar");
  if (governar) return fail(governar);
  const corrente = versaoCorrenteDoAgente(agent);
  if (!corrente) return fail("O Agente não tem Versão.");
  const nome = nomeDaHabilidade(state, grant.skillId);
  state.skillGrants = state.skillGrants.filter((g) => g.id !== grant.id);
  const versao = novaVersaoDoAgente(state, agent, corrente, actingMemberId, `Habilidade “${nome}” revogada`);
  registrarNoAgente(state, agent, { actor: memberActor(actingMemberId), action: "Habilidade revogada", after: `versão ${versao.number}`, detail: nome });
  return ok(grant, agent.id);
}
