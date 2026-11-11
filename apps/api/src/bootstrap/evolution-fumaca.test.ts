/**
 * A fumaça da Evolution (Sessão 4) contra o servidor HTTP FALSO. Sem banco. O que se prova: cada passo chama o que o "Conectar"
 * chama, um passo que falha não pula os outros, a limpeza roda SEMPRE, só instância `n1-fumaca-...` é tocada, e a saída nunca
 * leva chave, token nem QR (mesmo quando o servidor falso os ecoa).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { descreverFumaca, rodarFumacaDaEvolution } from "./evolution-fumaca";

const GLOBAL = "chave-global-da-fumaca-SECRETA";
const TOKEN = "token-da-fumaca-SECRETO-0123456789";
const QR = Buffer.from("png-do-qr-da-fumaca-0123456789-abcdef").toString("base64");
const NOME = "n1-fumaca-teste01";

let falso: ServidorFalso;
beforeEach(async () => {
  falso = await criarServidorFalso();
});
afterEach(async () => {
  await falso.fechar();
});

const rodar = () =>
  rodarFumacaDaEvolution({
    cliente: criarClienteDaEvolution({ url: falso.url, timeoutMs: 1_000 }),
    configuracao: { apikeyGlobal: GLOBAL, urlPublica: "https://api.n1.teste" },
    sufixo: "teste01",
    gerarToken: () => TOKEN,
    esperar: async () => undefined,
  });

const ok = (status: number, corpo?: unknown) => falso.enfileirar({ kind: "ok", status, ...(corpo === undefined ? {} : { corpo }) });

function programarCaminhoFeliz() {
  ok(200, { status: 200, message: "Welcome to the Evolution API", version: "2.4.0" });
  ok(201, { instance: { instanceName: NOME }, hash: TOKEN, qrcode: { count: 1, base64: `data:image/png;base64,${QR}` } });
  ok(200, [{ name: NOME, ownerJid: null, token: TOKEN, connectionStatus: "connecting" }]);
  ok(200, { instance: { instanceName: NOME, state: "connecting" } });
  ok(200, { count: 2, base64: `data:image/png;base64,${QR}` });
  ok(200, { status: "SUCCESS", error: false, response: { message: "Instance logged out" } });
  ok(200, { status: "SUCCESS", error: false, response: { message: "Instance deleted" } });
  ok(200, []);
}

describe("fumaça da Evolution", () => {
  it("o caminho feliz passa nos 8 passos, na ordem em que o 'Conectar' chama, e apaga a instância descartável", async () => {
    programarCaminhoFeliz();
    const resultado = await rodar();
    expect(resultado.ok).toBe(true);
    expect(resultado.instancia).toBe(NOME);
    expect(resultado.passos.map((p) => p.ok)).toEqual([true, true, true, true, true, true, true, true]);
    expect(falso.recebidas.map((r) => `${r.metodo} ${r.caminho.split("?")[0]}`)).toEqual([
      "GET /",
      "POST /instance/create",
      "GET /instance/fetchInstances",
      `GET /instance/connectionState/${NOME}`,
      `GET /instance/connect/${NOME}`,
      `DELETE /instance/logout/${NOME}`,
      `DELETE /instance/delete/${NOME}`,
      "GET /instance/fetchInstances",
    ]);
    // A chave global só cria, lê e apaga; o resto usa o token da instância (o menor privilégio).
    expect(falso.recebidas.map((r) => (r.cabecalhos.apikey === GLOBAL ? "global" : "instancia"))).toEqual([
      "global", "global", "global", "instancia", "instancia", "instancia", "global", "global",
    ]);
    // Nenhum número: a Evolution não toca em nenhum WhatsApp.
    expect(falso.recebidas[1]!.corpo).not.toHaveProperty("number");
    expect(descreverFumaca(resultado)).toContain("Tudo respondeu como o CRM espera");
  });

  it("o primeiro QR pode demorar: tenta de novo (até 4 vezes) antes de falhar", async () => {
    ok(200, { version: "2.4.0" });
    ok(201, { hash: TOKEN, qrcode: { count: 0 } });
    ok(200, [{ name: NOME, ownerJid: null, token: TOKEN, connectionStatus: "connecting" }]);
    ok(200, { instance: { state: "connecting" } });
    ok(200, { count: 0 });
    ok(200, { count: 0 });
    ok(200, { count: 1, base64: QR });
    ok(200, { status: "SUCCESS" });
    ok(200, { status: "SUCCESS" });
    ok(200, []);
    const resultado = await rodar();
    expect(resultado.ok).toBe(true);
    expect(resultado.passos.find((p) => p.nome.startsWith("pedir o QR"))!.detalhe).toContain("3ª tentativa");
  });

  it("um passo que falha NÃO pula os outros, e a limpeza roda sempre: sem QR depois de 4 tentativas, ainda sai da sessão e apaga", async () => {
    ok(200, { version: "2.4.0" });
    ok(201, { hash: TOKEN });
    ok(200, [{ name: NOME, ownerJid: null, token: TOKEN, connectionStatus: "connecting" }]);
    ok(200, { instance: { state: "connecting" } });
    for (let i = 0; i < 4; i += 1) ok(200, { count: 0 });
    ok(200, { status: "SUCCESS" });
    ok(200, { status: "SUCCESS" });
    ok(200, []);
    const resultado = await rodar();
    expect(resultado.ok).toBe(false);
    expect(resultado.passos.filter((p) => !p.ok).map((p) => p.nome)).toEqual(["pedir o QR code (GET /instance/connect)"]);
    expect(falso.recebidas.some((r) => r.metodo === "DELETE" && r.caminho === `/instance/delete/${NOME}`)).toBe(true);
    expect(descreverFumaca(resultado)).toContain("Algum passo FALHOU");
  });

  it("o `create` recusado: pula os passos que dependem da instância, mas ainda tenta apagar e conferir (pode ter sido criada e a resposta se perdeu)", async () => {
    ok(200, { version: "2.4.0" });
    ok(403, { status: 403, error: "Forbidden" });
    ok(404, { error: "Not Found" }); // delete
    ok(200, []); // fetchInstances: não existe
    const resultado = await rodar();
    expect(resultado.ok).toBe(false);
    expect(resultado.passos.map((p) => `${p.ok ? "ok" : "falhou"}:${p.nome.split(" (")[0]}`)).toEqual([
      "ok:versão da Evolution",
      "falhou:criar a instância",
      "ok:apagar a instância",
      "ok:conferir que a instância sumiu",
    ]);
    expect(resultado.passos[1]!.detalhe).toBe("a Evolution respondeu HTTP 403");
  });

  it("uma versão que não é 2.x falha o primeiro passo (o CRM foi escrito para a v2)", async () => {
    ok(200, { version: "1.8.2" });
    ok(201, { hash: TOKEN });
    ok(200, []);
    ok(200, { instance: { state: "close" } });
    ok(200, { count: 1, base64: QR });
    ok(200, { status: "SUCCESS" });
    ok(200, { status: "SUCCESS" });
    ok(200, []);
    const resultado = await rodar();
    expect(resultado.passos[0]!.ok).toBe(false);
  });

  it("a instância que continua existindo depois de apagada falha o último passo", async () => {
    ok(200, { version: "2.4.0" });
    ok(201, { hash: TOKEN, qrcode: { base64: QR } });
    ok(200, [{ name: NOME, ownerJid: null, token: TOKEN, connectionStatus: "close" }]);
    ok(200, { instance: { state: "close" } });
    ok(200, { base64: QR });
    ok(200, { status: "SUCCESS" });
    ok(200, { status: "SUCCESS" });
    ok(200, [{ name: NOME, ownerJid: null, token: TOKEN, connectionStatus: "close" }]);
    const resultado = await rodar();
    expect(resultado.passos.at(-1)).toMatchObject({ ok: false, detalhe: "erro inesperado" });
  });

  it("o `token` que a Evolution NÃO expõe no fetchInstances é dito em claro (é o que impede retomar um resto de tentativa)", async () => {
    ok(200, { version: "2.4.0" });
    ok(201, { hash: TOKEN, qrcode: { base64: QR } });
    ok(200, [{ name: NOME, ownerJid: null, token: null, connectionStatus: "close" }]);
    ok(200, { instance: { state: "close" } });
    ok(200, { base64: QR });
    ok(200, { status: "SUCCESS" });
    ok(200, { status: "SUCCESS" });
    ok(200, []);
    const resultado = await rodar();
    expect(resultado.passos[2]!.detalhe).toContain("o token aparece: NÃO");
  });

  it("a saída NUNCA leva a chave global, o token, o QR nem o corpo da resposta, mesmo com o servidor ecoando tudo num erro", async () => {
    ok(200, { version: "2.4.0" });
    ok(403, { error: `This name is already in use. apikey ${GLOBAL} token ${TOKEN} qr ${QR}` });
    ok(500, { error: `x ${GLOBAL} ${TOKEN}` });
    ok(200, []);
    const resultado = await rodar();
    const saida = descreverFumaca(resultado);
    expect(saida).not.toMatch(new RegExp(`${GLOBAL}|${TOKEN}|${QR}`));
    expect(JSON.stringify(resultado)).not.toMatch(new RegExp(`${GLOBAL}|${TOKEN}|${QR}`));
  });
});
