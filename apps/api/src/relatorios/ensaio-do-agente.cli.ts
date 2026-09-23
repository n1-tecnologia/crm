/**
 * `npm run ensaio:relatorio -w @n1/api -- --de=<AAAA-MM-DD> --ate=<AAAA-MM-DD> [flags]`
 *
 * CLI fino, no molde de `../bootstrap/gestao.cli.ts` (`pool().connect()` →
 * trabalho → `cliente.release()` → `encerrar()`) e de
 * `../importacao/clickup/importar-contas-a-pagar.cli.ts` (parsing manual de
 * `--chave=valor`, sem biblioteca). Nenhuma regra e nenhum SQL moram aqui —
 * a leitura de `plataforma.automacao_agenda` está em `./ensaio-do-agente.ts`
 * (`coberturaDaJanela`), a regra de acerto em `@n1/dominio` (`compararEnsaio`).
 * Este arquivo só compõe: hidrata, chama `compararEnsaio` por Tarefa,
 * agrega, renderiza, grava.
 *
 * Flags:
 * - `--de=AAAA-MM-DD` / `--ate=AAAA-MM-DD` (obrigatórias)
 * - `--espaco` (padrão `ws_n1`), `--lista` (padrão `CP.listId`)
 * - `--credenciais-omie=ok` — a ÚNICA forma de G7 sair `OK` em vez de
 *   `PENDENTE` (resíduo de 03-07, verificado no passo 4 do runbook de
 *   corte); nunca um padrão implícito
 * - `--exigir-caneta` — faz o processo sair `1` quando o veredito é `ADIAR`,
 *   para servir de portão do runbook além de leitura solta
 * - `--run` (padrão `ensaio-<de>-<ate>`) — nome da pasta em
 *   `apps/api/exportacoes/ensaio-do-agente/<run>/`
 *
 * Saída: `0` quando o relatório foi produzido (`CONCEDER` ou `ADIAR` sem
 * `--exigir-caneta`), `2` em `INCONCLUSIVO` (a janela não mediu — o corte
 * não pode prosseguir), `1` em `ADIAR` **com** `--exigir-caneta`.
 */

import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CP, LIMIAR_DA_CANETA, compararEnsaio } from "@n1/dominio/operations/financeiro";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { agregar, coberturaDaJanela, detalharPorConta, renderizar } from "./ensaio-do-agente";

/** Sinaliza saída não-zero sem chamar `process.exit` direto — `encerrar()` sempre roda antes (molde de `importar-contas-a-pagar.cli.ts`). */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

/** Escreve atômico (arquivo temporário + `rename`), criando a pasta se faltar — mesmo padrão de `../importacao/clickup/exportar.ts::gravarAtomico`, reimplementado aqui para `relatorios/` não importar de `importacao/clickup/`. */
async function gravarAtomico(caminho: string, conteudo: string): Promise<void> {
  const tmp = `${caminho}.tmp`;
  await mkdir(path.dirname(caminho), { recursive: true });
  await rm(tmp, { force: true });
  await writeFile(tmp, conteudo);
  await rename(tmp, caminho);
}

const argv = process.argv.slice(2);

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  return argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function temFlag(chave: string): boolean {
  return argv.includes(`--${chave}`);
}

async function rodar(): Promise<void> {
  carregarEnv();

  const de = valorDe("de");
  const ate = valorDe("ate");
  if (!de || !ate) {
    console.error("Uso: npm run ensaio:relatorio -w @n1/api -- --de=AAAA-MM-DD --ate=AAAA-MM-DD [--espaco=ws_n1] [--lista=lst_contas_a_pagar] [--credenciais-omie=ok] [--exigir-caneta] [--run=nome]");
    throw new SairComCodigo(1);
  }

  const workspaceId = valorDe("espaco") ?? process.env.WORKSPACE_ID ?? "ws_n1";
  const listId = valorDe("lista") ?? CP.listId;
  const credenciaisOmieOk = valorDe("credenciais-omie") === "ok";
  const exigirCaneta = temFlag("exigir-caneta");
  const run = valorDe("run") ?? `ensaio-${de}-${ate}`;

  const cliente = await pool().connect();
  let markdown: string;
  let json: string;
  let veredito: "CONCEDER" | "ADIAR" | "INCONCLUSIVO";
  let csv: string;
  try {
    const { state } = await hidratar(cliente, workspaceId);

    const resultados = state.tasks
      .filter((task) => task.listId === listId)
      .map((task) => compararEnsaio(state, task))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    const cobertura = await coberturaDaJanela(cliente, { workspaceId, listId, de, ate, state });
    const relatorio = agregar(resultados, cobertura, LIMIAR_DA_CANETA, { credenciaisOmieOk });
    ({ markdown, json } = renderizar(relatorio));
    veredito = relatorio.veredito;
    csv = detalharPorConta(resultados);
  } finally {
    cliente.release();
  }

  console.log(markdown);

  const pastaDoRelatorio = fileURLToPath(new URL(`../../exportacoes/ensaio-do-agente/${run}/`, import.meta.url));
  await gravarAtomico(path.join(pastaDoRelatorio, "RELATORIO.md"), markdown);
  await gravarAtomico(path.join(pastaDoRelatorio, "RELATORIO.json"), json);
  // Fora do git por LGPD (.gitignore) — o insumo de quem corrige o de-para, nunca o artefato público.
  await gravarAtomico(path.join(pastaDoRelatorio, "conferencia-detalhada.csv"), csv);
  console.log(`relatório agregado (versionado): ${pastaDoRelatorio}RELATORIO.{md,json}`);
  console.log(`relatório detalhado por conta (fora do git): ${pastaDoRelatorio}conferencia-detalhada.csv`);

  if (veredito === "INCONCLUSIVO") throw new SairComCodigo(2);
  if (veredito === "ADIAR" && exigirCaneta) throw new SairComCodigo(1);
}

try {
  await rodar();
} catch (erro) {
  if (erro instanceof SairComCodigo) {
    await encerrar();
    process.exit(erro.codigo);
  }
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar();
  process.exit(1);
}

await encerrar();
