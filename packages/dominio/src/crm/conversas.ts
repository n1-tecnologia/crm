/**
 * A Conversa do CRM novo: o fio de Mensagens entre um Contato e um Canal. Tipos
 * camelCase dos campos de `plataforma.conversas` (008), mais as regras que
 * valem dos dois lados da fronteira — a tela pré-valida e o endpoint aplica as
 * MESMAS funções.
 *
 * Convive com o `Conversation` inglês de `types/crm.ts` até a fase de
 * unificação (D-11). Decisões do modelo:
 *   - Participantes são uma lista na própria Conversa e a Fila é só um id
 *     textual (D-09): nenhuma das duas ganhou tabela.
 *   - Uma Conversa pertence a UM Canal, para sempre (INV-CXE-04): `canalId` não
 *     tem edição.
 *   - A Conversa nasce com a primeira Mensagem (INV-CXE-05).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço vem da sessão, nunca do corpo.
 *
 * Os valores discretos abaixo são cópia literal da 008:
 *   - `SituacaoDaConversa` → `conversas_situacao_ck`
 *   - `EstadoDaConversa`   → `conversas_estado_ck`
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/conversas`.
 */

import { fail, ok, type OperationResult } from "../state";
import type { TipoComProvedor } from "../provedores-de-canal";
import type { Canal } from "./canais";
import { LIMITES_CRM } from "./comum";
import type { TipoIdentificadorContato } from "./contatos";

export const SITUACOES_DA_CONVERSA = ["aberta", "pendente", "resolvida"] as const satisfies readonly SituacaoDaConversa[];
export type SituacaoDaConversa = "aberta" | "pendente" | "resolvida";

export const ESTADOS_DA_CONVERSA = ["ativo", "na_lixeira"] as const satisfies readonly EstadoDaConversa[];
export type EstadoDaConversa = "ativo" | "na_lixeira";

export interface ParticipanteDaConversa {
  readonly id: string;
  readonly sujeito: { readonly tipo: "contato" | "membro" | "agente"; readonly id: string };
  readonly papel: "contato" | "atendente" | "agente" | "observador";
  readonly principal: boolean;
  readonly entrouEm: string;
  readonly saiuEm: string | null;
}

export interface Conversa {
  readonly id: string;
  readonly canalId: string;
  readonly contatoId: string;
  readonly titulo: string;
  readonly tituloEditado: boolean;
  readonly situacao: SituacaoDaConversa;
  readonly estado: EstadoDaConversa;
  readonly filaId: string | null;
  readonly atribuido: { readonly tipo: "membro" | "agente"; readonly id: string } | null;
  readonly adiadaAte: string | null;
  readonly adiamentoMotivo: string | null;
  readonly participantes: readonly ParticipanteDaConversa[];
  readonly resolvidaEm: string | null;
  readonly reabertaEm: string | null;
  readonly reaberturas: number;
  readonly criadoPor: { readonly tipo: string; readonly id: string };
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface ConversaDetalhada {
  readonly conversa: Conversa;
  readonly canal: Pick<Canal, "id" | "nome" | "tipo" | "provedor" | "conexao" | "conexaoSimulada">;
}

export interface NovaConversa {
  readonly canalId: string;
  readonly contatoId: string;
  readonly mensagem: { readonly conteudo: string };
}

export interface FiltroDeConversas {
  readonly estado: EstadoDaConversa;
  readonly limite: number;
  readonly deslocamento: number;
  readonly canalId?: string;
  readonly contatoId?: string;
  readonly situacao?: SituacaoDaConversa;
}

/**
 * O Identificador de Contato que cada Tipo de Canal resolve. `telefone` é
 * discável mas NÃO é WhatsApp (Pitfall 8): a identidade do WhatsApp é o
 * Identificador `whatsapp`. O mesmo mapa, do outro lado, é `resolvesIdentifierTypes`
 * do modelo inglês.
 */
export const TIPO_DE_IDENTIFICADOR_DO_CANAL: Readonly<Record<TipoComProvedor, TipoIdentificadorContato>> = {
  whatsapp: "whatsapp",
  instagram: "instagram",
  email: "email",
};

/**
 * INV-CXE-05: não existe Conversa sem Mensagem. O conteúdo da primeira
 * Mensagem respeita o mesmo teto do texto longo do CRM.
 */
export function validarNovaConversa(entrada: NovaConversa): OperationResult<NovaConversa> {
  if (entrada.canalId.trim() === "") return fail("Escolha o Canal da Conversa.", "canalId");
  if (entrada.contatoId.trim() === "") return fail("Escolha o Contato da Conversa.", "contatoId");
  const conteudo = entrada.mensagem.conteudo;
  if (conteudo.trim() === "") return fail("Escreva a primeira Mensagem da Conversa.", "conteudo");
  if (conteudo.length > LIMITES_CRM.textoLongo) {
    return fail(`A Mensagem vai até ${LIMITES_CRM.textoLongo} caracteres.`, "conteudo");
  }
  return ok(entrada);
}

export type AcaoDeSituacao = "resolver" | "reabrir";

/**
 * Resolver e reabrir são atos (DO-CXE-07): enviar não muda a situação. Uma
 * Conversa na lixeira está parada (INV-CXE-13). Reabrir devolve `aberta`; a
 * janela de reabertura e o contador ficam com o serviço.
 */
export function proximaSituacao(
  conversa: Pick<Conversa, "situacao" | "estado">,
  acao: AcaoDeSituacao,
): OperationResult<{ readonly situacao: SituacaoDaConversa }> {
  if (conversa.estado === "na_lixeira") return fail("Uma Conversa na lixeira não muda de situação.");
  if (acao === "resolver") {
    if (conversa.situacao === "resolvida") return fail("A Conversa já está resolvida.");
    return ok({ situacao: "resolvida" });
  }
  if (conversa.situacao !== "resolvida") return fail("Só uma Conversa resolvida é reaberta.");
  return ok({ situacao: "aberta" });
}

/**
 * O título que a Conversa recebe ao nascer: o nome do Contato; sem nome, o
 * Identificador pelo qual a conversa acontece. Editar o título depois marca
 * `tituloEditado` — essa marca é do serviço.
 */
export function tituloDaConversa(
  contato: { readonly nome: string | null; readonly sobrenome: string | null },
  identificadorExibido: string,
): string {
  const nome = [contato.nome, contato.sobrenome]
    .map((parte) => (parte ?? "").trim())
    .filter((parte) => parte !== "")
    .join(" ");
  return nome === "" ? identificadorExibido : nome;
}
