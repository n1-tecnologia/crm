/**
 * A fumaça do WhatsApp oficial (Sessão 7) contra um servidor falso no lugar da Meta: cada passo, cada falha e, acima de tudo, que a
 * saída nunca leva o token, os IDs nem o número de telefone inteiro. NÃO é prova contra a Meta real: é o teste da ferramenta que
 * vai fazer essa prova.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarClienteDaCloudApi } from "../mensageria/provedores/whatsapp-cloud/cliente";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  configuracaoDaFumaca,
  descreverFumacaOficial,
  lerEntradaDaFumaca,
  rodarFumacaDoWhatsAppOficial,
  type EntradaDaFumacaOficial,
} from "./whatsapp-oficial-fumaca";

const TOKEN = "EAAG-token-secreto-que-nunca-sai-na-saida-1234567890";
const FONE = "109876543210001";
const WABA = "100200300400500";
const NUMERO = "+5511977770001";

let meta: ServidorFalso;
beforeAll(async () => {
  meta = await criarServidorFalso();
});
afterAll(async () => {
  await meta.fechar();
});
beforeEach(() => {
  while (meta.recebidas.length > 0) (meta.recebidas as unknown[]).pop();
});

const entrada = (extras: Partial<EntradaDaFumacaOficial> = {}): EntradaDaFumacaOficial => ({ token: TOKEN, phoneNumberId: FONE, wabaId: WABA, ...extras });
const rodar = (extras: Partial<EntradaDaFumacaOficial> = {}) =>
  rodarFumacaDoWhatsAppOficial({
    entrada: entrada(extras),
    cliente: criarClienteDaCloudApi({ appSecret: "", versao: "v24.0", graph: meta.url }, { tempoLimiteMs: 1_500 }),
    versao: "v24.0",
  });

const numeroOk = () => meta.enfileirar({ kind: "ok", status: 200, corpo: { id: FONE, display_phone_number: "+55 11 97777-0001", verified_name: "Tria" } });
const modelo = (n: number, extras: Record<string, unknown> = {}) => ({
  id: `4000${n}`,
  name: `modelo_${n}`,
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Olá {{1}}" }],
  ...extras,
});
const modelosOk = (...itens: unknown[]) => meta.enfileirar({ kind: "ok", status: 200, corpo: { data: itens } });

describe("os passos", () => {
  it("tudo certo: o número, os modelos (contagens, componentes e enviáveis) e a inscrição pulada", async () => {
    numeroOk();
    modelosOk(
      modelo(1),
      modelo(2, { status: "REJECTED", rejected_reason: "INVALID_FORMAT" }),
      modelo(3, { category: "MARKETING", components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "oi" }, { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Ok" }] }] }),
    );
    const r = await rodar({ numeroEsperado: NUMERO });
    expect(r.ok).toBe(true);
    expect(r.passos.map((p) => [p.ok, p.nome.split(" ")[0] + " " + p.nome.split(" ")[1]])).toEqual([[true, "o número"], [true, "os modelos"], [true, "inscrever o"]]);
    const [numero, modelos, inscrever] = r.passos;
    expect(numero!.detalhe).toContain("termina em 0001");
    expect(numero!.detalhe).toContain("é o esperado");
    expect(numero!.detalhe).toContain("o nome verificado aparece: sim");
    expect(modelos!.detalhe).toContain("3 modelos");
    expect(modelos!.detalhe).toContain("APPROVED 2");
    expect(modelos!.detalhe).toContain("REJECTED 1");
    expect(modelos!.detalhe).toContain("UTILITY 2");
    expect(modelos!.detalhe).toContain("MARKETING 1");
    expect(modelos!.detalhe).toContain("o CRM reconhece 3");
    expect(modelos!.detalhe).toContain("BODY 3");
    expect(modelos!.detalhe).toContain("cabeçalhos IMAGE 1");
    // Enviáveis: só o 1 (o 2 foi rejeitado e o 3 tem cabeçalho de imagem).
    expect(modelos!.detalhe).toContain("1 enviáveis agora: modelo_1 (pt_BR, 1 variáv.)");
    expect(inscrever).toMatchObject({ ok: true });
    expect(inscrever!.detalhe).toMatch(/pulado/);
    // Só leitura: nenhuma chamada POST.
    expect(meta.recebidas.map((p) => p.metodo)).toEqual(["GET", "GET"]);
  });

  it("--inscrever liga o único passo que escreve na Meta", async () => {
    numeroOk();
    modelosOk(modelo(1));
    meta.enfileirar({ kind: "ok", status: 200, corpo: { success: true } });
    const r = await rodar({ inscrever: true });
    expect(r.ok).toBe(true);
    expect(r.passos[2]!.detalhe).toMatch(/confirmou/);
    expect(meta.recebidas.at(-1)).toMatchObject({ metodo: "POST", caminho: `/v24.0/${WABA}/subscribed_apps` });
  });

  it("a conta sem modelos não é falha: diz o que fazer", async () => {
    numeroOk();
    modelosOk();
    const r = await rodar();
    expect(r.ok).toBe(true);
    expect(r.passos[1]!.detalhe).toMatch(/nenhum modelo/);
  });

  it("modelos de categoria ou estado desconhecidos são contados como IGNORADOS", async () => {
    numeroOk();
    modelosOk(modelo(1), modelo(2, { category: "CATEGORIA_NOVA" }), modelo(3, { status: "ESTADO_NOVO" }));
    const r = await rodar();
    expect(r.passos[1]!.detalhe).toContain("o CRM reconhece 1 e IGNORA 2");
  });

  it("modelo sem BODY (o formato dos componentes não é o assumido) falha o passo, com o motivo", async () => {
    numeroOk();
    modelosOk(modelo(1, { components: [{ type: "FOOTER", text: "só rodapé" }] }));
    const r = await rodar();
    expect(r.ok).toBe(false);
    expect(r.passos[1]).toMatchObject({ ok: false });
    expect(r.passos[1]!.detalhe).toMatch(/SEM corpo/);
  });
});

describe("as falhas", () => {
  it("token vencido (190): os dois passos falham com o status e o código, e a dica é de token", async () => {
    meta.enfileirar({ kind: "ok", status: 401, corpo: { error: { message: "Error validating access token: Session has expired on Friday", code: 190 } } });
    meta.enfileirar({ kind: "ok", status: 401, corpo: { error: { message: "Error validating access token", code: 190 } } });
    const r = await rodar();
    expect(r.ok).toBe(false);
    expect(r.passos.slice(0, 2).every((p) => !p.ok)).toBe(true);
    expect(r.passos[0]!.detalhe).toBe("a Meta respondeu HTTP 401, código 190 — token inválido, vencido ou sem acesso a este número");
    // Um passo que falha não pula o outro: os dois foram chamados.
    expect(meta.recebidas).toHaveLength(2);
  });

  it("o número devolvido não é o esperado: falha dizendo os finais, nunca o número inteiro", async () => {
    numeroOk();
    modelosOk();
    const r = await rodar({ numeroEsperado: "+5521988887777" });
    expect(r.passos[0]).toMatchObject({ ok: false });
    expect(r.passos[0]!.detalhe).toContain("final 0001");
    expect(r.passos[0]!.detalhe).toContain("final 7777");
    expect(r.passos[0]!.detalhe).not.toContain("5521988887777");
  });

  it("o display_phone_number num formato estranho falha o passo", async () => {
    meta.enfileirar({ kind: "ok", status: 200, corpo: { id: FONE, display_phone_number: "abc" } });
    modelosOk();
    const r = await rodar();
    expect(r.passos[0]).toMatchObject({ ok: false });
  });

  it("a Meta fora do ar (tempo esgotado): falha de transporte, sem texto da Meta", async () => {
    meta.enfileirar({ kind: "timeout" });
    modelosOk();
    const r = await rodar();
    expect(r.passos[0]).toMatchObject({ ok: false, detalhe: "falha de transporte (tempo_esgotado)" });
    // O segundo passo ainda rodou.
    expect(r.passos[1]).toMatchObject({ ok: true });
  });
});

describe("a saída nunca vaza segredo", () => {
  it("nem com sucesso, nem com falha: sem o token, os IDs, a frase da Meta e o número inteiro", async () => {
    // Os dois caminhos do passo do número: com o número esperado e sem ele.
    numeroOk();
    modelosOk(modelo(1), modelo(2, { components: [{ type: "BODY", text: "Texto SECRETO do modelo {{1}}" }] }));
    const feliz = descreverFumacaOficial(await rodar({ numeroEsperado: NUMERO, inscrever: false }));
    numeroOk();
    modelosOk(modelo(1), modelo(2, { components: [{ type: "BODY", text: "Texto SECRETO do modelo {{1}}" }] }));
    const semEsperado = descreverFumacaOficial(await rodar());

    meta.enfileirar({ kind: "ok", status: 401, corpo: { error: { message: `Token ${TOKEN} inválido para ${FONE}`, code: 190 } } });
    meta.enfileirar({ kind: "ok", status: 500, corpo: { error: { message: `falhou em ${WABA}` } } });
    const falho = descreverFumacaOficial(await rodar());

    for (const saida of [feliz, semEsperado, falho]) {
      for (const proibido of [TOKEN, FONE, WABA, "5511977770001", "97777-0001", "Texto SECRETO", "Session has expired"]) {
        expect(saida, `não pode conter ${proibido}`).not.toContain(proibido);
      }
    }
    expect(feliz).toContain("PASSOU");
    expect(falho).toContain("FALHOU");
  });
});

describe("o ambiente", () => {
  const ambiente = { WHATSAPP_FUMACA_TOKEN: TOKEN, WHATSAPP_FUMACA_PHONE_NUMBER_ID: FONE, WHATSAPP_FUMACA_WABA_ID: WABA };

  it("lê o token e os IDs do ambiente, e o número esperado e --inscrever, se vierem", () => {
    expect(lerEntradaDaFumaca(ambiente, [])).toEqual({ ok: true, entrada: { token: TOKEN, phoneNumberId: FONE, wabaId: WABA, inscrever: false } });
    expect(lerEntradaDaFumaca({ ...ambiente, WHATSAPP_FUMACA_NUMERO: NUMERO }, ["--inscrever"])).toEqual({
      ok: true,
      entrada: { token: TOKEN, phoneNumberId: FONE, wabaId: WABA, numeroEsperado: NUMERO, inscrever: true },
    });
  });

  it("o que falta aparece pelo NOME da variável, nunca pelo valor", () => {
    expect(lerEntradaDaFumaca({}, [])).toEqual({ ok: false, faltam: ["WHATSAPP_FUMACA_TOKEN", "WHATSAPP_FUMACA_PHONE_NUMBER_ID", "WHATSAPP_FUMACA_WABA_ID"] });
    expect(lerEntradaDaFumaca({ ...ambiente, WHATSAPP_FUMACA_WABA_ID: "" }, [])).toEqual({ ok: false, faltam: ["WHATSAPP_FUMACA_WABA_ID"] });
  });

  it.each([
    ["ID do número com letras", { WHATSAPP_FUMACA_PHONE_NUMBER_ID: "abc123" }],
    ["ID da conta com letras", { WHATSAPP_FUMACA_WABA_ID: "waba-1" }],
    ["token com espaço no meio (colar com sobra)", { WHATSAPP_FUMACA_TOKEN: `${TOKEN} sobra` }],
  ])("%s: recusado, e a frase não repete o valor", (_nome, extra) => {
    const r = lerEntradaDaFumaca({ ...ambiente, ...extra }, []);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) {
      expect(r.invalida).toBeTruthy();
      for (const valor of Object.values(extra)) expect(r.invalida).not.toContain(valor);
    }
  });

  it("a versão da Graph vem de META_GRAPH_VERSAO (padrão v26.0) e uma inválida é recusada", () => {
    expect(configuracaoDaFumaca({})).toMatchObject({ ok: true, configuracao: { versao: "v26.0", graph: "https://graph.facebook.com" } });
    expect(configuracaoDaFumaca({ META_GRAPH_VERSAO: "v25.0" })).toMatchObject({ ok: true, configuracao: { versao: "v25.0" } });
    expect(configuracaoDaFumaca({ META_GRAPH_VERSAO: "latest" })).toMatchObject({ ok: false });
  });
});
