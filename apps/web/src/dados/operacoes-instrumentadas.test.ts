/**
 * FUND-18 — uma tela que importa uma operação do REGISTRO pelo caminho cru
 * (`@n1/dominio/operations/<módulo>`) em vez do barril instrumentado
 * (`@n1/dominio/operations`) muta a cópia local sem registrar a chamada: o
 * `run()` diz "ok", e o transporte responde "não passa por uma operação do
 * domínio e não foi gravada". Foi o caso de `criarCanal` no popup de Canal.
 * Este teste varre o código do web e recusa qualquer importação assim —
 * constantes e helpers (que não estão em `OPERACOES`) continuam livres.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPERACOES } from "@n1/dominio/operations/registro";

const RAIZ = join(__dirname, "..");

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

const IMPORTACAO_CRUA = /import\s*\{([^}]*)\}\s*from\s*"@n1\/dominio\/operations\/[^"]+"/g;

describe("operações do registro só pelo barril instrumentado", () => {
  it("nenhum arquivo do web importa uma operação de OPERACOES por @n1/dominio/operations/<módulo>", () => {
    const nomes = new Set(Object.keys(OPERACOES));
    const violacoes: string[] = [];
    for (const arquivo of arquivos(RAIZ)) {
      const fonte = readFileSync(arquivo, "utf8");
      for (const m of fonte.matchAll(IMPORTACAO_CRUA)) {
        const importados = (m[1] ?? "")
          .split(",")
          .map((parte) => parte.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0] ?? "")
          .filter(Boolean);
        for (const nome of importados) {
          if (nomes.has(nome)) violacoes.push(`${arquivo.slice(RAIZ.length + 1)}: ${nome}`);
        }
      }
    }
    expect(violacoes, violacoes.join("\n")).toEqual([]);
  });
});
