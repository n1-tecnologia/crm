/**
 * O provedor do Instagram (Sessão 8): a implementação de `ProvedorDeMensageria` para o Canal `instagram-graph`, sobre o
 * cliente (`cliente.ts`), o tradutor (`traduzir.ts`), a mídia (`midia.ts`), a credencial (`token.ts`) e a tabela de
 * quem escreveu (`repositorio.ts`). É a "API do Instagram com login do Instagram" (decisão 8.2.1, opção A).
 *
 * A credencial do Canal (`tipo = "instagram-graph"` no cofre, que `canalParaProvedor` decifra) é o JSON
 * `{ contaId, token, expiraEm, obtidoEm }`. Nada aqui loga corpo, texto, @, IGSID, token nem segredo do app.
 *
 * O webhook (`verificarChamada`): a Meta assina o corpo CRU com a chave secreta do app (`X-Hub-Signature-256`); não há
 * segredo por Canal. A assinatura certa só passa se o corpo tiver um `entry` da conta DESTE Canal: a chamada da conta de
 * outro Canal recebe a mesma recusa (o equivalente da instância da Evolution, T-16-43). As duas conferências rodam sempre.
 *
 * Quem escreveu (`resolverRemetente`): o webhook só traz o IGSID. O provedor lê o perfil (`/{igsid}?fields=name,username`)
 * e guarda o @ e o nome em `instagram_remetentes`, relido depois de `validadeDoPerfilMs`; com a Meta fora do ar, vale o
 * guardado. O `receberMensagem` acha ou cria o Contato por esse @.
 *
 * O envio (`enviar`): a resposta sai pelo IGSID de quem tem o @ do destino nesta conta. Nunca reenvia sozinho o que pode
 * ter saído: tempo esgotado, resposta perdida, aceite sem id e 500 são `ambiguo`; só o que certamente não saiu (conexão
 * recusada, 429 e os limites da Meta, 502, 503, 504, e qualquer falha ANTES do pedido) é `transitorio`. Fora da janela de
 * 24 h, o Instagram recusa e a frase diz que só o Contato reabre. Um anexo (imagem, vídeo ou áudio) vai pela URL assinada
 * do bucket; com texto junto, saem duas mensagens, e o texto que não se confirma depois do arquivo é ambíguo.
 */

import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { fraseDaJanelaBloqueada } from "@n1/dominio/crm/mensagens";
import { categoriaDaMidia } from "@n1/dominio/crm/midia";
import { normalizarInstagram } from "@n1/dominio/crm/normalizacao";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";
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
import { assinaturaDoCorpoConfere, iguais } from "../meta/assinatura";
import { criarClienteDoInstagram, ErroDoInstagram, type ClienteDoInstagram } from "./cliente";
import type { ConfiguracaoDoInstagram } from "./configuracao";
import { baixarMidiaDaMeta, type OpcoesDoDownload } from "./midia";
import type { RemetentesDoInstagram } from "./repositorio";
import { FRASE_TOKEN_VENCIDO, lerCredencialDoInstagram, type TokensDoInstagram } from "./token";
import { chaveDoItem, entradasDoCorpo, PREFIXO_DO_IGSID, traduzirChamadaDoInstagram } from "./traduzir";

export const CABECALHO_DA_ASSINATURA_DA_META = "x-hub-signature-256";

/** A janela do Instagram (`CHANNEL_CAPABILITIES.instagram.responseWindowHours`). */
const JANELA_HORAS = 24;

export const FRASE_SEM_IGSID =
  "O Instagram só responde a quem escreveu para esta conta: este Contato ainda não mandou mensagem por este Canal.";

export interface DependenciasDoProvedorInstagram {
  readonly configuracao: ConfiguracaoDoInstagram;
  readonly remetentes: RemetentesDoInstagram;
  readonly tokens: TokensDoInstagram;
  /** Padrão: `criarClienteDoInstagram(configuracao)`. */
  readonly cliente?: ClienteDoInstagram;
  /** O download da mídia recebida; os testes trocam o host permitido pelo do servidor falso. */
  readonly midia?: Omit<OpcoesDoDownload, "tetoBytes">;
  readonly agora?: () => number;
  /** Quanto tempo o @ e o nome guardados de quem escreveu valem antes de reler o perfil. Padrão: 24 h. */
  readonly validadeDoPerfilMs?: number;
}

function recusa(codigo: string, motivo: string): ResultadoDoEnvio {
  return { ok: false, transitorio: false, codigo, motivo };
}

const transitorio = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: true, codigo, motivo });
const ambiguo = (codigo: string, motivo: string): ResultadoDoEnvio => ({ ok: false, transitorio: false, ambiguo: true, codigo, motivo });

