/**
 * O processador da fila de entrada (16-03, 3.6.4, MSG-01) contra o Postgres LOCAL (Docker, porta 55718):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55718/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55718/postgres npx vitest run src/mensageria/processador-de-entrada.test.ts
 *
 * Provas: a trava vencida de um worker que caiu volta a `pendente` e a Mensagem existe uma vez só; a falha
 * transitória volta com espera e desiste na 8ª; a recusa de regra (4xx) é permanente e leva o código; o
 * evento ignorado e os de `status`/`conexao` ficam `processado` com o motivo; `acordar()` processa sem
 * esperar o intervalo e nunca roda dois ciclos ao mesmo tempo.
 */

import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDeRecebimento, type ServicoDeRecebimento } from "../servicos/crm/recebimento";
import { recusa } from "../servicos/crm/resultado";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import { CANAL_DO_NOTIFY } from "./avisar";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "./provedor";
import { criarProcessadorDeEntrada } from "./processador-de-entrada";
import { provedorDeTeste } from "./provedores/teste";
import { registroPadrao, type RegistroDeProvedores } from "./registro";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const WHATSAPP_DA_ANA = "+5511987654321";
let contadorDeContatos = 0;

function corpoDeMensagem(idExterno: string) {
  return { eventos: [{ tipo: "mensagem", idExterno, remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana" }, conteudo: "oi" }] };
}

interface LinhaDaFila {
  estado: string;
  tentativas: number;
  ultimo_erro: string | null;
  resultado: string | null;
  no_futuro: boolean;
  locked_at: Date | null;
}

describeComBanco("processador da fila de entrada — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço com um Canal simulado (provedor de teste) e o segredo no cofre. */
  async function cenario(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_dona",
    });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: "s1" });
    return { ws, canalId };
  }

  /**
   * Uma Mensagem `enviada` numa Conversa nova do Canal: com `idExterno` o provedor já a aceitou (`enviada`, com o id
   * dele); sem ele ela fica `pendente`, sem linha no outbox (como a de um Canal que estava fora do ar).
   */
  async function mensagemEnviada(c: { ws: string; canalId: string }, idExterno?: string): Promise<string> {
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(c.ws, { nome: "Ana", proprietarioId: "mem_dona", criadoPor: "mem_dona" });
    // Um número por chamada: o Identificador é único no Espaço (`contato_identificadores_unico`).
    contadorDeContatos += 1;
    await criarRepositorioDeContatosPg(pool()).inserirIdentificador(c.ws, contato.id, {
      tipo: "whatsapp",
      valor: `+551198000${String(contadorDeContatos).padStart(4, "0")}`,
      principal: true,
    });
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(c.ws, {
      canalId: c.canalId,
      contatoId: contato.id,
      titulo: "Ana",
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_dona" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_dona" },
    });
    const mensagens = criarRepositorioDeMensagensPg(pool());
    const criada = await mensagens.inserir(c.ws, {
      conversaId: conversa.id,
      canalId: c.canalId,
      direcao: "enviada",
      ator: { tipo: "member", id: "mem_dona" },
      conteudo: "olá",
      statusEntrega: "pendente",
    });
    if (idExterno !== undefined) await mensagens.gravarEnvio(c.ws, criada.id, { idExterno, em: "2026-11-09T09:00:00.000Z" });
    return criada.id;
  }

  /** Um Canal REAL (`conexao_simulada = false`) cujo provedor é o falso registrado como `whatsapp-nao-oficial`. */
  async function cenarioReal(rotulo: string, conexao: "conectada" | "desconectada") {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [ws]);
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770002",
      conexao,
      conexaoSimulada: false,
      configuradoPor: "mem_dona",
    });
    return { ws, canalId };
  }

  const registroComProvedorReal = (): RegistroDeProvedores => ({
    ...registroPadrao(),
    porProvedor: { "whatsapp-nao-oficial": provedorDeTeste },
  });

  const revisaoDoEspaco = async (ws: string) =>
    Number((await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!.revisao);

  const conexaoDoCanal = async (ws: string, canalId: string) =>
    (
      await pool().query<{ conexao: string; conectada_em: Date | null }>(
        "select conexao, conectada_em from plataforma.canais where workspace_id = $1 and id = $2",
        [ws, canalId],
      )
    ).rows[0]!;

  const linhasDoOutbox = async (ws: string, mensagemId: string) =>
    (
      await pool().query<{ status: string; attempts: number }>(
        "select status, attempts from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
        [ws, mensagemId],
      )
    ).rows;

  const estadoDaMensagem = async (ws: string, id: string) =>
    (
      await pool().query<{ status_entrega: string | null; status_entrega_em: Date | null; motivo_falha: string | null }>(
        "select status_entrega, status_entrega_em, motivo_falha from plataforma.mensagens where workspace_id = $1 and id = $2",
        [ws, id],
      )
    ).rows[0]!;

  /** Grava uma linha na fila como a rota gravaria (ou como um worker que caiu a deixou). */
  async function semearLinha(
    c: { ws: string; canalId: string },
    corpo: unknown,
    extras: { estado?: string; tentativas?: number; travadaHaMinutos?: number } = {},
  ): Promise<string> {
    const r = await pool().query<{ id: string }>(
      `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, corpo, estado, tentativas, locked_at, locked_by)
       values ($1, $2, 'teste', $3::jsonb, $4, $5, now() - make_interval(mins => $6), case when $6::int is null then null else 'worker-que-caiu' end)
       returning id`,
      [c.ws, c.canalId, JSON.stringify(corpo), extras.estado ?? "pendente", extras.tentativas ?? 0, extras.travadaHaMinutos ?? null],
    );
    return r.rows[0]!.id;
  }

  const lerLinha = async (id: string): Promise<LinhaDaFila> =>
    (
      await pool().query<LinhaDaFila>(
        "select estado, tentativas, ultimo_erro, resultado, disponivel_em > now() as no_futuro, locked_at from plataforma.webhooks_recebidos where id = $1",
        [id],
      )
    ).rows[0]!;

  const contarMensagens = async (ws: string) =>
    (await pool().query<{ n: number }>("select count(*)::int as n from plataforma.mensagens where workspace_id = $1", [ws])).rows[0]!.n;

  /** Um registro cujo provedor de teste tem o `interpretarChamada` trocado. */
  function registroComInterpretador(interpretarChamada: (typeof provedorDeTeste)["interpretarChamada"]): RegistroDeProvedores {
    return { ...registroPadrao(), teste: { ...provedorDeTeste, interpretarChamada } };
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  it("uma linha `processando` com trava de 3 min (worker que caiu) volta a pendente e a Mensagem existe uma vez só", async () => {
    const c = await cenario("trava");
    const id = await semearLinha(c, corpoDeMensagem("e1"), { estado: "processando", tentativas: 1, travadaHaMinutos: 3 });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", tentativas: 2 });
    expect(await contarMensagens(c.ws)).toBe(1);

    expect(await processador.processarUm()).toBe(false);
    expect(await contarMensagens(c.ws)).toBe(1);
  });

  it("uma trava recente (agora) não é tomada de quem a segura", async () => {
    const c = await cenario("travarec");
    const id = await semearLinha(c, corpoDeMensagem("e1"), { estado: "processando", tentativas: 1, travadaHaMinutos: 0 });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(false);
    expect(await lerLinha(id)).toMatchObject({ estado: "processando", tentativas: 1 });
    expect(await contarMensagens(c.ws)).toBe(0);
  });

  it("a trava vencida de uma linha que já gastou as tentativas vira `falhou`, não volta para sempre", async () => {
    const c = await cenario("travamax");
    const id = await semearLinha(c, corpoDeMensagem("e1"), { estado: "processando", tentativas: 8, travadaHaMinutos: 5 });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(false);
    expect(await lerLinha(id)).toMatchObject({ estado: "falhou", ultimo_erro: "TRAVA_VENCIDA" });
    expect(await contarMensagens(c.ws)).toBe(0);
  });

  it("falha transitória: volta a pendente com espera e erro saneado; na 8ª tentativa fica `falhou`", async () => {
    const c = await cenario("retry");
    const id = await semearLinha(c, corpoDeMensagem("e1"));
    const registro = registroComInterpretador(() => {
      throw new Error("o provedor caiu com Bearer abc123segredo");
    });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, registro });

    expect(await processador.processarUm()).toBe(true);
    const depoisDaPrimeira = await lerLinha(id);
    expect(depoisDaPrimeira).toMatchObject({ estado: "pendente", tentativas: 1, no_futuro: true, locked_at: null });
    expect(depoisDaPrimeira.ultimo_erro).not.toContain("abc123segredo");
    expect(depoisDaPrimeira.ultimo_erro).toContain("[removido]");
    // Ainda na espera: nada a reivindicar.
    expect(await processador.processarUm()).toBe(false);

    // A 8ª tentativa: sem espera restante, a linha desiste.
    await pool().query("update plataforma.webhooks_recebidos set tentativas = 7, disponivel_em = now() where id = $1", [id]);
    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "falhou", tentativas: 8 });
    expect(await processador.processarUm()).toBe(false);
  });

  it("recusa de regra do recebimento (409 CANAL_ARQUIVADO) é permanente: `falhou` com o código, sem nova tentativa", async () => {
    const c = await cenario("recusa");
    const id = await semearLinha(c, corpoDeMensagem("e1"));
    const recebimento: ServicoDeRecebimento = {
      receberMensagem: async () => recusa<never>(409, "Um Canal arquivado não recebe Mensagem.", { codigo: "CANAL_ARQUIVADO" }),
    };
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, recebimento });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "falhou", tentativas: 1, ultimo_erro: "CANAL_ARQUIVADO" });
    expect(await processador.processarUm()).toBe(false);
  });

  it("Canal arquivado depois da chamada: `falhou` com CANAL_ARQUIVADO e nenhuma Mensagem", async () => {
    const c = await cenario("arquivado");
    const id = await semearLinha(c, corpoDeMensagem("e1"));
    await pool().query(
      "update plataforma.canais set conexao = 'desconectada', conexao_simulada = false, estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2",
      [c.ws, c.canalId],
    );
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "falhou", ultimo_erro: "CANAL_ARQUIVADO" });
    expect(await contarMensagens(c.ws)).toBe(0);
  });

  it("evento ignorado (corpo inválido) fica processado com o motivo", async () => {
    const c = await cenario("ignorado");
    const id = await semearLinha(c, { qualquer: "coisa" });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "ignorado:formato_invalido" });
    expect(await contarMensagens(c.ws)).toBe(0);
  });

  it("evento de conexão num Canal simulado e status de Mensagem desconhecida ficam processados como ignorados, com o motivo", async () => {
    const c = await cenario("semtrat");
    const id = await semearLinha(c, {
      eventos: [
        { tipo: "status", idExterno: "e9", status: "entregue", em: "2026-11-09T10:00:00.000Z" },
        { tipo: "conexao", conexao: "desconectada" },
      ],
    });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "ignorado:status_sem_mensagem,ignorado:conexao_simulada" });
  });

  it("evento conexão conectada num Canal REAL desconectado: o Canal conecta, a revisão do Espaço sobe e a Mensagem pendente ganha a linha do outbox", async () => {
    const c = await cenarioReal("conexao", "desconectada");
    const pendente = await mensagemEnviada(c);
    expect(await linhasDoOutbox(c.ws, pendente)).toEqual([]);
    const revisaoAntes = await revisaoDoEspaco(c.ws);
    const id = await semearLinha(c, { eventos: [{ tipo: "conexao", conexao: "conectada" }] });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, registro: registroComProvedorReal() });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: null });
    const canal = await conexaoDoCanal(c.ws, c.canalId);
    expect(canal.conexao).toBe("conectada");
    expect(canal.conectada_em).not.toBeNull();
    expect(await revisaoDoEspaco(c.ws)).toBe(revisaoAntes + 1);
    expect(await linhasDoOutbox(c.ws, pendente)).toEqual([{ status: "pending", attempts: 0 }]);
    expect((await estadoDaMensagem(c.ws, pendente)).status_entrega).toBe("pendente");
  });

  it("evento conexão desconectada num Canal REAL conectado: o Canal cai, a revisão sobe e nada é reenfileirado", async () => {
    const c = await cenarioReal("conexaocai", "conectada");
    const pendente = await mensagemEnviada(c);
    const revisaoAntes = await revisaoDoEspaco(c.ws);
    const id = await semearLinha(c, { eventos: [{ tipo: "conexao", conexao: "desconectada" }] });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, registro: registroComProvedorReal() });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: null });
    expect(await conexaoDoCanal(c.ws, c.canalId)).toMatchObject({ conexao: "desconectada", conectada_em: null });
    expect(await revisaoDoEspaco(c.ws)).toBe(revisaoAntes + 1);
    expect(await linhasDoOutbox(c.ws, pendente)).toEqual([]);
  });

  it("o mesmo evento conectada de novo (Canal já conectado): a revisão não sobe e a linha do outbox continua uma só", async () => {
    const c = await cenarioReal("conexaorepete", "desconectada");
    const pendente = await mensagemEnviada(c);
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, registro: registroComProvedorReal() });
    await semearLinha(c, { eventos: [{ tipo: "conexao", conexao: "conectada" }] });
    expect(await processador.processarUm()).toBe(true);
    const revisaoDepoisDaPrimeira = await revisaoDoEspaco(c.ws);

    await semearLinha(c, { eventos: [{ tipo: "conexao", conexao: "conectada" }] });
    expect(await processador.processarUm()).toBe(true);
    expect(await revisaoDoEspaco(c.ws)).toBe(revisaoDepoisDaPrimeira);
    expect(await linhasDoOutbox(c.ws, pendente)).toEqual([{ status: "pending", attempts: 0 }]);
  });

  it("evento conexão num Canal SIMULADO: ignorado:conexao_simulada e nada muda (a conexão simulada é dos botões da ficha)", async () => {
    const c = await cenario("conexaosim");
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing", [c.ws]);
    const revisaoAntes = await revisaoDoEspaco(c.ws);
    const id = await semearLinha(c, { eventos: [{ tipo: "conexao", conexao: "desconectada" }] });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "ignorado:conexao_simulada" });
    expect((await conexaoDoCanal(c.ws, c.canalId)).conexao).toBe("conectada");
    expect(await revisaoDoEspaco(c.ws)).toBe(revisaoAntes);
  });

  it("evento status (3.6.5): a Mensagem enviada vira lida com o `em` do evento; um entregue atrasado não a faz voltar", async () => {
    const c = await cenario("status");
    const id = await mensagemEnviada(c, "teste-1");
    const lida = await semearLinha(c, { eventos: [{ tipo: "status", idExterno: "teste-1", status: "lida", em: "2026-11-09T10:00:00.000Z" }] });
    const atrasado = await semearLinha(c, { eventos: [{ tipo: "status", idExterno: "teste-1", status: "entregue", em: "2026-11-09T10:05:00.000Z" }] });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(lida)).toMatchObject({ estado: "processado", resultado: null });
    const depoisDaLida = await estadoDaMensagem(c.ws, id);
    expect(depoisDaLida.status_entrega).toBe("lida");
    expect(depoisDaLida.status_entrega_em?.toISOString()).toBe("2026-11-09T10:00:00.000Z");

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(atrasado)).toMatchObject({ estado: "processado", resultado: "ignorado:status_atrasado" });
    const depoisDoAtrasado = await estadoDaMensagem(c.ws, id);
    expect(depoisDoAtrasado.status_entrega).toBe("lida");
    expect(depoisDoAtrasado.status_entrega_em?.toISOString()).toBe("2026-11-09T10:00:00.000Z");
  });

  it("evento status de um idExterno que nenhuma Mensagem do Canal tem: linha processada com ignorado:status_sem_mensagem", async () => {
    const c = await cenario("statussem");
    const outro = await cenario("statusoutro");
    // A mesma id externa existe, mas num Canal de OUTRO Espaço: nunca é a deste.
    const deFora = await mensagemEnviada(outro, "teste-9");
    const id = await semearLinha(c, { eventos: [{ tipo: "status", idExterno: "teste-9", status: "lida", em: "2026-11-09T10:00:00.000Z" }] });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "ignorado:status_sem_mensagem" });
    expect((await estadoDaMensagem(outro.ws, deFora)).status_entrega).toBe("enviada");
  });

  it("evento status falhou: a Mensagem enviada vira falhou com o motivo saneado; uma já entregue continua entregue", async () => {
    const c = await cenario("statusfalha");
    const enviada = await mensagemEnviada(c, "teste-a");
    const entregue = await mensagemEnviada(c, "teste-b");
    await pool().query("update plataforma.mensagens set status_entrega = 'entregue' where workspace_id = $1 and id = $2", [c.ws, entregue]);
    await semearLinha(c, {
      eventos: [
        { tipo: "status", idExterno: "teste-a", status: "falhou", em: "2026-11-09T10:00:00.000Z", motivo: "recusou com Bearer abc123segredo" },
        { tipo: "status", idExterno: "teste-b", status: "falhou", em: "2026-11-09T10:00:00.000Z", motivo: "tarde demais" },
      ],
    });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    const falhou = await estadoDaMensagem(c.ws, enviada);
    expect(falhou.status_entrega).toBe("falhou");
    expect(falhou.motivo_falha).toContain("[removido]");
    expect(falhou.motivo_falha).not.toContain("abc123segredo");
    expect(await estadoDaMensagem(c.ws, entregue)).toMatchObject({ status_entrega: "entregue", motivo_falha: null });
  });

  it("acordar() com o laço em 60 s processa em menos de 500 ms, e duas chamadas seguidas não rodam dois ciclos juntos", async () => {
    const c = await cenario("acordar");
    const ids = [await semearLinha(c, corpoDeMensagem("e1")), await semearLinha(c, corpoDeMensagem("e2"))];

    const real = criarServicoDeRecebimento({ pool });
    let emVoo = 0;
    let maximoEmVoo = 0;
    const recebimento: ServicoDeRecebimento = {
      async receberMensagem(...argumentos) {
        emVoo += 1;
        maximoEmVoo = Math.max(maximoEmVoo, emVoo);
        await new Promise((resolver) => setTimeout(resolver, 40));
        try {
          return await real.receberMensagem(...argumentos);
        } finally {
          emVoo -= 1;
        }
      },
    };
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, recebimento, intervaloMs: 60_000 });
    processador.iniciar();
    try {
      const inicio = Date.now();
      processador.acordar();
      processador.acordar();
      while (Date.now() - inicio < 2_000) {
        const estados = await Promise.all(ids.map(async (id) => (await lerLinha(id)).estado));
        if (estados.every((estado) => estado === "processado")) break;
        await new Promise((resolver) => setTimeout(resolver, 20));
      }
      expect(Date.now() - inicio).toBeLessThan(500);
      expect(await Promise.all(ids.map(async (id) => (await lerLinha(id)).estado))).toEqual(["processado", "processado"]);
      expect(maximoEmVoo).toBe(1);
      expect(await contarMensagens(c.ws)).toBe(2);
    } finally {
      await processador.parar();
    }
  });

  // --- 16-10 (3.9.4, D-16-08): a mídia que chega é baixada antes da transação; a que falhou por instabilidade se completa ---

  const corpoComAudio = (idExterno: string, referencia: string) => ({
    eventos: [
      {
        tipo: "mensagem",
        idExterno,
        remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana" },
        anexos: [{ referenciaNoProvedor: referencia, tipoDeMidia: "audio/ogg", nome: "audio.ogg" }],
      },
    ],
  });
  const ogg = (bytes: number) => {
    const conteudo = new Uint8Array(bytes);
    conteudo.set(Buffer.from("OggS"));
    return conteudo;
  };
  /** Um provedor de teste cujo `baixarMidia` obedece a `falhar()`: lança erro de rede enquanto for verdadeiro. */
  function registroComDownloadInstavel(falhar: () => boolean): RegistroDeProvedores {
    return {
      ...registroPadrao(),
      teste: {
        ...provedorDeTeste,
        baixarMidia: async (canal, referencia, opcoes) => {
          if (falhar()) throw new Error("read ECONNRESET");
          return provedorDeTeste.baixarMidia(canal, referencia, opcoes);
        },
      },
    };
  }
  const liberarAgora = (id: string) => pool().query("update plataforma.webhooks_recebidos set disponivel_em = now() where id = $1", [id]);
  const anexosDoEspaco = async (ws: string) =>
    (await pool().query<{ id: string; anexos: Array<Record<string, unknown>> }>("select id, anexos from plataforma.mensagens where workspace_id = $1", [ws])).rows;

  it("falha transitória da mídia: a Mensagem é gravada com o anexo baixado: false e a linha volta a pendente (midia_pendente); a passada seguinte completa a MESMA Mensagem e avisa mensagem.status", async () => {
    provedorDeTeste.limpar();
    const c = await cenario("midiatrans");
    const armazenamento = criarArmazenamentoFalso();
    provedorDeTeste.guardarMidia("ref-t1", { bytes: ogg(2048), tipoDeMidia: "audio/ogg" });
    let instavel = true;
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, armazenamento, registro: registroComDownloadInstavel(() => instavel) });
    const id = await semearLinha(c, corpoComAudio("audio-1", "ref-t1"));

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "pendente", resultado: "midia_pendente", tentativas: 1, no_futuro: true, locked_at: null });
    const primeira = await anexosDoEspaco(c.ws);
    expect(primeira).toHaveLength(1);
    expect(primeira[0]!.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "ref-t1", baixado: false }]);
    expect(armazenamento.chavesGuardadas()).toEqual([]);

    // A segunda passada, com a mídia disponível: a mesma Mensagem ganha o arquivo, e a aba é avisada.
    instavel = false;
    await liberarAgora(id);
    const avisos: Array<Record<string, unknown>> = [];
    const ouvinte = new Client({ connectionString: process.env.DATABASE_URL });
    await ouvinte.connect();
    ouvinte.on("notification", (n) => {
      const lido = n.payload ? (JSON.parse(n.payload) as Record<string, unknown>) : {};
      if (n.channel === CANAL_DO_NOTIFY && lido.workspaceId === c.ws) avisos.push(lido);
    });
    await ouvinte.query(`LISTEN ${CANAL_DO_NOTIFY}`);
    try {
      expect(await processador.processarUm()).toBe(true);
      const limite = Date.now() + 2_000;
      while (avisos.length < 1 && Date.now() < limite) await new Promise((resolver) => setTimeout(resolver, 10));
    } finally {
      await ouvinte.end();
    }

    expect(await lerLinha(id)).toMatchObject({ estado: "processado", tentativas: 2, resultado: null });
    const depois = await anexosDoEspaco(c.ws);
    expect(depois).toHaveLength(1);
    expect(depois[0]!.id).toBe(primeira[0]!.id);
    expect(depois[0]!.anexos).toEqual([
      { tipoDeMidia: "audio/ogg", nome: "audio.ogg", objectKey: expect.stringMatching(new RegExp(`^workspace/${c.ws}/entrada/${c.canalId}/`)), tamanhoBytes: 2048, baixado: true },
    ]);
    expect(avisos).toEqual([{ workspaceId: c.ws, tipo: "mensagem.status", conversaId: expect.any(String), mensagemId: primeira[0]!.id }]);
  });

  it("depois de 3 passadas sem a mídia: a linha fica processado com midia_indisponivel, e a Mensagem segue gravada com o anexo marcado como indisponível", async () => {
    provedorDeTeste.limpar();
    const c = await cenario("midia3");
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, armazenamento: criarArmazenamentoFalso(), registro: registroComDownloadInstavel(() => true) });
    const id = await semearLinha(c, corpoComAudio("audio-1", "ref-t3"));

    for (const esperada of ["midia_pendente", "midia_pendente"]) {
      expect(await processador.processarUm()).toBe(true);
      expect(await lerLinha(id)).toMatchObject({ estado: "pendente", resultado: esperada });
      await liberarAgora(id);
    }
    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "midia_indisponivel", tentativas: 3, locked_at: null });
    expect(await processador.processarUm()).toBe(false);

    const mensagens = await anexosDoEspaco(c.ws);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]!.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "ref-t3", baixado: false }]);
  });

  it("mídia que o provedor já esqueceu (MIDIA_INDISPONIVEL) não pede nova passada: a Mensagem é gravada e a linha fica processada", async () => {
    provedorDeTeste.limpar();
    const c = await cenario("midiaperdida");
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves, armazenamento: criarArmazenamentoFalso() });
    const id = await semearLinha(c, corpoComAudio("audio-1", "ref-que-nao-existe"));

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", tentativas: 1 });
    expect((await anexosDoEspaco(c.ws))[0]!.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "ref-que-nao-existe", baixado: false }]);
  });

  it("registra UMA linha de etapas por chamada, com o id da linha e só números (nenhum dado pessoal)", async () => {
    provedorDeTeste.limpar();
    const c = await cenario("etapas");
    provedorDeTeste.guardarMidia("ref-e1", { bytes: ogg(1024), tipoDeMidia: "audio/ogg" });
    const registros: Array<{ nivel: string; mensagem: string; dados?: Record<string, unknown> }> = [];
    const processador = criarProcessadorDeEntrada({
      workerId: "w1",
      chaves,
      armazenamento: criarArmazenamentoFalso(),
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
    });
    const id = await semearLinha(c, corpoComAudio("audio-1", "ref-e1"));

    expect(await processador.processarUm()).toBe(true);
    const etapas = registros.filter((r) => r.mensagem === "mensageria.etapas");
    expect(etapas).toHaveLength(1);
    const dados = etapas[0]!.dados!;
    expect(Object.keys(dados).sort()).toEqual(["anexos", "baixarMs", "esperaMs", "subirMs", "totalMs", "transacaoMs", "webhookId"]);
    expect(dados.webhookId).toBe(id);
    expect(dados.anexos).toBe(1);
    for (const chave of ["esperaMs", "baixarMs", "subirMs", "transacaoMs", "totalMs"]) {
      expect(typeof dados[chave]).toBe("number");
      expect(Number.isFinite(dados[chave])).toBe(true);
      expect(dados[chave] as number).toBeGreaterThanOrEqual(0);
    }
    expect(dados.totalMs as number).toBeGreaterThanOrEqual(dados.transacaoMs as number);
    // Nem o telefone, nem o nome do arquivo, nem a referência do provedor entram na linha de etapas.
    const texto = JSON.stringify(etapas);
    for (const proibido of [WHATSAPP_DA_ANA, "audio.ogg", "ref-e1", "Ana"]) expect(texto).not.toContain(proibido);
  });
});
