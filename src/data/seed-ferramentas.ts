/**
 * Ferramentas do CRM no seed: os Ativos de Canal (docs 23–25) que o produto
 * mostra de saída — uma Comunidade de alunos com três Turmas e o Grupo de
 * avisos, um Grupo importado em que o Canal é só participante, um Link de
 * Captação com cliques, e um Flow de triagem publicado (com um rascunho
 * novo já aberto, como DO-FLW-03 manda). Tudo no Canal de WhatsApp
 * "Comercial SP" (`chn_wpp`), que passa a ter Grupos habilitados.
 *
 * Só ids que sobrevivem à poda do seed do produto (`cnt_*`, `mem_*`,
 * `chn_wpp`, `cnv_5/9/13/17`); nada aqui toca `cnv_1`.
 */

import type { DataState } from "./state";
import type { ActorRef, Comunidade, Contact, Conversation, Flow, Grupo, Id, LinkDeCaptacao, Message, ParticipacaoDeGrupo, TelaDeFlow } from "./types";
import { contactDisplayName } from "./derive";
import { nextId, recordActivity } from "./operations/activity";
import { definicaoPublicavel } from "./operations/ferramentas/flows-validacao";
import { reconciliarGrupoDeAvisos } from "./operations/ferramentas/participacoes";

interface Clock {
  readonly at: (daysAgo: number, hour?: number) => string;
  readonly workspaceId: Id;
}

const member = (id: Id): ActorRef => ({ kind: "member", id });
const SYSTEM: ActorRef = { kind: "system", id: "sistema" };
const CANAL = "chn_wpp";
export const COMUNIDADE_ALUNOS_ID = "com_alunos_ff";
export const FLOW_TRIAGEM_ID = "flw_triagem";
export const LINK_LANCAMENTO_ID = "lcp_lanc_set";

