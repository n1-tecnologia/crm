/**
 * Abas por Canal e Canal de resposta do fio, lidos das TABELAS do CRM novo
 * (15-20, 3.4.2). São as regras de `derive-conversacional` (D-13, D-14, D-15)
 * portadas para `Canal`, `IdentificadorDeContato` e `ConversaNaLista`, que as
 * funções recebem como argumento: nenhuma lê `DataState`.
 *
 * O cenário é o mesmo dos testes antigos: dois WhatsApps oficiais, um não
 * oficial, um desligado, e um Contato que só tem WhatsApp.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Canal } from "./canais";
import {
  ORDEM_DOS_TIPOS_NAS_TABELAS,
  canaisDeRespostaNasTabelas,
  canaisDoFioNasTabelas,
  canaisQueAlcancamNasTabelas,
  canalDaAbaInicialNasTabelas,
  canalPadraoDeRespostaNasTabelas,
  canalPadraoDoTipoNasTabelas,
  rotuloDoCanalNasTabelas,
  textoDoSeparadorNasTabelas,
  type ConversaParaOFio,
} from "./canais-de-resposta";
import type { IdentificadorDeContato } from "./contatos";

function canal(id: string, nome: string, provedor: Canal["provedor"], conexao: Canal["conexao"], criadoEm: string, extras: Partial<Canal> = {}): Canal {
  const tipo = provedor === "instagram-graph" ? "instagram" : provedor === "email-imap-smtp" ? "email" : "whatsapp";
  return {
    id,
    nome,
    tipo,
    provedor,
    identificadorExterno: `+5511${id.length}${nome.length}0000000`,
    conexao,
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_a",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_a",
    criadoEm,
    atualizadoEm: criadoEm,
    ...extras,
  };
}

function identificador(tipo: IdentificadorDeContato["tipo"]): IdentificadorDeContato {
  return {
    id: `ident_${tipo}`,
    contatoId: "ctt_1",
    tipo,
    valor: tipo === "email" ? "ana@exemplo.com" : "+5511999990000",
    valorExibido: null,
    rotuloCanal: null,
    verificado: false,
    principal: true,
    criadoEm: "2026-01-01T00:00:00.000Z",
  };
}

function conversa(canalId: string, extras: Partial<ConversaParaOFio> = {}): ConversaParaOFio {
  return { canalId, estado: "ativo", ultimaRecebidaEm: null, atualizadoEm: "2026-10-01T00:00:00.000Z", ...extras };
}

const SO_WHATSAPP = [identificador("whatsapp")];

let canais: Canal[];

function mudar(id: string, extras: Partial<Canal>): void {
  canais = canais.map((c) => (c.id === id ? { ...c, ...extras } : c));
}

/** O cenário do plano: a recebida mais recente de todas está em "Suporte". */
const conversasComSuporteComoUltimaRecebida = (): ConversaParaOFio[] => [
  conversa("k_wpp", { ultimaRecebidaEm: "2026-10-09T10:00:00.000Z", atualizadoEm: "2026-10-12T08:00:00.000Z" }),
  conversa("k_comercial", { ultimaRecebidaEm: "2026-10-10T10:00:00.000Z", atualizadoEm: "2026-10-10T10:00:00.000Z" }),
  conversa("k_suporte", { ultimaRecebidaEm: "2026-10-11T09:00:00.000Z", atualizadoEm: "2026-10-11T09:00:00.000Z" }),
];

beforeEach(() => {
  canais = [
    canal("k_wpp", "Comercial SP", "whatsapp-cloud", "conectada", "2026-01-01T08:00:00.000Z"),
    canal("k_comercial", "Comercial", "whatsapp-cloud", "conectada", "2026-01-01T09:00:00.000Z"),
    canal("k_suporte", "Suporte", "whatsapp-nao-oficial", "conectada", "2026-01-02T09:00:00.000Z"),
    canal("k_desligado", "Desligado", "whatsapp-nao-oficial", "desconectada", "2026-01-03T09:00:00.000Z"),
    canal("k_mail", "Caixa", "email-imap-smtp", "conectada", "2026-01-04T09:00:00.000Z"),
    canal("k_insta", "Perfil", "instagram-graph", "conectada", "2026-01-05T09:00:00.000Z"),
  ];
});

