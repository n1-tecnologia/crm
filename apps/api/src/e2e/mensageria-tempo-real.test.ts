/**
 * O tempo real da mensageria, ponta a ponta (16-07, D-16-01, MSG-03), contra o Postgres LOCAL (Docker, porta 55722):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55722/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55722/postgres npx vitest run src/e2e/mensageria-tempo-real.test.ts
 *
 * Os serviços avisam por `pg_notify` no mesmo cliente da transação; uma conexão `LISTEN` por processo alimenta o hub
 * em memória, que entrega por SSE (`GET /eventos`) só ao Espaço do evento. Aqui o app escuta numa porta de verdade
 * (`inject` não serve a fluxo) e cada "aba" é um `fetch` que lê o corpo em fluxo, como a tela faz.
 *
 * Há dois apps (um por Espaço, como a api faz com o `workspaceId` da sessão) que dividem o MESMO hub e o mesmo ouvinte:
 * a aba do Espaço B nunca ouve o que acontece no Espaço A.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { avisarCrm } from "../mensageria/avisar";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { criarHubDeEventos } from "../mensageria/hub-de-eventos";
import { criarOuvinteDoCrm } from "../mensageria/ouvinte-pg";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg, exigir } from "../servicos/crm/acesso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const ORIGEM = "http://localhost:3001";
const SEGREDO = "s1-do-canal-simulado";
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

const WHATSAPP_DO_WEBHOOK = "+5511987654321";
const WHATSAPP_DE_MARCOS = "+5511988880001";
const WHATSAPP_DE_CARLA = "+5511988880002";
const WHATSAPP_DE_DORA = "+5511988880003";

/** Uma aba aberta: o status da resposta, os cabeçalhos e os quadros SSE lidos até agora (separados por linha em branco). */
interface Aba {
  readonly status: number;
  readonly cabecalhos: Headers;
  readonly quadros: string[];
  fechar(): void;
}

interface Evento {
  readonly tipo: string;
  readonly conversaId: string;
  readonly mensagemId?: string;
}

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/** Os eventos `data:` da aba, já lidos como objeto. */
const eventosDa = (aba: Aba): Evento[] =>
  aba.quadros.filter((q) => q.startsWith("data: ")).map((q) => JSON.parse(q.slice("data: ".length)) as Evento);

/** O quadro que casa com o predicado, ou `undefined` se não chegou até o prazo. */
async function esperarQuadro(aba: Aba, casa: (quadro: string) => boolean, prazoMs: number): Promise<string | undefined> {
  const limite = Date.now() + prazoMs;
  for (;;) {
    const achado = aba.quadros.find(casa);
    if (achado !== undefined) return achado;
    if (Date.now() >= limite) return undefined;
    await dormir(5);
  }
}

/** O primeiro evento que casa, ou `undefined` no prazo. */
async function esperarEvento(aba: Aba, casa: (evento: Evento) => boolean, prazoMs = 3_000): Promise<Evento | undefined> {
  const limite = Date.now() + prazoMs;
  for (;;) {
    const achado = eventosDa(aba).find(casa);
    if (achado !== undefined) return achado;
    if (Date.now() >= limite) return undefined;
    await dormir(5);
  }
}

/** Espera que a aba tenha ao menos `quantos` eventos do tipo na Conversa; devolve quantos viu. */
async function esperarQuantos(aba: Aba, tipo: string, conversaId: string, quantos: number, prazoMs = 3_000): Promise<number> {
  const limite = Date.now() + prazoMs;
  const contar = () => eventosDa(aba).filter((e) => e.tipo === tipo && e.conversaId === conversaId).length;
  while (contar() < quantos && Date.now() < limite) await dormir(5);
  return contar();
}

