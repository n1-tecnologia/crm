/**
 * Ligar um número do WhatsApp oficial a um Canal, pelo token (Sessão 7, 7.2.3, decisão 7.2.1 opção A: a pessoa cola o ID do
 * número, o ID da conta do WhatsApp Business e o token do usuário do sistema).
 *
 *   conectar → lê o número na Meta com o token (`dadosDoNumero`), confere que é o número do Canal
 *              (`conferirNumeroConectado`), inscreve o app na conta (`subscribed_apps`, para os webhooks chegarem),
 *              guarda a credencial cifrada no cofre (`tipo = "whatsapp-cloud"`, com os dois ids e o token), grava o
 *              número e deixa o Canal `conectada` (não simulado). Aqui não há QR code nem aviso de conexão: quem
 *              confirmou foi a própria Meta, na mesma chamada.
 *   numero   → o número, a conta e o identificador que o Canal tem guardados, para a ficha. Só lê o banco.
 *
 * O token NUNCA volta da API, não vai a log e não entra em nenhum erro: só os ids e o número exibido. Todo pedido à Meta
 * acontece ANTES da transação: a transação só grava, e não fica aberta esperando a rede (como o Instagram e a Evolution).
 *
 * `modelos` e `sincronizar` (7.3): a lista dos modelos de mensagem do Canal e a leitura deles na Meta. Conectar já sincroniza, DEPOIS
 * da transação e sem derrubar a conexão se a Meta falhar naquela leitura (o botão da ficha repete).
 *
 * `concluir` grava como `../instagram/conexao.ts`: numa transação só, a linha do Espaço antes da do Canal, a credencial,
 * o número, a conexão confirmada (`proximaConexao`), a revisão do Espaço e as Mensagens `pendente` do Canal de volta à
 * fila de saída (B69).
 *
 * NÃO conferido contra a Meta real: a conexão de verdade (7.1) é do dono.
 */

