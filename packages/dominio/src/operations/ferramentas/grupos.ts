/**
 * As Ferramentas do Canal sobre Grupos (24): criar, importar, sincronizar,
 * editar o espelhado (com efeito no provedor — RN-GRP-03), Captação (só da
 * plataforma — RN-GRP-02), Participantes, Pedidos de Entrada, ciclo de vida
 * (que nunca sai do grupo — RN-GRP-04), sair do Grupo, e enviar Mensagem ao
 * Grupo pela Conversa de grupo (RN-GRP-13).
 *
 * O provedor é simulado: cada Ferramenta externa tem aqui o efeito que ele
 * teria, e o Registro grava o que aconteceu. As recusas vêm de permissoes.ts,
 * na mesma frase que a tela mostra no botão desligado.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { ActorRef, Captacao, ConfiguracoesDoGrupo, Conversation, Grupo, Id, Message, ParticipacaoDeGrupo, PedidoDeEntrada } from "../../types";
import { contactDisplayName } from "../../derive";
import { conversaDoGrupo, identidadeDeWhatsApp, participacoesVigentes, pedidosPendentes } from "../../derive-ferramentas";
import { memberActor, nextId, recordActivity, systemActor } from "../activity";
import { sendMessage, startConversation } from "../conversations";
import { emitirEventoDeFerramentas } from "./automacoes";
import { CAPACIDADES_DE_ATIVOS, LIMITE_DE_GRUPOS_POR_ESPACO } from "./capacidades";
import {
  abrirParticipacao,
  canalPeloNumero,
  encerrarParticipacao,
  nomeDoParticipante,
  reconciliarGrupoDeAvisos,
  registrarNoGrupo,
  resolverOuCriarContato,
} from "./participacoes";
import { recusaDeAdministracao, recusaDeEnvioAoGrupo, recusaDeMembroAtivo, recusaDoCanal, recusaExternaNaComunidade, recusaExternaNoGrupo } from "./permissoes";
import { GRUPOS_NO_PROVEDOR, gerarEnderecoDeConvite, gerarJid } from "./provedor-simulado";

const now = (): string => new Date().toISOString();

export const CONFIGURACOES_PADRAO_DO_GRUPO: ConfiguracoesDoGrupo = {
  somenteAdministradoresEnviam: false,
  somenteAdministradoresEditamDados: true,
  administradoresAprovamEntrada: false,
  somenteAdministradoresAdicionamParticipantes: false,
};

const grupoPorId = (state: DataState, grupoId: Id): Grupo | undefined => state.grupos.find((g) => g.id === grupoId);

const gruposVivos = (state: DataState): number => state.grupos.filter((g) => g.lifecycle !== "naLixeira").length;

/** RN-GRP-18 / C33 — o Limite é conferido ANTES de criar; a recusa diz a contagem. */
function recusaDeLimiteDeGrupos(state: DataState, aCriar = 1): string | undefined {
  const atual = gruposVivos(state);
  if (atual + aCriar > LIMITE_DE_GRUPOS_POR_ESPACO) {
    return `O Limite de ${LIMITE_DE_GRUPOS_POR_ESPACO} Grupos do Espaço de Trabalho seria excedido (${atual} existentes, ${aCriar} a criar).`;
  }
  return undefined;
}

function recusaDeNome(nome: string, limite: number): string | undefined {
  const n = nome.trim();
  if (!n) return "Dê um nome ao Grupo.";
  if (n.length > limite) return `O nome passa do limite do provedor (${limite} caracteres).`;
  return undefined;
}

// ── Criar e importar ───────────────────────────────────────────────────────

export interface CriarGrupoInput {
  readonly nome: string;
  readonly descricao?: string;
  readonly canalId: Id;
  readonly configuracoes?: Partial<ConfiguracoesDoGrupo>;
  readonly participantesIniciaisContactIds?: readonly Id[];
  readonly administradoresContactIds?: readonly Id[];
  /** C40 — o Contato que fica registrado como criador; entra como administrador. */
  readonly contatoCriadorId?: Id;
  /** A Foto do grupo (espelhada no provedor) — uma imagem já recortada em quadrado. */
  readonly foto?: ImagemDoGrupo;
  /** C41 — a Capa, só da plataforma — uma imagem já recortada em 3:1. */
  readonly capa?: ImagemDoGrupo;
  readonly comunidadeId?: Id;
  readonly captacao?: Partial<Captacao>;
}

/** Uma imagem escolhida na tela, já recortada e reduzida (`features/ferramentas/imagem-do-grupo.ts`). */
export interface ImagemDoGrupo {
  readonly nome: string;
  /** O conteúdo, como data URL de imagem (o protótipo não tem servidor). */
  readonly url: string;
  readonly tamanhoBytes: number;
}

/** O teto de uma imagem de Grupo depois de reduzida — folgado: a foto sai com ~100 KB. */
export const TETO_DA_IMAGEM_DO_GRUPO = 5 * 1024 * 1024;

function recusaDaImagem(imagem: ImagemDoGrupo | undefined, qual: "A foto" | "A capa"): string | undefined {
  if (!imagem) return undefined;
  if (!imagem.url.startsWith("data:image/")) return `${qual} precisa ser uma imagem (JPG, PNG ou WebP).`;
  if (imagem.tamanhoBytes > TETO_DA_IMAGEM_DO_GRUPO) return `${qual} passa de 5 MB.`;
  return undefined;
}

/**
 * 24, 12.1 — Ferramenta `criar Grupo` (classe `externa`): o provedor cria,
 * a plataforma grava o Identificador externo e a Sincronização `sincronizado`,
 * com o Canal como administrador, Origem `criadoPelaPlataforma` e Captação
 * `ativa`.
 */
