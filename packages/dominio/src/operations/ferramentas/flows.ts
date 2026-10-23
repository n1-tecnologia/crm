/**
 * As Ferramentas sobre Flows (23): criar (Versão 1 rascunho com uma Tela),
 * editar só o rascunho (RN-FLW-04) — Telas, Componentes, Dados de Tela,
 * Ponto de troca de dados —, validar (7.5), publicar (DO-FLW-03: a
 * publicada vira obsoleta, o rascunho vira publicada e nasce um rascunho
 * novo copiado), despublicar, descartar rascunho, criar rascunho a partir de
 * qualquer Versão (RN-FLW-05), copiar, ciclo de vida, enviar dentro de uma
 * Mensagem (7.6) e receber a Resposta (Evento do provedor).
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type {
  AcaoDeComponente,
  ActorRef,
  Attachment,
  CategoriaDeFlow,
  ComponenteDeFlow,
  CondicaoDeComponente,
  Conversation,
  DadoDeTela,
  EnvioDeFlow,
  Flow,
  Id,
  Message,
  PropriedadesDeComponente,
  RespostaDeFlow,
  TelaDeFlow,
  TipoDeComponente,
  VersaoDeFlow,
} from "../../types";
import { contactDisplayName } from "../../derive";
import { camposDeFlow, telaInicial, telasOrdenadas, versaoCorrente, versaoPublicada } from "../../derive-ferramentas";
import { memberActor, nextId, recordActivity, systemActor } from "../activity";
import { CHANNEL_CAPABILITIES, receiveMessage, sendMessage } from "../conversations";
import { emitirEventoDeFerramentas } from "./automacoes";
import { CAPACIDADES_DE_ATIVOS, VERSAO_DE_ESQUEMA_CORRENTE } from "./capacidades";
import { CATALOGO_DE_COMPONENTES } from "./flows-catalogo";
import { IDENTIFICADOR_DE_TELA, definicaoPublicavel, validarVersao, type ProblemaDeValidacao } from "./flows-validacao";
import { recusaDeAdministracao, recusaDeEnvioDeFlow, recusaDeMembroAtivo, recusaDePublicacao, recusaDoCanal } from "./permissoes";
import { gerarChavePublica, gerarIdentificadorDeFlow, gerarIdentificadorDeResposta } from "./provedor-simulado";

const now = (): string => new Date().toISOString();

const flowPorId = (state: DataState, id: Id): Flow | undefined => state.flows.find((f) => f.id === id);

function registrarNoFlow(
  state: DataState,
  flow: Flow,
  input: { readonly actor: ActorRef; readonly delegate?: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string },
): void {
  recordActivity(state, { ...input, objectType: "flow", objectId: flow.id, objectName: flow.nome });
}

// ── Cópias (as Versões são imutáveis; copiar é a única forma de "editar" uma) ──

const copiarComponente = (c: ComponenteDeFlow): ComponenteDeFlow => ({
  id: nextId("cmp"),
  tipo: c.tipo,
  ...(c.nome !== undefined ? { nome: c.nome } : {}),
  propriedades: JSON.parse(JSON.stringify(c.propriedades)) as PropriedadesDeComponente,
  ...(c.acao ? { acao: { ...c.acao, ...(c.acao.cargaUtil ? { cargaUtil: { ...c.acao.cargaUtil } } : {}) } } : {}),
  ...(c.filhos ? { filhos: c.filhos.map(copiarComponente) } : {}),
  ...(c.condicao ? { condicao: { ...c.condicao } } : {}),
});

const copiarTela = (t: TelaDeFlow): TelaDeFlow => ({
  id: nextId("tel"),
  identificador: t.identificador,
  titulo: t.titulo,
  ordem: t.ordem,
  terminal: t.terminal,
  dados: t.dados.map((d) => ({ ...d })),
  componentes: t.componentes.map(copiarComponente),
});

function novaVersao(flow: Flow, numero: number, telas: TelaDeFlow[], proveniencia?: VersaoDeFlow): VersaoDeFlow {
  return {
    id: nextId("vfl"),
    flowId: flow.id,
    numero,
    estado: "rascunho",
    versaoDeEsquema: proveniencia?.versaoDeEsquema ?? VERSAO_DE_ESQUEMA_CORRENTE,
    telas,
    ...(proveniencia ? { proveniencia: { versaoId: proveniencia.id, numero: proveniencia.numero } } : {}),
    createdAt: now(),
  };
}

/** A Tela com que todo Flow nasce: um Título e nada mais; terminal, para a Versão 1 já ser válida. */
function telaInicialPadrao(nomeDoFlow: string): TelaDeFlow {
  return {
    id: nextId("tel"),
    identificador: "inicio",
    titulo: nomeDoFlow.slice(0, 30),
    ordem: 0,
    terminal: true,
    dados: [],
    componentes: [{ id: nextId("cmp"), tipo: "titulo", propriedades: { texto: nomeDoFlow.slice(0, 80) } }],
  };
}

/** O rascunho editável, ou por que não há (RN-FLW-04). */
function rascunhoEditavel(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<{ readonly flow: Flow; readonly versao: VersaoDeFlow }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle !== "ativo") return fail("Restaure o Flow antes de editar.");
  const versao = versaoCorrente(flow);
  if (!versao) return fail("O Flow não tem rascunho: crie um a partir de uma Versão (RN-FLW-05).");
  return ok({ flow, versao });
}

// ── Criar, editar, copiar ──────────────────────────────────────────────────

export interface CriarFlowInput {
  readonly nome: string;
  readonly descricao?: string;
  readonly categoria: CategoriaDeFlow;
  readonly canalId?: Id;
}

