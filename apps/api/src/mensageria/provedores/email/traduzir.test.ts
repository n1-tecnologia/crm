/**
 * O e-mail lido como corpo da fila (Fase 17, 17-08, D-17-10 a D-17-13, D-17-18), sem banco: a guarda de mídia é a da
 * Fase 16 com o armazenamento falso. Prova o que NÃO vira Conversa (robô, aviso de não entrega, lista, o próprio Canal),
 * os limites do corpo (50 MiB, texto, `References`, destinatários, arquivos), que o corpo nunca leva MIME cru, HTML nem
 * base64, e que arquivo fora da lista ou com tipo forjado fica `baixado: false` sem subir nada ao bucket (T-17-31).
 *
 * Os `.eml` de `exemplos/` e os montados aqui são sintéticos: só `example.*` e `.test`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { criarArmazenamentoFalso } from "../../../testes/armazenamento-falso";
import { criarGuardaDeMidia } from "../../midia";
import type { CanalParaProvedor } from "../../provedor";
import {
  chaveDoCorpo,
  corpoIgnorado,
  eventosDoCorpo,
  MAX_TEXTO_NO_CORPO,
  prepararEmailRecebido,
  TETO_DO_EMAIL_RECEBIDO_BYTES,
  type CorpoDoEmail,
} from "./traduzir";

// O parser real, com um espião para provar que o e-mail enorme nem chega nele.
const espiao = vi.hoisted(() => ({ chamadas: 0 }));
vi.mock("mailparser", async (original) => {
  const real = await original<typeof import("mailparser")>();
  return {
    ...real,
    simpleParser: (...args: Parameters<typeof real.simpleParser>) => {
      espiao.chamadas += 1;
      return real.simpleParser(...args);
    },
  };
});

const WS = "ws_traduzir_teste";
const ENDERECO_DO_CANAL = "vendas@caixa.test";
const UID_VALIDITY = "4294967296";
const MIB = 1024 * 1024;

const canal: CanalParaProvedor = {
  workspaceId: WS,
  canal: { id: "canal-1", identificadorExterno: ENDERECO_DO_CANAL, conexaoSimulada: false } as unknown as Canal,
};

const eml = (nome: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "exemplos", nome)));
const texto = (e: string): Uint8Array => new Uint8Array(Buffer.from(e, "utf8"));

function cenario() {
  const armazenamento = criarArmazenamentoFalso();
  const guarda = criarGuardaDeMidia({ armazenamento });
  return { armazenamento, guarda };
}

async function preparar(bytes: Uint8Array, extras: { uid?: number; recebidoEm?: string; armazenamento?: ReturnType<typeof criarArmazenamentoFalso> } = {}) {
  const c = cenario();
  const armazenamento = extras.armazenamento ?? c.armazenamento;
  const guarda = extras.armazenamento ? criarGuardaDeMidia({ armazenamento }) : c.guarda;
  const preparado = await prepararEmailRecebido({
    bytes,
    uid: extras.uid ?? 3,
    uidValidity: UID_VALIDITY,
    recebidoEm: extras.recebidoEm,
    workspaceId: WS,
    canal,
    guarda,
    armazenamento,
  });
  return { ...preparado, armazenamento };
}

function lido(corpo: CorpoDoEmail) {
  if (!("de" in corpo)) throw new Error(`esperava um e-mail interpretado, veio ignorado: ${"ignorado" in corpo ? corpo.ignorado : "?"}`);
  return corpo;
}

/** Um e-mail de texto simples montado a mão. */
function montar(cabecalhos: readonly string[], corpo = "Olá, tudo bem?"): Uint8Array {
  return texto(
    [
      "Message-ID: <montado@empresa.example>",
      "Date: Wed, 19 Nov 2026 10:00:00 -0300",
      "From: Cliente <cliente@empresa.example>",
      `To: ${ENDERECO_DO_CANAL}`,
      "Subject: Montado",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      ...cabecalhos,
      "",
      corpo,
      "",
    ].join("\n"),
  );
}

/** Um e-mail multipart com um arquivo anexo qualquer (base64). */
function comArquivo(tipo: string, nome: string, conteudo: Buffer, extras: readonly string[] = []): Uint8Array {
  return texto(
    [
      "Message-ID: <com-arquivo@empresa.example>",
      "Date: Wed, 19 Nov 2026 10:00:00 -0300",
      "From: Cliente <cliente@empresa.example>",
      `To: ${ENDERECO_DO_CANAL}`,
      "Subject: Com arquivo",
      "MIME-Version: 1.0",
      ...extras,
      'Content-Type: multipart/mixed; boundary="mix"',
      "",
      "--mix",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Segue o arquivo.",
      "--mix",
      `Content-Type: ${tipo}; name="${nome}"`,
      `Content-Disposition: attachment; filename="${nome}"`,
      "Content-Transfer-Encoding: base64",
      "",
      conteudo.toString("base64").replace(/(.{76})/g, "$1\n"),
      "--mix--",
      "",
    ].join("\n"),
  );
}