export function criarGrupo(state: DataState, actingMemberId: Id, input: CriarGrupoInput): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const canalRecusa = recusaDoCanal(state, input.canalId, "gruposAdministraveis");
  if (canalRecusa) return fail(canalRecusa, "canal");
  const canal = state.channels.find((c) => c.id === input.canalId);
  if (!canal) return fail("Canal não encontrado.", "canal");
  const capacidades = CAPACIDADES_DE_ATIVOS[canal.channelType];
  const nomeRecusa = recusaDeNome(input.nome, capacidades.limiteDoNome);
  if (nomeRecusa) return fail(nomeRecusa, "nome");
  if ((input.descricao?.length ?? 0) > capacidades.limiteDaDescricao) return fail(`A descrição passa do limite do provedor (${capacidades.limiteDaDescricao} caracteres).`, "descricao");
  const limite = recusaDeLimiteDeGrupos(state);
  if (limite) return fail(limite);
  const fotoRecusa = recusaDaImagem(input.foto, "A foto");
  if (fotoRecusa) return fail(fotoRecusa, "foto");
  const capaRecusa = recusaDaImagem(input.capa, "A capa");
  if (capaRecusa) return fail(capaRecusa, "capa");

  let comunidade: { id: Id; nome: string } | undefined;
  if (input.comunidadeId) {
    const c = state.comunidades.find((x) => x.id === input.comunidadeId);
    if (!c || c.lifecycle !== "ativo") return fail("A Comunidade escolhida não está ativa.", "comunidade");
    // Nascer vinculado é vincular (25, 12.1 → 12.2): a Comunidade precisa estar acessível e administrada pelo Canal.
    const externaNaComunidade = recusaExternaNaComunidade(state, c, "administrador");
    if (externaNaComunidade) return fail(externaNaComunidade, "comunidade");
    if (c.canalId !== canal.id) return fail("A Comunidade é administrada por outro Canal (INV-COM-03).", "comunidade");
    const vinculados = state.grupos.filter((g) => g.comunidadeId === c.id && g.lifecycle !== "naLixeira").length;
    if (vinculados >= c.limiteDeGruposDoProvedor) return fail(`A Comunidade ${c.nome} está no limite de ${c.limiteDeGruposDoProvedor} Grupos.`, "comunidade");
    comunidade = { id: c.id, nome: c.nome };
  }

  // C40 — o Contato criador entra como administrador, como os escolhidos para administrar.
  const criador = input.contatoCriadorId ? [input.contatoCriadorId] : [];
  const participantes = [...new Set([...criador, ...(input.participantesIniciaisContactIds ?? []), ...(input.administradoresContactIds ?? [])])];
  const contatos = participantes.map((id) => state.contacts.find((c) => c.id === id && c.lifecycle === "ativo"));
  for (const contato of contatos) {
    if (!contato) return fail("Um dos Contatos escolhidos não está ativo.", "participantes");
    if (!identidadeDeWhatsApp(contato)) return fail(`${contactDisplayName(contato)} não tem identidade de WhatsApp: o provedor não o encontra.`, "participantes");
  }
  if (contatos.length + 1 > capacidades.capacidadeDoGrupo) return fail(`Mais participantes do que a Capacidade do Grupo (${capacidades.capacidadeDoGrupo}).`, "participantes");

  const momento = now();
  const ator = memberActor(actingMemberId);
  const grupo: Grupo = {
    id: nextId("grp"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    nome: input.nome.trim(),
    tipoDeCanal: canal.channelType,
    identificadorExterno: gerarJid(state),
    canalId: canal.id,
    sincronizacao: { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" },
    origemDeCriacao: "criadoPelaPlataforma",
    tagIds: [],
    fieldValues: [],
    comments: [],
    descricao: input.descricao?.trim() ?? "",
    configuracoes: { ...CONFIGURACOES_PADRAO_DO_GRUPO, ...input.configuracoes },
    linkDeConvite: { endereco: gerarEnderecoDeConvite(), estado: "valido", validadoEm: momento },
    capacidade: capacidades.capacidadeDoGrupo,
    participacoes: [],
    pedidosDeEntrada: [],
    ...(comunidade ? { comunidadeId: comunidade.id, papelNaComunidade: "comum" as const, vinculadoAComunidadeEm: momento } : {}),
    captacao: { estado: "ativa", ...input.captacao },
    ...(input.contatoCriadorId ? { contatoCriadorId: input.contatoCriadorId } : {}),
  };
  // O próprio Canal é o primeiro participante — administrador, "É o Canal" (RN-GRP-11).
  abrirParticipacao(state, grupo, { canalParticipanteId: canal.id, identificadorExterno: canal.externalId, papel: "administrador", origem: "adicionado", at: momento, adicionadoPor: ator });
  const administradores = new Set([...criador, ...(input.administradoresContactIds ?? [])]);
  for (const contato of contatos) {
    if (!contato) continue;
    const r = abrirParticipacao(state, grupo, {
      contactId: contato.id,
      identificadorExterno: identidadeDeWhatsApp(contato) ?? "",
      papel: administradores.has(contato.id) ? "administrador" : "membro",
      origem: "adicionado",
      at: momento,
      adicionadoPor: ator,
    });
    if ("erro" in r) return fail(r.erro, "participantes");
  }
  // As imagens viram Arquivos do Espaço de Trabalho (A8) só agora, com tudo
  // validado: uma recusa acima não deixa Arquivo solto.
  const arquivo = (imagem: ImagemDoGrupo): Id => {
    const id = nextId("fil");
    state.files.push({
      id,
      workspaceId: state.workspace.id,
      name: imagem.nome,
      mediaType: "image",
      sizeBytes: imagem.tamanhoBytes,
      createdBy: ator,
      createdAt: momento,
      url: imagem.url,
      // Sem upload autorizado por trás (a imagem vem como data URL): a
      // referência é o mesmo placeholder estável de `attachFile`, nunca o nome.
      objectKey: `legado/${id}`,
      state: "enviado",
    });
    return id;
  };
  if (input.foto) grupo.fotoFileId = arquivo(input.foto);
  if (input.capa) grupo.capaFileId = arquivo(input.capa);
  state.grupos.push(grupo);
  const nomeDoCriador = input.contatoCriadorId ? contatos.find((c) => c?.id === input.contatoCriadorId) : undefined;
  registrarNoGrupo(state, grupo, { actor: ator, action: "Grupo criado", detail: `${canal.name}${comunidade ? ` · na Comunidade ${comunidade.nome}` : ""}${nomeDoCriador ? ` · criador ${contactDisplayName(nomeDoCriador)}` : ""}` });
  for (const p of participacoesVigentes(grupo)) {
    if (p.contactId) emitirEventoDeFerramentas(state, { kind: "contatoEntrouNoGrupo", grupoId: grupo.id, contactId: p.contactId, participacaoId: p.id });
  }
  if (comunidade) reconciliarGrupoDeAvisos(state, comunidade.id, momento);
  return ok(grupo, grupo.id);
}

export interface EnvioDeConvite {
  /** Os Contatos que receberam o link. */
  readonly enviados: readonly Id[];
  /** Os que não receberam, cada um com o porquê (já está no Grupo, janela expirada…). */
  readonly falhas: ReadonlyArray<{ readonly contactId: Id; readonly motivo: string }>;
}

/**
 * ENVIAR O LINK DE CONVITE a Contatos (2026-09-28, C40: "uma lista de
 * contatos para enviar o link do grupo para entrar como participante"). O
 * Canal administrador manda, numa Conversa 1:1 com cada Contato (a que está
 * aberta, ou uma nova — `startConversation`), uma Mensagem com o endereço do
 * Link de convite. A entrada vem depois, quando a pessoa abre o link:
 * Participação com Origem `linkDeConvite` — ou Pedido de Entrada, se os
 * administradores aprovam. Quem já está no Grupo não recebe; cada envio segue
 * as regras do Canal (`sendMessage`: janela de resposta, consentimento) e a
 * recusa de um não impede os outros.
 */
export function enviarLinkDeConvite(state: DataState, actingMemberId: Id, grupoId: Id, contactIds: readonly Id[]): OperationResult<EnvioDeConvite> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle !== "ativo") return fail("Este Grupo não está ativo.");
  const link = grupo.linkDeConvite;
  if (!link || link.estado === "invalido") return fail("O Grupo não tem Link de convite válido: regenere ou sincronize antes de enviar.", "link");
  if (!grupo.canalId) return fail("O Grupo não tem Canal administrador para enviar o link.", "canal");
  const canalRecusa = recusaDoCanal(state, grupo.canalId, "gruposAdministraveis");
  if (canalRecusa) return fail(canalRecusa, "canal");
  const unicos = [...new Set(contactIds)];
  if (unicos.length === 0) return fail("Escolha ao menos um Contato para receber o link.", "contatos");

  const noGrupo = new Set(participacoesVigentes(grupo).map((p) => p.contactId).filter((id): id is Id => id !== undefined));
  const enviados: Id[] = [];
  const falhas: Array<{ readonly contactId: Id; readonly motivo: string }> = [];
  for (const contactId of unicos) {
    const contato = state.contacts.find((c) => c.id === contactId);
    const nome = contato ? contactDisplayName(contato) : "Contato";
    if (noGrupo.has(contactId)) {
      falhas.push({ contactId, motivo: `${nome} já está no Grupo.` });
      continue;
    }
    // 1.2.2 — o ator já passou por `recusaDeMembroAtivo` no início da operação: as
    // exportadas `startConversation` e `sendMessage` conferem a mesma regra.
    const conversa = startConversation(state, actingMemberId, grupo.canalId, contactId);
    if (!conversa.ok) {
      falhas.push({ contactId, motivo: `${nome}: ${conversa.error}` });
      continue;
    }
    const primeiroNome = contato?.firstName.trim();
    const texto = `${primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!"} Você foi convidado para o grupo “${grupo.nome}” no WhatsApp. Para entrar, abra o link: ${link.endereco}`;
    const envio = sendMessage(state, actingMemberId, { conversationId: conversa.value.id, content: texto });
    if (!envio.ok) {
      falhas.push({ contactId, motivo: `${nome}: ${envio.error}` });
      continue;
    }
    enviados.push(contactId);
  }
  if (enviados.length > 0) {
    const nomes = enviados.map((id) => {
      const c = state.contacts.find((x) => x.id === id);
      return c ? contactDisplayName(c) : id;
    });
    registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Link de convite enviado", detail: `para ${nomes.join(", ")}` });
  }
  return ok({ enviados, falhas }, grupo.id);
}

