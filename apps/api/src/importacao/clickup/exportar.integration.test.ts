/**
 * Prova o contrato com a API REAL do ClickUp — formato de autenticação
 * (header sem `Bearer`), paginação, a forma real dos Campos de uma Lista, e
 * o smoke test de `time_in_status` (Open Question 2 do RESEARCH.md: o
 * ClickApp "Total time in Status" está ligado no Workspace Tria? só se
 * descobre chamando a API real). Os demais testes do módulo (`cliente.ts`,
 * `paginacao.ts`, `exportar.ts`, `manifesto.ts`) provam comportamento contra
 * fixtures, sem rede — este arquivo é o único que fala com
 * `api.clickup.com` de verdade, por isso pula sem `CLICKUP_API_TOKEN`
 * (D-DEC-09 estendido ao ClickUp, mesmo padrão de `persistencia.test.ts`).
 *
 * Orçamento: ~13-15 requisições no total (bem abaixo do limite de 100/min),
 * cabe dentro de `testTimeout: 60_000` (`vitest.config.mts`). A amostra real
 * usa Contas a receber (Lista pequena e dormente, PREP-06 §5.7 — "só 10
 * linhas no legado"), 3 Tarefas, sem anexo e sem `time_in_status` — nunca a
 * Lista de Solicitação (~1.110 Tarefas, orçamento de dezenas de minutos,
 * reservado para o Plan 00-05). A pasta de saída é sempre `mkdtemp`,
 * removida no `afterAll` — este arquivo nunca grava na pasta real que o
 * Plan 00-05 vai versionar.
 */

import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { criarClienteClickUp, ErroClickUp, type ClienteClickUp } from "./cliente";
import { carregarEnv } from "../../persistencia/conexao";
import { exportarClickUp, LISTAS } from "./exportar";

carregarEnv();
const temToken = Boolean(process.env.CLICKUP_API_TOKEN);
const d = temToken ? describe : describe.skip;

/** Uma instância por chamada é suficiente — o volume desta suíte é baixo, nenhum estado de pacing precisa sobreviver entre testes. */
function clienteReal(): ClienteClickUp {
  return criarClienteClickUp({ token: process.env.CLICKUP_API_TOKEN! });
}

let pastaDaAmostra: string | undefined;

afterAll(async () => {
  if (pastaDaAmostra !== undefined) {
    await rm(pastaDaAmostra, { recursive: true, force: true });
  }
});

d("exportar — contrato com a API real do ClickUp (só roda com CLICKUP_API_TOKEN)", () => {
  it("(a) GET /list/{contasAPagar}/field devolve Campos reais — cada um com name e type", async () => {
    const resposta = await clienteReal().get(`/list/${LISTAS.contasAPagar}/field`);

    expect(resposta.status).toBe(200);
    const corpo = resposta.json as { readonly fields?: unknown };
    expect(Array.isArray(corpo.fields)).toBe(true);
    const campos = corpo.fields as readonly unknown[];
    // contas-a-pagar.md documenta 24 Definições de Campo Personalizado.
    expect(campos.length).toBeGreaterThanOrEqual(20);
    for (const campo of campos) {
      expect(campo).toHaveProperty("name");
      expect(campo).toHaveProperty("type");
    }
  });

  it("(b) smoke test de time_in_status na Tarefa 868k8tn50 — responde à Open Question 2 do RESEARCH.md", async () => {
    try {
      const resposta = await clienteReal().get("/task/868k8tn50/time_in_status");
      const corpo = resposta.json as { readonly status_history?: unknown; readonly current_status?: unknown };
      expect(corpo.status_history ?? corpo.current_status).toBeDefined();
      console.log("time_in_status disponível");
    } catch (erro) {
      if (!(erro instanceof ErroClickUp) || erro.status < 400 || erro.status >= 500) throw erro;
      // Não é falha do teste: é exatamente a informação que a Open Question 2 pedia.
      console.log(`time_in_status indisponível: HTTP ${erro.status} — o exportador marca nao-disponivel`);
    }
  });

  it("(c) amostra real de 3 Tarefas de Contas a receber — list/fields/members/tasks/detalhe/comentários em disco, amostra: true", async () => {
    pastaDaAmostra = await mkdtemp(path.join(tmpdir(), "exportar-clickup-integracao-"));

    const resultado = await exportarClickUp({
      cliente: clienteReal(),
      pastaDestino: pastaDaAmostra,
      listas: [LISTAS.contasAReceber],
      limiteDeTarefas: 3,
      anexos: "nenhuma",
      timeInStatus: "nao",
    });

    const base = path.join(pastaDaAmostra, LISTAS.contasAReceber);
    await expect(stat(path.join(base, "list.json"))).resolves.toBeDefined();
    await expect(stat(path.join(base, "fields.json"))).resolves.toBeDefined();
    await expect(stat(path.join(base, "members.json"))).resolves.toBeDefined();
    await expect(stat(path.join(base, "tasks", "page-000.json"))).resolves.toBeDefined();

    const detalhes = await readdir(path.join(base, "task"));
    expect(detalhes.length).toBeGreaterThanOrEqual(1);

    const pastasDeComentarios = await readdir(path.join(base, "comments"));
    expect(pastasDeComentarios.length).toBeGreaterThanOrEqual(1);

    expect(resultado.amostra).toBe(true);
    expect(resultado.requisicoes).toBeGreaterThan(0);
  });

  it("(d) retomada real: repetir a exportação na MESMA pasta da (c) não faz nenhuma requisição", async () => {
    if (pastaDaAmostra === undefined) {
      throw new Error("depende do caso (c) já ter rodado e deixado a pasta em pastaDaAmostra");
    }

    let chamadas = 0;
    const base = clienteReal();
    const clienteContado: ClienteClickUp = {
      async get(caminho, query) {
        chamadas += 1;
        return base.get(caminho, query);
      },
      async baixar(url) {
        chamadas += 1;
        return base.baixar(url);
      },
    };

    const resultado = await exportarClickUp({
      cliente: clienteContado,
      pastaDestino: pastaDaAmostra,
      listas: [LISTAS.contasAReceber],
      limiteDeTarefas: 3,
      anexos: "nenhuma",
      timeInStatus: "nao",
    });

    expect(resultado.requisicoes).toBe(0);
    expect(chamadas).toBe(0);
  });
});