describe("canaisDoFioNasTabelas (D-14: uma aba por Canal)", () => {
  it("traz todos os Canais ativos: WhatsApp pela criação, depois Instagram e E-mail", () => {
    expect(canaisDoFioNasTabelas(canais, SO_WHATSAPP).map((c) => c.canal.id)).toEqual([
      "k_wpp",
      "k_comercial",
      "k_suporte",
      "k_desligado",
      "k_insta",
      "k_mail",
    ]);
  });

  it("os de WhatsApp alcançam o Contato; o de e-mail e o de Instagram não", () => {
    const alcance = new Map(canaisDoFioNasTabelas(canais, SO_WHATSAPP).map((c) => [c.canal.id, c.alcancavel]));
    expect(alcance.get("k_wpp")).toBe(true);
    expect(alcance.get("k_comercial")).toBe(true);
    expect(alcance.get("k_suporte")).toBe(true);
    expect(alcance.get("k_desligado")).toBe(true);
    expect(alcance.get("k_mail")).toBe(false);
    expect(alcance.get("k_insta")).toBe(false);
  });

  it("o Identificador de e-mail faz a aba do E-mail alcançar", () => {
    const alcance = new Map(canaisDoFioNasTabelas(canais, [identificador("email")]).map((c) => [c.canal.id, c.alcancavel]));
    expect(alcance.get("k_mail")).toBe(true);
    expect(alcance.get("k_wpp")).toBe(false);
  });

  it("telefone não é WhatsApp: um Contato só com telefone não alcança nenhum Canal", () => {
    expect(canaisDoFioNasTabelas(canais, [identificador("telefone")]).every((c) => !c.alcancavel)).toBe(true);
  });

  it("um Canal arquivado não aparece", () => {
    mudar("k_suporte", { estado: "arquivado" });
    expect(canaisDoFioNasTabelas(canais, SO_WHATSAPP).map((c) => c.canal.id)).not.toContain("k_suporte");
  });

  it("a ordem é do tipo, depois da criação, depois do id", () => {
    canais = [...canais, canal("k_a_empate", "Empate", "whatsapp-cloud", "conectada", "2026-01-02T09:00:00.000Z")];
    const ids = canaisDoFioNasTabelas(canais, SO_WHATSAPP).map((c) => c.canal.id);
    expect(ids.indexOf("k_a_empate")).toBe(ids.indexOf("k_suporte") - 1);
    expect(ORDEM_DOS_TIPOS_NAS_TABELAS).toEqual(["whatsapp", "instagram", "email"]);
  });

  it("sem Identificadores informados (Contato ainda não lido), todos os Canais ativos alcançam", () => {
    expect(canaisDoFioNasTabelas(canais, undefined).every((c) => c.alcancavel)).toBe(true);
  });

  it("não muda a lista recebida", () => {
    const antes = canais.map((c) => c.id);
    canaisDoFioNasTabelas(canais, SO_WHATSAPP);
    expect(canais.map((c) => c.id)).toEqual(antes);
  });
});

describe("canaisQueAlcancamNasTabelas", () => {
  it("só os ativos que resolvem algum Identificador do Contato", () => {
    expect(canaisQueAlcancamNasTabelas(canais, SO_WHATSAPP).map((c) => c.id)).toEqual(["k_wpp", "k_comercial", "k_suporte", "k_desligado"]);
  });

  it("sem Identificadores informados, todos os Canais ativos", () => {
    expect(canaisQueAlcancamNasTabelas(canais, undefined)).toHaveLength(6);
  });
});

describe("canaisDeRespostaNasTabelas (D-15: só os conectados que alcançam)", () => {
  it("traz Comercial SP, Comercial e Suporte; não o desconectado nem o de e-mail", () => {
    expect(canaisDeRespostaNasTabelas(canais, SO_WHATSAPP).map((c) => c.id)).toEqual(["k_wpp", "k_comercial", "k_suporte"]);
  });

  it("um Canal com erro de conexão não recebe resposta nova", () => {
    mudar("k_comercial", { conexao: "com_erro" });
    expect(canaisDeRespostaNasTabelas(canais, SO_WHATSAPP).map((c) => c.id)).toEqual(["k_wpp", "k_suporte"]);
  });
});