describe("o que não vira Conversa (D-17-11)", () => {
  it("resposta automática, aviso de não entrega e lista entram na fila como `ignorado:<motivo>` e traduzem em `ignorado`", async () => {
    for (const [arquivo, motivo] of [
      ["resposta-automatica.eml", "resposta_automatica"],
      ["nao-entrega.eml", "nao_entrega"],
      ["lista.eml", "lista"],
    ] as const) {
      const r = await preparar(eml(arquivo));
      expect(r.corpo).toMatchObject({ v: 1, ignorado: motivo, uid: 3, uidValidity: UID_VALIDITY });
      expect("de" in r.corpo).toBe(false);
      expect(r.algumTransitorio).toBe(false);
      // Registrado com a chave do Message-ID: o leitor avança o cursor e o e-mail não volta.
      expect(r.chave).toMatch(/@/);
      expect(chaveDoCorpo(r.corpo)).toBe(r.chave);
      expect(eventosDoCorpo(r.corpo, ENDERECO_DO_CANAL)).toEqual([{ tipo: "ignorado", motivo, idExterno: r.chave }]);
      // Nada foi guardado no bucket por um e-mail que não vira Conversa.
      expect(r.armazenamento.chavesGuardadas()).toEqual([]);
    }
  });

  it("um e-mail cujo From é o próprio Canal vira `proprio_canal`", async () => {
    const bytes = texto(["Message-ID: <eco@caixa.test>", "From: Vendas <VENDAS@caixa.test>", "To: cliente@empresa.example", "Subject: Eco", "", "oi", ""].join("\n"));
    const r = await preparar(bytes);
    expect(r.corpo).toMatchObject({ v: 1, ignorado: "proprio_canal" });
    expect(eventosDoCorpo(r.corpo, ENDERECO_DO_CANAL)[0]).toMatchObject({ tipo: "ignorado", motivo: "proprio_canal" });
  });

  it("um e-mail comum com List-Unsubscribe (sem Precedence) entra como mensagem, com `lista: true`", async () => {
    const r = await preparar(montar(["List-Unsubscribe: <mailto:sair@boletim.example>"]));
    const corpo = lido(r.corpo);
    expect(corpo.lista).toBe(true);
    const evento = eventosDoCorpo(corpo, ENDERECO_DO_CANAL)[0];
    expect(evento).toMatchObject({ tipo: "mensagem", cargaBruta: { lista: true } });
  });

  it("Authentication-Results vai só à cargaBruta, sem bloquear nada", async () => {
    const r = await preparar(montar(["Authentication-Results: mx.caixa.test; dkim=pass header.d=empresa.example"]));
    const corpo = lido(r.corpo);
    expect(corpo.autenticacao).toContain("dkim=pass");
    const evento = eventosDoCorpo(corpo, ENDERECO_DO_CANAL)[0];
    expect(evento).toMatchObject({ tipo: "mensagem", cargaBruta: { autenticacao: expect.stringContaining("dkim=pass") } });
  });
});

