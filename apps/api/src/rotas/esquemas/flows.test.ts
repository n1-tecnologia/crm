/**
 * `esquemas/flows.ts` — testes puros, sem banco, sem `buildApp`: só a FORMA
 * dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as formas
 * hostis que motivaram CR-02 caem (Tipo de Componente fora do catálogo,
 * Ação/Condição malformadas, `moverComponente` com as duas formas juntas,
 * chave desconhecida); (2) as formas LITERAIS que `apps/web` manda hoje
 * continuam passando, incluindo `publicarVersao` sem argumento (o `= {}` da
 * assinatura).
 */

import { describe, expect, it } from "vitest";
import { FLOWS } from "./flows";

const viaJson = (args: unknown[]): unknown[] => JSON.parse(JSON.stringify(args)) as unknown[];

describe("esquemas/flows — a forma dos args de ferramentas/flows.ts", () => {
  it("(a) cobertura — as 26 chaves de ferramentas/flows.ts em registro.ts", () => {
    const esperadas = [
      "criarFlow",
      "editarFlow",
      "definirPontoDeTrocaDeDados",
      "regenerarChavesDoPonto",
      "removerPontoDeTrocaDeDados",
      "adicionarTela",
      "editarTela",
      "reordenarTela",
      "duplicarTela",
      "removerTela",
      "adicionarComponente",
      "editarComponente",
      "moverComponente",
      "duplicarComponente",
      "removerComponente",
      "publicarVersao",
      "despublicarFlow",
      "descartarRascunho",
      "criarRascunhoAPartirDe",
      "copiarFlow",
      "arquivarFlow",
      "restaurarFlow",
      "enviarFlowALixeira",
      "restaurarFlowDaLixeira",
      "sincronizarFlow",
      "enviarFlow",
    ].sort();
    expect(Object.keys(FLOWS).sort()).toEqual(esperadas);
  });

  it("(b) formas literais do web passam — Flow, Ponto de troca de dados, Telas", () => {
    expect(FLOWS.criarFlow.safeParse(viaJson([{ nome: "F", categoria: "pesquisa" }])).success).toBe(true);
    expect(FLOWS.criarFlow.safeParse(viaJson([{ nome: "F", descricao: "d", categoria: "agendamento", canalId: "cnl_1" }])).success).toBe(true);
    expect(FLOWS.editarFlow.safeParse(viaJson(["flw_1", { nome: "F2" }])).success).toBe(true);
    expect(FLOWS.editarFlow.safeParse(viaJson(["flw_1", { canalId: null }])).success).toBe(true);
    expect(FLOWS.editarFlow.safeParse(viaJson(["flw_1", { categoria: "outro", canalId: "cnl_2" }])).success).toBe(true);
    expect(FLOWS.definirPontoDeTrocaDeDados.safeParse(viaJson(["flw_1", "https://exemplo.com"])).success).toBe(true);
    expect(FLOWS.regenerarChavesDoPonto.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.removerPontoDeTrocaDeDados.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.adicionarTela.safeParse(viaJson(["flw_1", { identificador: "dados", titulo: "Dados" }])).success).toBe(true);
    expect(FLOWS.adicionarTela.safeParse(viaJson(["flw_1", { identificador: "fim", titulo: "Fim", terminal: true }])).success).toBe(true);
    expect(
      FLOWS.editarTela.safeParse(
        viaJson(["flw_1", "tel_1", { identificador: "dados2", titulo: "Dados 2", terminal: false, dados: [{ nome: "idade", tipo: "numero", exemplo: "30" }] }]),
      ).success,
    ).toBe(true);
    expect(FLOWS.reordenarTela.safeParse(viaJson(["flw_1", "tel_1", "subir"])).success).toBe(true);
    expect(FLOWS.duplicarTela.safeParse(viaJson(["flw_1", "tel_1"])).success).toBe(true);
    expect(FLOWS.removerTela.safeParse(viaJson(["flw_1", "tel_1"])).success).toBe(true);
  });

  it("(c) formas literais do web passam — Componentes", () => {
    expect(FLOWS.adicionarComponente.safeParse(viaJson(["flw_1", "tel_1", { tipo: "campoDeTexto" }])).success).toBe(true);
    expect(FLOWS.adicionarComponente.safeParse(viaJson(["flw_1", "tel_1", { tipo: "campoDeTexto", paiId: "cmp_1" }])).success).toBe(true);
    expect(
      FLOWS.editarComponente.safeParse(
        viaJson([
          "flw_1",
          "tel_1",
          "cmp_1",
          {
            nome: "idade",
            propriedades: { rotulo: "Idade", obrigatorio: true, tipoDeEntrada: "numero", opcoes: [{ id: "opcao_1", titulo: "Sim", acao: { tipo: "navegar", telaDeDestino: "fim" } }] },
            acao: { tipo: "concluir" },
            condicao: { variavel: "idade", operador: "maior", valor: "18" },
          },
        ]),
      ).success,
    ).toBe(true);
    expect(FLOWS.editarComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { acao: null, condicao: null }])).success).toBe(true);
    expect(FLOWS.moverComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { direcao: "descer" }])).success).toBe(true);
    expect(FLOWS.moverComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { paraDentroDe: "cmp_2" }])).success).toBe(true);
    expect(FLOWS.moverComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { paraDentroDe: null }])).success).toBe(true);
    expect(FLOWS.duplicarComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1"])).success).toBe(true);
    expect(FLOWS.removerComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1"])).success).toBe(true);
  });

  it("(d) formas literais do web passam — Versões e ciclo de vida", () => {
    expect(FLOWS.publicarVersao.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.publicarVersao.safeParse(viaJson(["flw_1", { notas: "v2" }])).success).toBe(true);
    expect(FLOWS.publicarVersao.safeParse(viaJson(["flw_1", null])).success).toBe(true);
    expect(FLOWS.despublicarFlow.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.descartarRascunho.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.criarRascunhoAPartirDe.safeParse(viaJson(["flw_1", "vfl_1"])).success).toBe(true);
    expect(FLOWS.copiarFlow.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.arquivarFlow.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.restaurarFlow.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.enviarFlowALixeira.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.restaurarFlowDaLixeira.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.sincronizarFlow.safeParse(viaJson(["flw_1"])).success).toBe(true);
    expect(FLOWS.enviarFlow.safeParse(viaJson([{ flowId: "flw_1", conversationId: "cnv_1", corpo: "Preencha o formulário" }])).success).toBe(true);
    expect(
      FLOWS.enviarFlow.safeParse(
        viaJson([
          {
            flowId: "flw_1",
            conversationId: "cnv_1",
            corpo: "Preencha",
            rotuloDoBotao: "Abrir",
            cabecalho: "Cabeçalho",
            rodape: "Rodapé",
            telaInicial: "inicio",
            dadosIniciais: { nome: "Ana" },
            templateProviderId: "tpl_1",
            actor: { kind: "agent", id: "agt_1" },
            delegate: { kind: "member", id: "mem_1" },
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it("(e) formas hostis caem", () => {
    expect(FLOWS.criarFlow.safeParse(viaJson([{ nome: "F", categoria: "roleta" }])).success).toBe(false);
    expect(FLOWS.criarFlow.safeParse(viaJson([{ categoria: "outro" }])).success).toBe(false);
    expect(FLOWS.criarFlow.safeParse(viaJson([{ nome: "F", categoria: "outro", lixo: 1 }])).success).toBe(false);
    expect(FLOWS.adicionarComponente.safeParse(viaJson(["flw_1", "tel_1", { tipo: "botaoMagico" }])).success).toBe(false);
    expect(
      FLOWS.editarComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { propriedades: { tipoDeEntrada: "biometria" } }])).success,
    ).toBe(false);
    expect(FLOWS.editarComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { condicao: { operador: "quase" } }])).success).toBe(false);
    // `moverComponente`: as duas formas juntas não são a união — `.strict()`
    // em cada ramo barra a chave da outra forma.
    expect(FLOWS.moverComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { direcao: "subir", paraDentroDe: "cmp_2" }])).success).toBe(false);
    expect(FLOWS.moverComponente.safeParse(viaJson(["flw_1", "tel_1", "cmp_1", { direcao: "lateral" }])).success).toBe(false);
    expect(FLOWS.publicarVersao.safeParse(viaJson(["flw_1", { notas: 1 }])).success).toBe(false);
    expect(FLOWS.enviarFlow.safeParse(viaJson([{ flowId: "flw_1", conversationId: "cnv_1" }])).success).toBe(false);
    expect(FLOWS.enviarFlow.safeParse(viaJson([{ flowId: "flw_1", conversationId: "cnv_1", corpo: "x", actor: { kind: "robo", id: "x" } }])).success).toBe(false);
    expect(FLOWS.reordenarTela.safeParse(viaJson(["flw_1", "tel_1", "lateral"])).success).toBe(false);
    expect(FLOWS.editarTela.safeParse(viaJson(["flw_1", "tel_1", { dados: [{ nome: "x", tipo: "cor" }] }])).success).toBe(false);
  });
});
