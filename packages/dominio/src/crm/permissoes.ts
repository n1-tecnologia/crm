/**
 * Permissão do CRM por Papel (D-14): a matriz que o backend aplica no serviço
 * e que a tela pode consultar para esconder o que o Papel não alcança.
 *
 * Mesma forma de `mayWriteDeal` (`operations/deals.ts`): devolve `undefined`
 * quando pode e a frase de recusa, em português, quando não pode. Regra que só
 * a tela conhece não é regra — é aparência —, por isso ela mora no domínio e
 * `apps/api` a aplica com a base do Papel lida de `plataforma.registros`.
 *
 * Matriz, na ordem em que é avaliada:
 *   1. Membro desconhecido (sem Papel ou sem estado) → recusa.
 *   2. `ler` → só `ativo` e `suspenso`.
 *   3. Escrita → só `ativo`.
 *   4. `convidado` → só consulta, em qualquer recurso.
 *   5. `funil` → só `administrador` e `proprietario` (inclui Etapas e padrão,
 *      RN-FUN-16/17).
 *   6. Reabrir Negócio `ganho` → só `administrador` e `proprietario` (RN-NEG-10).
 *   7. `canal` com qualquer ação que não seja `ler` → só `administrador` e
 *      `proprietario` (B35): conectar, configurar, simular conexão, desconectar
 *      e arquivar Canais é ato de quem administra o Espaço.
 *   8. O resto (`membro` em Contato, Empresa, Negócio, Conversa e Mensagem) →
 *      pode. Conversa e Mensagem: o `membro` cria Conversa e envia Mensagem; o
 *      `convidado` só lê (regra 4).
 *
 * Escopo `próprios` e Funil privado ficam para uma fase futura (D-10):
 * `privado` é só gravado, e nenhuma regra daqui o consulta.
 */

import type { MemberState, SystemRole } from "../types/workspace";
import type { SituacaoNegocio } from "./comum";

export type RecursoCrm = "contato" | "empresa" | "funil" | "negocio" | "canal" | "conversa" | "mensagem";

export type AcaoCrm =
  | "ler"
  | "criar"
  | "editar"
  | "arquivar"
  | "enviar_para_lixeira"
  | "restaurar"
  | "excluir_permanentemente"
  | "mover"
  | "ganhar"
  | "perder"
  | "reabrir"
  | "definir_padrao"
  | "simular_conexao"
  | "desconectar"
  | "resolver"
  | "enviar";

/** Administrador e Proprietário: quem configura Funis e reabre Negócio ganho. */
export function ehAdministracao(base: SystemRole | undefined): boolean {
  return base === "administrador" || base === "proprietario";
}

export function podeNoCrm(
  base: SystemRole | undefined,
  estado: MemberState | undefined,
  acao: AcaoCrm,
  recurso: RecursoCrm,
  contexto?: { readonly situacao?: SituacaoNegocio },
): string | undefined {
  if (base === undefined || estado === undefined) return "Membro não encontrado neste Espaço de Trabalho.";

  if (acao === "ler") {
    if (estado === "ativo" || estado === "suspenso") return undefined;
    return "Só um Membro ativo ou suspenso consulta o CRM.";
  }

  if (estado !== "ativo") return "Só um Membro ativo altera o CRM.";

  if (base === "convidado") {
    return "Um Convidado só consulta o CRM: criar, editar ou excluir exige o Papel de Membro.";
  }

  if (recurso === "funil" && !ehAdministracao(base)) {
    return "Só Administrador ou Proprietário configura Funis e Etapas (RN-FUN-17).";
  }

  if (recurso === "negocio" && acao === "reabrir" && contexto?.situacao === "ganho" && !ehAdministracao(base)) {
    return "Só Administrador ou Proprietário reabre um Negócio ganho (RN-NEG-10).";
  }

  if (recurso === "canal" && !ehAdministracao(base)) {
    return "Só Administrador ou Proprietário conecta, configura, simula conexão, desconecta e arquiva Canais (B35).";
  }

  return undefined;
}
