/**
 * `esquemas/comunidades.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (chave desconhecida, tipo errado,
 * `entendiIrreversivel` fora de booleano); (2) as formas LITERAIS que
 * `apps/web` manda hoje continuam passando, incluindo `sairDaComunidade`
 * sem argumento (o `= {}` da assinatura).
 */

import { describe, expect, it } from "vitest";
import { COMUNIDADES } from "./comunidades";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/comunidades — a forma dos args de ferramentas/comunidades.ts", () => {
  it("(a) cobertura — as 12 chaves de ferramentas/comunidades.ts em registro.ts", () => {
    const esperadas = [
      "criarComunidade",
      "sincronizarComunidade",
      "editarComunidade",
      "alterarConfiguracoesDaComunidade",
      "vincularGrupoAComunidade",
      "desvincularGrupoDaComunidade",
      "enviarMensagemAComunidade",
      "sairDaComunidade",
      "arquivarComunidade",
      "restaurarComunidade",
      "enviarComunidadeALixeira",
      "restaurarComunidadeDaLixeira",
    ].sort();
    expect(Object.keys(COMUNIDADES).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam", () => {
    expect(COMUNIDADES.criarComunidade.safeParse(viaJson([{ nome: "C", canalId: "cnl_1" }])).success).toBe(true);
    expect(
      COMUNIDADES.criarComunidade.safeParse(
        viaJson([{ nome: "C", descricao: "d", canalId: "cnl_1", configuracoes: { somenteAdministradoresAdicionamGrupos: false } }]),
      ).success,
    ).toBe(true);
    expect(COMUNIDADES.sincronizarComunidade.safeParse(viaJson(["com_1"])).success).toBe(true);
    expect(COMUNIDADES.editarComunidade.safeParse(viaJson(["com_1", { nome: "C2" }])).success).toBe(true);
    expect(
      COMUNIDADES.alterarConfiguracoesDaComunidade.safeParse(
        viaJson(["com_1", { somenteAdministradoresAdicionamGrupos: true, somenteAdministradoresAdicionamParticipantes: false }]),
      ).success,
    ).toBe(true);
    expect(COMUNIDADES.vincularGrupoAComunidade.safeParse(viaJson(["com_1", "grp_1"])).success).toBe(true);
    expect(COMUNIDADES.desvincularGrupoDaComunidade.safeParse(viaJson(["com_1", "grp_1"])).success).toBe(true);
    expect(COMUNIDADES.enviarMensagemAComunidade.safeParse(viaJson(["com_1", { content: "oi" }])).success).toBe(true);
    expect(COMUNIDADES.sairDaComunidade.safeParse(viaJson(["com_1"])).success).toBe(true);
    expect(COMUNIDADES.sairDaComunidade.safeParse(viaJson(["com_1", { entendiIrreversivel: true }])).success).toBe(true);
    expect(COMUNIDADES.sairDaComunidade.safeParse(viaJson(["com_1", null])).success).toBe(true);
    expect(COMUNIDADES.arquivarComunidade.safeParse(viaJson(["com_1"])).success).toBe(true);
    expect(COMUNIDADES.restaurarComunidade.safeParse(viaJson(["com_1"])).success).toBe(true);
    expect(COMUNIDADES.enviarComunidadeALixeira.safeParse(viaJson(["com_1"])).success).toBe(true);
    expect(COMUNIDADES.restaurarComunidadeDaLixeira.safeParse(viaJson(["com_1"])).success).toBe(true);
  });

  it("(c) formas hostis caem", () => {
    expect(COMUNIDADES.criarComunidade.safeParse(viaJson([{ canalId: "cnl_1" }])).success).toBe(false);
    expect(COMUNIDADES.criarComunidade.safeParse(viaJson([{ nome: "C", canalId: "cnl_1", lixo: 1 }])).success).toBe(false);
    expect(COMUNIDADES.editarComunidade.safeParse(viaJson(["com_1", { titulo: "x" }])).success).toBe(false);
    expect(COMUNIDADES.alterarConfiguracoesDaComunidade.safeParse(viaJson(["com_1", {}])).success).toBe(true);
    expect(COMUNIDADES.alterarConfiguracoesDaComunidade.safeParse(viaJson(["com_1"])).success).toBe(false);
    expect(COMUNIDADES.enviarMensagemAComunidade.safeParse(viaJson(["com_1", { content: 1 }])).success).toBe(false);
    expect(COMUNIDADES.sairDaComunidade.safeParse(viaJson(["com_1", { entendiIrreversivel: "sim" }])).success).toBe(false);
    expect(COMUNIDADES.sincronizarComunidade.safeParse(viaJson([])).success).toBe(false);
  });
});