/**
 * 24, 12.1 — o Canal lê os grupos de que participa e cria os que ainda não
 * existem, com Participações `importado`, o Papel do Canal e Captação
 * `inativa` até o Membro decidir (DO-GRP-05). O Limite é conferido antes.
 */
export function importarGruposDoCanal(state: DataState, actingMemberId: Id, canalId: Id): OperationResult<{ readonly importados: Grupo[]; readonly jaExistiam: number }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const canalRecusa = recusaDoCanal(state, canalId, "gruposAdministraveis");
  if (canalRecusa) return fail(canalRecusa, "canal");
  const canal = state.channels.find((c) => c.id === canalId);
  if (!canal) return fail("Canal não encontrado.", "canal");
  const noProvedor = GRUPOS_NO_PROVEDOR[canal.externalId] ?? [];
  const existentes = new Set(state.grupos.map((g) => g.identificadorExterno));
  const novos = noProvedor.filter((g) => !existentes.has(g.jid));
  const limite = recusaDeLimiteDeGrupos(state, novos.length);
  if (limite) return fail(limite);

  const momento = now();
  const ator = memberActor(actingMemberId);
  const importados: Grupo[] = [];
  for (const remoto of novos) {
    const grupo: Grupo = {
      id: nextId("grp"),
      workspaceId: state.workspace.id,
      createdBy: ator,
      createdAt: momento,
      lifecycle: "ativo",
      nome: remoto.nome,
      tipoDeCanal: canal.channelType,
      identificadorExterno: remoto.jid,
      canalId: canal.id,
      sincronizacao: {
        estado: remoto.papelDoCanal === "administrador" ? "sincronizado" : "semPrivilegio",
        conferidoEm: momento,
        papelDoCanal: remoto.papelDoCanal,
        ...(remoto.papelDoCanal !== "administrador" ? { detalhe: "O Canal é participante: só sincronizar e sair." } : {}),
      },
      origemDeCriacao: "importado",
      tagIds: [],
      fieldValues: [],
      comments: [],
      descricao: remoto.descricao,
      configuracoes: { ...remoto.configuracoes },
      ...(remoto.papelDoCanal === "administrador" && remoto.linkDeConvite ? { linkDeConvite: { endereco: remoto.linkDeConvite, estado: "valido" as const, validadoEm: momento } } : {}),
      capacidade: CAPACIDADES_DE_ATIVOS[canal.channelType].capacidadeDoGrupo,
      participacoes: [],
      pedidosDeEntrada: [],
      captacao: { estado: "inativa" },
    };
    abrirParticipacao(state, grupo, { canalParticipanteId: canal.id, identificadorExterno: canal.externalId, papel: remoto.papelDoCanal === "administrador" ? "administrador" : "membro", origem: "importado", at: momento, estimada: true, doProvedor: true });
    const admins = new Set(remoto.administradores);
    for (const numero of remoto.participantes) {
      const outroCanal = canalPeloNumero(state, numero);
      if (outroCanal) {
        abrirParticipacao(state, grupo, { canalParticipanteId: outroCanal.id, identificadorExterno: numero, papel: admins.has(numero) ? "administrador" : "membro", origem: "importado", at: momento, estimada: true, doProvedor: true });
        continue;
      }
      const contato = resolverOuCriarContato(state, canal, numero, `Importação do Grupo ${remoto.nome}`);
      abrirParticipacao(state, grupo, { contactId: contato.id, identificadorExterno: numero, papel: admins.has(numero) ? "administrador" : "membro", origem: "importado", at: momento, estimada: true, doProvedor: true });
    }
    state.grupos.push(grupo);
    registrarNoGrupo(state, grupo, { actor: ator, action: "Grupo importado", detail: `${canal.name} · ${remoto.participantes.length + 1} participantes · Captação inativa até você ativá-la` });
    importados.push(grupo);
  }
  recordActivity(state, { actor: ator, action: "Grupos importados do Canal", objectType: "channel", objectId: canal.id, objectName: canal.name, detail: `${importados.length} novos, ${noProvedor.length - novos.length} já existiam` });
  return ok({ importados, jaExistiam: noProvedor.length - novos.length });
}

