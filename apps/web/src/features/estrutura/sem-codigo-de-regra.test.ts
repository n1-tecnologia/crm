/**
 * Fase 10, EST-04 / 2.1.10 / D-17 — a Estrutura não mostra código interno de
 * regra entre parênteses ("(RN-CR-07)", "(B38)", "(A3.4)"). O dono não quer ver
 * isso na tela: o código é vocabulário de quem escreveu a regra, não de quem a
 * lê.
 *
 * O teste lê os `.tsx` de `features/estrutura` e de `app/(shell)/estrutura`,
 * descarta os comentários (de linha, de bloco e de JSX entre chaves — os
 * comentários podem citar a regra que o código cumpre) e falha listando
 * `arquivo:linha` de cada texto que sobrou com código.
 *
 * Ele NÃO vê as recusas do domínio (moram em `packages/dominio`, chegam às
 * telas literais): essas têm asserção própria em
 * `packages/dominio/src/operations/recusas-sem-codigo.test.ts`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** A expressão do UI-SPEC S10: RN-/INV-/DO-, (B..) e (A..). */
const CODIGO_DE_REGRA = /\((RN|INV|DO)-[A-Z]+-[0-9]+\)|\(B[0-9]+[a-z]?\)|\(A[0-9]+\.[0-9]+\)/;

const RAIZ_DA_WEB = fileURLToPath(new URL("../../../", import.meta.url));
const PASTAS = [
  fileURLToPath(new URL("./", import.meta.url)),
  fileURLToPath(new URL("../../app/(shell)/estrutura/", import.meta.url)),
];

function arquivosTsx(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...arquivosTsx(caminho));
    else if (entrada.name.endsWith(".tsx") && !/\.test\.tsx$/.test(entrada.name)) achados.push(caminho);
  }
  return achados.sort();
}

/**
 * Troca cada comentário por espaços, mantendo as quebras de linha (o número
 * de linha do achado continua o do arquivo). Cadeias entre aspas/crases são
 * respeitadas: uma `//` dentro de uma URL não abre comentário. Cadeia de aspas
 * simples ou duplas termina na quebra de linha, para que um apóstrofo solto em
 * texto de JSX não engula o resto do arquivo.
 */
function semComentarios(codigo: string): string {
  let saida = "";
  let i = 0;
  while (i < codigo.length) {
    const c = codigo[i]!;
    const proximo = codigo[i + 1];
    if (c === "/" && proximo === "*") {
      const fim = codigo.indexOf("*/", i + 2);
      const bloco = fim === -1 ? codigo.slice(i) : codigo.slice(i, fim + 2);
      saida += bloco.replace(/[^\n]/g, " ");
      i += bloco.length;
    } else if (c === "/" && proximo === "/" && codigo[i - 1] !== ":") {
      let fim = codigo.indexOf("\n", i);
      if (fim === -1) fim = codigo.length;
      saida += " ".repeat(fim - i);
      i = fim;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < codigo.length) {
        if (codigo[j] === "\\") j += 2;
        else if (codigo[j] === c) break;
        else if (c !== "`" && codigo[j] === "\n") break;
        else j += 1;
      }
      saida += codigo.slice(i, j + 1);
      i = j + 1;
    } else {
      saida += c;
      i += 1;
    }
  }
  return saida;
}

function achados(codigo: string): number[] {
  return semComentarios(codigo)
    .split("\n")
    .flatMap((linha, indice) => (CODIGO_DE_REGRA.test(linha) ? [indice + 1] : []));
}

describe("semComentarios", () => {
  it("descarta comentário de linha, de bloco e de JSX, e guarda o texto", () => {
    const codigo = [
      "// (RN-CR-07) comentário de linha",
      "/* (B38) bloco */",
      "const a = <p>{/* (A3.4) jsx */}ok</p>;",
      'const b = "Texto (RN-CR-01)."; // (B25) depois do código',
      "/**",
      " * (INV-CP-01) varias linhas",
      " */",
    ].join("\n");
    const limpo = semComentarios(codigo);
    expect(limpo.split("\n")).toHaveLength(codigo.split("\n").length);
    expect(achados(codigo)).toEqual([4]);
    expect(limpo).toContain("ok");
  });

  it("não trata // dentro de cadeia com URL como comentário", () => {
    const codigo = 'const url = "https://exemplo.com/x"; const t = "frase (B38).";';
    expect(achados(codigo)).toEqual([1]);
  });
});

describe("Estrutura sem código de regra no texto visível (EST-04)", () => {
  it("lê as duas pastas e encontra arquivos", () => {
    for (const pasta of PASTAS) expect(arquivosTsx(pasta).length).toBeGreaterThan(0);
  });

  it("nenhum .tsx mostra (RN-…), (INV-…), (DO-…), (B…) ou (A…) entre parênteses", () => {
    const achadosPorArquivo: string[] = [];
    for (const pasta of PASTAS) {
      for (const arquivo of arquivosTsx(pasta)) {
        for (const linha of achados(readFileSync(arquivo, "utf8"))) {
          achadosPorArquivo.push(`${relative(RAIZ_DA_WEB, arquivo)}:${linha}`);
        }
      }
    }
    expect(achadosPorArquivo).toEqual([]);
  });
});
