/**
 * Serviço de Canais: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (T-08-01, T-08-02). O Canal não tem Proprietário
 * (B35): `configuradoPor` é o Membro da sessão, e só.
 *
 * Criar exige Administrador ou Proprietário (B35) ANTES de abrir a transação:
 * `exigir(..., "criar", "canal")`. Ler é de todos. O tipo vem do provedor, no
 * domínio; o Canal nasce `desconectada` (D-08) porque o repositório não envia
 * `conexao`.
 *
 * O SQLSTATE traduzido por `FRASES` é a rede contra a corrida de nome e conta
 * (RN-CXE-31, INV-CXE-01); a frase não carrega o nome do constraint (T-08-04).
 *
 * 08-03 completa o recurso:
 *   - a pré-checagem rica de nome e conta em `plataforma.canais`, com
 *     `bloqueios.canais` apontando o detentor (o `channels` do seed deixou de
 *     contar no 15-33: o Canal só existe na tabela);
 *   - Fila e Origem padrão validadas contra o Espaço (D-07);
 *   - a conexão em dois atos sem provedor (D-08): a decisão da transição é do
 *     domínio (`proximaConexao`), o serviço só a grava;
 *   - arquivar desconectando na mesma escrita (11.1);
 *   - a revisão do Espaço somada na mesma transação de toda escrita (A4).
 *   - 16-06: o Canal que volta a `conectada` reenfileira, na mesma transação, as Mensagens `pendente` dele
 *     (`reenfileirarPendentesDoCanal`).
 *   - CR-01 (16-17): "Simular conexão" recusa (409 `TRANSICAO_INVALIDA`) o Canal com credencial ativa do próprio provedor
 *     no cofre, antes de qualquer escrita; o fato é lido depois do `for update` do Canal, na mesma transação.
 * Toda escrita trava a linha do Espaço e, só depois, carrega o Canal travado (`for update`) NESTE Espaço: id de
 * outro Espaço é 404, nunca 403 (T-08-13).
 *
 * Sessão 4 (WhatsApp não oficial): `conectar` pede o QR code à Evolution (`ConectorDaEvolution`) e NUNCA grava `conectada`.
 * `desconectar` e `arquivar` tiram o aparelho da sessão ANTES de abrir a transação: a Evolution é rede, e a transação segura
 * a linha do Espaço e a do Canal. Se ela não responde, nada é gravado (502). A simulação de conexão só vale onde
 * `PERMITIR_CONEXAO_SIMULADA=true` (4.3.4: desenvolvimento, testes e homologação, nunca produção).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import {
  conectaPorQrCode,
  proximaConexao,
  validarArquivamento,
  validarEdicaoDeCanal,
  validarNovoCanal,
  type AcaoDeConexao,
  type Canal,
  type CanalNaFicha,
  type ConexaoPorQrCode,
  type EdicaoDeCanal,
  type FiltroDeCanais,
  type NovoCanal,
} from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { reenfileirarPendentesDoCanal } from "../../mensageria/fila-de-saida";
import { FalhaDoProvedor, FRASE_DE_FALHA_DO_WHATSAPP, type ConectorDaEvolution } from "../../mensageria/provedores/evolution/conexao";
import { esquecerCredenciaisDaEvolution } from "../../mensageria/provedores/evolution/repositorio";
import { esquecerConta } from "../../mensageria/provedores/instagram/repositorio";
import { esquecerNumero } from "../../mensageria/provedores/whatsapp-cloud/repositorio";
import { criarRepositorioDeCanaisPg, type RepositorioDeCanais } from "../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco, filaAtiva, origemAtiva } from "../../repositorios/crm/referencias";
import { avisarCrm } from "../../mensageria/avisar";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeCanais {
  listar(membro: MembroDaSessao, filtro: FiltroDeCanais): Promise<ResultadoCrm<Pagina<Canal>>>;
  /** O Canal da ficha: o `Canal` mais `ligadoAoProvedor` (CR-01, 16-17). */
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<CanalNaFicha>>;
  criar(membro: MembroDaSessao, entrada: NovoCanal): Promise<ResultadoCrm<Canal>>;
  editar(membro: MembroDaSessao, id: string, edicao: EdicaoDeCanal): Promise<ResultadoCrm<Canal>>;
  /**
   * Sessão 4 (4.2.3): põe o Canal para conectar lendo um QR code. Devolve o QR (ou "aguardando"), nunca `conectada`: quem
   * confirma é o provedor, pelo webhook. Só o WhatsApp não oficial conecta assim.
   */
  conectar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ConexaoPorQrCode>>;
  simularConexao(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
  desconectar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
}