// ── Sincronizar ────────────────────────────────────────────────────────────

/**
 * 24, 12.2 — espelha o que o provedor sabe. Simulado: confirma o que está
 * gravado, valida o Link de convite, expira Pedidos quando a Configuração
 * deixou de aprová-los (RN-GRP-16) e reconcilia o Grupo de avisos.
 */
export function sincronizarGrupo(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle === "naLixeira") return fail("O Grupo está na lixeira.");
  const momento = now();
  const antes = grupo.sincronizacao.estado;
  const canal = grupo.canalId ? state.channels.find((c) => c.id === grupo.canalId) : undefined;
  if (!canal || canal.lifecycle !== "ativo") {
    grupo.sincronizacao = { estado: "orfao", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal administrador foi arquivado ou não existe." };
  } else if (canal.connection !== "conectada") {
    return fail(`O Canal ${canal.name} está desconectado: não há como conferir o Grupo.`);
  } else if (grupo.sincronizacao.papelDoCanal === "ausente") {
    grupo.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal não está mais no grupo." };
  } else if (grupo.sincronizacao.papelDoCanal === "participante") {
    grupo.sincronizacao = { estado: "semPrivilegio", conferidoEm: momento, papelDoCanal: "participante", detalhe: "O Canal é participante: só sincronizar e sair." };
  } else {
    grupo.sincronizacao = { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" };
    if (grupo.linkDeConvite) grupo.linkDeConvite = { ...grupo.linkDeConvite, estado: grupo.linkDeConvite.estado === "invalido" ? "invalido" : "valido", validadoEm: momento };
    else grupo.linkDeConvite = { endereco: gerarEnderecoDeConvite(), estado: "valido", validadoEm: momento };
  }
  let expirados = 0;
  if (!grupo.configuracoes.administradoresAprovamEntrada) {
    for (const p of pedidosPendentes(grupo)) {
      p.estado = "expirado";
      p.decididoEm = momento;
      expirados += 1;
    }
  }
  if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  registrarNoGrupo(state, grupo, {
    actor: memberActor(actingMemberId),
    action: "Grupo sincronizado",
    before: antes,
    after: grupo.sincronizacao.estado,
    ...(expirados > 0 ? { detail: `${expirados} Pedido${expirados > 1 ? "s" : ""} de Entrada expirado${expirados > 1 ? "s" : ""} pelo provedor.` } : {}),
  });
  return ok(grupo, grupo.id);
}

// ── Editar o espelhado (RN-GRP-03) ─────────────────────────────────────────

export interface EditarGrupoInput {
  readonly nome?: string;
  readonly descricao?: string;
  readonly configuracoes?: Partial<ConfiguracoesDoGrupo>;
}

/** Nome, Descrição e Configurações são espelhados: mudar é Ferramenta externa com efeito no provedor. */
export function editarGrupo(state: DataState, actingMemberId: Id, grupoId: Id, input: EditarGrupoInput): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const capacidades = CAPACIDADES_DE_ATIVOS[grupo.tipoDeCanal];
  const mudancas: string[] = [];
  if (input.nome !== undefined && input.nome.trim() !== grupo.nome) {
    const r = recusaDeNome(input.nome, capacidades.limiteDoNome);
    if (r) return fail(r, "nome");
    mudancas.push(`nome: “${grupo.nome}” → “${input.nome.trim()}”`);
    grupo.nome = input.nome.trim();
    // A Conversa de grupo espelha o nome (INV-GRP-05): o Identificador de grupo e o título seguem, salvo título editado à mão.
    const conversa = conversaDoGrupo(state, grupo);
    if (conversa) {
      const indice = state.conversations.indexOf(conversa);
      state.conversations[indice] = { ...conversa, groupIdentifier: { externalId: conversa.groupIdentifier?.externalId ?? grupo.identificadorExterno ?? "", name: grupo.nome }, title: conversa.titleEdited ? conversa.title : grupo.nome };
    }
  }
  if (input.descricao !== undefined && input.descricao.trim() !== grupo.descricao) {
    if (input.descricao.length > capacidades.limiteDaDescricao) return fail(`A descrição passa do limite do provedor (${capacidades.limiteDaDescricao} caracteres).`, "descricao");
    mudancas.push("descrição");
    grupo.descricao = input.descricao.trim();
  }
  if (input.configuracoes) {
    const antes = grupo.configuracoes;
    const depois = { ...antes, ...input.configuracoes };
    const chaves = (Object.keys(depois) as Array<keyof ConfiguracoesDoGrupo>).filter((k) => antes[k] !== depois[k]);
    if (chaves.length > 0) {
      grupo.configuracoes = depois;
      mudancas.push(...chaves.map((k) => `${k}: ${depois[k] ? "sim" : "não"}`));
    }
  }
  if (mudancas.length === 0) return ok(grupo);
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Dados do Grupo alterados", detail: mudancas.join("; ") });
  return ok(grupo, grupo.id);
}

