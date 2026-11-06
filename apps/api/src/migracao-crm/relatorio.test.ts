/**
 * O relatório do `--seco` é texto puro sobre ids, contagens e nomes de configuração (T-15-67):
 * sem banco, sem Docker.
 */

import { describe, expect, it } from "vitest";
import type { NaoMigrado } from "./nao-migrados";
import { type EntradaDoRelatorio, montarRelatorio, montarResumoDeEscrita } from "./relatorio";

const NOVE = ["contacts", "companies", "contactCompanyLinks", "companyCompanyLinks", "distinctFromLinks", "funnels", "deals", "channels", "conversations"];

function entradaBase(sobre: Partial<EntradaDoRelatorio> = {}): EntradaDoRelatorio {
  return {
    espaco: "ws_n1",
    noRegistros: NOVE.map((colecao) => ({ colecao, linhas: colecao === "funnels" ? 1 : 0 })),
    conversasDeGrupo: 0,
    jaGuardadas: [],
    funis: [
      {
        id: "fnl_padrao",
        nome: "Padrão",
        estado: "ativo",
        privado: false,
        etapas: [
          { nome: "Novo", ordem: 1, probabilidade: 0 },
          { nome: "Proposta", ordem: 2, probabilidade: 60 },
        ],
        referencias: [{ colecao: "automations", quantidade: 2 }],
        destino: { tipo: "migra", padrao: true },
      },
    ],
    funisNoCrmNovo: { total: 0, temPadrao: false },
    pasta: { existe: false, nome: undefined, listas: [], removivel: false },
    ...sobre,
  };
}

describe("montarRelatorio (--seco)", () => {
  it("diz que nada foi escrito e lista o Espaço, a contagem por coleção, o Funil com as Etapas e o que aponta para ele", () => {
    const texto = montarRelatorio(entradaBase());
    expect(texto).toContain("ws_n1");
    expect(texto).toMatch(/nada foi escrito/i);
    for (const colecao of NOVE) expect(texto, colecao).toContain(colecao);
    expect(texto).toContain('fnl_padrao');
    expect(texto).toContain("Padrão");
    expect(texto).toMatch(/Novo/);
    expect(texto).toMatch(/Proposta.*60/);
    expect(texto).toMatch(/automations\s*:?\s*2/);
  });

  it("mostra o que cada decisão do Funil faria", () => {
    const texto = montarRelatorio(entradaBase());
    expect(texto).toContain("--funil=migrar");
    expect(texto).toContain("--funil=guardar");
    expect(texto).toMatch(/Funil padrão/i);
  });

  it("diz 'nome em uso' para o Funil que não migra", () => {
    const texto = montarRelatorio(
      entradaBase({
        funis: [
          {
            id: "fnl_repetido",
            nome: "Vendas",
            estado: "ativo",
            privado: false,
            etapas: [{ nome: "Novo", ordem: 1, probabilidade: 0 }],
            referencias: [],
            destino: { tipo: "nao-migra", motivo: "nome em uso" },
          },
        ],
      }),
    );
    expect(texto).toContain("nome em uso");
  });

  it("conta a Conversa de Grupo que fica em registros", () => {
    const texto = montarRelatorio(
      entradaBase({ noRegistros: NOVE.map((colecao) => ({ colecao, linhas: colecao === "conversations" ? 3 : 0 })), conversasDeGrupo: 2 }),
    );
    expect(texto).toMatch(/2 .*Grupo/);
  });

  it("Pasta com as Listas vazias: diz que sai", () => {
    const texto = montarRelatorio(
      entradaBase({
        pasta: { existe: true, nome: "Meus negócios", listas: [{ id: "lst_a", nome: "SDR", tarefas: 0 }], removivel: true },
      }),
    );
    expect(texto).toContain("Meus negócios");
    expect(texto).toMatch(/sai|removid/i);
  });

  it("Pasta com Tarefa: lista a Lista e a contagem e diz que nada da Pasta sai", () => {
    const texto = montarRelatorio(
      entradaBase({
        pasta: {
          existe: true,
          nome: "Meus negócios",
          listas: [
            { id: "lst_a", nome: "SDR", tarefas: 3 },
            { id: "lst_b", nome: "Closer", tarefas: 0 },
          ],
          removivel: false,
        },
      }),
    );
    expect(texto).toContain("SDR");
    expect(texto).toMatch(/SDR[^\n]*3/);
    expect(texto).toMatch(/nada da Pasta/i);
  });

  it("não imprime campo pessoal, nem o que o JSON do Contato, da Conversa ou da Mensagem trouxer (T-15-67)", () => {
    const comPessoal = {
      ...entradaBase(),
      firstName: "Pessoa",
      lastName: "Sintetica Um",
      identifiers: [{ type: "whatsapp", value: "+550000000001" }],
      messages: [{ text: "Texto sintetico de mensagem" }],
      noRegistros: NOVE.map((colecao) => ({ colecao, linhas: 1, firstName: "Pessoa", messages: ["Texto sintetico de mensagem"] })),
    } as unknown as EntradaDoRelatorio;
    const texto = montarRelatorio(comPessoal);
    for (const proibido of ["Pessoa", "Sintetica", "+550000000001", "Texto sintetico", "firstName", "identifiers"]) {
      expect(texto, proibido).not.toContain(proibido);
    }
  });
});

