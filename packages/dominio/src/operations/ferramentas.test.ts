/**
 * Ferramentas do CRM — as regras dos documentos 24 (Grupo), 25 (Comunidade)
 * e 23 (Flow), uma por caso. Cada teste afirma o RESULTADO da operação e o
 * estado que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { semearCrmAntigo } from "../seed-crm-antigo";
import type { DataState } from "../state";
import type { Canal } from "../crm/canais";
import { PROVEDOR_PADRAO_DO_TIPO, type TipoComProvedor } from "../provedores-de-canal";
import { contactDisplayName } from "../derive";
import type { Channel, CrmDasFerramentas, Flow, Grupo, VersaoDeFlow } from "../types";
import {
  camposDeFlow,
  cliquesContabilizados,
  contatosComWhatsApp,
  conversaDoGrupo,
  identidadeDeWhatsApp,
  grupoDeAvisos,
  membrosDaComunidade,
  membrosDoGrupo,
  metricasDoFlow,
  motivoDeInelegibilidade,
  ocupacao,
  participacoesVigentes,
  proximoGrupoDoLink,
  urlDoArquivo,
  versaoCorrente,
  versaoPublicada,
} from "../derive-ferramentas";
import { COMUNIDADE_ALUNOS_ID, FLOW_TRIAGEM_ID, LINK_LANCAMENTO_ID } from "../seed-ferramentas";
import {
  adicionarComponente,
  adicionarParticipantes,
  adicionarTela,
  aprovarPedidoDeEntrada,
  arquivarComunidade,
  arquivarFlow,
  arquivarGrupo,
  ativarCaptacao,
  copiarFlow,
  criarComunidade,
  criarFlow,
  criarGrupo,
  criarLinkDeCaptacao,
  enviarLinkDeConvite,
  criarRascunhoAPartirDe,
  descartarRascunho,
  despublicarFlow,
  desvincularGrupoDaComunidade,
  editarComponente,
  editarTela,
  enviarFlow,
  enviarComunidadeALixeira,
  enviarGrupoALixeira,
  enviarMensagemAComunidade,
  enviarMensagemAoGrupo,
  importarGruposDoCanal,
  numeroExibido,
  numerosAResolver,
  padroesDoContatoCriado,
  inativarCaptacao,
  publicarVersao,
  receberPedidoDeEntrada,
  receberRespostaDeFlow,
  recusarPedidoDeEntrada,
  regenerarLinkDeConvite,
  registrarClique,
  registrarEntradaNoGrupo,
  removerParticipante,
  restaurarGrupoDaLixeira,
  sairDaComunidade,
  sairDoGrupo,
  simularEntradaPorClique,
  sincronizarComunidade,
  sincronizarFlow,
  sincronizarGrupo,
  validarVersao,
  vincularGrupoAComunidade,
  zerarCliques,
} from "./ferramentas";

let state: DataState;
beforeEach(() => {
  // Os testes de Grupo, Comunidade e Flow ainda leem o Canal, os Contatos e as Conversas do CRM antigo do estado (o
  // `crm` que o servidor monta é derivado deles, e os Envios de Flow moram nas Conversas). O seed não os cria mais
  // (15-31): `semearCrmAntigo` os devolve. DÍVIDA ABERTA (.planning/WINDOWS.md): este arquivo sobrevive ao 15-43, que
  // apaga `semearCrmAntigo`, então ele precisa montar um Canal, Contatos e Conversas próprios antes disso.
  state = semearCrmAntigo(buildSeed());
});


/** O Canal do seed, na forma do CRM novo: o que o servidor leria de `plataforma.canais`. */
function canalDoSeed(c: Channel): Canal {
  const tipo = c.channelType as TipoComProvedor;
  return {
    id: c.id,
    nome: c.name,
    tipo,
    provedor: c.provider ?? PROVEDOR_PADRAO_DO_TIPO[tipo],
    identificadorExterno: c.externalId,
    conexao: c.connection === "comErro" ? "com_erro" : c.connection,
    conexaoSimulada: false,
    conectadaEm: null,
    estado: c.lifecycle,
    arquivadoEm: null,
    configuradoPor: c.configuredByMemberId,
    filaPadraoId: c.defaultQueueId ?? null,
    proprietarioPadraoId: c.defaultContactOwnerMemberId ?? null,
    origemPadraoId: c.defaultOriginId ?? null,
    gruposHabilitados: c.groupsEnabled,
    criadoPor: c.configuredByMemberId,
    criadoEm: c.createdAt,
    atualizadoEm: c.createdAt,
  };
}

/** O CRM das Ferramentas montado do seed, no instante da chamada (os testes mexem no estado). */
function crmDoSeed(s: DataState): CrmDasFerramentas {
  return {
    canais: s.channels.map(canalDoSeed),
    contatos: s.contacts.map((c) => ({ id: c.id, nome: contactDisplayName(c), estado: c.lifecycle, whatsapp: identidadeDeWhatsApp(c) ?? null })),
  };
}

/**
 * O que o servidor geraria para os números sem Contato em `plataforma.contatos`: um id por número.
 * A operação só usa esse id, nunca o inventa (15-17, 3.4.8).
 */
function crmComContatosACriar(s: DataState, numeros: readonly string[]): CrmDasFerramentas {
  const base = crmDoSeed(s);
  const digitos = (v: string): string => v.replace(/\D/g, "");
  const sem = numeros.filter((n) => !base.contatos.some((c) => c.whatsapp !== null && digitos(c.whatsapp) === digitos(n)));
  return { ...base, contatosACriar: sem.map((n) => ({ id: `cnt_novo_${digitos(n)}`, nome: numeroExibido(n), whatsapp: n })) };
}

/** `crmDoSeed` mais os Contatos a criar para os números que `numerosAResolver` pede à operação. */
function crmDaOperacao(s: DataState, nome: string, args: readonly unknown[]): CrmDasFerramentas {
  const base = crmDoSeed(s);
  return crmComContatosACriar(s, numerosAResolver(nome, s, args, base));
}

