/**
 * Operações do domínio cuja conferência de quem chama é fraca ou ausente (09-09-SUMMARY,
 * itens 3 e 4; passados adiante por 09-12 a este plano): `runLancamentoAgent`,
 * `alterarEmailDoConvite`, `alterarPapelDoMembro`, `deleteRole`, `grantGovernanceAccess`
 * e `stopTimer`, chamadas por `POST /operacoes/:nome` por quem NÃO deveria conseguir.
 *
 * Cada caso escreve o comportamento CORRETO: a operação recusa (`ok: false`) e o estado
 * guardado no Postgres não muda. Onde o domínio hoje deixa passar, o caso vem marcado
 * `it.fails` (o Vitest passa enquanto a lacuna existir e FALHA no dia em que for
 * consertada — aí a marca sai). Nunca `it.todo`: o job `seguranca` do CI conta pendente
 * e todo como teste pulado. Este plano não corrige o domínio.
 *
 * NÃO exercida: `inviteMember`. Ela resolve e-mail para Usuário no Supabase Auth (rede)
 * antes de qualquer conferência de Papel no caminho que `SERVICOS` abre; provar a recusa
 * dela exige um dublê do serviço de convite, que esta suíte não monta.
 *
 * Só Postgres local (`describeComBanco`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Grant, Task } from "@n1/dominio";
import { CP } from "@n1/dominio/operations";
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

describeComBanco("operações de members.ts, cronômetro e lançamento — quem não pode, não faz (09-09, itens 3 e 4)", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;
  /** A conta de Gestão (Contas a pagar) em que o Convidado ganha `ver` e o Agente de lançamento tem concessão. */
  let contaId: string;
  /** Uma Tarefa em que A tem o cronômetro aberto. */
  let tarefaDoCronometro: string;
  let entradaDoCronometro: string;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("lacunas-dominio");
    const estado = espaco.estado;

    // Sem Resumo de pagamento já publicado: com ele a operação volta cedo ("nada a lançar") e a prova ficaria rasa.
    const contaDeGestao = estado.tasks.find(
      (t) => t.lifecycle === "ativo" && t.listId === CP.listId && !t.comments.some((c) => !c.deletedAt && c.content.startsWith("📋 RESUMO DE PAGAMENTO")),
    );
    if (!contaDeGestao) throw new Error("o seed precisa de uma Tarefa ativa na Lista Contas a pagar");
    contaId = contaDeGestao.id;
    const concessao: Grant = {
      id: "gr_vaz_convidado_conta",
      workspaceId: estado.workspace.id,
      subjectKind: "member",
      subjectId: espaco.membros.convidado.id,
      action: "ver",
      resourceType: "task",
      resourceId: contaId,
      scope: "registro",
      origin: "compartilhamento",
      grantedBy: espaco.membros.proprietario.id,
      grantedAt: new Date().toISOString(),
    };
    estado.grants.push(concessao);

    // O cronômetro aberto de A, numa Tarefa qualquer: `stopTimer` olha só o dono da entrada.
    const alvo = estado.tasks.find((t) => t.lifecycle === "ativo" && t.id !== contaId);
    if (!alvo) throw new Error("o seed precisa de uma segunda Tarefa ativa");
    tarefaDoCronometro = alvo.id;
    entradaDoCronometro = "tme_vaz_aberto";
    alvo.timeEntries.push({ id: entradaDoCronometro, memberId: espaco.membros.a.id, start: new Date().toISOString(), createdBy: { kind: "member", id: espaco.membros.a.id } });

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

  /** O registro como está GRAVADO no Postgres (não a resposta da operação). */
  async function registro<T>(colecao: string, id: string): Promise<T | undefined> {
    const r = await pool().query<{ dados: T }>("select dados from plataforma.registros where workspace_id = $1 and colecao = $2 and id = $3", [
      espaco.workspaceId,
      colecao,
      id,
    ]);
    return r.rows[0]?.dados;
  }

  const recusou = (corpo: unknown): boolean => (corpo as { ok?: boolean }).ok === false;

  describe("members.ts: confere o Papel base de quem chama (Administrador ou Proprietário)", () => {
    it.each([
      ["o Convidado", TOKENS_DE_VAZAMENTO.convidado],
      ["o Membro", TOKENS_DE_VAZAMENTO.b],
    ] as const)("alterarPapelDoMembro: %s não muda o Papel de ninguém, e o Papel gravado não muda", async (_quem, token) => {
      const papelDoConvidado = espaco.membros.convidado.roleId;
      const papelAdministrador = espaco.estado.roles.find((r) => r.base === "administrador");
      expect(papelAdministrador, "o seed precisa de um Papel de base administrador").toBeDefined();
      const resposta = await chamar(token, "alterarPapelDoMembro", [{ memberId: espaco.membros.convidado.id, roleId: papelAdministrador!.id }]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      expect((await registro<{ roleId: string }>("members", espaco.membros.convidado.id))?.roleId).toBe(papelDoConvidado);
    });

    it("grantGovernanceAccess: o Convidado não se concede `administrar` (escalada), e nenhuma Concessão nasce", async () => {
      const lista = espaco.estado.lists[0]!;
      const antes = await pool().query("select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = 'grants'", [espaco.workspaceId]);
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.convidado, "grantGovernanceAccess", [
        { subjectKind: "member", subjectId: espaco.membros.convidado.id, resourceType: "list", resourceId: lista.id, actions: ["administrar"], reason: "tentativa de escalada" },
      ]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      const depois = await pool().query("select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = 'grants'", [espaco.workspaceId]);
      expect(depois.rows[0].n).toBe(antes.rows[0].n);
    });

    it("deleteRole: o Convidado e o Membro não excluem um Papel", async () => {
      const personalizado = espaco.estado.roles.find((r) => !r.system);
      const alvo = personalizado ?? espaco.estado.roles[0]!;
      for (const token of [TOKENS_DE_VAZAMENTO.convidado, TOKENS_DE_VAZAMENTO.b]) {
        const resposta = await chamar(token, "deleteRole", [alvo.id, {}]);
        expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
        expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      }
      expect(await registro("roles", alvo.id), "o Papel foi apagado").toBeDefined();
    });

    it("alterarEmailDoConvite: o Convidado e o Membro não mudam o e-mail do convite; o Administrador muda (controle)", async () => {
      const novo = `trocado-${espaco.workspaceId}@exemplo.com`;
      for (const token of [TOKENS_DE_VAZAMENTO.convidado, TOKENS_DE_VAZAMENTO.b]) {
        const resposta = await chamar(token, "alterarEmailDoConvite", [{ memberId: espaco.convite.id, email: novo }]);
        expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
        expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      }
      const gravado = await registro<{ invitedIdentity?: { value: string } }>("members", espaco.convite.id);
      expect(gravado?.invitedIdentity?.value).toBe(espaco.convite.email);

      // Controle: sem ele, "todos recusam" passaria também com a operação ou a rota quebradas.
      const doAdministrador = await chamar(TOKENS_DE_VAZAMENTO.administrador, "alterarEmailDoConvite", [{ memberId: espaco.convite.id, email: novo }]);
      expect(doAdministrador.statusCode, doAdministrador.body.slice(0, 200)).toBe(200);
      expect((doAdministrador.json() as { ok: boolean }).ok, doAdministrador.body.slice(0, 200)).toBe(true);
    });
  });

  describe("stopTimer: só o dono da entrada fecha o cronômetro", () => {
    it("o Convidado não fecha o cronômetro aberto de A, e a entrada segue aberta no banco", async () => {
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.convidado, "stopTimer", [tarefaDoCronometro]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(recusou(resposta.json()), resposta.body.slice(0, 200)).toBe(true);
      const tarefa = await registro<Task>("tasks", tarefaDoCronometro);
      const entrada = tarefa?.timeEntries.find((e) => e.id === entradaDoCronometro);
      expect(entrada, "a entrada de A sumiu").toBeDefined();
      expect(entrada?.end, "o cronômetro de A foi fechado por outro Membro").toBeUndefined();
    });

    it("o dono (A) fecha o próprio cronômetro (controle)", async () => {
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.a, "stopTimer", [tarefaDoCronometro]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect((resposta.json() as { ok: boolean }).ok, resposta.body.slice(0, 200)).toBe(true);
    });
  });

  describe("runLancamentoAgent: conferência fraca (só `memberSeesTask` e a concessão do Agente)", () => {
    const AGENTE = "agt_lancamento";

    // LACUNA — ver 09-09-SUMMARY, item 3 (medida em 09-15): a operação não recusa Convidado. O Convidado com `ver` na
    // conta de Gestão, onde o Agente de lançamento tem concessão, chama a operação crua e ela publica o Resumo de
    // pagamento como Comentário da conta e grava a Execução (resposta real: `ok: true`, "Resumo publicado: ..."). O
    // comportamento seguro é recusar e não gravar nada. `it.fails` passa enquanto a lacuna existir; quando o domínio
    // for consertado o Vitest avisa e a marca sai. Este plano não corrige o domínio.
    it.fails("o Convidado com `ver` na conta não dispara o Agente de lançamento, e nenhuma Execução do Agente é gravada em nome dele", async () => {
      const antes = await pool().query("select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = 'agentExecutions' and dados->>'agentId' = $2", [
        espaco.workspaceId,
        AGENTE,
      ]);
      const resposta = await chamar(TOKENS_DE_VAZAMENTO.convidado, "runLancamentoAgent", [AGENTE, contaId, "aut_revisao"]);
      expect(resposta.statusCode, resposta.body.slice(0, 200)).toBe(200);
      expect(recusou(resposta.json()), resposta.body.slice(0, 300)).toBe(true);
      const depois = await pool().query("select count(*)::int as n from plataforma.registros where workspace_id = $1 and colecao = 'agentExecutions' and dados->>'agentId' = $2", [
        espaco.workspaceId,
        AGENTE,
      ]);
      expect(depois.rows[0].n, "uma Execução do Agente foi gravada a pedido do Convidado").toBe(antes.rows[0].n);
    });
  });
});