/** RN-ATV-03 — trocar o Canal administrador; o novo precisa conferir o Grupo (`nuncaConferido`). */
export function definirCanalDoGrupo(state: DataState, actingMemberId: Id, grupoId: Id, canalId: Id): OperationResult<Grupo> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.canalId === canalId) return ok(grupo);
  const canal = state.channels.find((c) => c.id === canalId);
  if (!canal || canal.lifecycle !== "ativo") return fail("Escolha um Canal ativo.", "canal");
  if (!CAPACIDADES_DE_ATIVOS[canal.channelType].gruposAdministraveis || canal.channelType !== grupo.tipoDeCanal) return fail("O Canal precisa ser do mesmo Tipo do Grupo, com grupos administráveis.", "canal");
  const antes = state.channels.find((c) => c.id === grupo.canalId)?.name ?? "—";
  grupo.canalId = canal.id;
  const papel = participacoesVigentes(grupo).find((p) => p.canalParticipanteId === canal.id)?.papel;
  grupo.sincronizacao = { estado: "nuncaConferido", papelDoCanal: papel === "administrador" ? "administrador" : papel === "membro" ? "participante" : "ausente", detalhe: "Canal administrador trocado: sincronize." };
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Canal administrador alterado", before: antes, after: canal.name });
  return ok(grupo, grupo.id);
}

// ── Captação (só da plataforma — RN-GRP-02) ────────────────────────────────

export function editarCaptacaoDoGrupo(state: DataState, actingMemberId: Id, grupoId: Id, input: Partial<Captacao>): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle === "naLixeira") return fail("O Grupo está na lixeira.");
  if (input.estado === "ativa" && grupo.papelNaComunidade === "avisos") return fail("O Grupo de avisos de uma Comunidade não admite Captação ativa (RN-GRP-17).", "captacao");
  if (input.limiteDeCliques !== undefined && (!Number.isInteger(input.limiteDeCliques) || input.limiteDeCliques < 0)) return fail("O Limite de cliques é um inteiro maior ou igual a zero (zero = sem limite).", "limiteDeCliques");
  if (input.tetoDeCaptacao !== undefined && (!Number.isInteger(input.tetoDeCaptacao) || input.tetoDeCaptacao < 1 || input.tetoDeCaptacao > grupo.capacidade)) return fail(`O Teto de captação fica entre 1 e a Capacidade (${grupo.capacidade}).`, "tetoDeCaptacao");
  const antes = grupo.captacao;
  const depois: Captacao = { ...antes, ...input };
  if (input.limiteDeCliques === 0) delete depois.limiteDeCliques;
  const mudou = JSON.stringify(antes) !== JSON.stringify(depois);
  if (!mudou) return ok(grupo);
  grupo.captacao = depois;
  registrarNoGrupo(state, grupo, {
    actor: memberActor(actingMemberId),
    action: input.estado !== undefined && input.estado !== antes.estado ? (input.estado === "ativa" ? "Captação ativada" : "Captação inativada") : "Captação alterada",
    detail: [
      depois.limiteDeCliques !== undefined ? `Limite de cliques: ${depois.limiteDeCliques}` : "sem Limite de cliques",
      depois.tetoDeCaptacao !== undefined ? `Teto de captação: ${depois.tetoDeCaptacao}` : undefined,
    ].filter((x) => x !== undefined).join(" · "),
  });
  return ok(grupo, grupo.id);
}

export const ativarCaptacao = (state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> =>
  editarCaptacaoDoGrupo(state, actingMemberId, grupoId, { estado: "ativa" });

/** 24, 7.4 — inativar retira o Grupo de todos os Links sem alterar nada no provedor. */
export const inativarCaptacao = (state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> =>
  editarCaptacaoDoGrupo(state, actingMemberId, grupoId, { estado: "inativa" });

/** RN-GRP-08 — Ferramenta com Registro; os Cliques ficam nos Links, só deixam de contar. */
export function zerarCliques(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  grupo.captacao = { ...grupo.captacao, cliquesZeradosEm: now() };
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Cliques zerados" });
  return ok(grupo, grupo.id);
}

// ── Link de convite ────────────────────────────────────────────────────────

/** 24, 7.3 — invalida o anterior no provedor (classe `externa`); os Links de Captação não mudam (RN-GRP-06). */
export function regenerarLinkDeConvite(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const momento = now();
  const anterior = grupo.linkDeConvite?.endereco;
  grupo.linkDeConvite = { endereco: gerarEnderecoDeConvite(), estado: "valido", validadoEm: momento };
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Link de convite regenerado", ...(anterior ? { before: anterior } : {}), after: grupo.linkDeConvite.endereco, detail: "O endereço anterior deixou de valer no provedor." });
  return ok(grupo, grupo.id);
}

// ── Participantes ──────────────────────────────────────────────────────────

/**
 * Ferramenta `adicionar Participante` (classe `externa`): exige Contato com
 * identidade de WhatsApp, e nunca no Grupo de avisos (RN-COM-04).
 */
export function adicionarParticipantes(
  state: DataState,
  actingMemberId: Id,
  grupoId: Id,
  input: { readonly contactIds: readonly Id[]; readonly comoAdministrador?: boolean },
): OperationResult<{ readonly grupo: Grupo; readonly adicionados: ParticipacaoDeGrupo[]; readonly jaEstavam: number }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.papelNaComunidade === "avisos") return fail("O provedor mantém os participantes do Grupo de avisos: ninguém é adicionado lá diretamente (RN-COM-04).");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  if (input.contactIds.length === 0) return fail("Escolha ao menos um Contato.", "contatos");
  const ator = memberActor(actingMemberId);
  const momento = now();
  const adicionados: ParticipacaoDeGrupo[] = [];
  let jaEstavam = 0;
  for (const contactId of input.contactIds) {
    const contato = state.contacts.find((c) => c.id === contactId);
    if (!contato || contato.lifecycle !== "ativo") return fail("Um dos Contatos não está ativo.", "contatos");
    const numero = identidadeDeWhatsApp(contato);
    if (!numero) return fail(`${contactDisplayName(contato)} não tem identidade de WhatsApp: o provedor não o encontra.`, "contatos");
    const r = abrirParticipacao(state, grupo, { contactId: contato.id, identificadorExterno: numero, papel: input.comoAdministrador ? "administrador" : "membro", origem: "adicionado", at: momento, adicionadoPor: ator });
    if ("erro" in r) return fail(r.erro, "contatos");
    if (!r.nova) {
      jaEstavam += 1;
      continue;
    }
    adicionados.push(r.participacao);
    registrarNoGrupo(state, grupo, { actor: ator, action: "Participante adicionado", detail: `${contactDisplayName(contato)}${input.comoAdministrador ? " (administrador)" : ""}` });
    emitirEventoDeFerramentas(state, { kind: "contatoEntrouNoGrupo", grupoId: grupo.id, contactId: contato.id, participacaoId: r.participacao.id });
  }
  if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  return ok({ grupo, adicionados, jaEstavam }, grupo.id);
}