const grupo = (id: string): Grupo => {
  const g = state.grupos.find((x) => x.id === id);
  if (!g) throw new Error(`sem ${id}`);
  return g;
};
const flow = (): Flow => {
  const f = state.flows.find((x) => x.id === FLOW_TRIAGEM_ID);
  if (!f) throw new Error("sem flow");
  return f;
};
const rascunho = (): VersaoDeFlow => {
  const v = versaoCorrente(flow());
  if (!v) throw new Error("sem rascunho");
  return v;
};
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("Grupos — Participações e Captação", () => {
  it("seed: a Turma #01 está cheia pelo Teto, o avisos espelha a união das Turmas, a Versão 1 do Flow é válida", () => {
    expect(ocupacao(grupo("grp_turma_01")).faixa).toBe("cheio");
    expect(motivoDeInelegibilidade(state, grupo("grp_turma_01"))).toMatch(/cheio/);
    const avisos = grupoDeAvisos(state, COMUNIDADE_ALUNOS_ID);
    expect(avisos?.id).toBe("grp_avisos_ff");
    const uniao = new Set(membrosDaComunidade(state, COMUNIDADE_ALUNOS_ID));
    expect(new Set(membrosDoGrupo(avisos as Grupo).map((p) => p.contactId))).toEqual(uniao);
    const publicada = versaoPublicada(flow());
    expect(publicada?.numero).toBe(1);
    expect(validarVersao(flow(), publicada as VersaoDeFlow, state.files)).toEqual([]);
  });

  it("INV-GRP-02 — no máximo uma Participação vigente por Contato: adicionar quem já está devolve `jaEstavam`", () => {
    const r = unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_10", "cnt_20"] }, crmDoSeed(state)));
    expect(r.jaEstavam).toBe(1);
    expect(r.adicionados.map((p) => p.contactId)).toEqual(["cnt_20"]);
    expect(participacoesVigentes(grupo("grp_turma_02")).filter((p) => p.contactId === "cnt_10")).toHaveLength(1);
    expect(state.activity.find((a) => a.action === "Participante adicionado" && a.objectId === "grp_turma_02")).toBeTruthy();
  });

  it("INV-GRP-07 — remover encerra a Participação com causa e ator; ela não some; a Automação de boas-vindas reage à entrada", () => {
    const antes = grupo("grp_turma_02").participacoes.length;
    const p = participacoesVigentes(grupo("grp_turma_02")).find((x) => x.contactId === "cnt_11");
    expect(p).toBeTruthy();
    expect(removerParticipante(state, "mem_julia", "grp_turma_02", p?.id ?? "", crmDoSeed(state)).ok).toBe(true);
    expect(grupo("grp_turma_02").participacoes.length).toBe(antes);
    expect(p?.saidaEm).toBeTruthy();
    expect(p?.causaDaSaida).toBe("removido");
    expect(p?.removidoPor).toEqual({ kind: "member", id: "mem_julia" });
    // e a Automação da Comunidade reage à entrada. A Tag do Contato não migrou para o CRM novo
    // (3.4.8): a Ação falha dizendo por quê, em vez de fingir que gravou.
    unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }, crmDoSeed(state)));
    const execucao = state.automationExecutions.find((e) => e.automationId === "aut_boas_vindas_grupos");
    expect(execucao?.state).toBe("falhou");
    expect(execucao?.terminationReason).toMatch(/Contato do CRM novo/);
  });

  it("RN-GRP-05 — Grupo em que o Canal é participante recusa administrar, mas aceita sincronizar", () => {
    const r = adicionarParticipantes(state, "mem_julia", "grp_parceiros", { contactIds: ["cnt_20"] }, crmDoSeed(state));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/participante/);
    expect(regenerarLinkDeConvite(state, "mem_julia", "grp_parceiros", crmDoSeed(state)).ok).toBe(false);
    expect(sincronizarGrupo(state, "mem_julia", "grp_parceiros", crmDoSeed(state)).ok).toBe(true);
    expect(grupo("grp_parceiros").sincronizacao.estado).toBe("semPrivilegio");
  });

  it("RN-GRP-06 — regenerar o Link de convite não toca os Links de Captação", () => {
    const antes = grupo("grp_turma_02").linkDeConvite?.endereco;
    unwrap(regenerarLinkDeConvite(state, "mem_julia", "grp_turma_02", crmDoSeed(state)));
    expect(grupo("grp_turma_02").linkDeConvite?.endereco).not.toBe(antes);
    const link = state.linksDeCaptacao.find((l) => l.id === LINK_LANCAMENTO_ID);
    expect(link?.gruposElegiveisIds).toContain("grp_turma_02");
  });

  it("RN-GRP-07 — inativa, arquivado, cheio e link inválido não recebem cliques; por ordem, o Clique vai ao primeiro elegível", () => {
    const link = state.linksDeCaptacao.find((l) => l.id === LINK_LANCAMENTO_ID);
    if (!link) throw new Error("sem link");
    // #01 está cheia ⇒ o próximo é a #02
    expect(proximoGrupoDoLink(state, link)?.id).toBe("grp_turma_02");
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_02"));
    expect(proximoGrupoDoLink(state, link)?.id).toBe("grp_turma_03");
    const t3 = grupo("grp_turma_03");
    t3.linkDeConvite = { endereco: "x", estado: "invalido" };
    expect(proximoGrupoDoLink(state, link)).toBeUndefined();
    const r = unwrap(registrarClique(state, "lancamento-setembro"));
    expect(r.clique.semDestino).toBe(true);
    expect(r.grupo).toBeUndefined();
    t3.linkDeConvite = { endereco: "x", estado: "valido" };
    unwrap(arquivarGrupo(state, "mem_julia", "grp_turma_03"));
    expect(motivoDeInelegibilidade(state, t3)).toMatch(/não está ativo/);
  });

  it("critério por cliques — o Clique vai ao elegível com menos cliques deste Link", () => {
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_01"));
    const link = unwrap(criarLinkDeCaptacao(state, "mem_julia", { nome: "Teste", gruposElegiveisIds: ["grp_turma_02", "grp_turma_03"], criterio: "porCliques" }));
    const a = unwrap(registrarClique(state, link.slug));
    const b = unwrap(registrarClique(state, link.slug));
    expect(new Set([a.grupo?.id, b.grupo?.id])).toEqual(new Set(["grp_turma_02", "grp_turma_03"]));
  });

  it("RN-GRP-08 — zerar cliques não apaga os Cliques do Link, só deixa de contá-los", () => {
    const t2 = grupo("grp_turma_02");
    expect(cliquesContabilizados(state, t2)).toBe(5);
    unwrap(zerarCliques(state, "mem_julia", t2.id));
    expect(cliquesContabilizados(state, t2)).toBe(0);
    expect(state.linksDeCaptacao.find((l) => l.id === LINK_LANCAMENTO_ID)?.cliques.filter((c) => c.grupoId === t2.id)).toHaveLength(5);
    unwrap(registrarClique(state, "lancamento-setembro"));
    expect(cliquesContabilizados(state, t2)).toBe(1);
  });

  it("RN-GRP-17 / INV-GRP-06 — o Grupo de avisos não admite Captação ativa nem ser elegível de Link", () => {
    const r = ativarCaptacao(state, "mem_julia", "grp_avisos_ff");
    expect(r.ok).toBe(false);
    const l = criarLinkDeCaptacao(state, "mem_julia", { nome: "Avisos", gruposElegiveisIds: ["grp_avisos_ff"] });
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.error).toMatch(/avisos/);
  });

  it("RN-ATV-08 (20.12) — restaurado da lixeira fica `nuncaConferido`: Ferramenta externa recusada até sincronizar", () => {
    unwrap(enviarGrupoALixeira(state, "mem_julia", "grp_turma_02"));
    unwrap(restaurarGrupoDaLixeira(state, "mem_julia", "grp_turma_02"));
    expect(grupo("grp_turma_02").sincronizacao.estado).toBe("nuncaConferido");
    const r = adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }, crmDoSeed(state));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Sincronize/);
    unwrap(sincronizarGrupo(state, "mem_julia", "grp_turma_02", crmDoSeed(state)));
    expect(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }, crmDoSeed(state)).ok).toBe(true);
  });

  it("Pedidos de Entrada — aprovar gera Participação; recusar guarda o motivo; sem aprovação o Grupo não recebe Pedido; a Sincronização expira", () => {
    const t3 = grupo("grp_turma_03");
    const p = unwrap(aprovarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_1", crmDoSeed(state)));
    expect(p.contactId).toBe("cnt_29");
    expect(p.origem).toBe("linkDeCaptacao");
    expect(t3.pedidosDeEntrada.find((x) => x.id === "ped_1")?.estado).toBe("aprovado");
    unwrap(recusarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_2", "cat_perda_semret", crmDoSeed(state)));
    expect(t3.pedidosDeEntrada.find((x) => x.id === "ped_2")?.motivoDaRecusaId).toBe("cat_perda_semret");
    expect(aprovarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_2", crmDoSeed(state)).ok).toBe(false);
    expect(receberPedidoDeEntrada(state, "grp_turma_02", "5511999990000", {}, crmDoSeed(state)).ok).toBe(false);
    const novo = unwrap(receberPedidoDeEntrada(state, t3.id, "5511999990000", {}, crmComContatosACriar(state, ["5511999990000"])));
    expect(novo.estado).toBe("pendente");
    t3.configuracoes.administradoresAprovamEntrada = false;
    unwrap(sincronizarGrupo(state, "mem_julia", t3.id, crmDoSeed(state)));
    expect(t3.pedidosDeEntrada.find((x) => x.id === novo.id)?.estado).toBe("expirado");
  });

  it("RN-GRP-10/11 — a importação usa o Contato que o servidor gerou para número desconhecido, nunca para o Canal, e é idempotente", () => {
    const contatos = state.contacts.length;
    const crm = crmDaOperacao(state, "importarGruposDoCanal", ["chn_wpp"]);
    // 3 números desconhecidos pedem Contato novo; os outros já eram cnt_3..cnt_8; o número do Canal nunca entra
    expect(crm.contatosACriar).toHaveLength(3);
    expect(numerosAResolver("importarGruposDoCanal", state, ["chn_wpp"], crm).some((n) => n.replace(/\D/g, "") === "5511987654321")).toBe(false);
    const r = unwrap(importarGruposDoCanal(state, "mem_rafael", "chn_wpp", crm));
    expect(r.importados.map((g) => g.nome)).toEqual(["Fornecedores Full Face", "Ex-alunos 2024"]);
    // a operação não escreve em state.contacts: o INSERT é do `aoConfirmar`, em plataforma.contatos
    expect(state.contacts.length).toBe(contatos);
    const idsNovos = new Set((crm.contatosACriar ?? []).map((c) => c.id));
    const usados = r.importados.flatMap((g) => g.participacoes.map((p) => p.contactId)).filter((id): id is string => id !== undefined && idsNovos.has(id));
    expect(new Set(usados)).toEqual(idsNovos);
    expect(state.activity.filter((a) => a.action === "Contato criado por Participação em Grupo")).toHaveLength(3);
    const fornecedores = r.importados[0] as Grupo;
    expect(participacoesVigentes(fornecedores).some((p) => p.canalParticipanteId === "chn_wpp")).toBe(true);
    expect(participacoesVigentes(fornecedores).filter((p) => p.canalParticipanteId).every((p) => p.contactId === undefined)).toBe(true);
    expect(fornecedores.captacao.estado).toBe("inativa");
    expect((r.importados[1] as Grupo).sincronizacao.estado).toBe("semPrivilegio");
    expect(numerosAResolver("importarGruposDoCanal", state, ["chn_wpp"], crmDoSeed(state))).toEqual([]);
    const de_novo = unwrap(importarGruposDoCanal(state, "mem_rafael", "chn_wpp", crmDoSeed(state)));
    expect(de_novo.importados).toHaveLength(0);
    expect(de_novo.jaExistiam).toBe(2);
    expect(state.grupos.filter((g) => g.identificadorExterno === fornecedores.identificadorExterno)).toHaveLength(1);
  });

  it("RN-GRP-10 — sem o Contato do servidor a importação recusa antes de mexer no estado, sem inventar id e sem o número na frase", () => {
    const grupos = state.grupos.length;
    const atividades = state.activity.length;
    const r = importarGruposDoCanal(state, "mem_rafael", "chn_wpp", crmDoSeed(state));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Contato do participante não resolvido.");
    expect(state.grupos.length).toBe(grupos);
    expect(state.activity.length).toBe(atividades);
  });

  it("RN-GRP-13 / INV-GRP-05 — enviar cria a Conversa de grupo uma vez, sem Contato, aberta com Grupos habilitados; resolvida sem", () => {
    const t1 = grupo("grp_turma_01");
    expect(conversaDoGrupo(state, t1)).toBeUndefined();
    const a = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t1.id, { content: "Aula amanhã!" }, crmDoSeed(state)));
    expect(a.conversa.contactId).toBeUndefined();
    expect(a.conversa.groupIdentifier?.externalId).toBe(t1.identificadorExterno);
    expect(a.conversa.state).toBe("aberta");
    expect(a.mensagem.direction).toBe("enviada");
    const b = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t1.id, { content: "Trazer dúvidas." }, crmDoSeed(state)));
    expect(b.conversa.id).toBe(a.conversa.id);
    expect(state.conversations.filter((c) => c.groupIdentifier?.externalId === t1.identificadorExterno)).toHaveLength(1);
    expect(state.activity.filter((x) => x.action === "Mensagem enviada ao Grupo" && x.objectId === t1.id)).toHaveLength(2);
    const canal = state.channels.find((c) => c.id === "chn_wpp");
    if (canal) canal.groupsEnabled = false;
    const t3 = grupo("grp_turma_03");
    const c = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t3.id, { content: "Oi" }, crmDoSeed(state)));
    expect(c.conversa.state).toBe("resolvida");
  });

  it("sair do Grupo — só administrar; único administrador exige confirmação; fica inacessível e o Link de convite some; não arquiva", () => {
    expect(sairDoGrupo(state, "mem_julia", "grp_turma_02", {}, crmDoSeed(state)).ok).toBe(false);
    const semConfirmar = sairDoGrupo(state, "mem_thiago", "grp_turma_02", {}, crmDoSeed(state));
    expect(semConfirmar.ok).toBe(false);
    if (!semConfirmar.ok) expect(semConfirmar.error).toMatch(/irreversível/);
    unwrap(sairDoGrupo(state, "mem_thiago", "grp_turma_02", { entendiIrreversivel: true }, crmDoSeed(state)));
    const t2 = grupo("grp_turma_02");
    expect(t2.sincronizacao).toMatchObject({ estado: "inacessivel", papelDoCanal: "ausente" });
    expect(t2.linkDeConvite).toBeUndefined();
    expect(t2.lifecycle).toBe("ativo");
    expect(participacoesVigentes(t2).some((p) => p.canalParticipanteId === "chn_wpp")).toBe(false);
    // a Turma #01 tem outro administrador (cnt_1): sai sem confirmação
    expect(sairDoGrupo(state, "mem_thiago", "grp_turma_01", {}, crmDoSeed(state)).ok).toBe(true);
  });

  it("criar Grupo — nasce sincronizado, com o Canal como administrador, Captação ativa e os participantes escolhidos", () => {
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma Full Face #04", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_22", "cnt_23"], administradoresContactIds: ["cnt_22"], comunidadeId: COMUNIDADE_ALUNOS_ID }, crmDoSeed(state)));
    expect(g.sincronizacao).toMatchObject({ estado: "sincronizado", papelDoCanal: "administrador" });
    expect(g.captacao.estado).toBe("ativa");
    expect(g.identificadorExterno).toMatch(/@g\.us$/);
    expect(participacoesVigentes(g)).toHaveLength(3);
    expect(participacoesVigentes(g).find((p) => p.contactId === "cnt_22")?.papel).toBe("administrador");
    expect(g.comunidadeId).toBe(COMUNIDADE_ALUNOS_ID);
    expect(membrosDaComunidade(state, COMUNIDADE_ALUNOS_ID)).toContain("cnt_23");
    // um Contato na lixeira não entra
    expect(criarGrupo(state, "mem_julia", { nome: "Outra", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_21"] }, crmDoSeed(state)).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "", canalId: "chn_wpp" }, crmDoSeed(state)).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "X", canalId: "chn_insta" }, crmDoSeed(state)).ok).toBe(false);
    expect(criarGrupo(state, "mem_beatriz", { nome: "X", canalId: "chn_wpp" }, crmDoSeed(state)).ok).toBe(false);
  });

  it("criar Grupo com Contato criador e enviar o Link de convite (C40) — o criador entra como administrador; o link sai numa Conversa com cada convidado", () => {
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma Full Face #05", canalId: "chn_wpp", contatoCriadorId: "cnt_22", administradoresContactIds: ["cnt_23"] }, crmDoSeed(state)));
    expect(g.contatoCriadorId).toBe("cnt_22");
    // O JID é novo no Espaço: o seed tem JIDs fixos, e um repetido herdava a Conversa de grupo de outro.
    const jidsIguais = [...state.grupos, ...state.comunidades].filter((x) => x.identificadorExterno === g.identificadorExterno);
    expect(jidsIguais).toHaveLength(1);
    expect(participacoesVigentes(g).find((p) => p.contactId === "cnt_22")?.papel).toBe("administrador");
    expect(participacoesVigentes(g).find((p) => p.contactId === "cnt_23")?.papel).toBe("administrador");
    // Dois convidados sem Conversa aberta no Canal (a janela de resposta não entra no caminho) e o criador, que já está no Grupo.
    const semConversa = (id: string) => !state.conversations.some((c) => c.contactId === id && c.channelId === "chn_wpp" && c.lifecycle === "ativo" && c.state !== "resolvida");
    const convidados = contatosComWhatsApp(state).map((c) => c.id).filter((id) => id !== "cnt_22" && id !== "cnt_23" && semConversa(id)).slice(0, 2);
    expect(convidados).toHaveLength(2);
    const envio = unwrap(enviarLinkDeConvite(state, "mem_julia", g.id, [...convidados, "cnt_22"], crmDoSeed(state)));
    expect(envio.enviados).toEqual(convidados);
    expect(envio.falhas.map((f) => f.contactId)).toEqual(["cnt_22"]);
    for (const id of convidados) {
      const conversa = state.conversations.find((c) => c.contactId === id && c.channelId === "chn_wpp" && c.lifecycle === "ativo" && c.state !== "resolvida");
      expect(conversa?.messages.at(-1)?.content).toContain(g.linkDeConvite?.endereco ?? "sem link");
    }
    // O convite não é entrada: ninguém entrou ainda.
    expect(participacoesVigentes(g).filter((p) => p.contactId && convidados.includes(p.contactId))).toHaveLength(0);
    // Sem Contato escolhido, e com o Link de convite inválido, nada sai.
    expect(enviarLinkDeConvite(state, "mem_julia", g.id, [], crmDoSeed(state)).ok).toBe(false);
    if (g.linkDeConvite) g.linkDeConvite.estado = "invalido";
    expect(enviarLinkDeConvite(state, "mem_julia", g.id, convidados, crmDoSeed(state)).ok).toBe(false);
  });

  it("criar Grupo com foto e capa (C41) — viram Arquivos do Espaço; o que não é imagem, ou passa do teto, é recusado sem deixar nada", () => {
    const foto = { nome: "turma.jpg", url: "data:image/jpeg;base64,AAAA", tamanhoBytes: 3 };
    const capa = { nome: "capa.jpg", url: "data:image/jpeg;base64,BBBB", tamanhoBytes: 3 };
    const arquivosAntes = state.files.length;
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma com rosto", canalId: "chn_wpp", foto, capa }, crmDoSeed(state)));
    expect(urlDoArquivo(state, g.fotoFileId)).toBe(foto.url);
    expect(urlDoArquivo(state, g.capaFileId)).toBe(capa.url);
    expect(state.files.filter((f) => f.id === g.fotoFileId || f.id === g.capaFileId).every((f) => f.mediaType === "image")).toBe(true);
    expect(state.files.length).toBe(arquivosAntes + 2);
    const grupos = state.grupos.length;
    expect(criarGrupo(state, "mem_julia", { nome: "Sem foto", canalId: "chn_wpp", foto: { nome: "a.pdf", url: "data:application/pdf;base64,AA", tamanhoBytes: 2 } }, crmDoSeed(state)).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "Capa grande", canalId: "chn_wpp", capa: { ...capa, tamanhoBytes: 6 * 1024 * 1024 } }, crmDoSeed(state)).ok).toBe(false);
    expect(state.grupos.length).toBe(grupos);
    expect(state.files.length).toBe(arquivosAntes + 2);
  });

  it("clique → entrada — a Participação nasce com origem linkDeCaptacao e o Contato desconhecido é criado", () => {
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_01"));
    const r = unwrap(registrarClique(state, "lancamento-setembro"));
    expect(r.grupo?.id).toBe("grp_turma_02");
    const e = unwrap(simularEntradaPorClique(state, r.clique.id, "5511977770001", crmComContatosACriar(state, ["5511977770001"])));
    expect(e.participacao?.origem).toBe("linkDeCaptacao");
    expect(e.participacao?.cliqueId).toBe(r.clique.id);
    // o Contato é o que o servidor gerou (`contatosACriar`); a operação não o grava em state.contacts
    expect(e.participacao?.contactId).toBe("cnt_novo_5511977770001");
    expect(state.contacts.some((c) => c.id === "cnt_novo_5511977770001")).toBe(false);
    expect(state.activity.some((a) => a.objectId === "cnt_novo_5511977770001" && a.action === "Contato criado por Participação em Grupo")).toBe(true);
    // no Grupo que aprova entrada, o clique vira Pedido
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_02"));
    const r3 = unwrap(registrarClique(state, "lancamento-setembro"));
    expect(r3.grupo?.id).toBe("grp_turma_03");
    const e3 = unwrap(simularEntradaPorClique(state, r3.clique.id, "5511977770002", crmComContatosACriar(state, ["5511977770002"])));
    expect(e3.pedidoId).toBeTruthy();
    expect(e3.participacao).toBeUndefined();
  });

  it("numerosAResolver — os eventos do provedor pedem o número do Participante, e o de um Canal do Espaço nunca entra", () => {
    const crm = crmDoSeed(state);
    expect(numerosAResolver("receberPedidoDeEntrada", state, ["grp_turma_03", "5511999990000"], crm)).toEqual(["5511999990000"]);
    expect(numerosAResolver("registrarEntradaNoGrupo", state, ["grp_turma_02", { numero: "5511999990001" }], crm)).toEqual(["5511999990001"]);
    expect(numerosAResolver("simularEntradaPorClique", state, ["clq_1", "5511999990002"], crm)).toEqual(["5511999990002"]);
    expect(numerosAResolver("registrarEntradaNoGrupo", state, ["grp_turma_02", { numero: "+5511987654321" }], crm)).toEqual([]);
    expect(numerosAResolver("criarGrupo", state, [{ nome: "X", canalId: "chn_wpp" }], crm)).toEqual([]);
  });

  it("DO-CXE-05 — o Proprietário do Contato criado segue Canal → Fila → Caixa → Proprietário do Espaço, e a Origem vem do catálogo pelo nome", () => {
    const semPadrao = { proprietarioPadraoId: null, filaPadraoId: null, origemPadraoId: null };
    const fila = state.queues[0];
    if (!fila) throw new Error("o seed precisa de uma Fila");
    fila.defaultContactOwnerMemberId = "mem_da_fila";
    state.inbox.defaultContactOwnerMemberId = "mem_da_caixa";
    expect(padroesDoContatoCriado(state, { ...semPadrao, proprietarioPadraoId: "mem_do_canal", filaPadraoId: fila.id }).proprietarioId).toBe("mem_do_canal");
    expect(padroesDoContatoCriado(state, { ...semPadrao, filaPadraoId: fila.id }).proprietarioId).toBe("mem_da_fila");
    expect(padroesDoContatoCriado(state, semPadrao).proprietarioId).toBe("mem_da_caixa");
    delete state.inbox.defaultContactOwnerMemberId;
    expect(padroesDoContatoCriado(state, semPadrao).proprietarioId).toBe(state.workspace.ownerMemberId);
    const origem = state.catalog.find((i) => i.kind === "origem");
    if (!origem) throw new Error("o seed precisa de uma Origem");
    expect(padroesDoContatoCriado(state, { ...semPadrao, origemPadraoId: origem.id }).origem).toBe(origem.name);
    expect(padroesDoContatoCriado(state, semPadrao).origem).toBeUndefined();
  });

  it("evento do provedor — sem o Contato do servidor o Pedido e a entrada são recusados, sem Participação e sem Atividade, e a frase não traz o número", () => {
    const t3 = grupo("grp_turma_03");
    const pedidos = t3.pedidosDeEntrada.length;
    const atividades = state.activity.length;
    const pedido = receberPedidoDeEntrada(state, t3.id, "5511999990000", {}, crmDoSeed(state));
    expect(pedido.ok).toBe(false);
    const entrada = registrarEntradaNoGrupo(state, "grp_turma_02", { numero: "5511999990000" }, crmDoSeed(state));
    expect(entrada.ok).toBe(false);
    for (const r of [pedido, entrada]) if (!r.ok) expect(r.error).toBe("Contato do participante não resolvido.");
    expect(t3.pedidosDeEntrada.length).toBe(pedidos);
    expect(state.activity.length).toBe(atividades);
  });

  it("evento do provedor — um Contato lido de plataforma.contatos (o sobrevivente de uma mesclagem) é o que a Participação usa, sem criar outro", () => {
    const crm: CrmDasFerramentas = { ...crmDoSeed(state), contatos: [{ id: "cnt_sobrevivente", nome: "Quem ficou", estado: "ativo", whatsapp: "+5511999990003" }] };
    const atividades = state.activity.length;
    const p = unwrap(registrarEntradaNoGrupo(state, "grp_turma_02", { numero: "5511999990003" }, crm));
    expect(p.contactId).toBe("cnt_sobrevivente");
    expect(state.activity.filter((a) => a.action === "Contato criado por Participação em Grupo")).toHaveLength(0);
    expect(state.activity.length).toBeGreaterThan(atividades);
  });

  it("evento do provedor — o Contato novo é registrado uma vez só, mesmo quando o número aparece em duas operações da mesma leitura", () => {
    const crm = crmComContatosACriar(state, ["5511999990004"]);
    unwrap(registrarEntradaNoGrupo(state, "grp_turma_02", { numero: "5511999990004" }, crm));
    unwrap(registrarEntradaNoGrupo(state, "grp_turma_01", { numero: "5511999990004" }, crm));
    expect(state.activity.filter((a) => a.action === "Contato criado por Participação em Grupo" && a.objectId === "cnt_novo_5511999990004")).toHaveLength(1);
  });

  it("evento do provedor — entrada de outro Canal do Espaço de Trabalho vira “É o Canal”, sem Contato", () => {
    const antes = state.contacts.length;
    const p = unwrap(registrarEntradaNoGrupo(state, "grp_turma_02", { numero: "+5511987654321" }, crmDoSeed(state)));
    expect(p.canalParticipanteId).toBe("chn_wpp");
    expect(p.contactId).toBeUndefined();
    expect(state.contacts.length).toBe(antes);
  });
});

