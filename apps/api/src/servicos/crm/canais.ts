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
 *   - a pré-checagem rica de nome e conta nos DOIS acervos (a tabela nova e o
 *     `channels` do seed, A5), com `bloqueios.canais` apontando o detentor;
 *   - Fila e Origem padrão validadas contra o Espaço (D-07);
 *   - a conexão em dois atos sem provedor (D-08): a decisão da transição é do
 *     domínio (`proximaConexao`), o serviço só a grava;
 *   - arquivar desconectando na mesma escrita (11.1);
 *   - a revisão do Espaço somada na mesma transação de toda escrita (A4).
 * Toda escrita carrega o Canal travado (`for update`) NESTE Espaço: id de
 * outro Espaço é 404, nunca 403 (T-08-13).
 */

import type { Pool, PoolClient } from "pg";
import type { Pagina } from "@n1/dominio/crm/comum";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import {
  proximaConexao,
  validarArquivamento,
  validarEdicaoDeCanal,
  validarNovoCanal,
  type AcaoDeConexao,
  type Canal,
  type EdicaoDeCanal,
  type FiltroDeCanais,
  type NovoCanal,
} from "@n1/dominio/crm/canais";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg, type RepositorioDeCanais } from "../../repositorios/crm/canais";
import { avancarRevisaoDoEspaco, canalAntigoEmConflito, filaAtiva, origemAtiva } from "../../repositorios/crm/referencias";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface ServicoDeCanais {
  listar(membro: MembroDaSessao, filtro: FiltroDeCanais): Promise<ResultadoCrm<Pagina<Canal>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
  criar(membro: MembroDaSessao, entrada: NovoCanal): Promise<ResultadoCrm<Canal>>;
  editar(membro: MembroDaSessao, id: string, edicao: EdicaoDeCanal): Promise<ResultadoCrm<Canal>>;
  simularConexao(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
  desconectar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<Canal>>;
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

/** O nome ou a conta já são de outro Canal ativo, na tabela nova ou no seed (A5)? */
async function conflitoDeCanal(
  cliente: Cliente,
  repositorio: RepositorioDeCanais,
  workspaceId: string,
  alvo: Parameters<RepositorioDeCanais["ativoEmConflito"]>[1],
) {
  const novo = await repositorio.ativoEmConflito(workspaceId, alvo);
  if (novo) return emUso(novo);
  // O seed só tem ids do modelo antigo: `excetoId` (um UUID da tabela nova) não se aplica a ele.
  const antigo = await canalAntigoEmConflito(cliente, workspaceId, alvo);
  return antigo ? emUso(antigo) : undefined;
}

export function criarServicoDeCanais(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeCanais {
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
        const repositorio = criarRepositorioDeCanaisPg(cliente);
        const canal = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!canal) return naoEncontrado();
        return corpo({ cliente, repositorio, canal });
      },
      FRASES,
    );
  }

  /** `simular_conexao` e `desconectar`: o domínio decide a transição, o serviço a grava. */
  function mudarConexao(membro: MembroDaSessao, id: string, acao: AcaoDeConexao): Promise<ResultadoCrm<Canal>> {
    return escrita(membro, acao, id, async ({ cliente, repositorio, canal }) => {
      const proxima = proximaConexao(canal, acao);
      if (!proxima.ok) return transicaoInvalida(proxima.error);
      const atualizado = await repositorio.definirConexao(membro.workspaceId, id, proxima.value);
      if (!atualizado) return naoEncontrado();
      await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
      return sucesso(atualizado);
    });
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
      const canal = await criarRepositorioDeCanaisPg(deps.pool()).obter(membro.workspaceId, id);
      return canal ? sucesso(canal) : naoEncontrado();
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
          const conflito = await conflitoDeCanal(cliente, repositorio, membro.workspaceId, { nome, tipo, identificadorExterno });
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
            const conflito = await conflitoDeCanal(cliente, repositorio, membro.workspaceId, { nome: campos.nome, excetoId: id });
            if (conflito) return conflito;
          }
          const referencia = await referenciasInvalidas(cliente, membro.workspaceId, campos);
          if (referencia) return referencia;
          const atualizado = await repositorio.atualizar(membro.workspaceId, id, campos);
          if (!atualizado) return naoEncontrado();
          await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
          return sucesso(atualizado);
        },
        () => (validacao.ok ? undefined : valorInvalido(validacao)),
      );
    },

    simularConexao: (membro, id) => mudarConexao(membro, id, "simular_conexao"),

    desconectar: (membro, id) => mudarConexao(membro, id, "desconectar"),

    arquivar(membro, id) {
      return escrita(membro, "arquivar", id, async ({ cliente, repositorio, canal }) => {
        const validacao = validarArquivamento(canal);
        if (!validacao.ok) return transicaoInvalida(validacao.error);
        const arquivado = await repositorio.arquivar(membro.workspaceId, id);
        if (!arquivado) return naoEncontrado();
        await avancarRevisaoDoEspaco(cliente, membro.workspaceId);
        return sucesso(arquivado);
      });
    },
  };
}
