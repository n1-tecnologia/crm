/**
 * A política de tentativas da saída (16-05, 3.7.2, MSG-02), contra o Postgres LOCAL (Docker, porta 55720):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55720/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55720/postgres npx vitest run src/mensageria/entregar-mensagem.test.ts
 *
 * O que está em jogo: o cliente nunca receber a mesma Mensagem duas vezes por uma tentativa automática. Só o que
 * certamente não saiu volta à fila; a resposta ambígua vira `falhou` e quem reenvia é a pessoa. Cada caso monta o
 * seu Canal, Contato e Conversa e faz a Mensagem entrar na fila pelo serviço real (o 16-04).
 */

import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { encerrar, pool } from "../persistencia/conexao";
import type { LinhaOutbox } from "../persistencia/outbox-worker";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import type { ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeMensagens } from "../servicos/crm/mensagens";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import { FRASES_DA_SAIDA, criarEntregadorDeMensagens, criarWorkerDeSaida } from "./entregar-mensagem";
import { reenfileirarPendentesDoCanal } from "./fila-de-saida";
import { provedorDeTeste } from "./provedores/teste";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool) });

describeComBanco("entregador de mensagens: a política de tentativas que não duplica (16-05)", () => {
  const ws = novoEspacoDeTeste("msgpolitica");
  const membro: MembroDaSessao = { id: "mem_ana", workspaceId: ws, state: "ativo" };
  let sequencia = 0;

  const worker = () => criarWorkerDeSaida({ workerId: "teste-politica", workspaceId: ws, chaves });

  /** Um Canal, um Contato e uma Conversa novos; devolve o necessário para escrever e olhar o desfecho. */
  async function cenario(opcoes: { simulado?: boolean; identificador?: "whatsapp" | "nenhum" } = {}) {
    sequencia += 1;
    const canalId = await semearCanal(ws, {
      nome: `Canal ${sequencia}`,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: `+55119777${String(sequencia).padStart(5, "0")}`,
      conexao: "conectada",
      conexaoSimulada: opcoes.simulado ?? true,
      configuradoPor: "mem_ana",
    });
    const contatos = criarRepositorioDeContatosPg(pool());
    const contato = await contatos.inserir(ws, { nome: `Ana ${sequencia}`, proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    if ((opcoes.identificador ?? "whatsapp") === "whatsapp") {
      await contatos.inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: `+551198765${String(sequencia).padStart(4, "0")}`, principal: true });
    } else {
      await contatos.inserirIdentificador(ws, contato.id, { tipo: "email", valor: `ana${sequencia}@exemplo.com`, principal: true });
    }
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId: contato.id,
      titulo: `Ana ${sequencia}`,
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_ana" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_ana" },
    });
    const resposta = await servico.enviar(membro, { conversaId: conversa.id, direcao: "enviada", conteudo: "olá" });
    if (!resposta.ok) throw new Error(`esperava sucesso, veio ${resposta.status}: ${resposta.error}`);
    return { canalId, conversaId: conversa.id, mensagemId: resposta.valor.id };
  }

  const mensagem = async (id: string) =>
    (
      await pool().query<{ status_entrega: string; motivo_falha: string | null; id_externo: string | null }>(
        "select status_entrega, motivo_falha, id_externo from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, id],
      )
    ).rows[0]!;

  const linha = async (mensagemId: string) =>
    (
      await pool().query<{ status: string; attempts: number; last_error_code: string | null; last_error_summary: string | null }>(
        "select status, attempts, last_error_code, last_error_summary from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [ws, mensagemId],
      )
    ).rows[0]!;

  const disponivelAgora = (mensagemId: string) =>
    pool().query("update plataforma.integration_outbox set available_at = now() where workspace_id = $1 and aggregate_id = $2", [ws, mensagemId]);

  const transitorio = { ok: false, transitorio: true, codigo: "HTTP_503", motivo: "indisponível" } as const;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  it("recusa permanente: falhou com o motivo do provedor, a linha failed e nenhuma nova tentativa", async () => {
    const c = await cenario();
    provedorDeTeste.programarEnvio({ ok: false, transitorio: false, codigo: "NUMERO_INVALIDO", motivo: "Este número não tem WhatsApp." });

    expect(await worker().processarUm()).toBe(true);

    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: "Este número não tem WhatsApp.", id_externo: null });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", attempts: 1, last_error_code: "NUMERO_INVALIDO" });
    await disponivelAgora(c.mensagemId);
    expect(await worker().processarUm()).toBe(false);
    expect(provedorDeTeste.enviados).toHaveLength(1);
  });

  it("recusa permanente sem motivo: a frase de produto, nunca o código técnico", async () => {
    const c = await cenario();
    provedorDeTeste.programarEnvio({ ok: false, transitorio: false, codigo: "HTTP_400", motivo: "" });
    await worker().processarUm();
    expect((await mensagem(c.mensagemId)).motivo_falha).toBe(FRASES_DA_SAIDA.recusou);
  });

  it("resposta ambígua: falhou com a frase de sem confirmação e o provedor nunca é chamado de novo", async () => {
    const c = await cenario();
    provedorDeTeste.programarEnvio({ ok: false, transitorio: true, ambiguo: true, codigo: "TEMPO_ESGOTADO", motivo: "sem resposta" });

    expect(await worker().processarUm()).toBe(true);

    expect(await mensagem(c.mensagemId)).toMatchObject({
      status_entrega: "falhou",
      motivo_falha: "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo.",
    });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", last_error_code: "TEMPO_ESGOTADO" });
    await disponivelAgora(c.mensagemId);
    expect(await worker().processarUm()).toBe(false);
    expect(provedorDeTeste.enviados).toHaveLength(1);
  });

  it("cinco transitórios seguidos: na quinta, falhou com a frase de várias tentativas (e cinco envios, nem um a mais)", async () => {
    const c = await cenario();
    provedorDeTeste.programarEnvio(transitorio, transitorio, transitorio, transitorio, transitorio);

    for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
      await disponivelAgora(c.mensagemId);
      expect(await worker().processarUm()).toBe(true);
      if (tentativa < 5) expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "pendente", motivo_falha: null });
    }

    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASES_DA_SAIDA.semResposta });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", attempts: 5 });
    await disponivelAgora(c.mensagemId);
    expect(await worker().processarUm()).toBe(false);
    expect(provedorDeTeste.enviados).toHaveLength(5);
  });

  it("Canal que caiu entre enfileirar e entregar: o provedor não é chamado, a Mensagem segue pendente e a linha vira failed/CANAL_DESCONECTADO", async () => {
    const c = await cenario();
    await pool().query("update plataforma.canais set conexao = 'desconectada', conexao_simulada = false where workspace_id = $1 and id = $2", [ws, c.canalId]);

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "pendente", motivo_falha: null });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", last_error_code: "CANAL_DESCONECTADO" });
  });

  it("Contato sem Identificador do tipo do Canal: falhou com a frase do Contato, sem chamar o provedor", async () => {
    const c = await cenario({ identificador: "nenhum" });

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: "O Contato não tem um WhatsApp para esta Conversa." });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed" });
  });

  it("Canal real sem provedor registrado: falhou com 'ainda não está ligado' e nada vai ao provedor de teste (MSG-05)", async () => {
    const c = await cenario({ simulado: false });

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASES_DA_SAIDA.provedorNaoLigado });
  });

  it("Mensagem que já não está pendente (corrida com Tentar de novo): a linha encerra sem chamar o provedor", async () => {
    const c = await cenario();
    await pool().query(
      "update plataforma.mensagens set status_entrega = 'enviada', id_externo = 'ja-saiu', status_entrega_em = now() where workspace_id = $1 and id = $2",
      [ws, c.mensagemId],
    );

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await linha(c.mensagemId)).toMatchObject({ status: "delivered" });
    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "enviada", id_externo: "ja-saiu" });
  });

  /** Põe a linha do outbox como o worker a deixaria depois de uma queda: `pending`, com tentativas e o código do que a trouxe de volta. */
  const voltouSemDesfecho = (mensagemId: string, codigo: string, tentativas = 1) =>
    pool().query(
      `update plataforma.integration_outbox
          set status = 'pending', attempts = $3, last_error_code = $4, available_at = now() - interval '1 second'
        where workspace_id = $1 and aggregate_id = $2`,
      [ws, mensagemId, tentativas, codigo],
    );

  it("WR-01: linha delivering com trava de 3 min (worker que caiu) volta marcada e fecha como sem confirmação, sem chamar o provedor; trava de 30 s não é tomada", async () => {
    const velha = await cenario();
    const recente = await cenario();
    await pool().query(
      `update plataforma.integration_outbox set status = 'delivering', locked_at = now() - interval '3 minutes', locked_by = 'caiu', attempts = 1
        where workspace_id = $1 and aggregate_id = $2`,
      [ws, velha.mensagemId],
    );
    await pool().query(
      `update plataforma.integration_outbox set status = 'delivering', locked_at = now() - interval '30 seconds', locked_by = 'vivo', attempts = 1
        where workspace_id = $1 and aggregate_id = $2`,
      [ws, recente.mensagemId],
    );

    expect(await worker().processarUm()).toBe(true);
    expect(await worker().processarUm()).toBe(false);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await mensagem(velha.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASES_DA_SAIDA.semConfirmacao, id_externo: null });
    expect(await linha(velha.mensagemId)).toMatchObject({ status: "failed", last_error_code: "ENVIO_SEM_DESFECHO" });
    expect(await linha(recente.mensagemId)).toMatchObject({ status: "delivering" });
    expect((await mensagem(recente.mensagemId)).status_entrega).toBe("pendente");
  });

  it("WR-01: a exceção que escapou do entregador depois do enviar (ERRO_DO_ENTREGADOR) não reenvia: falhou sem confirmação", async () => {
    const c = await cenario();
    await voltouSemDesfecho(c.mensagemId, "ERRO_DO_ENTREGADOR");

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await mensagem(c.mensagemId)).toMatchObject({ status_entrega: "falhou", motivo_falha: FRASES_DA_SAIDA.semConfirmacao });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", last_error_code: "ENVIO_SEM_DESFECHO" });
    await disponivelAgora(c.mensagemId);
    expect(await worker().processarUm()).toBe(false);
  });

  it("WR-01: a linha que voltou por erro transitório do provedor (HTTP_503) sai normalmente", async () => {
    const c = await cenario();
    await voltouSemDesfecho(c.mensagemId, "HTTP_503");

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect((await mensagem(c.mensagemId)).status_entrega).toBe("enviada");
    expect(await linha(c.mensagemId)).toMatchObject({ status: "delivered" });
  });

  it("WR-01: depois do desfecho ambíguo, Tentar de novo reabre a linha (código nulo, tentativas 0) e a Mensagem sai uma vez", async () => {
    const c = await cenario();
    await voltouSemDesfecho(c.mensagemId, "TRAVA_VENCIDA");
    await worker().processarUm();
    expect(provedorDeTeste.enviados).toHaveLength(0);

    const reenvio = await servico.reenviar(membro, c.mensagemId);
    expect(reenvio.ok).toBe(true);
    expect(await linha(c.mensagemId)).toMatchObject({ status: "pending", attempts: 0, last_error_code: null });

    expect(await worker().processarUm()).toBe(true);
    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect((await mensagem(c.mensagemId)).status_entrega).toBe("enviada");
  });

  it("WR-02: o aceite que não grava (id externo já usado no Canal) tenta 3 vezes com 250 ms e 1 s, fecha a Mensagem como falhou e a linha desiste sem reenviar", async () => {
    const c = await cenario();
    sequencia += 1;
    const idExterno = `dup-${sequencia}`;
    const ocupada = await criarRepositorioDeMensagensPg(pool()).inserirRecebida(ws, {
      conversaId: c.conversaId,
      canalId: c.canalId,
      idExterno,
      criadoEm: new Date().toISOString(),
      conteudo: "oi",
      anexos: [],
      assunto: null,
      enderecosAdicionais: [],
      remetenteExterno: null,
      identificadorId: null,
      cargaBruta: null,
    });
    expect(ocupada).toBeDefined();
    provedorDeTeste.programarEnvio({ ok: true, idExterno });
    const esperas: number[] = [];
    const comEspera = criarWorkerDeSaida({
      workerId: "teste-politica",
      workspaceId: ws,
      chaves,
      esperar: async (ms: number) => {
        esperas.push(ms);
      },
    });

    expect(await comEspera.processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect(esperas).toEqual([250, 1000]);
    expect(await mensagem(c.mensagemId)).toMatchObject({
      status_entrega: "falhou",
      motivo_falha: FRASES_DA_SAIDA.aceitaSemRegistro,
      id_externo: null,
    });
    expect(await linha(c.mensagemId)).toMatchObject({ status: "failed", last_error_code: "ENVIADO_SEM_REGISTRO" });
    await disponivelAgora(c.mensagemId);
    expect(await comEspera.processarUm()).toBe(false);
    expect(provedorDeTeste.enviados).toHaveLength(1);
  });

  it("WR-02: a volta do Canal só reabre a linha failed/CANAL_DESCONECTADO e cria a que falta; nunca reabre ENVIADO_SEM_REGISTRO", async () => {
    const a = await cenario();
    const nova = async () => {
      const r = await servico.enviar(membro, { conversaId: a.conversaId, direcao: "enviada", conteudo: "outra" });
      if (!r.ok) throw new Error(`esperava sucesso, veio ${r.status}: ${r.error}`);
      return r.valor.id;
    };
    const b = await nova();
    const c = await nova();
    const marcar = (id: string, codigo: string) =>
      pool().query(
        `update plataforma.integration_outbox set status = 'failed', attempts = 3, last_error_code = $3 where workspace_id = $1 and aggregate_id = $2`,
        [ws, id, codigo],
      );
    await marcar(a.mensagemId, "CANAL_DESCONECTADO");
    await marcar(b, "ENVIADO_SEM_REGISTRO");
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2", [ws, c]);

    const cliente = await pool().connect();
    let reenfileiradas: number;
    try {
      await cliente.query("begin");
      reenfileiradas = await reenfileirarPendentesDoCanal(cliente, ws, a.canalId);
      await cliente.query("commit");
    } finally {
      cliente.release();
    }

    expect(reenfileiradas).toBe(2);
    expect(await linha(a.mensagemId)).toMatchObject({ status: "pending", attempts: 0, last_error_code: null });
    expect(await linha(c)).toMatchObject({ status: "pending", attempts: 0 });
    expect(await linha(b)).toMatchObject({ status: "failed", attempts: 3, last_error_code: "ENVIADO_SEM_REGISTRO" });
  });

  it("motivo do provedor com apikey: nem a Mensagem nem a linha do outbox a carregam", async () => {
    const c = await cenario();
    provedorDeTeste.programarEnvio({
      ok: false,
      transitorio: false,
      codigo: "HTTP_401",
      motivo: 'rejeitado {"apikey":"chave-secreta-123","instancia":"x"}',
    });

    await worker().processarUm();

    const depois = await mensagem(c.mensagemId);
    const fila = await linha(c.mensagemId);
    expect(depois.motivo_falha).not.toContain("chave-secreta-123");
    expect(fila.last_error_summary ?? "").not.toContain("chave-secreta-123");
  });
});

