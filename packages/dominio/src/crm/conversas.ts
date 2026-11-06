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
import type { Contato, TipoIdentificadorContato } from "./contatos";

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

/** A quem a Conversa está atribuída: um Membro ou um Agente do Espaço, ou ninguém. */
export type Atribuicao = { readonly tipo: "membro" | "agente"; readonly id: string } | null;

export interface Conversa {
  readonly id: string;
  readonly canalId: string;
  readonly contatoId: string;
  readonly titulo: string;
  readonly tituloEditado: boolean;
  readonly situacao: SituacaoDaConversa;
  readonly estado: EstadoDaConversa;
  /** Quando foi para a lixeira (011, `conversas_na_lixeira_em_ck`): só tem valor com `estado = "na_lixeira"`. */
  readonly naLixeiraEm: string | null;
  readonly filaId: string | null;
  readonly atribuido: Atribuicao;
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
  /** O Atribuído, Membro ou Agente: o id basta, a coluna do tipo anda junto com ele. */
  readonly atribuidoId?: string;
  readonly filaId?: string;
  /** `true`: só as que o Membro da sessão marcou com estrela; `false`: só as que não marcou. */
  readonly comEstrela?: boolean;
  /**
   * Do Membro da sessão (nunca de um id do cliente): `true` só as que têm Mensagem
   * recebida depois do `lidaAte` dele; `false` só as sem Mensagem nova para ele.
   */
  readonly naoLidas?: boolean;
  /** Trecho do título, sem diferenciar maiúscula; é texto literal, sem curinga. */
  readonly q?: string;
}

/**
 * A Conversa como a Caixa a lista: o nome do Contato, a estrela e as Mensagens
 * não lidas são do Membro da sessão (3.2.6), não da Conversa. `contatoNome` é
 * derivado a cada leitura, como na ficha; é `null` só quando o Contato não é
 * achado neste Espaço.
 */
export interface ConversaNaLista extends Conversa {
  readonly contatoNome: string | null;
  readonly estrela: boolean;
  readonly naoLidas: number;
}

/** A estrela e o ponto até onde o Membro leu a Conversa (`conversa_marcacoes`, 011). */
export interface MarcacaoDaConversa {
  readonly estrela: boolean;
  readonly lidaAte: string | null;
}

/** O que o Membro muda na própria marcação: só os campos enviados mudam. */
export interface EdicaoDeMarcacao {
  readonly estrela?: boolean;
  readonly lidaAte?: string;
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

/**
 * Mover a Conversa para outro Contato (3.2.5): o Canal e as Mensagens ficam
 * (INV-CXE-04); só o Contato muda. Uma Conversa na lixeira está parada
 * (INV-CXE-13) e o destino é sempre um Contato `ativo`: arquivado, na lixeira
 * e mesclado não recebem Conversa. A colisão com a Conversa aberta do destino
 * não é decidida aqui: depende de ler o banco e fica com o serviço.
 */
export function validarMover(
  conversa: Pick<Conversa, "estado" | "contatoId">,
  destino: Pick<Contato, "id" | "estado">,
): OperationResult<void> {
  if (conversa.estado === "na_lixeira") return fail("Uma Conversa na lixeira não muda de Contato.");
  if (destino.id === conversa.contatoId) return fail("A Conversa já é deste Contato.", "contatoId");
  if (destino.estado !== "ativo") return fail("Escolha um Contato ativo.", "contatoId");
  return ok(undefined);
}

/**
 * A lista de Participantes depois de mover: o Participante do tipo contato que
 * apontava para o Contato de origem passa a apontar para o de destino, com
 * `principal` e as datas intactos. Membros e Agentes não se mexem. Devolve uma
 * lista nova; a de entrada não é alterada.
 */
export function participantesComContato(
  participantes: readonly ParticipanteDaConversa[],
  deContatoId: string,
  paraContatoId: string,
): ParticipanteDaConversa[] {
  return participantes.map((participante) =>
    participante.sujeito.tipo === "contato" && participante.sujeito.id === deContatoId
      ? { ...participante, sujeito: { tipo: "contato", id: paraContatoId } }
      : participante,
  );
}

/**
 * Atribuir (3.2.6, parte 1): uma Conversa na lixeira está parada (INV-CXE-13) e
 * não é atribuída. Quem pode receber a atribuição (Membro ativo NESTE Espaço,
 * Agente ativo NESTE Espaço) depende de ler o banco e fica com o serviço.
 */
export function validarAtribuicao(conversa: Pick<Conversa, "estado">): OperationResult<void> {
  if (conversa.estado === "na_lixeira") return fail("Uma Conversa na lixeira não é atribuída. Restaure-a antes.");
  return ok(undefined);
}

/**
 * Lixeira (3.2.6): só a Conversa resolvida vai para a lixeira
 * (`conversas_lixeira_ck`). Mandar a que já está lá é recusado, para a data
 * `naLixeiraEm` não ser reescrita por engano.
 */
export function validarLixeira(conversa: Pick<Conversa, "situacao" | "estado">): OperationResult<void> {
  if (conversa.estado === "na_lixeira") return fail("A Conversa já está na lixeira.");
  if (conversa.situacao !== "resolvida") return fail("Resolva a Conversa antes de mandá-la para a lixeira.");
  return ok(undefined);
}

/**
 * Restaurar (3.2.6): só a Conversa que está na lixeira volta, e não para um
 * Contato que também está lá (uma Conversa sem Contato resolvido não é
 * roteável). Contato arquivado ou mesclado não impede: a Conversa volta e o
 * resto segue as regras desses estados.
 */
export function validarRestauracao(
  conversa: Pick<Conversa, "estado">,
  contato: Pick<Contato, "estado">,
): OperationResult<void> {
  if (conversa.estado !== "na_lixeira") return fail("A Conversa não está na lixeira.");
  if (contato.estado === "na_lixeira") {
    return fail("O Contato está na lixeira. Restaure o Contato antes: uma Conversa sem Contato resolvido não é roteável.");
  }
  return ok(undefined);
}

const DATA_COM_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Estrela e leitura (3.2.6): ao menos um campo, e `lidaAte` é um instante ISO
 * 8601 com hora e fuso. De quem é a marcação não está aqui: é sempre o Membro da
 * sessão, nunca um campo da edição.
 */
export function validarMarcacao(edicao: EdicaoDeMarcacao): OperationResult<EdicaoDeMarcacao> {
  if (edicao.estrela === undefined && edicao.lidaAte === undefined) {
    return fail("Informe a estrela ou até quando a Conversa foi lida.");
  }
  if (edicao.lidaAte !== undefined && !(DATA_COM_HORA.test(edicao.lidaAte) && !Number.isNaN(Date.parse(edicao.lidaAte)))) {
    return fail("Informe a data de leitura em ISO 8601, com hora (AAAA-MM-DDTHH:MM:SSZ).", "lidaAte");
  }
  return ok(edicao);
}