/** 23, 12.1 — registro ativo, Origem `criadoPelaPlataforma`, Versão 1 rascunho com uma Tela. */
export function criarFlow(state: DataState, actingMemberId: Id, input: CriarFlowInput): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const nome = input.nome.trim();
  if (!nome) return fail("Dê um nome ao Flow.", "nome");
  if (nome.length > 100) return fail("O nome passa de 100 caracteres.", "nome");
  let tipoDeCanal: Flow["tipoDeCanal"] = "whatsapp";
  if (input.canalId !== undefined) {
    const canal = state.channels.find((c) => c.id === input.canalId);
    if (!canal || canal.lifecycle !== "ativo") return fail("Escolha um Canal ativo.", "canal");
    if (!CAPACIDADES_DE_ATIVOS[canal.channelType].formulariosInterativos) return fail(`O Tipo de Canal ${canal.channelType} não tem formulários interativos.`, "canal");
    tipoDeCanal = canal.channelType;
  }
  const momento = now();
  const ator = memberActor(actingMemberId);
  const flow: Flow = {
    id: nextId("flw"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    nome,
    tipoDeCanal,
    ...(input.canalId !== undefined ? { canalId: input.canalId } : {}),
    sincronizacao: { estado: "nuncaConferido", papelDoCanal: input.canalId !== undefined ? "administrador" : "ausente", detalhe: "Ainda não publicado." },
    origemDeCriacao: "criadoPelaPlataforma",
    tagIds: [],
    fieldValues: [],
    comments: [],
    descricao: input.descricao?.trim() ?? "",
    categoria: input.categoria,
    versoes: [],
  };
  flow.versoes.push(novaVersao(flow, 1, [telaInicialPadrao(nome)]));
  state.flows.push(flow);
  registrarNoFlow(state, flow, { actor: ator, action: "Flow criado", detail: "Versão 1 em rascunho, com a Tela inicial." });
  return ok(flow, flow.id);
}

export interface EditarFlowInput {
  readonly nome?: string;
  readonly descricao?: string;
  readonly categoria?: CategoriaDeFlow;
  readonly canalId?: Id | null;
}

/** RN-FLW-09 — trocar o Canal publicador com Versão publicada exige administrar e torna a publicada obsoleta. */
export function editarFlow(state: DataState, actingMemberId: Id, flowId: Id, input: EditarFlowInput): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle === "naLixeira") return fail("O Flow está na lixeira.");
  const ator = memberActor(actingMemberId);
  const mudancas: string[] = [];
  if (input.nome !== undefined && input.nome.trim() !== flow.nome) {
    const n = input.nome.trim();
    if (!n) return fail("Dê um nome ao Flow.", "nome");
    if (n.length > 100) return fail("O nome passa de 100 caracteres.", "nome");
    mudancas.push(`nome: “${flow.nome}” → “${n}”`);
    flow.nome = n;
  }
  if (input.descricao !== undefined && input.descricao.trim() !== flow.descricao) {
    flow.descricao = input.descricao.trim();
    mudancas.push("descrição");
  }
  if (input.categoria !== undefined && input.categoria !== flow.categoria) {
    flow.categoria = input.categoria;
    mudancas.push(`categoria: ${input.categoria}`);
  }
  if (input.canalId !== undefined && (input.canalId ?? undefined) !== flow.canalId) {
    const publicada = versaoPublicada(flow);
    if (publicada) {
      const adm = recusaDeAdministracao(state, actingMemberId);
      if (adm) return fail(adm, "canal");
    }
    if (input.canalId !== null) {
      const canal = state.channels.find((c) => c.id === input.canalId);
      if (!canal || canal.lifecycle !== "ativo") return fail("Escolha um Canal ativo.", "canal");
      if (!CAPACIDADES_DE_ATIVOS[canal.channelType].formulariosInterativos || canal.channelType !== flow.tipoDeCanal) return fail("O Canal publicador precisa ser do mesmo Tipo do Flow, com formulários interativos.", "canal");
    }
    const antes = state.channels.find((c) => c.id === flow.canalId)?.name ?? "—";
    if (input.canalId === null) delete flow.canalId;
    else flow.canalId = input.canalId;
    const depois = state.channels.find((c) => c.id === flow.canalId)?.name ?? "—";
    if (publicada) {
      publicada.estado = "obsoleta";
      publicada.obsoletaEm = now();
      delete flow.identificadorExterno;
      delete flow.estadoNoProvedor;
      flow.sincronizacao = { estado: "nuncaConferido", papelDoCanal: flow.canalId ? "administrador" : "ausente", detalhe: "Canal publicador trocado: republique pelo novo Canal (RN-FLW-09)." };
      registrarNoFlow(state, flow, { actor: ator, action: "Versão tornada obsoleta", before: `v${publicada.numero} publicada`, after: `v${publicada.numero} obsoleta`, detail: "O objeto publicado pertence à conta anterior (RN-FLW-09)." });
    }
    registrarNoFlow(state, flow, { actor: ator, action: "Canal publicador alterado", before: antes, after: depois });
  }
  if (mudancas.length > 0) registrarNoFlow(state, flow, { actor: ator, action: "Dados do Flow alterados", detail: mudancas.join("; ") });
  return ok(flow, flow.id);
}

/** 23, 6.1 — o par de chaves nasce aqui; só a pública fica gravada (INV-FLW-09). */
export function definirPontoDeTrocaDeDados(state: DataState, actingMemberId: Id, flowId: Id, endereco: string): OperationResult<Flow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow } = r.value;
  const url = endereco.trim();
  if (!/^https:\/\/[^\s]+$/.test(url)) return fail("O endereço do Ponto de troca de dados começa por https://.", "endereco");
  const existia = flow.pontoDeTrocaDeDados !== undefined;
  flow.pontoDeTrocaDeDados = { endereco: url, chavePublica: flow.pontoDeTrocaDeDados?.chavePublica ?? gerarChavePublica(), chavesGeradasEm: flow.pontoDeTrocaDeDados?.chavesGeradasEm ?? now() };
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: existia ? "Ponto de troca de dados alterado" : "Ponto de troca de dados definido", after: url, ...(existia ? {} : { detail: "Par de chaves gerado; a privada não fica gravada (INV-FLW-09)." }) });
  return ok(flow, flow.id);
}

/** RN-FLW-10 — regenerar invalida o par anterior com Registro e exige republicar. */
export function regenerarChavesDoPonto(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (!flow.pontoDeTrocaDeDados) return fail("O Flow não tem Ponto de troca de dados.");
  flow.pontoDeTrocaDeDados = { ...flow.pontoDeTrocaDeDados, chavePublica: gerarChavePublica(), chavesGeradasEm: now() };
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Chaves do Ponto de troca de dados regeneradas", detail: "O par anterior deixou de valer; republique a Versão (RN-FLW-10)." });
  return ok(flow, flow.id);
}

