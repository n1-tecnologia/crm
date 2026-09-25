#!/usr/bin/env node
/**
 * Compara as duas cópias da matriz de fixtures do contrato v1
 * (`contratos/payment-requests-v1/`, Plan 02-02) — a canônica deste
 * monorepo e a cópia verbatim em `../financeiro-tria/automation/contratos/payment-requests-v1/`
 * (Plan 02-26, D-16). D-16 decidiu NÃO criar um pacote npm compartilhado
 * entre os dois repositórios nesta fase; o hash agregado por arquivo é o
 * que prova que a cópia continua sendo a MESMA matriz depois de mudanças
 * em qualquer um dos dois lados — sem ele, uma edição feita só de um lado
 * (produtor OU consumidor) divergiria em silêncio (T-02-11).
 *
 * Saída:
 *   - `OK <hash agregado>` e código 0 quando as duas cópias são idênticas
 *     byte a byte, arquivo por arquivo;
 *   - a lista de arquivos divergentes/faltantes/extras e código 1 quando
 *     não são;
 *   - aviso + código 0 quando `FINANCEIRO_TRIA_DIR` (padrão `../financeiro-tria`,
 *     resolvido a partir da raiz deste monorepo) não existe — nunca quebra
 *     quem só tem este monorepo clonado, sem o repositório irmão ao lado.
 *
 * Uso: `npm run verificar:contratos` (raiz) — também entra em `npm run check`.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_DESTE_MONOREPO = fileURLToPath(new URL("..", import.meta.url));
const NOME_DO_DIRETORIO = "contratos/payment-requests-v1";

const DIR_CANONICO = path.join(RAIZ_DESTE_MONOREPO, NOME_DO_DIRETORIO);
const FINANCEIRO_TRIA_DIR = process.env.FINANCEIRO_TRIA_DIR
  ? path.resolve(RAIZ_DESTE_MONOREPO, process.env.FINANCEIRO_TRIA_DIR)
  : path.resolve(RAIZ_DESTE_MONOREPO, "..", "financeiro-tria");
const DIR_COPIA = path.join(FINANCEIRO_TRIA_DIR, "automation", NOME_DO_DIRETORIO);

/** sha256 do conteúdo CRU do arquivo (bytes, nunca reserializado) — mesma receita de `apps/api/src/importacao/clickup/manifesto.ts`. */
function hashDoArquivo(caminho) {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}

/** `{ [nomeDoArquivo]: sha256 }`, só arquivos (nunca subpastas) — o README entra na matriz também: é parte do que precisa ficar idêntico. */
function hashesDoDiretorio(dir) {
  const nomes = readdirSync(dir, { withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => entrada.name)
    .sort();
  const hashes = {};
  for (const nome of nomes) {
    hashes[nome] = hashDoArquivo(path.join(dir, nome));
  }
  return hashes;
}

/** Hash agregado: sha256 de `nome:hash` por linha, arquivos em ordem alfabética — determinístico, sensível a 1 byte em 1 arquivo. */
function hashAgregado(hashesPorArquivo) {
  const linhas = Object.keys(hashesPorArquivo)
    .sort()
    .map((nome) => `${nome}:${hashesPorArquivo[nome]}`);
  return createHash("sha256").update(linhas.join("\n")).digest("hex");
}

function sair(codigo, mensagem) {
  if (mensagem) {
    if (codigo === 0) console.log(mensagem);
    else console.error(mensagem);
  }
  process.exit(codigo);
}

if (!existsSync(DIR_CANONICO)) {
  sair(1, `FALHA: diretório canônico ausente: ${DIR_CANONICO}`);
}

if (!existsSync(FINANCEIRO_TRIA_DIR)) {
  sair(
    0,
    `AVISO: repositório irmão não encontrado em "${FINANCEIRO_TRIA_DIR}" — pulando ` +
      `verificação (defina FINANCEIRO_TRIA_DIR para apontar para outro caminho).`,
  );
}

if (!existsSync(DIR_COPIA)) {
  sair(
    1,
    `FALHA: repositório irmão existe, mas a cópia do contrato não: ${DIR_COPIA} — ` +
      `rode a cópia verbatim de ${NOME_DO_DIRETORIO} (Plan 02-26) antes de verificar.`,
  );
}

const hashesCanonico = hashesDoDiretorio(DIR_CANONICO);
const hashesCopia = hashesDoDiretorio(DIR_COPIA);

const arquivosCanonico = new Set(Object.keys(hashesCanonico));
const arquivosCopia = new Set(Object.keys(hashesCopia));

const faltandoNaCopia = [...arquivosCanonico].filter((nome) => !arquivosCopia.has(nome)).sort();
const extrasNaCopia = [...arquivosCopia].filter((nome) => !arquivosCanonico.has(nome)).sort();
const divergentes = [...arquivosCanonico]
  .filter((nome) => arquivosCopia.has(nome) && hashesCanonico[nome] !== hashesCopia[nome])
  .sort();

if (faltandoNaCopia.length > 0 || extrasNaCopia.length > 0 || divergentes.length > 0) {
  const linhas = ["FALHA: as duas cópias de contratos/payment-requests-v1/ divergem:"];
  for (const nome of faltandoNaCopia) linhas.push(`  faltando na cópia (${DIR_COPIA}): ${nome}`);
  for (const nome of extrasNaCopia) linhas.push(`  extra na cópia (não existe no canônico): ${nome}`);
  for (const nome of divergentes) linhas.push(`  conteúdo divergente: ${nome}`);
  sair(1, linhas.join("\n"));
}

const hashFinal = hashAgregado(hashesCanonico);
sair(0, `OK ${hashFinal} (${arquivosCanonico.size} arquivos idênticos em ${DIR_CANONICO} e ${DIR_COPIA})`);
