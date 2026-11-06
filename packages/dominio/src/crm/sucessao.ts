/**
 * A prévia da sucessão de um Membro nas tabelas do CRM (Fase 15, 15-03, D-15-08).
 *
 * Quando um Membro é removido, o que era dele passa ao Sucessor no mesmo ato
 * (RN-ET-09 e RN-CXE-24, emendadas por B28-a): Contatos, Empresas e Negócios mudam
 * de Proprietário, e toda Conversa de que ele é Atribuído (como Membro) passa ao
 * Sucessor como Atribuído. A troca de Atribuído não é propriedade: a Conversa
 * continua sem Proprietário (DO-CXE-02), e a atribuída a Agente não muda.
 *
 * Só o tipo da resposta de `GET /membros/:id/sucessao-no-crm`: a api e a tela
 * importam daqui, para que o contrato seja um só.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/sucessao`.
 */

/** Quanto do CRM passa ao Sucessor se o Membro for removido. */
export interface SucessaoNoCrm {
  readonly contatos: number;
  readonly empresas: number;
  readonly negocios: number;
  /** Conversas atribuídas ao Membro (como Membro) que passam ao Sucessor como Atribuído. */
  readonly conversasPassadas: number;
}
