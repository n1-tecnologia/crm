/**
 * A regra da mesclagem de Contatos do modelo novo (3.2.2): dois Contatos viram
 * um, e o absorvido fica `mesclado`, terminal e somente leitura. Pura: a tela
 * pré-valida e o endpoint aplica as MESMAS funções (CONTEXT.md raiz).
 *
 * O que move, e como, é do serviço de mesclagem da api (`servicos/crm/mesclagem.ts`);
 * aqui só mora o que decide:
 *   - quem pode ser mesclado com quem (RN-CON-14);
 *   - qual Conversa fica quando as duas estão abertas no mesmo Canal (RN-CXE-10).
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/mesclagem`.
 */

import { fail, ok, type OperationResult } from "../state";
import type { Contato } from "./contatos";

/**
 * RN-CON-14: só se mescla Contato `ativo` ou `arquivado`. O que está na lixeira
 * ou já foi absorvido fica de fora dos dois lados, e por isso o sobrevivente
 * nunca é `mesclado` (sem cadeia). O sobrevivente termina `ativo` se qualquer
 * dos dois era `ativo`.
 */
export function validarMesclagem(
  sobrevivente: Pick<Contato, "id" | "estado">,
  absorvido: Pick<Contato, "id" | "estado">,
): OperationResult<{ readonly estadoDoSobrevivente: "ativo" | "arquivado" }> {
  if (sobrevivente.id === absorvido.id) return fail("Escolha dois Contatos diferentes.", "absorvidoId");
  const frase = "Só é possível mesclar Contatos ativos ou arquivados.";
  if (sobrevivente.estado !== "ativo" && sobrevivente.estado !== "arquivado") return fail(frase, "sobreviventeId");
  if (absorvido.estado !== "ativo" && absorvido.estado !== "arquivado") return fail(frase, "absorvidoId");
  const ativo = sobrevivente.estado === "ativo" || absorvido.estado === "ativo";
  return ok({ estadoDoSobrevivente: ativo ? "ativo" : "arquivado" });
}

/** Uma Conversa não resolvida de um dos dois Contatos, no Canal em que as duas colidem. */
export interface ConversaEmColisao {
  readonly id: string;
  /** A hora da Mensagem mais recente; `null` se a Conversa não tem nenhuma. */
  readonly ultimaMensagemEm: string | null;
  readonly criadoEm: string;
}

/**
 * RN-CXE-10: se o sobrevivente fica com duas Conversas abertas ou pendentes no
 * mesmo Canal, a de Mensagem mais recente fica e as outras viram `resolvida`,
 * sem mover Mensagens. Devolve os ids que resolvem. Sem Mensagem, vale
 * `criadoEm`; o empate é decidido pelo id, para o resultado não depender da
 * ordem em que o banco devolveu as linhas.
 *
 * Suposição OQ3 (a confirmar com o dono): a 3.2.2 diz "a do absorvido" cede;
 * aqui segue a RN-CXE-10 da ontologia, que é a mesma regra do modelo antigo.
 */
export function conversasQueResolvemNaColisao(conversas: readonly ConversaEmColisao[]): string[] {
  if (conversas.length < 2) return [];
  const instante = (c: ConversaEmColisao): number => Date.parse(c.ultimaMensagemEm ?? c.criadoEm);
  const ordenadas = [...conversas].sort((a, b) => instante(b) - instante(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ordenadas.slice(1).map((c) => c.id);
}
