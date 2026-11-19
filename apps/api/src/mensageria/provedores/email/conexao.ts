/**
 * Ligar uma caixa de e-mail a um Canal por senha ou senha de app (Fase 17, 17-05, EML-01, D-17-03).
 *
 *   conectarPorSenha → abre o IMAP e o SMTP pela fábrica (a guarda de rede de D-17-07 vale em toda abertura) e SÓ COM OS
 *                      DOIS DE PÉ grava, numa transação: a credencial no cofre, a conta, o cursor da INBOX no `UIDNEXT`
 *                      daquele momento (D-17-08: o que já está na caixa fica para trás) e o Canal `conectada` (não
 *                      simulado). As Mensagens `pendente` do Canal voltam à fila de saída no mesmo commit (B69)
 *   conta            → o que a ficha mostra: endereço, tipo de login, servidores, o motivo da queda e quais botões de
 *                      login (Google, Microsoft) o servidor tem. Nunca a senha, o usuário nem token
 *
 * Todo pedido à rede acontece ANTES da transação: a transação só grava e não fica aberta esperando um servidor lento
 * (T-17-23). O IMAP é testado primeiro; se ele falha, o SMTP nem é tentado (a pessoa corrige um de cada vez).
 *
 * A senha entra uma vez, no corpo, e daqui só vai à fábrica e ao cofre. Nada aqui chama registro, e a frase de toda recusa
 * vem de `classificarErroDeConexao` (frase fixa; o texto do servidor só depois de ele autenticar, filtrado) (T-17-19).
 * O login do Google e da Microsoft (17-12 e 17-13) reaproveita este núcleo: verificar, depois gravar numa transação:
 *
 *   autorizar → a URL do login do serviço, com `state` assinado (Membro, Espaço, Canal, serviço, 10 min) e PKCE S256 (D-17-04)
 *   concluir  → a volta, pela sessão de quem pediu: confere o `state`, troca o código, PROVA que a conta é a da caixa abrindo
 *               IMAP e SMTP por XOAUTH2 com `user` = o endereço do Canal (o `id_token` só pré-confere a frase: ele é mutável,
 *               A9/A11) e só então grava, pelo mesmo núcleo da senha. Nada do código nem dos tokens vai a log, resposta ou erro
 */