describe("Comunidades", () => {
  it("criar — o provedor cria a Comunidade e o Grupo de avisos; o avisos tem Captação inativa e só administradores enviam", () => {
    const r = unwrap(criarComunidade(state, "mem_julia", { nome: "Mentoria", canalId: "chn_wpp" }, crmDoSeed(state)));
    expect(r.grupoDeAvisos.papelNaComunidade).toBe("avisos");
    expect(r.grupoDeAvisos.comunidadeId).toBe(r.comunidade.id);
    expect(r.grupoDeAvisos.captacao.estado).toBe("inativa");
    expect(r.grupoDeAvisos.configuracoes.somenteAdministradoresEnviam).toBe(true);
    expect(grupoDeAvisos(state, r.comunidade.id)?.id).toBe(r.grupoDeAvisos.id);
    expect(criarComunidade(state, "mem_julia", { nome: "X", canalId: "chn_mail" }, crmDoSeed(state)).ok).toBe(false);
  });

  it("RN-COM-03 / INV-COM-04 — vincular exige Grupo sem Comunidade, mesmo Canal e admin; desvincular preserva Participações e sai do avisos", () => {
    const r = unwrap(criarComunidade(state, "mem_thiago", { nome: "Mentoria", canalId: "chn_wpp" }, crmDoSeed(state)));
    const jaVinculado = vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_turma_02", crmDoSeed(state));
    expect(jaVinculado.ok).toBe(false);
    if (!jaVinculado.ok) expect(jaVinculado.error).toMatch(/outra Comunidade/);
    const semPrivilegio = vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_parceiros", crmDoSeed(state));
    expect(semPrivilegio.ok).toBe(false);
    unwrap(desvincularGrupoDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, "grp_turma_02", crmDoSeed(state)));
    const t2 = grupo("grp_turma_02");
    expect(t2.comunidadeId).toBeUndefined();
    expect(participacoesVigentes(t2).length).toBeGreaterThan(1);
    // saiu do avisos: os membros só da #02 não estão mais lá
    const avisos = grupoDeAvisos(state, COMUNIDADE_ALUNOS_ID) as Grupo;
    expect(membrosDoGrupo(avisos).some((p) => p.contactId === "cnt_10")).toBe(false);
    unwrap(vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_turma_02", crmDoSeed(state)));
    expect(grupo("grp_turma_02").comunidadeId).toBe(r.comunidade.id);
    expect(membrosDoGrupo(r.grupoDeAvisos).some((p) => p.contactId === "cnt_10")).toBe(true);
    // só administrar vincula
    expect(vincularGrupoAComunidade(state, "mem_julia", r.comunidade.id, "grp_turma_03", crmDoSeed(state)).ok).toBe(false);
  });

  it("INV-COM-02 / INV-COM-01 — o Grupo de avisos não é desvinculável, mas tem o ciclo de vida de qualquer Grupo", () => {
    expect(desvincularGrupoDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, "grp_avisos_ff", crmDoSeed(state)).ok).toBe(false);
    // A lixeira da Comunidade não leva o avisos (INV-COM-01); a do Grupo é um ato próprio.
    unwrap(enviarComunidadeALixeira(state, "mem_thiago", COMUNIDADE_ALUNOS_ID));
    expect(grupo("grp_avisos_ff").lifecycle).toBe("ativo");
    expect(enviarGrupoALixeira(state, "mem_thiago", "grp_avisos_ff").ok).toBe(true);
    expect(grupo("grp_avisos_ff").lifecycle).toBe("naLixeira");
  });

  it("25, 12.1 → 12.2 — nascer vinculado exige o que vincular exige: Comunidade inacessível recusa o Grupo novo", () => {
    unwrap(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, { entendiIrreversivel: true }, crmDoSeed(state)));
    const r = criarGrupo(state, "mem_julia", { nome: "Turma #05", canalId: "chn_wpp", comunidadeId: COMUNIDADE_ALUNOS_ID }, crmDoSeed(state));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/inacessível/);
  });

  it("RN-COM-04 — ninguém é adicionado ao avisos diretamente; RN-COM-06 — membros contados uma vez", () => {
    expect(adicionarParticipantes(state, "mem_julia", "grp_avisos_ff", { contactIds: ["cnt_20"] }, crmDoSeed(state)).ok).toBe(false);
    unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_16"] }, crmDoSeed(state)));
    const membros = membrosDaComunidade(state, COMUNIDADE_ALUNOS_ID);
    expect(membros.filter((id) => id === "cnt_16")).toHaveLength(1);
    const avisos = grupoDeAvisos(state, COMUNIDADE_ALUNOS_ID) as Grupo;
    expect(membrosDoGrupo(avisos).filter((p) => p.contactId === "cnt_16")).toHaveLength(1);
  });

  it("RN-COM-05 — enviar à Comunidade é enviar ao Grupo de avisos, com Registro na Comunidade", () => {
    const r = unwrap(enviarMensagemAComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID, { content: "Aviso geral" }, crmDoSeed(state)));
    expect(r.grupoDeAvisos.id).toBe("grp_avisos_ff");
    expect(r.conversa.id).toBe("cnv_grp_avisos");
    expect(state.activity.find((a) => a.action === "Mensagem enviada à Comunidade" && a.objectId === COMUNIDADE_ALUNOS_ID && a.detail?.includes("Aviso geral"))).toBeTruthy();
    expect(state.activity.find((a) => a.action === "Mensagem enviada ao Grupo" && a.objectId === "grp_avisos_ff" && a.detail?.includes("Aviso geral"))).toBeTruthy();
  });

  it("Comunidade na lixeira — enviar à Comunidade recusa pela Comunidade, mesmo com o Grupo de avisos ativo (INV-COM-01)", () => {
    unwrap(enviarComunidadeALixeira(state, "mem_thiago", COMUNIDADE_ALUNOS_ID));
    expect(grupo("grp_avisos_ff").lifecycle).toBe("ativo");
    const r = enviarMensagemAComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID, { content: "Oi" }, crmDoSeed(state));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("A Comunidade está na lixeira.");
  });

  it("INV-COM-01 / RN-COM-12 / RN-COM-08 — arquivar não muda os Grupos; sair não sai dos Grupos comuns", () => {
    unwrap(arquivarComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID));
    expect(grupo("grp_turma_02").lifecycle).toBe("ativo");
    expect(grupo("grp_turma_02").captacao.estado).toBe("ativa");
    expect(grupo("grp_turma_02").comunidadeId).toBe(COMUNIDADE_ALUNOS_ID);
    const c = state.comunidades.find((x) => x.id === COMUNIDADE_ALUNOS_ID);
    if (c) {
      c.lifecycle = "ativo";
      delete c.archivedAt;
    }
    expect(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, {}, crmDoSeed(state)).ok).toBe(false);
    unwrap(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, { entendiIrreversivel: true }, crmDoSeed(state)));
    expect(state.comunidades.find((x) => x.id === COMUNIDADE_ALUNOS_ID)?.sincronizacao.papelDoCanal).toBe("ausente");
    expect(grupo("grp_avisos_ff").sincronizacao.papelDoCanal).toBe("ausente");
    expect(grupo("grp_turma_02").sincronizacao.papelDoCanal).toBe("administrador");
  });
});

