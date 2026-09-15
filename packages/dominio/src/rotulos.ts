/**
 * Vocabulário de exibição que o próprio domínio precisa para se descrever.
 *
 * Mora aqui, e não na camada de interface, porque `derive.ts` nomeia o Ator de
 * um Registro de Atividade ao recompor o histórico — uma leitura derivada, não
 * uma decisão de tela. A interface reexporta daqui (`features/shell/format`),
 * de modo que existe uma única fonte para estes rótulos.
 */

/** B36 — os cinco tipos de Ator que podem assinar um Registro. */
export const ACTOR_KIND_LABEL: Record<string, string> = {
  member: "Membro",
  agent: "Agente",
  automation: "Automação",
  integration: "Integração",
  system: "Sistema",
};
