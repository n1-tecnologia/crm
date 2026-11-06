/**
 * As operações de Membros que também mexem nas tabelas do CRM no MESMO commit
 * da gravação em `plataforma.registros` (Fase 14, 3.2.8).
 *
 * `removeMember` passa o dono dos Contatos, Empresas e Negócios do Membro ao
 * Sucessor e LIBERA as Conversas atribuídas a ele (RN-ET-09 a e b). O domínio só
 * valida o Sucessor quando o Membro ainda não tinha saído; repetir a remoção
 * devolve `ok` sem olhar o Sucessor, então aqui ele precisa ser Membro ATIVO
 * deste Espaço, senão nada passa. Uma operação com `aoConfirmar` sai do caminho de
 * duas idas da Fase 13 (paga mais idas ao banco): aceito, é um gesto raro.
 */

import { passarAoSucessor } from "../../repositorios/crm/sucessao";
import type { TabelaDeConfirmacoes } from "./tipos";

export const AO_CONFIRMAR_DOS_MEMBROS: TabelaDeConfirmacoes = {
  removeMember: async (cliente, args, membro, state) => {
    const sucessorId = String(args[1]);
    if (!state.members.some((m) => m.id === sucessorId && m.state === "ativo")) return;
    await passarAoSucessor(cliente, membro.workspaceId, String(args[0]), sucessorId);
  },
};
