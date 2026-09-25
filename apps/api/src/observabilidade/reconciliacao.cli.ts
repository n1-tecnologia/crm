/**
 * `npm run reconciliar -w @n1/api -- --dia=YYYY-MM-DD [--resumo=<caminho.json>] [--workspace=<id>]`
 *
 * CLI fino (D-01, molde de `../importacao/financeiro/importar.cli.ts`):
 * imprime uma tabela curta por origem, a contagem de falhas não tratadas e a
 * lista de códigos duplicados — que precisa sair vazia. Código de saída `1`
 * quando houver código duplicado OU falha não tratada; `0` num dia saudável.
 *
 * `--resumo=<caminho.json>` é como as contagens que vivem no `financeiro-tria`
 * entram (ver o cabeçalho de `./reconciliacao.ts` — este processo não lê o
 * Supabase de lá por conta própria). O arquivo é um `AmostraDaReconciliacao`
 * (menos `outbox`, que este CLI sempre lê do Postgres local) em JSON:
 *
 * ```json
 * {
 *   "porOrigem": {
 *     "plataforma": { "entradas": 3, "aprovacoes": 2, "resumosPublicados": 2, "tentativasOmie": 2, "resultadosOmie": { "sucesso": 2, "falha": 0 }, "codigosDeIntegracao": ["tria:payment-request:plataforma:tsk_1"] },
 *     "clickup":    { "entradas": 5, "aprovacoes": 4, "resumosPublicados": 4, "tentativasOmie": 4, "resultadosOmie": { "sucesso": 4, "falha": 0 }, "codigosDeIntegracao": ["clickup-tsk_9"] }
 *   },
 *   "comandosDoAdapterFalhos": 0
 * }
 * ```
 *
 * Sem `--resumo`, o CLI reconcilia só o outbox local — as duas coortes saem
 * zeradas (nunca um número inventado) e um aviso avisa que a metade do
 * `financeiro-tria` não entrou nesta rodada.
 *
 * Nenhum dado financeiro na saída (T-02-14): `codigosDuplicados` é a única
 * lista de valores, e são ids técnicos (`codigo_lancamento_integracao`),
 * nunca valor, documento ou nome.
 */

import { readFileSync } from "node:fs";
import { carregarEnv, encerrar } from "../persistencia/conexao";
import { ORIGENS, reconciliarDia, type AmostraDaReconciliacao, type EntradaPorOrigem } from "./reconciliacao";

/** Sinaliza saída não-zero sem `process.exit` direto — `encerrar()` sempre roda antes (molde de `importar.cli.ts`). */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

const argv = process.argv.slice(2);

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  return argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function lerResumo(caminho: string): Pick<AmostraDaReconciliacao, "porOrigem" | "comandosDoAdapterFalhos"> {
  const texto = readFileSync(caminho, "utf8");
  const dados = JSON.parse(texto) as Pick<AmostraDaReconciliacao, "porOrigem" | "comandosDoAdapterFalhos">;
  if (!dados.porOrigem || !dados.porOrigem.plataforma || !dados.porOrigem.clickup) {
    throw new Error(`--resumo=${caminho}: esperava "porOrigem.plataforma" e "porOrigem.clickup".`);
  }
  return dados;
}

function linhaDeOrigem(origem: string, entrada: EntradaPorOrigem): string {
  return `${origem.padEnd(11)} entradas ${entrada.entradas} · aprovações ${entrada.aprovacoes} · RESUMOs ${entrada.resumosPublicados} · tentativas Omie ${entrada.tentativasOmie} · Omie ok/falha ${entrada.resultadosOmie.sucesso}/${entrada.resultadosOmie.falha}`;
}

async function rodar(): Promise<void> {
  carregarEnv();

  const dia = valorDe("dia");
  if (!dia) {
    console.error("--dia=YYYY-MM-DD é obrigatório.");
    throw new SairComCodigo(1);
  }
  const workspaceId = valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1";
  const caminhoDoResumo = valorDe("resumo");

  let amostraParcial: Pick<AmostraDaReconciliacao, "porOrigem" | "comandosDoAdapterFalhos"> | undefined;
  if (caminhoDoResumo) {
    amostraParcial = lerResumo(caminhoDoResumo);
  } else {
    console.warn(
      "sem --resumo=<caminho.json>: as contagens do financeiro-tria (RESUMOs, Omie, comandos do adapter) saem zeradas nesta rodada — ver o cabeçalho de reconciliacao.cli.ts.",
    );
  }

  const resultado = await reconciliarDia({
    dia,
    workspaceId,
    ...(amostraParcial
      ? { amostra: { outbox: [], porOrigem: amostraParcial.porOrigem, comandosDoAdapterFalhos: amostraParcial.comandosDoAdapterFalhos } }
      : {}),
  });

  console.log(`reconciliação · dia ${resultado.dia} · workspace ${workspaceId}`);
  for (const origem of ORIGENS) console.log(linhaDeOrigem(origem, resultado.porOrigem[origem]));
  console.log(`falhas não tratadas: ${resultado.falhasNaoTratadas}`);
  console.log(`códigos duplicados: ${resultado.codigosDuplicados.length === 0 ? "nenhum" : resultado.codigosDuplicados.join(", ")}`);

  if (resultado.codigosDuplicados.length > 0 || resultado.falhasNaoTratadas > 0) {
    throw new SairComCodigo(1);
  }
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