describe("o fio e a chave", () => {
  it("In-Reply-To e References viram ids limpos, nessa ordem, e o evento responde ao primeiro In-Reply-To", async () => {
    const r = await preparar(eml("resposta.eml"));
    const corpo = lido(r.corpo);
    expect(corpo.inReplyTo).toEqual(["a@x.example"]);
    expect(corpo.references).toEqual(["r1@x.example", "r2@x.example", "a@x.example"]);
    expect(r.chave).toBe("resposta-1@empresa.example");
    // Texto simples: sem HTML no bucket e sem anexo.
    expect(corpo.corpoHtml).toBeUndefined();
    const evento = eventosDoCorpo(corpo, ENDERECO_DO_CANAL)[0];
    expect(evento).toMatchObject({
      tipo: "mensagem",
      emRespostaAIdExterno: "a@x.example",
      referencias: ["r1@x.example", "r2@x.example", "a@x.example"],
      assunto: "Re: Pedido 42",
      conteudo: expect.stringContaining("confirmar o prazo"),
    });
  });

  it("sem Message-ID a chave é `sem-id:` e é a mesma para os mesmos bytes", async () => {
    const a = await preparar(eml("sem-message-id.eml"));
    const b = await preparar(eml("sem-message-id.eml"), { uid: 99 });
    expect(a.chave).toMatch(/^sem-id:[0-9a-f]{64}$/);
    expect(b.chave).toBe(a.chave);
    expect(lido(a.corpo).messageId).toBe(a.chave);
    // Bytes diferentes (outro assunto) são outra chave.
    const outro = await preparar(texto(Buffer.from(eml("sem-message-id.eml")).toString("utf8").replace("Sem identificador", "Outro assunto")));
    expect(outro.chave).not.toBe(a.chave);
  });

  it("o `criadoEm` é o INTERNALDATE do IMAP, com o cabeçalho Date como reserva", async () => {
    const comInterna = await preparar(eml("resposta.eml"), { recebidoEm: "2026-11-19T15:30:00.000Z" });
    expect(lido(comInterna.corpo).data).toBe("2026-11-19T15:30:00.000Z");
    const semInterna = await preparar(eml("resposta.eml"));
    expect(lido(semInterna.corpo).data).toBe("2026-11-19T14:00:00.000Z");
  });

  it("a remetente é o endereço do From e o nome do cabeçalho vai em nomeExibido", async () => {
    const r = await preparar(eml("resposta.eml"));
    const evento = eventosDoCorpo(r.corpo, ENDERECO_DO_CANAL)[0];
    expect(evento).toMatchObject({ remetente: { tipo: "email", valor: "cliente@empresa.example", nomeExibido: "Cliente" } });
  });
});

describe("os limites do corpo da fila (T-17-30)", () => {
  it("bytes acima de 50 MiB viram `grande_demais` sem chamar o parser", async () => {
    const antes = espiao.chamadas;
    const enorme = new Uint8Array(TETO_DO_EMAIL_RECEBIDO_BYTES + 1);
    const r = await preparar(enorme);
    expect(r.corpo).toMatchObject({ v: 1, ignorado: "grande_demais", uid: 3, uidValidity: UID_VALIDITY });
    expect(espiao.chamadas).toBe(antes);
    expect(r.chave).toMatch(/^sem-id:/);
    expect(chaveDoCorpo(r.corpo)).toBe(r.chave);
    expect(eventosDoCorpo(r.corpo, ENDERECO_DO_CANAL)[0]).toMatchObject({ tipo: "ignorado", motivo: "grande_demais" });
  });

  it("o texto de 250 000 caracteres é cortado em 200 000, marcado `truncado`, e o inteiro vai como texto-completo.txt", async () => {
    const linha = "x".repeat(99);
    const inteiro = Array.from({ length: 2525 }, () => linha).join("\n");
    expect(inteiro.length).toBeGreaterThan(250_000);
    const r = await preparar(montar([], inteiro));
    const corpo = lido(r.corpo);
    expect(corpo.texto).toHaveLength(MAX_TEXTO_NO_CORPO);
    expect(corpo.truncado).toBe(true);
    const completo = corpo.anexos.find((a) => a.nome === "texto-completo.txt");
    expect(completo).toMatchObject({ tipoDeMidia: "text/plain", baixado: true });
    const guardado = Buffer.from(await r.armazenamento.baixar(completo!.objectKey!, { tetoBytes: 10 * MIB })).toString("utf8");
    expect(guardado.length).toBeGreaterThan(MAX_TEXTO_NO_CORPO);
    expect(guardado.startsWith(linha)).toBe(true);
  });

  it("60 ids em References ficam 50 (os últimos) e 150 destinatários em To ficam 100", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `<r${i + 1}@x.example>`);
    const para = Array.from({ length: 150 }, (_, i) => `p${i + 1}@empresa.example`);
    const bytes = texto(
      [
        "Message-ID: <muitos@empresa.example>",
        "Date: Wed, 19 Nov 2026 10:00:00 -0300",
        "From: cliente@empresa.example",
        `To: ${para.join(",\n ")}`,
        `References: ${ids.join("\n ")}`,
        "Subject: Muitos",
        "",
        "oi",
        "",
      ].join("\n"),
    );
    const corpo = lido((await preparar(bytes)).corpo);
    expect(corpo.references).toHaveLength(50);
    expect(corpo.references[0]).toBe("r11@x.example");
    expect(corpo.references.at(-1)).toBe("r60@x.example");
    expect(corpo.para).toHaveLength(100);
    expect(corpo.para[0]?.endereco).toBe("p1@empresa.example");
  });

  it("mais de 50 arquivos: os 50 primeiros passam pela guarda e os outros ficam `baixado: false` com nome e tipo", async () => {
    const partes = Array.from({ length: 55 }, (_, i) =>
      [
        "--mix",
        `Content-Type: text/plain; name="a${i + 1}.txt"`,
        `Content-Disposition: attachment; filename="a${i + 1}.txt"`,
        "",
        `arquivo ${i + 1}`,
      ].join("\n"),
    );
    const bytes = texto(
      [
        "Message-ID: <muitos-arquivos@empresa.example>",
        "Date: Wed, 19 Nov 2026 10:00:00 -0300",
        "From: cliente@empresa.example",
        `To: ${ENDERECO_DO_CANAL}`,
        "Subject: Arquivos",
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="mix"',
        "",
        "--mix",
        "Content-Type: text/plain",
        "",
        "Vários arquivos.",
        ...partes,
        "--mix--",
        "",
      ].join("\n"),
    );
    const corpo = lido((await preparar(bytes)).corpo);
    expect(corpo.anexos).toHaveLength(55);
    expect(corpo.anexos.slice(0, 50).every((a) => a.baixado)).toBe(true);
    expect(corpo.anexos.slice(50).every((a) => !a.baixado)).toBe(true);
    expect(corpo.anexos[54]).toMatchObject({ nome: "a55.txt", tipoDeMidia: "text/plain", referenciaExterna: `${UID_VALIDITY}:3:54` });
  });
});

