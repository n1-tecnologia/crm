/**
 * A interface única de provedor de mensageria (3.6.1, D-16-03): tudo que fala com um
 * provedor de fora (a fila de entrada, o webhook, a saída, a mídia, a Evolution) é
 * construído contra `ProvedorDeMensageria`. As Sessões 4, 7, 8 e 9 só ligam uma
 * implementação nova.
 *
 * `CanalParaProvedor` junta o Canal com o segredo do webhook e a credencial já
 * decifrada. Ele só existe dentro do `apps/api`, vive o tempo de uma chamada e NUNCA
 * vai a log, a resposta ou a erro: nada que receba um `CanalParaProvedor` o serializa.
 *
 * `baixarMidia` de qualquer implementação só fala com o host fixo do provedor. A das
 * Sessões 7 e 8 recebe uma URL da Meta e precisa conferir o host antes de baixar
 * (sem SSRF); a do provedor de teste nem faz requisição de rede.
 *
 * Os tipos do que entra (`RecebidaDoProvedor`) moram no domínio
 * (`@n1/dominio/crm/recebimento`, plano 16-01); aqui só se compõem.
 */

import type { ConexaoDoCanal, Canal } from "@n1/dominio/crm/canais";
import type { ProvedorDeCanal } from "@n1/dominio/crm/capacidades";
import type { TipoIdentificadorContato } from "@n1/dominio/crm/contatos";
import type { StatusDeEntrega } from "@n1/dominio/crm/mensagens";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";

/** O único nome de cabeçalho que leva o segredo do webhook: o do provedor de teste e o da Evolution (D-16-06). */
export const CABECALHO_DO_SEGREDO = "x-n1-webhook-segredo";

/** O `tipo` da credencial do cofre que guarda o segredo do webhook de um Canal. */
export const TIPO_DO_SEGREDO_DO_WEBHOOK = "webhook_segredo";

/** A chamada que o provedor fez ao webhook: o corpo cru (para assinatura) e o JSON já lido. */
export interface ChamadaDoWebhook {
  readonly cabecalhos: Readonly<Record<string, string | undefined>>;
  readonly corpoCru: Buffer;
  readonly corpo: unknown;
}

/** O Canal com o que só o `apps/api` sabe dele: o segredo do webhook e a credencial decifrada. Nunca vai a log. */
export interface CanalParaProvedor {
  readonly workspaceId: string;
  readonly canal: Canal;
  readonly segredoDoWebhook?: string;
  readonly credencial?: string;
}

export type EventoDoProvedor =
  | ({ readonly tipo: "mensagem" } & RecebidaDoProvedor)
  | {
      readonly tipo: "status";
      readonly idExterno: string;
      readonly status: StatusDeEntrega;
      readonly em: string;
      readonly motivo?: string;
    }
  | { readonly tipo: "conexao"; readonly conexao: ConexaoDoCanal; readonly motivo?: string }
  | { readonly tipo: "ignorado"; readonly motivo: string; readonly idExterno?: string };

export interface AnexoDoEnvio {
  readonly urlAssinada: string;
  readonly tipoDeMidia: string;
  readonly nome: string;
}

export interface EnvioAoProvedor {
  readonly mensagemId: string;
  readonly destino: { readonly tipo: TipoIdentificadorContato; readonly valor: string };
  readonly conteudo?: string;
  readonly anexos?: readonly AnexoDoEnvio[];
  readonly emRespostaAIdExterno?: string;
  readonly assunto?: string;
  readonly modelo?: { readonly idNoProvedor: string; readonly idioma: string; readonly variaveis: readonly string[] };
}

/** `ambiguo`: o provedor pode ter enviado (timeout ou resposta perdida); quem chama nunca reenvia sozinho. */
export type ResultadoDoEnvio =
  | { readonly ok: true; readonly idExterno: string }
  | {
      readonly ok: false;
      readonly transitorio: boolean;
      readonly ambiguo?: boolean;
      readonly codigo: string;
      readonly motivo: string;
    };

export interface MidiaBaixada {
  readonly bytes: Uint8Array;
  readonly tipoDeMidia: string;
  readonly nome?: string;
}

export interface ProvedorDeMensageria {
  readonly provedor: ProvedorDeCanal | "teste";
  /** Confere que a chamada vem do provedor desse Canal (segredo do cabeçalho, instância do corpo). Nunca lança. */
  verificarChamada(chamada: ChamadaDoWebhook, canal: CanalParaProvedor): boolean;
  /** Traduz o corpo em eventos. Corpo fora do formato vira `[{ tipo: "ignorado" }]`, nunca exceção. */
  interpretarChamada(corpo: unknown, canal: CanalParaProvedor): readonly EventoDoProvedor[];
  /** A chave de deduplicação da fila de entrada (o id do evento no provedor). */
  chaveDaChamada?(corpo: unknown): string | undefined;
  /**
   * Sessão 8: para o provedor cujo webhook só traz um id opaco de quem escreveu (o Instagram manda o IGSID, nunca o @).
   * O processador de entrada o chama ANTES de `receberMensagem` e fora da transação, como a mídia: devolve a mesma
   * recebida com o `remetente` que o Contato tem (o @ e o nome do perfil). Uma exceção é transitória (a linha volta à
   * fila na escada de `backoff()`). Sem este método, o `remetente` de `interpretarChamada` já é o do Contato.
   */
  resolverRemetente?(canal: CanalParaProvedor, recebida: RecebidaDoProvedor): Promise<RecebidaDoProvedor>;
  enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio>;
  baixarMidia(canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada>;
  estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal>;
  /**
   * Sessão 4 (4.3.1): para o provedor cujo evento de conexão é só um AVISO que não basta para gravar `conectada` (a
   * Evolution: o payload de `connection.update` não traz o número, e a pessoa pode ter lido o QR code com outro celular).
   * O processador de entrada o chama quando o evento diz `conectada`, fora da transação, e grava o que ele devolver:
   * `conexao: "conectada"` (a instância está mesmo aberta e o número é o do Canal), `"com_erro"` (o número é outro, a
   * credencial foi recusada ou a instância sumiu) ou nenhuma conexão (o provedor não confirma agora: nada muda, e `motivo`
   * vai ao `resultado` da linha). Uma exceção é transitória: a linha volta à fila na escada de `backoff()`.
   */
  conferirConexao?(canal: CanalParaProvedor): Promise<ConexaoConferida>;
}

/** O que `conferirConexao` leu na fonte. `motivo` é uma palavra curta (vai ao `resultado` da linha), nunca texto do provedor. */
export interface ConexaoConferida {
  readonly conexao?: ConexaoDoCanal;
  readonly motivo: string;
}

export type CodigoDeErroDeProvedor =
  | "PROVEDOR_INDISPONIVEL"
  | "MIDIA_INDISPONIVEL"
  | "MIDIA_GRANDE_DEMAIS"
  | "CREDENCIAL_AUSENTE";

/** O erro que um provedor ou o registro lança; a mensagem nunca carrega segredo, credencial nem dado pessoal. */
export class ErroDeProvedor extends Error {
  readonly codigo: CodigoDeErroDeProvedor;

  constructor(codigo: CodigoDeErroDeProvedor, mensagem?: string) {
    super(mensagem ?? codigo);
    this.name = "ErroDeProvedor";
    this.codigo = codigo;
  }
}
