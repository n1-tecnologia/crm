/**
 * A saída da mensageria, ponta a ponta (16-05, 3.7.2, MSG-02), contra o Postgres LOCAL (Docker, porta 55720):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55720/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55720/postgres npx vitest run src/e2e/mensageria.test.ts
 *
 * A resposta escrita na Caixa (`POST /mensagens`) num Canal simulado e conectado entra na fila como
 * `mensagem.enviar.v1`; o worker de saída a entrega pelo provedor de teste e a Mensagem fica `enviada` com o
 * `id_externo` que o provedor devolveu. Erro transitório volta à fila; nenhuma chamada sai por HTTP.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { buildApp } from "../app";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import type { ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const WHATSAPP_DA_ANA = "+5511987654321";
const MEMBRO = { authorization: "Bearer token-ana" };
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

interface Envelope {
  ok: boolean;
  dados?: { id: string; statusEntrega: string | null };
  itens?: Array<{ id: string; statusEntrega: string | null; idExterno: string | null; statusEntregaEm: string | null; motivoFalha: string | null }>;
}

describeComBanco("Fase 16 ponta a ponta: a resposta escrita na Caixa sai pelo provedor de teste", () => {
  const ws = novoEspacoDeTeste("msgsaida");
  let canalId: string;
  let conversaId: string;

  const app = () =>
    buildApp({
      logger: false,
      workspaceId: ws,
      verificarToken: async (token) => (token === "token-ana" ? { sub: "usuario-ana" } : null),
      resolverMembro: async (_workspaceId, userId) =>
        userId === "usuario-ana" ? { ...membroBase, id: "mem_ana", userId, state: "ativo" as const } : undefined,
    });

  const worker = () => criarWorkerDeSaida({ workerId: "teste-saida", chaves });

  const escrever = async (conteudo: string) => {
    const resposta = await app().inject({ method: "POST", url: "/mensagens", headers: MEMBRO, payload: { conversaId, direcao: "enviada", conteudo } });
    expect(resposta.statusCode).toBe(201);
    return (resposta.json() as Envelope).dados!;
  };

  const mensagem = async (id: string) => {
    const resposta = await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO });
    return (resposta.json() as Envelope).itens!.find((m) => m.id === id)!;
  };

  const linhaDaFila = async (mensagemId: string) =>
    (
      await pool().query<{ id: string; status: string; attempts: number; last_error_code: string | null }>(
        "select id, status, attempts, last_error_code from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [ws, mensagemId],
      )
    ).rows[0]!;

  /** Os testes não esperam o backoff: a linha fica disponível agora. */
  const disponivelAgora = (mensagemId: string) =>
    pool().query("update plataforma.integration_outbox set available_at = now() where workspace_id = $1 and aggregate_id = $2", [ws, mensagemId]);

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_ana",
    });
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Ana", proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    await criarRepositorioDeContatosPg(pool()).inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, principal: true });
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId: contato.id,
      titulo: "Ana — Comercial",
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_ana" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_ana" },
    });
    conversaId = conversa.id;
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterAll(async () => {
    // `integration_outbox` não tem FK para o Espaço: as linhas de `mensagem.enviar.v1` saem por aqui.
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  it("a resposta escrita na Caixa nasce pendente, sai pelo provedor de teste e fica enviada com o id do provedor", async () => {
    const criada = await escrever("olá");
    expect(criada.statusEntrega).toBe("pendente");
    expect(await linhaDaFila(criada.id)).toMatchObject({ status: "pending", attempts: 0 });

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect(provedorDeTeste.enviados[0]).toMatchObject({
      mensagemId: criada.id,
      destino: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA },
      conteudo: "olá",
    });
    expect(await linhaDaFila(criada.id)).toMatchObject({ status: "delivered" });

    const depois = await mensagem(criada.id);
    expect(depois.statusEntrega).toBe("enviada");
    expect(depois.idExterno).toMatch(/^teste-/);
    expect(depois.statusEntregaEm).not.toBeNull();
  });
});
