/**
 * O aviso `canal.mudou` das ações de Canal (Sessão 4), contra o Postgres LOCAL: criar, conectar (simulado), desconectar, editar
 * e arquivar avisam as outras abas do Espaço no mesmo commit. A recusa (transição inválida) e a que dá rollback não avisam.
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { CANAL_DO_NOTIFY } from "../../mensageria/avisar";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeCanais } from "./canais";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeCanais({ pool, acesso: criarAcessoAoCrmPg(pool) });
const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDeCanais: cada mudança do Canal avisa as abas (canal.mudou)", () => {
  const ws = novoEspacoDeTeste("canalaviso");
  const admin: MembroDaSessao = { id: "mem_admin", workspaceId: ws, state: "ativo" };
  const recebidos: Array<Record<string, unknown>> = [];
  let ouvinte: Client;

  async function avisos(esperados: number, prazoMs = 1_500) {
    const limite = Date.now() + prazoMs;
    while (recebidos.length < esperados && Date.now() < limite) await dormir(5);
    await dormir(60);
    return recebidos.splice(0, recebidos.length);
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    ouvinte = new Client({ connectionString: process.env.DATABASE_URL });
    await ouvinte.connect();
    ouvinte.on("notification", (mensagem) => {
      if (mensagem.channel !== CANAL_DO_NOTIFY || !mensagem.payload) return;
      const lido = JSON.parse(mensagem.payload) as Record<string, unknown>;
      if (lido.workspaceId === ws) recebidos.push(lido);
    });
    await ouvinte.query(`LISTEN ${CANAL_DO_NOTIFY}`);
  });
  afterAll(async () => {
    await ouvinte.end();
    await limparEspaco(ws);
    await encerrar();
  });

  it("criar, conectar (simulado), desconectar, editar e arquivar avisam com o id do Canal; a transição recusada não avisa", async () => {
    const criado = valor(await servico.criar(admin, { provedor: "whatsapp-cloud", nome: `Comercial ${randomUUID().slice(0, 4)}`, identificador: "+55 11 97777-0099" }));
    expect(await avisos(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: criado.id }]);

    valor(await servico.simularConexao(admin, criado.id));
    expect(await avisos(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: criado.id }]);

    valor(await servico.desconectar(admin, criado.id));
    expect(await avisos(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: criado.id }]);

    // Desconectar de novo é recusado (409): nada gravado, nada avisado.
    expect((await servico.desconectar(admin, criado.id)).ok).toBe(false);
    expect(await avisos(1, 300)).toEqual([]);

    valor(await servico.editar(admin, criado.id, { nome: `Comercial novo ${randomUUID().slice(0, 4)}` }));
    expect(await avisos(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: criado.id }]);

    valor(await servico.arquivar(admin, criado.id));
    expect(await avisos(1)).toEqual([{ workspaceId: ws, tipo: "canal.mudou", canalId: criado.id }]);
  });
});
