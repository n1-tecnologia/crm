/**
 * O relatório do Ensaio de D3-03 — a peça que fecha a fase com uma DECISÃO:
 * o Agente ganha a caneta ou não. Três camadas separadas de propósito, para
 * que o teste cubra as duas primeiras sem `DATABASE_URL`:
 *
 * `coberturaDaJanela` (I/O) — a única função deste arquivo que toca o banco.
 * Lê `plataforma.automacao_agenda` (03-01/03-08) e cruza com o `DataState`
 * já hidratado (Ensaios e candidatas a A7) para classificar cada dia civil
 * da janela. Nunca escreve.
 *
 * `agregar` (pura) — recebe os `ResultadoDaConferencia` que `compararEnsaio`
 * (`@n1/dominio/operations/financeiro`) já julgou, a cobertura, e
 * `LIMIAR_DA_CANETA`; devolve o `Relatorio` com contagens, taxas (sempre com
 * denominador), os sete portões e o veredito. A REGRA DE ACERTO não mora
 * aqui — mora no domínio (`./CONTEXT.md` desta pasta). Esta função só soma,
 * divide e decide `CONCEDER`/`ADIAR`/`INCONCLUSIVO` a partir do que o
 * domínio já classificou.
 *
 * `renderizar` (pura) — `Relatorio` → `{ markdown, json }`. Nenhum título de
 * Tarefa, nome de fornecedor, valor, documento, chave Pix, código de barras
 * ou `taskId` entra aqui (T-3-65): o que atravessa a fronteira para o
 * artefato versionado é contagem, vocabulário de veredito e pares agregados
 * `<código> → <código>` — nunca o registro individual.
 *
 * `detalharPorConta` (pura) — o CSV linha a linha, COM `taskId`. É o insumo
 * de quem vai corrigir o de-para; por isso ele NÃO vai para o git
 * (`.gitignore`, ao lado do padrão que 03-10 já abriu para
 * `apps/api/exportacoes/clickup/`).
 */

import type { PoolClient } from "pg";
import type { DataState, Id, Task } from "@n1/dominio";
import { CP, LIMIAR_DA_CANETA, type ResultadoDaConferencia, type VereditoDaConferencia } from "@n1/dominio/operations/financeiro";
import { CODIGOS_DA_AGENDA } from "../automacoes/scheduler-worker";

/* ═══════════════════════════ Cobertura por dia civil ═══════════════════════════ */

/**
 * `"YYYY-MM-DD"` no fuso `America/Sao_Paulo` — o mesmo formatador de
 * `contas-a-pagar.ts` (03-10) e `marco-zero.ts`: um dia civil não tem fuso
 * por definição (documento 06, 6.2), mas os instantes que ele classifica
 * (`AgentExecution.startedAt`) são UTC, e é preciso um fuso para lê-los como
 * dia civil de verdade.
 */
const FORMATADOR_DE_DIA_CIVIL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function diaCivilDoInstante(instante: string): string {
  return FORMATADOR_DE_DIA_CIVIL.format(new Date(instante));
}

