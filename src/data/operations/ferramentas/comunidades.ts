/**
 * As Ferramentas do Canal sobre Comunidades (25): criar (o provedor cria a
 * comunidade E o Grupo de avisos — DO-COM-04), sincronizar, editar,
 * vincular/desvincular Grupos (preservando identidade, histórico e
 * Participações — RN-COM-02), enviar à Comunidade (= enviar ao Grupo de
 * avisos — RN-COM-05), sair (não sai dos Grupos comuns — RN-COM-08) e o ciclo
 * de vida, que nunca toca os Grupos (INV-COM-01).
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { ActorRef, Comunidade, ConfiguracoesDaComunidade, Conversation, Grupo, Id, Message } from "../../types";
import { grupoDeAvisos, gruposComuns, gruposDaComunidade, membrosDoGrupo, participacoesVigentes } from "../../derive-ferramentas";
import { memberActor, nextId, recordActivity } from "../activity";
import { CAPACIDADES_DE_ATIVOS, LIMITE_DE_GRUPOS_POR_ESPACO } from "./capacidades";
import { enviarMensagemAoGrupo } from "./grupos";
import { abrirParticipacao, encerrarParticipacao, reconciliarGrupoDeAvisos } from "./participacoes";
import { recusaDeAdministracao, recusaDeMembroAtivo, recusaDoCanal, recusaExternaNaComunidade, recusaExternaNoGrupo } from "./permissoes";
import { gerarJid } from "./provedor-simulado";

const now = (): string => new Date().toISOString();

export const CONFIGURACOES_PADRAO_DA_COMUNIDADE: ConfiguracoesDaComunidade = {
  somenteAdministradoresAdicionamGrupos: true,
  somenteAdministradoresAdicionamParticipantes: false,
};

const comunidadePorId = (state: DataState, id: Id): Comunidade | undefined => state.comunidades.find((c) => c.id === id);

function registrarNaComunidade(
  state: DataState,
  comunidade: Comunidade,
  input: { readonly actor: ActorRef; readonly delegate?: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string },
): void {
  recordActivity(state, { ...input, objectType: "comunidade", objectId: comunidade.id, objectName: comunidade.nome });
}

export interface CriarComunidadeInput {
  readonly nome: string;
  readonly descricao?: string;
  readonly canalId: Id;
  readonly configuracoes?: Partial<ConfiguracoesDaComunidade>;
}

/** 25, 12.1 — o provedor cria a comunidade e o grupo de avisos; a plataforma grava os dois. */
export function criarComunidade(state: DataState, actingMemberId: Id, input: CriarComunidadeInput): OperationResult<{ readonly comunidade: Comunidade; readonly grupoDeAvisos: Grupo }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const canalRecusa = recusaDoCanal(state, input.canalId, "comunidades");
  if (canalRecusa) return fail(canalRecusa, "canal");
  const canal = state.channels.find((c) => c.id === input.canalId);
  if (!canal) return fail("Canal não encontrado.", "canal");
  const capacidades = CAPACIDADES_DE_ATIVOS[canal.channelType];
  const nome = input.nome.trim();
  if (!nome) return fail("Dê um nome à Comunidade.", "nome");
  if (nome.length > capacidades.limiteDoNome) return fail(`O nome passa do limite do provedor (${capacidades.limiteDoNome} caracteres).`, "nome");
  if ((input.descricao?.length ?? 0) > capacidades.limiteDaDescricao) return fail(`A descrição passa do limite do provedor (${capacidades.limiteDaDescricao} caracteres).`, "descricao");
  const vivos = state.grupos.filter((g) => g.lifecycle !== "naLixeira").length;
  if (vivos + 1 > LIMITE_DE_GRUPOS_POR_ESPACO) return fail(`O Grupo de avisos excederia o Limite de ${LIMITE_DE_GRUPOS_POR_ESPACO} Grupos do Espaço de Trabalho.`);

  const momento = now();
  const ator = memberActor(actingMemberId);
  const comunidade: Comunidade = {
    id: nextId("com"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    nome,
    tipoDeCanal: canal.channelType,
    identificadorExterno: gerarJid(),
    canalId: canal.id,
    sincronizacao: { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" },
    origemDeCriacao: "criadoPelaPlataforma",
    tagIds: [],
    fieldValues: [],
    comments: [],
    descricao: input.descricao?.trim() ?? "",
    configuracoes: { ...CONFIGURACOES_PADRAO_DA_COMUNIDADE, ...input.configuracoes },
    limiteDeGruposDoProvedor: capacidades.limiteDeGruposPorComunidade,
  };
  const avisos: Grupo = {
    id: nextId("grp"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    nome: `${nome} · Avisos`,
    tipoDeCanal: canal.channelType,
    identificadorExterno: gerarJid(),
    canalId: canal.id,
    sincronizacao: { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" },
    origemDeCriacao: "criadoPelaPlataforma",
    tagIds: [],
    fieldValues: [],
    comments: [],
    descricao: "Grupo de avisos da Comunidade: todos leem, só administradores publicam.",
    configuracoes: { somenteAdministradoresEnviam: true, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: false, somenteAdministradoresAdicionamParticipantes: true },
    capacidade: capacidades.capacidadeDoGrupo,
    participacoes: [],
    pedidosDeEntrada: [],
    comunidadeId: comunidade.id,
    papelNaComunidade: "avisos",
    vinculadoAComunidadeEm: momento,
    captacao: { estado: "inativa" },
  };
  abrirParticipacao(state, avisos, { canalParticipanteId: canal.id, identificadorExterno: canal.externalId, papel: "administrador", origem: "adicionado", at: momento, adicionadoPor: ator });
  state.comunidades.push(comunidade);
  state.grupos.push(avisos);
  registrarNaComunidade(state, comunidade, { actor: ator, action: "Comunidade criada", detail: `${canal.name} · Grupo de avisos “${avisos.nome}” criado pelo provedor` });
  recordActivity(state, { actor: ator, action: "Grupo criado", objectType: "grupo", objectId: avisos.id, objectName: avisos.nome, detail: `Grupo de avisos da Comunidade ${nome}` });
  return ok({ comunidade, grupoDeAvisos: avisos }, comunidade.id);
}

/** 25, 12.3 — espelha o que o provedor sabe; sem Grupo de avisos, Registro de inconsistência. */
export function sincronizarComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle === "naLixeira") return fail("A Comunidade está na lixeira.");
  const momento = now();
  const antes = comunidade.sincronizacao.estado;
  const canal = comunidade.canalId ? state.channels.find((c) => c.id === comunidade.canalId) : undefined;
  if (!canal || canal.lifecycle !== "ativo") {
    comunidade.sincronizacao = { estado: "orfao", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal administrador foi arquivado ou não existe." };
  } else if (canal.connection !== "conectada") {
    return fail(`O Canal ${canal.name} está desconectado: não há como conferir a Comunidade.`);
  } else if (comunidade.sincronizacao.papelDoCanal === "ausente") {
    comunidade.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal não está mais na comunidade." };
  } else if (comunidade.sincronizacao.papelDoCanal === "participante") {
    comunidade.sincronizacao = { estado: "semPrivilegio", conferidoEm: momento, papelDoCanal: "participante", detalhe: "O Canal é participante: só sincronizar e sair." };
  } else {
    comunidade.sincronizacao = { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" };
  }
  reconciliarGrupoDeAvisos(state, comunidade.id, momento);
  const semAvisos = comunidade.sincronizacao.estado === "sincronizado" && !grupoDeAvisos(state, comunidade.id);
  registrarNaComunidade(state, comunidade, {
    actor: memberActor(actingMemberId),
    action: semAvisos ? "Grupo de avisos ausente" : "Comunidade sincronizada",
    ...(semAvisos ? { result: "failed" as const, detail: "A Sincronização não encontrou o Grupo de avisos: espelho inconsistente (INV-COM-02)." } : { before: antes, after: comunidade.sincronizacao.estado }),
  });
  return ok(comunidade, comunidade.id);
}

export interface EditarComunidadeInput {
  readonly nome?: string;
  readonly descricao?: string;
}

export function editarComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id, input: EditarComunidadeInput): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  const externa = recusaExternaNaComunidade(state, comunidade, "administrador");
  if (externa) return fail(externa);
  const capacidades = CAPACIDADES_DE_ATIVOS[comunidade.tipoDeCanal];
  const mudancas: string[] = [];
  if (input.nome !== undefined && input.nome.trim() !== comunidade.nome) {
    const n = input.nome.trim();
    if (!n) return fail("Dê um nome à Comunidade.", "nome");
    if (n.length > capacidades.limiteDoNome) return fail(`O nome passa do limite do provedor (${capacidades.limiteDoNome} caracteres).`, "nome");
    mudancas.push(`nome: “${comunidade.nome}” → “${n}”`);
    comunidade.nome = n;
  }
  if (input.descricao !== undefined && input.descricao.trim() !== comunidade.descricao) {
    if (input.descricao.length > capacidades.limiteDaDescricao) return fail(`A descrição passa do limite do provedor (${capacidades.limiteDaDescricao} caracteres).`, "descricao");
    mudancas.push("descrição");
    comunidade.descricao = input.descricao.trim();
  }
  if (mudancas.length === 0) return ok(comunidade);
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Dados da Comunidade alterados", detail: mudancas.join("; ") });
  return ok(comunidade, comunidade.id);
}

/** 25, 7.1 — Ferramenta `alterar Configurações` (externa); RN-COM-10: nada é copiado aos Grupos. */
export function alterarConfiguracoesDaComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id, input: Partial<ConfiguracoesDaComunidade>): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  const externa = recusaExternaNaComunidade(state, comunidade, "administrador");
  if (externa) return fail(externa);
  const antes = comunidade.configuracoes;
  const depois = { ...antes, ...input };
  const chaves = (Object.keys(depois) as Array<keyof ConfiguracoesDaComunidade>).filter((k) => antes[k] !== depois[k]);
  if (chaves.length === 0) return ok(comunidade);
  comunidade.configuracoes = depois;
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Configurações da Comunidade alteradas", detail: chaves.map((k) => `${k}: ${depois[k] ? "sim" : "não"}`).join("; ") });
  return ok(comunidade, comunidade.id);
}

