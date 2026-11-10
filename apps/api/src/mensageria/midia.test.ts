/**
 * A entrada de mídia (16-10, 3.9.4, D-16-08), sem banco: o provedor é o de teste (em memória) e o armazenamento é o
 * falso. Prova que a mídia que não pode ser guardada (grande demais, de tipo fora da lista, com assinatura que não
 * bate, que o provedor não tem mais ou que falhou na rede) deixa o anexo `baixado: false` com o nome e a referência do
 * provedor, nunca derruba o recebimento, e diz se vale tentar de novo (`algumTransitorio`).
 */

import { describe, expect, it } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { ErroDeProvedor, type CanalParaProvedor, type ProvedorDeMensageria } from "./provedor";
import { criarProvedorDeTeste } from "./provedores/teste";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { criarGuardaDeMidia } from "./midia";

const MIB = 1024 * 1024;
const WS = "ws_midia_teste";
const canal = { workspaceId: WS, canal: { id: "canal-1", conexaoSimulada: true } as unknown as Canal } satisfies CanalParaProvedor;

function ogg(bytes: number): Uint8Array {
  const conteudo = new Uint8Array(bytes);
  conteudo.set(Buffer.from("OggS"));
  return conteudo;
}

const ascii = (texto: string) => Uint8Array.from(Buffer.from(texto, "ascii"));

/** Um .docx mínimo, mas de verdade para a conferência: o diretório central fica DEPOIS de 8 KiB de dados (nos últimos bytes). */
function docxGrande(): Uint8Array {
  const u16 = (n: number) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) => Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
  const juntar = (...partes: Uint8Array[]) => {
    const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of partes) {
      saida.set(p, i);
      i += p.length;
    }
    return saida;
  };
  const nomes = ["[Content_Types].xml", "word/document.xml"];
  const locais = nomes.map((nome) => juntar(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(nome.length), u16(0), ascii(nome)));
  const enchimento = new Uint8Array(8 * 1024);
  const inicioDoDiretorio = locais.reduce((n, l) => n + l.length, 0) + enchimento.length;
  const centrais = nomes.map((nome) =>
    juntar(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(nome.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), ascii(nome)),
  );
  const diretorio = juntar(...centrais);
  return juntar(...locais, enchimento, diretorio, juntar(u32(0x06054b50), u16(0), u16(0), u16(nomes.length), u16(nomes.length), u32(diretorio.length), u32(inicioDoDiretorio), u16(0)));
}

function cenario(opcoes: { baixarMidia?: ProvedorDeMensageria["baixarMidia"] } = {}) {
  const provedor = criarProvedorDeTeste();
  const armazenamento = criarArmazenamentoFalso();
  const chamadas: string[] = [];
  const comEspia: ProvedorDeMensageria = {
    ...provedor,
    baixarMidia: async (c, referencia, o) => {
      chamadas.push(referencia);
      return (opcoes.baixarMidia ?? provedor.baixarMidia)(c, referencia, o);
    },
  };
  const guarda = criarGuardaDeMidia({ armazenamento });
  return { provedor, armazenamento, chamadas, guardar: (anexos: Parameters<typeof guarda.guardarAnexosRecebidos>[0]["anexos"]) => guarda.guardarAnexosRecebidos({ workspaceId: WS, canal, provedor: comEspia, anexos }) };
}

