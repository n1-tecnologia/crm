/**
 * A Mensagem do CRM novo. Tipos camelCase dos campos de `plataforma.mensagens`
 * (008; ontologia 7.6), mais as regras que valem dos dois lados da fronteira —
 * a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com o `Message` inglês de `types/crm.ts` até a fase de unificação
 * (D-11). Decisões do modelo:
 *   - `carga_bruta` (o que o provedor entregou, cru) existe só no banco e no
 *     caminho interno de ingestão (`RecebidaDoProvedor`, `crm/recebimento.ts`). O tipo público
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
import { categoriaDaMidia } from "./midia";

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
  /** O id da mídia no provedor (a Mensagem `recebida`); some quando o arquivo é guardado. */
  readonly referenciaExterna?: string;
  /** A chave do objeto no bucket. Não dá acesso a nada: quem abre o arquivo pede uma URL assinada (3.9.3). */
  readonly objectKey?: string;
  readonly tamanhoBytes?: number;
  /** `true` quando o arquivo está guardado no bucket; `false` quando só há a referência do provedor (D-16-08). */
  readonly baixado: boolean;
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

/** O arquivo que a pessoa anexou: o ticket que ela pediu (`submissionId`) e o objeto reservado nele. */
export interface ReferenciaDeAnexoEnviado {
  readonly submissionId: string;
  readonly objectId: string;
}

/** O que o servidor confirmou no bucket sobre um anexo: o tipo e o tamanho vêm do arquivo, não do cliente. */
export interface AnexoConfirmado {
  readonly objectKey: string;
  readonly nome: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number;
}

/** Uma Mensagem é uma mensagem no provedor e tem um `id_externo` só: um arquivo por vez. */
export const MAX_ANEXOS_POR_MENSAGEM = 1;

export interface NovaMensagem {
  readonly conversaId: string;
  readonly direcao: "enviada" | "interna";
  /** Pode ser vazio quando há anexo (INV-CXE-07: conteúdo OU anexo). */
  readonly conteudo: string;
  readonly emRespostaAId?: string;
  readonly anexos?: readonly ReferenciaDeAnexoEnviado[];
}

/**
 * Uma Mensagem que uma pessoa manda: `enviada` ao Contato ou `interna` (nota,
 * B67). INV-CXE-07: texto OU anexo. O anexo é só a referência do arquivo que a
 * pessoa subiu; o servidor confere o arquivo (tipo, tamanho, assinatura) antes de gravar.
 */
export function validarNovaMensagem(entrada: NovaMensagem): OperationResult<NovaMensagem> {
  if (entrada.conversaId.trim() === "") return fail("Escolha a Conversa da Mensagem.", "conversaId");
  if (!(DIRECOES_DE_ENVIO as readonly string[]).includes(entrada.direcao)) {
    return fail("Uma Mensagem recebida não é criada por uma pessoa.", "direcao");
  }
  const anexos = entrada.anexos ?? [];
  if (anexos.length > MAX_ANEXOS_POR_MENSAGEM) return fail("Uma Mensagem leva um arquivo por vez.", "anexos");
  for (const anexo of anexos) {
    if (anexo.submissionId.trim() === "" || anexo.objectId.trim() === "") {
      return fail("O arquivo anexado não foi reconhecido. Envie-o de novo.", "anexos");
    }
  }
  if (entrada.conteudo.trim() === "" && anexos.length === 0) {
    return fail("Escreva a mensagem ou anexe um arquivo antes de enviar.", "conteudo");
  }
  if (entrada.conteudo.length > LIMITES_CRM.textoLongo) {
    return fail(`A Mensagem vai até ${LIMITES_CRM.textoLongo} caracteres.`, "conteudo");
  }
  return ok(entrada);
}

/** 3.9.1: o Canal só envia as categorias que declara em `sendableMediaTypes` — um Canal que não envia vídeo recusa vídeo. */
export function validarAnexosDoEnvio(
  anexos: readonly AnexoConfirmado[],
  sendableMediaTypes: readonly string[],
): OperationResult<void> {
  for (const anexo of anexos) {
    const categoria = categoriaDaMidia(anexo.tipoDeMidia);
    if (categoria === undefined || !sendableMediaTypes.includes(categoria)) {
      return fail("Este Canal não envia este tipo de arquivo.", "anexos");
    }
  }
  return ok(undefined);
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
 * B69 + 3.7.1: a Mensagem escrita na Caixa nasce SEMPRE `pendente`. Com o Canal
 * fora do ar ela é guardada, nunca descartada em silêncio; com o Canal
 * `conectada` ela entra na fila de saída e só o provedor diz que saiu — quem
 * a passa a `enviada` é a entrega, depois da confirmação dele. O atendente
 * jamais vê "enviada" numa Mensagem que ainda não saiu (MSG-02).
 *
 * O parâmetro `conexao` fica na assinatura: os chamadores já o passam e a regra
 * pode voltar a distinguir o Canal sem tocar neles.
 */
export function statusInicialDeEnvio(_conexao: ConexaoDoCanal): StatusDeEntrega {
  return "pendente";
}

/** A escada da entrega. `falhou` fica de fora: não é um degrau, é uma saída que só `pendente`/`enviada` têm. */
const POSICAO_NA_ENTREGA: Readonly<Record<Exclude<StatusDeEntrega, "falhou">, number>> = {
  pendente: 0,
  enviada: 1,
  entregue: 2,
  lida: 3,
};

/**
 * 3.6.5, MSG-02: o status de entrega que o provedor informa SÓ avança. A ordem é
 * `pendente` < `enviada` < `entregue` < `lida`; um `entregue` que chega depois de um `lida` (a rede não garante a
 * ordem) deixa a Mensagem `lida`: ela nunca parece menos entregue do que já foi. `falhou` só vale a partir de
 * `pendente` ou `enviada` (uma Mensagem que o destinatário já recebeu não "falha"), e nada sai de `falhou` por
 * um status do provedor: quem tira uma Mensagem de `falhou` é a pessoa, por "Tentar de novo".
 *
 * `atual = null` é a Mensagem que não tem status de entrega (`recebida`, `interna`): o status do provedor não se
 * aplica e a resposta é `null`. Devolve o próprio `atual` quando o novo não avança, para quem chama comparar.
 */
export function proximoStatusDeEntrega(atual: StatusDeEntrega | null, novo: StatusDeEntrega): StatusDeEntrega | null {
  if (atual === null || atual === "falhou") return atual;
  if (novo === "falhou") return atual === "pendente" || atual === "enviada" ? "falhou" : atual;
  return POSICAO_NA_ENTREGA[novo] > POSICAO_NA_ENTREGA[atual] ? novo : atual;
}