/** 25, 12.2 — por que este Grupo NÃO pode ser vinculado a esta Comunidade; para a opção desligada dizer. */
export function recusaDeVinculo(state: DataState, comunidade: Comunidade, grupo: Grupo): string | undefined {
  if (grupo.lifecycle !== "ativo") return "O Grupo não está ativo.";
  if (grupo.comunidadeId === comunidade.id) return "Já está nesta Comunidade.";
  if (grupo.comunidadeId !== undefined) return "O Grupo já pertence a outra Comunidade (RN-COM-03).";
  if (grupo.tipoDeCanal !== comunidade.tipoDeCanal) return "O Grupo é de outro Tipo de Canal (INV-COM-03).";
  if (grupo.canalId !== comunidade.canalId) return "O Grupo é administrado por outro Canal.";
  if (grupo.sincronizacao.papelDoCanal !== "administrador") return "O Canal não administra este Grupo.";
  if (gruposDaComunidade(state, comunidade.id).length >= comunidade.limiteDeGruposDoProvedor) return `A Comunidade está no limite de ${comunidade.limiteDeGruposDoProvedor} Grupos (INV-COM-05).`;
  return undefined;
}

/** 25, 12.2 — Ferramenta `vincular Grupo` (externa). */
export function vincularGrupoAComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id, grupoId: Id): OperationResult<Grupo> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  const externa = recusaExternaNaComunidade(state, comunidade, "administrador");
  if (externa) return fail(externa);
  const grupo = state.grupos.find((g) => g.id === grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externaNoGrupo = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externaNoGrupo) return fail(externaNoGrupo);
  const recusa = recusaDeVinculo(state, comunidade, grupo);
  if (recusa) return fail(recusa, "grupo");
  const momento = now();
  grupo.comunidadeId = comunidade.id;
  grupo.papelNaComunidade = "comum";
  grupo.vinculadoAComunidadeEm = momento;
  reconciliarGrupoDeAvisos(state, comunidade.id, momento);
  const ator = memberActor(actingMemberId);
  registrarNaComunidade(state, comunidade, { actor: ator, action: "Grupo vinculado à Comunidade", detail: grupo.nome });
  recordActivity(state, { actor: ator, action: "Vinculado à Comunidade", objectType: "grupo", objectId: grupo.id, objectName: grupo.nome, detail: comunidade.nome });
  return ok(grupo, grupo.id);
}

