/**
 * A queda da caixa de e-mail (Fase 17, 17-05, D-17-20, EML-07) contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55745/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55745/postgres \
 *   npx vitest run src/mensageria/provedores/email/queda.test.ts
 *
 * Prova: `registrarQuedaDoEmail` passa o Canal `conectada` a `desconectada` (não a `com_erro`, como o Instagram), grava o
 * motivo e o instante na conta, avança a revisão do Espaço e avisa as abas; a credencial e a conta FICAM (a pessoa reconecta
 * pela ficha); chamada de novo, ou num Canal simulado, arquivado ou já desconectado, não muda nada; e conectar de novo com a
 * senha nova limpa o motivo e volta a `conectada`.
 */

import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CANAL_DO_NOTIFY } from "../../avisar";
import { encerrar, pool } from "../../../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { criarAcessoAoCrmPg } from "../../../servicos/crm/acesso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../../testes/banco-crm";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import { criarServicoDeConexaoDoEmail } from "./conexao";
import { TIPO_DA_CREDENCIAL, guardarCredencialDoEmail } from "./credencial";
import { criarFabricaDeConexao } from "./fabrica-de-conexao";
import { registrarQuedaDoEmail } from "./queda";
import { criarPoliticaDeRede, type Resolvedor } from "./rede";
import { contaDoCanal, gravarConta } from "./repositorio";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const MOTIVO = "A senha da caixa mudou: conecte de novo.";