/** Os `error.code` da Meta para limite de chamadas: nada foi processado, volta à fila. */
const CODIGOS_DE_LIMITE: ReadonlySet<number> = new Set([4, 17, 32, 613]);
const SUBCODIGO_FORA_DA_JANELA = 2018278;

/** O desfecho de um envio que falhou. Nunca repete o token nem a URL do pedido; a frase da Meta é curta e sem dado. */
function resultadoDoErro(erro: unknown): ResultadoDoEnvio {
  if (!(erro instanceof ErroDoInstagram)) return ambiguo("ERRO_NO_ENVIO", "Não foi possível confirmar o envio.");
  if (erro.transporte === "rede") return transitorio("INSTAGRAM_INDISPONIVEL", "O Instagram não está acessível no momento.");
  if (erro.transporte === "tempo_esgotado") return ambiguo("TEMPO_ESGOTADO", "O Instagram não respondeu a tempo.");
  if (erro.transporte === "resposta_perdida") return ambiguo("RESPOSTA_PERDIDA", "A conexão com o Instagram caiu antes da resposta.");
  // Aceito sem o id: saiu, e não há como acompanhar. Nunca reenvia.
  if (erro.status >= 200 && erro.status < 300) return ambiguo("RESPOSTA_SEM_ID", "O Instagram aceitou o envio sem devolver o id da mensagem.");
  if (erro.tokenInvalido) return recusa("TOKEN_INVALIDO", FRASE_TOKEN_VENCIDO);
  if (erro.subcodigo === SUBCODIGO_FORA_DA_JANELA || erro.codigo === 10) return recusa("FORA_DA_JANELA", fraseDaJanelaBloqueada(JANELA_HORAS));
  if (erro.status === 429 || (erro.codigo !== undefined && CODIGOS_DE_LIMITE.has(erro.codigo))) {
    return transitorio("LIMITE_DO_INSTAGRAM", "O Instagram pediu para esperar antes de enviar de novo.");
  }
  if (erro.status === 502 || erro.status === 503 || erro.status === 504) return transitorio(`HTTP_${erro.status}`, "O Instagram está indisponível no momento.");
  // 500 e qualquer outro 5xx: o Instagram pode ter enviado antes de falhar.
  if (erro.status >= 500) return ambiguo(`HTTP_${erro.status}`, "O Instagram falhou durante o envio.");
  if (erro.codigo === 551) return recusa("PESSOA_INDISPONIVEL", "Esta pessoa não está disponível no Instagram.");
  return recusa(`HTTP_${erro.status}`, `O Instagram recusou a Mensagem: ${erro.message}`);
}

