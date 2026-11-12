/**
 * Ligar a conta profissional do Instagram a um Canal (Sessão 8, 8.2.2).
 *
 *   iniciar   → a URL da janela de login do Instagram, com um `state` assinado
 *   concluir  → recebe o código e o `state` que a página de retorno da web leu:
 *               troca o código, pega o token de longa duração, lê a conta, confere
 *               que é a do Canal, inscreve a conta no webhook de mensagens, guarda a
 *               credencial cifrada (`tipo = "instagram-graph"`) e deixa o Canal
 *               `conectada` (não simulado)
 *   conta     → o @, o nome e a foto da conta conectada, lidos ao vivo da Meta para
 *               a ficha do Canal (a foto não é guardada: o endereço dela vence)
 *
 * O retorno é da WEB, não da API: o navegador volta logado à página da web, e ela
 * chama `concluir` com o token da sessão. É isso que amarra o `state` à pessoa que
 * começou a conexão (o serviço confere Membro e Espaço do `state`).
 *
 * `concluir` grava como `canal:ligar-evolution` (16-13): numa transação só, a linha do
 * Espaço antes da do Canal, a credencial, a conexão confirmada (`proximaConexao`), a
 * revisão do Espaço e as Mensagens `pendente` do Canal de volta à fila de saída (B69).
 *
 * Todo pedido à Meta acontece ANTES da transação: a transação só grava, e não fica
 * aberta esperando a rede.
 */

