/**
 * Desconectar e arquivar o Canal de e-mail esquecem a caixa (Fase 17, 17-05, D-17-06, T-17-24), contra o Postgres LOCAL:
 * a conta, o cursor e a credencial do cofre somem na MESMA transação da mudança do Canal. A credencial de outro Canal, o
 * segredo do webhook e o que o Canal de outro provedor guarda não são tocados.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55745/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55745/postgres \
 *   npx vitest run src/servicos/crm/canais-email.test.ts
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../../mensageria/provedor";
import { TIPO_DA_CREDENCIAL, guardarCredencialDoEmail } from "../../mensageria/provedores/email/credencial";
import { contaDoCanal, gravarConta, gravarCursor, lerCursor } from "../../mensageria/provedores/email/repositorio";
import { registrarQuedaDoEmail } from "../../mensageria/provedores/email/queda";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { guardarCredencial, lerCredencial, type ChavesDoCofre } from "../cofre";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeCanais } from "./canais";
import type { ResultadoCrm } from "./resultado";

const CHAVES: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeCanais: desconectar e arquivar o e-mail esquecem a caixa (D-17-06)", () => {
  const espacos: string[] = [];
  const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(`ce_${rotulo}`);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    return { ws, admin: sessao(ws, "mem_admin") };
  }

  /** Um Canal de e-mail conectado, com conta, cursor e credencial gravados como a conexão os deixa. */
  async function canalDeEmail(ws: string, nome: string) {
    const id = await semearCanal(ws, {
      nome,
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: `${nome.toLowerCase()}@caixa.teste`,
      conexao: "conectada",
    });
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId: id,
      endereco: `${nome.toLowerCase()}@caixa.teste`,
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.teste", porta: 993 },
      smtp: { host: "smtp.caixa.teste", porta: 465 },
      conectadaPor: "mem_admin",
    });
    await gravarCursor(pool(), ws, id, { pasta: "INBOX", uidValidity: "42", proximoUid: 10 });
    await guardarCredencialDoEmail(pool(), CHAVES, { workspaceId: ws, canalId: id }, { v: 1, tipo: "senha", usuario: `${nome.toLowerCase()}@caixa.teste`, senha: `senha-${nome}` });
    return id;
  }

  const credencial = (ws: string, id: string, tipo = TIPO_DA_CREDENCIAL) =>
    lerCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo });

  const canalNoBanco = async (ws: string, id: string) =>
    (await pool().query<{ conexao: string; estado: string }>("select conexao, estado from plataforma.canais where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  it("desconectar: o Canal fica desconectada e a conta, o cursor e a credencial somem; a do OUTRO Canal fica", async () => {
    const { ws, admin } = await espaco("desc");
    const a = await canalDeEmail(ws, "Vendas");
    const b = await canalDeEmail(ws, "Suporte");

    const desconectado = valor(await servico.desconectar(admin, a));

    expect(desconectado).toMatchObject({ id: a, conexao: "desconectada" });
    expect(await canalNoBanco(ws, a)).toMatchObject({ conexao: "desconectada", estado: "ativo" });
    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await lerCursor(pool(), ws, a, "INBOX")).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();

    // O outro Canal do mesmo Espaço segue inteiro.
    expect(await contaDoCanal(pool(), ws, b)).toBeDefined();
    expect(await lerCursor(pool(), ws, b, "INBOX")).toBeDefined();
    expect(await credencial(ws, b)).toBeDefined();
  });

  it("arquivar: o Canal fica arquivado e a mesma caixa é esquecida", async () => {
    const { ws, admin } = await espaco("arq");
    const a = await canalDeEmail(ws, "Vendas");

    const arquivado = valor(await servico.arquivar(admin, a));

    expect(arquivado).toMatchObject({ id: a, estado: "arquivado" });
    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await lerCursor(pool(), ws, a, "INBOX")).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();
  });

  it("arquivar um Canal que já tinha caído (a conta e a credencial ficaram) também esquece a caixa", async () => {
    const { ws, admin } = await espaco("arqqueda");
    const a = await canalDeEmail(ws, "Vendas");
    expect(await registrarQuedaDoEmail(pool, { workspaceId: ws, canalId: a }, "A senha da caixa mudou: conecte de novo.")).toEqual({ mudou: true });
    expect(await credencial(ws, a)).toBeDefined();

    valor(await servico.arquivar(admin, a));

    expect(await contaDoCanal(pool(), ws, a)).toBeUndefined();
    expect(await credencial(ws, a)).toBeUndefined();
  });

  it("o segredo do webhook do e-mail (outro tipo de credencial do mesmo Canal) não é o que esta sessão apaga", async () => {
    const { ws, admin } = await espaco("outrotipo");
    const a = await canalDeEmail(ws, "Vendas");
    await guardarCredencial(pool(), CHAVES, { workspaceId: ws, donoTipo: "canal", donoId: a, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "segredo-do-hook" });

    valor(await servico.desconectar(admin, a));

    expect(await credencial(ws, a)).toBeUndefined();
    expect(await credencial(ws, a, TIPO_DO_SEGREDO_DO_WEBHOOK)).toBe("segredo-do-hook");
  });

  it("Membro sem permissão não apaga nada, e a transição recusada (já desconectado) também não", async () => {
    const { ws, admin } = await espaco("recusa");
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    const a = await canalDeEmail(ws, "Vendas");

    const semPermissao = await servico.desconectar(sessao(ws, "mem_ana"), a);
    expect(semPermissao.ok).toBe(false);
    expect(await contaDoCanal(pool(), ws, a)).toBeDefined();
    expect(await credencial(ws, a)).toBeDefined();

    valor(await servico.desconectar(admin, a));
    const denovo = await servico.desconectar(admin, a);
    expect(denovo.ok).toBe(false);
  });
});
