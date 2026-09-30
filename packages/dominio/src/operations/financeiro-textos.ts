/**
 * Os textos canônicos da Conferência do Resumo (Fase 6, `06-CONTEXT.md`
 * §specifics) — contrato entre o domínio, a ponte do `apps/api` e a tela:
 * os três escrevem e leem as MESMAS strings, e nenhum deles as monta à mão.
 *
 * Moram num arquivo próprio, e não em `./financeiro.ts`, por causa do ciclo:
 * `./financeiro.ts` chama `solicitarConferenciaDoResumo` de `./ai.ts`, e
 * `./ai.ts` precisa das respostas canônicas (`conferido`/`ajuste`) na
 * decisão. Os dois importam daqui; `./financeiro.ts` reexporta
 * `TEXTOS_DA_CONFERENCIA` para quem já o procura lá.
 *
 * Puro: nenhuma dependência, nenhum I/O.
 */

/** O resultado de um anexo no `/lancar` — o que a confirmação conta e lista. */
export interface AnexoDoLancamento {
  readonly nome: string;
  readonly ok: boolean;
  readonly erro?: string;
}

export interface DadosDoLancado {
  readonly payableId: string;
  readonly conta: string;
  readonly categoria: string;
  readonly codigo: string;
  readonly reaproveitado: boolean;
  readonly anexos: ReadonlyArray<AnexoDoLancamento>;
}

const PEDIDO_DE_CONFERENCIA = 'responda "ok" para eu lançar, ou diga o que ajustar.';

export const TEXTOS_DA_CONFERENCIA = {
  /** Depois do bloco do RESUMO, na primeira publicação. */
  chamada: (financeiro: string): string => `\n\n${financeiro}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`,
  /** Depois do bloco do RESUMO, quando um revisor pediu ajuste. */
  revisado: (nome: string, pedido: string, financeiro: string): string =>
    `\n\nRevisado a pedido de ${nome}: "${pedido}".\n${financeiro}, confira de novo: ${PEDIDO_DE_CONFERENCIA}`,
  /** Depois do bloco do RESUMO, quando a conta mudou depois da conferência. */
  dadosMudaram: (financeiro: string): string => `\n\nOs dados da conta mudaram depois da conferência.\n${financeiro}, confira de novo: ${PEDIDO_DE_CONFERENCIA}`,
  /** Resposta canônica no fio: Conferência aprovada. */
  conferido: (nome: string): string => `✅ Resumo conferido por ${nome}`,
  /** Resposta canônica no fio: ajuste pedido. */
  ajuste: (nome: string, motivo: string): string => `🔁 Ajuste pedido por ${nome}: ${motivo}`,
  /**
   * Recusa de `decideProcessApproval` (06-11, crm:WR-08): a impressão de
   * lançamento mudou depois do Resumo, e decidir agora afirmaria a conferência
   * de dados que não são os da conta. A tela e a ponte mostram esta string.
   */
  recusaDesatualizada: "Os dados da conta mudaram depois deste Resumo; aguarde o Resumo novo.",
  /**
   * Recusa de APROVAR (06-11, crm:WR-03): a Categoria veio `ausente` do de-para
   * (`9.99.99` é preenchimento) ou o código está fora da forma do contrato.
   * Pedir ajuste continua aberto — é o caminho que esta string indica.
   */
  recusaSemCodigo:
    "Este Resumo não tem o código da Categoria no Omie, e sem ele não há o que conferir. Peça ajuste com o código da Categoria (ex.: 2.04.01).",
  /** Confirmação no fio depois de o Omie devolver o título. */
  lancado: (d: DadosDoLancado): string => {
    const total = d.anexos.length;
    const subiram = d.anexos.filter((a) => a.ok).length;
    const anexos = total === 0 ? "sem anexos" : `anexos ${subiram} de ${total}`;
    const primeira = `✅ Lançado no Omie — título ${d.payableId} · ${d.conta} · ${d.categoria} (${d.codigo}) · ${anexos}${d.reaproveitado ? " (título já existia)" : ""}`;
    const falhas = d.anexos.filter((a) => !a.ok).map((a) => `• ${a.nome}: não subiu (${a.erro ?? "motivo não informado"})`);
    return [primeira, ...falhas].join("\n");
  },
  /** Modo `conferencia` da ponte, com a conta em "em lançamento omie" e o Resumo conferido. */
  modoConferencia: "Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência): nada foi lançado, a conta fica aqui.",
  /** Falha permanente no lançamento (D6-03). */
  falha: (motivo: string, code: string): string => `Não consegui lançar no Omie: ${motivo} (${code}). A conta voltou para "para pagar".`,
  /**
   * A mesma falha quando a conta NÃO voltou (não estava em "em lançamento
   * omie", ou a mudança de Status foi recusada): o aviso não afirma o que não
   * aconteceu.
   */
  falhaSemVolta: (motivo: string, code: string, recusa?: string): string =>
    `Não consegui lançar no Omie: ${motivo} (${code}).${recusa ? ` A conta não voltou para "para pagar": ${recusa}` : ""}`,
} as const;

/**
 * Os prefixos das mensagens que o próprio processo escreve no fio — nenhuma
 * delas é resposta de revisor (`respostasDeConferenciaPendentes`).
 */
export const PREFIXOS_DO_PROCESSO: readonly string[] = ["✅", "🔁", "📋", "⚠️"];