export function removerPontoDeTrocaDeDados(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow } = r.value;
  if (!flow.pontoDeTrocaDeDados) return ok(flow);
  delete flow.pontoDeTrocaDeDados;
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Ponto de troca de dados removido", detail: "Ações “troca de dados” do rascunho passam a falhar na validação (RN-FLW-10)." });
  return ok(flow);
}

// ── Telas (só no rascunho) ─────────────────────────────────────────────────

export function adicionarTela(state: DataState, actingMemberId: Id, flowId: Id, input: { readonly identificador: string; readonly titulo: string; readonly terminal?: boolean }): OperationResult<TelaDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const identificador = input.identificador.trim();
  if (!IDENTIFICADOR_DE_TELA.test(identificador)) return fail("O Identificador de Tela só admite letras minúsculas e sublinhado (por exemplo: dados_pessoais).", "identificador");
  if (versao.telas.some((t) => t.identificador === identificador)) return fail(`Já existe a Tela “${identificador}” nesta Versão.`, "identificador");
  const titulo = input.titulo.trim();
  if (!titulo) return fail("Dê um título à Tela.", "titulo");
  const tela: TelaDeFlow = { id: nextId("tel"), identificador, titulo, ordem: versao.telas.length, terminal: input.terminal ?? false, dados: [], componentes: [] };
  versao.telas.push(tela);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Tela adicionada", detail: `v${versao.numero} · ${identificador}` });
  return ok(tela);
}

export interface EditarTelaInput {
  readonly identificador?: string;
  readonly titulo?: string;
  readonly terminal?: boolean;
  readonly dados?: readonly DadoDeTela[];
}

/** RN-FLW-08 — renomear o Identificador reescreve toda Ação que o referencia, atomicamente. */
export function editarTela(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, input: EditarTelaInput): OperationResult<TelaDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const mudancas: string[] = [];
  if (input.identificador !== undefined && input.identificador.trim() !== tela.identificador) {
    const novo = input.identificador.trim();
    if (!IDENTIFICADOR_DE_TELA.test(novo)) return fail("O Identificador de Tela só admite letras minúsculas e sublinhado.", "identificador");
    if (versao.telas.some((t) => t.id !== tela.id && t.identificador === novo)) return fail(`Já existe a Tela “${novo}” nesta Versão.`, "identificador");
    const antigo = tela.identificador;
    let reescritas = 0;
    const reescrever = (acao: AcaoDeComponente | undefined) => {
      if (acao && acao.telaDeDestino === antigo) {
        acao.telaDeDestino = novo;
        reescritas += 1;
      }
    };
    const visitar = (lista: ComponenteDeFlow[]) => {
      for (const c of lista) {
        reescrever(c.acao);
        for (const o of c.propriedades.opcoes ?? []) reescrever(o.acao);
        if (c.filhos) visitar(c.filhos);
      }
    };
    for (const t of versao.telas) visitar(t.componentes);
    tela.identificador = novo;
    mudancas.push(`identificador: ${antigo} → ${novo}${reescritas > 0 ? ` (${reescritas} Aç${reescritas > 1 ? "ões" : "ão"} reescrita${reescritas > 1 ? "s" : ""})` : ""}`);
  }
  if (input.titulo !== undefined && input.titulo.trim() && input.titulo.trim() !== tela.titulo) {
    tela.titulo = input.titulo.trim();
    mudancas.push("título");
  }
  if (input.terminal !== undefined && input.terminal !== tela.terminal) {
    tela.terminal = input.terminal;
    mudancas.push(input.terminal ? "terminal" : "não terminal");
  }
  if (input.dados !== undefined) {
    const nomes = new Set<string>();
    for (const d of input.dados) {
      if (!/^[a-z][a-z0-9_]*$/.test(d.nome)) return fail(`O Dado de Tela “${d.nome}” só admite letras minúsculas, dígitos e sublinhado.`, "dados");
      if (nomes.has(d.nome)) return fail(`Dado de Tela repetido: “${d.nome}”.`, "dados");
      nomes.add(d.nome);
    }
    tela.dados = input.dados.map((d) => ({ nome: d.nome, tipo: d.tipo, ...(d.exemplo !== undefined && d.exemplo !== "" ? { exemplo: d.exemplo } : {}) }));
    mudancas.push(`Dados de Tela (${tela.dados.length})`);
  }
  if (mudancas.length === 0) return ok(tela);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Tela alterada", detail: `v${versao.numero} · ${tela.identificador} · ${mudancas.join("; ")}` });
  return ok(tela);
}

export function reordenarTela(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, direcao: "subir" | "descer"): OperationResult<VersaoDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const telas = telasOrdenadas(versao);
  const indice = telas.findIndex((t) => t.id === telaId);
  if (indice < 0) return fail("Tela não encontrada.");
  const destino = direcao === "subir" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= telas.length) return ok(versao);
  const a = telas[indice];
  const b = telas[destino];
  if (!a || !b) return ok(versao);
  [a.ordem, b.ordem] = [b.ordem, a.ordem];
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Telas reordenadas", detail: `v${versao.numero} · ${a.identificador} ${direcao === "subir" ? "↑" : "↓"}` });
  return ok(versao);
}

export function duplicarTela(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id): OperationResult<TelaDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const origem = versao.telas.find((t) => t.id === telaId);
  if (!origem) return fail("Tela não encontrada.");
  let identificador = `${origem.identificador}_copia`;
  let n = 2;
  while (versao.telas.some((t) => t.identificador === identificador)) identificador = `${origem.identificador}_copia_${n++}`;
  const copia = { ...copiarTela(origem), identificador, titulo: `${origem.titulo} (cópia)`.slice(0, 30), ordem: versao.telas.length };
  versao.telas.push(copia);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Tela duplicada", detail: `v${versao.numero} · ${origem.identificador} → ${identificador}` });
  return ok(copia);
}