/**
 * 4.3.4: a simulação de conexão só existe onde o ambiente a liga. Lida a cada chamada (não no import), para o teste ligar e
 * desligar. Produção NÃO define a variável: a rota `simular-conexao` nem é registrada e a ficha esconde o botão.
 */
export function simulacaoDeConexaoPermitida(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.PERMITIR_CONEXAO_SIMULADA === "true";
}

/** Os provedores que se conectam falando com um servidor de fora, e que por isso precisam sair da sessão ao desconectar. */
export interface ConectoresDeCanal {
  /** A Evolution (`whatsapp-nao-oficial`). Ausente nos testes que não a exercitam: então "Conectar" responde 503. */
  readonly whatsappNaoOficial?: ConectorDaEvolution;
}

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-08-04). */
const FRASES: FrasesDeRestricao = {
  canais_nome_uq: { codigo: "CANAL_NOME_EM_USO", error: "Já existe um Canal ativo com este nome." },
  canais_conta_uq: { codigo: "CANAL_CONTA_EM_USO", error: "Esta conta já está conectada em outro Canal ativo." },
  canais_arquivado_desconectado_ck: {
    codigo: "TRANSICAO_INVALIDA",
    error: "O Canal mudou enquanto você agia. Recarregue e tente de novo.",
  },
  canais_simulada_ck: {
    codigo: "TRANSICAO_INVALIDA",
    error: "O Canal mudou enquanto você agia. Recarregue e tente de novo.",
  },
};

const naoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO" });

/** Valor mal formado (nome vazio, identificador sem DDI): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

const transicaoInvalida = (error: string) => recusa<never>(409, error, { codigo: "TRANSICAO_INVALIDA" });

const canalArquivado = () =>
  recusa<never>(409, "Um Canal arquivado não se configura. Crie outro Canal para usar a conta de novo.", { codigo: "CANAL_ARQUIVADO" });

const filaInvalida = () =>
  recusa<never>(409, "A Fila padrão precisa ser uma Fila ativa deste Espaço de Trabalho.", {
    codigo: "FILA_INVALIDA",
    campo: "filaPadraoId",
  });

const origemInvalida = () =>
  recusa<never>(409, "A Origem padrão precisa ser uma Origem ativa do catálogo deste Espaço de Trabalho.", {
    codigo: "ORIGEM_INVALIDA",
    campo: "origemPadraoId",
  });

/** 409 de nome ou conta em uso, com o detentor em `bloqueios.canais` (RN-CXE-31, INV-CXE-01). */
function emUso(conflito: { readonly id: string; readonly nome: string; readonly motivo: "nome" | "conta" }) {
  const bloqueios = { canais: [{ id: conflito.id, nome: conflito.nome }] };
  return conflito.motivo === "nome"
    ? recusa<never>(409, "Já existe um Canal ativo com este nome.", { codigo: "CANAL_NOME_EM_USO", campo: "nome", bloqueios })
    : recusa<never>(409, "Esta conta já está conectada em outro Canal ativo.", {
        codigo: "CANAL_CONTA_EM_USO",
        campo: "identificador",
        bloqueios,
      });
}

type Cliente = Pool | PoolClient;