/** 25, 12.2 — o Grupo continua a existir; Participações intactas; sai do Grupo de avisos. O avisos não é desvinculável (INV-COM-02). */
export function desvincularGrupoDaComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id, grupoId: Id): OperationResult<Grupo> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  const externa = recusaExternaNaComunidade(state, comunidade, "administrador");
  if (externa) return fail(externa);
  const grupo = state.grupos.find((g) => g.id === grupoId);
  if (!grupo || grupo.comunidadeId !== comunidade.id) return fail("O Grupo não está nesta Comunidade.");
  if (grupo.papelNaComunidade === "avisos") return fail("O Grupo de avisos não é desvinculável: ele nasce e morre com a Comunidade (INV-COM-02).");
  const momento = now();
  delete grupo.comunidadeId;
  delete grupo.papelNaComunidade;
  delete grupo.vinculadoAComunidadeEm;
  reconciliarGrupoDeAvisos(state, comunidade.id, momento);
  const ator = memberActor(actingMemberId);
  registrarNaComunidade(state, comunidade, { actor: ator, action: "Grupo desvinculado da Comunidade", detail: `${grupo.nome} · Participações intactas` });
  recordActivity(state, { actor: ator, action: "Desvinculado da Comunidade", objectType: "grupo", objectId: grupo.id, objectName: grupo.nome, detail: comunidade.nome });
  return ok(grupo, grupo.id);
}