describe("a seção \"Não migrados\" (15-28 Task 2)", () => {
  const item = (categoria: NaoMigrado["categoria"], colecao: string, id: string): NaoMigrado => ({ categoria, colecao, id });

  it("lista cada categoria com a contagem e os ids, e diz que continuam em registros_crm_antigo", () => {
    const texto = montarRelatorio(
      entradaBase({
        entidades: {
          porTabela: { contatos: 39, empresas: 11 },
          naoMigrados: [
            item("temperatura", "contacts", "cnt_1"),
            item("temperatura", "contacts", "cnt_2"),
            item("empresa-sem-admin", "companies", "cmp_9"),
            item("canal-sem-destino", "channels", "chn_site"),
          ],
        },
      }),
    );

    expect(texto).toMatch(/Não migrados/);
    expect(texto).toMatch(/registros_crm_antigo/);
    expect(texto).toMatch(/Temperatura[^\n]*: 2/);
    expect(texto).toContain("contacts:cnt_1");
    expect(texto).toContain("contacts:cnt_2");
    expect(texto).toMatch(/Empresa sem vínculo admin[^\n]*: 1/);
    expect(texto).toContain("companies:cmp_9");
    expect(texto).toContain("channels:chn_site");
  });

  it("mostra quantas linhas entram em cada tabela nova", () => {
    const texto = montarRelatorio(entradaBase({ entidades: { porTabela: { contatos: 39, mensagens: 66 }, naoMigrados: [] } }));

    expect(texto).toMatch(/contatos\s+39/);
    expect(texto).toMatch(/mensagens\s+66/);
    expect(texto).toMatch(/nenhum item/i);
  });

  it("corta a lista de ids de uma categoria grande e diz quantos faltam", () => {
    const muitos = Array.from({ length: 30 }, (_, i) => item("tags", "contacts", `cnt_${i}`));

    const texto = montarRelatorio(entradaBase({ entidades: { porTabela: {}, naoMigrados: muitos } }));

    expect(texto).toContain("contacts:cnt_0");
    expect(texto).not.toContain("contacts:cnt_29");
    expect(texto).toMatch(/e mais 10/);
  });

  it("o resumo de uma escrita também traz as contagens migradas e o não migrado", () => {
    const texto = montarResumoDeEscrita({
      espaco: "ws_n1",
      modo: "migrar",
      nadaAFazer: false,
      copiadas: 10,
      apagadas: { contacts: 2 },
      conversasDeGrupo: 0,
      funis: { migrados: 0, etapas: 0, naoMigrados: [] },
      pasta: { existe: false, nome: undefined, listas: [], removivel: false },
      entidades: { porTabela: { contatos: 2, contato_identificadores: 3 }, naoMigrados: [item("identificador-sem-destino", "contacts", "cnt_1")] },
    });

    expect(texto).toMatch(/contatos\s+2/);
    expect(texto).toMatch(/Não migrados/);
    expect(texto).toContain("contacts:cnt_1");
  });

  it("nada pessoal: só coleção e id, mesmo que o item traga outros campos (T-15-67)", () => {
    const comPessoal = { categoria: "tags", colecao: "contacts", id: "cnt_1", firstName: "Pessoa", value: "+550000000001" } as unknown as NaoMigrado;

    const texto = montarRelatorio(entradaBase({ entidades: { porTabela: {}, naoMigrados: [comPessoal] } }));

    expect(texto).not.toContain("Pessoa");
    expect(texto).not.toContain("+550000000001");
  });
});