/** 23, 12.2 — remover a última terminal é rejeitado se restar Tela final não terminal. */
export function removerTela(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id): OperationResult<VersaoDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  if (versao.telas.length === 1) return fail("A Versão precisa de ao menos uma Tela.");
  const restantes = telasOrdenadas(versao).filter((t) => t.id !== telaId);
  const ultima = restantes[restantes.length - 1];
  if (tela.terminal && ultima && !ultima.terminal && !restantes.some((t) => t.terminal)) {
    return fail(`Remover “${tela.titulo}” deixaria a Versão sem Tela terminal. Marque outra como terminal antes.`);
  }
  versao.telas = restantes.map((t, i) => Object.assign(t, { ordem: i }));
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Tela removida", detail: `v${versao.numero} · ${tela.identificador}` });
  return ok(versao);
}

// ── Componentes (só no rascunho) ───────────────────────────────────────────

function localizar(lista: ComponenteDeFlow[], id: Id): { readonly lista: ComponenteDeFlow[]; readonly indice: number; readonly componente: ComponenteDeFlow } | undefined {
  const indice = lista.findIndex((c) => c.id === id);
  if (indice >= 0) {
    const componente = lista[indice];
    if (componente) return { lista, indice, componente };
  }
  for (const c of lista) {
    if (c.filhos) {
      const achado = localizar(c.filhos, id);
      if (achado) return achado;
    }
  }
  return undefined;
}

/** O que cada Tipo traz preenchido ao nascer, para o Membro editar em vez de partir do vazio. */
function propriedadesIniciais(tipo: TipoDeComponente): PropriedadesDeComponente {
  const def = CATALOGO_DE_COMPONENTES[tipo];
  switch (tipo) {
    case "titulo":
    case "subtitulo":
    case "paragrafo":
    case "legenda":
    case "textoRico":
      return { texto: def.rotulo };
    case "linkIncorporado":
      return { texto: "Saiba mais" };
    case "consentimento":
      return { texto: "Aceito receber mensagens sobre o programa.", obrigatorio: true };
    case "rodape":
      return { rotulo: "Continuar" };
    case "campoDeTexto":
      return { rotulo: "Campo", tipoDeEntrada: "texto", obrigatorio: true };
    case "calendario":
      return { rotulo: "Data", modo: "unico" };
    case "coletaDeFotos":
      return { rotulo: "Fotos", origemDaFoto: "cameraEGaleria", minimo: 1, maximo: 3 };
    default:
      if (def.temOpcoes) return { rotulo: def.rotulo, opcoes: [{ id: "opcao_1", titulo: "Opção 1" }, { id: "opcao_2", titulo: "Opção 2" }] };
      if (def.entrada) return { rotulo: def.rotulo };
      return {};
  }
}

/** Um Nome único para o Componente de entrada, a partir do Tipo. */
function nomeLivre(versao: VersaoDeFlow, base: string): string {
  const usados = new Set(camposDeFlow(versao).map((c) => c.nome));
  let nome = base;
  let n = 2;
  while (usados.has(nome)) nome = `${base}_${n++}`;
  return nome;
}

export interface AdicionarComponenteInput {
  readonly tipo: TipoDeComponente;
  /** Dentro de um Formulário ou Condicional; ausente = nível raiz. */
  readonly paiId?: Id;
}

export function adicionarComponente(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, input: AdicionarComponenteInput): OperationResult<ComponenteDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const def = CATALOGO_DE_COMPONENTES[input.tipo];
  let destino = tela.componentes;
  if (input.paiId !== undefined) {
    const pai = localizar(tela.componentes, input.paiId)?.componente;
    if (!pai) return fail("Contêiner não encontrado.");
    if (!CATALOGO_DE_COMPONENTES[pai.tipo].aceitaFilhos) return fail(`${CATALOGO_DE_COMPONENTES[pai.tipo].rotulo} não admite filhos: só Formulário e Condicional.`);
    if (input.tipo === "rodape") return fail("O Rodapé fica no nível raiz da Tela (7.5.6).");
    pai.filhos ??= [];
    destino = pai.filhos;
  }
  if (input.tipo === "rodape" && tela.componentes.some((c) => c.tipo === "rodape")) return fail("A Tela já tem um Rodapé; só cabe um (7.5.6).");
  const componente: ComponenteDeFlow = {
    id: nextId("cmp"),
    tipo: input.tipo,
    ...(def.entrada ? { nome: nomeLivre(versao, input.tipo.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)) } : {}),
    propriedades: propriedadesIniciais(input.tipo),
    ...(input.tipo === "rodape" ? { acao: { tipo: tela.terminal ? "concluir" : "navegar" } as AcaoDeComponente } : {}),
    ...(def.aceitaFilhos ? { filhos: [] } : {}),
  };
  // O Rodapé é sempre o último de nível raiz (7.5.6): qualquer outro entra antes dele.
  const rodape = destino === tela.componentes ? tela.componentes.findIndex((c) => c.tipo === "rodape") : -1;
  if (input.tipo !== "rodape" && rodape >= 0) destino.splice(rodape, 0, componente);
  else destino.push(componente);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Componente adicionado", detail: `v${versao.numero} · ${tela.identificador} · ${def.rotulo}${componente.nome ? ` (${componente.nome})` : ""}` });
  return ok(componente);
}

export interface EditarComponenteInput {
  readonly nome?: string;
  readonly propriedades?: Partial<PropriedadesDeComponente>;
  readonly acao?: AcaoDeComponente | null;
  readonly condicao?: CondicaoDeComponente | null;
}

