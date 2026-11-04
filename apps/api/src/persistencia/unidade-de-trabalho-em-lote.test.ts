/**
 * Fase 13 — o regime `travado` em DUAS idas ao banco, contra um Postgres de verdade.
 *
 * Cada ida custa a distância até o banco (cerca de 52 ms de Chicago a Oregon,
 * medido em produção) e a Fase 12 fazia sete por gravação. O que se prova aqui
 * não cabe num pool falso:
 *
 *   - quantas idas uma gravação faz (`idasEVoltas`), e que a recusa, o
 *     `aoConfirmar` e o evento de saída seguem pelo caminho certo;
 *   - que o lote de SAÍDA grava exatamente o que `gravar()` (parâmetros)
 *     gravaria — o teste diferencial, com texto hostil, números fracionários,
 *     remoção e carga grande;
 *   - que uma instrução que falha no meio do lote desfaz a transação inteira;
 *   - que os Canais lidos dentro do lote de entrada chegam à operação.
 *
 * SÓ Postgres local descartável (`describeComBanco` pula fora de
 * localhost/127.0.0.1). Um teste de banco que sai "skipped" NÃO prova nada.
 *
 *   docker run -d --rm --name crm-n1-pg-13 -e POSTGRES_PASSWORD=x -p 55613:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55613/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55613/postgres \
 *     npx vitest run src/persistencia/unidade-de-trabalho-em-lote.test.ts
 *   docker rm -f crm-n1-pg-13
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { createList } from "@n1/dominio/operations";
import { fail, ok } from "@n1/dominio/state";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "./conexao";
import { executar, type MedicaoDaExecucao } from "./unidade-de-trabalho";
import { gravar, hidratar, planejarGravacao, semear, sqlsDoPlano } from "./repositorio";
import { literalEntreDolares } from "./sql-literal";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";

const PROPRIETARIO = "mem_thiago";
const ESPACO_DO_SEED = "spc_com";

const criarLista = (nome: string) => (state: DataState) =>
  createList(state, PROPRIETARIO, { name: nome, parentType: "space", parentId: ESPACO_DO_SEED });

/** O que mais machuca um literal SQL e um JSON: aspas, barra, dólares, a própria marca, quebras de linha e Unicode. */
const TEXTO_HOSTIL = "aspas ' \" barra \\ \\\\ dólares $$ $1 $n1_000000000000$ ${x} linha\nnova\ttab   \u{1F600} fim";

async function semeado(rotulo: string): Promise<string> {
  const ws = novoEspacoDeTeste(rotulo);
  const cliente = await pool().connect();
  try {
    await semear(cliente, ws, buildSeed());
  } finally {
    cliente.release();
  }
  return ws;
}

async function revisaoDe(ws: string): Promise<number> {
  const r = await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws]);
  return Number(r.rows[0]!.revisao);
}

async function registrosDe(ws: string) {
  const r = await pool().query<{ colecao: string; id: string; dados: string; ordem: number; revisao: string }>(
    "select colecao, id, dados::text as dados, ordem, revisao from plataforma.registros where workspace_id = $1 order by colecao, id",
    [ws],
  );
  return r.rows;
}

function coletor() {
  const medicoes: MedicaoDaExecucao[] = [];
  return { medicoes, aoMedir: (m: MedicaoDaExecucao) => void medicoes.push(m) };
}

