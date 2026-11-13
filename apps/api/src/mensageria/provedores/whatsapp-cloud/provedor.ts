/**
 * O provedor do WhatsApp oficial (Sessão 7): a implementação de `ProvedorDeMensageria` para o Canal `whatsapp-cloud`, sobre
 * o cliente da Cloud API (`cliente.ts`), o tradutor (`traduzir.ts`), a mídia (`../instagram/midia.ts`, com o token no
 * download) e a credencial do cofre (`repositorio.ts`). O molde é o do Instagram.
 *
 * A credencial do Canal (`tipo = "whatsapp-cloud"` no cofre, que `canalParaProvedor` decifra) é o JSON
 * `{ phoneNumberId, wabaId, token }`. O token é permanente (usuário do sistema): não há renovação. Nada aqui loga corpo,
 * texto, número de telefone, token nem segredo do app.
 *
 * O webhook (`verificarChamada`): a Meta assina o corpo CRU com a chave secreta do app (`X-Hub-Signature-256`); não há
 * segredo por Canal. A assinatura certa só passa se o corpo tiver um `value` do número DESTE Canal: a chamada do número de
 * outro Canal recebe a mesma recusa (o equivalente da instância da Evolution, T-16-43). As duas conferências rodam sempre.
 *
 * O envio (`enviar`): texto, imagem, vídeo, áudio e documento (por URL assinada do bucket) e Mensagem de modelo. Nunca
 * reenvia sozinho o que pode ter saído: tempo esgotado, resposta perdida, aceite sem id e 500 são `ambiguo`; só o que
 * certamente não saiu (conexão recusada, os limites da Meta, 502, 503, 504, e qualquer falha ANTES do pedido) é
 * `transitorio`. Fora da janela de 24 h (código 131047) a recusa é definitiva e a frase diz que só modelo aprovado sai.
 *
 * NÃO conferido contra a Meta real (7.1 é do dono): os códigos de erro seguem a documentação da Cloud API.
 */

import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { categoriaDaMidia } from "@n1/dominio/crm/midia";
import { normalizarWhatsapp } from "@n1/dominio/crm/normalizacao";
import {
  ErroDeProvedor,
  type CanalParaProvedor,
  type ChamadaDoWebhook,
  type EnvioAoProvedor,
  type EventoDoProvedor,
  type MidiaBaixada,
  type ProvedorDeMensageria,
  type ResultadoDoEnvio,
} from "../../provedor";
import { baixarMidiaDaMeta, type OpcoesDoDownload } from "../instagram/midia";
import { assinaturaDoCorpoConfere, iguais } from "../meta/assinatura";
import { criarClienteDaCloudApi, ErroDaCloudApi, type ClienteDaCloudApi, type TipoDeMidiaDoEnvio } from "./cliente";
import type { ConfiguracaoDaCloudApi } from "./configuracao";
import { lerCredencialDaCloudApi } from "./repositorio";
import { chaveDoItem, traduzirChamadaDaCloudApi, valoresDoCorpo } from "./traduzir";

export const CABECALHO_DA_ASSINATURA_DA_META = "x-hub-signature-256";

export const FRASE_TOKEN_INVALIDO = "O acesso do WhatsApp foi recusado ou venceu: conecte o Canal de novo, com um token novo.";
export const FRASE_FORA_DA_JANELA = "Passaram 24 h desde a última mensagem do Contato: só é possível enviar uma Mensagem de modelo aprovada.";

export interface DependenciasDoProvedorWhatsAppCloud {
  readonly configuracao: ConfiguracaoDaCloudApi;
  /** Padrão: `criarClienteDaCloudApi(configuracao)`. */
  readonly cliente?: ClienteDaCloudApi;
  /** O download da mídia recebida; os testes trocam o host permitido pelo do servidor falso. */
  readonly midia?: Omit<OpcoesDoDownload, "tetoBytes" | "cabecalhos">;
}

function recusa(codigo: string, motivo: string): ResultadoDoEnvio {
  return { ok: false, transitorio: false, codigo, motivo };
}

const transitorio = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: true, codigo, motivo });
const ambiguo = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: false, ambiguo: true, codigo, motivo });

/** Os `error.code` da Meta para limite de chamadas: nada foi processado, volta à fila. */
const CODIGOS_DE_LIMITE: ReadonlySet<number> = new Set([4, 17, 32, 613, 80007, 130429, 131056]);
const CODIGO_FORA_DA_JANELA = 131047;
/** Os `error.code` de modelo recusado: não existe, parâmetros errados, pausado ou desativado. */
const CODIGOS_DE_MODELO: ReadonlySet<number> = new Set([132000, 132001, 132005, 132007, 132012, 132015, 132016]);

