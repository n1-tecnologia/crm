// @vitest-environment node
/**
 * D-03 (10-16): o gesto manual de rodar a agenda saiu da tela. Quem roda a
 * recorrência por calendário, as Automações por vencimento e a lixeira vencida
 * é o agendador do servidor, ligado em produção e conferido no D-04.
 *
 * Este teste impede a volta: percorre `apps/web/src` e falha listando
 * `arquivo:linha` se achar o rótulo do botão ou o do item de menu. As duas
 * expressões são montadas de pedaços, para o próprio arquivo não conter o
 * literal procurado.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const proibidos = [["Rodar", "agenda"].join(" "), ["Rodar", "automações", "por", "vencimento"].join(" ")];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === "node_modules" ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

describe("o gesto manual de rodar a agenda não volta para a tela", () => {
  it("nenhum arquivo de apps/web/src tem o rótulo do botão nem o do item de menu", () => {
    const achados: string[] = [];
    for (const arquivo of arquivos(raiz)) {
      readFileSync(arquivo, "utf8").split("\n").forEach((linha, i) => {
        if (proibidos.some((p) => linha.includes(p))) achados.push(`${arquivo.slice(raiz.length)}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