export function applyFerramentas(state: DataState, clock: Clock): void {
  const { at, workspaceId } = clock;
  const canal = state.channels.find((c) => c.id === CANAL);
  if (!canal) return;
  canal.groupsEnabled = true;

  const contato = (n: number): Contact | undefined => state.contacts.find((c) => c.id === `cnt_${n}`);
  const numero = (c: Contact): string => c.identifiers.find((i) => i.type === "identidadeDeWhatsApp")?.value ?? "";

  // Uma Tag para a Automação de boas-vindas gravar — Tags nunca nascem de regra fixa (RN-FLW-14).
  state.tags.push({ id: "tag_aluno_grupo", workspaceId, name: "Em grupo de alunos", color: "#22c55e", appliesTo: ["contact"], lifecycle: "ativo" });

  const base = (id: Id, nome: string, criadoEm: string, origem: Grupo["origemDeCriacao"]) => ({
    id,
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: criadoEm,
    lifecycle: "ativo" as const,
    nome,
    tipoDeCanal: "whatsapp" as const,
    canalId: CANAL,
    origemDeCriacao: origem,
    tagIds: [] as Id[],
    fieldValues: [],
    comments: [],
  });

  const participacao = (grupo: Grupo, c: Contact | undefined, entradaEm: string, extras: Partial<ParticipacaoDeGrupo> = {}): ParticipacaoDeGrupo | undefined => {
    if (!c) return undefined;
    const origem = extras.origem ?? "adicionado";
    const p: ParticipacaoDeGrupo = {
      id: nextId("prg"),
      grupoId: grupo.id,
      contactId: c.id,
      identificadorExternoDoParticipante: numero(c),
      entradaEm,
      entradaEstimada: false,
      papel: "membro",
      origem,
      // Só quem foi adicionado pela plataforma tem "por quem" (24, 7.1).
      ...(origem === "adicionado" ? { adicionadoPor: member("mem_julia") } : {}),
      ...extras,
    };
    grupo.participacoes.push(p);
    return p;
  };
  const oCanal = (grupo: Grupo, entradaEm: string, papel: ParticipacaoDeGrupo["papel"] = "administrador") => {
    grupo.participacoes.push({ id: nextId("prg"), grupoId: grupo.id, canalParticipanteId: CANAL, identificadorExternoDoParticipante: canal.externalId, entradaEm, entradaEstimada: false, papel, origem: "adicionado" });
  };

  // ── Comunidade + Grupo de avisos ───────────────────────────────────────
  const comunidade: Comunidade = {
    ...base(COMUNIDADE_ALUNOS_ID, "Alunos Full Face", at(120), "criadoPelaPlataforma"),
    identificadorExterno: "120363300000000001@g.us",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Comunidade dos alunos do programa Full Face: uma Turma por entrada, avisos gerais no Grupo de avisos.",
    configuracoes: { somenteAdministradoresAdicionamGrupos: true, somenteAdministradoresAdicionamParticipantes: false },
    limiteDeGruposDoProvedor: 100,
  };
  state.comunidades.push(comunidade);

  const avisos: Grupo = {
    ...base("grp_avisos_ff", "Alunos Full Face · Avisos", at(120), "criadoPelaPlataforma"),
    identificadorExterno: "120363300000000002@g.us",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Grupo de avisos da Comunidade: todos leem, só administradores publicam.",
    configuracoes: { somenteAdministradoresEnviam: true, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: false, somenteAdministradoresAdicionamParticipantes: true },
    capacidade: 1024,
    participacoes: [],
    pedidosDeEntrada: [],
    comunidadeId: comunidade.id,
    papelNaComunidade: "avisos",
    vinculadoAComunidadeEm: at(120),
    captacao: { estado: "inativa" },
  };
  oCanal(avisos, at(120));
  state.grupos.push(avisos);

  // ── Turma #01: cheia pelo Teto de captação (8), com uma saída na história ──
  const turma1: Grupo = {
    ...base("grp_turma_01", "Turma Full Face #01", at(118), "criadoPelaPlataforma"),
    identificadorExterno: "120363300000000011@g.us",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Primeira turma do lançamento. Dúvidas clínicas e agenda das aulas ao vivo.",
    configuracoes: { somenteAdministradoresEnviam: false, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: false, somenteAdministradoresAdicionamParticipantes: true },
    linkDeConvite: { endereco: "https://chat.whatsapp.com/TurmaFF01Kx9Q", estado: "valido", validadoEm: at(0, 8) },
    capacidade: 1024,
    participacoes: [],
    pedidosDeEntrada: [],
    comunidadeId: comunidade.id,
    papelNaComunidade: "comum",
    vinculadoAComunidadeEm: at(118),
    captacao: { estado: "ativa", tetoDeCaptacao: 8 },
  };
  oCanal(turma1, at(118));
  // Sete Contatos + o Canal = 8 vigentes: o Teto de captação (8) diz que está cheia.
  for (let n = 1; n <= 7; n += 1) participacao(turma1, contato(n), at(110 - n), n <= 5 ? { origem: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID, origemInferida: true } : {});
  participacao(turma1, contato(9), at(100), { origem: "linkDeConvite", saidaEm: at(60, 14), causaDaSaida: "saiu" });
  const admin1 = turma1.participacoes.find((p) => p.contactId === "cnt_1");
  if (admin1) admin1.papel = "administrador";
  state.grupos.push(turma1);

  // ── Turma #02: alguém saiu e voltou no mesmo dia (20.2); Limite de cliques ──
  const turma2: Grupo = {
    ...base("grp_turma_02", "Turma Full Face #02", at(75), "criadoPelaPlataforma"),
    identificadorExterno: "120363300000000012@g.us",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Segunda turma. Entrada pelo Link de Captação do lançamento.",
    configuracoes: { somenteAdministradoresEnviam: false, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: false, somenteAdministradoresAdicionamParticipantes: false },
    linkDeConvite: { endereco: "https://chat.whatsapp.com/TurmaFF02Ab7R", estado: "valido", validadoEm: at(0, 8) },
    capacidade: 1024,
    participacoes: [],
    pedidosDeEntrada: [],
    comunidadeId: comunidade.id,
    papelNaComunidade: "comum",
    vinculadoAComunidadeEm: at(75),
    captacao: { estado: "ativa", limiteDeCliques: 100 },
  };
  oCanal(turma2, at(75));
  for (let n = 10; n <= 15; n += 1) {
    if (n === 12) continue;
    participacao(turma2, contato(n), at(70 - (n - 10) * 3), { origem: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID });
  }
  participacao(turma2, contato(12), at(64), { origem: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID, saidaEm: at(30, 10), causaDaSaida: "removido", removidoPor: member("mem_julia") });
  participacao(turma2, contato(12), at(30, 16), { origem: "adicionado" });
  state.grupos.push(turma2);

  // ── Turma #03: administradores aprovam a entrada; Pedidos pendentes ─────
  const turma3: Grupo = {
    ...base("grp_turma_03", "Turma Full Face #03", at(30), "criadoPelaPlataforma"),
    identificadorExterno: "120363300000000013@g.us",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Terceira turma, em formação. A entrada passa por aprovação.",
    configuracoes: { somenteAdministradoresEnviam: false, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: true, somenteAdministradoresAdicionamParticipantes: true },
    linkDeConvite: { endereco: "https://chat.whatsapp.com/TurmaFF03Zc2M", estado: "valido", validadoEm: at(0, 8) },
    capacidade: 1024,
    participacoes: [],
    pedidosDeEntrada: [],
    comunidadeId: comunidade.id,
    papelNaComunidade: "comum",
    vinculadoAComunidadeEm: at(30),
    captacao: { estado: "ativa" },
  };
  oCanal(turma3, at(30));
  for (let n = 16; n <= 18; n += 1) participacao(turma3, contato(n), at(25 - (n - 16) * 4), { origem: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID });
  const c19 = contato(19);
  if (c19) {
    turma3.pedidosDeEntrada.push({ id: "ped_3", grupoId: turma3.id, contactId: c19.id, identificadorExternoDoSolicitante: numero(c19), solicitadoEm: at(10, 9), estado: "aprovado", decididoPor: member("mem_julia"), decididoEm: at(10, 11), origemInformada: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID });
    participacao(turma3, c19, at(10, 11), { origem: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID });
  }
  for (const [id, n, dias] of [["ped_1", 29, 2], ["ped_2", 30, 1]] as const) {
    const c = contato(n);
    if (!c) continue;
    turma3.pedidosDeEntrada.push({ id, grupoId: turma3.id, contactId: c.id, identificadorExternoDoSolicitante: numero(c), solicitadoEm: at(dias, 15), estado: "pendente", origemInformada: "linkDeCaptacao", linkDeCaptacaoId: LINK_LANCAMENTO_ID });
  }
  state.grupos.push(turma3);

  // ── Grupo importado em que o Canal é só participante (20.5) ────────────
  const parceiros: Grupo = {
    ...base("grp_parceiros", "Parceiros Harmonização SP", at(40), "importado"),
    identificadorExterno: "120363300000000021@g.us",
    sincronizacao: { estado: "semPrivilegio", conferidoEm: at(0, 8), papelDoCanal: "participante", detalhe: "O Canal é participante: só sincronizar e sair." },
    descricao: "Grupo de clínicas parceiras; administrado por terceiros.",
    configuracoes: { somenteAdministradoresEnviam: false, somenteAdministradoresEditamDados: true, administradoresAprovamEntrada: false, somenteAdministradoresAdicionamParticipantes: false },
    capacidade: 1024,
    participacoes: [],
    pedidosDeEntrada: [],
    captacao: { estado: "inativa" },
  };
  oCanal(parceiros, at(40), "membro");
  const canalNosParceiros = parceiros.participacoes[0];
  if (canalNosParceiros) Object.assign(canalNosParceiros, { origem: "importado", entradaEstimada: true });
  for (let n = 25; n <= 28; n += 1) participacao(parceiros, contato(n), at(40), { origem: "importado", entradaEstimada: true, papel: n === 25 ? "administrador" : "membro" });
  state.grupos.push(parceiros);

  // ── Link de Captação do lançamento ─────────────────────────────────────
  const link: LinkDeCaptacao = {
    id: LINK_LANCAMENTO_ID,
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: at(112),
    lifecycle: "ativo",
    nome: "Lançamento setembro",
    slug: "lancamento-setembro",
    tipoDeCanal: "whatsapp",
    gruposElegiveisIds: [turma1.id, turma2.id, turma3.id],
    criterio: "porOrdem",
    ativo: true,
    cliques: [
      ...[105, 104, 103, 102, 101].map((d) => ({ id: nextId("clk"), em: at(d, 10), grupoId: turma1.id })),
      ...[70, 67, 64, 61, 58].map((d) => ({ id: nextId("clk"), em: at(d, 11), grupoId: turma2.id })),
      ...[25, 21].map((d) => ({ id: nextId("clk"), em: at(d, 12), grupoId: turma3.id })),
    ],
    tagIds: [],
    comments: [],
  };
  state.linksDeCaptacao.push(link);

  // ── Flow "Triagem de interesse": v1 publicada, v2 rascunho ─────────────
  const flow: Flow = {
    ...base(FLOW_TRIAGEM_ID, "Triagem de interesse", at(45), "criadoPelaPlataforma"),
    createdBy: member("mem_thiago"),
    identificadorExterno: "1088734512907731",
    sincronizacao: { estado: "sincronizado", conferidoEm: at(0, 8), papelDoCanal: "administrador" },
    descricao: "Perfil profissional e cidade antes da primeira conversa; pré-preenche a qualificação.",
    categoria: "formularioDeCadastro",
    versoes: [],
    estadoNoProvedor: "publicado",
  };
  const telasV1 = (): TelaDeFlow[] => [
    {
      id: nextId("tel"),
      identificador: "perfil",
      titulo: "Seu perfil",
      ordem: 0,
      terminal: false,
      dados: [],
      componentes: [
        { id: nextId("cmp"), tipo: "titulo", propriedades: { texto: "Conte um pouco sobre você" } },
        { id: nextId("cmp"), tipo: "paragrafo", propriedades: { texto: "Duas perguntas rápidas para a nossa conversa começar no ponto certo." } },
        {
          id: nextId("cmp"),
          tipo: "escolhaUnica",
          nome: "formacao",
          propriedades: {
            rotulo: "Sua formação",
            obrigatorio: true,
            opcoes: [
              { id: "dentista", titulo: "Cirurgião-dentista" },
              { id: "biomedico", titulo: "Biomédico(a)" },
              { id: "medico", titulo: "Médico(a)" },
              { id: "outro", titulo: "Outra área da saúde" },
            ],
          },
        },
        { id: nextId("cmp"), tipo: "campoDeTexto", nome: "cidade", propriedades: { rotulo: "Cidade", tipoDeEntrada: "texto", obrigatorio: true, textoDeAjuda: "Onde você atende hoje" } },
        { id: nextId("cmp"), tipo: "rodape", propriedades: { rotulo: "Continuar" }, acao: { tipo: "navegar", telaDeDestino: "confirmacao", cargaUtil: { formacao: "{formulario.formacao}", cidade: "{formulario.cidade}" } } },
      ],
    },
    {
      id: nextId("tel"),
      identificador: "confirmacao",
      titulo: "Confirmação",
      ordem: 1,
      terminal: true,
      dados: [
        { nome: "formacao", tipo: "texto", exemplo: "dentista" },
        { nome: "cidade", tipo: "texto", exemplo: "São Paulo" },
      ],
      componentes: [
        { id: nextId("cmp"), tipo: "titulo", propriedades: { texto: "Quase lá" } },
        { id: nextId("cmp"), tipo: "paragrafo", propriedades: { texto: "Você atende em {dados.cidade}. Podemos falar sobre o programa por aqui?" } },
        { id: nextId("cmp"), tipo: "consentimento", nome: "aceite", propriedades: { texto: "Aceito receber mensagens sobre o programa Full Face.", obrigatorio: true } },
        { id: nextId("cmp"), tipo: "rodape", propriedades: { rotulo: "Concluir" }, acao: { tipo: "concluir", cargaUtil: { formacao: "{dados.formacao}", cidade: "{dados.cidade}", aceite: "{formulario.aceite}" } } },
      ],
    },
  ];
  const v1: Flow["versoes"][number] = {
    id: "vfl_triagem_1",
    flowId: flow.id,
    numero: 1,
    estado: "publicada",
    versaoDeEsquema: "7.3",
    telas: telasV1(),
    notas: "Primeira versão: formação e cidade.",
    publicadaPor: member("mem_thiago"),
    publicadaEm: at(40, 10),
    canalPublicadorId: CANAL,
    createdAt: at(45),
  };
  v1.instantaneoPublicado = definicaoPublicavel(flow, v1);
  const v2: Flow["versoes"][number] = {
    id: "vfl_triagem_2",
    flowId: flow.id,
    numero: 2,
    estado: "rascunho",
    versaoDeEsquema: "7.3",
    telas: telasV1(),
    proveniencia: { versaoId: v1.id, numero: 1 },
    createdAt: at(40, 10),
  };
  // O rascunho já pergunta também o WhatsApp da clínica — ainda sem publicar.
  const perfilV2 = v2.telas[0];
  if (perfilV2) {
    const rodape = perfilV2.componentes.findIndex((c) => c.tipo === "rodape");
    perfilV2.componentes.splice(rodape, 0, { id: nextId("cmp"), tipo: "campoDeTexto", nome: "whatsapp_clinica", propriedades: { rotulo: "WhatsApp da clínica", tipoDeEntrada: "telefone", obrigatorio: false } });
  }
  flow.versoes.push(v1, v2);
  state.flows.push(flow);

  // ── Envios e Respostas do Flow nas Conversas do WhatsApp ───────────────
  const envio = (conversa: Conversation, quando: string, respondeu: { formacao: string; cidade: string } | undefined, quandoRespondeu: string) => {
    const enviada: Message = {
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "enviada",
      actor: member("mem_julia"),
      content: "Antes de falarmos, me conta em 30 segundos sobre você? É só tocar em Abrir.",
      attachments: [{ fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome }],
      deliveryStatus: "lida",
      internalReads: [],
      reactions: [],
      externalEdits: [],
      createdAt: quando,
      flow: { flowId: flow.id, versaoId: v1.id, numeroDaVersao: 1, flowNome: flow.nome, rotuloDoBotao: "Abrir", telaInicial: "perfil" },
    };
    conversa.messages.push(enviada);
    if (!respondeu) return;
    const c = state.contacts.find((x) => x.id === conversa.contactId);
    const via = c?.identifiers.find((i) => i.type === "identidadeDeWhatsApp");
    conversa.messages.push({
      id: nextId("msg"),
      conversationId: conversa.id,
      direction: "recebida",
      actor: { kind: "integration", id: CANAL },
      ...(via ? { viaIdentifierId: via.id } : {}),
      content: `Resposta ao Flow “${flow.nome}”: formacao: ${respondeu.formacao} · cidade: ${respondeu.cidade} · aceite: true`,
      attachments: [{ fileId: flow.id, order: 0, mediaType: "flow", displayName: flow.nome }],
      externalId: nextId("ext"),
      internalReads: [],
      reactions: [],
      externalEdits: [],
      createdAt: quandoRespondeu,
      respostaDeFlow: { flowId: flow.id, versaoId: v1.id, numeroDaVersao: 1, flowNome: flow.nome, identificadorDeRespostaDoProvedor: nextId("resp"), em: quandoRespondeu, valores: { ...respondeu, aceite: true }, telaDeConclusao: "confirmacao", mensagemDeOrigemId: enviada.id },
    });
  };
  const conversa = (id: Id) => state.conversations.find((c) => c.id === id && c.channelId === CANAL);
  const cnv5 = conversa("cnv_5");
  const cnv9 = conversa("cnv_9");
  const cnv13 = conversa("cnv_13");
  const cnv17 = conversa("cnv_17");
  if (cnv5) envio(cnv5, at(20, 10), { formacao: "dentista", cidade: "Campinas" }, at(20, 11));
  if (cnv9) envio(cnv9, at(14, 15), { formacao: "biomedico", cidade: "Santo André" }, at(13, 9));
  if (cnv13) envio(cnv13, at(6, 9), { formacao: "medico", cidade: "São Paulo" }, at(6, 10));
  if (cnv17) envio(cnv17, at(1, 16), undefined, "");

  // ── Conversas de grupo (INV-GRP-05) ─────────────────────────────────────
  const conversaDeGrupo = (id: Id, grupo: Grupo, criadaEm: string): Conversation => {
    const c: Conversation = {
      id,
      workspaceId,
      createdBy: member("mem_julia"),
      createdAt: criadaEm,
      lifecycle: "ativo",
      channelId: CANAL,
      state: "aberta",
      queueId: "fila_com",
      title: grupo.nome,
      titleEdited: false,
      drafts: [],
      starredBy: [],
      tagIds: [],
      fieldValues: [],
      groupIdentifier: { externalId: grupo.identificadorExterno ?? "", name: grupo.nome },
      participants: [],
      messages: [],
      reopenCount: 0,
    };
    state.conversations.push(c);
    return c;
  };
  const enviadaNoGrupo = (c: Conversation, texto: string, quando: string): void => {
    c.messages.push({ id: nextId("msg"), conversationId: c.id, direction: "enviada", actor: member("mem_julia"), content: texto, attachments: [], deliveryStatus: "entregue", internalReads: [], reactions: [], externalEdits: [], createdAt: quando });
  };
  const cnvAvisos = conversaDeGrupo("cnv_grp_avisos", avisos, at(118));
  enviadaNoGrupo(cnvAvisos, "Bem-vindos à Comunidade Alunos Full Face! As aulas ao vivo são às terças, 20h. Dúvidas na sua Turma.", at(118, 10));
  enviadaNoGrupo(cnvAvisos, "Lembrete: a aula desta terça é sobre rinomodelação. O material está na área do aluno.", at(2, 9));
  const cnvTurma2 = conversaDeGrupo("cnv_grp_turma_02", turma2, at(74));
  enviadaNoGrupo(cnvTurma2, "Turma #02, sejam bem-vindos! Eu sou a Júlia e acompanho vocês por aqui.", at(74, 10));
  const c10 = contato(10);
  const via10 = c10?.identifiers.find((i) => i.type === "identidadeDeWhatsApp");
  if (c10) {
    cnvTurma2.messages.push({ id: nextId("msg"), conversationId: cnvTurma2.id, direction: "recebida", actor: { kind: "integration", id: CANAL }, ...(via10 ? { viaIdentifierId: via10.id } : {}), content: "Obrigado! Já fiz a primeira aula, ficou muito claro.", attachments: [], externalId: nextId("ext"), internalReads: [], reactions: [], externalEdits: [], createdAt: at(73, 9) });
  }

  // ── Grupo de avisos = união das Turmas (RN-COM-04) ─────────────────────
  reconciliarGrupoDeAvisos(state, comunidade.id, at(0, 8));
  for (const p of avisos.participacoes) Object.assign(p, { entradaEstimada: false, entradaEm: turma1.participacoes.find((x) => x.identificadorExternoDoParticipante === p.identificadorExternoDoParticipante)?.entradaEm ?? turma2.participacoes.find((x) => x.identificadorExternoDoParticipante === p.identificadorExternoDoParticipante)?.entradaEm ?? turma3.participacoes.find((x) => x.identificadorExternoDoParticipante === p.identificadorExternoDoParticipante)?.entradaEm ?? p.entradaEm });

  // ── Automação: boas-vindas nos Grupos da Comunidade ────────────────────
  state.automations.push({
    id: "aut_boas_vindas_grupos",
    workspaceId,
    createdBy: member("mem_julia"),
    createdAt: at(100),
    lifecycle: "ativo",
    name: "Boas-vindas nos Grupos",
    description: "Quem entra em qualquer Turma da Comunidade ganha a Tag “Em grupo de alunos”.",
    scopeType: "comunidade",
    scopeId: comunidade.id,
    ownerMemberId: "mem_julia",
    reactsToAutomationEvents: false,
    versions: [
      {
        number: 1,
        state: "publicada",
        trigger: { kind: "evento", eventType: "contatoEntrouNoGrupo" },
        conditions: [],
        actions: [{ order: 0, kind: "escrita", toolId: "contato.adicionarTag", params: JSON.stringify({ tagId: "tag_aluno_grupo" }) }],
        errorPolicy: { onActionFailure: "interromper", retries: 0 },
        publishedBy: "mem_julia",
        publishedAt: at(100),
        createdAt: at(100),
      },
    ],
  });
  for (const g of [turma1, turma2, turma3]) {
    for (const p of g.participacoes) {
      const c = p.contactId ? state.contacts.find((x) => x.id === p.contactId) : undefined;
      if (c && p.saidaEm === undefined && !c.tagIds.includes("tag_aluno_grupo")) c.tagIds.push("tag_aluno_grupo");
    }
  }

  // ── Registros de Atividade históricos ──────────────────────────────────
  const registro = (objectType: string, obj: { id: Id; nome: string }, action: string, quando: string, actor: ActorRef = member("mem_julia"), detail?: string) =>
    recordActivity(state, { actor, action, objectType, objectId: obj.id, objectName: obj.nome, at: quando, ...(detail ? { detail } : {}) });
  registro("comunidade", comunidade, "Comunidade criada", at(120), member("mem_julia"), `${canal.name} · Grupo de avisos criado pelo provedor`);
  registro("grupo", turma1, "Grupo criado", at(118), member("mem_julia"), `${canal.name} · na Comunidade ${comunidade.nome}`);
  registro("grupo", turma2, "Grupo criado", at(75));
  registro("grupo", turma3, "Grupo criado", at(30));
  registro("grupo", parceiros, "Grupo importado", at(40), member("mem_rafael"), `${canal.name} · 5 participantes · Captação inativa até você ativá-la`);
  registro("linkDeCaptacao", link, "Link de Captação criado", at(112), member("mem_julia"), "/l/lancamento-setembro · 3 Grupos · por ordem");
  const c9 = contato(9);
  if (c9) registro("grupo", turma1, "Contato saiu do Grupo", at(60, 14), SYSTEM, `${contactDisplayName(c9)} · saiu`);
  const c12 = contato(12);
  if (c12) {
    registro("grupo", turma2, "Participante removido", at(30, 10), member("mem_julia"), contactDisplayName(c12));
    registro("grupo", turma2, "Participante adicionado", at(30, 16), member("mem_julia"), contactDisplayName(c12));
  }
  if (c19) registro("grupo", turma3, "Pedido de Entrada aprovado", at(10, 11), member("mem_julia"), contactDisplayName(c19));
  for (const p of turma3.pedidosDeEntrada.filter((x) => x.estado === "pendente")) {
    const c = state.contacts.find((x) => x.id === p.contactId);
    if (c) registro("grupo", turma3, "Pedido de Entrada recebido", p.solicitadoEm, SYSTEM, contactDisplayName(c));
  }
  registro("grupo", avisos, "Mensagem enviada ao Grupo", at(2, 9), member("mem_julia"), "Lembrete: a aula desta terça é sobre rinomodelação.");
  registro("comunidade", comunidade, "Mensagem enviada à Comunidade", at(2, 9), member("mem_julia"), "no Grupo de avisos · Lembrete: a aula desta terça é sobre rinomodelação.");
  registro("flow", flow, "Flow criado", at(45), member("mem_thiago"), "Versão 1 em rascunho, com a Tela inicial.");
  registro("flow", flow, "Versão publicada", at(40, 10), member("mem_thiago"), "v2 aberta em rascunho a partir da publicada (DO-FLW-03).");
  registro("flow", flow, "Componente adicionado", at(12, 17), member("mem_thiago"), "v2 · perfil · Campo de texto (whatsapp_clinica)");
  registro("flow", flow, "Flow enviado", at(1, 16), member("mem_julia"), `v1 · ${cnv17?.title ?? ""}`);
  registro("flow", flow, "Resposta de Flow recebida", at(6, 10), SYSTEM, `v1 · ${cnv13 ? (state.contacts.find((c) => c.id === cnv13.contactId)?.firstName ?? "") : ""}`);
}