/** RN-GRP-14 — Ferramenta `externa`; a Participação é encerrada, nunca eliminada (INV-GRP-07). */
export function removerParticipante(state: DataState, actingMemberId: Id, grupoId: Id, participacaoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.papelNaComunidade === "avisos") return fail("O provedor mantém os participantes do Grupo de avisos (RN-COM-04).");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const p = grupo.participacoes.find((x) => x.id === participacaoId);
  if (!p) return fail("Participação não encontrada.");
  if (p.saidaEm !== undefined) return fail("Esta Participação já está encerrada.");
  if (p.canalParticipanteId === grupo.canalId) return fail("Para tirar o próprio Canal do Grupo, use “Sair do Grupo”.");
  const ator = memberActor(actingMemberId);
  const momento = now();
  encerrarParticipacao(grupo, p, { causa: "removido", removidoPor: ator, at: momento });
  registrarNoGrupo(state, grupo, { actor: ator, action: "Participante removido", detail: nomeDoParticipante(state, p) });
  if (p.contactId) emitirEventoDeFerramentas(state, { kind: "contatoSaiuDoGrupo", grupoId: grupo.id, contactId: p.contactId, participacaoId: p.id });
  if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  return ok(grupo, grupo.id);
}

function mudarPapel(state: DataState, actingMemberId: Id, grupoId: Id, participacaoId: Id, papel: ParticipacaoDeGrupo["papel"]): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const p = grupo.participacoes.find((x) => x.id === participacaoId);
  if (!p || p.saidaEm !== undefined) return fail("Participação vigente não encontrada.");
  if (p.papel === papel) return ok(grupo);
  if (papel === "membro" && p.canalParticipanteId === grupo.canalId) return fail("Rebaixar o próprio Canal tiraria da plataforma o privilégio de administrar o Grupo.");
  p.papel = papel;
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: papel === "administrador" ? "Participante promovido a administrador" : "Administrador rebaixado a membro", detail: nomeDoParticipante(state, p) });
  return ok(grupo, grupo.id);
}

export const promoverParticipante = (state: DataState, actingMemberId: Id, grupoId: Id, participacaoId: Id): OperationResult<Grupo> =>
  mudarPapel(state, actingMemberId, grupoId, participacaoId, "administrador");

export const rebaixarParticipante = (state: DataState, actingMemberId: Id, grupoId: Id, participacaoId: Id): OperationResult<Grupo> =>
  mudarPapel(state, actingMemberId, grupoId, participacaoId, "membro");

/**
 * 24, 12.4 — Ferramenta `sair do Grupo` (classe `externa`; IRREVERSÍVEL
 * quando o Canal é o único administrador — 20.6): o Canal deixa o grupo, o
 * Papel fica `ausente`, o Grupo `inacessível`. Nunca arquiva por si.
 */
export function sairDoGrupo(state: DataState, actingMemberId: Id, grupoId: Id, input: { readonly entendiIrreversivel?: boolean } = {}): OperationResult<Grupo> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "participante");
  if (externa) return fail(externa);
  const canal = participacoesVigentes(grupo).find((p) => p.canalParticipanteId === grupo.canalId);
  const outrosAdministradores = participacoesVigentes(grupo).filter((p) => p.papel === "administrador" && p.canalParticipanteId !== grupo.canalId).length;
  const irreversivel = grupo.sincronizacao.papelDoCanal === "administrador" && outrosAdministradores === 0;
  if (irreversivel && !input.entendiIrreversivel) {
    return fail("O Canal é o único administrador: sair é irreversível e o provedor pode dissolver o grupo. Confirme que entendeu.", "confirmacao");
  }
  const ator = memberActor(actingMemberId);
  const momento = now();
  if (canal) encerrarParticipacao(grupo, canal, { causa: "saiu", at: momento });
  grupo.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal saiu do grupo." };
  delete grupo.linkDeConvite;
  registrarNoGrupo(state, grupo, { actor: ator, action: "Canal saiu do Grupo", detail: irreversivel ? "Era o único administrador: irreversível." : `${outrosAdministradores} administrador${outrosAdministradores > 1 ? "es" : ""} ficaram no grupo.` });
  return ok(grupo, grupo.id);
}

// ── Ciclo de vida (RN-GRP-04: nunca sai do grupo) ──────────────────────────

export function arquivarGrupo(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle !== "ativo") return fail("Só um Grupo ativo é arquivado.");
  grupo.lifecycle = "arquivado";
  grupo.archivedAt = now();
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Grupo arquivado", detail: "Sai dos Links de Captação; o grupo no provedor não muda (RN-GRP-04)." });
  return ok(grupo, grupo.id);
}

export function restaurarGrupo(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle !== "arquivado") return fail("Só um Grupo arquivado é restaurado por aqui.");
  grupo.lifecycle = "ativo";
  delete grupo.archivedAt;
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Grupo restaurado" });
  return ok(grupo, grupo.id);
}

export function enviarGrupoALixeira(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle === "naLixeira") return ok(grupo);
  grupo.lifecycleBeforeTrash = grupo.lifecycle;
  grupo.lifecycle = "naLixeira";
  grupo.trashedAt = now();
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Grupo enviado à lixeira", detail: "O grupo no provedor não muda (RN-GRP-04)." });
  return ok(grupo);
}

/** B43 + 20.12 — volta ao estado anterior, mas `nuncaConferido`: sincronizar antes de qualquer Ferramenta externa. */
export function restaurarGrupoDaLixeira(state: DataState, actingMemberId: Id, grupoId: Id): OperationResult<Grupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle !== "naLixeira") return fail("O Grupo não está na lixeira.");
  grupo.lifecycle = grupo.lifecycleBeforeTrash ?? "ativo";
  delete grupo.lifecycleBeforeTrash;
  delete grupo.trashedAt;
  grupo.sincronizacao = { ...grupo.sincronizacao, estado: "nuncaConferido", detalhe: "Restaurado da lixeira: sincronize antes de qualquer Ferramenta externa (RN-ATV-08)." };
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Grupo restaurado da lixeira", after: grupo.lifecycle });
  return ok(grupo, grupo.id);
}