export function editarComponente(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, componenteId: Id, input: EditarComponenteInput): OperationResult<ComponenteDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const achado = localizar(tela.componentes, componenteId);
  if (!achado) return fail("Componente não encontrado.");
  const { componente } = achado;
  const def = CATALOGO_DE_COMPONENTES[componente.tipo];
  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (!def.entrada && nome) return fail(`${def.rotulo} não é Componente de entrada: não tem Nome.`, "nome");
    if (def.entrada) {
      if (nome && !/^[a-z][a-z0-9_]*$/.test(nome)) return fail("O Nome só admite letras minúsculas, dígitos e sublinhado, começando por letra.", "nome");
      if (nome && camposDeFlow(versao).some((c) => c.nome === nome && c.componenteId !== componente.id)) return fail(`O Nome “${nome}” já existe nesta Versão (INV-FLW-04).`, "nome");
      if (nome) componente.nome = nome;
      else delete componente.nome;
    }
  }
  if (input.propriedades) {
    const proximas = { ...componente.propriedades, ...input.propriedades };
    for (const [k, v] of Object.entries(proximas)) if (v === undefined || v === "") delete (proximas as Record<string, unknown>)[k];
    componente.propriedades = proximas;
  }
  if (input.acao !== undefined) {
    if (input.acao === null) delete componente.acao;
    else {
      if (!def.aceitaAcao) return fail(`${def.rotulo} não carrega Ação.`, "acao");
      componente.acao = { tipo: input.acao.tipo, ...(input.acao.telaDeDestino ? { telaDeDestino: input.acao.telaDeDestino } : {}), ...(input.acao.endereco ? { endereco: input.acao.endereco } : {}), ...(input.acao.cargaUtil && Object.keys(input.acao.cargaUtil).length > 0 ? { cargaUtil: { ...input.acao.cargaUtil } } : {}) };
    }
  }
  if (input.condicao !== undefined) {
    if (componente.tipo !== "condicional") return fail("Só o Condicional tem Condição.", "condicao");
    if (input.condicao === null) delete componente.condicao;
    else componente.condicao = { ...input.condicao };
  }
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Componente alterado", detail: `v${versao.numero} · ${tela.identificador} · ${def.rotulo}${componente.nome ? ` (${componente.nome})` : ""}` });
  return ok(componente);
}

export type MoverComponenteInput = { readonly direcao: "subir" | "descer" } | { readonly paraDentroDe: Id | null };

/** Sobe/desce entre irmãos, ou muda de contêiner (Formulário/Condicional ↔ raiz). */
export function moverComponente(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, componenteId: Id, input: MoverComponenteInput): OperationResult<TelaDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const achado = localizar(tela.componentes, componenteId);
  if (!achado) return fail("Componente não encontrado.");
  const { lista, indice, componente } = achado;
  if ("direcao" in input) {
    const destino = input.direcao === "subir" ? indice - 1 : indice + 1;
    if (destino < 0 || destino >= lista.length) return ok(tela);
    const outro = lista[destino];
    if (!outro) return ok(tela);
    if (componente.tipo === "rodape" || outro.tipo === "rodape") return fail("O Rodapé é sempre o último Componente da Tela (7.5.6).");
    lista[indice] = outro;
    lista[destino] = componente;
  } else {
    if (componente.tipo === "rodape") return fail("O Rodapé fica no nível raiz da Tela.");
    lista.splice(indice, 1);
    if (input.paraDentroDe === null) {
      const rodape = tela.componentes.findIndex((c) => c.tipo === "rodape");
      if (rodape >= 0) tela.componentes.splice(rodape, 0, componente);
      else tela.componentes.push(componente);
    } else {
      const pai = localizar(tela.componentes, input.paraDentroDe)?.componente;
      if (!pai || !CATALOGO_DE_COMPONENTES[pai.tipo].aceitaFilhos) {
        lista.splice(indice, 0, componente);
        return fail("Só Formulário e Condicional recebem Componentes.");
      }
      if (pai.id === componente.id || (componente.filhos && localizar(componente.filhos, pai.id))) {
        lista.splice(indice, 0, componente);
        return fail("Um Componente não entra dentro de si mesmo.");
      }
      pai.filhos ??= [];
      pai.filhos.push(componente);
    }
  }
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Componente movido", detail: `v${versao.numero} · ${tela.identificador} · ${CATALOGO_DE_COMPONENTES[componente.tipo].rotulo}` });
  return ok(tela);
}

export function duplicarComponente(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, componenteId: Id): OperationResult<ComponenteDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const achado = localizar(tela.componentes, componenteId);
  if (!achado) return fail("Componente não encontrado.");
  if (achado.componente.tipo === "rodape") return fail("A Tela só tem um Rodapé (7.5.6).");
  const copia = copiarComponente(achado.componente);
  // Os Nomes das entradas copiadas ganham sufixo: dois iguais falhariam em INV-FLW-04.
  const renomear = (c: ComponenteDeFlow) => {
    if (c.nome) c.nome = nomeLivre(versao, c.nome);
    c.filhos?.forEach(renomear);
  };
  renomear(copia);
  achado.lista.splice(achado.indice + 1, 0, copia);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Componente duplicado", detail: `v${versao.numero} · ${tela.identificador} · ${CATALOGO_DE_COMPONENTES[copia.tipo].rotulo}` });
  return ok(copia);
}

export function removerComponente(state: DataState, actingMemberId: Id, flowId: Id, telaId: Id, componenteId: Id): OperationResult<TelaDeFlow> {
  const r = rascunhoEditavel(state, actingMemberId, flowId);
  if (!r.ok) return r;
  const { flow, versao } = r.value;
  const tela = versao.telas.find((t) => t.id === telaId);
  if (!tela) return fail("Tela não encontrada.");
  const achado = localizar(tela.componentes, componenteId);
  if (!achado) return fail("Componente não encontrado.");
  achado.lista.splice(achado.indice, 1);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Componente removido", detail: `v${versao.numero} · ${tela.identificador} · ${CATALOGO_DE_COMPONENTES[achado.componente.tipo].rotulo}${achado.componente.nome ? ` (${achado.componente.nome})` : ""}` });
  return ok(tela);
}

// ── Versões ────────────────────────────────────────────────────────────────

/** Leitura: os problemas de 7.5 do rascunho (ou de outra Versão pedida). */
export function validarVersaoDoFlow(state: DataState, flowId: Id, versaoId?: Id): OperationResult<ProblemaDeValidacao[]> {
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  const versao = versaoId ? flow.versoes.find((v) => v.id === versaoId) : versaoCorrente(flow);
  if (!versao) return fail("Versão não encontrada.");
  return ok(validarVersao(flow, versao, state.files));
}

