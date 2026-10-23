/**
 * Anexo inalcançável: `GET /anexos/:fileId/url` (Fase 9, R3, D-14 camada 1; T-09-78).
 *
 * Um Arquivo só devolve URL assinada a quem alcança o que o carrega: a Tarefa que o
 * anexa (a conta de Gestão, por exemplo) ou, se nenhuma Tarefa o carrega, o próprio
 * criador (e quem administra o Espaço). Para os demais a resposta é 404, como se o
 * Arquivo não existisse. 09-07 provou isto em `estado.test.ts`; aqui a prova entra no
 * job `seguranca` do CI, com o Convidado e com B.
 *
 * O Storage do Supabase NÃO é chamado: `urlDeDownload` é trocada por um dublê, então os
 * casos que passam da autorização (A, Administrador, criador) devolvem 200 com uma URL
 * de mentira, sem rede e sem credencial.
 *
 *   docker run -d --rm --name crm-n1-pg-0915 -e POSTGRES_PASSWORD=x -p 55615:5432 postgres:16
 *   DATABASE_URL=postgres://postgres:x@localhost:55615/postgres npx vitest run src/seguranca/anexos.test.ts
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { memberSeesTask } from "@n1/dominio/derive";
import { CP } from "@n1/dominio/operations";
import { encerrar } from "../persistencia/conexao";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

vi.mock("../servicos/storage-uploads", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../servicos/storage-uploads")>()),
  urlDeDownload: async () => ({ downloadUrl: "https://storage.invalido.test/assinada", expiresAt: new Date(Date.now() + 60_000) }),
}));

const URL_FALSA = "https://storage.invalido.test/assinada";

describeComBanco("GET /anexos/:fileId/url — o Arquivo inalcançável dá 404 (R3, T-09-78)", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;
  /** O Arquivo anexado a uma conta de Gestão (a Lista Contas a pagar). */
  const ARQUIVO_DE_GESTAO = "wf_vaz_gestao";

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("anexos");

    // POSC-08 — um Arquivo anexado a uma conta de Gestão: baixa quem vê a conta, e só.
    const conta = espaco.estado.tasks.find((t) => t.listId === CP.listId);
    expect(conta, "o seed precisa ter alguma Tarefa de Contas a pagar").toBeDefined();
    espaco.estado.files.push({
      id: ARQUIVO_DE_GESTAO,
      workspaceId: espaco.estado.workspace.id,
      name: "boleto.pdf",
      mediaType: "document",
      sizeBytes: 10,
      createdBy: { kind: "member", id: espaco.membros.proprietario.id },
      createdAt: new Date().toISOString(),
      objectKey: "privado/teste/wf_vaz_gestao.pdf",
      state: "enviado",
    });
    conta!.attachments.push({ fileId: ARQUIVO_DE_GESTAO, order: conta!.attachments.length, mediaType: "document", displayName: "boleto.pdf" });

    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco);
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const pedir = (fileId: string, token: string) =>
    app.inject({ method: "GET", url: `/anexos/${fileId}/url`, headers: { authorization: `Bearer ${token}` } });

  const contaDeGestao = () => {
    const conta = espaco.estado.tasks.find((t) => t.attachments.some((a) => a.fileId === ARQUIVO_DE_GESTAO));
    if (!conta) throw new Error("a conta de Gestão com o anexo sumiu do estado");
    return conta;
  };

  describe("o Arquivo órfão de A (nenhuma Tarefa o carrega)", () => {
    it("o Convidado recebe 404 e nenhuma URL", async () => {
      const resposta = await pedir(espaco.arquivoOrfao, TOKENS_DE_VAZAMENTO.convidado);
      expect(resposta.statusCode, resposta.body).toBe(404);
      expect(resposta.body).not.toContain(URL_FALSA);
    });

    it("B recebe 404 e nenhuma URL", async () => {
      const resposta = await pedir(espaco.arquivoOrfao, TOKENS_DE_VAZAMENTO.b);
      expect(resposta.statusCode, resposta.body).toBe(404);
      expect(resposta.body).not.toContain(URL_FALSA);
    });

    it("A (o criador) passa da autorização e recebe a URL", async () => {
      const resposta = await pedir(espaco.arquivoOrfao, TOKENS_DE_VAZAMENTO.a);
      expect(resposta.statusCode, resposta.body).not.toBe(404);
      expect(resposta.statusCode, resposta.body).toBe(200);
      expect((resposta.json() as { url: string }).url).toBe(URL_FALSA);
    });

    it("o Administrador passa da autorização (administra o Espaço)", async () => {
      const resposta = await pedir(espaco.arquivoOrfao, TOKENS_DE_VAZAMENTO.administrador);
      expect(resposta.statusCode, resposta.body).not.toBe(404);
    });

    it("o 404 de um Arquivo órfão alheio é o mesmo de um Arquivo que não existe (não confirma que o id existe)", async () => {
      const dele = await pedir(espaco.arquivoOrfao, TOKENS_DE_VAZAMENTO.b);
      const inexistente = await pedir("wf_nao_existe", TOKENS_DE_VAZAMENTO.b);
      expect(inexistente.statusCode).toBe(404);
      expect(dele.body).toBe(inexistente.body);
    });
  });

  describe("o anexo de uma conta de Gestão", () => {
    it("há Membros da fábrica que não veem a conta e Membros que veem (a prova não é vazia nem trivial)", () => {
      const conta = contaDeGestao();
      const veem = Object.values(espaco.membros).filter((m) => memberSeesTask(espaco.estado, m.id, conta.id));
      const naoVeem = Object.values(espaco.membros).filter((m) => !memberSeesTask(espaco.estado, m.id, conta.id));
      expect(veem.length, "quem vê a conta").toBeGreaterThan(0);
      expect(naoVeem.length, "quem não vê a conta").toBeGreaterThan(0);
    });

    it.each([
      ["a", TOKENS_DE_VAZAMENTO.a],
      ["b", TOKENS_DE_VAZAMENTO.b],
      ["convidado", TOKENS_DE_VAZAMENTO.convidado],
      ["administrador", TOKENS_DE_VAZAMENTO.administrador],
      ["proprietario", TOKENS_DE_VAZAMENTO.proprietario],
    ] as const)("%s: 404 se não vê a conta, passa da autorização se vê (a regra do alcance, não do nome do Papel)", async (quem, token) => {
      const membro = espaco.membros[quem];
      const vê = memberSeesTask(espaco.estado, membro.id, contaDeGestao().id);
      const resposta = await pedir(ARQUIVO_DE_GESTAO, token);
      if (vê) {
        expect(resposta.statusCode, resposta.body).toBe(200);
      } else {
        expect(resposta.statusCode, resposta.body).toBe(404);
        expect(resposta.body).not.toContain(URL_FALSA);
      }
    });

    it("o Convidado, Membro ativo, não baixa o boleto da conta de Gestão (404)", async () => {
      const resposta = await pedir(ARQUIVO_DE_GESTAO, TOKENS_DE_VAZAMENTO.convidado);
      expect(resposta.statusCode, resposta.body).toBe(404);
    });

    it("o Proprietário (que alcança Gestão) baixa", async () => {
      const resposta = await pedir(ARQUIVO_DE_GESTAO, TOKENS_DE_VAZAMENTO.proprietario);
      expect(resposta.statusCode, resposta.body).toBe(200);
    });
  });
});
