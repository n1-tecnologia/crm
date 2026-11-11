/**
 * O "Conectar" do WhatsApp não oficial pelo CRM (Sessão 4, 4.2.3 e 4.3.3): o que o serviço de Canais chama para criar a
 * instância na Evolution, devolver o QR code e, ao desconectar ou arquivar, tirar o aparelho da sessão de verdade.
 *
 * O desenho, em quatro regras:
 *   1. NADA aqui grava `conectada`. Quem diz que conectou é a Evolution, pelo webhook `connection.update`, e o processador
 *      de entrada confere na fonte (instância aberta e número do Canal) antes de gravar (`conferirConexao`). A única exceção
 *      é a instância que JÁ estava aberta quando a pessoa clicou em "Conectar": aí a mesma conferência roda aqui.
 *   2. Tudo que fala com a Evolution acontece FORA da transação do banco. As escritas de Canal seguram a linha do Espaço e a
 *      do Canal; segurá-las durante 15 s de rede travaria o Espaço inteiro. O que vai ao banco aqui é só o cofre, numa
 *      transação curta, na mesma ordem de travas de `servicos/crm/canais.ts` (Espaço, depois Canal).
 *   3. É IDEMPOTENTE: o painel pede um QR novo a cada ~25 s chamando `conectar` de novo. Instância e credencial existentes
 *      são reaproveitadas (só se pede o QR), e o segredo do webhook NÃO roda a cada chamada (um evento em voo com o segredo
 *      antigo levaria 401). Uma tentativa que parou no meio se conserta sozinha na seguinte.
 *   4. A chave global (`EVOLUTION_API_KEY`) cria e apaga instâncias; ela só vive no ambiente do processo. O CRM só cria e
 *      apaga instância `n1-<espaço>-<canal>` (`ambiente.ts` e o cliente recusam qualquer outra, a do Financeiro inclusive). Uma
 *      instância que o dono ligou à mão (`canal:ligar-evolution`) só ganha "sair da sessão" e nunca é apagada.
 *
 * O token da instância é escolhido pelo CRM (`gerarToken`): a Evolution o aceita no `create` e o usa como a `apikey` da
 * instância, então não dependemos do formato do que ela devolve. Nada aqui loga corpo, QR, número, token nem segredo.
 */