/** O desfecho de um envio que falhou. Nunca repete o token nem a URL do pedido; a frase da Meta é curta e sem dado. */
function resultadoDoErro(erro: unknown): ResultadoDoEnvio {
  if (!(erro instanceof ErroDaCloudApi)) return ambiguo("ERRO_NO_ENVIO", "Não foi possível confirmar o envio.");
  if (erro.transporte === "rede") return transitorio("WHATSAPP_INDISPONIVEL", "O WhatsApp não está acessível no momento.");
  if (erro.transporte === "tempo_esgotado") return ambiguo("TEMPO_ESGOTADO", "O WhatsApp não respondeu a tempo.");
  if (erro.transporte === "resposta_perdida") return ambiguo("RESPOSTA_PERDIDA", "A conexão com o WhatsApp caiu antes da resposta.");
  // Aceito sem o id: saiu, e não há como acompanhar. Nunca reenvia.
  if (erro.status >= 200 && erro.status < 300) return ambiguo("RESPOSTA_SEM_ID", "O WhatsApp aceitou o envio sem devolver o id da mensagem.");
  if (erro.tokenInvalido) return recusa("TOKEN_INVALIDO", FRASE_TOKEN_INVALIDO);
  if (erro.codigo === CODIGO_FORA_DA_JANELA) return recusa("FORA_DA_JANELA", FRASE_FORA_DA_JANELA);
  if (erro.status === 429 || (erro.codigo !== undefined && CODIGOS_DE_LIMITE.has(erro.codigo))) {
    return transitorio("LIMITE_DO_WHATSAPP", "O WhatsApp pediu para esperar antes de enviar de novo.");
  }
  if (erro.status === 502 || erro.status === 503 || erro.status === 504) return transitorio(`HTTP_${erro.status}`, "O WhatsApp está indisponível no momento.");
  // 500 e qualquer outro 5xx: o WhatsApp pode ter enviado antes de falhar.
  if (erro.status >= 500) return ambiguo(`HTTP_${erro.status}`, "O WhatsApp falhou durante o envio.");
  if (erro.codigo === 131030) return recusa("DESTINO_NAO_PERMITIDO", "Este número não está na lista de destinatários permitidos da conta de teste.");
  if (erro.codigo === 131026) return recusa("NAO_ENTREGAVEL", "Este número não recebe mensagens pelo WhatsApp.");
  if (erro.codigo !== undefined && CODIGOS_DE_MODELO.has(erro.codigo)) return recusa("MODELO_RECUSADO", `A Meta recusou a Mensagem de modelo: ${erro.message}`);
  return recusa(`HTTP_${erro.status}`, `O WhatsApp recusou a Mensagem: ${erro.message}`);
}