describe("o corpo nunca leva MIME cru, HTML nem base64 (T-17-33)", () => {
  it("o JSON do corpo não tem o HTML nem o base64 do PDF, e o corpo é o interpretado", async () => {
    const r = await preparar(eml("com-anexo.eml"));
    const json = JSON.stringify(r.corpo);
    expect(json).not.toContain("<b>pedido 42</b>");
    expect(json).not.toContain("<html");
    expect(json).not.toContain("JVBERi0x");
    expect(json).not.toContain("multipart/");
    expect(json).not.toContain("Content-Type");
    expect(lido(r.corpo).texto).toContain("pedido 42");
  });
});

describe("corpoIgnorado e a forma do corpo", () => {
  it("corpoIgnorado leva só o motivo, a posição e o id", () => {
    expect(corpoIgnorado("lista", { messageId: "a@x", uid: 4, uidValidity: "9" })).toEqual({ v: 1, ignorado: "lista", messageId: "a@x", uid: 4, uidValidity: "9" });
    expect(corpoIgnorado("lista", { uid: 4, uidValidity: "9" })).toEqual({ v: 1, ignorado: "lista", uid: 4, uidValidity: "9" });
  });

  it("um e-mail sem texto, sem assunto, sem arquivo e sem HTML não vira Mensagem: fica `ignorado:sem_conteudo`", () => {
    const corpo = { v: 1, messageId: "vazio@x", uid: 1, uidValidity: "1", data: "2026-11-19T10:00:00.000Z", de: { endereco: "a@example.test" }, para: [], cc: [], inReplyTo: [], references: [], anexos: [] };
    expect(eventosDoCorpo(corpo, ENDERECO_DO_CANAL)).toEqual([{ tipo: "ignorado", motivo: "sem_conteudo", idExterno: "vazio@x" }]);
  });

  it("endereço torto em Para não derruba a Mensagem: só deixa de entrar nas cópias", () => {
    const corpo = {
      v: 1,
      messageId: "torto@x",
      uid: 1,
      uidValidity: "1",
      data: "2026-11-19T10:00:00.000Z",
      de: { endereco: "a@example.test" },
      para: [{ endereco: "sem-arroba" }, { endereco: "Vendas@Caixa.Test" }, { endereco: "ok@example.test", nome: "Ok" }],
      cc: [],
      inReplyTo: [],
      references: [],
      texto: "oi",
      anexos: [],
    };
    expect(eventosDoCorpo(corpo, ENDERECO_DO_CANAL)[0]).toMatchObject({ enderecosAdicionais: [{ tipo: "para", endereco: "ok@example.test", nomeExibido: "Ok" }] });
  });

  it("MIME que o parser recusa vira `ignorado:ilegivel`, nunca exceção", async () => {
    // Sem remetente: não há quem seja o Contato.
    const r = await preparar(texto(["Message-ID: <sem-from@x.example>", "Subject: Sem remetente", "", "oi", ""].join("\n")));
    expect(r.corpo).toMatchObject({ v: 1, ignorado: "ilegivel" });
  });
});
