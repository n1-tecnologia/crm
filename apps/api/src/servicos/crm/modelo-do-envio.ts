/**
 * A escolha do modelo de uma Mensagem (Sessão 7, 7.3.4), para os dois lugares que enviam a primeira ou uma nova Mensagem pelo
 * WhatsApp oficial: responder numa Conversa que já existe (`mensagens.enviar`) e abrir uma Conversa nova
 * (`abrirConversaNoCliente`, que também serve a Tarefa conversacional).
 *
 * Devolve os modelos que o Canal pode enviar agora (aprovados pela Meta E de um tipo que o CRM sabe preencher) e, se a pessoa
 * escolheu um (`modeloId`), o modelo achado e as variáveis validadas. A lista é SEMPRE a do Canal da Conversa: um id de outro
 * Canal, de outro Espaço ou de um modelo não aprovado não está nela e vira 409 `MODELO_INDISPONIVEL`. Variáveis erradas são
 * 400 `VALOR_INVALIDO`, no campo `variaveis`. Só o WhatsApp oficial tem modelo: nos outros Canais a lista é vazia.
 */

import type { PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import { modeloNaLista, validarVariaveis, type ModeloDeMensagem, type ModeloNaLista } from "@n1/dominio/crm/modelos";
import { criarRepositorioDeModelosPg } from "../../repositorios/crm/modelos";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface PedidoDeModelo {
  readonly modeloId?: string | undefined;
  readonly variaveis?: readonly string[] | undefined;
}

export interface ModelosDoEnvio {
  /** Os modelos que o Canal envia agora; a recusa `JANELA_EXPIRADA` os devolve para a tela oferecer. */
  readonly enviaveis: readonly ModeloNaLista[];
  readonly escolhido: ModeloDeMensagem | undefined;
  /** As variáveis já aparadas e conferidas; vazia sem modelo. */
  readonly variaveis: readonly string[];
}

export async function modelosDoEnvio(
  cliente: Pick<PoolClient, "query">,
  workspaceId: string,
  canal: Pick<Canal, "id" | "provedor">,
  pedido: PedidoDeModelo,
): Promise<ResultadoCrm<ModelosDoEnvio>> {
  const enviaveis = (
    canal.provedor === "whatsapp-cloud" ? await criarRepositorioDeModelosPg(cliente).listarDoCanal(workspaceId, canal.id, { estado: "aprovado" }) : []
  )
    .map(modeloNaLista)
    .filter((m) => m.enviavel);
  if (pedido.modeloId === undefined || pedido.modeloId === "") return sucesso({ enviaveis, escolhido: undefined, variaveis: [] });

  const escolhido = enviaveis.find((m) => m.id === pedido.modeloId);
  if (!escolhido) {
    return recusa(409, "Este modelo não está disponível neste Canal: ele não existe, não foi aprovado pela Meta ou o CRM ainda não o envia.", {
      codigo: "MODELO_INDISPONIVEL",
      campo: "modeloId",
    });
  }
  const variaveis = validarVariaveis(escolhido, pedido.variaveis ?? []);
  if (!variaveis.ok) return recusa(400, variaveis.error, { codigo: "VALOR_INVALIDO", campo: "variaveis" });
  return sucesso({ enviaveis, escolhido, variaveis: variaveis.value });
}