export function criarProvedorWhatsAppCloud(deps: DependenciasDoProvedorWhatsAppCloud): ProvedorDeMensageria {
  const { configuracao } = deps;
  const cliente = deps.cliente ?? criarClienteDaCloudApi(configuracao);

  return {
    provedor: "whatsapp-cloud",

    verificarChamada(chamada: ChamadaDoWebhook, canal: CanalParaProvedor): boolean {
      const assinaturaConfere = assinaturaDoCorpoConfere(configuracao.appSecret, chamada.corpoCru, chamada.cabecalhos[CABECALHO_DA_ASSINATURA_DA_META]);
      const credencial = lerCredencialDaCloudApi(canal.credencial);
      // Sem curto-circuito: as duas conferências rodam sempre.
      let numeroConfere = false;
      for (const { phoneNumberId } of valoresDoCorpo(chamada.corpo)) if (iguais(phoneNumberId, credencial?.phoneNumberId ?? "")) numeroConfere = true;
      return assinaturaConfere && credencial !== undefined && numeroConfere;
    },

    interpretarChamada(corpo: unknown, canal: CanalParaProvedor): readonly EventoDoProvedor[] {
      const credencial = lerCredencialDaCloudApi(canal.credencial);
      if (!credencial) return [{ tipo: "ignorado", motivo: "sem_credencial" }];
      return traduzirChamadaDaCloudApi(corpo, credencial.phoneNumberId);
    },

    chaveDaChamada: chaveDoItem,

    async enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio> {
      if (envio.destino.tipo !== "whatsapp") return recusa("DESTINO_INVALIDO", "Este Canal só responde a um número de WhatsApp.");
      const numero = normalizarWhatsapp(envio.destino.valor);
      if (!numero.ok) return recusa("DESTINO_INVALIDO", "O número de WhatsApp do Contato não é válido.");
      // A Cloud API aceita o número só com dígitos.
      const para = numero.value.replace(/\D/g, "");

      const credencial = lerCredencialDaCloudApi(canal.credencial);
      if (!credencial) return recusa("CREDENCIAL_AUSENTE", FRASE_TOKEN_INVALIDO);
      const opcoes = envio.emRespostaAIdExterno ? { emRespostaA: envio.emRespostaAIdExterno } : undefined;

      try {
        if (envio.modelo) {
          const nome = envio.modelo.nome;
          if (!nome) return recusa("MODELO_INVALIDO", "A Mensagem de modelo não diz o nome do modelo na Meta.");
          const enviado = await cliente.enviarModelo(
            credencial.token,
            credencial.phoneNumberId,
            para,
            { nome, idioma: envio.modelo.idioma, variaveis: envio.modelo.variaveis },
            opcoes,
          );
          return { ok: true, idExterno: enviado.idExterno };
        }

        const texto = envio.conteudo ?? "";
        const anexos = envio.anexos ?? [];
        if (anexos.length === 0 && texto.trim() === "") return recusa("MENSAGEM_VAZIA", "A Mensagem está vazia.");
        if (anexos.length > 1) return recusa("ANEXO_INVALIDO", "Uma Mensagem leva um arquivo por vez.");
        const anexo = anexos[0];
        if (anexo === undefined) {
          return { ok: true, idExterno: (await cliente.enviarTexto(credencial.token, credencial.phoneNumberId, para, texto, opcoes)).idExterno };
        }

        const tipo: TipoDeMidiaDoEnvio | undefined = categoriaDaMidia(anexo.tipoDeMidia);
        if (tipo === undefined) return recusa("TIPO_NAO_ENVIADO", "O WhatsApp não envia este tipo de arquivo.");
        // O áudio não leva legenda: o texto sai numa segunda mensagem. Imagem, vídeo e documento levam o texto como legenda.
        const legenda = tipo !== "audio" && texto.trim() !== "" ? texto : undefined;
        const arquivo = await cliente.enviarMidia(
          credencial.token,
          credencial.phoneNumberId,
          para,
          { tipo, url: anexo.urlAssinada, ...(legenda ? { legenda } : {}), ...(tipo === "document" ? { nome: anexo.nome } : {}) },
          opcoes,
        );
        if (tipo !== "audio" || texto.trim() === "") return { ok: true, idExterno: arquivo.idExterno };
        try {
          await cliente.enviarTexto(credencial.token, credencial.phoneNumberId, para, texto);
        } catch {
          // O áudio já saiu: se o texto não se confirma, a Mensagem não volta à fila (reenviaria o áudio).
          return ambiguo("TEXTO_NAO_CONFIRMADO", "O áudio saiu, mas o texto não pôde ser confirmado.");
        }
        return { ok: true, idExterno: arquivo.idExterno };
      } catch (erro) {
        return resultadoDoErro(erro);
      }
    },

    async baixarMidia(canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada> {
      const credencial = lerCredencialDaCloudApi(canal.credencial);
      if (!credencial) throw new ErroDeProvedor("CREDENCIAL_AUSENTE", "O Canal não tem credencial do WhatsApp.");
      let endereco: string;
      try {
        endereco = (await cliente.lerMidia(credencial.token, referenciaNoProvedor)).url;
      } catch (erro) {
        // Rede e 5xx passam sozinhos; o resto (mídia que a Meta não tem mais, token vencido) é definitivo.
        if (erro instanceof ErroDaCloudApi && (erro.transporte !== undefined || erro.status === 429 || erro.status >= 500)) {
          throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "O WhatsApp não entregou a mídia agora.");
        }
        throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A mídia não está disponível no WhatsApp.");
      }
      // O endereço sai do corpo da Meta: só é seguido num host da Meta, e só o primeiro pedido leva o token.
      return baixarMidiaDaMeta(endereco, { ...deps.midia, tetoBytes: opcoes.tetoBytes, cabecalhos: { authorization: `Bearer ${credencial.token}` } });
    },

    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      const credencial = lerCredencialDaCloudApi(canal.credencial);
      if (!credencial) return "com_erro";
      try {
        await cliente.dadosDoNumero(credencial.token, credencial.phoneNumberId);
        return "conectada";
      } catch (erro) {
        if (erro instanceof ErroDaCloudApi && erro.transporte !== undefined) {
          throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "O WhatsApp não respondeu.");
        }
        return "com_erro";
      }
    },
  };
}
