/**
 * `npm run contas-a-pagar:configurar -w @n1/api [-- --apply]`
 *
 * Evolui a configuração da Lista "Contas a pagar" (plano pós-auditoria,
 * `docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 2.1 e
 * 1.5) sobre um Espaço de Trabalho que já rodou `npm run bootstrap:gestao -w
 * @n1/api` (Fase 1):
 *   - acrescenta à saída de "para pagar" o que o Omie exige (Categoria de
 *     pagamento, Fornecedor, Nome do fornecedor), sem tirar nada do que já
 *     está lá;
 *   - pausa a A7 legada ("A7 · D-1: lançar no Omie pelo Agente"), se ativa.
 * Recusa divergência sem sobrescrever nada; reaplicar é no-op.
 *
 * Sem flag, roda em `--dry-run`: hidrata, calcula, mostra e faz rollback —
 * aplicar exige intenção explícita (`--apply`). `--apply` grava contra o
 * Espaço indicado, `ws_n1` por padrão (PRODUÇÃO) — rode o dry-run primeiro.
 *
 * Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):
 *   --dry-run          padrão; não grava
 *   --apply            grava de verdade, dentro da Unidade de Trabalho
 *   --workspace=<id>   padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --membro=<id>      Membro atuante (quem configura a Lista e pausa a A7);
 *                      padrão "mem_maryane" — precisa administrar a Lista
 *
 * Disciplina de saída (T-02-21): só ids, contagens e o modo — nunca valor de
 * Campo de conta. Código de saída 1 quando a evolução recusa.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { configurarContasAPagar, opcoesDaLinhaDeComando } from "./contas-a-pagar";

carregarEnv();

const opcoes = opcoesDaLinhaDeComando(process.argv.slice(2), process.env);
const resultado = await configurarContasAPagar(opcoes);

console.log(`modo                     ${resultado.dryRun ? "dry-run (nada gravado)" : "apply"}`);
console.log(`espaço                   ${opcoes.workspaceId}`);

if (!resultado.ok) {
  console.error(`recusado                 ${resultado.error}`);
  await encerrar();
  process.exit(1);
}

const { exigenciasAcrescentadas, automacoesPausadas, conferidos, divergentes } = resultado.diff;
console.log(
  `exigências acrescentadas ${exigenciasAcrescentadas.length}${exigenciasAcrescentadas.length > 0 ? ` — ${exigenciasAcrescentadas.join(", ")}` : ""}`,
);
console.log(`automações pausadas      ${automacoesPausadas.length}${automacoesPausadas.length > 0 ? ` — ${automacoesPausadas.join(", ")}` : ""}`);
console.log(`conferidos               ${conferidos.length}${conferidos.length > 0 ? ` — ${conferidos.join(", ")}` : ""}`);
console.log(`divergentes              ${divergentes.length}`);

await encerrar();
