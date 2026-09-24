/**
 * Teste PURO (sem banco, D-DEC-09) de `limpar-outbox-de-teste.ts` — os itens
 * de `<behavior>` do plano 05-19 Task 2. O SQL de `levantarOrfaos`/
 * `removerOrfaos` é lido do próprio arquivo-fonte (nenhuma conexão real):
 * prova que as três cláusulas (`workspace_id <> 'ws_n1'`, `status = 'pending'`,
 * filtro por prefixo) estão nas consultas, e que nenhum `select` lista
 * `payload` — sem precisar de Postgres para isso.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { ehEspacoDeTeste, PREFIXOS_DE_ESPACO_DE_TESTE, removerOrfaos } from "./limpar-outbox-de-teste";

describe("ehEspacoDeTeste / PREFIXOS_DE_ESPACO_DE_TESTE (puro)", () => {
  it("(a) ws_n1 é sempre false, sob qualquer configuração", () => {
    expect(ehEspacoDeTeste("ws_n1")).toBe(false);
  });

  it("(b) verdadeiro para um exemplo real de cada prefixo confirmado", () => {
    const exemplos: Record<string, string> = {
      "ws_agendaworker_": "ws_agendaworker_1727000000000_ab12cd_canal_a",
      "ws_outbox_": "ws_outbox_1727000000000_ab12cd",
      "ws_teste_": "ws_teste_integracao_solicitacoes_1727000000000_ab12cd",
      "ws_formularios_publicos_": "ws_formularios_publicos_1727000000000_ab12cd_canal",
      "ws_cr_configurar_": "ws_cr_configurar_1727000000000_ab12cd_prazo",
      "ws_rotas_teste": "ws_rotas_teste",
      "ws_config_empresa_teste": "ws_config_empresa_teste",
    };
    for (const prefixo of PREFIXOS_DE_ESPACO_DE_TESTE) {
      const exemplo = exemplos[prefixo];
      expect(exemplo, `sem exemplo cadastrado para o prefixo "${prefixo}"`).toBeDefined();
      expect(ehEspacoDeTeste(exemplo!), `"${exemplo}" deveria ser Espaço de teste (prefixo "${prefixo}")`).toBe(true);
    }
  });

  it("(c) nenhum prefixo é prefixo de 'ws_n1', e nenhum é vazio", () => {
    for (const prefixo of PREFIXOS_DE_ESPACO_DE_TESTE) {
      expect(prefixo.length).toBeGreaterThan(0);
      expect("ws_n1".startsWith(prefixo)).toBe(false);
    }
  });
});

describe("SQL de levantarOrfaos/removerOrfaos (lido do fonte, sem banco)", () => {
  const caminhoDoModulo = fileURLToPath(new URL("./limpar-outbox-de-teste.ts", import.meta.url));
  const fonte = readFileSync(caminhoDoModulo, "utf8");

  it("(e) contém workspace_id <> 'ws_n1' pelo menos duas vezes (levantamento e remoção)", () => {
    const ocorrencias = fonte.split("<> 'ws_n1'").length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(2);
  });

  it("(f) contém status = 'pending' no levantamento e na remoção do outbox", () => {
    const ocorrencias = fonte.split("status = 'pending'").length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(2);
  });

  it("(g) contém o filtro por prefixo (workspace_id like any) no levantamento e na remoção", () => {
    const ocorrencias = fonte.split("like any($1)").length - 1;
    expect(ocorrencias).toBeGreaterThanOrEqual(2);
  });

  it("(h) nenhuma lista de colunas de 'select' inclui 'payload' — a palavra só aparece em prosa/comentário", () => {
    // Extrai o trecho `select <colunas> from` de cada consulta do arquivo
    // (multi-linha) e confere que NENHUMA lista de colunas cita `payload`.
    // A palavra pode (e deve) aparecer em comentários explicando a garantia
    // — o critério de aceite do plano é sobre a lista de colunas, não sobre
    // o arquivo inteiro.
    const consultas = [...fonte.matchAll(/select\s+([\s\S]*?)\s+from/gi)];
    expect(consultas.length).toBeGreaterThan(0);
    for (const consulta of consultas) {
      const colunas = consulta[1]!.toLowerCase();
      expect(colunas, `lista de colunas suspeita: "${consulta[1]}"`).not.toContain("payload");
    }
  });
});

describe("removerOrfaos — recusa sem apply: true (puro, sem banco)", () => {
  it("(i) lança ANTES de abrir transação — o cliente espião nunca é chamado", async () => {
    const query = vi.fn(() => {
      throw new Error("removerOrfaos não devia tocar o banco sem apply: true");
    });
    const clienteEspiao = { query } as unknown as PoolClient;

    await expect(removerOrfaos(clienteEspiao, { apply: false })).rejects.toThrow(/apply: true/);
    expect(query).not.toHaveBeenCalled();
  });
});
