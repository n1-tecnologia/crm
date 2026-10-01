/**
 * A janela da análise por comentário (D-10) e a métrica que decide se ela
 * continua ativa.
 *
 * Checklist 3.3 (2026-10-01, decisão do dono): a análise da resposta do
 * aprovador no fio vale SEMPRE, como no backend do Financeiro — a AUSÊNCIA
 * de `FALLBACK_COMENTARIO_ATE` significa LIGADA. A variável passa a ser só o
 * jeito de pôr um prazo: com uma data ISO, vale até ela (inclusive); uma
 * data passada desliga. Antes, a ausência desligava (T-02-19, "um fallback
 * sem prazo vira caminho permanente"), e todo deploy sem a variável deixava
 * as respostas no fio sem efeito nenhum.
 *
 * Um valor presente mas ilegível continua falhando FECHADO — quem escreveu
 * algo quis um prazo, e "desligado" é a leitura segura —, com um aviso no
 * log do processo para o erro de configuração ser visível.
 *
 * O instante "agora" vem sempre do `Relogio` injetado (`../testes/relogio.ts`)
 * — nunca do relógio do sistema lido direto — para a janela de 90 dias e o
 * corte de D-10 serem testáveis sem esperar tempo real (V02-08B).
 */

import type { ApprovalRequest } from "@n1/dominio";
import type { Relogio } from "../testes/relogio";

const DIAS_DE_FALLBACK = 90;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * `goLive` + 90 dias corridos, em ISO — o que o roteiro de deploy usa para
 * preencher `FALLBACK_COMENTARIO_ATE`. Lança se `goLive` não for uma data
 * válida: um roteiro de deploy que passa lixo aqui precisa falhar alto, não
 * produzir uma data-final incorreta silenciosa.
 */
export function calcularDataFinal(goLive: string): string {
  const instante = new Date(goLive);
  if (Number.isNaN(instante.getTime())) {
    throw new Error(`calcularDataFinal: data de go-live inválida: "${goLive}".`);
  }
  return new Date(instante.getTime() + DIAS_DE_FALLBACK * MS_POR_DIA).toISOString();
}

/**
 * `true` quando a análise por comentário vale agora: sem prazo configurado,
 * sempre; com prazo, enquanto o instante do `relogio` não passou dele — o
 * dia da própria data final ainda vale. `ate`, quando passado, tem
 * prioridade sobre `FALLBACK_COMENTARIO_ATE` (uso de teste); em produção,
 * quem chama omite `ate` e lê do ambiente.
 *
 * Data ilegível devolve `false` (com aviso), nunca `true` por acidente.
 */
export function dentroDaJanela(relogio: Relogio, ate?: string): boolean {
  const dataFinal = (ate ?? process.env.FALLBACK_COMENTARIO_ATE)?.trim();
  if (!dataFinal) return true;
  // Revisão de código: antes, a variável vazia DESLIGAVA; quem quer desligar agora diz.
  if (/^(desligad[ao]|off|false|0|nao|não)$/i.test(dataFinal)) return false;

  const instanteFinal = new Date(dataFinal);
  if (Number.isNaN(instanteFinal.getTime())) {
    console.warn(
      `[janela-de-fallback] FALLBACK_COMENTARIO_ATE inválida ("${dataFinal}") — tratando o fallback de comentário como DESLIGADO.`,
    );
    return false;
  }

  return relogio.agora().getTime() <= instanteFinal.getTime();
}

export interface MetricaDeOrigem {
  readonly porClique: number;
  readonly porComentario: number;
  readonly total: number;
  /** `porComentario / total` — a métrica que D-10 exige para decidir o desligamento. `0` sem nenhuma decisão no período. */
  readonly razao: number;
}

export interface PeriodoDaMetrica {
  readonly desde: string;
  readonly ate: string;
}

/**
 * Conta, dentro de `[desde, ate]` (por `decidedAt`, inclusive nas duas
 * pontas), quantas `ApprovalRequest` decididas de Solicitação de pagamento
 * vieram por clique e quantas vieram por comentário — a métrica de D-10
 * ("aprovações por comentário / total").
 *
 * Só entram no denominador registros com `decisionSource` definido: uma
 * aprovação de Execução de Agente (`decideApproval`) nunca grava
 * `decisionSource` — ela não faz parte do que D-10 mede, e contá-la
 * inflaria o "total" com decisões de outro processo inteiramente.
 */
export function metricaDeOrigem(
  approvals: readonly Pick<ApprovalRequest, "decidedAt" | "decisionSource">[],
  periodo: PeriodoDaMetrica,
): MetricaDeOrigem {
  const decididasNoPeriodo = approvals.filter(
    (a) =>
      a.decisionSource !== undefined &&
      a.decidedAt !== undefined &&
      a.decidedAt >= periodo.desde &&
      a.decidedAt <= periodo.ate,
  );
  const porComentario = decididasNoPeriodo.filter((a) => a.decisionSource === "comment").length;
  const porClique = decididasNoPeriodo.filter((a) => a.decisionSource === "click").length;
  const total = porClique + porComentario;
  return { porClique, porComentario, total, razao: total === 0 ? 0 : porComentario / total };
}
