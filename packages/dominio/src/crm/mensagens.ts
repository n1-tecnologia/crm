/**
 * A Mensagem do CRM novo. Tipos camelCase dos campos de `plataforma.mensagens`
 * (008; ontologia 7.6), mais as regras que valem dos dois lados da fronteira —
 * a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com o `Message` inglês de `types/crm.ts` até a fase de unificação
 * (D-11). Decisões do modelo:
 *   - `carga_bruta` (o que o provedor entregou, cru) existe só no banco e no
 *     caminho interno de ingestão (`MensagemRecebidaDoProvedor`). O tipo público
 *     `Mensagem` não a carrega: ela é dado pessoal (A9) e a anonimização futura
 *     precisa zerá-la, então nada que sai pela api pode depender dela.
 *   - A Mensagem `recebida` não nasce por rota humana: `DIRECOES_DE_ENVIO` é o
 *     que uma pessoa manda e é a fonte do `z.enum` da rota (T-08-22).
 *   - `validarEnvio` é RN-CXE-19 por (tipo, provedor): quem chama entrega as
 *     capacidades do Canal (`capacidadesDoCanal`), e a regra não conhece
 *     provedor. B69 mora em `statusInicialDeEnvio`.
 * Nenhum tipo aqui carrega `workspaceId`.
 *
 * Os valores discretos abaixo são cópia literal da 008 (`satisfies` impede que
 * a constante e o tipo divirjam entre si):
 *   - `DirecaoDaMensagem`     → `mensagens_direcao_ck`
 *   - `TipoDeAtorDaMensagem`  → `mensagens_ator_ck`
 *   - `StatusDeEntrega`       → `mensagens_status_ck`
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/mensagens`.
 */

import { fail, ok, type OperationResult } from "../state";
import type { ConexaoDoCanal } from "./canais";
import { LIMITES_CRM } from "./comum";