export function criarProvedorInstagram(deps: DependenciasDoProvedorInstagram): ProvedorDeMensageria {
  const { configuracao, remetentes, tokens } = deps;
  const cliente = deps.cliente ?? criarClienteDoInstagram(configuracao);
  const agora = deps.agora ?? Date.now;
  const validadeDoPerfilMs = deps.validadeDoPerfilMs ?? 24 * 3_600_000;

  return {
    provedor: "instagram-graph",

    verificarChamada(chamada: ChamadaDoWebhook, canal: CanalParaProvedor): boolean {
      const cabecalho = chamada.cabecalhos[CABECALHO_DA_ASSINATURA_DA_META];
      let assinaturaConfere = false;
      for (const segredo of configuracao.segredosDoWebhook ?? [configuracao.appSecret]) {
        if (segredo !== "" && assinaturaDoCorpoConfere(segredo, chamada.corpoCru, cabecalho)) assinaturaConfere = true;
      }
      const credencial = lerCredencialDoInstagram(canal.credencial);
      const contas = entradasDoCorpo(chamada.corpo).map((e) => e.contaId);
      // Sem curto-circuito: as duas conferências rodam sempre.
      let contaConfere = false;
      for (const conta of contas) if (iguais(conta, credencial?.contaId ?? "")) contaConfere = true;
      return assinaturaConfere && credencial !== undefined && contaConfere;
    },

    interpretarChamada(corpo: unknown, canal: CanalParaProvedor): readonly EventoDoProvedor[] {
      const credencial = lerCredencialDoInstagram(canal.credencial);
      if (!credencial) return [{ tipo: "ignorado", motivo: "sem_credencial" }];
      return traduzirChamadaDoInstagram(corpo, credencial.contaId);
    },

    chaveDaChamada: chaveDoItem,

    async resolverRemetente(canal: CanalParaProvedor, recebida: RecebidaDoProvedor): Promise<RecebidaDoProvedor> {
      const { tipo, valor } = recebida.remetente;
      if (tipo !== "instagram" || !valor.startsWith(PREFIXO_DO_IGSID)) return recebida;
      const igsid = valor.slice(PREFIXO_DO_IGSID.length);
      const { workspaceId } = canal;
      const canalId = canal.canal.id;

      const guardado = await remetentes.doIgsid(workspaceId, canalId, igsid);
      let usuario = guardado?.usuario;
      let nome = guardado?.nome ?? null;
      const fresco = guardado !== undefined && agora() - Date.parse(guardado.atualizadoEm) < validadeDoPerfilMs;
      if (!fresco) {
        const token = await tokens.tokenParaUsar(canal);
        if (token.ok) {
          try {
            const perfil = await cliente.lerRemetente(token.token, igsid);
            const lido = perfil.usuario === undefined ? undefined : normalizarInstagram(perfil.usuario);
            if (lido?.ok) {
              usuario = lido.value;
              nome = perfil.nome ?? nome;
              await remetentes.gravar(workspaceId, canalId, { igsid, usuario, nome });
            }
          } catch {
            // Sem a Meta, vale o @ guardado; sem nada guardado, a linha volta à fila (abaixo).
          }
        }
      }
      if (usuario === undefined) {
        throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "O Instagram não devolveu o @ de quem escreveu.");
      }
      return { ...recebida, remetente: { tipo: "instagram", valor: usuario, ...(nome ? { nomeExibido: nome } : {}) } };
    },

    async enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio> {
      if (envio.destino.tipo !== "instagram") return recusa("DESTINO_INVALIDO", "Este Canal só responde a um usuário do Instagram.");
      const usuario = normalizarInstagram(envio.destino.valor);
      if (!usuario.ok) return recusa("DESTINO_INVALIDO", "O @ do Instagram do Contato não é válido.");
      const texto = envio.conteudo ?? "";
      const anexos = envio.anexos ?? [];
      if (anexos.length === 0 && texto.trim() === "") return recusa("MENSAGEM_VAZIA", "A Mensagem está vazia.");
      if (anexos.length > 1) return recusa("ANEXO_INVALIDO", "Uma Mensagem leva um arquivo por vez.");
      const anexo = anexos[0];
      const categoria = anexo === undefined ? undefined : categoriaDaMidia(anexo.tipoDeMidia);
      if (anexo !== undefined && categoria !== "image" && categoria !== "video" && categoria !== "audio") {
        return recusa("TIPO_NAO_ENVIADO", "O Direct do Instagram não envia este tipo de arquivo: só imagem, vídeo e áudio.");
      }

      // Antes do pedido (credencial, renovação, a tabela de quem escreveu): uma exceção aqui certamente não enviou.
      let token: string;
      let contaId: string;
      let igsid: string | undefined;
      try {
        const lido = await tokens.tokenParaUsar(canal);
        if (!lido.ok) return recusa(lido.codigo, lido.motivo);
        token = lido.token;
        contaId = lido.contaId;
        igsid = await remetentes.igsidDoUsuario(canal.workspaceId, canal.canal.id, usuario.value);
      } catch {
        return transitorio("ERRO_ANTES_DO_ENVIO", "Não foi possível preparar o envio ao Instagram.");
      }
      if (igsid === undefined) return recusa("SEM_IGSID", FRASE_SEM_IGSID);

      try {
        if (anexo === undefined) return { ok: true, idExterno: (await cliente.enviarTexto(token, contaId, igsid, texto)).idExterno };
        const arquivo = await cliente.enviarAnexo(token, contaId, igsid, { tipo: categoria as "image" | "video" | "audio", url: anexo.urlAssinada });
        if (texto.trim() === "") return { ok: true, idExterno: arquivo.idExterno };
        try {
          await cliente.enviarTexto(token, contaId, igsid, texto);
        } catch {
          // O arquivo já saiu: se o texto não se confirma, a Mensagem não volta à fila (reenviaria o arquivo).
          return ambiguo("TEXTO_NAO_CONFIRMADO", "O arquivo saiu, mas o texto não pôde ser confirmado.");
        }
        return { ok: true, idExterno: arquivo.idExterno };
      } catch (erro) {
        return resultadoDoErro(erro);
      }
    },

    async baixarMidia(_canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada> {
      return baixarMidiaDaMeta(referenciaNoProvedor, { ...deps.midia, tetoBytes: opcoes.tetoBytes });
    },

    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      const token = await tokens.tokenParaUsar(canal);
      if (!token.ok) return "com_erro";
      try {
        await cliente.lerConta(token.token);
        return "conectada";
      } catch (erro) {
        if (erro instanceof ErroDoInstagram && erro.transporte !== undefined) {
          throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "O Instagram não respondeu.");
        }
        return "com_erro";
      }
    },
  };
}
