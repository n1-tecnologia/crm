/**
 * O repositório da conta de e-mail e do cursor (17-04) contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55731/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55731/postgres \
 *   npx vitest run src/mensageria/provedores/email/repositorio.test.ts
 *
 * Prova: `gravarConta` é upsert por (Espaço, Canal) e zera a queda ao reconectar; `uidValidity` volta como texto, sem
 * perder dígito; `contasParaLer` só devolve Canal de e-mail ativo, conectado, real e com conta; `marcarQueda` e
 * `limparQueda`; `esquecerContaDoEmail` apaga conta, cursor e a credencial do e-mail DO Canal, e não toca na de outro
 * Canal, de outro Espaço nem no segredo do webhook; nenhuma consulta atravessa o Espaço.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../../../persistencia/conexao";
import { guardarCredencial, lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../../testes/banco-crm";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../provedor";
import { TIPO_DA_CREDENCIAL } from "./credencial";
import {
  contaDoCanal,
  contasParaLer,
  esquecerContaDoEmail,
  gravarConta,
  gravarCursor,
  lerCursor,
  limparQueda,
  marcarQueda,
  type ContaParaGravar,
} from "./repositorio";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };

describeComBanco("repositório do e-mail — Postgres local", () => {
  const espacos: string[] = [];

  async function canalDeEmail(ws: string, nome: string, extra: { conexao?: "conectada" | "desconectada" | "com_erro"; simulada?: boolean; provedor?: string; tipo?: string } = {}) {
    return semearCanal(ws, {
      nome,
      tipo: extra.tipo ?? "email",
      provedor: extra.provedor ?? "email-imap-smtp",
      identificadorExterno: `${nome.toLowerCase().replace(/\s/g, "")}@caixa.teste`,
      conexao: extra.conexao ?? "conectada",
      conexaoSimulada: extra.simulada ?? false,
    });
  }

  const conta = (ws: string, canalId: string, extra: Partial<ContaParaGravar> = {}): ContaParaGravar => ({
    workspaceId: ws,
    canalId,
    endereco: `${canalId.slice(0, 6)}@caixa.teste`,
    tipoDeLogin: "senha",
    imap: { host: "imap.caixa.teste", porta: 993 },
    smtp: { host: "smtp.caixa.teste", porta: 465 },
    pastaEnviados: "Sent",
    conectadaPor: "mem_dona",
    ...extra,
  });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  function espaco(rotulo: string): string {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    return ws;
  }

  it("gravarConta faz upsert por (Espaço, Canal) e contaDoCanal devolve a conta", async () => {
    const ws = espaco("em_conta");
    const canalId = await canalDeEmail(ws, "Vendas");
    expect(await contaDoCanal(pool(), ws, canalId)).toBeUndefined();

    await gravarConta(pool(), conta(ws, canalId, { endereco: "vendas@caixa.teste" }));
    const primeira = await contaDoCanal(pool(), ws, canalId);
    expect(primeira).toMatchObject({
      workspaceId: ws,
      canalId,
      endereco: "vendas@caixa.teste",
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: 993 },
      smtp: { host: "smtp.caixa.teste", porta: 465 },
      contaExternaId: null,
      appendEnviados: "auto",
      pastaEnviados: "Sent",
      motivoDaQueda: null,
      caiuEm: null,
      conectadaPor: "mem_dona",
    });

    // Reconectar pelo login da Microsoft troca os dados da MESMA linha.
    await gravarConta(pool(), conta(ws, canalId, { endereco: "vendas@caixa.teste", tipoDeLogin: "microsoft", contaExternaId: "oid:tid", appendEnviados: "nao", pastaEnviados: null }));
    const segunda = await contaDoCanal(pool(), ws, canalId);
    expect(segunda).toMatchObject({ tipoDeLogin: "microsoft", contaExternaId: "oid:tid", appendEnviados: "nao", pastaEnviados: null });
    const { rows } = await pool().query("select 1 from plataforma.email_contas where workspace_id = $1", [ws]);
    expect(rows).toHaveLength(1);
  });

  it("lerCursor e gravarCursor guardam o uidValidity como texto, sem perder dígito, e avançam o mesmo cursor", async () => {
    const ws = espaco("em_cursor");
    const canalId = await canalDeEmail(ws, "Vendas");
    await gravarConta(pool(), conta(ws, canalId));
    expect(await lerCursor(pool(), ws, canalId, "INBOX")).toBeUndefined();

    // Acima de 2^53: um `number` arredondaria; o texto volta igual.
    await gravarCursor(pool(), ws, canalId, { pasta: "INBOX", uidValidity: "9007199254740993", proximoUid: 4 });
    expect(await lerCursor(pool(), ws, canalId, "INBOX")).toEqual({ pasta: "INBOX", uidValidity: "9007199254740993", proximoUid: 4 });
    await gravarCursor(pool(), ws, canalId, { pasta: "INBOX", uidValidity: "4294967296", proximoUid: 10 });
    expect(await lerCursor(pool(), ws, canalId, "INBOX")).toEqual({ pasta: "INBOX", uidValidity: "4294967296", proximoUid: 10 });
    // Outra pasta, outro cursor.
    expect(await lerCursor(pool(), ws, canalId, "Arquivo")).toBeUndefined();
    // O cursor só existe com a conta (FK): sem conta, a gravação é recusada.
    const semConta = await canalDeEmail(ws, "Sem conta");
    await expect(gravarCursor(pool(), ws, semConta, { pasta: "INBOX", uidValidity: "1", proximoUid: 1 })).rejects.toMatchObject({ code: "23503" });
  });

  it("o cursor entra e sai com a transação de quem chama (o mesmo cliente do insert da fila)", async () => {
    const ws = espaco("em_tx");
    const canalId = await canalDeEmail(ws, "Vendas");
    await gravarConta(pool(), conta(ws, canalId));
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await gravarCursor(cliente, ws, canalId, { pasta: "INBOX", uidValidity: "1", proximoUid: 5 });
      // Na mesma transação o cursor já se lê; fora dela, ainda não.
      expect(await lerCursor(cliente, ws, canalId, "INBOX")).toMatchObject({ proximoUid: 5 });
      expect(await lerCursor(pool(), ws, canalId, "INBOX")).toBeUndefined();
      await cliente.query("rollback");
    } finally {
      cliente.release();
    }
    expect(await lerCursor(pool(), ws, canalId, "INBOX")).toBeUndefined();
  });

  it("contasParaLer só devolve Canal de e-mail ativo, conectado, real e com conta", async () => {
    const ws = espaco("em_ler");
    const conectado = await canalDeEmail(ws, "Conectado");
    const simulado = await canalDeEmail(ws, "Simulado", { simulada: true });
    const desconectado = await canalDeEmail(ws, "Desconectado", { conexao: "desconectada" });
    const comErro = await canalDeEmail(ws, "Com erro", { conexao: "com_erro" });
    const semConta = await canalDeEmail(ws, "Sem conta");
    const arquivado = await canalDeEmail(ws, "Arquivado");
    await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now(), conexao = 'desconectada' where workspace_id = $1 and id = $2", [ws, arquivado]);
    const doWhatsapp = await canalDeEmail(ws, "Zap", { tipo: "whatsapp", provedor: "whatsapp-nao-oficial" });
    for (const id of [conectado, simulado, desconectado, comErro, arquivado, doWhatsapp]) await gravarConta(pool(), conta(ws, id));

    const lidas = (await contasParaLer(pool())).filter((c) => c.workspaceId === ws);
    expect(lidas.map((c) => c.canalId)).toEqual([conectado]);
    expect(lidas[0]).toMatchObject({ imap: { host: "imap.caixa.teste", porta: 993 } });
    expect(semConta).not.toBe(conectado);
  });

  it("marcarQueda grava o motivo e o instante; limparQueda os apaga; reconectar também", async () => {
    const ws = espaco("em_queda");
    const canalId = await canalDeEmail(ws, "Vendas");
    await gravarConta(pool(), conta(ws, canalId));

    await marcarQueda(pool(), ws, canalId, "O servidor recusou o login.");
    const caida = await contaDoCanal(pool(), ws, canalId);
    expect(caida?.motivoDaQueda).toBe("O servidor recusou o login.");
    expect(Date.parse(caida!.caiuEm!)).toBeGreaterThan(Date.now() - 60_000);

    await limparQueda(pool(), ws, canalId);
    expect(await contaDoCanal(pool(), ws, canalId)).toMatchObject({ motivoDaQueda: null, caiuEm: null });

    await marcarQueda(pool(), ws, canalId, "caiu de novo");
    await gravarConta(pool(), conta(ws, canalId));
    expect(await contaDoCanal(pool(), ws, canalId)).toMatchObject({ motivoDaQueda: null, caiuEm: null });
  });

  it("esquecerContaDoEmail apaga conta, cursor e a credencial do e-mail do Canal, sem tocar na de outro Canal nem no segredo do webhook", async () => {
    const ws = espaco("em_esquecer");
    const alvo = await canalDeEmail(ws, "Alvo");
    const vizinho = await canalDeEmail(ws, "Vizinho");
    for (const id of [alvo, vizinho]) {
      await gravarConta(pool(), conta(ws, id));
      await gravarCursor(pool(), ws, id, { pasta: "INBOX", uidValidity: "1", proximoUid: 2 });
      await guardarCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DA_CREDENCIAL, segredo: `{"v":1,"id":"${id}"}` });
      await guardarCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-do-webhook" });
    }

    await esquecerContaDoEmail(pool(), ws, alvo);

    expect(await contaDoCanal(pool(), ws, alvo)).toBeUndefined();
    expect(await lerCursor(pool(), ws, alvo, "INBOX")).toBeUndefined();
    // APAGADA, não só revogada: nenhuma linha do tipo, ativa ou revogada.
    const restam = await pool().query("select 1 from plataforma.credenciais where workspace_id = $1 and dono_id = $2 and tipo = $3", [ws, alvo, TIPO_DA_CREDENCIAL]);
    expect(restam.rowCount).toBe(0);
    expect(await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: alvo, tipo: TIPO_DA_CREDENCIAL })).toBeUndefined();
    // O segredo do webhook do mesmo Canal fica (é de outro tipo).
    expect(await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: alvo, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK })).toBe("segredo-do-webhook");
    // O vizinho segue inteiro.
    expect(await contaDoCanal(pool(), ws, vizinho)).toBeDefined();
    expect(await lerCursor(pool(), ws, vizinho, "INBOX")).toMatchObject({ proximoUid: 2 });
    expect(await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: vizinho, tipo: TIPO_DA_CREDENCIAL })).toContain(vizinho);
  });

  it("nada atravessa o Espaço: a conta, o cursor e a queda de um Espaço não aparecem nem mudam pelo id de outro", async () => {
    const wsA = espaco("em_a");
    const wsB = espaco("em_b");
    const canalA = await canalDeEmail(wsA, "Vendas");
    await gravarConta(pool(), conta(wsA, canalA));
    await gravarCursor(pool(), wsA, canalA, { pasta: "INBOX", uidValidity: "1", proximoUid: 3 });

    expect(await contaDoCanal(pool(), wsB, canalA)).toBeUndefined();
    expect(await lerCursor(pool(), wsB, canalA, "INBOX")).toBeUndefined();
    await marcarQueda(pool(), wsB, canalA, "não deveria pegar");
    await esquecerContaDoEmail(pool(), wsB, canalA);
    expect(await contaDoCanal(pool(), wsA, canalA)).toMatchObject({ motivoDaQueda: null });
    expect(await lerCursor(pool(), wsA, canalA, "INBOX")).toMatchObject({ proximoUid: 3 });
  });
});
