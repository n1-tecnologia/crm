/**
 * O RELÓGIO do motor de Automações — não o motor em si. Este arquivo garante
 * ao menos uma chamada de `runScheduledAutomations` por (Espaço de Trabalho,
 * Lista, dia civil), e nada mais. A idempotência de negócio continua em
 * `AutomationExecution`/`jaRodou`, dentro de
 * `packages/dominio/src/operations/automations.ts` — duplicá-la aqui criaria
 * duas fontes de verdade a manter sincronizadas, e a que morasse no `apps/api`
 * seria a que ninguém testa pelo domínio.
 *
 * Por que não é fila: a Automação de agenda não cruza limite de processo —
 * ela é uma função pura chamada dentro da MESMA transação da Unidade de
 * Trabalho (`executar()`). O outbox (`persistencia/outbox-worker.ts`) existe
 * para o que SAI do processo depois do commit; por isso este arquivo copia a
 * FORMA de `outbox-worker.ts` (lease, trava de concorrência única,
 * classificação de erro, `sanitizarErro()`) e não o seu papel de negócio.
 *
 * Por que `plataforma.automacao_agenda` (03-01, `005-agenda-de-automacoes.sql`)
 * existe: exclusão mútua entre instâncias do `apps/api` (DEC-06 já serializa
 * escrita por Espaço — duas hidratações simultâneas do mesmo Espaço só
 * dariam conflito de revisão) e auditoria de "o dia foi processado". Uma
 * linha `falhou`, ou uma `processando` com `locked_at` vencido, é o sinal de
 * que o processo caiu antes de fechar o dia — e é assim que "se o processo
 * cair no minuto errado, a agenda não é pulada" deixa de depender de fé.
 *
 * O relógio é sempre injetado: nenhuma linha deste arquivo chama
 * `new Date()` sem argumento, `Date.now()` ou lê o instante do SQL — todo
 * `locked_at`/`concluido_em` viaja como parâmetro vindo do `Relogio`
 * (`../testes/relogio.ts`). É isso que torna o caso do dia perdido
 * (catch-up, item Wave 0 de `03-VALIDATION.md`) testável sem esperar dois
 * dias de verdade.
 *
 * A primeira volta REAL de cada (Espaço, Lista) roda em ENSAIO (Task 2,
 * D3-03): calcula dentro da transação, captura as contagens e desfaz —
 * nenhum Comentário, Status ou invocação de Agente sai da primeira volta
 * sozinha. As contas importadas por 03-09/03-10 que ficam vencidas no
 * passado disparariam A5/A6/A7 em lote no dia seguinte à importação sem
 * esse gate; `MARCO_ZERO` (escrito por 03-10 ao terminar a importação) fixa
 * o início da agenda de uma Lista, e o ensaio fica parado até liberação
 * explícita (`npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>`).
 */

import type { AutomationExecution, DataState, Id, OperationResult } from "@n1/dominio";
import { runScheduledAutomations } from "@n1/dominio/operations/automations";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { eventosDeNotificacaoPorCanal, execucoesNovas } from "../persistencia/eventos-de-canal";
import { sanitizarErro } from "../persistencia/outbox-worker";
import { pool } from "../persistencia/conexao";
import { executar } from "../persistencia/unidade-de-trabalho";
import { type Relogio, relogioDoSistema } from "../testes/relogio";

/** Um dia em milissegundos — a única unidade que este arquivo soma a um `Date`. */
const UM_DIA_MS = 86_400_000;

/**
 * `"YYYY-MM-DD"` → `Date` em horário LOCAL. NUNCA `new Date(dia)`:
 * `runScheduledAutomations` lê `getFullYear`/`getMonth`/`getDate` em horário
 * local, e uma string `"YYYY-MM-DD"` passada direto ao construtor de `Date`
 * é lida como meia-noite UTC — que em América/São_Paulo cai no dia anterior
 * (achado de 03-02, `.planning/phases/03-contas-a-pagar/03-02-PLAN.md` § Task 1).
 */
export function dataCivil(dia: string): Date {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, diaDoMes ?? 1);
}

