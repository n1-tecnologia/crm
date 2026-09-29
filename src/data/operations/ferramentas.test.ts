/**
 * Ferramentas do CRM — as regras dos documentos 24 (Grupo), 25 (Comunidade)
 * e 23 (Flow), uma por caso. Cada teste afirma o RESULTADO da operação e o
 * estado que ela deixou, nunca que uma função foi chamada.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import type { Flow, Grupo, VersaoDeFlow } from "../types";
import {
  camposDeFlow,
  cliquesContabilizados,
  contatosComWhatsApp,
  conversaDoGrupo,
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
  sincronizarGrupo,
  validarVersao,
  vincularGrupoAComunidade,
  zerarCliques,
} from "./ferramentas";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

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
    const r = unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_10", "cnt_20"] }));
    expect(r.jaEstavam).toBe(1);
    expect(r.adicionados.map((p) => p.contactId)).toEqual(["cnt_20"]);
    expect(participacoesVigentes(grupo("grp_turma_02")).filter((p) => p.contactId === "cnt_10")).toHaveLength(1);
    expect(state.activity.find((a) => a.action === "Participante adicionado" && a.objectId === "grp_turma_02")).toBeTruthy();
  });

  it("INV-GRP-07 — remover encerra a Participação com causa e ator; ela não some; a Automação de boas-vindas reage à entrada", () => {
    const antes = grupo("grp_turma_02").participacoes.length;
    const p = participacoesVigentes(grupo("grp_turma_02")).find((x) => x.contactId === "cnt_11");
    expect(p).toBeTruthy();
    expect(removerParticipante(state, "mem_julia", "grp_turma_02", p?.id ?? "").ok).toBe(true);
    expect(grupo("grp_turma_02").participacoes.length).toBe(antes);
    expect(p?.saidaEm).toBeTruthy();
    expect(p?.causaDaSaida).toBe("removido");
    expect(p?.removidoPor).toEqual({ kind: "member", id: "mem_julia" });
    // e o Contato novo que entra ganha a Tag pela Automação da Comunidade
    const c20 = state.contacts.find((c) => c.id === "cnt_20");
    expect(c20?.tagIds).not.toContain("tag_aluno_grupo");
    unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }));
    expect(c20?.tagIds).toContain("tag_aluno_grupo");
    expect(state.automationExecutions.find((e) => e.automationId === "aut_boas_vindas_grupos")?.state).toBe("concluida");
  });

  it("RN-GRP-05 — Grupo em que o Canal é participante recusa administrar, mas aceita sincronizar", () => {
    const r = adicionarParticipantes(state, "mem_julia", "grp_parceiros", { contactIds: ["cnt_20"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/participante/);
    expect(regenerarLinkDeConvite(state, "mem_julia", "grp_parceiros").ok).toBe(false);
    expect(sincronizarGrupo(state, "mem_julia", "grp_parceiros").ok).toBe(true);
    expect(grupo("grp_parceiros").sincronizacao.estado).toBe("semPrivilegio");
  });

  it("RN-GRP-06 — regenerar o Link de convite não toca os Links de Captação", () => {
    const antes = grupo("grp_turma_02").linkDeConvite?.endereco;
    unwrap(regenerarLinkDeConvite(state, "mem_julia", "grp_turma_02"));
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
    const r = adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Sincronize/);
    unwrap(sincronizarGrupo(state, "mem_julia", "grp_turma_02"));
    expect(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_20"] }).ok).toBe(true);
  });

  it("Pedidos de Entrada — aprovar gera Participação; recusar guarda o motivo; sem aprovação o Grupo não recebe Pedido; a Sincronização expira", () => {
    const t3 = grupo("grp_turma_03");
    const p = unwrap(aprovarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_1"));
    expect(p.contactId).toBe("cnt_29");
    expect(p.origem).toBe("linkDeCaptacao");
    expect(t3.pedidosDeEntrada.find((x) => x.id === "ped_1")?.estado).toBe("aprovado");
    unwrap(recusarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_2", "cat_perda_semret"));
    expect(t3.pedidosDeEntrada.find((x) => x.id === "ped_2")?.motivoDaRecusaId).toBe("cat_perda_semret");
    expect(aprovarPedidoDeEntrada(state, "mem_julia", t3.id, "ped_2").ok).toBe(false);
    expect(receberPedidoDeEntrada(state, "grp_turma_02", "5511999990000").ok).toBe(false);
    const novo = unwrap(receberPedidoDeEntrada(state, t3.id, "5511999990000"));
    expect(novo.estado).toBe("pendente");
    t3.configuracoes.administradoresAprovamEntrada = false;
    unwrap(sincronizarGrupo(state, "mem_julia", t3.id));
    expect(t3.pedidosDeEntrada.find((x) => x.id === novo.id)?.estado).toBe("expirado");
  });

  it("RN-GRP-10/11 — a importação cria Contato para número desconhecido, nunca para o Canal, e é idempotente", () => {
    const contatos = state.contacts.length;
    const r = unwrap(importarGruposDoCanal(state, "mem_rafael", "chn_wpp"));
    expect(r.importados.map((g) => g.nome)).toEqual(["Fornecedores Full Face", "Ex-alunos 2024"]);
    // 3 números desconhecidos viram Contatos "não identificados"; os outros já eram cnt_3..cnt_8
    expect(state.contacts.length).toBe(contatos + 3);
    const novos = state.contacts.slice(contatos);
    expect(novos.every((c) => c.creationMode === "automaticoPorGrupo" && c.firstName === "")).toBe(true);
    const fornecedores = r.importados[0] as Grupo;
    expect(participacoesVigentes(fornecedores).some((p) => p.canalParticipanteId === "chn_wpp")).toBe(true);
    expect(participacoesVigentes(fornecedores).filter((p) => p.canalParticipanteId).every((p) => p.contactId === undefined)).toBe(true);
    expect(fornecedores.captacao.estado).toBe("inativa");
    expect((r.importados[1] as Grupo).sincronizacao.estado).toBe("semPrivilegio");
    const de_novo = unwrap(importarGruposDoCanal(state, "mem_rafael", "chn_wpp"));
    expect(de_novo.importados).toHaveLength(0);
    expect(de_novo.jaExistiam).toBe(2);
    expect(state.grupos.filter((g) => g.identificadorExterno === fornecedores.identificadorExterno)).toHaveLength(1);
  });

  it("RN-GRP-13 / INV-GRP-05 — enviar cria a Conversa de grupo uma vez, sem Contato, aberta com Grupos habilitados; resolvida sem", () => {
    const t1 = grupo("grp_turma_01");
    expect(conversaDoGrupo(state, t1)).toBeUndefined();
    const a = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t1.id, { content: "Aula amanhã!" }));
    expect(a.conversa.contactId).toBeUndefined();
    expect(a.conversa.groupIdentifier?.externalId).toBe(t1.identificadorExterno);
    expect(a.conversa.state).toBe("aberta");
    expect(a.mensagem.direction).toBe("enviada");
    const b = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t1.id, { content: "Trazer dúvidas." }));
    expect(b.conversa.id).toBe(a.conversa.id);
    expect(state.conversations.filter((c) => c.groupIdentifier?.externalId === t1.identificadorExterno)).toHaveLength(1);
    expect(state.activity.filter((x) => x.action === "Mensagem enviada ao Grupo" && x.objectId === t1.id)).toHaveLength(2);
    const canal = state.channels.find((c) => c.id === "chn_wpp");
    if (canal) canal.groupsEnabled = false;
    const t3 = grupo("grp_turma_03");
    const c = unwrap(enviarMensagemAoGrupo(state, "mem_julia", t3.id, { content: "Oi" }));
    expect(c.conversa.state).toBe("resolvida");
  });

  it("sair do Grupo — só administrar; único administrador exige confirmação; fica inacessível e o Link de convite some; não arquiva", () => {
    expect(sairDoGrupo(state, "mem_julia", "grp_turma_02").ok).toBe(false);
    const semConfirmar = sairDoGrupo(state, "mem_thiago", "grp_turma_02");
    expect(semConfirmar.ok).toBe(false);
    if (!semConfirmar.ok) expect(semConfirmar.error).toMatch(/irreversível/);
    unwrap(sairDoGrupo(state, "mem_thiago", "grp_turma_02", { entendiIrreversivel: true }));
    const t2 = grupo("grp_turma_02");
    expect(t2.sincronizacao).toMatchObject({ estado: "inacessivel", papelDoCanal: "ausente" });
    expect(t2.linkDeConvite).toBeUndefined();
    expect(t2.lifecycle).toBe("ativo");
    expect(participacoesVigentes(t2).some((p) => p.canalParticipanteId === "chn_wpp")).toBe(false);
    // a Turma #01 tem outro administrador (cnt_1): sai sem confirmação
    expect(sairDoGrupo(state, "mem_thiago", "grp_turma_01").ok).toBe(true);
  });

  it("criar Grupo — nasce sincronizado, com o Canal como administrador, Captação ativa e os participantes escolhidos", () => {
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma Full Face #04", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_22", "cnt_23"], administradoresContactIds: ["cnt_22"], comunidadeId: COMUNIDADE_ALUNOS_ID }));
    expect(g.sincronizacao).toMatchObject({ estado: "sincronizado", papelDoCanal: "administrador" });
    expect(g.captacao.estado).toBe("ativa");
    expect(g.identificadorExterno).toMatch(/@g\.us$/);
    expect(participacoesVigentes(g)).toHaveLength(3);
    expect(participacoesVigentes(g).find((p) => p.contactId === "cnt_22")?.papel).toBe("administrador");
    expect(g.comunidadeId).toBe(COMUNIDADE_ALUNOS_ID);
    expect(membrosDaComunidade(state, COMUNIDADE_ALUNOS_ID)).toContain("cnt_23");
    // um Contato na lixeira não entra
    expect(criarGrupo(state, "mem_julia", { nome: "Outra", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_21"] }).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "", canalId: "chn_wpp" }).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "X", canalId: "chn_insta" }).ok).toBe(false);
    expect(criarGrupo(state, "mem_beatriz", { nome: "X", canalId: "chn_wpp" }).ok).toBe(false);
  });

  it("criar Grupo com Contato criador e enviar o Link de convite (C40) — o criador entra como administrador; o link sai numa Conversa com cada convidado", () => {
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma Full Face #05", canalId: "chn_wpp", contatoCriadorId: "cnt_22", administradoresContactIds: ["cnt_23"] }));
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
    const envio = unwrap(enviarLinkDeConvite(state, "mem_julia", g.id, [...convidados, "cnt_22"]));
    expect(envio.enviados).toEqual(convidados);
    expect(envio.falhas.map((f) => f.contactId)).toEqual(["cnt_22"]);
    for (const id of convidados) {
      const conversa = state.conversations.find((c) => c.contactId === id && c.channelId === "chn_wpp" && c.lifecycle === "ativo" && c.state !== "resolvida");
      expect(conversa?.messages.at(-1)?.content).toContain(g.linkDeConvite?.endereco ?? "sem link");
    }
    // O convite não é entrada: ninguém entrou ainda.
    expect(participacoesVigentes(g).filter((p) => p.contactId && convidados.includes(p.contactId))).toHaveLength(0);
    // Sem Contato escolhido, e com o Link de convite inválido, nada sai.
    expect(enviarLinkDeConvite(state, "mem_julia", g.id, []).ok).toBe(false);
    if (g.linkDeConvite) g.linkDeConvite.estado = "invalido";
    expect(enviarLinkDeConvite(state, "mem_julia", g.id, convidados).ok).toBe(false);
  });

  it("criar Grupo com foto e capa (C41) — viram Arquivos do Espaço; o que não é imagem, ou passa do teto, é recusado sem deixar nada", () => {
    const foto = { nome: "turma.jpg", url: "data:image/jpeg;base64,AAAA", tamanhoBytes: 3 };
    const capa = { nome: "capa.jpg", url: "data:image/jpeg;base64,BBBB", tamanhoBytes: 3 };
    const arquivosAntes = state.files.length;
    const g = unwrap(criarGrupo(state, "mem_julia", { nome: "Turma com rosto", canalId: "chn_wpp", foto, capa }));
    expect(urlDoArquivo(state, g.fotoFileId)).toBe(foto.url);
    expect(urlDoArquivo(state, g.capaFileId)).toBe(capa.url);
    expect(state.files.filter((f) => f.id === g.fotoFileId || f.id === g.capaFileId).every((f) => f.mediaType === "image")).toBe(true);
    expect(state.files.length).toBe(arquivosAntes + 2);
    const grupos = state.grupos.length;
    expect(criarGrupo(state, "mem_julia", { nome: "Sem foto", canalId: "chn_wpp", foto: { nome: "a.pdf", url: "data:application/pdf;base64,AA", tamanhoBytes: 2 } }).ok).toBe(false);
    expect(criarGrupo(state, "mem_julia", { nome: "Capa grande", canalId: "chn_wpp", capa: { ...capa, tamanhoBytes: 6 * 1024 * 1024 } }).ok).toBe(false);
    expect(state.grupos.length).toBe(grupos);
    expect(state.files.length).toBe(arquivosAntes + 2);
  });

  it("clique → entrada — a Participação nasce com origem linkDeCaptacao e o Contato desconhecido é criado", () => {
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_01"));
    const r = unwrap(registrarClique(state, "lancamento-setembro"));
    expect(r.grupo?.id).toBe("grp_turma_02");
    const e = unwrap(simularEntradaPorClique(state, r.clique.id, "5511977770001"));
    expect(e.participacao?.origem).toBe("linkDeCaptacao");
    expect(e.participacao?.cliqueId).toBe(r.clique.id);
    const contato = state.contacts.find((c) => c.id === e.participacao?.contactId);
    expect(contato?.creationMode).toBe("automaticoPorGrupo");
    expect(contato?.identifiers[0]?.value).toBe("5511977770001");
    // no Grupo que aprova entrada, o clique vira Pedido
    unwrap(inativarCaptacao(state, "mem_julia", "grp_turma_02"));
    const r3 = unwrap(registrarClique(state, "lancamento-setembro"));
    expect(r3.grupo?.id).toBe("grp_turma_03");
    const e3 = unwrap(simularEntradaPorClique(state, r3.clique.id, "5511977770002"));
    expect(e3.pedidoId).toBeTruthy();
    expect(e3.participacao).toBeUndefined();
  });

  it("evento do provedor — entrada de outro Canal do Espaço de Trabalho vira “É o Canal”, sem Contato", () => {
    const antes = state.contacts.length;
    const p = unwrap(registrarEntradaNoGrupo(state, "grp_turma_02", { numero: "+5511987654321" }));
    expect(p.canalParticipanteId).toBe("chn_wpp");
    expect(p.contactId).toBeUndefined();
    expect(state.contacts.length).toBe(antes);
  });
});

describe("Comunidades", () => {
  it("criar — o provedor cria a Comunidade e o Grupo de avisos; o avisos tem Captação inativa e só administradores enviam", () => {
    const r = unwrap(criarComunidade(state, "mem_julia", { nome: "Mentoria", canalId: "chn_wpp" }));
    expect(r.grupoDeAvisos.papelNaComunidade).toBe("avisos");
    expect(r.grupoDeAvisos.comunidadeId).toBe(r.comunidade.id);
    expect(r.grupoDeAvisos.captacao.estado).toBe("inativa");
    expect(r.grupoDeAvisos.configuracoes.somenteAdministradoresEnviam).toBe(true);
    expect(grupoDeAvisos(state, r.comunidade.id)?.id).toBe(r.grupoDeAvisos.id);
    expect(criarComunidade(state, "mem_julia", { nome: "X", canalId: "chn_mail" }).ok).toBe(false);
  });

  it("RN-COM-03 / INV-COM-04 — vincular exige Grupo sem Comunidade, mesmo Canal e admin; desvincular preserva Participações e sai do avisos", () => {
    const r = unwrap(criarComunidade(state, "mem_thiago", { nome: "Mentoria", canalId: "chn_wpp" }));
    const jaVinculado = vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_turma_02");
    expect(jaVinculado.ok).toBe(false);
    if (!jaVinculado.ok) expect(jaVinculado.error).toMatch(/outra Comunidade/);
    const semPrivilegio = vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_parceiros");
    expect(semPrivilegio.ok).toBe(false);
    unwrap(desvincularGrupoDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, "grp_turma_02"));
    const t2 = grupo("grp_turma_02");
    expect(t2.comunidadeId).toBeUndefined();
    expect(participacoesVigentes(t2).length).toBeGreaterThan(1);
    // saiu do avisos: os membros só da #02 não estão mais lá
    const avisos = grupoDeAvisos(state, COMUNIDADE_ALUNOS_ID) as Grupo;
    expect(membrosDoGrupo(avisos).some((p) => p.contactId === "cnt_10")).toBe(false);
    unwrap(vincularGrupoAComunidade(state, "mem_thiago", r.comunidade.id, "grp_turma_02"));
    expect(grupo("grp_turma_02").comunidadeId).toBe(r.comunidade.id);
    expect(membrosDoGrupo(r.grupoDeAvisos).some((p) => p.contactId === "cnt_10")).toBe(true);
    // só administrar vincula
    expect(vincularGrupoAComunidade(state, "mem_julia", r.comunidade.id, "grp_turma_03").ok).toBe(false);
  });

  it("INV-COM-02 / INV-COM-01 — o Grupo de avisos não é desvinculável, mas tem o ciclo de vida de qualquer Grupo", () => {
    expect(desvincularGrupoDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, "grp_avisos_ff").ok).toBe(false);
    // A lixeira da Comunidade não leva o avisos (INV-COM-01); a do Grupo é um ato próprio.
    unwrap(enviarComunidadeALixeira(state, "mem_thiago", COMUNIDADE_ALUNOS_ID));
    expect(grupo("grp_avisos_ff").lifecycle).toBe("ativo");
    expect(enviarGrupoALixeira(state, "mem_thiago", "grp_avisos_ff").ok).toBe(true);
    expect(grupo("grp_avisos_ff").lifecycle).toBe("naLixeira");
  });

  it("25, 12.1 → 12.2 — nascer vinculado exige o que vincular exige: Comunidade inacessível recusa o Grupo novo", () => {
    unwrap(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, { entendiIrreversivel: true }));
    const r = criarGrupo(state, "mem_julia", { nome: "Turma #05", canalId: "chn_wpp", comunidadeId: COMUNIDADE_ALUNOS_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/inacessível/);
  });

  it("RN-COM-04 — ninguém é adicionado ao avisos diretamente; RN-COM-06 — membros contados uma vez", () => {
    expect(adicionarParticipantes(state, "mem_julia", "grp_avisos_ff", { contactIds: ["cnt_20"] }).ok).toBe(false);
    unwrap(adicionarParticipantes(state, "mem_julia", "grp_turma_02", { contactIds: ["cnt_16"] }));
    const membros = membrosDaComunidade(state, COMUNIDADE_ALUNOS_ID);
    expect(membros.filter((id) => id === "cnt_16")).toHaveLength(1);
    const avisos = grupoDeAvisos(state, COMUNIDADE_ALUNOS_ID) as Grupo;
    expect(membrosDoGrupo(avisos).filter((p) => p.contactId === "cnt_16")).toHaveLength(1);
  });

  it("RN-COM-05 — enviar à Comunidade é enviar ao Grupo de avisos, com Registro na Comunidade", () => {
    const r = unwrap(enviarMensagemAComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID, { content: "Aviso geral" }));
    expect(r.grupoDeAvisos.id).toBe("grp_avisos_ff");
    expect(r.conversa.id).toBe("cnv_grp_avisos");
    expect(state.activity.find((a) => a.action === "Mensagem enviada à Comunidade" && a.objectId === COMUNIDADE_ALUNOS_ID && a.detail?.includes("Aviso geral"))).toBeTruthy();
    expect(state.activity.find((a) => a.action === "Mensagem enviada ao Grupo" && a.objectId === "grp_avisos_ff" && a.detail?.includes("Aviso geral"))).toBeTruthy();
  });

  it("Comunidade na lixeira — enviar à Comunidade recusa pela Comunidade, mesmo com o Grupo de avisos ativo (INV-COM-01)", () => {
    unwrap(enviarComunidadeALixeira(state, "mem_thiago", COMUNIDADE_ALUNOS_ID));
    expect(grupo("grp_avisos_ff").lifecycle).toBe("ativo");
    const r = enviarMensagemAComunidade(state, "mem_julia", COMUNIDADE_ALUNOS_ID, { content: "Oi" });
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
    expect(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID).ok).toBe(false);
    unwrap(sairDaComunidade(state, "mem_thiago", COMUNIDADE_ALUNOS_ID, { entendiIrreversivel: true }));
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
    const r = unwrap(publicarVersao(state, "mem_thiago", f.id, { notas: "Agora com o WhatsApp da clínica." }));
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
    const falha = publicarVersao(state, "mem_thiago", f.id);
    expect(falha.ok).toBe(false);
    expect(state.activity.find((a) => a.action === "Validação falhou" && a.objectId === f.id)?.result).toBe("failed");
    expect(versaoPublicada(f)?.numero).toBe(2);
    // publicar exige administrar
    expect(publicarVersao(state, "mem_julia", f.id).ok).toBe(false);
  });

  it("RN-FLW-03 / RN-FLW-05 — descartar o único rascunho é recusado; criar rascunho a partir de uma obsoleta traz a Proveniência", () => {
    const f = flow();
    unwrap(descartarRascunho(state, "mem_thiago", f.id));
    expect(versaoCorrente(f)).toBeUndefined();
    const novo = unwrap(criarRascunhoAPartirDe(state, "mem_thiago", f.id, "vfl_triagem_1"));
    expect(novo.numero).toBe(2);
    expect(novo.proveniencia?.numero).toBe(1);
    expect(criarRascunhoAPartirDe(state, "mem_thiago", f.id, "vfl_triagem_1").ok).toBe(false);
    const solto = unwrap(criarFlow(state, "mem_julia", { nome: "Pesquisa", categoria: "pesquisa", canalId: "chn_wpp" }));
    expect(solto.versoes).toHaveLength(1);
    expect(descartarRascunho(state, "mem_julia", solto.id).ok).toBe(false);
    expect(validarVersao(solto, solto.versoes[0] as VersaoDeFlow, state.files)).toEqual([]);
  });

  it("INV-FLW-02 / RN-FLW-01 / RN-FLW-13 — enviar leva a publicada dentro da Mensagem; despublicado, arquivado ou outro Canal recusam", () => {
    const f = flow();
    const cnv = state.conversations.find((c) => c.id === "cnv_5");
    const r = unwrap(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "Me conta sobre você?", rotuloDoBotao: "Responder" }));
    expect(r.mensagem.flow).toMatchObject({ flowId: f.id, versaoId: "vfl_triagem_1", numeroDaVersao: 1, rotuloDoBotao: "Responder", telaInicial: "perfil" });
    expect(r.mensagem.attachments[0]?.mediaType).toBe("flow");
    expect(cnv?.messages.at(-1)?.id).toBe(r.mensagem.id);
    expect(metricasDoFlow(state, f.id).envios).toBe(5);
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_2", corpo: "x" }).ok).toBe(false);
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_grp_avisos", corpo: "x" }).ok).toBe(false);
    unwrap(despublicarFlow(state, "mem_thiago", f.id));
    const semPublicada = enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "x" });
    expect(semPublicada.ok).toBe(false);
    if (!semPublicada.ok) expect(semPublicada.error).toMatch(/publicada/);
    unwrap(publicarVersao(state, "mem_thiago", f.id));
    unwrap(arquivarFlow(state, "mem_thiago", f.id));
    expect(enviarFlow(state, "mem_julia", { flowId: f.id, conversationId: "cnv_5", corpo: "x" }).ok).toBe(false);
    expect(publicarVersao(state, "mem_thiago", f.id).ok).toBe(false);
  });

  it("DO-FLW-02 / 20.1 / 20.5 — a Resposta entra como Mensagem recebida na Conversa 1:1; obsoleta aceita; Nome estranho marca não conforme; métricas por Versão", () => {
    const f = flow();
    const antes = metricasDoFlow(state, f.id);
    expect(antes).toEqual({ envios: 4, respostas: 3, taxa: 0.75 });
    const r = unwrap(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_17", valores: { formacao: "dentista", cidade: "Osasco", aceite: true } }));
    expect(r.mensagem.direction).toBe("recebida");
    expect(r.mensagem.respostaDeFlow?.naoConforme).toBeUndefined();
    expect(r.conversa.id).toBe("cnv_17");
    expect(metricasDoFlow(state, f.id)).toEqual({ envios: 4, respostas: 4, taxa: 1 });
    unwrap(publicarVersao(state, "mem_thiago", f.id));
    const obsoleta = unwrap(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_5", versaoId: "vfl_triagem_1", valores: { formacao: "medico", cidade: "x", aceite: true, inventado: 1 } }));
    expect(obsoleta.mensagem.respostaDeFlow?.numeroDaVersao).toBe(1);
    expect(obsoleta.mensagem.respostaDeFlow?.naoConforme).toBe(true);
    expect(metricasDoFlow(state, f.id, "vfl_triagem_1").respostas).toBe(5);
    expect(receberRespostaDeFlow(state, { flowId: f.id, contactId: "cnt_5", versaoId: rascunho().id, valores: {} }).ok).toBe(false);
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
    const g = criarGrupo(state, "mem_julia", { nome: "Turma Realce", canalId: "chn_wpp", participantesIniciaisContactIds: ["cnt_22"] });
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.id).toBe(g.value.id);
    const m = enviarMensagemAoGrupo(state, "mem_julia", g.value.id, { content: "Acendeu?" });
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.id).toBe(m.value.mensagem.id);
  });
});
