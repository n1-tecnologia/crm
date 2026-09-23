import { describe, expect, it } from "vitest";
import { chaveDeChegada, formaDe } from "./rotas";

describe("rotas — a família da tela", () => {
  it("reconhece cada família pelo prefixo", () => {
    expect(formaDe("/")).toBe("inicio");
    expect(formaDe("/crm/caixa-de-entrada")).toBe("caixa");
    expect(formaDe("/crm/caixa-de-entrada/cnv_5")).toBe("caixa");
    expect(formaDe("/crm/caixa-de-entrada/configuracoes/filas")).toBe("tabela");
    expect(formaDe("/estrutura/listas/lst_1")).toBe("lista");
    expect(formaDe("/crm/negocios")).toBe("quadro");
    expect(formaDe("/crm/negocios/deal_1")).toBe("registro");
    expect(formaDe("/crm/contatos/cnt_1")).toBe("registro");
    expect(formaDe("/estrutura/tarefas/tsk_1")).toBe("registro");
    expect(formaDe("/minha-conta")).toBe("registro");
    expect(formaDe("/paineis/pnl_1")).toBe("painel");
    expect(formaDe("/paineis")).toBe("tabela");
    expect(formaDe("/f/segredo")).toBe("formulario");
    expect(formaDe("/crm/contatos")).toBe("tabela");
    expect(formaDe("/ferramentas/grupos")).toBe("tabela");
    expect(formaDe("/financeiro")).toBe("painel");
    expect(formaDe("/financeiro/extratos")).toBe("formulario");
    expect(formaDe("/financeiro/notas-fiscais")).toBe("tabela");
    expect(formaDe("/financeiro/plano-contas")).toBe("tabela");
    expect(formaDe("/financeiro/aprovacoes-pendentes")).toBe("tabela");
  });
});

describe("rotas — a chave de chegada", () => {
  it("colapsa o detalhe da Caixa de Entrada na coluna persistente", () => {
    expect(chaveDeChegada("/crm/caixa-de-entrada/cnv_5")).toBe("/crm/caixa-de-entrada");
    expect(chaveDeChegada("/crm/caixa-de-entrada")).toBe("/crm/caixa-de-entrada");
  });

  it("não colapsa as configurações da Caixa nem qualquer outra rota", () => {
    expect(chaveDeChegada("/crm/caixa-de-entrada/configuracoes")).toBe("/crm/caixa-de-entrada/configuracoes");
    expect(chaveDeChegada("/crm/caixa-de-entrada/configuracoes/filas")).toBe("/crm/caixa-de-entrada/configuracoes/filas");
    expect(chaveDeChegada("/crm/contatos/cnt_1")).toBe("/crm/contatos/cnt_1");
    expect(chaveDeChegada("/")).toBe("/");
    // Prova de que nada colapsa: /financeiro/* não é mestre-detalhe.
    expect(chaveDeChegada("/financeiro/notas-fiscais")).toBe("/financeiro/notas-fiscais");
  });
});