describe("Flows — validação 7.5", () => {
  it("7.5.1 — última Tela terminal, destinos existentes, alcançabilidade", () => {
    const v = rascunho();
    const tela = unwrap(adicionarTela(state, "mem_thiago", FLOW_TRIAGEM_ID, { identificador: "extra", titulo: "Extra", terminal: false }));
    let problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.1" && /última Tela/.test(p.mensagem))).toBe(true);
    expect(problemas.some((p) => p.regra === "7.5.1" && /alcançável/.test(p.mensagem) && p.telaId === tela.id)).toBe(true);
    unwrap(editarTela(state, "mem_thiago", FLOW_TRIAGEM_ID, tela.id, { terminal: true }));
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    const rodape = perfil?.componentes.find((c) => c.tipo === "rodape");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", rodape?.id ?? "", { acao: { tipo: "navegar", telaDeDestino: "nao_existe" } }));
    problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.1" && /não existe/.test(p.mensagem))).toBe(true);
    expect(adicionarTela(state, "mem_thiago", FLOW_TRIAGEM_ID, { identificador: "Com Espaço", titulo: "x" }).ok).toBe(false);
    expect(adicionarTela(state, "mem_thiago", FLOW_TRIAGEM_ID, { identificador: "perfil", titulo: "x" }).ok).toBe(false);
  });

  it("7.5.2 / INV-FLW-04 — Componente de entrada sem Nome, ou com Nome repetido", () => {
    const v = rascunho();
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    const c = unwrap(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "campoDeTexto" }));
    expect(c.nome).toBe("campo_de_texto");
    const repetido = editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", c.id, { nome: "cidade" });
    expect(repetido.ok).toBe(false);
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", c.id, { nome: "" }));
    const problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.2" && p.componenteId === c.id)).toBe(true);
    expect(camposDeFlow(v).map((x) => x.nome)).toEqual(["formacao", "cidade", "whatsapp_clinica", "aceite"]);
  });

  it("7.5.3 — concluir só em terminal; troca de dados exige Ponto; navegar exige destino", () => {
    const v = rascunho();
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    const rodape = perfil?.componentes.find((c) => c.tipo === "rodape");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", rodape?.id ?? "", { acao: { tipo: "concluir" } }));
    let problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.3" && /terminal/.test(p.mensagem))).toBe(true);
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", rodape?.id ?? "", { acao: { tipo: "trocaDeDados", telaDeDestino: "confirmacao" } }));
    problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.3" && /Ponto de troca/.test(p.mensagem))).toBe(true);
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", rodape?.id ?? "", { acao: { tipo: "navegar" } }));
    problemas = validarVersao(flow(), v, state.files);
    expect(problemas.some((p) => p.regra === "7.5.3" && /sem Tela de destino/.test(p.mensagem))).toBe(true);
  });

  it("7.5.4 — Expressões e cargas úteis só referenciam Nomes da Tela e Dados declarados", () => {
    const v = rascunho();
    const confirmacao = v.telas.find((t) => t.identificador === "confirmacao");
    const paragrafo = confirmacao?.componentes.find((c) => c.tipo === "paragrafo");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, confirmacao?.id ?? "", paragrafo?.id ?? "", { propriedades: { texto: "Olá {dados.nome_inexistente}, {formulario.cidade}" } }));
    const problemas = validarVersao(flow(), v, state.files);
    expect(problemas.filter((p) => p.regra === "7.5.4" && p.componenteId === paragrafo?.id)).toHaveLength(2);
  });

  it("7.5.5 — opções com identificador vazio ou repetido falham: o valor da Resposta seria ambíguo", () => {
    const v = rascunho();
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    const escolha = perfil?.componentes.find((c) => c.tipo === "escolhaUnica");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", escolha?.id ?? "", { propriedades: { opcoes: [{ id: "a", titulo: "A" }, { id: "a", titulo: "B" }, { id: "", titulo: "C" }] } }));
    const problemas = validarVersao(flow(), v, state.files).filter((p) => p.regra === "7.5.5" && p.componenteId === escolha?.id);
    expect(problemas.some((p) => /repete/.test(p.mensagem))).toBe(true);
    expect(problemas.some((p) => /sem identificador/.test(p.mensagem))).toBe(true);
  });

  it("7.5.5 — limites do catálogo: Título > 80, Rodapé > 35, Escolha sem opção", () => {
    const v = rascunho();
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    const titulo = perfil?.componentes.find((c) => c.tipo === "titulo");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", titulo?.id ?? "", { propriedades: { texto: "x".repeat(81) } }));
    const rodape = perfil?.componentes.find((c) => c.tipo === "rodape");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", rodape?.id ?? "", { propriedades: { rotulo: "y".repeat(36) } }));
    const escolha = perfil?.componentes.find((c) => c.tipo === "escolhaUnica");
    unwrap(editarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", escolha?.id ?? "", { propriedades: { opcoes: [] } }));
    const problemas = validarVersao(flow(), v, state.files).filter((p) => p.regra === "7.5.5");
    expect(problemas.some((p) => p.componenteId === titulo?.id)).toBe(true);
    expect(problemas.some((p) => p.componenteId === rodape?.id)).toBe(true);
    expect(problemas.some((p) => p.componenteId === escolha?.id)).toBe(true);
  });

  it("7.5.6 — um Rodapé por Tela, sempre o último; filhos só em contêineres", () => {
    const v = rascunho();
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    expect(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "rodape" }).ok).toBe(false);
    unwrap(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "legenda" }));
    // o Rodapé continua por último mesmo depois de inserir
    expect(perfil?.componentes[perfil.componentes.length - 1]?.tipo).toBe("rodape");
    const titulo = perfil?.componentes.find((x) => x.tipo === "titulo");
    expect(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "legenda", paiId: titulo?.id ?? "" }).ok).toBe(false);
    const form = unwrap(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "formulario" }));
    expect(adicionarComponente(state, "mem_thiago", FLOW_TRIAGEM_ID, perfil?.id ?? "", { tipo: "campoDeTexto", paiId: form.id }).ok).toBe(true);
    expect(validarVersao(flow(), v, state.files).filter((p) => p.regra === "7.5.6")).toHaveLength(0);
  });
});