/** Fila e Origem padrão, quando vierem preenchidas (`null` e ausente não validam nada). */
async function referenciasInvalidas(
  cliente: Cliente,
  workspaceId: string,
  refs: { readonly filaPadraoId?: string | null | undefined; readonly origemPadraoId?: string | null | undefined },
) {
  if (typeof refs.filaPadraoId === "string" && !(await filaAtiva(cliente, workspaceId, refs.filaPadraoId))) return filaInvalida();
  if (typeof refs.origemPadraoId === "string" && !(await origemAtiva(cliente, workspaceId, refs.origemPadraoId))) return origemInvalida();
  return undefined;
}

/** O nome ou a conta já são de outro Canal ativo de `plataforma.canais`? */
async function conflitoDeCanal(
  repositorio: RepositorioDeCanais,
  workspaceId: string,
  alvo: Parameters<RepositorioDeCanais["ativoEmConflito"]>[1],
) {
  const novo = await repositorio.ativoEmConflito(workspaceId, alvo);
  return novo ? emUso(novo) : undefined;
}

export function criarServicoDeCanais(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
  readonly conectores?: ConectoresDeCanal;
  /** Padrão: `simulacaoDeConexaoPermitida()` (a variável de ambiente, lida a cada chamada). */
  readonly simulacaoPermitida?: () => boolean;
}): ServicoDeCanais {
  const simulacaoPermitida = deps.simulacaoPermitida ?? (() => simulacaoDeConexaoPermitida());
  interface Contexto {
    readonly cliente: PoolClient;
    readonly repositorio: RepositorioDeCanais;
    readonly canal: Canal;
  }

  /**
   * Papel primeiro (um Membro nunca descobre se o corpo era válido); depois a
   * validação de forma, sem banco; depois a transação. O Canal é carregado
   * travado e tem de existir NESTE Espaço.
   */
  async function escrita(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    corpo: (contexto: Contexto) => Promise<ResultadoCrm<Canal>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<Canal>> {
    const negado = await exigir(deps.acesso, membro, acao, "canal");
    if (negado) return { ok: false, ...negado };
    const invalido = validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        // A linha do Espaço ANTES da do Canal, a mesma ordem de `executar()` e do gesto misto (WR-02): travar o
        // Canal primeiro e só depois subir a revisão do Espaço dá `40P01` contra um gesto misto em curso.
        await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
        const repositorio = criarRepositorioDeCanaisPg(cliente);
        const canal = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!canal) return naoEncontrado();
        return corpo({ cliente, repositorio, canal });
      },
      FRASES,
    );
  }

  /**
   * `simular_conexao` e `desconectar`: o domínio decide a transição, o serviço a grava. `conexao_confirmada` (16-13) e
   * `conexao_perdida` não passam por aqui: quem as confirma é o provedor, pelo webhook (e a conferência periódica), nunca um
   * Membro pela rota; `conectar` pede o QR (`conectar` abaixo) e não muda a conexão.
   */
  function mudarConexao(membro: MembroDaSessao, id: string, acao: Extract<AcaoDeConexao, "simular_conexao" | "desconectar">): Promise<ResultadoCrm<Canal>> {
    return escrita(membro, acao, id, async ({ cliente, repositorio, canal }) => {
      // CR-01 (16-17): o fato "o Canal é real" é lido AQUI, depois do `for update` do Canal (o `canal:ligar-evolution` grava a
      // credencial e a conexão com o mesmo Canal travado: sem corrida). `desconectar` não precisa dele.
      const fatos =
        acao === "simular_conexao"
          ? { ligadoAoProvedor: await repositorio.ligadoAoProvedor(membro.workspaceId, canal) }
          : undefined;
      const proxima = proximaConexao(canal, acao, fatos);
      if (!proxima.ok) return transicaoInvalida(proxima.error);
      const atualizado = await repositorio.definirConexao(membro.workspaceId, id, proxima.value);
      if (!atualizado) return naoEncontrado();
      // Sessão 8: desconectar o Instagram apaga a conta ligada e o token do cofre, na mesma transação.
      if (acao === "desconectar" && canal.provedor === "instagram-graph") await esquecerConta(cliente, membro.workspaceId, id);
      // Sessão 7: desconectar o WhatsApp oficial apaga o número ligado e o token do cofre, na mesma transação.
      if (acao === "desconectar" && canal.provedor === "whatsapp-cloud") await esquecerNumero(cliente, membro.workspaceId, id);
      await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
      await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId: id });
      // B69 (16-06): as Mensagens guardadas enquanto o Canal estava fora do ar saem agora, no MESMO commit da
      // conexão: se a fila falhar, o Canal também não muda. Nada é descartado.
      if (atualizado.conexao === "conectada") await reenfileirarPendentesDoCanal(cliente, membro.workspaceId, id);
      return sucesso(atualizado);
    });
  }

  /**
   * 4.3.3: tira o aparelho da sessão ANTES de abrir a transação (a Evolution é rede; a transação segura a linha do Espaço e a
   * do Canal). Só age onde há o que tirar: Canal `whatsapp-nao-oficial` real, ativo e cuja transição o domínio aceita (o
   * resto é recusado dentro da transação, sem chamar ninguém). Se a Evolution não responde, devolve 502 e nada é gravado.
   * `undefined` é "siga para a escrita". A permissão vem primeiro: um Membro sem ela nunca dispara chamada de rede.
   */
  async function desligarDoProvedor(membro: MembroDaSessao, id: string, acao: "desconectar" | "arquivar"): Promise<ResultadoCrm<never> | undefined> {
    const negado = await exigir(deps.acesso, membro, acao, "canal");
    if (negado) return { ok: false, ...negado };
    const conector = deps.conectores?.whatsappNaoOficial;
    if (!conector) return undefined;
    const canal = await criarRepositorioDeCanaisPg(deps.pool()).obter(membro.workspaceId, id);
    if (!canal || canal.provedor !== "whatsapp-nao-oficial" || canal.conexaoSimulada || canal.estado === "arquivado") return undefined;
    if (acao === "desconectar" && !proximaConexao(canal, "desconectar").ok) return undefined;
    if (acao === "arquivar" && !validarArquivamento(canal).ok) return undefined;
    try {
      await conector.desligar(membro.workspaceId, canal, acao);
    } catch (erro) {
      if (erro instanceof FalhaDoProvedor) return recusa(502, FRASE_DE_FALHA_DO_WHATSAPP, { codigo: "EVOLUTION_INDISPONIVEL" });
      throw erro;
    }
    return undefined;
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      return sucesso(await criarRepositorioDeCanaisPg(deps.pool()).listar(membro.workspaceId, filtro));
    },

    async obter(membro, id) {
      const negado = await exigir(deps.acesso, membro, "ler", "canal");
      if (negado) return { ok: false, ...negado };
      const repositorio = criarRepositorioDeCanaisPg(deps.pool());
      const canal = await repositorio.obter(membro.workspaceId, id);
      if (!canal) return naoEncontrado();
      return sucesso({
        ...canal,
        ligadoAoProvedor: await repositorio.ligadoAoProvedor(membro.workspaceId, canal),
        simulacaoPermitida: simulacaoPermitida(),
      });
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "canal");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovoCanal(entrada);
      if (!validacao.ok) return valorInvalido(validacao);
      const { tipo, provedor, nome, identificadorExterno } = validacao.value;

      return comTransacao(
        deps.pool,
        async (cliente) => {
          const repositorio = criarRepositorioDeCanaisPg(cliente);
          const referencia = await referenciasInvalidas(cliente, membro.workspaceId, entrada);
          if (referencia) return referencia;
          const conflito = await conflitoDeCanal(repositorio, membro.workspaceId, { nome, tipo, identificadorExterno });
          if (conflito) return conflito;
          const canal = await repositorio.inserir(membro.workspaceId, {
            nome,
            tipo,
            provedor,
            identificadorExterno,
            configuradoPor: membro.id,
            criadoPor: membro.id,
            filaPadraoId: entrada.filaPadraoId,
            origemPadraoId: entrada.origemPadraoId,
          });
          await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
          await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId: canal.id });
          return sucesso(canal);
        },
        FRASES,
      );
    },

    editar(membro, id, edicao) {
      const validacao = validarEdicaoDeCanal(edicao);
      return escrita(
        membro,
        "editar",
        id,
        async ({ cliente, repositorio, canal }) => {
          if (!validacao.ok) return valorInvalido(validacao);
          if (canal.estado === "arquivado") return canalArquivado();
          const campos = validacao.value;
          if (campos.nome !== undefined) {
            const conflito = await conflitoDeCanal(repositorio, membro.workspaceId, { nome: campos.nome, excetoId: id });
            if (conflito) return conflito;
          }
          const referencia = await referenciasInvalidas(cliente, membro.workspaceId, campos);
          if (referencia) return referencia;
          const atualizado = await repositorio.atualizar(membro.workspaceId, id, campos);
          if (!atualizado) return naoEncontrado();
          await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
          await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId: id });
          return sucesso(atualizado);
        },
        () => (validacao.ok ? undefined : valorInvalido(validacao)),
      );
    },

    async conectar(membro, id) {
      const negado = await exigir(deps.acesso, membro, "conectar", "canal");
      if (negado) return { ok: false, ...negado };
      const canal = await criarRepositorioDeCanaisPg(deps.pool()).obter(membro.workspaceId, id);
      if (!canal) return naoEncontrado();
      if (!conectaPorQrCode(canal.provedor)) {
        return recusa(409, "Este Canal não se conecta lendo um QR code.", { codigo: "PROVEDOR_ERRADO" });
      }
      const proxima = proximaConexao(canal, "conectar");
      if (!proxima.ok) return transicaoInvalida(proxima.error);
      const conector = deps.conectores?.whatsappNaoOficial;
      if (!conector) {
        return recusa(503, "A integração com o WhatsApp não está configurada neste ambiente.", { codigo: "EVOLUTION_NAO_CONFIGURADA" });
      }
      return conector.conectar(membro.workspaceId, canal);
    },
    async simularConexao(membro, id) {
      // Defesa em profundidade da 4.3.4: a rota nem existe sem a variável, e o serviço também recusa.
      if (!simulacaoPermitida()) {
        return recusa(409, "A simulação de conexão está desligada neste ambiente.", { codigo: "SIMULACAO_DESLIGADA" });
      }
      return mudarConexao(membro, id, "simular_conexao");
    },
    async desconectar(membro, id) {
      const recusado = await desligarDoProvedor(membro, id, "desconectar");
      if (recusado) return recusado;
      return mudarConexao(membro, id, "desconectar");
    },
    async arquivar(membro, id) {
      const recusado = await desligarDoProvedor(membro, id, "arquivar");
      if (recusado) return recusado;
      return escrita(membro, "arquivar", id, async ({ cliente, repositorio, canal }) => {
        const validacao = validarArquivamento(canal);
        if (!validacao.ok) return transicaoInvalida(validacao.error);
        const arquivado = await repositorio.arquivar(membro.workspaceId, id);
        if (!arquivado) return naoEncontrado();
        if (canal.provedor === "instagram-graph") await esquecerConta(cliente, membro.workspaceId, id);
        if (canal.provedor === "whatsapp-cloud") await esquecerNumero(cliente, membro.workspaceId, id);
        // 4.3.3: arquivar o WhatsApp não oficial apaga a credencial da instância e o segredo do webhook do cofre.
        if (canal.provedor === "whatsapp-nao-oficial") await esquecerCredenciaisDaEvolution(cliente, membro.workspaceId, id);
        await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
        await avisarCrm(cliente, { workspaceId: membro.workspaceId, tipo: "canal.mudou", canalId: id });
        return sucesso(arquivado);
      });
    },
  };
}