describeComBanco("registrarQuedaDoEmail — Postgres local", () => {
  const espacos: string[] = [];
  const servidores: ServidorDeEmailFalso[] = [];
  /** O que o `LISTEN` ouviu do CRM, por Espaço: o aviso às abas é um NOTIFY entregue no commit. */
  const ouvidos: Array<Record<string, unknown>> = [];
  let ouvinte: Client;
  const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));
  const avisosDe = async (ws: string) => {
    await dormir(150);
    return ouvidos.filter((aviso) => aviso.workspaceId === ws);
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    ouvinte = new Client({ connectionString: process.env.DATABASE_URL });
    await ouvinte.connect();
    ouvinte.on("notification", (mensagem) => {
      if (mensagem.channel === CANAL_DO_NOTIFY && mensagem.payload) ouvidos.push(JSON.parse(mensagem.payload) as Record<string, unknown>);
    });
    await ouvinte.query(`LISTEN ${CANAL_DO_NOTIFY}`);
  });

  afterEach(async () => {
    while (servidores.length > 0) await servidores.pop()!.fechar();
  });

  afterAll(async () => {
    await ouvinte.end();
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(`qd_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return ws;
  }

  /** Um Canal de e-mail com a conta e a credencial gravadas, como a conexão as deixa. */
  async function canalConectado(ws: string, extra: { conexao?: "conectada" | "desconectada"; simulada?: boolean; estado?: "ativo" | "arquivado" } = {}) {
    const id = await semearCanal(ws, {
      nome: "Vendas",
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: `vendas-${randomBytes(3).toString("hex")}@caixa.teste`,
      conexao: extra.conexao ?? "conectada",
      conexaoSimulada: extra.simulada ?? false,
    });
    if (extra.estado === "arquivado") await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2", [ws, id]);
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId: id,
      endereco: "vendas@caixa.teste",
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: 993 },
      smtp: { host: "smtp.caixa.teste", porta: 465 },
      conectadaPor: "mem_admin",
    });
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId: id }, { v: 1, tipo: "senha", usuario: "vendas@caixa.teste", senha: "senha-antiga" });
    return id;
  }

  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string; conexao_simulada: boolean }>("select conexao, conexao_simulada from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  const revisao = async (ws: string) =>
    Number((await pool().query<{ revisao: string }>("select revisao::text from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!.revisao);

  it("o Canal conectada cai para desconectada com o motivo e o instante; a credencial e a conta ficam", async () => {
    const ws = await espaco("cai");
    const id = await canalConectado(ws);
    const antes = await revisao(ws);

    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: id }, MOTIVO)).toEqual({ mudou: true });

    expect(await canalNoBanco(ws, id)).toMatchObject({ conexao: "desconectada", conexao_simulada: false });
    const conta = await contaDoCanal(pool(), ws, id);
    expect(conta?.motivoDaQueda).toBe(MOTIVO);
    expect(conta?.caiuEm).not.toBeNull();
    expect(Number.isNaN(Date.parse(conta!.caiuEm!))).toBe(false);
    // Quem cai pode reconectar pela ficha: a conta e a credencial continuam.
    expect(await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DA_CREDENCIAL })).toBeDefined();
    expect(await revisao(ws)).toBeGreaterThan(antes);
    expect(await avisosDe(ws)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: id }]);
  });

  it("chamado de novo, nada muda: { mudou: false } e o instante da queda é o primeiro", async () => {
    const ws = await espaco("denovo");
    const id = await canalConectado(ws);
    await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: id }, MOTIVO);
    const primeira = (await contaDoCanal(pool(), ws, id))!.caiuEm;
    const revisaoDepois = await revisao(ws);

    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: id }, "outro motivo")).toEqual({ mudou: false });

    expect((await contaDoCanal(pool(), ws, id))).toMatchObject({ motivoDaQueda: MOTIVO, caiuEm: primeira });
    expect(await revisao(ws)).toBe(revisaoDepois);
    // Só o primeiro aviso: a segunda chamada não avisa ninguém.
    expect(await avisosDe(ws)).toHaveLength(1);
  });

  it.each([
    ["simulado", { simulada: true }],
    ["arquivado", { estado: "arquivado" as const, conexao: "desconectada" as const }],
    ["já desconectado", { conexao: "desconectada" as const }],
  ])("Canal %s: { mudou: false } e nada muda", async (rotulo, extra) => {
    const ws = await espaco(`nao_${rotulo.replace(/\W/g, "")}`);
    const id = await canalConectado(ws, extra);
    const antes = await canalNoBanco(ws, id);
    const revisaoAntes = await revisao(ws);

    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: id }, MOTIVO)).toEqual({ mudou: false });

    expect(await canalNoBanco(ws, id)).toEqual(antes);
    expect((await contaDoCanal(pool(), ws, id))?.motivoDaQueda).toBeNull();
    expect(await revisao(ws)).toBe(revisaoAntes);
    expect(await avisosDe(ws)).toEqual([]);
  });

  it("Canal de outro Espaço ou inexistente: { mudou: false }", async () => {
    const ws = await espaco("alheio");
    const outro = await espaco("alheio2");
    const id = await canalConectado(ws);
    expect(await registrarQuedaDoEmail(pool, { workspaceId: outro, canalId: id }, MOTIVO)).toEqual({ mudou: false });
    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: "canal_que_nao_existe" }, MOTIVO)).toEqual({ mudou: false });
    expect(await canalNoBanco(ws, id)).toMatchObject({ conexao: "conectada" });
  });

  it("depois da queda, conectar de novo com a senha nova volta a conectada, limpa o motivo e reenfileira as pendentes", async () => {
    const ws = await espaco("reconecta");
    const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: "vendas@caixa.teste", senha: "senha-nova" }] });
    servidores.push(caixa);
    const fabrica = criarFabricaDeConexao({
      resolver: vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]),
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    const servico = criarServicoDeConexaoDoEmail({ pool, acesso: criarAcessoAoCrmPg(pool), fabrica, chaves: () => CHAVES });
    const id = await canalConectado(ws);
    await pool().query("update plataforma.canais set identificador_externo = 'vendas@caixa.teste' where workspace_id = $1 and id = $2", [ws, id]);
    await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: id }, MOTIVO);
    expect((await contaDoCanal(pool(), ws, id))?.motivoDaQueda).toBe(MOTIVO);

    const r = await servico.conectarPorSenha(
      { id: "mem_admin", workspaceId: ws, state: "ativo" },
      id,
      { usuario: "vendas@caixa.teste", senha: "senha-nova", imap: { host: "imap.caixa.teste", porta: caixa.imap.porta }, smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta } },
    );

    expect(r.ok).toBe(true);
    expect(await canalNoBanco(ws, id)).toMatchObject({ conexao: "conectada", conexao_simulada: false });
    expect(await contaDoCanal(pool(), ws, id)).toMatchObject({ motivoDaQueda: null, caiuEm: null });
    const guardada = await lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DA_CREDENCIAL });
    expect(JSON.parse(guardada!)).toMatchObject({ senha: "senha-nova" });
  });
});
