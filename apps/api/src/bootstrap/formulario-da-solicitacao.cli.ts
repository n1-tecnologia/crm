/**
 * `npm run solicitacoes:formulario -w @n1/api [-- flags]`
 *
 * Checklist 1.8 — cria no Espaço de Trabalho o Formulário público da
 * Solicitação de pagamento (perguntas, seções e condições do UI-SPEC, como
 * dado). Depois disso, tudo se edita pela tela (Lista › Configurações ›
 * Formulários). Rode antes `solicitacoes:configurar --apply`: é ele que tira
 * da Lista os Campos de Contas a pagar com o mesmo nome dos dela.
 *
 * Sem flag, roda em `--dry-run`: hidrata, cria na memória, mostra e faz
 * rollback. Gravar exige `--apply`.
 *
 * Flags:
 *   --dry-run          padrão; não grava
 *   --apply            grava de verdade, dentro da Unidade de Trabalho
 *   --workspace=<id>   padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --membro=<id>      o dono do Formulário (o envio cria a Tarefa em nome
 *                      dele); padrão "mem_maryane"
 *   --com-configuracao só no dry-run: simula antes o solicitacoes:configurar,
 *                      para ver os dois juntos sem gravar nada
 *
 * Saída: só ids, contagens e o caminho do link — nunca conteúdo de Tarefa.
 * Código de saída 1 quando a criação recusa.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { criarFormularioDaSolicitacao } from "./formulario-da-solicitacao";

carregarEnv();

const argv = process.argv.slice(2);
const valorDe = (chave: string): string | undefined => argv.find((a) => a.startsWith(`--${chave}=`))?.slice(chave.length + 3);

const resultado = await criarFormularioDaSolicitacao({
  workspaceId: valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1",
  actingMemberId: valorDe("membro") ?? "mem_maryane",
  dryRun: !argv.includes("--apply"),
  simularConfiguracao: argv.includes("--com-configuracao"),
});

console.log(`modo         ${resultado.dryRun ? "dry-run (nada gravado)" : "apply"}`);
if (!resultado.ok) {
  console.error(`recusado     ${resultado.error}`);
  await encerrar();
  process.exit(1);
}
console.log(`formulário   ${resultado.criado ? (resultado.dryRun ? "seria criado" : "criado") : "já existia (nada mudou)"} — ${resultado.formId}, ${resultado.perguntas} perguntas`);
console.log(`link         ${resultado.segredo ? `/f/${resultado.segredo}` : "(o segredo nasce no --apply)"}`);
await encerrar();