/** RN-COM-05 — enviar à Comunidade é enviar à Conversa de grupo do Grupo de avisos; Registro na Comunidade e na Mensagem. */
export function enviarMensagemAComunidade(
  state: DataState,
  actingMemberId: Id,
  comunidadeId: Id,
  input: { readonly content: string; readonly templateProviderId?: string },
): OperationResult<{ readonly conversa: Conversation; readonly mensagem: Message; readonly grupoDeAvisos: Grupo }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle === "naLixeira") return fail("A Comunidade está na lixeira.");
  const avisos = grupoDeAvisos(state, comunidade.id);
  if (!avisos) return fail("A Comunidade está sem Grupo de avisos: sincronize antes (INV-COM-02).");
  const envio = enviarMensagemAoGrupo(state, actingMemberId, avisos.id, input);
  if (!envio.ok) return envio;
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Mensagem enviada à Comunidade", detail: `no Grupo de avisos · ${input.content.slice(0, 80)}` });
  return ok({ ...envio.value, grupoDeAvisos: avisos }, envio.value.mensagem.id);
}

/** Por que "enviar a todos os Grupos" não existe como Ferramenta (25, 20.4). */
export const MOTIVO_SEM_ENVIO_A_TODOS = "Enviar a cada Grupo comum é uma Automação com N Mensagens, não uma Ferramenta da Comunidade (DO-COM-05). Enviar à Comunidade fala no Grupo de avisos, que todos leem.";

/**
 * 25, 12.4 — o Canal sai da comunidade E do Grupo de avisos; os Grupos
 * `comum` permanecem (RN-COM-08). Irreversível quando único administrador.
 */