describe("guardarAnexosRecebidos — a mídia que chega (16-10, D-16-08)", () => {
  it("guarda o áudio em entrada/ do Canal, com o tipo normalizado, o tamanho e baixado: true", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r1", { bytes: ogg(4096), tipoDeMidia: "audio/ogg; codecs=opus" });
    const r = await c.guardar([{ referenciaNoProvedor: "r1", tipoDeMidia: "Audio/OGG; codecs=opus", nome: "audio.ogg" }]);
    expect(r.algumTransitorio).toBe(false);
    expect(r.anexos).toEqual([
      { tipoDeMidia: "audio/ogg", nome: "audio.ogg", objectKey: expect.stringMatching(new RegExp(`^workspace/${WS}/entrada/canal-1/[0-9a-f-]{36}$`)), tamanhoBytes: 4096, baixado: true },
    ]);
    expect(c.armazenamento.chavesGuardadas()).toEqual([r.anexos[0]!.objectKey]);
    expect(r.baixarMs).toBeGreaterThanOrEqual(0);
    expect(r.subirMs).toBeGreaterThanOrEqual(0);
  });

  it("um vídeo de 17 MiB passa do teto de 16 MiB: baixado: false com a referência do provedor, sem subir nada", async () => {
    const c = cenario();
    const video = new Uint8Array(17 * MIB);
    video.set(Buffer.from("\u0000\u0000\u0000 ftypisom", "latin1"));
    c.provedor.guardarMidia("r-video", { bytes: video, tipoDeMidia: "video/mp4" });
    const r = await c.guardar([{ referenciaNoProvedor: "r-video", tipoDeMidia: "video/mp4", nome: "filme.mp4" }]);
    expect(r.anexos).toEqual([{ tipoDeMidia: "video/mp4", nome: "filme.mp4", referenciaExterna: "r-video", baixado: false }]);
    expect(r.algumTransitorio).toBe(false);
    expect(c.armazenamento.chavesGuardadas()).toEqual([]);
  });

  it("um texto declarado audio/ogg (a assinatura não bate) fica baixado: false e nada sobe", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r-falso", { bytes: ascii("isto é só um texto"), tipoDeMidia: "audio/ogg" });
    const r = await c.guardar([{ referenciaNoProvedor: "r-falso", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }]);
    expect(r.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "r-falso", baixado: false }]);
    expect(r.algumTransitorio).toBe(false);
    expect(c.armazenamento.chavesGuardadas()).toEqual([]);
  });

  it("audio/webm está fora da lista: baixado: false sem nem pedir a mídia ao provedor", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r-webm", { bytes: ogg(100), tipoDeMidia: "audio/webm" });
    const r = await c.guardar([{ referenciaNoProvedor: "r-webm", tipoDeMidia: "audio/webm", nome: "voz.webm" }]);
    expect(r.anexos).toEqual([{ tipoDeMidia: "audio/webm", nome: "voz.webm", referenciaExterna: "r-webm", baixado: false }]);
    expect(r.algumTransitorio).toBe(false);
    expect(c.chamadas).toEqual([]);
  });

  it("o provedor devolve um tipo fora da lista (declarou image/png e entregou audio/webm): baixado: false", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r-troca", { bytes: ogg(100), tipoDeMidia: "audio/webm" });
    const r = await c.guardar([{ referenciaNoProvedor: "r-troca", tipoDeMidia: "image/png", nome: "foto.png" }]);
    expect(r.anexos[0]).toMatchObject({ baixado: false, referenciaExterna: "r-troca" });
    expect(c.armazenamento.chavesGuardadas()).toEqual([]);
  });

  it("erro de rede no download: baixado: false e algumTransitorio: true (vale tentar de novo)", async () => {
    const c = cenario({
      baixarMidia: async () => {
        throw new Error("read ECONNRESET");
      },
    });
    const r = await c.guardar([{ referenciaNoProvedor: "r1", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }]);
    expect(r.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "r1", baixado: false }]);
    expect(r.algumTransitorio).toBe(true);
  });

  it("PROVEDOR_INDISPONIVEL no download também é transitório", async () => {
    const c = cenario({
      baixarMidia: async () => {
        throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL");
      },
    });
    const r = await c.guardar([{ referenciaNoProvedor: "r1", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }]);
    expect(r.algumTransitorio).toBe(true);
  });

  it("MIDIA_INDISPONIVEL (o provedor já esqueceu a mídia): baixado: false e algumTransitorio: false", async () => {
    const c = cenario();
    const r = await c.guardar([{ referenciaNoProvedor: "nunca-existiu", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }]);
    expect(r.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "nunca-existiu", baixado: false }]);
    expect(r.algumTransitorio).toBe(false);
  });

  it("o bucket fora do ar no upload é transitório: baixado: false e algumTransitorio: true", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r1", { bytes: ogg(512), tipoDeMidia: "audio/ogg" });
    c.armazenamento.falharNaProxima(new Error("storage fora do ar"));
    const r = await c.guardar([{ referenciaNoProvedor: "r1", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }]);
    expect(r.anexos[0]).toMatchObject({ baixado: false, referenciaExterna: "r1" });
    expect(r.algumTransitorio).toBe(true);
    expect(c.armazenamento.chavesGuardadas()).toEqual([]);
  });

  it("um documento do Office guardado é conferido pelo conteúdo INTEIRO (o diretório central fica depois dos primeiros 4 KiB)", async () => {
    const c = cenario();
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    c.provedor.guardarMidia("r-doc", { bytes: docxGrande(), tipoDeMidia: docx });
    const r = await c.guardar([{ referenciaNoProvedor: "r-doc", tipoDeMidia: docx, nome: "contrato.docx" }]);
    expect(r.anexos[0]).toMatchObject({ tipoDeMidia: docx, baixado: true, tamanhoBytes: docxGrande().length });
  });

  it("dois anexos: um bom e um perdido; cada um tem o seu resultado, na ordem, e só o transitório pede nova passada", async () => {
    const c = cenario();
    c.provedor.guardarMidia("r-bom", { bytes: ogg(300), tipoDeMidia: "audio/ogg" });
    const r = await c.guardar([
      { referenciaNoProvedor: "r-bom", tipoDeMidia: "audio/ogg", nome: "a.ogg" },
      { referenciaNoProvedor: "r-perdido", tipoDeMidia: "audio/ogg", nome: "b.ogg" },
    ]);
    expect(r.anexos.map((a) => a.baixado)).toEqual([true, false]);
    expect(r.algumTransitorio).toBe(false);
  });
});