import type { Pool, PoolClient } from "pg";
import { conferirNumeroConectado, proximaConexao, type Canal } from "@n1/dominio/crm/canais";
import { modeloNaLista, type ModeloNaLista } from "@n1/dominio/crm/modelos";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { criarRepositorioDeModelosPg } from "../../../repositorios/crm/modelos";
import { avancarRevisaoDoEspaco } from "../../../repositorios/crm/referencias";
import { lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import { exigir, type AcessoAoCrm } from "../../../servicos/crm/acesso";
import { recusa, sucesso, type ResultadoCrm } from "../../../servicos/crm/resultado";
import { comTransacao, type FrasesDeRestricao } from "../../../servicos/crm/transacao";
import { avisarCrm } from "../../avisar";
import { reenfileirarPendentesDoCanal } from "../../fila-de-saida";
import { canalParaProvedor } from "../../registro";
import { criarClienteDaCloudApi, ErroDaCloudApi, type ClienteDaCloudApi } from "./cliente";
import { lerConfiguracaoDaCloudApi, variaveisQueFaltam, type ConfiguracaoDaCloudApi } from "./configuracao";
import { sincronizarModelos, type ResultadoDaSincronizacao } from "./modelos";
import { gravarNumero, guardarCredencialDaCloudApi, lerCredencialDaCloudApi, numeroDoCanal, numeroPeloId } from "./repositorio";

export interface DependenciasDaConexaoDaCloudApi {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  /** Padrão: o ambiente. `undefined` deixa a integração desligada. */
  readonly configuracao?: () => ConfiguracaoDaCloudApi | undefined;
  readonly chaves?: () => ChavesDoCofre;
  /** Testes trocam pelo cliente apontado a um servidor falso. */
  readonly cliente?: (configuracao: ConfiguracaoDaCloudApi) => ClienteDaCloudApi;
}

/** O que a pessoa cola no formulário. O token só passa por aqui para o cofre. */
export interface EntradaDeConexaoDaCloudApi {
  readonly phoneNumberId: string;
  readonly wabaId: string;
  readonly token: string;
}

export interface NumeroParaAFicha {
  readonly phoneNumberId: string;
  readonly wabaId: string;
  readonly numeroExibido: string;
}

export interface ServicoDeConexaoDaCloudApi {
  conectar(membro: MembroDaSessao, canalId: string, entrada: EntradaDeConexaoDaCloudApi): Promise<ResultadoCrm<Canal>>;
  numero(membro: MembroDaSessao, canalId: string): Promise<ResultadoCrm<NumeroParaAFicha>>;
  /** Os modelos de mensagem do Canal (todos os estados, para a ficha mostrar o motivo da rejeição). Um Canal que não é do WhatsApp oficial devolve a lista vazia. */
  modelos(membro: MembroDaSessao, canalId: string): Promise<ResultadoCrm<{ readonly itens: readonly ModeloNaLista[]; readonly total: number }>>;
  /** Lê os modelos na Meta e deixa o Canal com exatamente eles. */
  sincronizar(membro: MembroDaSessao, canalId: string): Promise<ResultadoCrm<ResultadoDaSincronizacao>>;
}

const FRASES: FrasesDeRestricao = {
  whatsapp_cloud_numeros_phone_uq: {
    codigo: "NUMERO_EM_OUTRO_CANAL",
    error: "Este número do WhatsApp já está conectado em outro Canal. Desconecte-o lá antes.",
  },
};

const naoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO" });

const naoEhOficial = () =>
  recusa<never>(409, "Este Canal não é do WhatsApp oficial: ele não se conecta por token da Cloud API.", { codigo: "PROVEDOR_ERRADO" });

function naoConfigurado(detalhe?: string) {
  const faltam = variaveisQueFaltam();
  const quais = detalhe ? ` ${detalhe}` : faltam.length > 0 ? ` Falta no servidor: ${faltam.join(", ")}.` : "";
  return recusa<never>(503, `A integração com o WhatsApp oficial não está configurada neste ambiente.${quais}`, {
    codigo: "WHATSAPP_OFICIAL_NAO_CONFIGURADO",
  });
}

/** O que a Meta disse, sem repetir o token: o cliente só carrega a frase curta dela. */
function recusaDaMeta(erro: unknown) {
  if (erro instanceof ErroDaCloudApi) {
    if (erro.tokenInvalido) {
      return recusa<never>(409, "A Meta recusou o token: ele é inválido, venceu ou não tem acesso a este número. Gere um token novo e tente de novo.", {
        codigo: "TOKEN_RECUSADO",
        campo: "token",
      });
    }
    if (erro.transporte !== undefined) {
      return recusa<never>(502, "Não foi possível falar com o WhatsApp agora. Tente de novo em instantes.", { codigo: "WHATSAPP_INDISPONIVEL" });
    }
    return recusa<never>(502, `O WhatsApp não aceitou o pedido: ${erro.message}`, { codigo: "WHATSAPP_RECUSOU" });
  }
  throw erro;
}

export function criarServicoDeConexaoDaCloudApi(deps: DependenciasDaConexaoDaCloudApi): ServicoDeConexaoDaCloudApi {
  const configuracao = deps.configuracao ?? (() => lerConfiguracaoDaCloudApi());
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const cliente = deps.cliente ?? ((config: ConfiguracaoDaCloudApi) => criarClienteDaCloudApi(config));

  /** A configuração, ou a recusa 503 que diz o que falta ou o que está errado (uma `META_GRAPH_VERSAO` inválida). */
  function configuracaoOuRecusa(): { readonly ok: true; readonly config: ConfiguracaoDaCloudApi } | { readonly ok: false; readonly recusa: ReturnType<typeof naoConfigurado> } {
    try {
      const config = configuracao();
      return config ? { ok: true, config } : { ok: false, recusa: naoConfigurado() };
    } catch (erro) {
      return { ok: false, recusa: naoConfigurado(erro instanceof Error ? erro.message : undefined) };
    }
  }

  /** O Canal do WhatsApp oficial deste Espaço, ou a recusa. */
  async function canalOficial(conexao: Pool | PoolClient, membro: MembroDaSessao, canalId: string, travar = false) {
    const canal = await criarRepositorioDeCanaisPg(conexao).obter(membro.workspaceId, canalId, { travar });
    if (!canal) return naoEncontrado();
    if (canal.provedor !== "whatsapp-cloud") return naoEhOficial();
    return sucesso(canal);
  }

  return {
    async conectar(membro, canalId, entrada) {
      const lida = configuracaoOuRecusa();
      if (!lida.ok) return lida.recusa;
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };

      const achado = await canalOficial(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const pode = proximaConexao(canal, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });

      const whatsapp = cliente(lida.config);
      let numeroExibido: string;
      try {
        ({ numeroExibido } = await whatsapp.dadosDoNumero(entrada.token, entrada.phoneNumberId));
      } catch (erro) {
        return recusaDaMeta(erro);
      }
      // O token e o ID do número precisam ser do número DESTE Canal: sem isso, as mensagens de outro número cairiam aqui.
      if (!conferirNumeroConectado(canal, numeroExibido).ok) {
        return recusa(409, "Este token é de outro número: o número que a Meta devolveu não é o deste Canal.", { codigo: "NUMERO_DIFERENTE", campo: "phoneNumberId" });
      }
      const dono = await numeroPeloId(deps.pool(), entrada.phoneNumberId);
      if (dono && (dono.workspaceId !== membro.workspaceId || dono.canalId !== canal.id)) {
        return recusa(409, FRASES.whatsapp_cloud_numeros_phone_uq!.error, { codigo: "NUMERO_EM_OUTRO_CANAL" });
      }

      try {
        await whatsapp.inscreverApp(entrada.token, entrada.wabaId);
      } catch (erro) {
        return recusaDaMeta(erro);
      }

      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return recusa(503, "O cofre de credenciais não está configurado neste ambiente (COFRE_CHAVE): o token não teria onde ficar.", {
          codigo: "COFRE_NAO_CONFIGURADO",
        });
      }

      const conectado = await comTransacao(
        deps.pool,
        async (transacao) => {
          // A linha do Espaço antes da do Canal: a mesma ordem das outras escritas de Canal (evita `40P01`).
          await transacao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
          const deNovo = await canalOficial(transacao, membro, canal.id, true);
          if (!deNovo.ok) return deNovo;
          const alvo = proximaConexao(deNovo.valor, "conexao_confirmada");
          if (!alvo.ok) return recusa(409, alvo.error, { codigo: "TRANSICAO_INVALIDA" });

          await guardarCredencialDaCloudApi(transacao, cofre, { workspaceId: membro.workspaceId, canalId: canal.id }, {
            phoneNumberId: entrada.phoneNumberId,
            wabaId: entrada.wabaId,
            token: entrada.token,
          });
          await gravarNumero(transacao, {
            workspaceId: membro.workspaceId,
            canalId: canal.id,
            phoneNumberId: entrada.phoneNumberId,
            wabaId: entrada.wabaId,
            numeroExibido,
            conectadoPor: membro.id,
          });
          const conectado = await criarRepositorioDeCanaisPg(transacao).definirConexao(membro.workspaceId, canal.id, alvo.value);
          if (!conectado) return naoEncontrado();
          await avancarRevisaoDoEspaco(transacao, membro.workspaceId);
          await avisarCrm(transacao, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId: canal.id });
          // B69: o que foi escrito com o Canal fora do ar sai agora, no MESMO commit da conexão.
          await reenfileirarPendentesDoCanal(transacao, membro.workspaceId, canal.id);
          return sucesso(conectado);
        },
        FRASES,
      );
      // 7.3.2: ao conectar, já traz os modelos da conta. Depois do commit e sem derrubar a conexão: se a Meta falhar aqui, o
      // Canal está conectado do mesmo jeito e o botão "Sincronizar" da ficha repete.
      if (conectado.ok) {
        try {
          await sincronizarModelos({ pool: deps.pool, cliente: whatsapp }, { workspaceId: membro.workspaceId, canalId: canal.id, token: entrada.token, wabaId: entrada.wabaId });
        } catch {
          // Só a falha da leitura; nada aqui carrega o token nem o corpo da Meta.
        }
      }
      return conectado;
    },

    async numero(membro, canalId) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      const achado = await canalOficial(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const ligado = await numeroDoCanal(deps.pool(), membro.workspaceId, canalId);
      if (!ligado) return recusa(404, "Este Canal não está conectado a um número do WhatsApp oficial.", { codigo: "SEM_NUMERO" });
      return sucesso({ phoneNumberId: ligado.phoneNumberId, wabaId: ligado.wabaId, numeroExibido: ligado.numeroExibido });
    },

    async modelos(membro, canalId) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      const canal = await criarRepositorioDeCanaisPg(deps.pool()).obter(membro.workspaceId, canalId);
      if (!canal) return naoEncontrado();
      // Só o WhatsApp oficial tem modelo: nos outros Canais a lista é vazia, e a ficha não precisa tratar um erro.
      if (canal.provedor !== "whatsapp-cloud") return sucesso({ itens: [], total: 0 });
      const itens = (await criarRepositorioDeModelosPg(deps.pool()).listarDoCanal(membro.workspaceId, canal.id)).map(modeloNaLista);
      return sucesso({ itens, total: itens.length });
    },

    async sincronizar(membro, canalId) {
      const lida = configuracaoOuRecusa();
      if (!lida.ok) return lida.recusa;
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };
      const achado = await canalOficial(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const semConexao = () => recusa<never>(409, "Conecte o Canal antes de sincronizar os modelos.", { codigo: "CANAL_NAO_CONECTADO" });
      if (canal.estado !== "ativo" || canal.conexao !== "conectada" || canal.conexaoSimulada) return semConexao();

      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return recusa(503, "O cofre de credenciais não está configurado neste ambiente (COFRE_CHAVE).", { codigo: "COFRE_NAO_CONFIGURADO" });
      }
      const credencial = lerCredencialDaCloudApi((await canalParaProvedor(deps.pool(), cofre, membro.workspaceId, canal)).credencial);
      if (!credencial) return semConexao();
      try {
        return sucesso(
          await sincronizarModelos({ pool: deps.pool, cliente: cliente(lida.config) }, { workspaceId: membro.workspaceId, canalId: canal.id, token: credencial.token, wabaId: credencial.wabaId }),
        );
      } catch (erro) {
        return recusaDaMeta(erro);
      }
    },
  };
}
