/**
 * Prova contra Postgres real das garantias de `plataforma.automacao_agenda`
 * (`005-agenda-de-automacoes.sql`) que o Plan 03-08 vai assumir sem checar:
 * um dia civil por Lista, reivindicação exclusiva entre duas instâncias do
 * `apps/api`, e o dia que não some quando o processo cai no minuto errado.
 *
 * O que NÃO se prova aqui, de propósito: idempotência de Automação agendada.
 * Ela mora em `AutomationExecution` e na checagem `jaRodou` de
 * `runScheduledAutomations` (`packages/dominio/src/operations/automations.ts`),
 * é pura, e já tem teste próprio no domínio. Esta tabela é exclusão mútua e
 * auditoria — nunca uma segunda fonte de verdade sobre "isto já rodou".
 *
 * Precisa de um Postgres em `DATABASE_URL` **com a migração `005` aplicada**
 * (`npm run migrar -w @n1/api`) — sem `DATABASE_URL`, pula (D-DEC-09), como
 * `integracao.test.ts` e `persistencia.test.ts`. O banco é compartilhado:
 * cada caso escreve só sob o prefixo desta execução e o `afterAll` varre por
 * ele. Nenhum caso aqui toca a tabela canônica de registros.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "./conexao";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

// Prefixo próprio por execução, para nunca colidir com `ws_n1` nem com outra
// execução simultânea da suíte.
const WORKSPACE = `ws_teste_agenda_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function limparTudo(): Promise<void> {
  const cliente = await pool().connect();
  try {
    await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1", [WORKSPACE]);
  } finally {
    cliente.release();
  }
}

/**
 * A reivindicação que o scheduler-worker do Plan 03-08 vai usar: mesma
 * primitiva de lease de `outbox-worker.ts::reivindicar()`, adaptada à chave
 * composta. Vive aqui, no teste, porque o worker ainda não existe — o que se
 * prova é a garantia do banco, não este trecho de SQL.
 */
async function reivindicar(listId: string, workerId: string): Promise<readonly unknown[]> {
  const conexao = await pool().connect();
  try {
    const r = await conexao.query(
      `update plataforma.automacao_agenda a
          set estado = 'processando', locked_by = $1, locked_at = now(), tentativas = a.tentativas + 1
        where (a.workspace_id, a.list_id, a.dia_civil) = (
          select s.workspace_id, s.list_id, s.dia_civil
            from plataforma.automacao_agenda s
           where s.workspace_id = $2 and s.list_id = $3 and s.estado in ('pendente','falhou')
           order by s.criado_em, s.dia_civil
           limit 1
             for update skip locked
        )
        returning a.dia_civil`,
      [workerId, WORKSPACE, listId],
    );
    return r.rows;
  } finally {
    conexao.release();
  }
}