describe("canalPadraoDeRespostaNasTabelas (D-15)", () => {
  it("o padrão de resposta é o Canal da última recebida", () => {
    expect(canalPadraoDeRespostaNasTabelas(canais, SO_WHATSAPP, conversasComSuporteComoUltimaRecebida())).toBe("k_suporte");
  });

  it("se o Canal da última recebida não serve, cai no primeiro Canal de resposta do mesmo tipo", () => {
    mudar("k_suporte", { conexao: "desconectada" });
    expect(canalPadraoDeRespostaNasTabelas(canais, SO_WHATSAPP, conversasComSuporteComoUltimaRecebida())).toBe("k_wpp");
  });

  it("sem nenhuma recebida, é o primeiro Canal de resposta", () => {
    expect(canalPadraoDeRespostaNasTabelas(canais, SO_WHATSAPP, [conversa("k_wpp", { atualizadoEm: "2026-10-12T08:00:00.000Z" })])).toBe("k_wpp");
  });

  it("sem nenhum Canal que sirva, é undefined", () => {
    canais = canais.map((c) => ({ ...c, conexao: "desconectada" }));
    expect(canalPadraoDeRespostaNasTabelas(canais, SO_WHATSAPP, [])).toBeUndefined();
  });

  it("uma Conversa na lixeira não conta como a última recebida", () => {
    const conversas = conversasComSuporteComoUltimaRecebida().map((c) => (c.canalId === "k_suporte" ? { ...c, estado: "na_lixeira" as const } : c));
    expect(canalPadraoDeRespostaNasTabelas(canais, SO_WHATSAPP, conversas)).toBe("k_comercial");
  });
});

describe("canalDaAbaInicialNasTabelas (D-14)", () => {
  it("é o Canal da Conversa mais recente: a última recebida ou a última mexida, a que for depois", () => {
    expect(canalDaAbaInicialNasTabelas(canais, SO_WHATSAPP, conversasComSuporteComoUltimaRecebida())).toBe("k_wpp");
  });

  it("sem Conversa, é o primeiro Canal alcançável", () => {
    expect(canalDaAbaInicialNasTabelas(canais, SO_WHATSAPP, [])).toBe("k_wpp");
  });

  it("uma Conversa de Canal que o Contato não alcança não decide a aba", () => {
    expect(canalDaAbaInicialNasTabelas(canais, SO_WHATSAPP, [conversa("k_mail", { atualizadoEm: "2026-12-01T00:00:00.000Z" })])).toBe("k_wpp");
  });

  it("sem nenhum Canal alcançável, é undefined", () => {
    expect(canalDaAbaInicialNasTabelas(canais, [], [])).toBeUndefined();
  });
});

describe("canalPadraoDoTipoNasTabelas", () => {
  it("whatsapp é o Canal da última recebida; e-mail, que o Contato não alcança, é undefined", () => {
    const conversas = conversasComSuporteComoUltimaRecebida();
    expect(canalPadraoDoTipoNasTabelas(canais, SO_WHATSAPP, conversas, "whatsapp")).toBe("k_suporte");
    expect(canalPadraoDoTipoNasTabelas(canais, SO_WHATSAPP, conversas, "email")).toBeUndefined();
  });

  it("sem recebida no tipo, é o primeiro Canal de resposta do tipo", () => {
    expect(canalPadraoDoTipoNasTabelas(canais, SO_WHATSAPP, [], "whatsapp")).toBe("k_wpp");
  });
});

describe("rotuloDoCanalNasTabelas e textoDoSeparadorNasTabelas (D-13)", () => {
  const achar = (id: string): Canal => {
    const c = canais.find((x) => x.id === id);
    if (!c) throw new Error(`fixture: ${id}`);
    return c;
  };

  it("o rótulo junta o nome e o provedor", () => {
    expect(rotuloDoCanalNasTabelas(achar("k_comercial"))).toBe("Comercial · WhatsApp oficial");
    expect(rotuloDoCanalNasTabelas(achar("k_suporte"))).toBe("Suporte · WhatsApp não oficial");
    expect(rotuloDoCanalNasTabelas(achar("k_mail"))).toBe("Caixa · E-mail");
  });

  it("o separador diz por qual Canal a Mensagem passou", () => {
    expect(textoDoSeparadorNasTabelas(achar("k_suporte"))).toBe("via Suporte (WhatsApp não oficial)");
  });
});
