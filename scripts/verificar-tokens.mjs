#!/usr/bin/env node
/**
 * SENTINELA DE TOKENS
 *
 * O problema que ela resolve: `var(--acento-fort)` não é erro em CSS. É uma
 * variável indefinida — resolve para string vazia, a declaração inteira é
 * descartada, e NADA acusa. Nem o build (o PostCSS não valida custom property),
 * nem o lint (é CSS), nem uma captura de tela, porque o elemento continua lá,
 * só que com a cor herdada.
 *
 * Três asserções:
 *   1. todo `var(--x)` usado existe definido em algum lugar;
 *   2. nenhuma cor crua (hex, rgb, hsl) fora de `src/estilos/tokens.css`;
 *   3. nenhum tamanho de fonte literal em TSX — as duas escalas são classes.
 *
 * Rodar: npm run verificar:tokens
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");
const IGNORAR = new Set(["node_modules", ".next", ".git"]);

const CANONICO = join("estilos", "tokens.css");

/* Dispensados, e por quê:
   · brand.tsx — o logo. As pontas do gradiente da marca vivem no SVG, e um
     `url(#gradiente)` não aceita var().
   · data/ — a semente. A cor de um Status é DADO do usuário (ele escolhe no
     seletor), não estilo: viaja como hex e é pintada por `style={{}}`.       */
const DISPENSADOS = [
  join("features", "shell", "brand.tsx"),
  "data" + sep,
  /* O Construtor de Agentes é uma ilha deliberada: paleta própria (--ab-*) e
     escala própria, escopadas em .agent-builder. Fica fora da varredura. */
  join("features", "ia", "agent-builder") + sep,
  /* themeColor é metadado lido antes de qualquer CSS: var() não resolve lá. */
  join("app", "layout.tsx"),
  /* A cor padrão do Status novo é DADO: vai para o <input type="color"> (que não aceita var()) e é gravada no registro. */
  join("features", "estrutura", "configuration-editors.tsx"),
  /* A paleta de cor do Espaço é DADO: o hex escolhido fica gravado em `Space.color`. */
  join("features", "estrutura", "create-container-dialog.tsx"),
];

const QUEBRA = String.fromCharCode(10);

/** Comentário não é código: um `var(--exemplo)` em JSDoc não é uso real. */
function semComentarios(texto) {
  const naoQuebra = new RegExp("[^" + QUEBRA + "]", "g");
  const linhaSolta = new RegExp("(^|[^:])//[^" + QUEBRA + "]*", "g");
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(naoQuebra, " "))
    .replace(linhaSolta, (m, antes) => antes + " ".repeat(m.length - antes.length));
}

/* Variáveis que vêm de fora e por isso não estão em tokens.css. */
const EXTERNAS = new Set([
  "--font-sans", // next/font, injetada por className no <html>
  "--font-mono",
  "--angulo", // definidas em .lanterna e escritas por JS
  "--proximidade",
]);

/** `linear-gradient(#fff 0 0)` dentro de `mask` não é cor: é estêncil. */
const ESTENCIL = /linear-gradient\(#fff 0 0\)/g;

function andar(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) andar(caminho, saida);
    else saida.push(caminho);
  }
  return saida;
}

const arquivos = andar(RAIZ).filter((f) => /\.(css|tsx|ts)$/.test(f) && !/\.test\.tsx?$/.test(f));

/* ── 1. definições ───────────────────────────────────────────────────────── */

const DEFINIDAS = new Set(EXTERNAS);
for (const f of arquivos.filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(f, "utf8");
  for (const m of css.matchAll(/(?:^|[;{])\s*(--[a-z0-9-]+)\s*:/gim)) {
    DEFINIDAS.add(m[1]);
  }
}

/* ── verificações ────────────────────────────────────────────────────────── */

const falhas = [];

for (const f of arquivos) {
  const rel = relative(RAIZ, f).split(sep).join("/");
  if (DISPENSADOS.some((d) => relative(RAIZ, f).startsWith(d) || f.endsWith(d))) continue;
  const texto = semComentarios(readFileSync(f, "utf8"));
  const linhas = texto.split("\n");

  // 1 · token fantasma
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      const nome = m[1];
      if (nome.startsWith("--tw-")) continue; // internas do Tailwind
      if (!DEFINIDAS.has(nome)) {
        falhas.push(`${rel}:${i + 1} · token fantasma \`${nome}\``);
      }
    }
  });

  // 2 · cor crua fora do canônico
  if (!f.endsWith(CANONICO)) {
    linhas.forEach((linha, i) => {
      const semEstencil = linha.replace(ESTENCIL, "");
      const cores = [
        ...semEstencil.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
        ...semEstencil.matchAll(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g),
        ...semEstencil.matchAll(/\b(?:bg|text|border|ring)-(?:white|black)\b/g),
      ];
      for (const c of cores) {
        falhas.push(`${rel}:${i + 1} · cor crua \`${c[0]}\` — vira token`);
      }
    });
  }

  // 3 · tamanho de fonte literal em TSX
  if (f.endsWith(".tsx")) {
    linhas.forEach((linha, i) => {
      for (const m of linha.matchAll(/text-\[[\d.]+(?:px|rem)\]/g)) {
        falhas.push(`${rel}:${i + 1} · tamanho literal \`${m[0]}\` — use .app-* ou .ed-*`);
      }
      if (/fontSize:\s*["'`][\d.]/.test(linha)) {
        falhas.push(`${rel}:${i + 1} · fontSize literal — use .app-* ou .ed-*`);
      }
    });
  }
}

/* ── placar ──────────────────────────────────────────────────────────────── */

if (falhas.length === 0) {
  console.log(
    `✓ tokens · ${DEFINIDAS.size - EXTERNAS.size} definidos · ${arquivos.length} arquivos varridos · 0 falhas`,
  );
  process.exit(0);
}

console.error(`✗ tokens · ${falhas.length} falha(s):\n`);
for (const f of falhas) console.error(`  ${f}`);
process.exit(1);
