/**
 * Contraste é aritmética, e aritmética se testa.
 *
 * Os tokens são lidos do `estilos/tokens.css` de verdade, não redigitados aqui:
 * um valor que muda na folha de estilo falha aqui, e é esse o ponto inteiro.
 * Um token que aponta para outro (`--page: var(--cinza-900)`) é resolvido até
 * chegar num hex — a cadeia inteira é auditada, não só a ponta.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AA_TEXT = 4.5;
const AA_LARGE_AND_NON_TEXT = 3;

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  if (r === undefined || g === undefined || b === undefined || Number.isNaN(r + g + b)) {
    throw new Error(`cor inválida: ${hex}`);
  }
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  if (high === undefined || low === undefined) throw new Error("par inválido");
  return (high + 0.05) / (low + 0.05);
}

/**
 * Lê `--nome: valor;` do `:root` e resolve `var(--outro)` até um hex sólido.
 * Só o bloco `:root` da base: os degraus de tela redefinem MEDIDAS, nunca cor,
 * e é isso que este leitor pressupõe.
 */
function readTokens(): Map<string, string> {
  const css = readFileSync(join(import.meta.dirname, "..", "estilos", "tokens.css"), "utf8");
  const raw = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value && !raw.has(name)) raw.set(name, value.trim());
  }
  const resolved = new Map<string, string>();
  const resolve = (name: string, depth = 0): string | undefined => {
    if (depth > 8) return undefined;
    const value = raw.get(name);
    if (!value) return undefined;
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (alias?.[1]) return resolve(alias[1], depth + 1);
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
  };
  for (const name of raw.keys()) {
    const hex = resolve(name);
    if (hex) resolved.set(name, hex);
  }
  return resolved;
}

const t = readTokens();
const hex = (name: string): string => {
  const value = t.get(name);
  expect(value, `${name} ausente ou não resolve num hex`).toBeDefined();
  return value as string;
};

describe("fórmula de contraste", () => {
  it("bate com as referências conhecidas da WCAG", () => {
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
    expect(contrast("#595959", "#ffffff")).toBeCloseTo(7.0, 1);
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });
});

describe("a rampa de texto atinge AA sobre a página e sobre o cartão", () => {
  const superficies = ["--page", "--card", "--cinza-600"] as const;
  for (const texto of ["--texto", "--texto-1", "--texto-2", "--texto-3"] as const) {
    for (const s of superficies) {
      it(`${texto} sobre ${s}`, () => {
        expect(contrast(hex(texto), hex(s))).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }

  it("--texto-4 é meta e placeholder: precisa de 3:1, nunca vira parágrafo", () => {
    for (const s of superficies) {
      expect(contrast(hex("--texto-4"), hex(s))).toBeGreaterThanOrEqual(AA_LARGE_AND_NON_TEXT);
    }
  });
});

describe("tinta sobre acento", () => {
  it("o acento chapado (lilás) leva tinta escura", () => {
    expect(contrast(hex("--sobre-acento"), hex("--acento"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("o gradiente do botão sólido (roxo escuro) leva tinta branca nas duas pontas", () => {
    for (const ponta of ["--roxo-700", "--roxo-500"] as const) {
      expect(contrast(hex("--sobre-degrade"), hex(ponta)), ponta).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("o acento e os semânticos são legíveis como texto sobre a página", () => {
    for (const cor of ["--acento", "--sucesso", "--info", "--aviso", "--erro"] as const) {
      expect(contrast(hex(cor), hex("--page")), cor).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe("o vocabulário semântico do N1 continua legível", () => {
  it("a tinta do botão perigoso sobre o vermelho", () => {
    expect(contrast(hex("--cor-perigo-texto-contraste"), hex("--cor-perigo"))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(hex("--cor-perigo-texto-contraste"), hex("--cor-perigo-forte"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("iniciais do Avatar sobre todo tipo de Ator", () => {
    for (const kind of ["membro", "agente", "automacao", "integracao"] as const) {
      expect(contrast(hex("--cor-ator-texto"), hex(`--cor-ator-${kind}`)), `ator ${kind}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
    expect(contrast(hex("--cor-ator-sistema-texto"), hex("--cor-ator-sistema")), "ator sistema").toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("texto do selo sobre o próprio fundo", () => {
    for (const seal of ["arquivado", "lixeira", "mesclado", "rascunho", "pausado", "pendente"] as const) {
      expect(contrast(hex(`--cor-selo-${seal}`), hex(`--cor-selo-${seal}-fundo`)), `selo ${seal}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("o texto de aviso atinge AA sobre o fundo do aviso", () => {
    for (const tone of ["sucesso", "perigo", "atencao", "info"] as const) {
      expect(contrast(hex(`--cor-${tone}-texto`), hex(`--cor-${tone}-fraco`)), `aviso ${tone}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe("os componentes leem token, nunca cor nem geometria literal", () => {
  const source = readFileSync(join(import.meta.dirname, "components.tsx"), "utf8");

  it("não escreve hex, função de cor crua nem cor nomeada do Tailwind", () => {
    const literals =
      source.match(
        /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|bg-white|bg-black|text-white|text-black/g,
      ) ?? [];
    expect(literals).toEqual([]);
  });

  it("não escreve raio nem sombra literal: os dois são token", () => {
    const raios = source.match(/rounded-\[(?!var\()[^\]]+\]/g) ?? [];
    expect(raios, "raio literal — use var(--r-*)").toEqual([]);
    const sombras = source.match(/shadow-\[(?!var\(--sombra)[^\]]+\]/g) ?? [];
    expect(sombras, "sombra literal — use var(--sombra*)").toEqual([]);
  });

  it("não usa --texto-4 como texto de parágrafo", () => {
    expect(source).not.toContain("text-[var(--cor-tinta-tenue)]");
  });

  it("todo diálogo modal gerencia o foco", () => {
    // Durante a saída (`usePresenca`) o diálogo deixa de ser modal: `aria-modal={saindo ? undefined : "true"}`.
    const modals = source.match(/^\s+aria-modal=(?:"true"|\{saindo \? undefined : "true"\})$/gm) ?? [];
    const calls = source.match(/^\s+useModal\(/gm) ?? [];
    expect(modals.length).toBeGreaterThan(0);
    expect(calls.length).toBe(modals.length);
  });
});