describeComBanco("Fase 16 ponta a ponta: o aviso confirmado no banco chega à aba aberta em GET /eventos", () => {
  const ws = novoEspacoDeTeste("msgtr");
  const wsOutro = novoEspacoDeTeste("msgtrb");
  const url = process.env.DATABASE_URL!;
  const hub = criarHubDeEventos({
    podeLer: async (membro) => (await exigir(criarAcessoAoCrmPg(pool), membro, "ler", "conversa")) === undefined,
  });
  const ouvinte = criarOuvinteDoCrm({
    url,
    aoEvento: (evento) => hub.publicar(evento),
    aoConectar: () => hub.definirDisponivel(true),
    aoCair: () => hub.definirDisponivel(false),
  });
  const processador = criarProcessadorDeEntrada({ workerId: "teste-tempo-real-entrada", chaves });
  const saida = () => criarWorkerDeSaida({ workerId: "teste-tempo-real-saida", workspaceId: ws, chaves });

  let appA: FastifyInstance;
  let appB: FastifyInstance;
  let portaA: number;
  let portaB: number;
  let canalId: string;
  let contatoMarcos: string;
  let contatoCarla: string;
  let contatoDora: string;
  let conversaDeMarcos: string;
  let abas: Aba[] = [];

  const ANA = { authorization: "Bearer token-ana" };

  const montar = (workspaceId: string, token: string, userId: string, membroId: string) =>
    buildApp({
      logger: false,
      workspaceId,
      webOrigin: ORIGEM,
      verificarToken: async (t) => (t === token ? { sub: userId } : null),
      resolverMembro: async (_workspaceId, sub) =>
        sub === userId ? { ...membroBase, id: membroId, userId: sub, state: "ativo" as const } : undefined,
      eventos: { hub },
      webhooksDeMensageria: { chaves, acordarProcessador: () => processador.acordar() },
    });

  async function abrirAba(porta: number, token: string | null): Promise<Aba> {
    const controle = new AbortController();
    const resposta = await fetch(`http://127.0.0.1:${porta}/eventos`, {
      headers: { origin: ORIGEM, ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
      signal: controle.signal,
    });
    const quadros: string[] = [];
    if (resposta.status === 200 && resposta.body) {
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      void (async () => {
        let resto = "";
        try {
          for (;;) {
            const { value, done } = await leitor.read();
            if (done) break;
            resto += decodificador.decode(value, { stream: true });
            for (let i = resto.indexOf("\n\n"); i >= 0; i = resto.indexOf("\n\n")) {
              quadros.push(resto.slice(0, i));
              resto = resto.slice(i + 2);
            }
          }
        } catch {
          // a aba foi fechada pelo teste (abort) ou o servidor encerrou o fluxo
        }
      })();
    } else {
      await resposta.body?.cancel();
    }
    const aba: Aba = { status: resposta.status, cabecalhos: resposta.headers, quadros, fechar: () => controle.abort() };
    abas.push(aba);
    return aba;
  }

  /** Uma aba autenticada que já recebeu o quadro de abertura (a assinatura no hub já existe). */
  async function abaAberta(porta: number, token: string): Promise<Aba> {
    const aba = await abrirAba(porta, token);
    expect(aba.status).toBe(200);
    expect(await esperarQuadro(aba, (q) => q === ": aberto", 2_000)).toBe(": aberto");
    return aba;
  }

  /** O `avisarCrm` numa transação que confirma (ou desfaz). */
  async function avisarNumaTransacao(evento: Parameters<typeof avisarCrm>[1], desfecho: "commit" | "rollback" = "commit"): Promise<void> {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      await avisarCrm(cliente, evento);
      await cliente.query(desfecho);
    } finally {
      cliente.release();
    }
  }

  const corpoDoWebhook = (eventos: unknown[]) => ({
    method: "POST" as const,
    url: `/webhooks/mensageria/${canalId}`,
    headers: { [CABECALHO_DO_SEGREDO]: SEGREDO },
    payload: { eventos },
  });

  async function contatoComWhatsapp(nome: string, whatsapp: string): Promise<string> {
    const contatos = criarRepositorioDeContatosPg(pool());
    const contato = await contatos.inserir(ws, { nome, proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    await contatos.inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: whatsapp, principal: true });
    return contato.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(wsOutro, { id: "mem_bia", base: "membro", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_ana",
    });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
    contatoMarcos = await contatoComWhatsapp("Marcos", WHATSAPP_DE_MARCOS);
    contatoCarla = await contatoComWhatsapp("Carla", WHATSAPP_DE_CARLA);
    contatoDora = await contatoComWhatsapp("Dora", WHATSAPP_DE_DORA);
    conversaDeMarcos = (
      await criarRepositorioDeConversasPg(pool()).inserir(ws, {
        canalId,
        contatoId: contatoMarcos,
        titulo: "Marcos — Comercial",
        filaId: null,
        atribuido: { tipo: "membro", id: "mem_ana" },
        participantes: [],
        criadoPor: { tipo: "member", id: "mem_ana" },
      })
    ).id;

    appA = montar(ws, "token-ana", "usuario-ana", "mem_ana");
    appB = montar(wsOutro, "token-bia", "usuario-bia", "mem_bia");
    await appA.listen({ port: 0, host: "127.0.0.1" });
    await appB.listen({ port: 0, host: "127.0.0.1" });
    portaA = (appA.server.address() as { port: number }).port;
    portaB = (appB.server.address() as { port: number }).port;
    ouvinte.iniciar();
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterEach(() => {
    for (const aba of abas) aba.fechar();
    abas = [];
  });

  afterAll(async () => {
    for (const aba of abas) aba.fechar();
    hub.encerrarTodos();
    await ouvinte.parar();
    await processador.parar();
    await appA.close();
    await appB.close();
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await limparEspaco(wsOutro);
    await encerrar();
  });

  // ---- o traçador (Task 1): o mecanismo inteiro, de ponta a ponta ----

  it("o ouvinte LISTEN fica de pé e o hub passa a estar disponível", async () => {
    const limite = Date.now() + 5_000;
    while (!ouvinte.ouvindo && Date.now() < limite) await dormir(20);
    expect(ouvinte.ouvindo).toBe(true);
    expect(hub.disponivel).toBe(true);
  });

  it("sem Authorization: 401", async () => {
    const aba = await abrirAba(portaA, null);
    expect(aba.status).toBe(401);
  });

  it("a aba autenticada recebe os cabeçalhos do SSE (com o CORS da origem permitida) e o quadro de abertura", async () => {
    const aba = await abrirAba(portaA, "token-ana");
    expect(aba.status).toBe(200);
    expect(aba.cabecalhos.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(aba.cabecalhos.get("cache-control")).toBe("no-cache, no-transform");
    expect(aba.cabecalhos.get("x-accel-buffering")).toBe("no");
    expect(aba.cabecalhos.get("access-control-allow-origin")).toBe(ORIGEM);
    expect(await esperarQuadro(aba, (q) => q === ": aberto", 2_000)).toBe(": aberto");
  });

  it("um avisarCrm confirmado chega à aba como data: só com o tipo e os ids, sem o workspaceId", async () => {
    const aba = await abaAberta(portaA, "token-ana");

    await avisarNumaTransacao({ workspaceId: ws, tipo: "mensagem.nova", conversaId: "c1", mensagemId: "m1" });

    const quadro = await esperarQuadro(aba, (q) => q.startsWith("data: "), 2_000);
    expect(quadro).toBe('data: {"tipo":"mensagem.nova","conversaId":"c1","mensagemId":"m1"}');
  });

  // ---- os pontos que mudam Mensagem ou Conversa (Task 3) ----

  it("MSG-03: a Mensagem do webhook chega como mensagem.nova às duas abas do mesmo Membro em menos de 1 s; a do outro Espaço não ouve nada", async () => {
    const ana1 = await abaAberta(portaA, "token-ana");
    const ana2 = await abaAberta(portaA, "token-ana");
    const bia = await abaAberta(portaB, "token-bia");

    const inicio = performance.now();
    const resposta = await appA.inject(
      corpoDoWebhook([{ tipo: "mensagem", idExterno: "tr-e1", remetente: { tipo: "whatsapp", valor: WHATSAPP_DO_WEBHOOK, nomeExibido: "Ana de fora" }, conteudo: "oi" }]),
    );
    expect(resposta.statusCode).toBe(200);

    const [daPrimeira, daSegunda] = await Promise.all([
      esperarEvento(ana1, (e) => e.tipo === "mensagem.nova", 1_000),
      esperarEvento(ana2, (e) => e.tipo === "mensagem.nova", 1_000),
    ]);
    const decorrido = performance.now() - inicio;

    expect(daPrimeira).toBeDefined();
    expect(daSegunda).toBeDefined();
    expect(decorrido).toBeLessThan(1_000);

    const gravada = (
      await pool().query<{ id: string; conversa_id: string }>("select id, conversa_id from plataforma.mensagens where workspace_id = $1 and id_externo = 'tr-e1'", [ws])
    ).rows[0]!;
    expect(daPrimeira).toEqual({ tipo: "mensagem.nova", conversaId: gravada.conversa_id, mensagemId: gravada.id });
    expect(daSegunda).toEqual(daPrimeira);

    // O Espaço B recebeu o `: aberto` e nada mais.
    await dormir(1_500);
    expect(eventosDa(bia)).toEqual([]);
  });

  it("a Mensagem repetida do provedor não avisa de novo", async () => {
    const aba = await abaAberta(portaA, "token-ana");
    const evento = { tipo: "mensagem", idExterno: "tr-e1", remetente: { tipo: "whatsapp", valor: WHATSAPP_DO_WEBHOOK }, conteudo: "oi" };

    expect((await appA.inject(corpoDoWebhook([evento]))).statusCode).toBe(200);
    await dormir(600);

    expect(eventosDa(aba)).toEqual([]);
  });

  it("POST /mensagens gera mensagem.nova; a entrega pelo worker gera mensagem.status; o status do provedor gera outro", async () => {
    const aba = await abaAberta(portaA, "token-ana");

    const resposta = await appA.inject({ method: "POST", url: "/mensagens", headers: ANA, payload: { conversaId: conversaDeMarcos, direcao: "enviada", conteudo: "olá" } });
    expect(resposta.statusCode).toBe(201);
    const criada = (resposta.json() as { dados: { id: string } }).dados;
    expect(await esperarEvento(aba, (e) => e.tipo === "mensagem.nova" && e.mensagemId === criada.id)).toEqual({
      tipo: "mensagem.nova",
      conversaId: conversaDeMarcos,
      mensagemId: criada.id,
    });

    expect(await saida().processarUm()).toBe(true);
    expect(await esperarEvento(aba, (e) => e.tipo === "mensagem.status" && e.mensagemId === criada.id)).toEqual({
      tipo: "mensagem.status",
      conversaId: conversaDeMarcos,
      mensagemId: criada.id,
    });

    // O provedor diz que a Mensagem foi lida: o aviso sai pelo ramo `status` do processador, só porque o status avançou.
    const idExterno = (
      await pool().query<{ id_externo: string }>("select id_externo from plataforma.mensagens where workspace_id = $1 and id = $2", [ws, criada.id])
    ).rows[0]!.id_externo;
    const antes = eventosDa(aba).filter((e) => e.tipo === "mensagem.status").length;
    expect((await appA.inject(corpoDoWebhook([{ tipo: "status", idExterno, status: "lida", em: new Date().toISOString() }]))).statusCode).toBe(200);
    expect(await esperarQuantos(aba, "mensagem.status", conversaDeMarcos, antes + 1)).toBe(antes + 1);

    // O mesmo status de novo não avança nada e não avisa.
    expect((await appA.inject(corpoDoWebhook([{ tipo: "status", idExterno, status: "lida", em: new Date().toISOString() }]))).statusCode).toBe(200);
    await dormir(600);
    expect(eventosDa(aba).filter((e) => e.tipo === "mensagem.status")).toHaveLength(antes + 1);
  });

  it("a falha da entrega e o Tentar de novo avisam mensagem.status", async () => {
    const aba = await abaAberta(portaA, "token-ana");
    provedorDeTeste.programarEnvio({ ok: false, transitorio: false, codigo: "HTTP_400", motivo: "número sem WhatsApp" });

    const resposta = await appA.inject({ method: "POST", url: "/mensagens", headers: ANA, payload: { conversaId: conversaDeMarcos, direcao: "enviada", conteudo: "vai falhar" } });
    const criada = (resposta.json() as { dados: { id: string } }).dados;
    expect(await saida().processarUm()).toBe(true);
    expect(await esperarEvento(aba, (e) => e.tipo === "mensagem.status" && e.mensagemId === criada.id)).toBeDefined();
    const estado = await pool().query<{ status_entrega: string }>("select status_entrega from plataforma.mensagens where workspace_id = $1 and id = $2", [ws, criada.id]);
    expect(estado.rows[0]!.status_entrega).toBe("falhou");

    const tentar = await appA.inject({ method: "POST", url: `/mensagens/${criada.id}/reenviar`, headers: ANA });
    expect(tentar.statusCode).toBe(200);
    expect(await esperarQuantos(aba, "mensagem.status", conversaDeMarcos, 2)).toBe(2);
  });

  it("os gestos da Conversa (resolver, reabrir, atribuir, lixeira, restaurar, mover) avisam conversa.mudou", async () => {
    const aba = await abaAberta(portaA, "token-ana");
    let esperados = 0;
    const gesto = async (caminho: string, corpo?: unknown) => {
      const resposta = await appA.inject({
        method: "POST",
        url: `/conversas/${conversaDeMarcos}/${caminho}`,
        headers: ANA,
        ...(corpo === undefined ? {} : { payload: corpo as Record<string, unknown> }),
      });
      expect(resposta.statusCode, `${caminho}: ${resposta.body}`).toBe(200);
      esperados += 1;
      expect(await esperarQuantos(aba, "conversa.mudou", conversaDeMarcos, esperados), caminho).toBe(esperados);
    };

    await gesto("resolver");
    await gesto("reabrir");
    await gesto("atribuir", { atribuido: { tipo: "membro", id: "mem_ana" } });
    await gesto("resolver");
    await gesto("lixeira");
    await gesto("restaurar");
    await gesto("mover", { contatoId: contatoDora });

    // `conversa.mudou` não leva mensagemId.
    expect(eventosDa(aba).every((e) => e.tipo === "conversa.mudou" && e.mensagemId === undefined)).toBe(true);
  });

  it("abrir uma Conversa (POST /conversas) grava a primeira Mensagem e avisa mensagem.nova", async () => {
    const aba = await abaAberta(portaA, "token-ana");

    const resposta = await appA.inject({
      method: "POST",
      url: "/conversas",
      headers: ANA,
      payload: { canalId, contatoId: contatoCarla, mensagem: { conteudo: "Oi, Carla" } },
    });
    expect(resposta.statusCode).toBe(201);
    const aberta = (resposta.json() as { dados: { conversa: { id: string }; primeiraMensagem: { id: string } } }).dados;

    expect(await esperarEvento(aba, (e) => e.tipo === "mensagem.nova" && e.conversaId === aberta.conversa.id)).toEqual({
      tipo: "mensagem.nova",
      conversaId: aberta.conversa.id,
      mensagemId: aberta.primeiraMensagem.id,
    });
  });
});
