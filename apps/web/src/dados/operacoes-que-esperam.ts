/**
 * A lista de exceções de "mostrar na hora" (Fase 12, D-13).
 *
 * Quase toda mudança que o domínio aceita aparece na tela antes da resposta do
 * servidor (`store.ts`, `rodarNaCopia`). Estas operações não: o que a cópia
 * calcula difere do que o servidor grava de um jeito que a pessoa VÊ e USA, e
 * mostrar a cópia seria mostrar um valor que não existe. Elas esperam a
 * resposta, como todas esperavam antes da fase.
 *
 * Critério (um motivo basta):
 *   1. valor aleatório ou de contador de módulo gerado na operação — segredo de
 *      link, JID, endereço de convite, chave pública: a cópia e o servidor
 *      geram valores diferentes por construção, e a pessoa copiaria um link ou
 *      uma chave que o servidor nunca teve (T-12-17);
 *   2. resolução que só o servidor faz antes da transação (`SERVICOS` em
 *      `apps/api/src/rotas/operacoes.ts`): a cópia roda sem ela e mostraria um
 *      Membro que o servidor resolve de outro jeito (T-12-18);
 *   3. efeito de relógio ou de idempotência do servidor que a cópia não
 *      enxerga: o agendador do servidor roda as mesmas rotinas por dia e disputa
 *      com a tela.
 *
 * Ficam otimistas, de propósito: ids sequenciais (D-15 cobre: o registro novo
 * aparece "salvando", sem link, até o id verdadeiro), timestamps, Execuções de
 * Automação e Atividade (chegam na confirmação), o disparo da ponte do Agente
 * (acontece depois do commit) e o recorte por Membro (a cópia já roda sobre o
 * `data` recortado).
 *
 * Regra conservadora: se QUALQUER chamada de um gesto está na lista, o gesto
 * inteiro espera — misturar uma Lista nova com um Formulário não deixa a Lista
 * aparecer sozinha com o Formulário faltando.
 *
 * Por que mora na web e não no domínio: o domínio diz O QUE a operação faz;
 * "esperar o servidor" é regra de tela (CONTEXT.md da raiz). O servidor nunca a
 * lê — ele roda toda operação do mesmo jeito.
 *
 * O conjunto é fechado por `operacoes-que-esperam.test.ts`, e o levantamento
 * que o fechou (cada candidata, o arquivo e o veredito) está em
 * `.planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md`.
 */

import type { ChamadaDeOperacao, NomeDeOperacao } from "@n1/dominio/operations/registro";

export const OPERACOES_QUE_ESPERAM: ReadonlyMap<NomeDeOperacao, string> = new Map<NomeDeOperacao, string>([
  // Motivo 1 — segredo aleatório de link público (`scale.ts`, `secret()` com `crypto.getRandomValues`).
  ["createForm", "O segredo do link público do Formulário é aleatório (scale.ts, secret()): o da cópia nunca é o do servidor."],
  ["rotateFormSecret", "O novo segredo do link do Formulário é aleatório (scale.ts, secret()): o da cópia nunca é o do servidor."],
  ["shareTaskPublicly", "O segredo do link público da Tarefa é aleatório (scale.ts, secret()): o da cópia nunca é o do servidor."],

  // Motivo 1 — JID, endereço de convite e chaves vêm de um contador de módulo (`ferramentas/provedor-simulado.ts`, `sequencia`).
  ["criarGrupo", "O JID e o link de convite do Grupo saem do contador do provedor simulado (provedor-simulado.ts): cliente e servidor contam diferente."],
  ["sincronizarGrupo", "O link de convite refeito na sincronização sai do contador do provedor simulado (grupos.ts, gerarEnderecoDeConvite): cliente e servidor contam diferente."],
  ["regenerarLinkDeConvite", "O novo link de convite do Grupo sai do contador do provedor simulado (grupos.ts, gerarEnderecoDeConvite): cliente e servidor contam diferente."],
  ["criarComunidade", "A Comunidade e o Grupo de avisos dela recebem JID do contador do provedor simulado (comunidades.ts, gerarJid): cliente e servidor contam diferente."],
  ["definirPontoDeTrocaDeDados", "A chave pública do Ponto de troca de dados sai do contador do provedor simulado (flows.ts, gerarChavePublica): cliente e servidor contam diferente."],
  ["regenerarChavesDoPonto", "A nova chave pública do Ponto de troca de dados sai do contador do provedor simulado (flows.ts, gerarChavePublica): cliente e servidor contam diferente."],
  ["publicarVersao", "O identificador externo do Flow publicado sai do contador do provedor simulado (flows.ts, gerarIdentificadorDeFlow): cliente e servidor contam diferente."],
  ["copiarFlow", "O Flow copiado ganha uma chave pública nova do contador do provedor simulado (flows.ts, gerarChavePublica): cliente e servidor contam diferente."],

  // Motivo 2 — resolução que só o servidor faz.
  ["inviteMember", "O servidor resolve o e-mail em usuário e reativa Membro removido antes da transação (SERVICOS em rotas/operacoes.ts): a cópia mostraria outro Membro."],

  // Motivo 3 — relógio e idempotência do agendador do servidor.
  ["runScheduledAutomations", "O servidor roda as Automações agendadas por dia e não repete a execução (automations.ts, jaRodou): a cópia disputaria com o agendador."],
  ["runCalendarRecurrences", "O servidor também gera as recorrências de calendário e cria registros em massa com ids da sua sequência (collaboration.ts): a cópia disputaria com o agendador."],
]);

/** `true` se alguma chamada do gesto está na lista: o gesto inteiro espera o servidor (D-13). */
export function esperaOServidor(chamadas: readonly ChamadaDeOperacao[]): boolean {
  return chamadas.some((chamada) => OPERACOES_QUE_ESPERAM.has(chamada.nome));
}
