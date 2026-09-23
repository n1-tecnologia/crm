/**
 * `MARCO_ZERO` — a primeira das duas barreiras contra o agendador de
 * Automações (Plan 03-08) alcançar o passado importado. As contas
 * importadas que ficam em `para pagar` com vencimento no passado satisfazem
 * `hoje >= disparo` em qualquer dia civil futuro — **51 das 117** contas em
 * `para pagar` do export estão nessa situação. Sem marca, a primeira
 * semeadura do agendador criaria dia civil para trás e dispararia A5/A6
 * (Comentário de cobrança com Menção à Pessoa) e A7/A8 (invocação do Agente
 * e movimentação para `lançado omie`) sobre contas fechadas ou paradas há
 * meses.
 *
 * `MARCO_ZERO` diz "a agenda desta Lista começa aqui": `diasCiveisPendentes`
 * (03-08) passa a contar de `max(dia_civil)`. A segunda barreira é o ensaio
 * da primeira volta (03-08, `ENSAIO_PRIMEIRA_VOLTA`) — mesmo sem
 * `MARCO_ZERO`, a primeira volta real roda em ensaio, é desfeita por
 * rollback e espera um ato humano (`npm run automacoes:liberar`). As duas
 * existem de propósito: uma limita **quais dias** nascem na agenda, a outra
 * limita **se algo dispara**. Nenhuma das duas é confiada sozinha.
 *
 * ## Por que a marca é escrita DEPOIS da importação, e não na mesma transação
 *
 * A importação não tem uma transação só — `./importar-contas-a-pagar.ts`
 * decidiu por lotes — então "a mesma transação" não existe como opção sem
 * amarrar a marca a um limite de lote arbitrário. E a marca significa *a
 * importação terminou*: escrevê-la antes do fim abriria a agenda com contas
 * ainda entrando. O risco do "depois" é o processo morrer entre o último
 * `commit` de lote e a marca — coberto por três coisas: a escrita é
 * idempotente (nem duplica no mesmo dia, nem cria uma segunda linha num dia
 * civil diferente — ver `marcarMarcoZero`), o CLI sai com código 1 se a
 * marca não entrou, e `--so-marco-zero` grava só ela, sem reimportar nada.
 * Ainda assim, o ensaio de 03-08 continua de pé como barreira independente.
 */

import type { PoolClient } from "pg";
import { CODIGOS_DA_AGENDA } from "../../automacoes/scheduler-worker";
import { sanitizarErro } from "../../persistencia/outbox-worker";
import { relogioDoSistema, type Relogio } from "../../testes/relogio";

/** O dia civil em `America/Sao_Paulo` — nunca `new Date()` direto no corpo desta função (o `Relogio` é injetado). */
const FORMATADOR_DE_DIA_CIVIL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function mensagemDoMarcoZero(workspaceId: string, listId: string): string {
  return (
    `A agenda de Automações desta Lista começa neste dia civil — nenhum dia anterior a ele nasce na agenda. ` +
    `Para liberar a primeira volta (ensaio): npm run automacoes:liberar -w @n1/api -- ${workspaceId} ${listId}.`
  );
}

/**
 * O dia civil de hoje em `America/Sao_Paulo`. Quando a importação atravessa
 * a meia-noite, a marca fica no dia da CONCLUSÃO — o mais tardio dos dois, o
 * conservador (menos dias civis semeados depois).
 */
export function diaCivilDeHoje(relogio: Relogio = relogioDoSistema): string {
  return FORMATADOR_DE_DIA_CIVIL.format(relogio.agora());
}

/**
 * Grava a linha `MARCO_ZERO` para `(workspaceId, listId, diaCivil)`.
 * Idempotente em dois graus: chamar de novo no MESMO dia civil não duplica
 * (`on conflict do nothing`); chamar de novo num dia civil DIFERENTE também
 * não cria uma segunda linha — a pré-checagem por
 * `last_error_code = CODIGOS_DA_AGENDA.MARCO_ZERO` garante que só existe uma
 * marca por `(workspaceId, listId)`, não uma por dia em que alguém rodou o
 * comando (é isso que faz a segunda execução do CLI, noutro dia, continuar
 * segura). Devolve `true` só quando a linha nasceu nesta chamada.
 */
export async function marcarMarcoZero(
  cliente: PoolClient,
  opcoes: { readonly workspaceId: string; readonly listId: string; readonly diaCivil: string },
): Promise<boolean> {
  const jaMarcado = await cliente.query(
    `select 1 from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2 and last_error_code = $3 limit 1`,
    [opcoes.workspaceId, opcoes.listId, CODIGOS_DA_AGENDA.MARCO_ZERO],
  );
  if ((jaMarcado.rowCount ?? 0) > 0) return false;

  const erro = sanitizarErro(mensagemDoMarcoZero(opcoes.workspaceId, opcoes.listId), CODIGOS_DA_AGENDA.MARCO_ZERO);
  const resultado = await cliente.query(
    `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado, last_error_code, last_error_summary, concluido_em)
     values ($1, $2, $3, 'concluido', $4, $5, now())
     on conflict (workspace_id, list_id, dia_civil) do nothing`,
    [opcoes.workspaceId, opcoes.listId, opcoes.diaCivil, erro.code, erro.summary],
  );
  // Nenhuma outra coluna é preenchida: `executadas`/`falhadas`/`puladas` ficam
  // nulas porque nenhuma Automação rodou — a marca não é um ciclo do agendador.
  return resultado.rowCount === 1;
}