import type { Pool, PoolClient } from "pg";
import { contaDoProvedorConfere, proximaConexao, type Canal } from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco } from "../../../repositorios/crm/referencias";
import { lerChavesDoCofre, lerCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import { exigir, type AcessoAoCrm } from "../../../servicos/crm/acesso";
import { recusa, sucesso, type ResultadoCrm } from "../../../servicos/crm/resultado";
import { comTransacao, type FrasesDeRestricao } from "../../../servicos/crm/transacao";
import { avisarCrm } from "../../avisar";
import { reenfileirarPendentesDoCanal } from "../../fila-de-saida";
import {
  PREDEFINICOES_DE_SERVIDOR,
  lerConfiguracaoDoOauth,
  servicosDaConfiguracao,
  variaveisQueFaltam,
  type ConfiguracaoDoOauth,
  type EnderecoDeServidor,
  type PredefinicaoDeServidor,
  type ServicoDeLogin,
  type ServicosDisponiveis,
  type ServidoresDaConta,
} from "./configuracao";
import { TIPO_DA_CREDENCIAL, guardarCredencialDoEmail, lerCredencialDoEmail, type CredencialDoEmail } from "./credencial";
import { classificarErroDeConexao, type FalhaDeConexao } from "./erros";
import { criarFabricaDeConexao, type FabricaDeConexao, type ResultadoDaVerificacaoImap } from "./fabrica-de-conexao";
import { ErroDoLogin } from "./oauth/comum";
import type { ServicoDeEmail } from "./rede";
import { emitirEstadoDoEmail, lerEstadoDoEmail, desafioPkce, verificadorPkce } from "./estado";
import { CLIENTES_DE_PRODUCAO, type FabricasDeClienteOauth } from "./token";
import { contaDoCanal, gravarConta, gravarCursor, limparQueda, type TipoDeLoginDoEmail } from "./repositorio";

export interface DependenciasDoEmail {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  /** Padrão: a fábrica de produção (guarda de rede, portas 993/143/465/587, certificado sempre conferido). Testes injetam a do dublê. */
  readonly fabrica?: FabricaDeConexao;
  readonly chaves?: () => ChavesDoCofre;
  /** Padrão: o ambiente. `undefined` deixa o login do Google e da Microsoft desligado. */
  readonly configuracaoDoOauth?: () => ConfiguracaoDoOauth | undefined;
  /** Padrão: o cliente de cada serviço contra os endereços reais. Testes injetam clientes que falam com um servidor de login falso. */
  readonly clientesOauth?: FabricasDeClienteOauth;
  /** Padrão: as predefinições do servidor (Microsoft: Outlook; Google: Gmail). Testes trocam pelo dublê de IMAP e SMTP, nunca por variável. */
  readonly servidoresDoLogin?: Partial<Record<ServicoDeLogin, ServidoresDaConta>>;
  /** Só para dizer o que falta quando a configuração inteira está ausente. */
  readonly ambiente?: () => NodeJS.ProcessEnv;
  readonly agora?: () => number;
}

export interface EntradaDeSenha {
  readonly usuario: string;
  readonly senha: string;
  /** O servidor escolhe o host e a porta; o cliente só diz o nome. */
  readonly predefinicao?: PredefinicaoDeServidor;
  readonly imap?: EnderecoDeServidor;
  readonly smtp?: EnderecoDeServidor;
}

export interface ContaParaAFichaDoEmail {
  readonly endereco: string;
  readonly tipoDeLogin: TipoDeLoginDoEmail;
  readonly imap: EnderecoDeServidor;
  readonly smtp: EnderecoDeServidor;
  readonly conectadaEm: string;
  readonly motivoDaQueda: string | null;
  readonly caiuEm: string | null;
}

export interface EntradaDaConclusao {
  /** O código de autorização que o serviço devolveu à página de retorno da web. Nunca vai a log. */
  readonly codigo: string;
  readonly state: string;
}

export interface ServicoDeConexaoDoEmail {
  autorizar(membro: MembroDaSessao, canalId: string, servico: ServicoDeLogin): Promise<ResultadoCrm<{ readonly url: string }>>;
  concluir(membro: MembroDaSessao, entrada: EntradaDaConclusao): Promise<ResultadoCrm<Canal>>;
  conectarPorSenha(membro: MembroDaSessao, canalId: string, entrada: EntradaDeSenha): Promise<ResultadoCrm<Canal>>;
  conta(
    membro: MembroDaSessao,
    canalId: string,
  ): Promise<ResultadoCrm<{ readonly conta: ContaParaAFichaDoEmail | null; readonly servicosDisponiveis: ServicosDisponiveis }>>;
}

const FRASES: FrasesDeRestricao = {};

const PROVEDOR = "email-imap-smtp";

const naoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO" });

const naoEhEmail = () => recusa<never>(409, "Este Canal não é de e-mail.", { codigo: "PROVEDOR_ERRADO" });

const semServidores = () =>
  recusa<never>(422, "Escolha Gmail ou Outlook, ou informe o servidor IMAP e o SMTP.", { codigo: "SERVIDORES_AUSENTES" });

const semCofre = () =>
  recusa<never>(503, "O cofre de credenciais não está configurado neste ambiente (COFRE_CHAVE): a senha não teria onde ficar.", {
    codigo: "COFRE_NAO_CONFIGURADO",
  });

const estadoInvalido = () =>
  recusa<never>(400, "O pedido de conexão expirou ou não é válido. Comece de novo pelo botão da ficha do Canal.", { codigo: "ESTADO_INVALIDO" });

const NOMES_DOS_SERVICOS: Readonly<Record<ServicoDeLogin, string>> = { google: "o Google", microsoft: "a Microsoft" };

/** O login do serviço não está de pé neste servidor: diz o NOME das variáveis que faltam, nunca valores. */
const oauthNaoConfigurado = (frase: string) => recusa<never>(503, frase, { codigo: "EMAIL_OAUTH_NAO_CONFIGURADO" });

const FRASES_DO_ERRO_DO_LOGIN = {
  CONSENTIMENTO_DO_ADMINISTRADOR: () => recusa<never>(409, "A sua organização exige que um administrador aprove o aplicativo antes de você entrar.", { codigo: "CONSENTIMENTO_DO_ADMINISTRADOR" }),
  LOGIN_RECUSADO: (servico: ServicoDeLogin) =>
    recusa<never>(422, `Não foi possível concluir o login com ${NOMES_DOS_SERVICOS[servico]}. Comece de novo pelo botão da ficha do Canal.`, { codigo: "LOGIN_RECUSADO" }),
  SERVICO_FORA: (servico: ServicoDeLogin) =>
    recusa<never>(502, `Não foi possível falar com ${NOMES_DOS_SERVICOS[servico]} agora. Tente de novo em instantes.`, { codigo: "SERVICO_DE_LOGIN_FORA" }),
} as const;

/**
 * O que o serviço de Canais pede ao e-mail ao desconectar e arquivar (D-17-06): tirar o acesso no serviço de login, ANTES da
 * transação (é rede). Fica separado do serviço de conexão porque o serviço de Canais só precisa disto, e os testes o trocam
 * por um falso (molde do `whatsappNaoOficial`).
 */
export interface ConectorDoEmail {
  /** Melhor esforço: NUNCA rejeita e nunca registra o token. Só o Canal conectado pelo Google pede algo à rede. */
  revogar(workspaceId: string, canal: Canal): Promise<void>;
}

export interface DependenciasDoConectorDoEmail {
  readonly pool: () => Pool;
  /** Padrão: o cofre do ambiente. */
  readonly chaves?: () => ChavesDoCofre;
  /** Padrão: o cliente de cada serviço contra os endereços reais. Testes injetam clientes que falam com um servidor de login falso. */
  readonly clientes?: FabricasDeClienteOauth;
  /** Padrão: o ambiente. Sem o par do Google configurado não há cliente para revogar. */
  readonly configuracaoDoOauth?: () => ConfiguracaoDoOauth | undefined;
}

/**
 * Só o Canal `oauth` do Google revoga: o de senha não tem token, e a Microsoft não tem endpoint de revogação por token (A9: ela só
 * se apaga localmente, o que o esquecimento do 17-05 faz). Toda falha (cofre, rede, Google recusando, configuração ausente) vira
 * só uma contagem: a conta e a credencial locais saem do mesmo jeito, na transação do serviço de Canais.
 */
export function criarConectorDoEmail(deps: DependenciasDoConectorDoEmail): ConectorDoEmail & { falhasDeRevogacao(): number } {
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const clientes = deps.clientes ?? CLIENTES_DE_PRODUCAO;
  const configuracao =
    deps.configuracaoDoOauth ??
    (() => {
      try {
        return lerConfiguracaoDoOauth();
      } catch {
        return undefined;
      }
    });
  let falhas = 0;

  return {
    falhasDeRevogacao: () => falhas,
    async revogar(workspaceId, canal) {
      try {
        if (canal.provedor !== PROVEDOR) return;
        const guardada = await lerCredencial(deps.pool(), chaves(), { workspaceId, donoTipo: "canal", donoId: canal.id, tipo: TIPO_DA_CREDENCIAL });
        const credencial = lerCredencialDoEmail(guardada);
        if (credencial?.tipo !== "oauth" || credencial.servico !== "google") return;
        const config = configuracao();
        const app = config?.google;
        const fabrica = clientes.google;
        // A revogação não usa o segredo do app, mas o cliente é montado como os outros; sem o par configurado, não há o que montar.
        if (!config || !app || !fabrica) {
          falhas += 1;
          return;
        }
        await fabrica({ ...app, redirectUri: config.redirectUri }).revogar?.(credencial.refreshToken);
      } catch {
        // A causa pode carregar o token e a URL: nada dela é registrado. Só a contagem.
        falhas += 1;
      }
    },
  };
}

const FORMA_DE_ENDERECO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `googlemail.com` é a mesma caixa de `gmail.com` (T-17-59). Só vale para o Google; a Microsoft compara pela forma do Canal. */
const comoGmail = (endereco: string) => endereco.trim().toLowerCase().replace(/@googlemail\.com$/, "@gmail.com");

/** O endereço que o serviço informou é o do Canal? Só pré-conferência: a prova é o XOAUTH2 com o endereço do Canal. */
function mesmaCaixa(canal: Canal, informado: string, servico: ServicoDeLogin): boolean {
  if (servico !== "google") return contaDoProvedorConfere(canal, informado);
  return contaDoProvedorConfere({ tipo: canal.tipo, identificadorExterno: comoGmail(canal.identificadorExterno) }, comoGmail(informado));
}

/** A recusa que a tela mostra: a frase fixa da classificação, e o que o servidor disse só se ele chegou a autenticar. */
function recusaDeConexao(falha: FalhaDeConexao) {
  const frase = falha.fraseDoServidor ? `${falha.frase} O servidor respondeu: ${falha.fraseDoServidor}` : falha.frase;
  return recusa<never>(422, frase, { codigo: "CONEXAO_RECUSADA", campo: falha.servico });
}

export function criarServicoDeConexaoDoEmail(deps: DependenciasDoEmail): ServicoDeConexaoDoEmail {
  const fabrica = deps.fabrica ?? criarFabricaDeConexao();
  const chaves = deps.chaves ?? (() => lerChavesDoCofre());
  const configuracaoDoOauth =
    deps.configuracaoDoOauth ??
    (() => {
      try {
        return lerConfiguracaoDoOauth();
      } catch {
        // Uma URI de retorno inválida desliga o login; a conexão por senha segue de pé.
        return undefined;
      }
    });

  /** O Canal de e-mail deste Espaço, ou a recusa. */
  async function canalDeEmail(conexao: Pool | PoolClient, membro: MembroDaSessao, canalId: string, travar = false) {
    const canal = await criarRepositorioDeCanaisPg(conexao).obter(membro.workspaceId, canalId, { travar });
    if (!canal) return naoEncontrado();
    if (canal.provedor !== PROVEDOR) return naoEhEmail();
    return sucesso(canal);
  }

  /** Os servidores da conta: a predefinição do SERVIDOR, ou os que a pessoa digitou (a guarda decide se servem). */
  function servidoresDe(entrada: EntradaDeSenha): { readonly imap: EnderecoDeServidor; readonly smtp: EnderecoDeServidor } | undefined {
    if (entrada.predefinicao !== undefined) return PREDEFINICOES_DE_SERVIDOR[entrada.predefinicao];
    if (entrada.imap && entrada.smtp) return { imap: entrada.imap, smtp: entrada.smtp };
    return undefined;
  }

  /** Abre, autentica e fecha. Sem exceção: a falha vira a frase de produto, com o campo (`imap` ou `smtp`) que a causou. */
  async function verificarComSegredos<T>(servico: ServicoDeEmail, segredos: readonly string[], abrir: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; falha: FalhaDeConexao }> {
    try {
      return { ok: true, valor: await abrir() };
    } catch (erro) {
      return { ok: false, falha: classificarErroDeConexao(erro, servico, segredos) };
    }
  }
  const verificar = <T>(servico: ServicoDeEmail, senha: string, abrir: () => Promise<T>) => verificarComSegredos<T>(servico, [senha], abrir);

  /**
   * O núcleo da conexão, o mesmo da senha e do login: DEPOIS de a rede ter provado a caixa, grava numa transação a credencial no
   * cofre, a conta, o cursor da INBOX no `UIDNEXT` daquele momento (D-17-08), o Canal `conectada` e a revisão do Espaço, e
   * devolve à fila de saída o que esperava (B69).
   */
  async function gravarEConectar(
    membro: MembroDaSessao,
    canal: Canal,
    cofre: ChavesDoCofre,
    a: {
      readonly credencial: CredencialDoEmail;
      readonly tipoDeLogin: TipoDeLoginDoEmail;
      readonly servidores: ServidoresDaConta;
      readonly lido: ResultadoDaVerificacaoImap;
      readonly contaExternaId?: string;
    },
  ): Promise<ResultadoCrm<Canal>> {
    return comTransacao(
      deps.pool,
      async (transacao) => {
        // A linha do Espaço antes da do Canal: a mesma ordem das outras escritas de Canal (evita `40P01`).
        await transacao.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
        const deNovo = await canalDeEmail(transacao, membro, canal.id, true);
        if (!deNovo.ok) return deNovo;
        const alvo = proximaConexao(deNovo.valor, "conexao_confirmada");
        if (!alvo.ok) return recusa(409, alvo.error, { codigo: "TRANSICAO_INVALIDA" });

        const dono = { workspaceId: membro.workspaceId, canalId: canal.id };
        await guardarCredencialDoEmail(transacao, cofre, dono, a.credencial);
        await gravarConta(transacao, {
          ...dono,
          // A conta é a do Canal: o endereço que a pessoa criou o Canal para receber.
          endereco: deNovo.valor.identificadorExterno,
          tipoDeLogin: a.tipoDeLogin,
          imap: a.servidores.imap,
          smtp: a.servidores.smtp,
          ...(a.contaExternaId !== undefined ? { contaExternaId: a.contaExternaId } : {}),
          pastaEnviados: a.lido.pastaEnviados ?? null,
          conectadaPor: membro.id,
        });
        await limparQueda(transacao, membro.workspaceId, canal.id);
        // D-17-08: o leitor começa no que chegar DEPOIS de agora; o que já estava na caixa não vira Conversa.
        await gravarCursor(transacao, membro.workspaceId, canal.id, {
          pasta: "INBOX",
          uidValidity: a.lido.uidValidity,
          proximoUid: a.lido.uidNext,
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
  }

  const clientes = deps.clientesOauth ?? CLIENTES_DE_PRODUCAO;
  const agora = deps.agora ?? Date.now;
  const ambiente = deps.ambiente ?? (() => process.env);

  /**
   * Os `state` já usados, por nonce, até vencerem: o `state` vale UMA vez neste processo (depois de conferido o Membro e o Espaço,
   * antes de o código ser trocado). É defesa em profundidade: o código de autorização é de uso único no serviço, o PKCE amarra o
   * código ao servidor e o Canal já conectado não muda de novo; o que não se sustenta sem tabela é o uso único ENTRE processos.
   */
  const estadosUsados = new Map<string, number>();
  function consumirEstado(nonce: string, expiraEm: number): boolean {
    const instante = agora();
    for (const [chave, vence] of estadosUsados) if (vence < instante) estadosUsados.delete(chave);
    if (estadosUsados.has(nonce)) return false;
    estadosUsados.set(nonce, expiraEm);
    return true;
  }

  /** A configuração do serviço, ou a recusa 503 que diz o que falta (os nomes das variáveis, nunca valores). */
  function appDoServico(servico: ServicoDeLogin) {
    const config = configuracaoDoOauth();
    const app = config?.[servico];
    const fabrica = clientes[servico];
    if (config && app && fabrica) return { ok: true as const, config, app, fabrica };
    if (config && app) return { ok: false as const, recusa: oauthNaoConfigurado(`O login com ${NOMES_DOS_SERVICOS[servico]} ainda não está disponível neste servidor.`) };
    const nomes = config
      ? servico === "google"
        ? ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"]
        : ["MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET"]
      : variaveisQueFaltam(servico, ambiente());
    const frase =
      nomes.length > 0
        ? `Falta no servidor: ${nomes.join(", ")}.`
        : "A configuração do login deste serviço está inválida: confira EMAIL_OAUTH_REDIRECT_URI.";
    return { ok: false as const, recusa: oauthNaoConfigurado(frase) };
  }

  return {
    async autorizar(membro, canalId, servico) {
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };
      const lida = appDoServico(servico);
      if (!lida.ok) return lida.recusa;

      const achado = await canalDeEmail(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const pode = proximaConexao(canal, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });
      // O cofre antes do login: a pessoa não deve entrar no serviço para descobrir depois que o token não teria onde ficar.
      try {
        chaves();
      } catch {
        return semCofre();
      }

      const { state, nonce } = emitirEstadoDoEmail(
        lida.app.clientSecret,
        { workspaceId: membro.workspaceId, canalId: canal.id, membroId: membro.id, servico },
        agora(),
      );
      const desafio = desafioPkce(verificadorPkce(lida.app.clientSecret, nonce));
      const cliente = lida.fabrica({ ...lida.app, redirectUri: lida.config.redirectUri });
      return sucesso({ url: cliente.urlDeAutorizacao({ state, desafio, loginHint: canal.identificadorExterno }) });
    },

    async concluir(membro, entrada) {
      const config = configuracaoDoOauth();
      if (!config) return oauthNaoConfigurado("O login por Google ou Microsoft não está configurado neste servidor.");
      const estado = lerEstadoDoEmail((s) => config[s]?.clientSecret, entrada.state, agora());
      // Outro Membro ou outro Espaço: a mesma frase do `state` vencido, sem dizer de quem era.
      if (!estado || estado.workspaceId !== membro.workspaceId || estado.membroId !== membro.id) return estadoInvalido();
      // Depois de conferir de quem é: quem tem um `state` alheio não o queima. Vale uma vez.
      if (!consumirEstado(estado.nonce, estado.expiraEm)) return estadoInvalido();
      const servico = estado.servico;
      const lida = appDoServico(servico);
      if (!lida.ok) return lida.recusa;

      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };
      const achado = await canalDeEmail(deps.pool(), membro, estado.canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const pode = proximaConexao(canal, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });

      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return semCofre();
      }

      const cliente = lida.fabrica({ ...lida.app, redirectUri: lida.config.redirectUri });
      let tokens: Awaited<ReturnType<typeof cliente.trocarCodigo>>;
      try {
        tokens = await cliente.trocarCodigo(entrada.codigo, verificadorPkce(lida.app.clientSecret, estado.nonce));
      } catch (erro) {
        if (erro instanceof ErroDoLogin) {
          if (erro.codigo === "CONSENTIMENTO_DO_ADMINISTRADOR") return FRASES_DO_ERRO_DO_LOGIN.CONSENTIMENTO_DO_ADMINISTRADOR();
          if (erro.codigo === "LOGIN_RECUSADO") return FRASES_DO_ERRO_DO_LOGIN.LOGIN_RECUSADO(servico);
        }
        // Qualquer outra falha (o serviço fora do ar, uma exceção de rede) é a mesma frase, sem a causa.
        return FRASES_DO_ERRO_DO_LOGIN.SERVICO_FORA(servico);
      }
      const segredos = [entrada.codigo, tokens.accessToken, tokens.refreshToken];

      // Só pré-conferência: o endereço do `id_token` é mutável e "não garantido" (A9, A11). A prova é o login na caixa, abaixo.
      const informado = tokens.conta.email;
      // Google (EML-02): o endereço do `id_token` só vale com `email_verified` verdadeiro; sem isso, outra pessoa poderia ter
      // criado uma conta com o endereço dos outros. A ausência do campo conta como não verificado.
      if (servico === "google" && informado !== undefined && FORMA_DE_ENDERECO.test(informado) && tokens.conta.emailVerificado !== true) {
        return recusa(409, `O Google não confirmou o endereço ${informado}. Entre com a conta da própria caixa, ${canal.identificadorExterno}.`, {
          codigo: "CONTA_DIFERENTE",
        });
      }
      if (informado !== undefined && FORMA_DE_ENDERECO.test(informado) && !mesmaCaixa(canal, informado, servico)) {
        return recusa(409, `Você entrou com ${informado}, mas este Canal é da caixa ${canal.identificadorExterno}. Entre com a conta da própria caixa.`, {
          codigo: "CONTA_DIFERENTE",
        });
      }

      // A PROVA da caixa: XOAUTH2 com `user` = o endereço do Canal, no IMAP e no SMTP, ANTES de gravar. Um token de outra caixa é
      // recusado pelo servidor. A rede fica FORA da transação.
      const servidores = deps.servidoresDoLogin?.[servico] ?? (servico === "microsoft" ? PREDEFINICOES_DE_SERVIDOR.outlook : PREDEFINICOES_DE_SERVIDOR.gmail);
      const auth = { tipo: "oauth" as const, usuario: canal.identificadorExterno, accessToken: tokens.accessToken, expiraEm: tokens.expiraEm };
      const contaDiferente = () =>
        recusa<never>(
          409,
          `A conta que entrou não tem acesso à caixa ${canal.identificadorExterno}. Entre com a conta da própria caixa e confira se o IMAP e o SMTP autenticado estão ligados para ela.`,
          { codigo: "CONTA_DIFERENTE" },
        );
      const falhou = (falha: FalhaDeConexao) => (falha.tipo === "recusou_login" ? contaDiferente() : recusaDeConexao(falha));

      const imap = await verificarComSegredos<ResultadoDaVerificacaoImap>("imap", segredos, () =>
        fabrica.verificarImap({ host: servidores.imap.host, porta: servidores.imap.porta, auth }),
      );
      if (!imap.ok) return falhou(imap.falha);
      const smtp = await verificarComSegredos<void>("smtp", segredos, () =>
        fabrica.verificarSmtp({ host: servidores.smtp.host, porta: servidores.smtp.porta, auth }),
      );
      if (!smtp.ok) return falhou(smtp.falha);

      return gravarEConectar(membro, canal, cofre, {
        credencial: {
          v: 1,
          tipo: "oauth",
          servico,
          usuario: canal.identificadorExterno,
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
          expiraEm: tokens.expiraEm,
        },
        tipoDeLogin: servico,
        servidores,
        lido: imap.valor,
        ...(tokens.conta.idEstavel !== undefined ? { contaExternaId: tokens.conta.idEstavel } : {}),
      });
    },

    async conectarPorSenha(membro, canalId, entrada) {
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };

      const achado = await canalDeEmail(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;
      const canal = achado.valor;
      const pode = proximaConexao(canal, "conexao_confirmada");
      if (!pode.ok) return recusa(409, pode.error, { codigo: "TRANSICAO_INVALIDA" });

      const servidores = servidoresDe(entrada);
      if (!servidores) return semServidores();

      // O cofre antes da rede: sem ele não há onde guardar a senha, e não se abre conexão à toa.
      let cofre: ChavesDoCofre;
      try {
        cofre = chaves();
      } catch {
        return semCofre();
      }

      const auth = { tipo: "senha" as const, usuario: entrada.usuario, senha: entrada.senha };

      // A rede, FORA da transação. O IMAP primeiro: se ele falha, o SMTP nem é tentado.
      const imap = await verificar<ResultadoDaVerificacaoImap>("imap", entrada.senha, () =>
        fabrica.verificarImap({ host: servidores.imap.host, porta: servidores.imap.porta, auth }),
      );
      if (!imap.ok) return recusaDeConexao(imap.falha);
      const smtp = await verificar<void>("smtp", entrada.senha, () =>
        fabrica.verificarSmtp({ host: servidores.smtp.host, porta: servidores.smtp.porta, auth }),
      );
      if (!smtp.ok) return recusaDeConexao(smtp.falha);

      return gravarEConectar(membro, canal, cofre, {
        credencial: { v: 1, tipo: "senha", usuario: entrada.usuario, senha: entrada.senha },
        tipoDeLogin: "senha",
        servidores,
        lido: imap.valor,
      });
    },

    async conta(membro, canalId) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      const achado = await canalDeEmail(deps.pool(), membro, canalId);
      if (!achado.ok) return achado;

      const ligada = await contaDoCanal(deps.pool(), membro.workspaceId, canalId);
      const servicosDisponiveis = servicosDaConfiguracao(configuracaoDoOauth());
      // Só o que a ficha mostra: `contaExternaId`, `conectadaPor` e o resto da linha ficam no banco.
      return sucesso({
        conta: ligada
          ? {
              endereco: ligada.endereco,
              tipoDeLogin: ligada.tipoDeLogin,
              imap: ligada.imap,
              smtp: ligada.smtp,
              conectadaEm: ligada.conectadaEm,
              motivoDaQueda: ligada.motivoDaQueda,
              caiuEm: ligada.caiuEm,
            }
          : null,
        servicosDisponiveis,
      });
    },
  };
}