/** `"YYYY-MM-DD"` → o dia civil seguinte, em horário LOCAL (o mesmo cuidado de `scheduler-worker.ts::dataCivil`: nunca `new Date(dia)` puro). */
function diaSeguinte(dia: string): string {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  const d = new Date(ano ?? 1970, (mes ?? 1) - 1, (diaDoMes ?? 1) + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Todos os dias civis entre `de` e `ate`, inclusive, em ordem crescente. */
function todosOsDiasEntre(de: string, ate: string): string[] {
  const [anoDe, mesDe, diaDe] = de.split("-").map(Number);
  const [anoAte, mesAte, diaAte] = ate.split("-").map(Number);
  const inicio = new Date(anoDe ?? 1970, (mesDe ?? 1) - 1, diaDe ?? 1);
  const fim = new Date(anoAte ?? 1970, (mesAte ?? 1) - 1, diaAte ?? 1);
  const dias: string[] = [];
  for (let cursor = inicio.getTime(); cursor <= fim.getTime(); cursor += 86_400_000) {
    const d = new Date(cursor);
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dias;
}

function valorDoCampo(task: Task, definitionId: Id): string | number | boolean | readonly string[] | null | undefined {
  return task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
}

function vazio(valor: ReturnType<typeof valorDoCampo>): boolean {
  return valor === undefined || valor === null || valor === "" || (Array.isArray(valor) && valor.length === 0);
}

function vencimentoCivil(task: Task): string | undefined {
  if (!task.dueDate) return undefined;
  return task.dueDate.form === "civilDay" ? task.dueDate.value : task.dueDate.value.slice(0, 10);
}

/**
 * As Tarefas que satisfaziam A7 no dia civil `dia`: "para pagar", com Valor
 * preenchido, Integração manual vazia, e vencimento no dia SEGUINTE — A7
 * dispara em D-1 (`vencimento(-1)` em `seed-financeiro.ts`), então o dia em
 * que a Automação roda é sempre um dia antes do vencimento. Leitura do
 * `DataState` já hidratado — aproximação deliberada (estado atual, não
 * histórico): o mesmo grau de precisão que `catalogoDeListasComAgenda`
 * (`scheduler-worker.ts`) já assume ao ler catálogo em vez de replay.
 *
 * Plano pós-auditoria (1.5): a A7 saiu do seed e a ponte deixou de rodá-la —
 * quem lança agora é a ponte, quando a conta ENTRA em "em lançamento omie", e
 * o modo ensaio da ponte só registra em log o que lançaria (nenhuma Execução
 * de sombra nasce). Este relatório continua medindo a janela em que a A7
 * ensaiava; para o gatilho novo, "candidata do dia" não corresponde mais a
 * lançamento nenhum, e um dia depois de 1.5 sai INCONCLUSIVO por construção.
 */
function candidatasNoDia(state: DataState, listId: Id, dia: string): number {
  const alvo = diaSeguinte(dia);
  return state.tasks.filter((task) => {
    if (task.listId !== listId) return false;
    if (task.statusId !== CP.status.paraPagar) return false;
    if (vencimentoCivil(task) !== alvo) return false;
    if (vazio(valorDoCampo(task, CP.fields.valor))) return false;
    if (!vazio(valorDoCampo(task, CP.fields.integracaoManual))) return false;
    return true;
  }).length;
}

/** Ensaios (`AgentExecution` com `rehearsal: true`) nascidos no dia civil `dia`, restritos à Lista `listId` — a âncora (`anchor.id`) é a Tarefa; o vínculo com a Lista vem dela. */
function ensaiosNoDia(state: DataState, listId: Id, dia: string): number {
  let n = 0;
  for (const execucao of state.agentExecutions) {
    if (execucao.rehearsal !== true || !execucao.anchor) continue;
    if (diaCivilDoInstante(execucao.startedAt) !== dia) continue;
    const tarefa = state.tasks.find((t) => t.id === execucao.anchor?.id);
    if (tarefa?.listId === listId) n += 1;
  }
  return n;
}

/**
 * O vocabulário fechado da classificação de um dia civil — os quatro
 * últimos são `dia_sem_medicao` (T-3-67, defesa 2): um dia sem medição NUNCA
 * lê como um dia de acerto perfeito.
 */
export type ClassificacaoDoDia = "medido" | "sem_agenda" | "agenda_nao_concluida" | "ensaio_primeira_volta_nao_liberado" | "zero_ensaios_com_candidatas";

const CLASSIFICACOES_SEM_MEDICAO: ReadonlySet<ClassificacaoDoDia> = new Set([
  "sem_agenda",
  "agenda_nao_concluida",
  "ensaio_primeira_volta_nao_liberado",
  "zero_ensaios_com_candidatas",
]);

export interface DiaDeCobertura {
  readonly dia: string;
  readonly classificacao: ClassificacaoDoDia;
}

export interface Cobertura {
  readonly janela: { readonly de: string; readonly ate: string };
  readonly dias: readonly DiaDeCobertura[];
  /** Contagem de dias cuja classificação está em `CLASSIFICACOES_SEM_MEDICAO` — `> 0` força `INCONCLUSIVO` em `agregar`. */
  readonly diasSemMedicao: number;
}

export interface OpcoesDeCobertura {
  readonly workspaceId: string;
  readonly listId: Id;
  readonly de: string;
  readonly ate: string;
  /** O `DataState` já hidratado — `coberturaDaJanela` não hidrata de novo; quem chama já tinha o estado para rodar `compararEnsaio`. */
  readonly state: DataState;
}

/**
 * Cruza `plataforma.automacao_agenda` (uma consulta só, para a janela
 * inteira) com os Ensaios e as candidatas a A7 de cada dia civil, e
 * classifica. A ÚNICA leitura de banco deste arquivo — nunca a Unidade de
 * Trabalho, nunca um `insert`/`update`/`delete`: um relatório é somente-leitura.
 */
export async function coberturaDaJanela(cliente: PoolClient, opcoes: OpcoesDeCobertura): Promise<Cobertura> {
  const linhas = await cliente.query<{ dia_civil: string; estado: string; last_error_code: string | null }>(
    `select to_char(dia_civil, 'YYYY-MM-DD') as dia_civil, estado, last_error_code
       from plataforma.automacao_agenda
      where workspace_id = $1 and list_id = $2 and dia_civil between $3 and $4`,
    [opcoes.workspaceId, opcoes.listId, opcoes.de, opcoes.ate],
  );
  const porDia = new Map(linhas.rows.map((linha) => [linha.dia_civil, linha]));

  const dias: DiaDeCobertura[] = todosOsDiasEntre(opcoes.de, opcoes.ate).map((dia): DiaDeCobertura => {
    const linha = porDia.get(dia);
    if (!linha) return { dia, classificacao: "sem_agenda" };
    if (linha.estado !== "concluido") return { dia, classificacao: "agenda_nao_concluida" };
    if (linha.last_error_code === CODIGOS_DA_AGENDA.ENSAIO_PRIMEIRA_VOLTA) {
      return { dia, classificacao: "ensaio_primeira_volta_nao_liberado" };
    }
    const ensaios = ensaiosNoDia(opcoes.state, opcoes.listId, dia);
    const candidatas = candidatasNoDia(opcoes.state, opcoes.listId, dia);
    if (ensaios === 0 && candidatas > 0) return { dia, classificacao: "zero_ensaios_com_candidatas" };
    return { dia, classificacao: "medido" };
  });

  return {
    janela: { de: opcoes.de, ate: opcoes.ate },
    dias,
    diasSemMedicao: dias.filter((d) => CLASSIFICACOES_SEM_MEDICAO.has(d.classificacao)).length,
  };
}

/* ═══════════════════════════════ Agregação (pura) ═══════════════════════════════ */

/** O vocabulário fechado, na ordem em que o relatório imprime a AMOSTRA. */
const VEREDITOS: readonly VereditoDaConferencia[] = [
  "confere",
  "diverge_categoria",
  "diverge_conta",
  "diverge_ambos",
  "recusa_correta",
  "sem_ensaio",
  "sem_lancamento_humano",
  "nao_medivel",
];

/** Os vereditos que entram no denominador das taxas de acerto — `recusa_correta`, `sem_ensaio`, `sem_lancamento_humano` e `nao_medivel` ficam de fora por desenho (ver `<must_haves>` do plano). */
const PARES_MENSURAVEIS: readonly VereditoDaConferencia[] = ["confere", "diverge_categoria", "diverge_conta", "diverge_ambos"];

export interface Taxa {
  readonly n: number;
  readonly denominador: number;
  readonly taxa: number;
}

function taxaDe(n: number, denominador: number): Taxa {
  return { n, denominador, taxa: denominador === 0 ? 0 : n / denominador };
}

export type IdDoPortao = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";

export interface Portao {
  readonly id: IdDoPortao;
  readonly descricao: string;
  /** O valor medido, já formatado para impressão — sempre com o `n`/denominador ao lado, nunca um percentual solitário (T-3-67). */
  readonly medido: string;
  readonly passou: boolean;
}

export interface Relatorio {
  readonly janela: { readonly de: string; readonly ate: string };
  readonly totalResultados: number;
  readonly contagensPorVeredito: Record<VereditoDaConferencia, number>;
  readonly paresMensuraveis: number;
  /** Total de Tarefas com Ensaio (todo veredito exceto `sem_ensaio`) — o denominador de `taxaDeRecusa` e `taxaDeSemLancamentoHumano`. */
  readonly ensaiosTotais: number;
  readonly semTagDeConta: { readonly total: number; readonly conferiu: number; readonly divergiuConta: number };
  readonly nomeDaCategoriaDivergeCount: number;
  readonly acertoDeCodigo: Taxa;
  readonly acertoDeConta: Taxa;
  readonly taxaDeRecusa: Taxa;
  readonly taxaDeSemLancamentoHumano: Taxa;
  /** `"<código do Agente> → <código do humano>": n` — agregado, sem nenhum `taskId` (T-3-65). */
  readonly divergenciasDeCodigo: Readonly<Record<string, number>>;
  readonly cobertura: Cobertura;
  readonly portoes: readonly Portao[];
  readonly veredito: "CONCEDER" | "ADIAR" | "INCONCLUSIVO";
  readonly motivo?: string;
}

export interface OpcoesDeAgregacao {
  /** G7 não é computável a partir do `DataState` — só um ato humano explícito (`--credenciais-omie=ok` do CLI) o liga. Padrão `false` (`PENDENTE`). */
  readonly credenciaisOmieOk?: boolean;
}

function relatorioBase(
  resultados: readonly ResultadoDaConferencia[],
  cobertura: Cobertura,
): Pick<
  Relatorio,
  | "janela"
  | "totalResultados"
  | "contagensPorVeredito"
  | "paresMensuraveis"
  | "ensaiosTotais"
  | "semTagDeConta"
  | "nomeDaCategoriaDivergeCount"
  | "acertoDeCodigo"
  | "acertoDeConta"
  | "taxaDeRecusa"
  | "taxaDeSemLancamentoHumano"
  | "divergenciasDeCodigo"
  | "cobertura"
> {
  const contagensPorVeredito = Object.fromEntries(VEREDITOS.map((v) => [v, 0])) as Record<VereditoDaConferencia, number>;
  for (const r of resultados) contagensPorVeredito[r.veredito] += 1;

  const paresMensuraveis = PARES_MENSURAVEIS.reduce((soma, v) => soma + contagensPorVeredito[v], 0);
  const ensaiosTotais = resultados.length - contagensPorVeredito.sem_ensaio;

  // `diverge_conta` acerta o CÓDIGO (só a conta diverge); `diverge_categoria`
  // acerta a CONTA (só o código diverge) — ver a tabela "O que se mede" do plano.
  const acertosCodigo = contagensPorVeredito.confere + contagensPorVeredito.diverge_conta;
  const acertosConta = contagensPorVeredito.confere + contagensPorVeredito.diverge_categoria;

  const comSemTag = resultados.filter((r) => r.semTagDeConta);
  const semTagDeConta = {
    total: comSemTag.length,
    conferiu: comSemTag.filter((r) => r.veredito === "confere").length,
    divergiuConta: comSemTag.filter((r) => r.veredito === "diverge_conta" || r.veredito === "diverge_ambos").length,
  };

  const divergenciasDeCodigo: Record<string, number> = {};
  for (const r of resultados) {
    if ((r.veredito === "diverge_categoria" || r.veredito === "diverge_ambos") && r.agente && r.humano) {
      const chave = `${r.agente.codigo} → ${r.humano.codigo}`;
      divergenciasDeCodigo[chave] = (divergenciasDeCodigo[chave] ?? 0) + 1;
    }
  }

  return {
    janela: cobertura.janela,
    totalResultados: resultados.length,
    contagensPorVeredito,
    paresMensuraveis,
    ensaiosTotais,
    semTagDeConta,
    nomeDaCategoriaDivergeCount: resultados.filter((r) => r.nomeDaCategoriaDiverge).length,
    acertoDeCodigo: taxaDe(acertosCodigo, paresMensuraveis),
    acertoDeConta: taxaDe(acertosConta, paresMensuraveis),
    taxaDeRecusa: taxaDe(contagensPorVeredito.recusa_correta, ensaiosTotais),
    taxaDeSemLancamentoHumano: taxaDe(contagensPorVeredito.sem_lancamento_humano, ensaiosTotais),
    divergenciasDeCodigo,
    cobertura,
  };
}

/**
 * Puro — nenhum acesso a banco, disco ou relógio. A ordem de decisão é a do
 * `<behavior>` do plano: (d)/(e) — cobertura e viés de seleção — vêm ANTES
 * de qualquer portão, porque um relatório que não pode ser produzido
 * honestamente não produz número nenhum (`INCONCLUSIVO`, sem taxa impressa).
 * Só depois disso os sete portões (G1–G7) são computados e o veredito final
 * (`CONCEDER`/`ADIAR`) decidido.
 */
export function agregar(
  resultados: readonly ResultadoDaConferencia[],
  cobertura: Cobertura,
  limiar: typeof LIMIAR_DA_CANETA,
  opcoes: OpcoesDeAgregacao = {},
): Relatorio {
  const base = relatorioBase(resultados, cobertura);

  if (cobertura.diasSemMedicao > 0) {
    return {
      ...base,
      portoes: [],
      veredito: "INCONCLUSIVO",
      motivo: `${cobertura.diasSemMedicao} dia(s) sem medição na janela — nenhuma taxa é confiável até a causa ser corrigida e a janela, estendida.`,
    };
  }

  if (base.taxaDeSemLancamentoHumano.taxa > limiar.tetoDeSemRegistroHumano) {
    return {
      ...base,
      portoes: [],
      veredito: "INCONCLUSIVO",
      motivo:
        `${(base.taxaDeSemLancamentoHumano.taxa * 100).toFixed(1)}% dos Ensaios sem registro humano ` +
        `(${base.taxaDeSemLancamentoHumano.n}/${base.taxaDeSemLancamentoHumano.denominador}, teto ${(limiar.tetoDeSemRegistroHumano * 100).toFixed(0)}%) — ` +
        `viés de seleção: o Financeiro pode estar registrando só as contas fáceis.`,
    };
  }

  const g1 = base.paresMensuraveis >= limiar.paresMinimos;
  const g2 = base.acertoDeCodigo.taxa >= limiar.acertoDeCodigo;
  const g3 = base.acertoDeConta.taxa >= limiar.acertoDeConta;
  const g4 = base.semTagDeConta.divergiuConta === 0;
  const g5 = base.contagensPorVeredito.nao_medivel === 0;
  const g6 = cobertura.diasSemMedicao === 0; // sempre verdadeiro neste ramo — reportado mesmo assim, por completude do bloco PORTÕES
  const g7 = opcoes.credenciaisOmieOk === true;

  const portoes: Portao[] = [
    { id: "G1", descricao: `pares mensuráveis ≥ ${limiar.paresMinimos}`, medido: `${base.paresMensuraveis}`, passou: g1 },
    {
      id: "G2",
      descricao: `acerto de código ≥ ${(limiar.acertoDeCodigo * 100).toFixed(0)}%`,
      medido: `${(base.acertoDeCodigo.taxa * 100).toFixed(1)}% (${base.acertoDeCodigo.n}/${base.acertoDeCodigo.denominador})`,
      passou: g2,
    },
    {
      id: "G3",
      descricao: `acerto de conta ≥ ${(limiar.acertoDeConta * 100).toFixed(0)}%`,
      medido: `${(base.acertoDeConta.taxa * 100).toFixed(1)}% (${base.acertoDeConta.n}/${base.acertoDeConta.denominador})`,
      passou: g3,
    },
    {
      id: "G4",
      descricao: "zero divergência de conta entre as contas sem Tag `conta *`",
      medido: `${base.semTagDeConta.divergiuConta} de ${base.semTagDeConta.total}`,
      passou: g4,
    },
    { id: "G5", descricao: "zero Ensaio não mensurável (origem `prototipo`)", medido: `${base.contagensPorVeredito.nao_medivel}`, passou: g5 },
    { id: "G6", descricao: "zero dia sem medição na janela", medido: `${cobertura.diasSemMedicao}`, passou: g6 },
    { id: "G7", descricao: "credenciais Omie TRIA verificadas (resíduo de 03-07)", medido: g7 ? "OK" : "PENDENTE", passou: g7 },
  ];

  const falharam = portoes.filter((p) => !p.passou);
  const veredito: Relatorio["veredito"] = falharam.length === 0 ? "CONCEDER" : "ADIAR";
  const motivo = falharam.length === 0 ? undefined : `Portão(ões) não atendido(s): ${falharam.map((p) => p.id).join(", ")}.`;

  return { ...base, portoes, veredito, motivo };
}

/* ═══════════════════════════════ Renderização (pura) ═══════════════════════════════ */

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/**
 * `Relatorio` → `{ markdown, json }`. T-3-65: nenhum título de Tarefa, nome
 * de fornecedor, valor, documento, chave Pix, código de barras ou `taskId`
 * — só contagens, vocabulário de veredito, pares de código agregados e
 * cobertura por dia. Todo percentual sai acompanhado do seu `n` (T-3-67).
 */
export function renderizar(relatorio: Relatorio): { readonly markdown: string; readonly json: string } {
  const linhas: string[] = [];
  linhas.push(`# Relatório do Ensaio do Agente de lançamento — janela ${relatorio.janela.de} a ${relatorio.janela.ate}`);
  linhas.push("");

  linhas.push("## COBERTURA");
  linhas.push("");
  linhas.push(`Dias na janela: ${relatorio.cobertura.dias.length} · dias sem medição: **${relatorio.cobertura.diasSemMedicao}**`);
  const diasSemMedicao = relatorio.cobertura.dias.filter((d) => d.classificacao !== "medido");
  if (diasSemMedicao.length > 0) {
    linhas.push("");
    linhas.push("| Dia | Classificação |");
    linhas.push("|---|---|");
    for (const d of diasSemMedicao) linhas.push(`| ${d.dia} | ${d.classificacao} |`);
  }
  linhas.push("");

  if (relatorio.veredito === "INCONCLUSIVO") {
    linhas.push("## INCONCLUSIVO — nenhuma taxa é impressa abaixo");
    linhas.push("");
    linhas.push(relatorio.motivo ?? "");
    linhas.push("");
    linhas.push("CANETA: INCONCLUSIVO");
    return { markdown: `${linhas.join("\n")}\n`, json: `${JSON.stringify(relatorio, null, 2)}\n` };
  }

  linhas.push("## AMOSTRA");
  linhas.push("");
  linhas.push("| Veredito | n |");
  linhas.push("|---|---|");
  for (const v of VEREDITOS) linhas.push(`| ${v} | ${relatorio.contagensPorVeredito[v]} |`);
  linhas.push("");
  linhas.push(`Pares mensuráveis (confere + diverge_categoria + diverge_conta + diverge_ambos): **${relatorio.paresMensuraveis}**`);
  linhas.push("");

  linhas.push("## RECUSA (não é erro)");
  linhas.push("");
  linhas.push(
    `Taxa de recusa correta (\`revisar\`/\`ausente\`, fora do denominador de acerto): ${pct(relatorio.taxaDeRecusa.taxa)} (${relatorio.taxaDeRecusa.n}/${relatorio.taxaDeRecusa.denominador})`,
  );
  linhas.push(
    `Taxa de Ensaio sem registro humano (viés de seleção — teto em LIMIAR_DA_CANETA.tetoDeSemRegistroHumano): ${pct(relatorio.taxaDeSemLancamentoHumano.taxa)} (${relatorio.taxaDeSemLancamentoHumano.n}/${relatorio.taxaDeSemLancamentoHumano.denominador})`,
  );
  linhas.push("");

  linhas.push("## ACERTO");
  linhas.push("");
  linhas.push(`Acerto de código (plano de contas): ${pct(relatorio.acertoDeCodigo.taxa)} (${relatorio.acertoDeCodigo.n}/${relatorio.acertoDeCodigo.denominador})`);
  linhas.push(`Acerto de conta de pagamento: ${pct(relatorio.acertoDeConta.taxa)} (${relatorio.acertoDeConta.n}/${relatorio.acertoDeConta.denominador})`);
  linhas.push(
    `Sem Tag \`conta *\` (palpite sem evidência) — conferiu: ${relatorio.semTagDeConta.conferiu} · divergiu de conta: ${relatorio.semTagDeConta.divergiuConta} · total: ${relatorio.semTagDeConta.total}`,
  );
  linhas.push(`Nome da categoria divergente (informativo — não é erro, não entra em nenhuma taxa): ${relatorio.nomeDaCategoriaDivergeCount}`);
  linhas.push("");

  linhas.push("## DIVERGÊNCIAS DE CÓDIGO (agregadas)");
  linhas.push("");
  const pares = Object.entries(relatorio.divergenciasDeCodigo);
  if (pares.length === 0) {
    linhas.push("Nenhuma.");
  } else {
    linhas.push("| Agente → Humano | n |");
    linhas.push("|---|---|");
    for (const [chave, n] of pares) linhas.push(`| ${chave} | ${n} |`);
  }
  linhas.push("");

  linhas.push("## PORTÕES");
  linhas.push("");
  linhas.push("| Portão | Condição | Medido | Passou |");
  linhas.push("|---|---|---|---|");
  for (const p of relatorio.portoes) linhas.push(`| ${p.id} | ${p.descricao} | ${p.medido} | ${p.passou ? "sim" : "não"} |`);
  linhas.push("");

  const avisoDeRecusaAlta =
    relatorio.taxaDeRecusa.taxa > LIMIAR_DA_CANETA.tetoDeRecusaParaUtilidade
      ? ` Taxa de recusa acima do teto informativo em LIMIAR_DA_CANETA.tetoDeRecusaParaUtilidade (ver RECUSA acima) — o Agente está cauteloso demais para poupar trabalho (não bloqueia a caneta; vale revisar \`CATEGORY_MIN_SIMILARITY\`).`
      : "";
  linhas.push(`CANETA: ${relatorio.veredito}${relatorio.motivo ? ` — ${relatorio.motivo}` : ""}${avisoDeRecusaAlta}`);

  return { markdown: `${linhas.join("\n")}\n`, json: `${JSON.stringify(relatorio, null, 2)}\n` };
}

/* ═══════════════════════════════ Detalhe (fora do git) ═══════════════════════════════ */

/**
 * O CSV linha a linha, COM `taskId` e as duas triplas — o insumo de quem vai
 * corrigir o de-para. NUNCA vai para o git: quem chama grava em
 * `apps/api/exportacoes/ensaio-do-agente/<run>/conferencia-detalhada.csv`,
 * dentro da árvore que o `.gitignore` já ignora por LGPD (precedente de
 * 03-10, `relatorioDetalhadoPorLinha`).
 */
export function detalharPorConta(resultados: readonly ResultadoDaConferencia[]): string {
  const cabecalho = [
    "taskId",
    "veredito",
    "semTagDeConta",
    "nomeDaCategoriaDiverge",
    "agente.conta",
    "agente.categoria",
    "agente.codigo",
    "humano.conta",
    "humano.categoria",
    "humano.codigo",
  ].join(",");
  const linhas = resultados.map((r) =>
    [
      r.taskId,
      r.veredito,
      String(r.semTagDeConta),
      String(r.nomeDaCategoriaDiverge),
      r.agente?.conta ?? "",
      r.agente?.categoria ?? "",
      r.agente?.codigo ?? "",
      r.humano?.conta ?? "",
      r.humano?.categoria ?? "",
      r.humano?.codigo ?? "",
    ].join(","),
  );
  return `${[cabecalho, ...linhas].join("\n")}\n`;
}