describe("Flows — Versões, envio e resposta", () => {
  it("RN-FLW-08 — renomear o Identificador de Tela reescreve as Ações que a referenciam", () => {
    const v = rascunho();
    const confirmacao = v.telas.find((t) => t.identificador === "confirmacao");
    unwrap(editarTela(state, "mem_thiago", FLOW_TRIAGEM_ID, confirmacao?.id ?? "", { identificador: "final" }));
    const perfil = v.telas.find((t) => t.identificador === "perfil");
    expect(perfil?.componentes.find((c) => c.tipo === "rodape")?.acao?.telaDeDestino).toBe("final");
    expect(validarVersao(flow(), v, state.files).filter((p) => p.regra === "7.5.1")).toHaveLength(0);
  });

  it("DO-FLW-03 / RN-FLW-02/04/06 — publicar torna a anterior obsoleta, o rascunho publicada e abre um rascunho novo; a publicada é imutável; inválida não publica", () => {
    const f = flow();
    const r = unwrap(publicarVersao(state, "mem_thiago", f.id, { notas: "Agora com o WhatsApp da clínica." }, crmDoSeed(state)));
    expect(r.publicada.numero).toBe(2);
    expect(r.publicada.instantaneoPublicado).toContain("whatsapp_clinica");
    expect(r.rascunho.numero).toBe(3);
    expect(r.rascunho.proveniencia).toEqual({ versaoId: r.publicada.id, numero: 2 });
    expect(f.versoes.find((v) => v.numero === 1)?.estado).toBe("obsoleta");
    expect(f.versoes.filter((v) => v.estado === "publicada")).toHaveLength(1);
    expect(f.versoes.filter((v) => v.estado === "rascunho")).toHaveLength(1);
    // só o rascunho é editável: a Tela da publicada não é encontrada pela edição
    const telaPublicada = r.publicada.telas[0];
    expect(editarTela(state, "mem_thiago", f.id, telaPublicada?.id ?? "", { titulo: "x" }).ok).toBe(false);
    // rascunho inválido não publica e deixa Registro
    const v3 = rascunho();
    const perfil = v3.telas.find((t) => t.identificador === "perfil");
    const rodape = perfil?.componentes.find((c) => c.tipo === "rodape");
    unwrap(editarComponente(state, "mem_thiago", f.id, perfil?.id ?? "", rodape?.id ?? "", { acao: { tipo: "navegar", telaDeDestino: "nada" } }));
    const falha = publicarVersao(state, "mem_thiago", f.id, {}, crmDoSeed(state));
    expect(falha.ok).toBe(false);
    expect(state.activity.find((a) => a.action === "Validação falhou" && a.objectId === f.id)?.result).toBe("failed");
    expect(versaoPublicada(f)?.numero).toBe(2);
    // publicar exige administrar
    expect(publicarVersao(state, "mem_julia", f.id, {}, crmDoSeed(state)).ok).toBe(false);
  });

  it("RN-FLW-03 / RN-FLW-05 — descartar o único rascunho é recusado; criar rascunho a partir de uma obsoleta traz a Proveniência", () => {
    const f = flow();
    unwrap(descartarRascunho(state, "mem_thiago", f.id));
    expect(versaoCorrente(f)).toBeUndefined();
    const novo = unwrap(criarRascunhoAPartirDe(state, "mem_thiago", f.id, "vfl_triagem_1"));
    expect(novo.numero).toBe(2);
    expect(novo.proveniencia?.numero).toBe(1);
    expect(criarRascunhoAPartirDe(state, "mem_thiago", f.id, "vfl_triagem_1").ok).toBe(false);
    const solto = unwrap(criarFlow(state, "mem_julia", { nome: "Pesquisa", categoria: "pesquisa", canalId: "chn_wpp" }, crmDoSeed(state)));
    expect(solto.versoes).toHaveLength(1);
    expect(descartarRascunho(state, "mem_julia", solto.id).ok).toBe(false);
    expect(validarVersao(solto, solto.versoes[0] as VersaoDeFlow, state.files)).toEqual([]);
  });

  it("INV-FLW-02 / RN-FLW-01 / RN-FLW-13 — enviar leva a publicada dentro da Mensagem; despublicado, arquivado ou outro Canal recusam", () => {
    const f = flow();
    const cnv = state.conversations.find((c) => c.id === "cnv_5");
    const r = unwrap(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "Me conta sobre você?", rotuloDoBotao: "Responder" }, crmDoSeed(state)));
    expect(r.mensagem.flow).toMatchObject({ flowId: f.id, versaoId: "vfl_triagem_1", numeroDaVersao: 1, rotuloDoBotao: "Responder", telaInicial: "perfil" });
    expect(r.mensagem.attachments[0]?.mediaType).toBe("flow");
    expect(cnv?.messages.at(-1)?.id).toBe(r.mensagem.id);
    expect(metricasDoFlow(state, f.id).envios).toBe(5);
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_2", corpo: "x" }, crmDoSeed(state)).ok).toBe(false);
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_grp_avisos", corpo: "x" }, crmDoSeed(state)).ok).toBe(false);
    unwrap(despublicarFlow(state, "mem_thiago", f.id));
    const semPublicada = enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "x" }, crmDoSeed(state));
    expect(semPublicada.ok).toBe(false);
    if (!semPublicada.ok) expect(semPublicada.error).toMatch(/publicada/);
    unwrap(publicarVersao(state, "mem_thiago", f.id, {}, crmDoSeed(state)));
    unwrap(arquivarFlow(state, "mem_thiago", f.id));
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "x" }, crmDoSeed(state)).ok).toBe(false);
    expect(publicarVersao(state, "mem_thiago", f.id, {}, crmDoSeed(state)).ok).toBe(false);
  });

  it("DO-FLW-02 / 20.1 / 20.5 — a Resposta entra como Mensagem recebida na Conversa 1:1; obsoleta aceita; Nome estranho marca não conforme; métricas por Versão", () => {
    const f = flow();
    const antes = metricasDoFlow(state, f.id);
    expect(antes).toEqual({ envios: 4, respostas: 3, taxa: 0.75 });
    const r = unwrap(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_17", valores: { formacao: "dentista", cidade: "Osasco", aceite: true } }, crmDoSeed(state)));
    expect(r.mensagem.direction).toBe("recebida");
    expect(r.mensagem.respostaDeFlow?.naoConforme).toBeUndefined();
    expect(r.conversa.id).toBe("cnv_17");
    expect(metricasDoFlow(state, f.id)).toEqual({ envios: 4, respostas: 4, taxa: 1 });
    unwrap(publicarVersao(state, "mem_thiago", f.id, {}, crmDoSeed(state)));
    const obsoleta = unwrap(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_5", versaoId: "vfl_triagem_1", valores: { formacao: "medico", cidade: "x", aceite: true, inventado: 1 } }, crmDoSeed(state)));
    expect(obsoleta.mensagem.respostaDeFlow?.numeroDaVersao).toBe(1);
    expect(obsoleta.mensagem.respostaDeFlow?.naoConforme).toBe(true);
    expect(metricasDoFlow(state, f.id, "vfl_triagem_1").respostas).toBe(5);
    expect(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_5", versaoId: rascunho().id, valores: {} }, crmDoSeed(state)).ok).toBe(false);
  });

  it("copiar — nasce com Proveniência, um rascunho copiado da corrente e chaves novas", () => {
    const f = flow();
    const copia = unwrap(copiarFlow(state, "mem_julia", f.id));
    expect(copia.provenance).toMatchObject({ kind: "copy", sourceId: f.id });
    expect(copia.versoes).toHaveLength(1);
    expect(copia.versoes[0]?.estado).toBe("rascunho");
    expect(camposDeFlow(copia.versoes[0] as VersaoDeFlow).map((c) => c.nome)).toContain("whatsapp_clinica");
    expect(copia.identificadorExterno).toBeUndefined();
  });
});

/** Realce (movimento §4.4): criar nomeia o Ativo; enviar ao Grupo nomeia a Mensagem — é ela que surge. */
describe("Realce — o resultado nomeia o registro tocado", () => {
  it("criarGrupo devolve o id do Grupo; enviarMensagemAoGrupo, o da Mensagem", () => {
    const g = criarGrupo(state, "mem_julia", { nome: "Turma Realce", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_22"] }, crmDoSeed(state));
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.id).toBe(g.value.id);
    const m = enviarMensagemAoGrupo(state, "mem_julia", g.value.id, { content: "Acendeu?" }, crmDoSeed(state));
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.id).toBe(m.value.mensagem.id);
  });
});

describe("criarGrupo — o Canal vem do CRM novo (Fase 15, 3.4.8)", () => {
  const canalNovo = (): Canal => {
    const antigo = state.channels.find((c) => c.id === "chn_wpp");
    if (!antigo) throw new Error("sem chn_wpp");
    return { ...canalDoSeed(antigo), id: "canal-da-tabela", nome: "WhatsApp da tabela", identificadorExterno: "+5511988880001" };
  };

  it("cria o Grupo com o Canal de crm.canais, sem Canal nenhum no modelo antigo", () => {
    const canais = [canalNovo()];
    state.channels = [];
    const r = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma da tabela", canalId: "canal-da-tabela" }, { canais, contatos: [] }));
    expect(r.canalId).toBe("canal-da-tabela");
    expect(r.tipoDeCanal).toBe("whatsapp");
    expect(participacoesVigentes(r).some((p) => p.canalParticipanteId === "canal-da-tabela")).toBe(true);
    expect(state.grupos.some((g) => g.id === r.id)).toBe(true);
  });

  it("recusa 'Canal não encontrado' quando crm.canais não traz o Canal, mesmo que o modelo antigo o tenha", () => {
    const r = criarGrupo(state, "mem_julia", { nome: "Sem Canal", canalId: "chn_wpp" }, { canais: [], contatos: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado.");
  });

  it("sem crm (ausente) também recusa 'Canal não encontrado' e não lança", () => {
    const r = criarGrupo(state, "mem_julia", { nome: "Sem crm", canalId: "chn_wpp" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado.");
  });

  it("um Canal arquivado ou desconectado em crm.canais é recusado com a frase de sempre", () => {
    const arquivado = criarGrupo(state, "mem_julia", { nome: "A", canalId: "canal-da-tabela" }, { canais: [{ ...canalNovo(), estado: "arquivado" }], contatos: [] });
    expect(arquivado.ok).toBe(false);
    if (!arquivado.ok) expect(arquivado.error).toMatch(/arquivado/);
    const desconectado = criarGrupo(state, "mem_julia", { nome: "B", canalId: "canal-da-tabela" }, { canais: [{ ...canalNovo(), conexao: "desconectada" }], contatos: [] });
    expect(desconectado.ok).toBe(false);
    if (!desconectado.ok) expect(desconectado.error).toMatch(/desconectado/);
  });

  it("os Contatos escolhidos são conferidos em crm.contatos, não no modelo antigo", () => {
    const comContato = criarGrupo(state, "mem_julia", { nome: "Com Contato", canalId: "canal-da-tabela", participantesIniciaisContactIds: ["cnt-da-tabela"] }, {
      canais: [canalNovo()],
      contatos: [{ id: "cnt-da-tabela", nome: "Ana da tabela", estado: "ativo", whatsapp: "5511900000001" }],
    });
    expect(comContato.ok).toBe(true);
    if (comContato.ok) expect(participacoesVigentes(comContato.value).some((p) => p.contactId === "cnt-da-tabela")).toBe(true);
    const semContato = criarGrupo(state, "mem_julia", { nome: "Sem Contato", canalId: "canal-da-tabela", participantesIniciaisContactIds: ["cnt_22"] }, { canais: [canalNovo()], contatos: [] });
    expect(semContato.ok).toBe(false);
  });
});

describe("Grupo, Comunidade e Flow conferem Canal e Contato no CRM novo (Fase 15, 3.4.8)", () => {
  const vazio: CrmDasFerramentas = { canais: [], contatos: [] };

  it("Grupo — sincronizar com o Canal fora de crm.canais deixa o Grupo órfão, mesmo que o modelo antigo tenha o Canal", () => {
    const g = unwrap(sincronizarGrupo(state, "mem_julia", "grp_turma_02", vazio));
    expect(g.sincronizacao.estado).toBe("orfao");
  });

  it("Grupo — administrar com crm vazio recusa 'Canal não encontrado.' (a recusa nunca olha o modelo antigo)", () => {
    const r = adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }, vazio);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado.");
    const sem = regenerarLinkDeConvite(state, "mem_julia", "grp_turma_02");
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.error).toBe("Canal não encontrado.");
  });

  it("Grupo — adicionar Participante confere o Contato em crm.contatos: o da tabela entra, o que só existe no modelo antigo não", () => {
    const base = crmDoSeed(state);
    const novo = { id: "cnt-da-tabela", nome: "Ana da tabela", estado: "ativo", whatsapp: "5511900000042" };
    const r = unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt-da-tabela"] }, { ...base, contatos: [...base.contatos, novo] }));
    expect(r.adicionados.map((p) => p.contactId)).toEqual(["cnt-da-tabela"]);
    const fora = adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }, { ...base, contatos: [novo] });
    expect(fora.ok).toBe(false);
    if (!fora.ok) expect(fora.error).toMatch(/não está ativo/);
  });

  it("Grupo — enviar ao Grupo confere o Canal em crm.canais, e a Conversa do Grupo continua em state.conversations (F14-D-05)", () => {
    const sem = enviarMensagemAoGrupo(state, "mem_julia", "grp_turma_01", { content: "Oi" }, vazio);
    expect(sem.ok).toBe(false);
    const r = unwrap(enviarMensagemAoGrupo(state, "mem_julia", "grp_turma_01", { content: "Aula amanhã!" }, crmDoSeed(state)));
    expect(state.conversations.some((c) => c.id === r.conversa.id)).toBe(true);
    expect(r.conversa.groupIdentifier?.externalId).toBe(grupo("grp_turma_01").identificadorExterno);
  });

  it("Grupo — o nome do Canal e do Contato no Registro vêm de crm", () => {
    const base = crmDoSeed(state);
    const p = participacoesVigentes(grupo("grp_turma_02")).find((x) => x.contactId === "cnt_11");
    expect(p).toBeTruthy();
    const nomeNovo = { id: "cnt_11", nome: "Nome vindo da tabela", estado: "ativo", whatsapp: "5511900000011" };
    unwrap(removerParticipante(state, "mem_julia", "grp_turma_02", p?.id ?? "", { ...base, contatos: [nomeNovo] }));
    expect(state.activity.find((a) => a.action === "Participante removido" && a.objectId === "grp_turma_02")?.detail).toBe("Nome vindo da tabela");
  });

  it("Comunidade — sincronizar com o Canal fora de crm.canais deixa a Comunidade órfã; criar confere o Canal de crm.canais", () => {
    const c = unwrap(sincronizarComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID, vazio));
    expect(c.sincronizacao.estado).toBe("orfao");
    const antigo = state.channels.find((x) => x.id === "chn_wpp");
    if (!antigo) throw new Error("sem chn_wpp");
    const canais = [{ ...canalDoSeed(antigo), id: "canal-da-tabela", nome: "WhatsApp da tabela" }];
    state.channels = [];
    const nova = unwrap(criarComunidade(state, "mem_julia", { nome: "Mentoria da tabela", canalId: "canal-da-tabela" }, { canais, contatos: [] }));
    expect(nova.comunidade.canalId).toBe("canal-da-tabela");
    expect(nova.grupoDeAvisos.canalId).toBe("canal-da-tabela");
    const recusa = criarComunidade(state, "mem_julia", { nome: "Sem Canal", canalId: "chn_wpp" }, vazio);
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toBe("Canal não encontrado.");
  });

  it("Flow — publicar e sincronizar conferem o Canal publicador em crm.canais", () => {
    const f = flow();
    const r = publicarVersao(state, "mem_thiago", f.id, {}, vazio);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Canal não encontrado.");
    unwrap(publicarVersao(state, "mem_thiago", f.id, {}, crmDoSeed(state)));
    const orfao = unwrap(sincronizarFlow(state, "mem_julia", f.id, vazio));
    expect(orfao.sincronizacao.estado).toBe("orfao");
  });

  it("Flow — enviar confere o Canal publicador em crm.canais; a Mensagem continua em state.conversations (F14-D-05)", () => {
    const f = flow();
    const sem = enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "x" }, vazio);
    expect(sem.ok).toBe(false);
    const r = unwrap(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "Me conta sobre você?" }, crmDoSeed(state)));
    expect(state.conversations.find((c) => c.id === "cnv_5")?.messages.at(-1)?.id).toBe(r.mensagem.id);
  });

  it("Flow — criar com Canal confere crm.canais; a Resposta confere o Contato em crm.contatos", () => {
    const sem = criarFlow(state, "mem_julia", { nome: "Pesquisa", categoria: "pesquisa", canalId: "chn_wpp" }, vazio);
    expect(sem.ok).toBe(false);
    if (!sem.ok) expect(sem.error).toBe("Escolha um Canal ativo.");
    const f = flow();
    const semContato = receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_17", valores: { formacao: "dentista", cidade: "Osasco", aceite: true } }, vazio);
    expect(semContato.ok).toBe(false);
    if (!semContato.ok) expect(semContato.error).toBe("Contato não encontrado.");
    unwrap(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_17", valores: { formacao: "dentista", cidade: "Osasco", aceite: true } }, crmDoSeed(state)));
  });
});