// ── Pedidos de Entrada (24, 7.2) ───────────────────────────────────────────

/** Evento do provedor: alguém pediu para entrar. Sem Membro — é o Sistema que registra. */
export function receberPedidoDeEntrada(state: DataState, grupoId: Id, numero: string, input: { readonly linkDeCaptacaoId?: Id } = {}): OperationResult<PedidoDeEntrada> {
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (!grupo.configuracoes.administradoresAprovamEntrada) return fail("Este Grupo não aprova entradas: o provedor deixa entrar direto (RN-GRP-16).");
  const canal = grupo.canalId ? state.channels.find((c) => c.id === grupo.canalId) : undefined;
  if (!canal) return fail("O Grupo está sem Canal.");
  if (canalPeloNumero(state, numero)) return fail("O número é de um Canal do Espaço de Trabalho (RN-GRP-11).");
  const contato = resolverOuCriarContato(state, canal, numero, `Pedido de entrada no Grupo ${grupo.nome}`);
  const pendente = pedidosPendentes(grupo).find((p) => p.contactId === contato.id);
  if (pendente) return ok(pendente);
  const pedido: PedidoDeEntrada = {
    id: nextId("ped"),
    grupoId: grupo.id,
    contactId: contato.id,
    identificadorExternoDoSolicitante: numero,
    solicitadoEm: now(),
    estado: "pendente",
    ...(input.linkDeCaptacaoId ? { origemInformada: "linkDeCaptacao" as const, linkDeCaptacaoId: input.linkDeCaptacaoId } : { origemInformada: "linkDeConvite" as const }),
  };
  grupo.pedidosDeEntrada.push(pedido);
  registrarNoGrupo(state, grupo, { actor: systemActor, action: "Pedido de Entrada recebido", detail: contactDisplayName(contato) });
  emitirEventoDeFerramentas(state, { kind: "pedidoDeEntradaRecebido", grupoId: grupo.id, contactId: contato.id, pedidoId: pedido.id });
  return ok(pedido);
}

/** Ferramenta `aprovar Pedido` (externa): gera a Participação com a Origem que o provedor informou. */
export function aprovarPedidoDeEntrada(state: DataState, actingMemberId: Id, grupoId: Id, pedidoId: Id): OperationResult<ParticipacaoDeGrupo> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const pedido = grupo.pedidosDeEntrada.find((p) => p.id === pedidoId);
  if (!pedido) return fail("Pedido não encontrado.");
  if (pedido.estado !== "pendente") return fail(`Este Pedido já está ${pedido.estado}.`);
  const ator = memberActor(actingMemberId);
  const momento = now();
  const r = abrirParticipacao(state, grupo, {
    contactId: pedido.contactId,
    identificadorExterno: pedido.identificadorExternoDoSolicitante,
    origem: pedido.origemInformada === "linkDeCaptacao" ? "linkDeCaptacao" : "linkDeConvite",
    ...(pedido.linkDeCaptacaoId ? { linkDeCaptacaoId: pedido.linkDeCaptacaoId } : {}),
    at: momento,
  });
  if ("erro" in r) return fail(r.erro);
  pedido.estado = "aprovado";
  pedido.decididoPor = ator;
  pedido.decididoEm = momento;
  const contato = state.contacts.find((c) => c.id === pedido.contactId);
  registrarNoGrupo(state, grupo, { actor: ator, action: "Pedido de Entrada aprovado", detail: contato ? contactDisplayName(contato) : pedido.identificadorExternoDoSolicitante });
  if (r.nova) emitirEventoDeFerramentas(state, { kind: "contatoEntrouNoGrupo", grupoId: grupo.id, contactId: pedido.contactId, participacaoId: r.participacao.id });
  if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  return ok(r.participacao);
}

export function recusarPedidoDeEntrada(state: DataState, actingMemberId: Id, grupoId: Id, pedidoId: Id, motivoId?: Id): OperationResult<PedidoDeEntrada> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  if (externa) return fail(externa);
  const pedido = grupo.pedidosDeEntrada.find((p) => p.id === pedidoId);
  if (!pedido) return fail("Pedido não encontrado.");
  if (pedido.estado !== "pendente") return fail(`Este Pedido já está ${pedido.estado}.`);
  if (motivoId && !state.catalog.some((c) => c.id === motivoId && c.lifecycle === "ativo")) return fail("Motivo de recusa não encontrado.", "motivo");
  pedido.estado = "recusado";
  pedido.decididoPor = memberActor(actingMemberId);
  pedido.decididoEm = now();
  if (motivoId) pedido.motivoDaRecusaId = motivoId;
  const contato = state.contacts.find((c) => c.id === pedido.contactId);
  const motivo = state.catalog.find((c) => c.id === motivoId)?.name;
  registrarNoGrupo(state, grupo, { actor: memberActor(actingMemberId), action: "Pedido de Entrada recusado", detail: `${contato ? contactDisplayName(contato) : pedido.identificadorExternoDoSolicitante}${motivo ? ` — ${motivo}` : ""}` });
  return ok(pedido);
}

// ── Eventos do provedor ────────────────────────────────────────────────────

export interface EntradaNoGrupoInput {
  readonly numero: string;
  readonly origem?: ParticipacaoDeGrupo["origem"];
  readonly linkDeCaptacaoId?: Id;
  readonly cliqueId?: Id;
  readonly origemInferida?: boolean;
  readonly at?: string;
  readonly estimada?: boolean;
  readonly papel?: ParticipacaoDeGrupo["papel"];
}