import type { Pool, PoolClient } from "pg";
import { contaDoProvedorConfere, proximaConexao, type Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco } from "../../../repositorios/crm/referencias";
import { avisarCrm } from "../../avisar";
import { lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import { exigir, type AcessoAoCrm } from "../../../servicos/crm/acesso";
import { recusa, sucesso, type ResultadoCrm } from "../../../servicos/crm/resultado";
import { comTransacao, type FrasesDeRestricao } from "../../../servicos/crm/transacao";
import { reenfileirarPendentesDoCanal } from "../../fila-de-saida";
import { canalParaProvedor } from "../../registro";
import { criarClienteDoInstagram, ErroDoInstagram, type ClienteDoInstagram } from "./cliente";
import { lerConfiguracaoDoInstagram, variaveisQueFaltam, type ConfiguracaoDoInstagram } from "./configuracao";
import { assinarEstado, lerEstado } from "./estado";
import { contaDoCanal, contaPeloId, gravarConta } from "./repositorio";
import { criarTokensPg, guardarCredencialDoInstagram } from "./token";

export interface DependenciasDoInstagram {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  /** Padrão: o ambiente. `undefined` deixa a integração desligada. */
  readonly configuracao?: () => ConfiguracaoDoInstagram | undefined;
  readonly chaves?: () => ChavesDoCofre;
  /** Testes trocam pelo cliente apontado a um servidor falso. */
  readonly cliente?: (configuracao: ConfiguracaoDoInstagram) => ClienteDoInstagram;
  readonly agora?: () => number;
}

export interface ContaParaAFicha {
  readonly usuario: string;
  readonly nome: string | null;
  readonly fotoUrl: string | null;
}

export interface ServicoDeConexaoDoInstagram {
  iniciar(membro: MembroDaSessao, canalId: string): Promise<ResultadoCrm<{ readonly url: string }>>;
  concluir(membro: MembroDaSessao, entrada: { readonly codigo: string; readonly state: string }): Promise<ResultadoCrm<Canal>>;
  conta(membro: MembroDaSessao, canalId: string): Promise<ResultadoCrm<ContaParaAFicha>>;
}

const FRASES: FrasesDeRestricao = {
  instagram_contas_conta_uq: {
    codigo: "CONTA_EM_OUTRO_CANAL",
    error: "Esta conta do Instagram já está conectada em outro Canal. Desconecte-a lá antes.",
  },
};

const naoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO" });

const naoEhInstagram = () =>
  recusa<never>(409, "Este Canal não é do Instagram: ele não se conecta pelo login do Instagram.", { codigo: "PROVEDOR_ERRADO" });

const estadoInvalido = () =>
  recusa<never>(400, "O pedido de conexão expirou ou não é válido. Comece de novo pelo botão da ficha do Canal.", {
    codigo: "ESTADO_INVALIDO",
  });

const autorizacaoPerdida = (frase: string) => recusa<never>(409, frase, { codigo: "AUTORIZACAO_PERDIDA" });

function naoConfigurado(detalhe?: string) {
  const faltam = variaveisQueFaltam();
  const quais = detalhe ? ` ${detalhe}` : faltam.length > 0 ? ` Falta no servidor: ${faltam.join(", ")}.` : "";
  return recusa<never>(503, `A integração com o Instagram não está configurada neste ambiente.${quais}`, {
    codigo: "INSTAGRAM_NAO_CONFIGURADO",
  });
}

function recusaDoInstagram(erro: unknown) {
  if (erro instanceof ErroDoInstagram) {
    return recusa<never>(502, `O Instagram não aceitou o pedido: ${erro.message}`, { codigo: "INSTAGRAM_RECUSOU" });
  }
  throw erro;
}

export function criarServicoDeConexaoDoInstagram(deps: DependenciasDoInstagram): ServicoDeConexaoDoInstagram {
  const configuracao = deps.configuracao ?? (() => lerConfiguracaoDoInstagram());
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const cliente = deps.cliente ?? ((config: ConfiguracaoDoInstagram) => criarClienteDoInstagram(config));
  const agora = deps.agora ?? Date.now;

  /** A configuração, ou a recusa 503 que diz o que falta ou o que está errado (uma `INSTAGRAM_REDIRECT_URI` inválida). */
  function configuracaoOuRecusa(): { readonly ok: true; readonly config: ConfiguracaoDoInstagram } | { readonly ok: false; readonly recusa: ReturnType<typeof naoConfigurado> } {
    try {
      const config = configuracao();
      return config ? { ok: true, config } : { ok: false, recusa: naoConfigurado() };
    } catch (erro) {
      return { ok: false, recusa: naoConfigurado(erro instanceof Error ? erro.message : undefined) };
    }
  }

  /** O Canal do Instagram deste Espaço, ou a recusa. */
  async function canalDoInstagram(conexao: Pool | PoolClient, membro: MembroDaSessao, canalId: string, travar = false) {
    const canal = await criarRepositorioDeCanaisPg(conexao).obter(membro.workspaceId, canalId, { travar });
    if (!canal) return naoEncontrado();
    if (canal.provedor !== "instagram-graph") return naoEhInstagram();
    return sucesso(canal);
  }

  /** A autorização se perdeu: o Canal fica `com_erro` e a ficha pede para conectar de novo. A mesma ordem de travas das escritas de Canal. */
  async function marcarComErro(membro: MembroDaSessao, canalId: string): Promise<void> {
    await comTransacao(deps.pool, async (transacao) => {
      await transacao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
      const canais = criarRepositorioDeCanaisPg(transacao);
      const canal = await canais.obter(membro.workspaceId, canalId, { travar: true });
      if (canal && canal.estado === "ativo" && canal.conexao === "conectada" && !canal.conexaoSimulada) {
        await canais.definirConexao(membro.workspaceId, canalId, { conexao: "com_erro", conexaoSimulada: false });
        await avancarRevisaoDoEspaco(transacao, membro.workspaceId);
        await avisarCrm(transacao, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId });
      }
      return sucesso(undefined);
    });
  }

  return {
    async iniciar(membro, canalId) {
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };
      const lida = configuracaoOuRecusa();
      if (!lida.ok) return lida.recusa;

      const achado = await canalDoInstagram(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const pode = proximaConexao(achado.valor, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });

      const state = assinarEstado(lida.config.appSecret, { workspaceId: membro.workspaceId, canalId, membroId: membro.id }, agora());
      return sucesso({ url: cliente(lida.config).urlDeAutorizacao(state) });
    },

    async concluir(membro, entrada) {
      const lida = configuracaoOuRecusa();
      if (!lida.ok) return lida.recusa;
      const config = lida.config;
      const estado = lerEstado(config.appSecret, entrada.state, agora());
      // Outro Membro ou outro Espaço: a mesma frase do `state` vencido, sem dizer de quem era.
      if (!estado || estado.workspaceId !== membro.workspaceId || estado.membroId !== membro.id) return estadoInvalido();

      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };

      const achado = await canalDoInstagram(deps.pool(), membro, estado.canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const pode = proximaConexao(canal, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });

      const instagram = cliente(config);
      let autorizacao: { readonly idNoApp: string; readonly token: string; readonly expiraEm: string };
      let conta: Awaited<ReturnType<ClienteDoInstagram["lerConta"]>>;
      try {
        const curto = await instagram.trocarCodigo(entrada.codigo);
        const longo = await instagram.tokenDeLongaDuracao(curto.token);
        autorizacao = { idNoApp: curto.idNoApp, token: longo.token, expiraEm: longo.expiraEm };
        conta = await instagram.lerConta(longo.token);
      } catch (erro) {
        return recusaDoInstagram(erro);
      }

      if (!contaDoProvedorConfere(canal, conta.usuario)) {
        return recusa(
          409,
          `Você entrou como @${conta.usuario}, mas este Canal é da conta @${canal.identificadorExterno}. Entre com @${canal.identificadorExterno}, ou crie outro Canal para @${conta.usuario}.`,
          { codigo: "CONTA_DIFERENTE" },
        );
      }
      const dona = await contaPeloId(deps.pool(), conta.contaId);
      if (dona && (dona.workspaceId !== membro.workspaceId || dona.canalId !== canal.id)) {
        return recusa(409, FRASES.instagram_contas_conta_uq!.error, { codigo: "CONTA_EM_OUTRO_CANAL" });
      }

      try {
        await instagram.inscreverNasMensagens(autorizacao.token);
      } catch (erro) {
        return recusaDoInstagram(erro);
      }

      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return recusa(503, "O cofre de credenciais não está configurado neste ambiente (COFRE_CHAVE): o token não teria onde ficar.", {
          codigo: "COFRE_NAO_CONFIGURADO",
        });
      }

      return comTransacao(
        deps.pool,
        async (transacao) => {
          // A linha do Espaço antes da do Canal: a mesma ordem das outras escritas de Canal (evita `40P01`).
          await transacao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
          const deNovo = await canalDoInstagram(transacao, membro, canal.id, true);
          if (!deNovo.ok) return deNovo;
          const alvo = proximaConexao(deNovo.valor, "conexao_confirmada");
          if (!alvo.ok) return recusa(409, alvo.error, { codigo: "TRANSICAO_INVALIDA" });

          await guardarCredencialDoInstagram(transacao, cofre, { workspaceId: membro.workspaceId, canalId: canal.id }, {
            contaId: conta.contaId,
            token: { token: autorizacao.token, expiraEm: autorizacao.expiraEm },
            agora: agora(),
          });
          await gravarConta(transacao, {
            workspaceId: membro.workspaceId,
            canalId: canal.id,
            contaId: conta.contaId,
            idNoApp: autorizacao.idNoApp,
            usuario: conta.usuario,
            conectadaPor: membro.id,
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
    },

    async conta(membro, canalId) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      const lida = configuracaoOuRecusa();
      if (!lida.ok) return lida.recusa;
      const achado = await canalDoInstagram(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const ligada = await contaDoCanal(deps.pool(), membro.workspaceId, canalId);
      if (!ligada) return recusa(404, "Este Canal não está conectado a uma conta do Instagram.", { codigo: "SEM_CONTA" });

      const instagram = cliente(lida.config);
      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return sucesso({ usuario: ligada.usuario, nome: null, fotoUrl: null });
      }
      const paraOProvedor = await canalParaProvedor(deps.pool(), cofre, membro.workspaceId, achado.valor);
      const token = await criarTokensPg({ pool: deps.pool, chaves: () => cofre, cliente: instagram, agora }).tokenParaUsar(paraOProvedor);
      if (!token.ok) {
        await marcarComErro(membro, canalId);
        return autorizacaoPerdida(token.motivo);
      }
      try {
        const lidaNaMeta = await instagram.lerConta(token.token);
        return sucesso({ usuario: lidaNaMeta.usuario, nome: lidaNaMeta.nome ?? null, fotoUrl: lidaNaMeta.fotoUrl ?? null });
      } catch (erro) {
        if (erro instanceof ErroDoInstagram && erro.tokenInvalido) {
          await marcarComErro(membro, canalId);
          return autorizacaoPerdida("A autorização do Instagram foi retirada: conecte o Canal de novo.");
        }
        // Sem a Meta, a ficha ainda mostra o @ guardado.
        return sucesso({ usuario: ligada.usuario, nome: null, fotoUrl: null });
      }
    },
  };
}