export const DIRECOES_DA_MENSAGEM = ["recebida", "enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];
export type DirecaoDaMensagem = "recebida" | "enviada" | "interna";

export const DIRECOES_DE_ENVIO = ["enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];

export const STATUS_DE_ENTREGA = [
  "pendente",
  "enviada",
  "entregue",
  "lida",
  "falhou",
] as const satisfies readonly StatusDeEntrega[];
export type StatusDeEntrega = "pendente" | "enviada" | "entregue" | "lida" | "falhou";

export const TIPOS_DE_ATOR_DA_MENSAGEM = [
  "member",
  "agent",
  "automation",
  "integration",
  "system",
] as const satisfies readonly TipoDeAtorDaMensagem[];
export type TipoDeAtorDaMensagem = "member" | "agent" | "automation" | "integration" | "system";

export interface AtorDaMensagem {
  readonly tipo: TipoDeAtorDaMensagem;
  readonly id: string;
}

export interface AnexoDaMensagem {
  readonly tipoDeMidia: string;
  readonly nome: string;
  readonly referenciaExterna?: string;
}

export interface EnderecoAdicional {
  readonly tipo: "para" | "copia" | "copiaOculta";
  readonly endereco: string;
  readonly nomeExibido?: string;
}

export interface Mensagem {
  readonly id: string;
  readonly conversaId: string;
  readonly canalId: string;
  readonly seq: number;
  readonly direcao: DirecaoDaMensagem;
  readonly ator: AtorDaMensagem;
  readonly delegante: AtorDaMensagem | null;
  readonly remetenteParticipanteId: string | null;
  readonly identificadorId: string | null;
  readonly remetenteExterno: string | null;
  readonly conteudo: string | null;
  readonly anexos: readonly AnexoDaMensagem[];
  readonly assunto: string | null;
  readonly enderecosAdicionais: readonly EnderecoAdicional[];
  readonly emRespostaAId: string | null;
  readonly modeloUsado: { readonly idNoProvedor: string; readonly nome: string } | null;
  readonly idExterno: string | null;
  readonly statusEntrega: StatusDeEntrega | null;
  readonly statusEntregaEm: string | null;
  readonly motivoFalha: string | null;
  readonly leiturasInternas: readonly unknown[];
  readonly reacoes: readonly unknown[];
  readonly marcacaoExclusao: unknown | null;
  readonly edicoesExternas: readonly unknown[];
  readonly anonimizada: boolean;
  readonly criadoEm: string;
  readonly registradoEm: string;
}

export interface NovaMensagem {
  readonly conversaId: string;
  readonly direcao: "enviada" | "interna";
  readonly conteudo: string;
  readonly emRespostaAId?: string;
}

export interface MensagemRecebidaDoProvedor {
  readonly conversaId: string;
  readonly idExterno: string;
  readonly criadoEm: string;
  readonly conteudo?: string;
  readonly anexos?: readonly AnexoDaMensagem[];
  readonly assunto?: string;
  readonly enderecosAdicionais?: readonly EnderecoAdicional[];
  readonly remetenteExterno?: string;
  readonly identificadorId?: string;
  readonly cargaBruta: unknown;
}

/**
 * Uma Mensagem que uma pessoa manda: `enviada` ao Contato ou `interna` (nota,
 * B67). Texto obrigatório — anexos ainda não entram por aqui (INV-CXE-07 pede
 * conteúdo ou anexo, e só o conteúdo existe nesta fase).
 */
export function validarNovaMensagem(entrada: NovaMensagem): OperationResult<NovaMensagem> {
  if (entrada.conversaId.trim() === "") return fail("Escolha a Conversa da Mensagem.", "conversaId");
  if (!(DIRECOES_DE_ENVIO as readonly string[]).includes(entrada.direcao)) {
    return fail("Uma Mensagem recebida não é criada por uma pessoa.", "direcao");
  }
  if (entrada.conteudo.trim() === "") return fail("Escreva a mensagem antes de enviar.", "conteudo");
  if (entrada.conteudo.length > LIMITES_CRM.textoLongo) {
    return fail(`A Mensagem vai até ${LIMITES_CRM.textoLongo} caracteres.`, "conteudo");
  }
  return ok(entrada);
}

export interface EntradaDeEnvio {
  /** As Capacidades do Canal (`capacidadesDoCanal`): a regra não conhece o provedor. */
  readonly capacidades: {
    readonly responseWindowHours?: number;
    readonly requiresTemplateOutsideWindow: boolean;
  };
  /** O `criadoEm` da última Mensagem `recebida` da Conversa; `null` se nunca recebeu. */
  readonly ultimaRecebidaEm: string | null;
  /** O instante do envio, em milissegundos — vem de quem chama, para a regra ser pura. */
  readonly agora: number;
  readonly modeloId?: string;
  /** Os ids, no provedor, dos modelos aprovados do Canal. A api passa `[]` nesta fase. */
  readonly modelosAprovados: readonly string[];
}

/**
 * RN-CXE-19: fora da janela de resposta, só uma Mensagem de modelo aprovada
 * sai — e a recusa vem ANTES de gravar, para qualquer ator. A janela só existe
 * depois da primeira recebida, e vale até o instante do fim (a mesma conta de
 * `sendMessage`). Capacidades sem exigência de modelo (WhatsApp não oficial,
 * E-mail, Instagram, Chat do site) liberam texto livre a qualquer hora.
 */
export function validarEnvio(entrada: EntradaDeEnvio): OperationResult<void> {
  const { capacidades, ultimaRecebidaEm, agora, modeloId, modelosAprovados } = entrada;
  if (!capacidades.requiresTemplateOutsideWindow) return ok(undefined);
  const horas = capacidades.responseWindowHours;
  if (horas === undefined || ultimaRecebidaEm === null) return ok(undefined);
  const fimDaJanela = Date.parse(ultimaRecebidaEm) + horas * 3_600_000;
  if (agora <= fimDaJanela) return ok(undefined);

  if (modelosAprovados.length === 0) {
    return fail(
      "Este Canal não tem Mensagem de modelo aprovada: não dá para enviar fora da janela de resposta.",
      "modelo",
    );
  }
  if (modeloId === undefined || modeloId === "") {
    return fail(
      "A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada.",
      "modelo",
    );
  }
  if (!modelosAprovados.includes(modeloId)) {
    return fail("Escolha uma Mensagem de modelo aprovada pelo provedor.", "modelo");
  }
  return ok(undefined);
}

/**
 * B69: com o Canal fora do ar a Mensagem é guardada `pendente` — nunca
 * descartada em silêncio. Só um Canal `conectada` a dá como `enviada`.
 */
export function statusInicialDeEnvio(conexao: ConexaoDoCanal): StatusDeEntrega {
  return conexao === "conectada" ? "enviada" : "pendente";
}