/**
 * 23, 12.3 — valida → "envia" ao provedor pelo Canal publicador → grava
 * Identificador externo (1ª vez), instantâneo, publicada por, momento →
 * `publicada`; a anterior `obsoleta`; nova `rascunho` copiada (DO-FLW-03).
 * Falha: nada muda; Registro com motivo.
 */
export function publicarVersao(state: DataState, actingMemberId: Id, flowId: Id, input: { readonly notas?: string } = {}): OperationResult<{ readonly publicada: VersaoDeFlow; readonly rascunho: VersaoDeFlow }> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  const recusa = recusaDePublicacao(state, flow);
  if (recusa) return fail(recusa);
  const rascunho = versaoCorrente(flow);
  if (!rascunho) return fail("O Flow não tem rascunho para publicar.");
  const ator = memberActor(actingMemberId);
  const problemas = validarVersao(flow, rascunho, state.files);
  if (problemas.length > 0) {
    registrarNoFlow(state, flow, { actor: ator, action: "Validação falhou", result: "failed", detail: `v${rascunho.numero}: ${problemas.length} problema${problemas.length > 1 ? "s" : ""} — ${problemas.slice(0, 3).map((p) => p.mensagem).join(" · ")}${problemas.length > 3 ? " …" : ""}` });
    return fail(`A Versão ${rascunho.numero} tem ${problemas.length} problema${problemas.length > 1 ? "s" : ""} de validação. Corrija antes de publicar.`, "validacao");
  }
  const momento = now();
  const anterior = versaoPublicada(flow);
  if (anterior) {
    anterior.estado = "obsoleta";
    anterior.obsoletaEm = momento;
  }
  rascunho.estado = "publicada";
  rascunho.publicadaPor = ator;
  rascunho.publicadaEm = momento;
  if (flow.canalId !== undefined) rascunho.canalPublicadorId = flow.canalId;
  rascunho.instantaneoPublicado = definicaoPublicavel(flow, rascunho);
  if (input.notas?.trim()) rascunho.notas = input.notas.trim();
  if (!flow.identificadorExterno) flow.identificadorExterno = gerarIdentificadorDeFlow();
  flow.estadoNoProvedor = "publicado";
  flow.sincronizacao = { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" };
  const numero = Math.max(...flow.versoes.map((v) => v.numero)) + 1;
  const novoRascunho = novaVersao(flow, numero, rascunho.telas.map(copiarTela), rascunho);
  flow.versoes.push(novoRascunho);
  registrarNoFlow(state, flow, { actor: ator, action: "Versão publicada", after: `v${rascunho.numero}`, detail: `${anterior ? `v${anterior.numero} tornada obsoleta · ` : ""}v${numero} aberta em rascunho a partir da publicada (DO-FLW-03).` });
  return ok({ publicada: rascunho, rascunho: novoRascunho });
}

/** 23, 7.1 — a publicada vira obsoleta sem publicar outra: o Flow deixa de ser enviável. */
export function despublicarFlow(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const adm = recusaDeAdministracao(state, actingMemberId);
  if (adm) return fail(adm);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  const publicada = versaoPublicada(flow);
  if (!publicada) return fail("O Flow não tem Versão publicada.");
  publicada.estado = "obsoleta";
  publicada.obsoletaEm = now();
  flow.estadoNoProvedor = "removido";
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Versão despublicada", before: `v${publicada.numero} publicada`, after: `v${publicada.numero} obsoleta`, detail: "O Flow deixa de ser enviável; Respostas pendentes continuam a chegar." });
  return ok(flow, flow.id);
}

/** INV-FLW-01 / RN-FLW-03 — descartar o único rascunho deixaria o Flow sem Versão. */
export function descartarRascunho(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  const rascunho = versaoCorrente(flow);
  if (!rascunho) return fail("O Flow não tem rascunho.");
  if (flow.versoes.length === 1) return fail("Este é a única Versão do Flow: descartá-la o deixaria vazio (RN-FLW-03).");
  flow.versoes = flow.versoes.filter((v) => v.id !== rascunho.id);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Rascunho descartado", before: `v${rascunho.numero}` });
  return ok(flow, flow.id);
}

/** RN-FLW-05 — corrigir ou reverter é criar rascunho a partir de qualquer Versão (Proveniência) e publicar. */
export function criarRascunhoAPartirDe(state: DataState, actingMemberId: Id, flowId: Id, versaoId: Id): OperationResult<VersaoDeFlow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle !== "ativo") return fail("Restaure o Flow antes.");
  if (versaoCorrente(flow)) return fail("O Flow já tem um rascunho: descarte-o antes de abrir outro (RN-FLW-02).");
  const origem = flow.versoes.find((v) => v.id === versaoId);
  if (!origem) return fail("Versão não encontrada.");
  const numero = Math.max(...flow.versoes.map((v) => v.numero)) + 1;
  const rascunho = novaVersao(flow, numero, origem.telas.map(copiarTela), origem);
  flow.versoes.push(rascunho);
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Rascunho criado a partir de Versão", after: `v${numero}`, detail: `a partir da v${origem.numero} (${origem.estado})` });
  return ok(rascunho);
}

/** 23, 12.1 — por cópia de outro Flow, com Proveniência; nasce com um rascunho copiado da Versão corrente ou publicada. */
export function copiarFlow(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const origem = flowPorId(state, flowId);
  if (!origem) return fail("Flow não encontrado.");
  const base = versaoCorrente(origem) ?? versaoPublicada(origem) ?? origem.versoes[0];
  if (!base) return fail("O Flow de origem não tem Versão.");
  const momento = now();
  const ator = memberActor(actingMemberId);
  const copia: Flow = {
    id: nextId("flw"),
    workspaceId: state.workspace.id,
    createdBy: ator,
    createdAt: momento,
    lifecycle: "ativo",
    nome: `${origem.nome} (cópia)`.slice(0, 100),
    tipoDeCanal: origem.tipoDeCanal,
    ...(origem.canalId !== undefined ? { canalId: origem.canalId } : {}),
    sincronizacao: { estado: "nuncaConferido", papelDoCanal: origem.canalId !== undefined ? "administrador" : "ausente", detalhe: "Ainda não publicado." },
    origemDeCriacao: "criadoPelaPlataforma",
    tagIds: [...origem.tagIds],
    fieldValues: [],
    comments: [],
    provenance: { kind: "copy", sourceId: origem.id, sourceName: origem.nome, at: momento },
    descricao: origem.descricao,
    categoria: origem.categoria,
    versoes: [],
    ...(origem.pontoDeTrocaDeDados ? { pontoDeTrocaDeDados: { endereco: origem.pontoDeTrocaDeDados.endereco, chavePublica: gerarChavePublica(), chavesGeradasEm: momento } } : {}),
  };
  copia.versoes.push(novaVersao(copia, 1, base.telas.map(copiarTela)));
  state.flows.push(copia);
  registrarNoFlow(state, copia, { actor: ator, action: "Flow copiado", detail: `de “${origem.nome}” (v${base.numero})` });
  return ok(copia, copia.id);
}

