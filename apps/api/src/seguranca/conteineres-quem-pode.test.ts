/**
 * Fase 10, D-20 (RESEARCH F10) — as quatro operações novas de contêiner,
 * `moveContainer`, `reorderContainers`, `setContainerDefaultViews` e
 * `setContainerBlock`, chamadas por `POST /operacoes/:nome` por quem NÃO pode:
 *
 *   - o Convidado: `ok: false` e o registro gravado no Postgres não muda;
 *   - o Membro (B) sem concessão `administrar` no alvo: `ok: false` e o
 *     registro não muda;
 *   - o Membro `suspenso`: 403 da rota, antes de qualquer operação.
 *
 * A suíte de segurança não tem matriz por operação (F10): este arquivo é o lugar
 * da prova de D-20 para as operações novas. Cada recusa vem com um CONTROLE no
 * fim — o Proprietário faz a mesma chamada e ela funciona — para provar que o
 * `ok: false` é do Papel e não de um argumento errado.
 *
 * A4 (`owner-confirmation: pending`): "editar no pai" de `reorderContainers` é
 * `mayBuild(pai)`, então o Membro que ALCANÇA a Pasta reordena as Listas dela.
 * O caso `A4` abaixo registra isso de propósito, para a UAT; reordenar os
 * ESPAÇOS, esse sim, exige Administrador ou Proprietário.
 *
 * Só Postgres local (`describeComBanco`). Nenhum caso fica pendente: o job
 * `seguranca` conta pendente e todo como teste pulado.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFolder, createList } from "@n1/dominio/operations";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

type Colecao = "spaces" | "folders" | "lists";

describeComBanco("moveContainer, reorderContainers, setContainerDefaultViews e setContainerBlock — quem não pode, não faz (D-20)", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;
  /** O Espaço (não privado, que o Membro B alcança) onde a fábrica monta a Estrutura de teste. */
  let espacoId: string;
  let pastaA: string;
  let pastaB: string;
  let listas: [string, string, string];

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("conteineres");
    const estado = espaco.estado;
    const proprietario = espaco.membros.proprietario.id;
    // Um Espaço que B alcança e que ele NÃO administra: a conferência de B é a do Papel, não a de privacidade.
    const alvo = estado.spaces.find(
      (s) => s.lifecycle === "ativo" && !s.isPrivate && s.id !== "spc_gestao" && !estado.grants.some((g) => g.resourceId === s.id && g.subjectId === espaco.membros.b.id),
    );
    if (!alvo) throw new Error("o seed precisa de um Espaço ativo, não privado, sem concessão a B");
    espacoId = alvo.id;

    const pasta = (name: string): string => {
      const r = createFolder(estado, proprietario, { name, parentType: "space", parentId: espacoId });
      if (!r.ok) throw new Error(r.error);
      return r.value.id;
    };
    const lista = (name: string, folderId: string): string => {
      const r = createList(estado, proprietario, { name, parentType: "folder", parentId: folderId });
      if (!r.ok) throw new Error(r.error);
      return r.value.id;
    };
    pastaA = pasta("Quem pode — A");
    pastaB = pasta("Quem pode — B");
    listas = [lista("Q0", pastaA), lista("Q1", pastaA), lista("Q2", pastaA)];

    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco);
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  const chamar = (token: string, nome: string, args: unknown[]) =>
    app.inject({ method: "POST", url: `/operacoes/${nome}`, headers: { authorization: `Bearer ${token}` }, payload: { args } });

  /** Os registros como estão GRAVADOS no Postgres (não a resposta da operação), em JSON para comparar antes e depois. */
  async function gravado(colecao: Colecao, ids: readonly string[]): Promise<string> {
    const partes: string[] = [];
    for (const id of ids) {
      const r = await pool().query<{ dados: unknown }>("select dados from plataforma.registros where workspace_id = $1 and colecao = $2 and id = $3", [
        espaco.workspaceId,
        colecao,
        id,
      ]);
      partes.push(JSON.stringify(r.rows[0]?.dados ?? null));
    }
    return partes.join("\n");
  }

  const recusou = (corpo: unknown): boolean => (corpo as { ok?: boolean }).ok === false;
  const funcionou = (corpo: unknown): boolean => (corpo as { ok?: boolean }).ok === true;

  /** Cada operação, com argumentos reais do estado da fábrica e os registros que ela mexeria se passasse. */
  const casos = () =>
    [
      {
        nome: "moveContainer",
        args: ["list", listas[0], { parentType: "folder", parentId: pastaB }],
        registros: ["lists", [listas[0], listas[1], listas[2]]],
      },
      {
        nome: "setContainerDefaultViews",
        args: ["folder", pastaA, { disponiveis: ["lista", "quadro"], inicial: "lista" }],
        registros: ["folders", [pastaA]],
      },
      {
        nome: "setContainerBlock",
        args: ["folder", pastaA, "defaultViews", true],
        registros: ["folders", [pastaA]],
      },
    ] as const;

  describe("Convidado: ok false e o registro gravado não muda", () => {
    for (const nome of ["moveContainer", "setContainerDefaultViews", "setContainerBlock"] as const) {
      it(`${nome}: o Convidado é recusado`, async () => {
        const caso = casos().find((c) => c.nome === nome)!;
        const [colecao, ids] = caso.registros;
        const antes = await gravado(colecao, ids);
        const resposta = await chamar(TOKENS_DE_VAZAMENTO.convidado, nome, [...caso.args]);
        expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
        expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
        expect(await gravado(colecao, ids)).toBe(antes);
      });
    }

    it("reorderContainers: o Convidado é recusado nas Listas de uma Pasta e nos Espaços", async () => {
      const antesListas = await gravado("lists", listas);
      const todosOsEspacos = espaco.estado.spaces.map((s) => s.id);
      const antesEspacos = await gravado("spaces", todosOsEspacos);
      const naPasta = await chamar(TOKENS_DE_VAZAMENTO.convidado, "reorderContainers", ["list", { type: "folder", id: pastaA }, [listas[2], listas[0], listas[1]]]);
      expect(naPasta.statusCode, naPasta.body.slice(0, 200)).toBe(200);
      expect(recusou(naPasta.json()), naPasta.body.slice(0, 200)).toBe(true);
      const nosEspacos = await chamar(TOKENS_DE_VAZAMENTO.convidado, "reorderContainers", ["space", null, [...todosOsEspacos].reverse()]);
      expect(recusou(nosEspacos.json()), nosEspacos.body.slice(0, 200)).toBe(true);
      expect(await gravado("lists", listas)).toBe(antesListas);
      expect(await gravado("spaces", todosOsEspacos)).toBe(antesEspacos);
    });
  });

  describe("Membro sem administrar (B): ok false e o registro gravado não muda", () => {
    for (const nome of ["moveContainer", "setContainerDefaultViews", "setContainerBlock"] as const) {
      it(`${nome}: B, sem concessão administrar na Pasta/Lista alvo, é recusado`, async () => {
        const caso = casos().find((c) => c.nome === nome)!;
        const [colecao, ids] = caso.registros;
        const antes = await gravado(colecao, ids);
        const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, nome, [...caso.args]);
        expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
        expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
        expect(await gravado(colecao, ids)).toBe(antes);
      });
    }

    it("reorderContainers: B não reordena os Espaços (exige Administrador ou Proprietário)", async () => {
      const todosOsEspacos = espaco.estado.spaces.map((s) => s.id);
      const antes = await gravado("spaces", todosOsEspacos);
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, "reorderContainers", ["space", null, [...todosOsEspacos].reverse()]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      expect(await gravado("spaces", todosOsEspacos)).toBe(antes);
    });

    it("reorderContainers: B não reordena com o id de uma Lista de outra Pasta (id fora do grupo), e o banco não muda", async () => {
      const antes = await gravado("lists", listas);
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, "reorderContainers", ["list", { type: "folder", id: pastaB }, [listas[0]]]);
      expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      expect(await gravado("lists", listas)).toBe(antes);
    });
  });

  describe("Membro suspenso: 403 antes de qualquer operação, e o registro gravado não muda", () => {
    const todas = [
      ["moveContainer", () => ["list", listas[0], { parentType: "folder", parentId: pastaB }]],
      ["reorderContainers", () => ["list", { type: "folder", id: pastaA }, [listas[2], listas[0], listas[1]]]],
      ["setContainerDefaultViews", () => ["folder", pastaA, { disponiveis: ["lista", "quadro"], inicial: "lista" }]],
      ["setContainerBlock", () => ["folder", pastaA, "defaultViews", true]],
    ] as const;
    for (const [nome, argumentos] of todas) {
      it(`${nome}: o suspenso recebe 403`, async () => {
        const antesListas = await gravado("lists", listas);
        const antesPastas = await gravado("folders", [pastaA, pastaB]);
        const resposta = await chamar(TOKENS_DE_VAZAMENTO.suspenso, nome, [...argumentos()]);
        expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(403);
        expect(await gravado("lists", listas)).toBe(antesListas);
        expect(await gravado("folders", [pastaA, pastaB])).toBe(antesPastas);
      });
    }
  });

  describe("A4 (owner-confirmation: pending) e os controles — a recusa é do Papel, não do argumento", () => {
    it("A4: B, que alcança a Pasta, reordena as Listas dela (mayBuild do pai); o Convidado, acima, não", async () => {
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.b, "reorderContainers", ["list", { type: "folder", id: pastaA }, [listas[1], listas[0], listas[2]]]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(funcionou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
    });

    it("controle: o Proprietário faz as quatro chamadas com os mesmos argumentos e elas funcionam", async () => {
      const dono = TOKENS_DE_VAZAMENTO.proprietario;
      const reordena = await chamar(dono, "reorderContainers", ["list", { type: "folder", id: pastaA }, [listas[2], listas[0], listas[1]]]);
      expect(funcionou(reordena.json()), reordena.body.slice(0, 200)).toBe(true);
      const visualizacoes = await chamar(dono, "setContainerDefaultViews", ["folder", pastaA, { disponiveis: ["lista", "quadro"], inicial: "lista" }]);
      expect(funcionou(visualizacoes.json()), visualizacoes.body.slice(0, 200)).toBe(true);
      const bloqueia = await chamar(dono, "setContainerBlock", ["folder", pastaA, "defaultViews", true]);
      expect(funcionou(bloqueia.json()), bloqueia.body.slice(0, 200)).toBe(true);
      const move = await chamar(dono, "moveContainer", ["list", listas[0], { parentType: "folder", parentId: pastaB }]);
      expect(funcionou(move.json()), move.body.slice(0, 200)).toBe(true);
      const moveu = await pool().query<{ dados: { parentId: string } }>("select dados from plataforma.registros where workspace_id = $1 and colecao = 'lists' and id = $2", [
        espaco.workspaceId,
        listas[0],
      ]);
      expect(moveu.rows[0]?.dados.parentId).toBe(pastaB);
    });
  });
});