describe("entregador de mensagens sem banco: a falha antes do envio é certa de não ter saído (WR-01, 16-20)", () => {
  const poolQueCai = {
    query: async () => {
      throw new Error("conexão com o banco caiu");
    },
    connect: async () => {
      throw new Error("conexão com o banco caiu");
    },
  } as unknown as Pool;

  const entregador = () =>
    criarEntregadorDeMensagens({ pool: () => poolQueCai, armazenamento: criarArmazenamentoFalso(), registro: { teste: provedorDeTeste, porProvedor: {} }, chaves });

  const linhaValida = (): LinhaOutbox => ({
    id: "out_1",
    workspace_id: "ws_sem_banco",
    aggregate_type: "mensagem",
    aggregate_id: "msg_1",
    event_type: "mensagem.enviar.v1",
    event_version: 1,
    payload: { mensagemId: "msg_1", conversaId: "cnv_1", canalId: "can_1" },
    status: "delivering",
    attempts: 1,
    available_at: new Date().toISOString(),
    locked_at: new Date().toISOString(),
    locked_by: "teste",
    last_error_code: null,
    last_error_summary: null,
    created_at: new Date().toISOString(),
    delivered_at: null,
  });

  it("WR-01: o banco que cai antes do envio vira tentar_de_novo com ERRO_ANTES_DO_ENVIO e nada é lançado", async () => {
    provedorDeTeste.limpar();

    const resultado = await entregador()(linhaValida(), { ultimaTentativa: false });

    expect(resultado).toMatchObject({ desfecho: "tentar_de_novo", erro: { code: "ERRO_ANTES_DO_ENVIO" } });
    expect(provedorDeTeste.enviados).toHaveLength(0);
  });
});