// ── Ciclo de vida (RN-FLW-13) ──────────────────────────────────────────────

export function arquivarFlow(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle !== "ativo") return fail("Só um Flow ativo é arquivado.");
  flow.lifecycle = "arquivado";
  flow.archivedAt = now();
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Flow arquivado", detail: versaoPublicada(flow) ? "Não enviável; a publicada continua no provedor até você despublicar (12.5)." : "Não enviável; rascunho preservado." });
  return ok(flow, flow.id);
}

export function restaurarFlow(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle !== "arquivado") return fail("Só um Flow arquivado é restaurado por aqui.");
  flow.lifecycle = "ativo";
  delete flow.archivedAt;
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Flow restaurado" });
  return ok(flow, flow.id);
}

export function enviarFlowALixeira(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle === "naLixeira") return ok(flow);
  flow.lifecycleBeforeTrash = flow.lifecycle;
  flow.lifecycle = "naLixeira";
  flow.trashedAt = now();
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Flow enviado à lixeira", detail: "As Mensagens mantêm o valor; o objeto no provedor não é tocado (INV-ATV-05)." });
  return ok(flow);
}

export function restaurarFlowDaLixeira(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  if (flow.lifecycle !== "naLixeira") return fail("O Flow não está na lixeira.");
  flow.lifecycle = flow.lifecycleBeforeTrash ?? "ativo";
  delete flow.lifecycleBeforeTrash;
  delete flow.trashedAt;
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Flow restaurado da lixeira", after: flow.lifecycle });
  return ok(flow, flow.id);
}

/** Sincronizar: confere o estado no provedor (simulado: confirma o que está gravado). */
export function sincronizarFlow(state: DataState, actingMemberId: Id, flowId: Id): OperationResult<Flow> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, flowId);
  if (!flow) return fail("Flow não encontrado.");
  const momento = now();
  const antes = flow.sincronizacao.estado;
  const canal = flow.canalId ? state.channels.find((c) => c.id === flow.canalId) : undefined;
  if (!flow.identificadorExterno) {
    flow.sincronizacao = { estado: "nuncaConferido", conferidoEm: momento, papelDoCanal: canal ? "administrador" : "ausente", detalhe: "Ainda não publicado: nada a conferir no provedor." };
  } else if (!canal || canal.lifecycle !== "ativo") {
    flow.sincronizacao = { estado: "orfao", conferidoEm: momento, papelDoCanal: "ausente", detalhe: "O Canal publicador foi arquivado (20.3)." };
    const publicada = versaoPublicada(flow);
    if (publicada) {
      publicada.estado = "obsoleta";
      publicada.obsoletaEm = momento;
      registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Versão tornada obsoleta", before: `v${publicada.numero} publicada`, after: `v${publicada.numero} obsoleta`, detail: "Canal publicador arquivado (RN-FLW-09, 20.3)." });
    }
  } else {
    const recusa = recusaDoCanal(state, canal.id, "formulariosInterativos");
    if (recusa) return fail(recusa);
    flow.sincronizacao = { estado: "sincronizado", conferidoEm: momento, papelDoCanal: "administrador" };
  }
  registrarNoFlow(state, flow, { actor: memberActor(actingMemberId), action: "Flow sincronizado", before: antes, after: flow.sincronizacao.estado, ...(flow.estadoNoProvedor ? { detail: `Estado no provedor: ${flow.estadoNoProvedor}` } : {}) });
  return ok(flow, flow.id);
}

// ── Envio e resposta (7.6) ─────────────────────────────────────────────────

export interface EnviarFlowInput {
  readonly flowId: Id;
  readonly conversationId: Id;
  readonly corpo: string;
  readonly rotuloDoBotao?: string;
  readonly cabecalho?: string;
  readonly rodape?: string;
  readonly telaInicial?: string;
  readonly dadosIniciais?: Record<string, string>;
  readonly templateProviderId?: string;
  readonly actor?: ActorRef;
  readonly delegate?: ActorRef;
}

/**
 * RN-FLW-01 / INV-FLW-02 — só a Versão publicada é enviável; a Mensagem
 * referencia Flow e Versão por identidade. Delegado a `sendMessage`: janela
 * de resposta, modelo aprovado e consentimento valem como para qualquer
 * Mensagem (20.6). O Anexo `flow` marca a Mensagem para a Caixa de Entrada.
 */
