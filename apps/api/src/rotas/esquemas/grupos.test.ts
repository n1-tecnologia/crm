/**
 * `esquemas/grupos.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA
 * dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as formas
 * hostis que motivaram CR-02 caem (chave desconhecida, tipo errado,
 * `Captacao.estado` fora do catálogo); (2) as formas LITERAIS que `apps/web`
 * manda hoje continuam passando, incluindo `sairDoGrupo` e
 * `recusarPedidoDeEntrada` sem o argumento opcional final.
 */

import { describe, expect, it } from "vitest";
import { GRUPOS } from "./grupos";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/grupos — a forma dos args de ferramentas/grupos.ts", () => {
  it("(a) cobertura — as 22 chaves de ferramentas/grupos.ts em registro.ts", () => {
    const esperadas = [
      "criarGrupo",
      "importarGruposDoCanal",
      "sincronizarGrupo",
      "editarGrupo",
      "definirCanalDoGrupo",
      "editarCaptacaoDoGrupo",
      "ativarCaptacao",
      "inativarCaptacao",
      "zerarCliques",
      "regenerarLinkDeConvite",
      "adicionarParticipantes",
      "removerParticipante",
      "promoverParticipante",
      "rebaixarParticipante",
      "sairDoGrupo",
      "arquivarGrupo",
      "restaurarGrupo",
      "enviarGrupoALixeira",
      "restaurarGrupoDaLixeira",
      "aprovarPedidoDeEntrada",
      "recusarPedidoDeEntrada",
      "enviarMensagemAoGrupo",
    ].sort();
    expect(Object.keys(GRUPOS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    expect(GRUPOS.criarGrupo.safeParse(viaJson([{ nome: "G", canalId: "cnl_1" }])).success).toBe(true);
    expect(
      GRUPOS.criarGrupo.safeParse(
        viaJson([
          {
            nome: "G",
            descricao: "d",
            canalId: "cnl_1",
            configuracoes: { somenteAdministradoresEnviam: true },
            participantesIniciaisContactIds: ["cnt_1"],
            administradoresContactIds: ["cnt_1"],
            comunidadeId: "com_1",
            captacao: { estado: "ativa", limiteDeCliques: 10 },
          },
        ]),
      ).success,
    ).toBe(true);
    expect(GRUPOS.importarGruposDoCanal.safeParse(viaJson(["cnl_1"])).success).toBe(true);
    expect(GRUPOS.sincronizarGrupo.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.editarGrupo.safeParse(viaJson(["grp_1", { nome: "G2" }])).success).toBe(true);
    expect(GRUPOS.definirCanalDoGrupo.safeParse(viaJson(["grp_1", "cnl_2"])).success).toBe(true);
    expect(GRUPOS.editarCaptacaoDoGrupo.safeParse(viaJson(["grp_1", { estado: "inativa" }])).success).toBe(true);
    expect(GRUPOS.editarCaptacaoDoGrupo.safeParse(viaJson(["grp_1", {}])).success).toBe(true);
    expect(GRUPOS.ativarCaptacao.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.inativarCaptacao.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.zerarCliques.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.regenerarLinkDeConvite.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.adicionarParticipantes.safeParse(viaJson(["grp_1", { contactIds: ["cnt_1", "cnt_2"] }])).success).toBe(true);
    expect(
      GRUPOS.adicionarParticipantes.safeParse(viaJson(["grp_1", { contactIds: ["cnt_1"], comoAdministrador: true }])).success,
    ).toBe(true);
    expect(GRUPOS.removerParticipante.safeParse(viaJson(["grp_1", "ptc_1"])).success).toBe(true);
    expect(GRUPOS.promoverParticipante.safeParse(viaJson(["grp_1", "ptc_1"])).success).toBe(true);
    expect(GRUPOS.rebaixarParticipante.safeParse(viaJson(["grp_1", "ptc_1"])).success).toBe(true);
    expect(GRUPOS.sairDoGrupo.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.sairDoGrupo.safeParse(viaJson(["grp_1", { entendiIrreversivel: true }])).success).toBe(true);
    expect(GRUPOS.arquivarGrupo.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.restaurarGrupo.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.enviarGrupoALixeira.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.restaurarGrupoDaLixeira.safeParse(viaJson(["grp_1"])).success).toBe(true);
    expect(GRUPOS.aprovarPedidoDeEntrada.safeParse(viaJson(["grp_1", "ped_1"])).success).toBe(true);
    expect(GRUPOS.recusarPedidoDeEntrada.safeParse(viaJson(["grp_1", "ped_1"])).success).toBe(true);
    expect(GRUPOS.recusarPedidoDeEntrada.safeParse(viaJson(["grp_1", "ped_1", "mot_1"])).success).toBe(true);
    expect(GRUPOS.enviarMensagemAoGrupo.safeParse(viaJson(["grp_1", { content: "oi" }])).success).toBe(true);
    expect(
      GRUPOS.enviarMensagemAoGrupo.safeParse(
        viaJson(["grp_1", { content: "oi", templateProviderId: "tpl_1", actor: { kind: "agent", id: "agt_1" }, delegate: { kind: "member", id: "mem_1" } }]),
      ).success,
    ).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(GRUPOS.criarGrupo.safeParse(viaJson([{ canalId: "cnl_1" }])).success).toBe(false);
    expect(GRUPOS.criarGrupo.safeParse(viaJson([{ nome: "G", canalId: "cnl_1", captacao: { estado: "pendente" } }])).success).toBe(false);
    expect(GRUPOS.criarGrupo.safeParse(viaJson([{ nome: "G", canalId: "cnl_1", lixo: 1 }])).success).toBe(false);
    expect(GRUPOS.editarGrupo.safeParse(viaJson(["grp_1", { titulo: "x" }])).success).toBe(false);
    expect(GRUPOS.editarCaptacaoDoGrupo.safeParse(viaJson(["grp_1"])).success).toBe(false);
    expect(GRUPOS.adicionarParticipantes.safeParse(viaJson(["grp_1", { contactIds: "cnt_1" }])).success).toBe(false);
    expect(GRUPOS.enviarMensagemAoGrupo.safeParse(viaJson(["grp_1", { content: 1 }])).success).toBe(false);
    expect(GRUPOS.enviarMensagemAoGrupo.safeParse(viaJson(["grp_1", { content: "oi", actor: { kind: "robo", id: "x" } }])).success).toBe(false);
    expect(GRUPOS.sairDoGrupo.safeParse(viaJson(["grp_1", { entendiIrreversivel: "sim" }])).success).toBe(false);
    expect(GRUPOS.recusarPedidoDeEntrada.safeParse(viaJson(["grp_1"])).success).toBe(false);
  });
});