/** O inverso de `dataCivil`: `Date` em horário local → `"YYYY-MM-DD"`. */
function formatarDiaCivil(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `Date` truncado à meia-noite local — só ano/mês/dia importam para dia civil. */
function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Todos os dias civis entre `ultimoDia` (exclusive) e `hoje` (inclusive),
 * em ordem crescente — sem o corte de `janelaDias`. Existe só para que
 * `semear()` saiba QUANTOS dias a janela cortou, para o aviso; a resposta
 * de verdade é sempre a de `diasCiveisPendentes`.
 */
function todosOsDiasCiveisPendentes(ultimoDia: string | undefined, hoje: Date): string[] {
  const hojeTruncado = inicioDoDia(hoje);
  if (ultimoDia === undefined) return [formatarDiaCivil(hojeTruncado)];
  const inicio = new Date(dataCivil(ultimoDia).getTime() + UM_DIA_MS);
  if (inicio.getTime() > hojeTruncado.getTime()) return [];
  const dias: string[] = [];
  for (let cursor = inicio; cursor.getTime() <= hojeTruncado.getTime(); cursor = new Date(cursor.getTime() + UM_DIA_MS)) {
    dias.push(formatarDiaCivil(cursor));
  }
  return dias;
}

/**
 * Os dias civis que uma (Espaço, Lista) ainda não tem semeados na agenda,
 * do mais antigo ao mais novo, truncado aos últimos `janelaDias`.
 *
 * Sem `ultimoDia`, devolve só o dia civil de `hoje`: uma (Espaço, Lista) que
 * nunca teve linha nenhuma começa hoje, jamais reprocessando o passado
 * inteiro (o caso de uma Lista nova, sem backlog).
 *
 * A janela limita TRABALHO, não corretude: `hoje >= disparo` é monótono em
 * `runScheduledAutomations`, então o último dia da faixa já cobre o conjunto
 * de disparos de todos os anteriores — um processo que ficou fora por mais
 * de `janelaDias` não perde nenhuma Automação por causa deste corte, só
 * processa o catch-up em menos dias de agenda do que os que realmente
 * passaram.
 */
export function diasCiveisPendentes(ultimoDia: string | undefined, hoje: Date, janelaDias: number): string[] {
  const todos = todosOsDiasCiveisPendentes(ultimoDia, hoje);
  return janelaDias >= todos.length ? todos : todos.slice(-janelaDias);
}

/** Uma linha de `plataforma.automacao_agenda`, como as consultas abaixo a projetam (`dia_civil` sempre como string). */
export interface LinhaAgenda {
  readonly workspace_id: string;
  readonly list_id: string;
  readonly dia_civil: string;
  readonly estado: "pendente" | "processando" | "concluido" | "falhou";
  readonly tentativas: number;
  readonly locked_at: string | null;
  readonly locked_by: string | null;
  readonly last_error_code: string | null;
  readonly last_error_summary: string | null;
  readonly executadas: number | null;
  readonly falhadas: number | null;
  readonly puladas: number | null;
  readonly criado_em: string;
  readonly concluido_em: string | null;
}

/**
 * O vocabulário fechado de `last_error_code` desta tabela — 03-10 e
 * `liberar.cli.ts` importam os valores em vez de repetir literais. A coluna
 * se chama `last_error_code` porque é a que 03-01 criou; aqui ela carrega o
 * "motivo do último evento não rotineiro daquele dia" — uma coluna `motivo`
 * dedicada seria o refinamento óbvio numa migração futura (as migrações são
 * numeradas e imutáveis, DEC-10, e `005` já está aplicada).
 */
export const CODIGOS_DA_AGENDA = {
  /** Escrito por 03-10 ao terminar a importação: fixa o dia em que a agenda de uma Lista começa a contar. */
  MARCO_ZERO: "MARCO_ZERO",
  /** A primeira volta real de uma (Espaço, Lista) mediu e não gravou (Task 2, D3-03). */
  ENSAIO_PRIMEIRA_VOLTA: "ENSAIO_PRIMEIRA_VOLTA",
  /** `processando` com `locked_at` mais velho que `leaseMs`: o processo caiu antes de fechar o dia. */
  LEASE_EXPIRADO: "LEASE_EXPIRADO",
  /** `runScheduledAutomations`/`executar()` devolveram `ok: false` sem conflito de revisão. */
  RECUSA_DO_DOMINIO: "RECUSA_DO_DOMINIO",
  /** `executar()` devolveu `{ conflito: true }` — transitório, a próxima volta tenta de novo. */
  CONFLITO_DE_REVISAO: "CONFLITO_DE_REVISAO",
  /** Exceção não classificada durante o processamento da linha. */
  ERRO_INESPERADO: "ERRO_INESPERADO",
} as const;

/**
 * O tipo de `runScheduledAutomations` — a MESMA assinatura, para que o
 * worker nunca precise saber se está chamando a função real do domínio ou
 * uma variante. Ponto de extensão do Plan 03-11: a ponte HTTP do Agente
 * (`invocar-agente.ts`, nesta mesma pasta) resolve o de-para por HTTP ANTES
 * da Unidade de Trabalho e injeta aqui uma `RodarAgenda` com a mesma forma —
 * sem tocar em lease, contabilidade de linha ou saneamento.
 */
export type RodarAgenda = (
  state: DataState,
  atorId: Id,
  listId: Id,
  diaCivil: Date,
) => OperationResult<{
  readonly executed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly failures: ReadonlyArray<{ readonly taskId: Id; readonly title: string; readonly reason: string }>;
}>;

export interface OpcoesSchedulerWorker {
  /** Identifica esta instância em `locked_by` — dois processos precisam de valores distintos. */
  readonly workerId: string;
  /**
   * Quando definido, estreita a semeadura e a reivindicação a um único
   * Espaço de Trabalho — o teste isola a própria fatia; em produção fica
   * ausente e o worker cobre todos os Espaços, como o outbox.
   */
  readonly workspaceId?: string;
  readonly relogio?: Relogio;
  /** Intervalo entre ciclos de `iniciar()`, em ms. Padrão 1h. */
  readonly intervaloMs?: number;
  /** Quantos dias de catch-up semear no máximo por (Espaço, Lista). Padrão 7. */
  readonly janelaDias?: number;
  /** Tentativas antes de uma linha parar de ser reivindicada. Padrão 3. */
  readonly maxTentativas?: number;
  /** Tempo (ms) após o qual uma linha `processando` é considerada abandonada. Padrão 15min. */
  readonly leaseMs?: number;
  /** Padrão: `resolverMembroAgenteDoPipeline` (D-15) — nunca uma sessão humana. */
  readonly resolverAtor?: (workspaceId: string) => Promise<Id>;
  /** Padrão: `runScheduledAutomations` real. Ponto de extensão do Plan 03-11. */
  readonly rodarAgenda?: RodarAgenda;
  readonly registrar?: (nivel: "info" | "warn", mensagem: string, dados?: Record<string, string | number>) => void;
  /**
   * A primeira volta REAL de cada (Espaço, Lista) roda em ensaio — mede e
   * não grava (Task 2, D3-03). Padrão `true`; `false` é a porta para uma
   * Lista que nasce vazia, sem backlog, e não precisa do ritual.
   */
  readonly ensaioNaPrimeiraVolta?: boolean;
}

export interface SchedulerWorker {
  /** Começa o laço de `intervaloMs` em `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o laço; um `processarUm()` em voo termina sozinho. */
  parar(): void;
  /** Semeia os dias civis pendentes de cada (Espaço, Lista) do catálogo. Devolve quantas linhas nasceram. */
  semear(): Promise<number>;
  /**
   * Reivindica e processa UMA linha, sem esperar `intervaloMs` — o que o
   * teste usa para exercitar cada caso de forma determinística. Devolve
   * `false` quando não havia linha reivindicável.
   */
  processarUm(): Promise<boolean>;
}

interface ParDoCatalogo {
  readonly workspaceId: string;
  readonly listId: string;
}

/** O suficiente do JSON de `Automation` para decidir se ela tem gatilho de agenda publicado. */
interface AutomationRegistrada {
  readonly scopeId: string;
  readonly versions?: ReadonlyArray<{
    readonly state?: string;
    readonly trigger?: { readonly kind?: string };
  }>;
}

/**
 * Catálogo das (Espaço, Lista) que têm ao menos uma Automação ATIVA, com
 * escopo de Lista, e alguma versão PUBLICADA de gatilho `condicaoTemporal`.
 * Leitura de catálogo, não de estado — não substitui `hidratar()`, que
 * continua sendo a única fonte de verdade dentro da Unidade de Trabalho.
 *
 * O filtro aqui é deliberadamente CANDIDATO, não precedência de versão: quem
 * decide o que de fato dispara é `runScheduledAutomations`, no domínio.
 * Replicar aqui a escolha de qual versão vale duplicaria regra de negócio
 * fora de `packages/dominio`. Precedente de ler uma coleção por SQL direto:
 * `persistencia/credenciais-de-servico.ts::resolverMembroAgenteDoPipeline`.
 */
async function catalogoDeListasComAgenda(workspaceId?: string): Promise<ParDoCatalogo[]> {
  const parametros: unknown[] = [];
  let filtroWorkspace = "";
  if (workspaceId !== undefined) {
    parametros.push(workspaceId);
    filtroWorkspace = `and workspace_id = $${parametros.length}`;
  }
  const resultado = await pool().query<{ workspace_id: string; dados: AutomationRegistrada }>(
    `select workspace_id, dados
       from plataforma.registros
      where colecao = 'automations'
        and dados->>'lifecycle' = 'ativo'
        and dados->>'scopeType' = 'list'
        ${filtroWorkspace}`,
    parametros,
  );

  const pares = new Map<string, ParDoCatalogo>();
  for (const linha of resultado.rows) {
    const temGatilhoDeAgendaPublicado = (linha.dados.versions ?? []).some(
      (versao) => versao.state === "publicada" && versao.trigger?.kind === "condicaoTemporal",
    );
    if (!temGatilhoDeAgendaPublicado) continue;
    const chave = `${linha.workspace_id}::${linha.dados.scopeId}`;
    pares.set(chave, { workspaceId: linha.workspace_id, listId: linha.dados.scopeId });
  }
  return [...pares.values()];
}

/**
 * Libera uma Lista bloqueada pelo ensaio da primeira volta: apaga o
 * `last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` das linhas daquele par —
 * nunca toca `MARCO_ZERO` e nunca toca outro par. Devolve quantas linhas
 * foram liberadas (`0` quando não havia ensaio a liberar). Exportada
 * separadamente do worker porque é um ato humano único, não parte do laço —
 * `liberar.cli.ts` é o único chamador em produção.
 */
export async function liberarLista(workspaceId: string, listId: string): Promise<number> {
  const resultado = await pool().query(
    `update plataforma.automacao_agenda
        set last_error_code = null, last_error_summary = null
      where workspace_id = $1 and list_id = $2 and last_error_code = $3`,
    [workspaceId, listId, CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA],
  );
  return resultado.rowCount ?? 0;
}

export function criarSchedulerWorker(opcoes: OpcoesSchedulerWorker): SchedulerWorker {
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const janelaDias = opcoes.janelaDias ?? 7;
  const maxTentativas = opcoes.maxTentativas ?? 3;
  const leaseMs = opcoes.leaseMs ?? 900_000;
  const intervaloMs = opcoes.intervaloMs ?? 3_600_000;
  const ensaioNaPrimeiraVolta = opcoes.ensaioNaPrimeiraVolta ?? true;
  const registrar = opcoes.registrar ?? (() => undefined);
  const rodarAgenda: RodarAgenda = opcoes.rodarAgenda ?? runScheduledAutomations;
  // `resolverMembroAgenteDoPipeline` devolve `{ id }`, não o `Id` puro que
  // `OpcoesSchedulerWorker.resolverAtor` declara — o padrão adapta a forma
  // uma vez aqui, para que o resto do arquivo só conheça `Promise<Id>`.
  const resolverAtor: (workspaceId: string) => Promise<Id> =
    opcoes.resolverAtor ?? (async (workspaceId) => (await resolverMembroAgenteDoPipeline(workspaceId)).id);

  // O dia civil da última semeadura bem-sucedida deste PROCESSO — memória em
  // memória, não em banco: um processo recém-subido tem esta variável vazia,
  // o que é exatamente o que dispara o catch-up na primeira volta dele.
  // Semear é necessário no máximo uma vez por dia civil por processo.
  let ultimaSemeaduraEm: string | undefined;

  function mensagemDeEnsaio(workspaceId: string, listId: string): string {
    return `Ensaio da primeira volta: nada foi gravado. Libere com "npm run automacoes:liberar -w @n1/api -- ${workspaceId} ${listId}" quando o relato for aceitável.`;
  }

  /**
   * Zero dias `concluido` de verdade para este par — `MARCO_ZERO` (03-10) e
   * `ENSAIO_PRIMEIRA_VOLTA` (este arquivo) não contam como "processado de
   * verdade": o primeiro só fixa o começo da agenda, o segundo só mediu.
   */
  async function primeiraVoltaPendente(workspaceId: string, listId: string): Promise<boolean> {
    const resultado = await pool().query<{ n: string }>(
      `select count(*)::text as n
         from plataforma.automacao_agenda
        where workspace_id = $1 and list_id = $2 and estado = 'concluido'
          and coalesce(last_error_code, '') not in ($3, $4)`,
      [workspaceId, listId, CODIGOS_DA_AGENDA.MARCO_ZERO, CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA],
    );
    return Number(resultado.rows[0]?.n ?? "0") === 0;
  }

  /** Existe alguma linha de ensaio ainda não liberada para este par — `semear()` não cria dia novo enquanto ela existir. */
  async function listaBloqueadaPorEnsaio(workspaceId: string, listId: string): Promise<boolean> {
    const resultado = await pool().query<{ n: string }>(
      `select count(*)::text as n
         from plataforma.automacao_agenda
        where workspace_id = $1 and list_id = $2 and last_error_code = $3`,
      [workspaceId, listId, CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA],
    );
    return Number(resultado.rows[0]?.n ?? "0") > 0;
  }

  /**
   * `update ... set estado = 'falhou' where estado = 'processando' and
   * locked_at < agora - leaseMs` — o dia não some quando o processo cai: a
   * linha presa em `processando` volta a ser reivindicável. O resumo passa
   * por `sanitizarErro()` mesmo sendo uma mensagem constante, para que
   * exista um caminho só até `last_error_summary` (a invariante que 03-01
   * declarou na migração).
   */
  async function recuperarTravadas(): Promise<void> {
    const limite = new Date(relogio.agora().getTime() - leaseMs).toISOString();
    const erro = sanitizarErro(
      new Error("Lease vencida: o processo caiu antes de fechar este dia."),
      CODIGOS_DA_AGENDA.LEASE_EXPIRADO,
    );
    const parametros: unknown[] = [limite, erro.code, erro.summary];
    let filtroWorkspace = "";
    if (opcoes.workspaceId !== undefined) {
      parametros.push(opcoes.workspaceId);
      filtroWorkspace = `and workspace_id = $${parametros.length}`;
    }
    await pool().query(
      `update plataforma.automacao_agenda
          set estado = 'falhou', locked_by = null, locked_at = null,
              last_error_code = $2, last_error_summary = $3
        where estado = 'processando' and locked_at < $1 ${filtroWorkspace}`,
      parametros,
    );
  }

  /**
   * Semeia os dias civis pendentes de cada (Espaço, Lista) do catálogo.
   * Pares bloqueados por ensaio não recebem dia novo (Task 2) — a Lista
   * fica parada, visível, até `liberarLista()`. Quando a janela cortar dias
   * de um par com histórico, avisa a QUANTIDADE cortada — nunca nada da
   * Tarefa.
   */
  async function semear(): Promise<number> {
    const hoje = relogio.agora();
    ultimaSemeaduraEm = formatarDiaCivil(inicioDoDia(hoje));

    const pares = await catalogoDeListasComAgenda(opcoes.workspaceId);
    let linhasCriadas = 0;

    for (const par of pares) {
      if (await listaBloqueadaPorEnsaio(par.workspaceId, par.listId)) {
        registrar(
          "warn",
          `Lista bloqueada pelo ensaio da primeira volta — libere com "npm run automacoes:liberar -w @n1/api -- ${par.workspaceId} ${par.listId}"`,
          { workspaceId: par.workspaceId, listId: par.listId },
        );
        continue;
      }

      const ultimo = await pool().query<{ ultimo: string | null }>(
        `select to_char(max(dia_civil), 'YYYY-MM-DD') as ultimo
           from plataforma.automacao_agenda
          where workspace_id = $1 and list_id = $2`,
        [par.workspaceId, par.listId],
      );
      const ultimoDia = ultimo.rows[0]?.ultimo ?? undefined;

      const dias = diasCiveisPendentes(ultimoDia, hoje, janelaDias);
      const todos = todosOsDiasCiveisPendentes(ultimoDia, hoje);
      if (ultimoDia !== undefined && todos.length > dias.length) {
        registrar("warn", "A janela do agendador cortou dias de catch-up fora do alcance.", {
          workspaceId: par.workspaceId,
          listId: par.listId,
          diasForaDaJanela: todos.length - dias.length,
        });
      }

      for (const dia of dias) {
        const insercao = await pool().query(
          `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado)
           values ($1, $2, $3, 'pendente')
           on conflict do nothing`,
          [par.workspaceId, par.listId, dia],
        );
        linhasCriadas += insercao.rowCount ?? 0;
      }
    }

    return linhasCriadas;
  }

  /**
   * `for update skip locked` sobre `estado in ('pendente','falhou')`, o
   * mesmo padrão de lease de `outbox-worker.ts::reivindicar()` adaptado à
   * chave composta `(workspace_id, list_id, dia_civil)`. `order by
   * dia_civil` faz o dia mais antigo em aberto ser o primeiro — é o
   * catch-up. `tentativas < maxTentativas` impede que uma recusa permanente
   * seja reivindicada para sempre.
   */
  async function reivindicar(): Promise<LinhaAgenda | undefined> {
    const agora = relogio.agora().toISOString();
    const parametros: unknown[] = [opcoes.workerId, agora, maxTentativas];
    let filtroWorkspace = "";
    if (opcoes.workspaceId !== undefined) {
      parametros.push(opcoes.workspaceId);
      filtroWorkspace = `and s.workspace_id = $${parametros.length}`;
    }
    const resultado = await pool().query<LinhaAgenda>(
      `update plataforma.automacao_agenda a
          set estado = 'processando', locked_at = $2, locked_by = $1, tentativas = a.tentativas + 1
        where (a.workspace_id, a.list_id, a.dia_civil) = (
          select s.workspace_id, s.list_id, s.dia_civil
            from plataforma.automacao_agenda s
           where s.estado in ('pendente','falhou') and s.tentativas < $3 ${filtroWorkspace}
           order by s.dia_civil, s.criado_em
           limit 1
             for update skip locked
        )
        returning
          a.workspace_id, a.list_id, to_char(a.dia_civil, 'YYYY-MM-DD') as dia_civil,
          a.estado, a.tentativas, a.locked_at, a.locked_by,
          a.last_error_code, a.last_error_summary,
          a.executadas, a.falhadas, a.puladas, a.criado_em, a.concluido_em`,
      parametros,
    );
    return resultado.rows[0];
  }

  /** Fecha a linha reivindicada com um estado terminal — o único lugar que escreve `concluido_em`/contagens/erro. */
  async function fecharLinha(
    linha: LinhaAgenda,
    estado: "concluido" | "falhou",
    codigo: string | null,
    resumo: string | null,
    contagem?: { readonly executed: number; readonly failed: number; readonly skipped: number },
  ): Promise<void> {
    const concluidoEm = estado === "concluido" ? relogio.agora().toISOString() : null;
    await pool().query(
      `update plataforma.automacao_agenda
          set estado = $1, last_error_code = $2, last_error_summary = $3,
              executadas = $4, falhadas = $5, puladas = $6, concluido_em = $7
        where workspace_id = $8 and list_id = $9 and dia_civil = $10`,
      [
        estado,
        codigo,
        resumo,
        contagem?.executed ?? null,
        contagem?.failed ?? null,
        contagem?.skipped ?? null,
        concluidoEm,
        linha.workspace_id,
        linha.list_id,
        linha.dia_civil,
      ],
    );
  }

  async function processarUm(): Promise<boolean> {
    await recuperarTravadas();

    const hojeCivil = formatarDiaCivil(inicioDoDia(relogio.agora()));
    if (ultimaSemeaduraEm !== hojeCivil) await semear();

    const linha = await reivindicar();
    if (!linha) return false;

    const { workspace_id: workspaceId, list_id: listId, dia_civil: diaCivilTexto } = linha;
    const diaCivilData = dataCivil(diaCivilTexto);

    // Capturados pelo fechamento de `executar()` abaixo quando a linha está
    // em ensaio (Task 2): o cálculo acontece, mas o resultado é forçado a
    // `ok: false` para que a Unidade de Trabalho desfaça a transação — o
    // mesmo caminho de rollback que uma recusa legítima do domínio já usa
    // (`unidade-de-trabalho.ts`, `if (!resultado.ok)`).
    let ensaioContagem: { readonly executed: number; readonly failed: number; readonly skipped: number } | undefined;
    let foiForcadoAoEnsaio = false;
    // AUTO-02/D5-09 (Task 3) — a MESMA costura de `../rotas/operacoes.ts`:
    // capturada dentro do callback, reatribuída a cada tentativa de
    // `executar()`, nunca acumulada entre retries de conflito de revisão.
    let execucoesDaRodada: readonly AutomationExecution[] = [];

    try {
      const emEnsaio = ensaioNaPrimeiraVolta && (await primeiraVoltaPendente(workspaceId, listId));
      const atorId = await resolverAtor(workspaceId);

      const resultadoDaTransacao = await executar(
        workspaceId,
        (state) => {
          const idsAntes = new Set(state.automationExecutions.map((e) => e.id));
          const resultado = rodarAgenda(state, atorId, listId, diaCivilData);
          execucoesDaRodada = execucoesNovas(state, idsAntes);
          if (emEnsaio && resultado.ok) {
            ensaioContagem = { executed: resultado.value.executed, failed: resultado.value.failed, skipped: resultado.value.skipped };
            foiForcadoAoEnsaio = true;
            // D3-03 — o Ensaio não gasta dinheiro nem manda WhatsApp; ele mede.
            // `ok: false` aqui faz `unidade-de-trabalho.ts` retornar ANTES de
            // `gravarEventos` (o mesmo `if (!resultado.ok)` que já desfaz a
            // Execução inteira) — o Ensaio não grava evento de Canal nenhum,
            // e isso é AUTOMÁTICO: não precisa de guarda extra aqui.
            return { ok: false, error: mensagemDeEnsaio(workspaceId, listId) };
          }
          return resultado;
        },
        { eventos: (_valor, state) => eventosDeNotificacaoPorCanal(state, execucoesDaRodada) },
      );

      if ("conflito" in resultadoDaTransacao && resultadoDaTransacao.conflito) {
        const erro = sanitizarErro(resultadoDaTransacao.error, CODIGOS_DA_AGENDA.CONFLITO_DE_REVISAO);
        await fecharLinha(linha, "falhou", erro.code, erro.summary);
      } else if (!resultadoDaTransacao.ok) {
        if (foiForcadoAoEnsaio && ensaioContagem) {
          const erro = sanitizarErro(mensagemDeEnsaio(workspaceId, listId), CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA);
          await fecharLinha(linha, "concluido", erro.code, erro.summary, ensaioContagem);
          registrar("info", "Primeira volta em ensaio: nada foi gravado.", { workspaceId, listId, diaCivil: diaCivilTexto });
        } else {
          // A saída do domínio nunca cita Tarefa (nome de fornecedor) ou
          // Comentário — só o texto de recusa da própria operação, que fala
          // de permissão/estrutura (T-3-04). `failures[].title`/`.reason` do
          // resultado bem-sucedido nunca chegam aqui nem a lugar nenhum: são
          // ignorados por construção, não por filtro.
          const erro = sanitizarErro(resultadoDaTransacao.error, CODIGOS_DA_AGENDA.RECUSA_DO_DOMINIO);
          await fecharLinha(linha, "falhou", erro.code, erro.summary);
        }
      } else {
        await fecharLinha(linha, "concluido", null, null, resultadoDaTransacao.value);
      }
    } catch (erroInesperado) {
      const erro = sanitizarErro(erroInesperado, CODIGOS_DA_AGENDA.ERRO_INESPERADO);
      await fecharLinha(linha, "falhou", erro.code, erro.summary);
    }

    return true;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emAndamento = false;

  return {
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(() => {
        if (emAndamento) return;
        emAndamento = true;
        void processarUm().finally(() => {
          emAndamento = false;
        });
      }, intervaloMs);
    },
    parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    },
    semear,
    processarUm,
  };
}