d("garantias de plataforma.automacao_agenda (005)", () => {
  beforeAll(async () => {
    await limparTudo();
  });

  afterAll(async () => {
    await limparTudo();
    await encerrar();
  });

  it("(a) um dia civil por Lista: a segunda linha com a mesma chave é recusada; outro dia é aceito", async () => {
    const cliente = await pool().connect();
    const listId = `lista_a_${randomUUID()}`;
    try {
      await cliente.query(
        `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil)
         values ($1, $2, date '2026-03-10')`,
        [WORKSPACE, listId],
      );

      await expect(
        cliente.query(
          `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil)
           values ($1, $2, date '2026-03-10')`,
          [WORKSPACE, listId],
        ),
      ).rejects.toThrow(/duplicate key|unique constraint/i);

      // Mesmo par (Espaço, Lista), outro dia civil: aceito.
      await cliente.query(
        `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil)
         values ($1, $2, date '2026-03-11')`,
        [WORKSPACE, listId],
      );

      const r = await cliente.query<{ n: string }>(
        `select count(*)::text as n from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2`,
        [WORKSPACE, listId],
      );
      expect(r.rows[0]!.n).toBe("2");
    } finally {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2", [
        WORKSPACE,
        listId,
      ]);
      cliente.release();
    }
  });

  it("(b) reivindicação exclusiva: duas conexões simultâneas sobre o mesmo dia pendente, uma só leva", async () => {
    const listId = `lista_b_${randomUUID()}`;
    const cliente = await pool().connect();
    try {
      await cliente.query(
        `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado)
         values ($1, $2, date '2026-03-12', 'pendente')`,
        [WORKSPACE, listId],
      );
    } finally {
      cliente.release();
    }

    const [linhasA, linhasB] = await Promise.all([
      reivindicar(listId, "instancia_a"),
      reivindicar(listId, "instancia_b"),
    ]);
    expect(linhasA.length + linhasB.length).toBe(1);

    const conferencia = await pool().connect();
    try {
      const r = await conferencia.query<{ estado: string; locked_by: string | null; tentativas: number }>(
        `select estado, locked_by, tentativas from plataforma.automacao_agenda
          where workspace_id = $1 and list_id = $2`,
        [WORKSPACE, listId],
      );
      expect(r.rows[0]!.estado).toBe("processando");
      expect(["instancia_a", "instancia_b"]).toContain(r.rows[0]!.locked_by);
      // Uma única reivindicação venceu: a outra nem incrementou a tentativa.
      expect(r.rows[0]!.tentativas).toBe(1);
    } finally {
      await conferencia.query("delete from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2", [
        WORKSPACE,
        listId,
      ]);
      conferencia.release();
    }
  });

  it("(c) estado fora do check é recusado pelo banco", async () => {
    const cliente = await pool().connect();
    const listId = `lista_c_${randomUUID()}`;
    try {
      await expect(
        cliente.query(
          `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado)
           values ($1, $2, date '2026-03-13', 'inventado')`,
          [WORKSPACE, listId],
        ),
      ).rejects.toThrow(/check constraint|violates/i);

      // Os quatro estados do check passam.
      for (const [i, estado] of ["pendente", "processando", "concluido", "falhou"].entries()) {
        await cliente.query(
          `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado)
           values ($1, $2, date '2026-04-01' + $3::int, $4)`,
          [WORKSPACE, listId, i, estado],
        );
      }
    } finally {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2", [
        WORKSPACE,
        listId,
      ]);
      cliente.release();
    }
  });

  it("(d) o dia não some quando o processo cai: 'processando' velho volta a 'falhou' e é reivindicável de novo", async () => {
    const listId = `lista_d_${randomUUID()}`;
    const cliente = await pool().connect();
    try {
      // O que fica no banco quando o processo morre no meio do dia: a linha
      // presa em `processando`, com `locked_at` que não avança mais.
      await cliente.query(
        `insert into plataforma.automacao_agenda
           (workspace_id, list_id, dia_civil, estado, locked_by, locked_at, tentativas)
         values ($1, $2, date '2026-03-14', 'processando', 'instancia_morta', now() - interval '2 hours', 1)`,
        [WORKSPACE, listId],
      );

      // Enquanto está em `processando`, ninguém a reivindica — é isso que
      // impede duas instâncias no mesmo dia.
      expect((await reivindicar(listId, "instancia_nova")).length).toBe(0);

      // A varredura que devolve o dia preso: `processando` com lease vencida
      // volta a `falhou`. É ela que torna o critério 3 do ROADMAP verificável
      // em vez de esperança.
      const devolvidas = await cliente.query(
        `update plataforma.automacao_agenda
            set estado = 'falhou', locked_by = null, locked_at = null,
                last_error_code = 'lease_expirada', last_error_summary = 'lease vencida sem estado terminal'
          where workspace_id = $1 and estado = 'processando' and locked_at < now() - interval '15 minutes'
          returning dia_civil`,
        [WORKSPACE],
      );
      expect(devolvidas.rowCount).toBe(1);

      // E agora o dia volta para a fila: nada foi perdido.
      const retomadas = await reivindicar(listId, "instancia_nova");
      expect(retomadas.length).toBe(1);

      const r = await cliente.query<{ estado: string; locked_by: string | null; tentativas: number }>(
        `select estado, locked_by, tentativas from plataforma.automacao_agenda
          where workspace_id = $1 and list_id = $2`,
        [WORKSPACE, listId],
      );
      expect(r.rows[0]!.estado).toBe("processando");
      expect(r.rows[0]!.locked_by).toBe("instancia_nova");
      expect(r.rows[0]!.tentativas).toBe(2);
    } finally {
      await cliente.query("delete from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2", [
        WORKSPACE,
        listId,
      ]);
      cliente.release();
    }
  });
});