/** O provedor avisou que alguém entrou (ou a Sincronização o viu — 20.3). Resolve/cria o Contato (RN-GRP-10). */
export function registrarEntradaNoGrupo(state: DataState, grupoId: Id, input: EntradaNoGrupoInput): OperationResult<ParticipacaoDeGrupo> {
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  if (grupo.lifecycle === "naLixeira") return fail("O Grupo está na lixeira.");
  const canal = grupo.canalId ? state.channels.find((c) => c.id === grupo.canalId) : undefined;
  if (!canal) return fail("O Grupo está sem Canal.");
  const momento = input.at ?? now();
  const outroCanal = canalPeloNumero(state, input.numero);
  const base = { identificadorExterno: input.numero, origem: input.origem ?? "desconhecida", at: momento, estimada: input.estimada ?? false, doProvedor: true, ...(input.papel ? { papel: input.papel } : {}) };
  const r = outroCanal
    ? abrirParticipacao(state, grupo, { ...base, canalParticipanteId: outroCanal.id })
    : (() => {
        const contato = resolverOuCriarContato(state, canal, input.numero, `Entrada no Grupo ${grupo.nome}`);
        return abrirParticipacao(state, grupo, {
          ...base,
          contactId: contato.id,
          ...(input.linkDeCaptacaoId ? { linkDeCaptacaoId: input.linkDeCaptacaoId } : {}),
          ...(input.cliqueId ? { cliqueId: input.cliqueId } : {}),
          ...(input.origemInferida ? { origemInferida: true } : {}),
        });
      })();
  if ("erro" in r) return fail(r.erro);
  if (r.nova) {
    registrarNoGrupo(state, grupo, { actor: systemActor, action: "Contato entrou no Grupo", detail: `${nomeDoParticipante(state, r.participacao)} · origem: ${r.participacao.origem}${r.participacao.origemInferida ? " (inferida)" : ""}`, at: momento });
    if (r.participacao.contactId) emitirEventoDeFerramentas(state, { kind: "contatoEntrouNoGrupo", grupoId: grupo.id, contactId: r.participacao.contactId, participacaoId: r.participacao.id });
    if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  }
  return ok(r.participacao);
}

export function registrarSaidaDoGrupo(state: DataState, grupoId: Id, input: { readonly numero: string; readonly causa?: ParticipacaoDeGrupo["causaDaSaida"]; readonly at?: string; readonly estimada?: boolean }): OperationResult<ParticipacaoDeGrupo> {
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const p = participacoesVigentes(grupo).find((x) => x.identificadorExternoDoParticipante === input.numero);
  if (!p) return fail("Ninguém com este número está no Grupo.");
  const momento = input.at ?? now();
  encerrarParticipacao(grupo, p, { causa: input.causa ?? "saiu", at: momento, ...(input.estimada ? { estimada: true } : {}) });
  if (p.canalParticipanteId === grupo.canalId) {
    grupo.sincronizacao = { estado: "inacessivel", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O provedor informou a saída do Canal." };
  }
  registrarNoGrupo(state, grupo, { actor: systemActor, action: "Contato saiu do Grupo", detail: `${nomeDoParticipante(state, p)} · ${p.causaDaSaida ?? "saiu"}`, at: momento });
  if (p.contactId) emitirEventoDeFerramentas(state, { kind: "contatoSaiuDoGrupo", grupoId: grupo.id, contactId: p.contactId, participacaoId: p.id });
  if (grupo.comunidadeId) reconciliarGrupoDeAvisos(state, grupo.comunidadeId, momento);
  return ok(p);
}

// ── Conversa de grupo e Mensagem (RN-GRP-13) ───────────────────────────────

/** INV-GRP-05 — acha a Conversa de grupo; se não existe, cria (aberta ou resolvida conforme Grupos habilitados — 14, 20.18). */
export function conversaDoGrupoOuCriar(state: DataState, ator: ActorRef, grupo: Grupo): OperationResult<Conversation> {
  const existente = conversaDoGrupo(state, grupo);
  if (existente) return ok(existente);
  const canal = grupo.canalId ? state.channels.find((c) => c.id === grupo.canalId) : undefined;
  if (!canal || !grupo.identificadorExterno) return fail("O Grupo está sem Canal ou sem Identificador externo.");
  const momento = now();
  const conversa: Conversation = {
    id: nextId("cnv"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    channelId: canal.id,
    state: canal.groupsEnabled ? "aberta" : "resolvida",
    ...(canal.defaultQueueId ? { queueId: canal.defaultQueueId } : {}),
    title: grupo.nome,
    titleEdited: false,
    drafts: [],
    starredBy: [],
    tagIds: [],
    fieldValues: [],
    groupIdentifier: { externalId: grupo.identificadorExterno, name: grupo.nome },
    participants: [],
    messages: [],
    reopenCount: 0,
    ...(canal.groupsEnabled ? {} : { resolvedAt: momento }),
  };
  state.conversations.push(conversa);
  recordActivity(state, { actor: ator, action: "Conversa de grupo criada", objectType: "conversation", objectId: conversa.id, objectName: conversa.title, detail: canal.groupsEnabled ? "Grupos habilitados no Canal: nasce aberta." : "Grupos não habilitados no Canal: nasce resolvida (14, 20.18)." });
  return ok(conversa);
}

/** RN-GRP-13 — enviar ao Grupo é enviar na Conversa de grupo; o Registro é por Grupo destino. */
export function enviarMensagemAoGrupo(
  state: DataState,
  actingMemberId: Id,
  grupoId: Id,
  input: { readonly content: string; readonly templateProviderId?: string; readonly actor?: ActorRef; readonly delegate?: ActorRef },
): OperationResult<{ readonly conversa: Conversation; readonly mensagem: Message }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const grupo = grupoPorId(state, grupoId);
  if (!grupo) return fail("Grupo não encontrado.");
  const recusa = recusaDeEnvioAoGrupo(state, grupo);
  if (recusa) return fail(recusa);
  if (!input.content.trim()) return fail("Escreva a mensagem antes de enviar.", "conteudo");
  const ator = input.actor ?? memberActor(actingMemberId);
  const conversa = conversaDoGrupoOuCriar(state, ator, grupo);
  if (!conversa.ok) return conversa;
  // 1.2.2 — o ator já passou por `recusaDeMembroAtivo` acima; a `sendMessage` registrada confere a mesma regra.
  const envio = sendMessage(state, actingMemberId, {
    conversationId: conversa.value.id,
    content: input.content,
    ...(input.templateProviderId ? { templateProviderId: input.templateProviderId } : {}),
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.delegate ? { delegate: input.delegate } : {}),
  });
  if (!envio.ok) return envio;
  registrarNoGrupo(state, grupo, { actor: ator, ...(input.delegate ? { delegate: input.delegate } : {}), action: "Mensagem enviada ao Grupo", detail: input.content.slice(0, 80) });
  return ok({ conversa: conversa.value, mensagem: envio.value }, envio.value.id);
}