describeComBanco("executar() no regime travado: duas idas ao banco (Fase 13)", () => {
  const espacos: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  async function novo(rotulo: string): Promise<string> {
    const ws = await semeado(rotulo);
    espacos.push(ws);
    return ws;
  }

  it("uma gravação comum vai duas vezes ao banco; a primeira do processo paga a guarda dos Canais, as seguintes não", async () => {
    const ws = await novo("idas");
    const n = await revisaoDe(ws);
    const primeira = coletor();
    const segunda = coletor();

    const r1 = await executar(ws, criarLista("Lista 1"), { aoMedir: primeira.aoMedir });
    const r2 = await executar(ws, criarLista("Lista 2"), { aoMedir: segunda.aoMedir });

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok || "conflito" in r1 || "conflito" in r2) throw new Error("as duas gravações deviam confirmar");
    expect(r1.revisao).toBe(n + 1);
    expect(r2.revisao).toBe(n + 2);
    expect(r2.revisaoAnterior).toBe(n + 1);
    // A rota recorta e devolve `dados`: o que a operação produziu tem de chegar, não só o id.
    const nomes = r2.diferenca.gravados.filter((g) => g.colecao === "lists").map((g) => (g.dados as { name: string }).name);
    expect(nomes).toEqual(["Lista 2"]);
    expect(segunda.medicoes[0]!.idasEVoltas).toBe(2);
    expect(primeira.medicoes[0]!.idasEVoltas).toBeLessThanOrEqual(4);
    // A ida e volta de cada lote está em inicioMs e gravarMs; a trava, o update e o commit não têm etapa própria.
    expect(segunda.medicoes[0]).toMatchObject({ regime: "travado", tentativas: 1, desfecho: "gravou", travaMs: 0, atualizaMs: 0, commitMs: 0 });
    expect(segunda.medicoes[0]!.linhasLidas).toBeGreaterThan(100);
    expect(segunda.medicoes[0]!.linhasGravadas).toBeGreaterThan(0);
    expect(await revisaoDe(ws)).toBe(n + 2);
  });

  it("a recusa do domínio: duas idas (entrada e rollback), nada gravado, e a revisão não muda", async () => {
    const ws = await novo("recusa");
    await executar(ws, criarLista("aquece a guarda dos Canais"));
    const n = await revisaoDe(ws);
    const antes = await registrosDe(ws);
    const { medicoes, aoMedir } = coletor();

    const r = await executar(ws, () => fail("recusado de propósito"), { aoMedir });

    expect(r).toMatchObject({ ok: false, error: "recusado de propósito" });
    expect(r).not.toHaveProperty("conflito");
    expect(medicoes[0]).toMatchObject({ desfecho: "recusou", idasEVoltas: 2 });
    expect(await revisaoDe(ws)).toBe(n);
    expect(await registrosDe(ws)).toEqual(antes);
  });

  it("com aoConfirmar o fim volta a ser instrução por instrução (revisão, escrita, commit) e a gravação continua correta", async () => {
    const ws = await novo("confirmar");
    await executar(ws, criarLista("aquece a guarda dos Canais"));
    const n = await revisaoDe(ws);
    const { medicoes, aoMedir } = coletor();
    let chamadas = 0;

    const r = await executar(ws, criarLista("Lista com aoConfirmar"), {
      aoMedir,
      aoConfirmar: async (cliente) => {
        chamadas += 1;
        await cliente.query("select 1");
      },
    });

    expect(r.ok).toBe(true);
    expect(chamadas).toBe(1);
    // entrada + update da revisão + insert dos registros + select 1 do aoConfirmar + commit
    expect(medicoes[0]!.idasEVoltas).toBe(5);
    expect(await revisaoDe(ws)).toBe(n + 1);
    const nomes = (await registrosDe(ws)).filter((x) => x.colecao === "lists").map((x) => JSON.parse(x.dados).name);
    expect(nomes).toContain("Lista com aoConfirmar");
  });

  it("com evento de saída (outbox) o fim também segue instrução por instrução, e o evento entra na mesma transação", async () => {
    const ws = await novo("evento");
    await executar(ws, criarLista("aquece a guarda dos Canais"));
    const { medicoes, aoMedir } = coletor();
    const idDoComentario = `cmt_${ws}`;

    const r = await executar(ws, criarLista("Lista com evento"), {
      aoMedir,
      eventos: () => [
        {
          type: "solicitacao.comentario-criado.v1",
          aggregateType: "comment",
          aggregateId: idDoComentario,
          payload: { taskId: "tsk_teste", commentId: idDoComentario, authorMemberId: PROPRIETARIO },
        },
      ],
    });

    expect(r.ok).toBe(true);
    // entrada + update da revisão + insert dos registros + insert do evento + commit
    expect(medicoes[0]!.idasEVoltas).toBe(5);
    const outbox = await pool().query<{ event_type: string }>("select event_type from plataforma.integration_outbox where workspace_id = $1", [ws]);
    expect(outbox.rows).toEqual([{ event_type: "solicitacao.comentario-criado.v1" }]);
  });

  it("os Canais da tabela própria, lidos dentro do lote de entrada, chegam à operação — e não são gravados em registros", async () => {
    const ws = await novo("canais");
    await executar(ws, criarLista("aquece a guarda dos Canais"));
    const idDoCanal = await semearCanal(ws, { nome: "Canal do lote", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "5511999990000" });
    const { medicoes, aoMedir } = coletor();
    let vistos: string[] = [];

    const r = await executar(
      ws,
      (state) => {
        vistos = state.channels.map((c) => c.id);
        return ok("visto");
      },
      { aoMedir },
    );

    expect(r.ok).toBe(true);
    expect(vistos).toContain(idDoCanal);
    // Os Canais vieram no lote de entrada (sem ida própria), e a operação não gravou nada: entrada e commit.
    expect(medicoes[0]!.idasEVoltas).toBe(2);
    const gravados = (await registrosDe(ws)).filter((x) => x.colecao === "channels").map((x) => x.id);
    expect(gravados).not.toContain(idDoCanal);
  });

  it("uma instrução que falha no MEIO do lote de saída desfaz a transação inteira, inclusive a revisão, e a seguinte passa", async () => {
    const ws = await novo("falha");
    await executar(ws, criarLista("aquece a guarda dos Canais"));
    const n = await revisaoDe(ws);
    const antes = await registrosDe(ws);
    const { medicoes, aoMedir } = coletor();

    // Um NUL no texto vira `\u0000` no JSON, e o `d::jsonb` do insert recusa (22P05): o `update` da revisão
    // já rodou na mesma mensagem, e o `commit` que vinha depois nunca roda.
    await expect(
      executar(
        ws,
        (state) => {
          state.lists[0]!.name = "com\u0000nulo";
          return ok("x");
        },
        { aoMedir },
      ),
    ).rejects.toMatchObject({ code: "22P05" });

    expect(medicoes[0]).toMatchObject({ desfecho: "excecao" });
    expect(await revisaoDe(ws)).toBe(n);
    expect(await registrosDe(ws)).toEqual(antes);

    const seguinte = await executar(ws, criarLista("Lista depois da falha"));
    expect(seguinte.ok).toBe(true);
    expect(await revisaoDe(ws)).toBe(n + 1);
  });

  it("Espaço que não existe: lança a mesma frase de sempre", async () => {
    await expect(executar("ws_que_nao_existe_13", criarLista("x"))).rejects.toThrow('Espaço de Trabalho "ws_que_nao_existe_13" não existe.');
  });

  it("o literal entre dólares devolve o texto idêntico, também para o que tenta fechá-lo", async () => {
    for (const texto of [TEXTO_HOSTIL, "", "$", "$$", "$n1_", "fim $n1_aaaaaaaaaaaa", "'; drop table plataforma.registros; --", "\\u0000 não é NUL"]) {
      const r = await pool().query<{ t: string }>(`select ${literalEntreDolares(texto)} as t`);
      expect(r.rows[0]!.t).toBe(texto);
    }
  });
});