export function enviarFlow(state: DataState, actingMemberId: Id, input: EnviarFlowInput): OperationResult<{ readonly mensagem: Message; readonly conversa: Conversation }> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const flow = flowPorId(state, input.flowId);
  if (!flow) return fail("Flow não encontrado.");
  const recusa = recusaDeEnvioDeFlow(state, flow);
  if (recusa) return fail(recusa);
  const publicada = versaoPublicada(flow);
  if (!publicada) return fail("O Flow não tem Versão publicada (RN-FLW-01).");
  const conversa = state.conversations.find((c) => c.id === input.conversationId);
  if (!conversa) return fail("Conversa não encontrada.");
  if (conversa.channelId !== flow.canalId) return fail("A Conversa é de outro Canal: o Flow só sai pelo Canal publicador.");
  if (conversa.groupIdentifier) return fail("Um Flow é enviado a um Contato, não a um Grupo (7.6).");
  const canal = state.channels.find((c) => c.id === conversa.channelId);
  if (canal && !CHANNEL_CAPABILITIES[canal.channelType].sendableMediaTypes.includes("flow")) return fail("Este Canal não envia formulários interativos.");
  const inicial = input.telaInicial ?? telaInicial(publicada)?.identificador ?? "";
  if (!publicada.telas.some((t) => t.identificador === inicial)) return fail(`A Tela inicial “${inicial}” não existe na Versão publicada.`, "telaInicial");
  if (!input.corpo.trim()) return fail("Escreva o corpo da Mensagem.", "corpo");
  // 1.2.2 — o ator já passou por `recusaDeMembroAtivo` acima (Membro ativo, não
  // Convidado): a `sendMessage` registrada confere a mesma regra e segue valendo.
  const envio = sendMessage(state, actingMemberId, {
    conversationId: conversa.id,
    content: input.corpo,
    ...(input.templateProviderId ? { templateProviderId: input.templateProviderId } : {}),
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.delegate ? { delegate: input.delegate } : {}),
  });
  if (!envio.ok) return envio;
  const flowNaMensagem: EnvioDeFlow = {
    flowId: flow.id,
    versaoId: publicada.id,
    numeroDaVersao: publicada.numero,
    flowNome: flow.nome,
    ...(input.cabecalho?.trim() ? { cabecalho: input.cabecalho.trim() } : {}),
    ...(input.rodape?.trim() ? { rodape: input.rodape.trim() } : {}),
    rotuloDoBotao: input.rotuloDoBotao?.trim() || "Abrir",
    telaInicial: inicial,
    ...(input.dadosIniciais && Object.keys(input.dadosIniciais).length > 0 ? { dadosIniciais: { ...input.dadosIniciais } } : {}),
  };
  const anexo: Attachment = { fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome };
  // A Mensagem tem `attachments` readonly: nasce de novo, com o Flow e o Anexo, no lugar da que `sendMessage` gravou.
  const indice = conversa.messages.findIndex((m) => m.id === envio.value.id);
  const mensagem: Message = { ...envio.value, attachments: [anexo], flow: flowNaMensagem };
  if (indice >= 0) conversa.messages[indice] = mensagem;
  registrarNoFlow(state, flow, { actor: input.actor ?? memberActor(actingMemberId), ...(input.delegate ? { delegate: input.delegate } : {}), action: "Flow enviado", detail: `v${publicada.numero} · ${conversa.title}` });
  return ok({ mensagem, conversa });
}

export interface ReceberRespostaInput {
  readonly flowId: Id;
  readonly contactId: Id;
  readonly valores: Record<string, string | number | boolean | readonly string[]>;
  readonly telaDeConclusao?: string;
  readonly mensagemDeOrigemId?: Id;
  /** Ausente = a publicada; uma obsoleta é aceita (20.1). */
  readonly versaoId?: Id;
  readonly resumo?: string;
}

/**
 * DO-FLW-02 / 7.6 — Evento do provedor: a Resposta chega como Mensagem
 * `recebida`, resolvida ao Contato por Identificador (B13), na Conversa 1:1.
 * Um Nome fora da Versão não descarta nada: marca `naoConforme` (20.5).
 * O Contato não muda por si (RN-FLW-14): isso é Automação.
 */
export function receberRespostaDeFlow(state: DataState, input: ReceberRespostaInput): OperationResult<{ readonly mensagem: Message; readonly conversa: Conversation }> {
  const flow = flowPorId(state, input.flowId);
  if (!flow) return fail("Flow não encontrado.");
  const versao = input.versaoId ? flow.versoes.find((v) => v.id === input.versaoId) : versaoPublicada(flow);
  if (!versao) return fail("Versão não encontrada.");
  if (versao.estado === "rascunho") return fail("Um rascunho nunca chegou ao aparelho de ninguém: não há Resposta para ele.");
  if (!flow.canalId) return fail("O Flow está sem Canal: a Resposta não tem por onde entrar (20.3).");
  const contato = state.contacts.find((c) => c.id === input.contactId);
  if (!contato) return fail("Contato não encontrado.");
  const nomes = new Set(camposDeFlow(versao).map((c) => c.nome));
  const naoConforme = Object.keys(input.valores).some((n) => !nomes.has(n));
  const telas = telasOrdenadas(versao);
  const telaDeConclusao = input.telaDeConclusao ?? telas.filter((t) => t.terminal).at(-1)?.identificador ?? telas.at(-1)?.identificador ?? "";
  const resumo = input.resumo ?? `Resposta ao Flow “${flow.nome}”: ${Object.entries(input.valores).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}`;
  const recebida = receiveMessage(state, flow.canalId, contato.id, resumo);
  if (!recebida.ok) return recebida;
  const conversa = recebida.value;
  const indice = conversa.messages.length - 1;
  const original = conversa.messages[indice];
  if (!original) return fail("A Mensagem recebida não foi gravada.");
  const resposta: RespostaDeFlow = {
    flowId: flow.id,
    versaoId: versao.id,
    numeroDaVersao: versao.numero,
    flowNome: flow.nome,
    identificadorDeRespostaDoProvedor: gerarIdentificadorDeResposta(),
    em: original.createdAt,
    valores: { ...input.valores },
    telaDeConclusao,
    ...(input.mensagemDeOrigemId ? { mensagemDeOrigemId: input.mensagemDeOrigemId } : {}),
    ...(naoConforme ? { naoConforme: true } : {}),
  };
  const mensagem: Message = { ...original, attachments: [{ fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome }], respostaDeFlow: resposta };
  conversa.messages[indice] = mensagem;
  registrarNoFlow(state, flow, { actor: systemActor, action: "Resposta de Flow recebida", ...(naoConforme ? { result: "failed" as const } : {}), detail: `v${versao.numero}${versao.estado === "obsoleta" ? " (obsoleta — 20.1)" : ""} · ${contactDisplayName(contato)}${naoConforme ? " · não conforme: Nome fora da Versão (20.5)" : ""}` });
  emitirEventoDeFerramentas(state, { kind: "respostaDeFlowRecebida", flowId: flow.id, contactId: contato.id, conversationId: conversa.id, messageId: mensagem.id });
  return ok({ mensagem, conversa });
}
