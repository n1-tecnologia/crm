/**
 * A lógica PURA do comando `gravacao:medir` (Fase 12, D-01/D-02/D-07/D-12/D-17).
 *
 * O que este módulo lê: a linha de log `"gravacao medida"` que 12-01 faz
 * `POST /operacoes/:nome` escrever por gravação (`{ operacao, medicao }`, o
 * contrato está em `../rotas/CONTEXT.md`). O comando sobe o próprio Fastify, captura
 * o log num array e entrega as linhas aqui; este módulo as lê, tira a mediana e o
 * pior caso por etapa e monta o relatório.
 *
 * Por que é puro (sem pool, sem fetch, sem relógio): para a tabela ser testável
 * sem banco, no molde de `../automacoes/previa.ts`, e para o "antes" e o "depois"
 * de 12-10 passarem pelo MESMO código de leitura. Quem mede (`medir-gravacao.ts`)
 * cronometra e conversa com o banco; aqui só se faz conta e texto.
 *
 * As duas sobras de D-02, que fecham o tempo de ponta a ponta de um pedido:
 *   - `foraDasEtapasMs` = `totalMs` do handler menos a soma das etapas de
 *     `executar()` e do `recorteMs`: o que o handler gasta fora das etapas
 *     medidas (validação do corpo, o `reviver`, o `JSON` da resposta que ele monta).
 *     `atualizaMs` NÃO entra na soma: ele já está dentro de `travaMs` nos dois
 *     regimes (ver `MedicaoDaExecucao`); somar os dois contaria o `update` duas vezes.
 *   - `foraDoHandlerMs` = `pedidoMs` (o `fetch` de ponta a ponta, medido pelo
 *     comando) menos `totalMs`: hook de autenticação, serialização, loopback.
 *
 * Mediana: com número par de amostras, a média dos dois valores do meio (dez
 * repetições: a média da 5ª e da 6ª). Pior caso: o máximo.
 *
 * Nada aqui carrega título de Tarefa, nome de Contato, e-mail ou valor: só nomes
 * de gesto e de operação, nomes de coleção, contagens, bytes e milissegundos.
 */

/** O limite da sessão C (D-07): se `hidratar` passar disto na mediana, a sessão C vira fase própria. */
export const LIMITE_DO_HIDRATAR_MS = 300;

/** As etapas de `executar()`, na ordem em que acontecem (as chaves `*Ms` de `MedicaoDaExecucao`). */
export const ETAPAS_DE_EXECUTAR = [
  "conexaoMs",
  "inicioMs",
  "travaMs",
  "hidratarMs",
  "canaisMs",
  "operacaoMs",
  "atualizaMs",
  "gravarMs",
  "eventosMs",
  "commitMs",
] as const;

/** Todas as colunas de tempo da linha: as de `executar()`, o recorte da rota e o total do handler. */
export const ETAPAS_DA_GRAVACAO = [...ETAPAS_DE_EXECUTAR, "recorteMs", "totalMs"] as const;

export type EtapaDaGravacao = (typeof ETAPAS_DA_GRAVACAO)[number];

/** A etapa que já está contida em outra (`travaMs`), por isso fora da soma de `foraDasEtapasMs`. */
const ETAPA_CONTIDA_EM_OUTRA: EtapaDaGravacao = "atualizaMs";

/** O que a linha de 12-01 traz em `medicao` (12-04 acrescenta `regime`). */
export interface MedicaoLida {
  readonly conexaoMs: number;
  readonly inicioMs: number;
  readonly travaMs: number;
  readonly hidratarMs: number;
  readonly canaisMs: number;
  readonly operacaoMs: number;
  readonly atualizaMs: number;
  readonly gravarMs: number;
  readonly eventosMs: number;
  readonly commitMs: number;
  readonly tentativas: number;
  readonly linhasLidas: number;
  readonly linhasGravadas: number;
  readonly desfecho: string;
  /** Ausente quando a rota não recortou (recusa sem diferença, 409, 500). */
  readonly recorteMs?: number;
  readonly totalMs: number;
  /** Só depois de 12-04. */
  readonly regime?: string;
}

export interface LinhaDeMedicao {
  readonly operacao: string;
  readonly medicao: MedicaoLida;
}

/** Uma repetição de um gesto: a linha do log e o tempo do pedido medido pelo comando. */
export interface AmostraDoGesto {
  readonly medicao: MedicaoLida;
  readonly pedidoMs: number;
}

export interface Estatistica {
  readonly mediana: number;
  readonly pior: number;
}

export interface ResumoDoGesto {
  readonly gesto: string;
  readonly operacao: string;
  readonly amostras: number;
  readonly etapas: Readonly<Record<EtapaDaGravacao, Estatistica>>;
  readonly pedidoMs: Estatistica;
  readonly foraDasEtapasMs: Estatistica;
  readonly foraDoHandlerMs: Estatistica;
  readonly tentativas: Estatistica;
  readonly linhasLidas: Estatistica;
  readonly linhasGravadas: Estatistica;
  readonly regimes: readonly string[];
  readonly desfechos: Readonly<Record<string, number>>;
}