import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { Canal, ConexaoPorQrCode } from "@n1/dominio/crm/canais";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { guardarCredencial, lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import { recusa, sucesso, type ResultadoCrm } from "../../../servicos/crm/resultado";
import { aplicarConexaoAoCanal } from "../../aplicar-conexao";
import { ErroDeProvedor, TIPO_DO_SEGREDO_DO_WEBHOOK, type CanalParaProvedor } from "../../provedor";
import { canalParaProvedor } from "../../registro";
import {
  ehInstanciaDoCrm,
  lerConfiguracaoDaEvolution,
  nomeDaInstanciaDoCanal,
  urlDoWebhookDoCanal,
  type ConfiguracaoDaEvolution,
  type LeituraDaConfiguracao,
} from "./ambiente";
import { criarClienteDaEvolution, ErroDaEvolution, type ClienteDaEvolution } from "./cliente";
import { criarProvedorEvolution, lerCredencialDaEvolution } from "./provedor";

/** O tipo da credencial do Canal no cofre: o nome do provedor (o que `canalParaProvedor` lê). */
const TIPO_DA_CREDENCIAL = "whatsapp-nao-oficial";

export const FRASE_DE_FALHA_DO_WHATSAPP = "Não foi possível falar com o WhatsApp. Tente de novo.";

/** A Evolution não respondeu ao que o CRM pediu antes de gravar: o serviço devolve 502 e NADA é gravado (4.3.3). */
export class FalhaDoProvedor extends Error {
  constructor() {
    super(FRASE_DE_FALHA_DO_WHATSAPP);
    this.name = "FalhaDoProvedor";
  }
}

export interface ConectorDaEvolution {
  /** 4.2.3: põe o Canal para conectar por QR code. A permissão e a transição (`conectar`) já foram conferidas por quem chama. */
  conectar(workspaceId: string, canal: Canal): Promise<ResultadoCrm<ConexaoPorQrCode>>;
  /**
   * 4.3.3: antes de gravar `desconectada` (ou arquivar), tira o aparelho da sessão. No arquivamento apaga também a
   * instância, se ela for do CRM. Lança `FalhaDoProvedor` se a Evolution não responder: nada é gravado e a pessoa tenta de novo.
   */
  desligar(workspaceId: string, canal: Canal, motivo: "desconectar" | "arquivar"): Promise<void>;
}

export interface DependenciasDoConector {
  readonly pool: () => Pool;
  /** Padrão: `lerConfiguracaoDaEvolution()`, lido a cada chamada. */
  readonly configuracao?: () => LeituraDaConfiguracao;
  /** Padrão: `lerChavesDoCofre()`. Lançar aqui é "cofre não configurado". */
  readonly chaves?: () => ChavesDoCofre;
  /** Os testes apontam para o servidor falso. */
  readonly cliente?: (configuracao: Pick<ConfiguracaoDaEvolution, "url">) => ClienteDaEvolution;
  readonly gerarToken?: () => string;
  readonly gerarSegredo?: () => string;
}

const naoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO" });

function naoConfigurado(leitura: Extract<LeituraDaConfiguracao, { ok: false }>) {
  const detalhe = leitura.invalida ?? `Falta no servidor: ${leitura.faltam.join(", ")}.`;
  return recusa<never>(503, `A integração com o WhatsApp não está configurada neste ambiente. ${detalhe}`, { codigo: "EVOLUTION_NAO_CONFIGURADA" });
}

const cofreNaoConfigurado = () =>
  recusa<never>(503, "O cofre de credenciais não está configurado neste ambiente (COFRE_CHAVE): a credencial da instância não teria onde ficar.", {
    codigo: "COFRE_NAO_CONFIGURADO",
  });

/** Uma falha ao falar com a Evolution vira a recusa certa: chave recusada é do servidor (503), o resto é "tente de novo" (502). */
function recusaDaEvolution(erro: unknown): ResultadoCrm<never> {
  // A conferência do provedor (`conferirConexao`) lança isto quando a Evolution não respondeu: é "tente de novo".
  if (erro instanceof ErroDeProvedor) return recusa(502, FRASE_DE_FALHA_DO_WHATSAPP, { codigo: "EVOLUTION_INDISPONIVEL" });
  if (erro instanceof ErroDaEvolution) {
    if (erro.tipo === "http" && (erro.status === 401 || erro.status === 403)) {
      return recusa(503, "A Evolution recusou a chave que o servidor usa (EVOLUTION_API_KEY). Confira o valor com quem administra o servidor.", {
        codigo: "EVOLUTION_CHAVE_RECUSADA",
      });
    }
    return recusa(502, FRASE_DE_FALHA_DO_WHATSAPP, { codigo: "EVOLUTION_INDISPONIVEL" });
  }
  throw erro;
}

function digitos(numero: string): string {
  return numero.replace(/\D/g, "");
}

export function criarConectorDaEvolution(deps: DependenciasDoConector): ConectorDaEvolution {
  const configuracao = deps.configuracao ?? (() => lerConfiguracaoDaEvolution());
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const clienteDe = deps.cliente ?? ((config: Pick<ConfiguracaoDaEvolution, "url">) => criarClienteDaEvolution({ url: config.url }));
  const gerarToken = deps.gerarToken ?? (() => randomBytes(24).toString("hex"));
  const gerarSegredo = deps.gerarSegredo ?? (() => randomBytes(32).toString("hex"));

  /** O cofre, as credenciais e o segredo do webhook do Canal, como o resto da mensageria os lê. */
  async function doCofre(workspaceId: string, canal: Canal, cofre: ChavesDoCofre): Promise<CanalParaProvedor> {
    return canalParaProvedor(deps.pool(), cofre, workspaceId, canal);
  }

  /**
   * Grava no cofre a credencial da instância (e o segredo do webhook, quando é novo), com o Espaço e o Canal travados na
   * mesma ordem das escritas de Canal. O Canal que sumiu ou foi arquivado no meio do caminho recusa: nada fica gravado.
   */
  async function gravarLigacao(
    workspaceId: string,
    canalId: string,
    cofre: ChavesDoCofre,
    ligacao: { readonly instancia: string; readonly token: string; readonly segredo?: string },
  ): Promise<ResultadoCrm<void>> {
    const cliente = await deps.pool().connect();
    try {
      await cliente.query("begin");
      await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [workspaceId]);
      const canal = await criarRepositorioDeCanaisPg(cliente).obter(workspaceId, canalId, { travar: true });
      if (!canal) {
        await cliente.query("rollback");
        return naoEncontrado();
      }
      if (canal.estado === "arquivado") {
        await cliente.query("rollback");
        return recusa(409, "Um Canal arquivado não se conecta.", { codigo: "TRANSICAO_INVALIDA" });
      }
      const dono = { workspaceId, donoTipo: "canal", donoId: canalId } as const;
      if (ligacao.segredo !== undefined) await guardarCredencial(cliente, cofre, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: ligacao.segredo });
      await guardarCredencial(cliente, cofre, {
        ...dono,
        tipo: TIPO_DA_CREDENCIAL,
        segredo: JSON.stringify({ instancia: ligacao.instancia, apikey: ligacao.token }),
      });
      await cliente.query("commit");
      return sucesso(undefined);
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  /** O que `GET /instance/connect` disse, na forma que a rota devolve. A instância já aberta passa pela conferência do número. */
  async function qrcodeOuConexao(
    workspaceId: string,
    canal: Canal,
    config: ConfiguracaoDaEvolution,
    cliente: ClienteDaEvolution,
    credencial: { readonly instancia: string; readonly token: string },
    paraOProvedor: CanalParaProvedor,
  ): Promise<ResultadoCrm<ConexaoPorQrCode>> {
    const numero = digitos(canal.identificadorExterno);
    const estado = await cliente.estadoDaConexao(credencial.token, credencial.instancia);
    if (estado !== "open") {
      const resposta = await cliente.pedirQrCode(credencial.token, credencial.instancia, numero);
      if (resposta.tipo === "qrcode") return sucesso({ situacao: "qrcode", qrcode: resposta.qrcode });
      if (resposta.tipo === "aguardando") return sucesso({ situacao: "aguardando" });
      // `conectada`: abriu entre as duas chamadas. Cai na conferência abaixo.
    }
    // A instância JÁ está aberta (o aparelho foi lido antes, ou o webhook se perdeu): confirma pelo mesmo caminho do webhook.
    const provedor = criarProvedorEvolution({ url: config.url, apikeyGlobal: config.apikeyGlobal });
    const conferida = await provedor.conferirConexao!({ ...paraOProvedor, credencial: JSON.stringify({ instancia: credencial.instancia, apikey: credencial.token }) });
    if (conferida.conexao === "conectada") {
      await aplicarConexaoAoCanal(deps.pool, { workspaceId, canalId: canal.id }, "conectada");
      const atualizado = await criarRepositorioDeCanaisPg(deps.pool()).obter(workspaceId, canal.id);
      return atualizado ? sucesso({ situacao: "conectada", canal: atualizado }) : naoEncontrado();
    }
    if (conferida.conexao === "com_erro" && conferida.motivo === "outro_numero") {
      await aplicarConexaoAoCanal(deps.pool, { workspaceId, canalId: canal.id }, "com_erro", { tentativaFalhada: true });
      return recusa(409, "Este QR code foi lido por outro número. Leia com o celular do número deste Canal.", { codigo: "NUMERO_DIFERENTE" });
    }
    // Não deu para confirmar agora (a instância fechou de novo): pede um QR novo na próxima rodada do painel.
    return sucesso({ situacao: "aguardando" });
  }

  return {
    async conectar(workspaceId, canal) {
      const leitura = configuracao();
      if (!leitura.ok) return naoConfigurado(leitura);
      const config = leitura.configuracao;
      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return cofreNaoConfigurado();
      }
      const cliente = clienteDe(config);
      try {
        const paraOProvedor = await doCofre(workspaceId, canal, cofre);
        const guardada = lerCredencialDaEvolution(paraOProvedor);

        // Uma instância que o Canal já tem e que a Evolution ainda conhece: só se pede o QR (e, se o segredo do webhook
        // sumiu do cofre, ele se refaz; do contrário NÃO roda, para não derrubar evento em voo).
        if (guardada) {
          const existente = await cliente.buscarInstancia(config.apikeyGlobal, guardada.instancia);
          if (existente) {
            if (paraOProvedor.segredoDoWebhook === undefined) {
              const segredo = gerarSegredo();
              await cliente.configurarWebhook(guardada.apikey, guardada.instancia, { url: urlDoWebhookDoCanal(config.urlPublica, canal.id), segredo });
              const gravada = await gravarLigacao(workspaceId, canal.id, cofre, { instancia: guardada.instancia, token: guardada.apikey, segredo });
              if (!gravada.ok) return gravada;
            }
            return await qrcodeOuConexao(workspaceId, canal, config, cliente, { instancia: guardada.instancia, token: guardada.apikey }, paraOProvedor);
          }
        }

        // Instância nova, com o nome do CRM. Um resto de tentativa anterior que parou no meio (a instância existe e o cofre
        // não a conhece) é apagado antes: não temos o token dela, e criar de novo é o caminho limpo. Só instância `n1-`.
        const nome = nomeDaInstanciaDoCanal(workspaceId, canal.id);
        if (ehInstanciaDoCrm(nome) && (await cliente.buscarInstancia(config.apikeyGlobal, nome))) {
          await cliente.apagarInstancia(config.apikeyGlobal, nome);
        }
        const token = gerarToken();
        const segredo = gerarSegredo();
        let criada;
        try {
          criada = await cliente.criarInstancia(config.apikeyGlobal, {
            nome,
            token,
            numero: digitos(canal.identificadorExterno),
            webhook: { url: urlDoWebhookDoCanal(config.urlPublica, canal.id), segredo },
          });
        } catch (erro) {
          // Outra aba criou no mesmo instante (nome em uso): a próxima rodada do painel acha a instância e pede o QR.
          if (erro instanceof ErroDaEvolution && erro.tipo === "http" && (erro.status === 403 || erro.status === 409)) {
            return sucesso({ situacao: "aguardando" });
          }
          throw erro;
        }
        // Só depois de a Evolution aceitar é que o cofre guarda: se a gravação falhar, a instância fica sem dono e a próxima
        // tentativa a apaga e recria (acima). O webhook já aponta para a api com este segredo.
        const gravada = await gravarLigacao(workspaceId, canal.id, cofre, { instancia: nome, token, segredo });
        if (!gravada.ok) return gravada;
        if (criada.qrcode) return sucesso({ situacao: "qrcode", qrcode: criada.qrcode });
        // A Evolution leva alguns segundos para gerar o primeiro QR: a tela pede de novo.
        return sucesso({ situacao: "aguardando" });
      } catch (erro) {
        return recusaDaEvolution(erro);
      }
    },

    async desligar(workspaceId, canal, motivo) {
      // Sem credencial ATIVA o Canal nunca foi ligado (ou já foi esquecido): não há aparelho a tirar. É uma consulta de
      // existência, sem decifrar nada, para não exigir o cofre de quem só quer arquivar um Canal que nunca conectou.
      if (!(await criarRepositorioDeCanaisPg(deps.pool()).ligadoAoProvedor(workspaceId, canal))) return;
      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        throw new FalhaDoProvedor();
      }
      try {
        const paraOProvedor = await doCofre(workspaceId, canal, cofre);
        const guardada = lerCredencialDaEvolution(paraOProvedor);
        // A credencial existe mas não é do formato da Evolution: nada que o CRM saiba desligar.
        if (!guardada) return;
        const leitura = configuracao();
        const cliente = clienteDe(leitura.ok ? leitura.configuracao : { url: process.env.EVOLUTION_URL?.trim() ?? "" });
        // Credencial recusada ou instância que já não existe: a sessão já não é do CRM, e isso não pode travar o Canal.
        const tolerar = (erro: unknown) => {
          if (erro instanceof ErroDaEvolution && erro.tipo === "http" && (erro.status === 401 || erro.status === 403 || erro.status === 404)) return;
          throw erro;
        };
        await cliente.sairDaSessao(guardada.apikey, guardada.instancia).catch(tolerar);
        // Apagar é só no arquivamento, só instância que o CRM criou e só com a chave global (que o CRM tem se conectou por aqui).
        if (motivo === "arquivar" && ehInstanciaDoCrm(guardada.instancia) && leitura.ok) {
          await cliente.apagarInstancia(leitura.configuracao.apikeyGlobal, guardada.instancia).catch(tolerar);
        }
      } catch (erro) {
        if (erro instanceof ErroDaEvolution || erro instanceof FalhaDoProvedor) throw new FalhaDoProvedor();
        throw erro;
      }
    },
  };
}