export function sairDaComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id, input: { readonly entendiIrreversivel?: boolean } = {}): OperationResult<Comunidade> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  const externa = recusaExternaNaComunidade(state, comunidade, "participante");
  if (externa) return fail(externa);
  const irreversivel = comunidade.sincronizacao.papelDoCanal === "administrador";
  if (irreversivel && !input.entendiIrreversivel) {
    return fail("O Canal administra a Comunidade: sair é irreversível e o provedor pode dissolvê-la, desvinculando todos os grupos. Confirme que entendeu.", "confirmacao");
  }
  const momento = now();
  const avisos = grupoDeAvisos(state, comunidade.id);
  if (avisos) {
    const canalNoAvisos = participacoesVigentes(avisos).find((p) => p.canalParticipanteId === avisos.canalId);
    if (canalNoAvisos) encerrarParticipacao(avisos, canalNoAvisos, { causa: "saiu", at: momento });
    avisos.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal saiu da Comunidade." };
    delete avisos.linkDeConvite;
  }
  comunidade.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal saiu da comunidade." };
  const comuns = gruposComuns(state, comunidade.id).length;
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Canal saiu da Comunidade", detail: `${irreversivel ? "Era administrador: irreversível. " : ""}${comuns} Grupo${comuns === 1 ? "" : "s"} comu${comuns === 1 ? "m" : "ns"} continua${comuns === 1 ? "" : "m"} com o Canal (RN-COM-08).` });
  return ok(comunidade, comunidade.id);
}

// ── Ciclo de vida (INV-COM-01: nada muda nos Grupos) ───────────────────────

export function arquivarComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle !== "ativo") return fail("Só uma Comunidade ativa é arquivada.");
  comunidade.lifecycle = "arquivado";
  comunidade.archivedAt = now();
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Comunidade arquivada", detail: "Os Grupos continuam ativos, com a referência mantida (INV-COM-01); Captação e elegibilidade não mudam (RN-COM-12)." });
  return ok(comunidade, comunidade.id);
}

export function restaurarComunidade(state: DataState, actingMemberId: Id, comunidadeId: Id): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle !== "arquivado") return fail("Só uma Comunidade arquivada é restaurada por aqui.");
  comunidade.lifecycle = "ativo";
  delete comunidade.archivedAt;
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Comunidade restaurada" });
  return ok(comunidade, comunidade.id);
}

export function enviarComunidadeALixeira(state: DataState, actingMemberId: Id, comunidadeId: Id): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle === "naLixeira") return ok(comunidade);
  comunidade.lifecycleBeforeTrash = comunidade.lifecycle;
  comunidade.lifecycle = "naLixeira";
  comunidade.trashedAt = now();
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Comunidade enviada à lixeira", detail: "Nada muda no provedor nem nos Grupos (INV-ATV-05, INV-COM-01)." });
  return ok(comunidade);
}

export function restaurarComunidadeDaLixeira(state: DataState, actingMemberId: Id, comunidadeId: Id): OperationResult<Comunidade> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const comunidade = comunidadePorId(state, comunidadeId);
  if (!comunidade) return fail("Comunidade não encontrada.");
  if (comunidade.lifecycle !== "naLixeira") return fail("A Comunidade não está na lixeira.");
  comunidade.lifecycle = comunidade.lifecycleBeforeTrash ?? "ativo";
  delete comunidade.lifecycleBeforeTrash;
  delete comunidade.trashedAt;
  comunidade.sincronizacao = { ...comunidade.sincronizacao, estado: "nuncaConferido", detalhe: "Restaurada da lixeira: sincronize antes de qualquer Ferramenta externa (RN-ATV-08)." };
  registrarNaComunidade(state, comunidade, { actor: memberActor(actingMemberId), action: "Comunidade restaurada da lixeira", after: comunidade.lifecycle });
  return ok(comunidade, comunidade.id);
}

/** Para a tela: quantos Contatos a Comunidade alcança e por quais Grupos. */
export const resumoDaComunidade = (state: DataState, comunidade: Comunidade): { readonly grupos: number; readonly comuns: number; readonly membros: number } => {
  const todos = gruposDaComunidade(state, comunidade.id);
  const comuns = todos.filter((g) => g.papelNaComunidade !== "avisos");
  const membros = new Set<Id>();
  for (const g of comuns) for (const p of membrosDoGrupo(g)) if (p.contactId) membros.add(p.contactId);
  return { grupos: todos.length, comuns: comuns.length, membros: membros.size };
};