describeComBanco("o lote de saída grava exatamente o que gravar() gravaria (teste diferencial, Fase 13)", () => {
  const espacos: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  /** Uma mutação pesada e determinística, aplicada ao estado como as operações aplicam: em lugar. Devolve os ids que removeu. */
  function mutar(state: DataState, tamanhoDaCarga: number): string[] {
    const s = state as unknown as {
      lists: Array<{ name: string }>;
      tasks: Array<{ title: string }>;
      activity: Array<Record<string, unknown>>;
    };
    s.lists[0]!.name = TEXTO_HOSTIL;
    s.tasks[0]!.title = `tarefa ${TEXTO_HOSTIL}`;
    // Três removidos do meio — ANTES de inserir, para os índices serem os do estado hidratado.
    const removidos = s.activity.splice(40, 3).map((a) => a.id as string);
    // 25 registros novos entre dois vizinhos: posições fracionárias (a meio caminho, 25 vezes).
    const novos = Array.from({ length: 25 }, (_, i) => ({ id: `act_lote_${String(i).padStart(3, "0")}`, texto: `novo ${i} ${TEXTO_HOSTIL}` }));
    s.activity.splice(1, 0, ...novos);
    // Carga: registros grandes no fim.
    for (let i = 0; i < tamanhoDaCarga; i += 1) {
      s.activity.push({ id: `act_carga_${String(i).padStart(4, "0")}`, texto: `${"x".repeat(4_000)} ${i} ${TEXTO_HOSTIL}` });
    }
    return removidos;
  }

  async function gravarPor(via: "parametros" | "lote", tamanhoDaCarga: number) {
    const ws = await semeado(`dif_${via}`);
    espacos.push(ws);
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const antes = await hidratar(cliente, ws);
      const removidos = mutar(antes.state, tamanhoDaCarga);
      if (via === "parametros") {
        await gravar(cliente, ws, antes.state, antes);
        await cliente.query("commit");
      } else {
        const plano = planejarGravacao(antes.state, antes);
        await cliente.query([...sqlsDoPlano(ws, plano), "commit"].join("; "));
      }
      const plano = planejarGravacao(antes.state, { ...antes, original: new Map(), ordem: new Map() });
      return { ws, gravados: plano.upserts.length, removidos };
    } finally {
      cliente.release();
    }
  }

  for (const [rotulo, carga] of [["carga pequena", 0], ["carga de ~1,6 MB", 400]] as const) {
    it(`${rotulo}: as linhas de plataforma.registros ficam iguais nos dois caminhos`, async () => {
      const a = await gravarPor("parametros", carga);
      const b = await gravarPor("lote", carga);

      const linhasA = await registrosDe(a.ws);
      const linhasB = await registrosDe(b.ws);
      // A mutação mexe de verdade: não é um teste que compara dois vazios.
      expect(linhasA.length).toBe(a.gravados);
      expect(linhasA.some((l) => l.id.startsWith("act_lote_"))).toBe(true);
      expect(linhasA.some((l) => l.dados.includes("aspas"))).toBe(true);
      // Iguais: dados (jsonb em texto), ordem (o double, inclusive as frações) e revisão da linha.
      expect(linhasB).toEqual(linhasA);
    });
  }

  it("a remoção chega: os três registros tirados do meio somem nos dois caminhos", async () => {
    const a = await gravarPor("parametros", 0);
    const b = await gravarPor("lote", 0);
    const idsA = new Set((await registrosDe(a.ws)).map((l) => `${l.colecao}/${l.id}`));
    const idsB = new Set((await registrosDe(b.ws)).map((l) => `${l.colecao}/${l.id}`));
    expect(idsB).toEqual(idsA);
    expect(a.removidos).toHaveLength(3);
    for (const id of a.removidos) {
      expect(idsA.has(`activity/${id}`)).toBe(false);
      expect(idsB.has(`activity/${id}`)).toBe(false);
    }
  });
});
