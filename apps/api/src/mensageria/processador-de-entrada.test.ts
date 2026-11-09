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
import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDeRecebimento, type ServicoDeRecebimento } from "../servicos/crm/recebimento";
import { recusa } from "../servicos/crm/resultado";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "./provedor";
import { criarProcessadorDeEntrada } from "./processador-de-entrada";
import { provedorDeTeste } from "./provedores/teste";
import { registroPadrao, type RegistroDeProvedores } from "./registro";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const WHATSAPP_DA_ANA = "+5511987654321";

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

  it("eventos de status e conexão ficam processados como sem tratamento (o 16-05 os trata)", async () => {
    const c = await cenario("semtrat");
    const id = await semearLinha(c, {
      eventos: [
        { tipo: "status", idExterno: "e9", status: "entregue", em: "2026-11-09T10:00:00.000Z" },
        { tipo: "conexao", conexao: "desconectada" },
      ],
    });
    const processador = criarProcessadorDeEntrada({ workerId: "w1", chaves });

    expect(await processador.processarUm()).toBe(true);
    expect(await lerLinha(id)).toMatchObject({ estado: "processado", resultado: "sem_tratamento:status,sem_tratamento:conexao" });
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
});