/** Uma série de tempos medidos fora de uma gravação (`select 1`, `hidratar` direto, `GET /estado`). */
export interface SerieDeTempos extends Estatistica {
  readonly amostras: number;
}

export interface TamanhoDeColecao {
  readonly colecao: string;
  readonly registros: number;
  /** `sum(pg_column_size(dados))`: o tamanho como o Postgres guarda (comprimido pelo TOAST quando passa de ~2 KB). */
  readonly comprimido: number;
  /** `sum(length(dados::text))`: os bytes do texto do JSON, o que viaja na rede (Pitfall 11). */
  readonly texto: number;
}

export interface TamanhoDoEspaco {
  readonly porColecao: readonly TamanhoDeColecao[];
  readonly total: Omit<TamanhoDeColecao, "colecao">;
  /** Verdadeiro quando o banco recusou a consulta (permissão): o relatório pede para rodar à mão. */
  readonly recusada?: boolean;
}

export interface RelatorioDaMedicao {
  readonly quando: string;
  readonly revisaoDoCodigo: string;
  readonly workspaceId: string;
  readonly repeticoes: number;
  readonly idaEVolta: SerieDeTempos;
  readonly hidratarDireto: SerieDeTempos & { readonly registros: number };
  readonly estado: SerieDeTempos;
  readonly tamanho: TamanhoDoEspaco;
  readonly gestos: readonly ResumoDoGesto[];
}

const MSG_DA_LINHA = "gravacao medida";

function ehNumero(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/**
 * Lê uma linha do log do pino. Devolve `undefined` para linha vazia, texto que
 * não é JSON, outra mensagem ou uma `medicao` que não tem ao menos o `totalMs`.
 */
export function lerLinhaDeMedicao(linha: string): LinhaDeMedicao | undefined {
  const texto = linha.trim();
  if (!texto) return undefined;
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return undefined;
  }
  if (typeof bruto !== "object" || bruto === null) return undefined;
  const objeto = bruto as { msg?: unknown; operacao?: unknown; medicao?: unknown };
  if (objeto.msg !== MSG_DA_LINHA || typeof objeto.operacao !== "string") return undefined;
  const medicao = objeto.medicao;
  if (typeof medicao !== "object" || medicao === null) return undefined;
  if (!ehNumero((medicao as { totalMs?: unknown }).totalMs)) return undefined;
  return { operacao: objeto.operacao, medicao: medicao as MedicaoLida };
}

/** Média dos dois valores do meio quando o número é par; 0 com lista vazia. Não altera a entrada. */
export function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[meio]!;
  return (ordenados[meio - 1]! + ordenados[meio]!) / 2;
}

/** O máximo; 0 com lista vazia. */
export function piorCaso(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  return Math.max(...valores);
}

function estatistica(valores: readonly number[]): Estatistica {
  return { mediana: mediana(valores), pior: piorCaso(valores) };
}

/** A soma das etapas de `executar()` (sem `atualizaMs`, contido em `travaMs`) mais o recorte da rota. */
function somaDasEtapas(medicao: MedicaoLida): number {
  let soma = medicao.recorteMs ?? 0;
  for (const etapa of ETAPAS_DE_EXECUTAR) {
    if (etapa === ETAPA_CONTIDA_EM_OUTRA) continue;
    soma += medicao[etapa];
  }
  return soma;
}

export function resumirGesto(gesto: string, operacao: string, amostras: readonly AmostraDoGesto[]): ResumoDoGesto {
  const etapas = Object.fromEntries(
    ETAPAS_DA_GRAVACAO.map((etapa) => [etapa, estatistica(amostras.map((a) => a.medicao[etapa] ?? 0))]),
  ) as Record<EtapaDaGravacao, Estatistica>;

  const regimes = [...new Set(amostras.map((a) => a.medicao.regime).filter((r): r is string => typeof r === "string"))];
  const desfechos: Record<string, number> = {};
  for (const a of amostras) desfechos[a.medicao.desfecho] = (desfechos[a.medicao.desfecho] ?? 0) + 1;

  return {
    gesto,
    operacao,
    amostras: amostras.length,
    etapas,
    pedidoMs: estatistica(amostras.map((a) => a.pedidoMs)),
    foraDasEtapasMs: estatistica(amostras.map((a) => a.medicao.totalMs - somaDasEtapas(a.medicao))),
    foraDoHandlerMs: estatistica(amostras.map((a) => a.pedidoMs - a.medicao.totalMs)),
    tentativas: estatistica(amostras.map((a) => a.medicao.tentativas)),
    linhasLidas: estatistica(amostras.map((a) => a.medicao.linhasLidas)),
    linhasGravadas: estatistica(amostras.map((a) => a.medicao.linhasGravadas)),
    regimes,
    desfechos,
  };
}

/** Uma série vazia, para o que ainda não foi medido. */
export function serieVazia(): SerieDeTempos {
  return { amostras: 0, mediana: 0, pior: 0 };
}

