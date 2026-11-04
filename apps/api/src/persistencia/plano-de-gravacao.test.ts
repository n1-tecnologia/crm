/**
 * `estadoDasLinhas`, `planejarGravacao` e `sqlsDoPlano` (Fase 13): as partes
 * de `hidratar()` e `gravar()` que `executar()` usa para mandar várias
 * instruções numa ida só. Sem banco; a prova de que o SQL grava o mesmo que
 * `gravar()` por parâmetros está em `unidade-de-trabalho-em-lote.test.ts`.
 *
 * O primeiro teste existe porque a rota devolve `dados` do que `executar()`
 * gravou, e uma chave de mapa errada em `planejarGravacao` o deixou indefinido
 * em toda diferença: só a suíte das rotas, que lê `dados`, percebeu.
 */
import { describe, expect, it } from "vitest";
import { estadoDasLinhas, planejarGravacao, sqlsDoPlano, type LinhaDoEspaco } from "./repositorio";

const REVISAO = "3";
const linha = (colecao: string, id: string, dados: unknown, ordem: number): LinhaDoEspaco => ({ colecao, id, dados, ordem, revisao: REVISAO });
const hidratar = (linhas: LinhaDoEspaco[]) => estadoDasLinhas("ws", { rowCount: linhas.length, rows: linhas });
const vazio = () => hidratar([{ colecao: null, id: null, dados: null, ordem: null, revisao: REVISAO }]);
const lists = (estado: ReturnType<typeof vazio>) => estado.state.lists as unknown as Array<{ id: string; name: string }>;

describe("estadoDasLinhas", () => {
  it("monta o estado, a revisão, o texto canônico e a posição de cada registro", () => {
    const antes = hidratar([linha("lists", "lst_1", { name: "A", id: "lst_1" }, 0), linha("lists", "lst_2", { id: "lst_2", name: "B" }, 1)]);
    expect(antes.revisao).toBe(3);
    expect(lists(antes).map((l) => l.id)).toEqual(["lst_1", "lst_2"]);
    // As chaves saem em ordem alfabética: é com este texto que o diff compara.
    expect(antes.original.get("lists")!.get("lst_1")).toBe('{"id":"lst_1","name":"A"}');
    expect(antes.ordem.get("lists")!.get("lst_2")).toBe(1);
  });

  it("Espaço vazio (só a revisão veio): toda coleção nasce vazia", () => {
    const antes = vazio();
    expect(antes.revisao).toBe(3);
    expect(lists(antes)).toEqual([]);
    expect(antes.original.size).toBe(0);
  });

  it("sem nenhuma linha, o Espaço não existe", () => {
    expect(() => estadoDasLinhas("ws_x", { rowCount: 0, rows: [] })).toThrow('Espaço de Trabalho "ws_x" não existe.');
  });
});

describe("planejarGravacao", () => {
  it("devolve em `dados` o PRÓPRIO registro que a operação produziu (a rota o recorta e o devolve)", () => {
    const antes = vazio();
    const novo = { id: "lst_novo", name: "Nova" };
    lists(antes).push(novo);

    const plano = planejarGravacao(antes.state, antes);

    expect(plano.upserts).toEqual([["lists", "lst_novo", '{"id":"lst_novo","name":"Nova"}', 0]]);
    expect(plano.diferenca.gravados).toHaveLength(1);
    expect(plano.diferenca.gravados[0]).toMatchObject({ colecao: "lists", id: "lst_novo", ordem: 0 });
    expect(plano.diferenca.gravados[0]!.dados).toBe(novo);
    expect(plano.diferenca.removidos).toEqual([]);
  });

  it("só grava o que mudou: o registro igual fica de fora, o alterado entra", () => {
    const antes = hidratar([linha("lists", "lst_1", { id: "lst_1", name: "A" }, 0), linha("lists", "lst_2", { id: "lst_2", name: "B" }, 1)]);
    expect(planejarGravacao(antes.state, antes).upserts).toEqual([]);

    lists(antes)[1]!.name = "B2";
    const plano = planejarGravacao(antes.state, antes);
    expect(plano.upserts.map((u) => u[1])).toEqual(["lst_2"]);
    expect(plano.diferenca.gravados[0]!.dados).toBe(lists(antes)[1]);
  });

  it("o que sumiu do estado vira removido, com colecao e id", () => {
    const antes = hidratar([linha("lists", "lst_1", { id: "lst_1", name: "A" }, 0), linha("lists", "lst_2", { id: "lst_2", name: "B" }, 1)]);
    antes.state.lists.splice(0, 1);

    const plano = planejarGravacao(antes.state, antes);

    expect(plano.removidos).toEqual([["lists", "lst_1"]]);
    expect(plano.diferenca.removidos).toEqual([{ colecao: "lists", id: "lst_1" }]);
    expect(plano.upserts).toEqual([]);
  });

  it("registro sem id lança", () => {
    const antes = vazio();
    (antes.state.lists as unknown as unknown[]).push({ name: "sem id" });
    expect(() => planejarGravacao(antes.state, antes)).toThrow('Registro sem id em "lists".');
  });
});

describe("sqlsDoPlano", () => {
  const TEXTO_HOSTIL = "aspas ' \" barra \\ dólares $$ $1 $n1_000000000000$ linha\nnova \u{1F600}";

  /**
   * Os literais entre dólares de uma instrução, na ordem em que aparecem. Fecha com a MESMA marca que abriu
   * (referência retroativa), como o Postgres lê: o `$n1_000000000000$` do texto hostil não fecha nada.
   */
  const literais = (sql: string) => [...sql.matchAll(/(\$n1_[0-9a-f]{12}\$)([\s\S]*?)\1/g)].map((m) => m[2]!);

  it("plano vazio: nenhuma instrução", () => {
    const antes = vazio();
    expect(sqlsDoPlano("ws", planejarGravacao(antes.state, antes))).toEqual([]);
  });

  it("um insert e um delete, sem parâmetros, com os dados de volta idênticos dentro do literal", () => {
    const antes = hidratar([linha("lists", "lst_1", { id: "lst_1", name: "A" }, 0)]);
    antes.state.lists.splice(0, 1);
    lists(antes).push({ id: "lst_2", name: TEXTO_HOSTIL });

    const plano = planejarGravacao(antes.state, antes);
    const sqls = sqlsDoPlano("ws", plano);

    expect(sqls).toHaveLength(2);
    expect(sqls[0]).toMatch(/^insert into plataforma\.registros/);
    expect(sqls[1]).toMatch(/^delete from plataforma\.registros/);
    for (const sql of sqls) {
      expect(sql).toContain("jsonb_to_recordset");
      // Sem parâmetro: `$1` só pode aparecer como parte do texto do literal.
      expect(sql.replace(/(\$n1_[0-9a-f]{12}\$)[\s\S]*?\1/g, "")).not.toMatch(/\$\d/);
    }
    const [espaco, linhas] = literais(sqls[0]!);
    expect(espaco).toBe("ws");
    expect(JSON.parse(linhas!)).toEqual([{ c: "lists", i: "lst_2", d: '{"id":"lst_2","name":' + JSON.stringify(TEXTO_HOSTIL) + "}", o: 0 }]);
    expect(JSON.parse(literais(sqls[1]!)[1]!)).toEqual([{ c: "lists", i: "lst_1" }]);
  });
});