export function serieDeTempos(valores: readonly number[]): SerieDeTempos {
  return { amostras: valores.length, ...estatistica(valores) };
}

/** Milissegundos com uma casa decimal. */
function ms(valor: number): string {
  return valor.toFixed(1);
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function linhaDeSerie(titulo: string, serie: SerieDeTempos): string {
  if (serie.amostras === 0) return `${titulo}: sem amostras`;
  return `${titulo}: mediana ${ms(serie.mediana)} ms · pior ${ms(serie.pior)} ms · ${serie.amostras} amostra(s)`;
}

function tabela(cabecalho: readonly string[], corpo: readonly (readonly string[])[]): string[] {
  const larguras = cabecalho.map((titulo, i) => Math.max(titulo.length, ...corpo.map((linha) => (linha[i] ?? "").length)));
  const montar = (celulas: readonly string[]): string =>
    celulas
      .map((c, i) => (i === 0 ? c.padEnd(larguras[i] ?? 0) : c.padStart(larguras[i] ?? 0)))
      .join("  ")
      .trimEnd();
  return [montar(cabecalho), montar(larguras.map((n) => "-".repeat(n))), ...corpo.map(montar)];
}

function secaoDoTamanho(tamanho: TamanhoDoEspaco): string[] {
  const titulo = "plataforma.registros (D-05)";
  if (tamanho.recusada) return [titulo, "consulta D-05 recusada pelo banco: rodar à mão no psql"];
  const corpo = [
    ...tamanho.porColecao.map((c) => [c.colecao, String(c.registros), kb(c.comprimido), kb(c.texto)]),
    ["TOTAL", String(tamanho.total.registros), kb(tamanho.total.comprimido), kb(tamanho.total.texto)],
  ];
  return [titulo, ...tabela(["coleção", "registros", "comprimido", "texto"], corpo)];
}

function secaoDoGesto(resumo: ResumoDoGesto): string[] {
  const corpo: string[][] = ETAPAS_DA_GRAVACAO.map((etapa) => [
    etapa,
    ms(resumo.etapas[etapa].mediana),
    ms(resumo.etapas[etapa].pior),
  ]);
  corpo.push(
    ["pedidoMs", ms(resumo.pedidoMs.mediana), ms(resumo.pedidoMs.pior)],
    ["foraDasEtapasMs", ms(resumo.foraDasEtapasMs.mediana), ms(resumo.foraDasEtapasMs.pior)],
    ["foraDoHandlerMs", ms(resumo.foraDoHandlerMs.mediana), ms(resumo.foraDoHandlerMs.pior)],
    ["tentativas", String(resumo.tentativas.mediana), String(resumo.tentativas.pior)],
    ["linhasLidas", String(resumo.linhasLidas.mediana), String(resumo.linhasLidas.pior)],
    ["linhasGravadas", String(resumo.linhasGravadas.mediana), String(resumo.linhasGravadas.pior)],
  );
  const desfechos = Object.entries(resumo.desfechos)
    .map(([nome, n]) => `${nome} ${n}`)
    .join(", ");
  return [
    `${resumo.gesto} (${resumo.operacao}) · ${resumo.amostras} amostra(s)`,
    ...tabela(["etapa", "mediana", "pior"], corpo),
    `regimes: ${resumo.regimes.length === 0 ? "(a linha não traz)" : resumo.regimes.join(", ")}`,
    `desfechos: ${desfechos || "(nenhum)"}`,
  ];
}

/**
 * O texto de largura fixa, sem cor, que o comando imprime e o dono cola em
 * `12-PROVAS.md`. Números em ms com uma casa decimal.
 */
export function formatarRelatorio(relatorio: RelatorioDaMedicao): string {
  const hidratar = relatorio.hidratarDireto;
  const veredito =
    hidratar.amostras === 0
      ? "sem amostras"
      : hidratar.mediana > LIMITE_DO_HIDRATAR_MS
        ? `mediana ${ms(hidratar.mediana)} ms, acima do limite`
        : `mediana ${ms(hidratar.mediana)} ms, abaixo do limite`;
  return [
    "Medição da gravação (gravacao:medir)",
    `quando: ${relatorio.quando}`,
    `revisão do código: ${relatorio.revisaoDoCodigo}`,
    `Espaço de Trabalho: ${relatorio.workspaceId}`,
    `repetições: ${relatorio.repeticoes}`,
    "",
    "Ida e volta (select 1)",
    linhaDeSerie("select 1", relatorio.idaEVolta),
    "",
    "hidratar direto (transação só de leitura)",
    linhaDeSerie("hidratar", hidratar),
    `registros lidos: ${hidratar.registros}`,
    `limite da sessão C (D-07): ${LIMITE_DO_HIDRATAR_MS} ms na mediana; ${veredito}`,
    "",
    "GET /estado (total)",
    linhaDeSerie("GET /estado", relatorio.estado),
    "",
    ...secaoDoTamanho(relatorio.tamanho),
    ...relatorio.gestos.flatMap((gesto) => ["", ...secaoDoGesto(gesto)]),
    "",
  ].join("\n");
}
