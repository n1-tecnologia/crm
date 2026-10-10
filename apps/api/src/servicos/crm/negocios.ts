/**
 * Serviço de Negócios: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01/T-07-02). O Papel é exigido
 * ANTES de ler ou escrever (D-14); em `reabrir`, a situação que o Papel
 * consulta é a do Negócio lido do banco, DENTRO da transação, nunca a do corpo
 * (T-07-26). Sem Proprietário informado, o Proprietário é o Membro da sessão;
 * informado, tem de ser Membro ativo do mesmo Espaço (D-11).
 *
 * Toda escrita roda em `comTransacao`, com o Negócio carregado `for update`.
 * Funil, Etapa, Empresa e Contato são lidos pelos repositórios deles, sempre
 * com o `workspace_id` da sessão (T-07-28): o que é de outro Espaço é 404. As
 * Regras de encerramento do Funil (D-05) são lidas do banco na mesma
 * transação e aplicadas pelo domínio; só depois vem o SQL. O serviço PRÉ-CHECA
 * para dar a mensagem rica e o SQLSTATE traduzido por `FRASES` é a rede contra
 * a corrida. Recusa de regra é valor (`recusa`), não exceção.
 */

import type { Pool, PoolClient } from "pg";
import type { EstadoCrm, Pagina, SituacaoNegocio } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { nomeDeExibicaoDaEmpresa } from "@n1/dominio/crm/empresas";
import { etapaInicial, type Etapa, type Funil } from "@n1/dominio/crm/funis";
import {
  probabilidadeEfetiva,
  validarEdicao,
  validarGanho,
  validarMovimento,
  validarNovoNegocio,
  validarPerda,
  validarReabertura,
  validarValor,
  type EdicaoDeNegocio,
  type Ganho,
  type Movimento,
  type Negocio,
  type NegocioDetalhado,
  type NegocioResumo,
  type NovoNegocio,
  type Perda,
  type Reabertura,
} from "@n1/dominio/crm/negocios";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeEmpresasPg } from "../../repositorios/crm/empresas";
import { criarRepositorioDeFunisPg } from "../../repositorios/crm/funis";
import { criarRepositorioDeNegociosPg, type RepositorioDeNegocios } from "../../repositorios/crm/negocios";
import { exigir, resolverProprietario, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface FiltroDeNegocios {
  readonly estado: EstadoCrm;
  readonly funilId?: string | undefined;
  readonly situacao?: SituacaoNegocio | undefined;
  readonly empresaId?: string | undefined;
  readonly contatoId?: string | undefined;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface ServicoDeNegocios {
  listar(membro: MembroDaSessao, filtro: FiltroDeNegocios): Promise<ResultadoCrm<Pagina<NegocioResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  criar(membro: MembroDaSessao, entrada: NovoNegocio): Promise<ResultadoCrm<NegocioDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeNegocio): Promise<ResultadoCrm<NegocioDetalhado>>;
  mover(membro: MembroDaSessao, id: string, entrada: Movimento): Promise<ResultadoCrm<NegocioDetalhado>>;
  ganhar(membro: MembroDaSessao, id: string, entrada: Ganho): Promise<ResultadoCrm<NegocioDetalhado>>;
  perder(membro: MembroDaSessao, id: string, entrada: Perda): Promise<ResultadoCrm<NegocioDetalhado>>;
  reabrir(membro: MembroDaSessao, id: string, entrada: Reabertura): Promise<ResultadoCrm<NegocioDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<NegocioDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

const FRASE_DONO = "Um Negócio é de uma Empresa ou de um Contato.";

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-07-06). */
const FRASES: FrasesDeRestricao = {
  negocios_dono_ck: { codigo: "DONO_INVALIDO", error: FRASE_DONO },
  negocios_encerramento_ck: {
    codigo: "NEGOCIO_ENCERRADO",
    error: "A situação do Negócio mudou enquanto você agia. Recarregue e tente de novo.",
  },
  negocios_motivo_perda_ck: { codigo: "NEGOCIO_ENCERRADO", error: "Só um Negócio perdido tem motivo de perda." },
  negocios_motivo_ganho_ck: { codigo: "NEGOCIO_ENCERRADO", error: "Só um Negócio ganho tem motivo de ganho." },
  negocios_workspace_id_funil_id_etapa_id_fkey: { codigo: "ETAPA_INVALIDA", error: "A Etapa não é do Funil escolhido." },
  negocios_workspace_id_funil_id_fkey: { codigo: "FUNIL_INATIVO", error: "O Funil não está mais disponível neste Espaço de Trabalho." },
  negocios_workspace_id_empresa_id_fkey: { codigo: "EMPRESA_INATIVA", error: "A Empresa não está mais disponível neste Espaço de Trabalho." },
  negocios_workspace_id_contato_id_fkey: { codigo: "CONTATO_INATIVO", error: "O Contato não está mais disponível neste Espaço de Trabalho." },
};

const naoEncontrado = () => recusa<never>(404, "Negócio não encontrado.", { codigo: "NEGOCIO_NAO_ENCONTRADO" });

/** Valor mal formado (normalização, limites): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

/** RN-NEG-16: Negócio arquivado ou na lixeira não recebe nenhuma ação de progressão nem edição. */
function negocioInativo(negocio: Pick<Negocio, "estado">) {
  return recusa<never>(
    409,
    negocio.estado === "arquivado"
      ? "Um Negócio arquivado é somente leitura. Restaure-o antes (RN-NEG-16)."
      : "O Negócio está na lixeira. Restaure-o antes.",
    { codigo: "NEGOCIO_INATIVO" },
  );
}

/** RN-NEG-04: em `ganho`/`perdido` a Etapa e a situação só mudam por reabertura. */
function negocioEncerrado(negocio: Pick<Negocio, "situacao">) {
  return recusa<never>(409, `Este Negócio já está ${negocio.situacao}. Reabra-o antes.`, { codigo: "NEGOCIO_ENCERRADO" });
}

/** `undefined` quando o Negócio está `ativo` e `aberto`; senão a recusa 409. */
function exigirAbertoEAtivo(negocio: Pick<Negocio, "estado" | "situacao">): ResultadoCrm<never> | undefined {
  if (negocio.estado !== "ativo") return negocioInativo(negocio);
  if (negocio.situacao !== "aberto") return negocioEncerrado(negocio);
  return undefined;
}

type Cliente = Pool | PoolClient;

/** O que uma busca devolve: o registro, ou a recusa pronta para ser retornada. */
type Achado<T, Chave extends string> = ({ readonly falha?: undefined } & { readonly [K in Chave]: T }) | { readonly falha: ResultadoCrm<never> };

/** Empresa do Espaço e `ativa` (RN-NEG-06, RN-EMP-08); de outro Espaço é 404 (T-07-28). */
async function conferirEmpresa(cliente: Cliente, workspaceId: string, empresaId: string): Promise<ResultadoCrm<never> | undefined> {
  const empresa = await criarRepositorioDeEmpresasPg(cliente).obter(workspaceId, empresaId);
  if (!empresa) return recusa<never>(404, "Empresa não encontrada.", { codigo: "EMPRESA_NAO_ENCONTRADA", campo: "empresaId" });
  if (empresa.estado !== "ativo") {
    return recusa<never>(409, "Só uma Empresa ativa recebe Negócios novos. Restaure a Empresa antes.", {
      codigo: "EMPRESA_INATIVA",
      campo: "empresaId",
    });
  }
  return undefined;
}

/** Contato do Espaço e fora da lixeira (RN-CON-19: arquivado continua referenciável). */
async function conferirContato(cliente: Cliente, workspaceId: string, contatoId: string): Promise<ResultadoCrm<never> | undefined> {
  const contato = await criarRepositorioDeContatosPg(cliente).obter(workspaceId, contatoId);
  if (!contato) return recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO", campo: "contatoId" });
  if (contato.estado === "na_lixeira") {
    return recusa<never>(409, "O Contato está na lixeira. Restaure o Contato antes de criar um Negócio para ele.", {
      codigo: "CONTATO_INATIVO",
      campo: "contatoId",
    });
  }
  return undefined;
}

/** O Negócio com o que a ficha mostra: Funil, Etapa, Etapas do Funil, Empresa ou Contato, e a probabilidade efetiva. */
async function detalhar(cliente: Cliente, workspaceId: string, negocio: Negocio): Promise<NegocioDetalhado> {
  const funis = criarRepositorioDeFunisPg(cliente);
  // Em sequência: um PoolClient não deve receber consultas concorrentes.
  const funil = await funis.obter(workspaceId, negocio.funilId);
  const etapas = await funis.listarEtapas(workspaceId, negocio.funilId);
  const etapa = etapas.find((candidata) => candidata.id === negocio.etapaId);
  if (!funil || !etapa) throw new Error("Negócio sem Funil ou sem Etapa: a integridade da 007 foi violada.");

  let empresa: NegocioDetalhado["empresa"] = null;
  if (negocio.empresaId !== null) {
    const encontrada = await criarRepositorioDeEmpresasPg(cliente).obter(workspaceId, negocio.empresaId);
    if (encontrada) empresa = { id: encontrada.id, nome: nomeDeExibicaoDaEmpresa(encontrada), estado: encontrada.estado };
  }
  let contato: NegocioDetalhado["contato"] = null;
  if (negocio.contatoId !== null) {
    const repositorio = criarRepositorioDeContatosPg(cliente);
    const encontrado = await repositorio.obter(workspaceId, negocio.contatoId);
    if (encontrado) {
      const identificadores = await repositorio.listarIdentificadores(workspaceId, encontrado.id);
      const principal = identificadores.find((i) => i.principal && i.tipo === "email") ?? identificadores.find((i) => i.principal);
      contato = {
        id: encontrado.id,
        nome: nomeDeExibicaoDoContato(encontrado, principal?.valor ?? null),
        estado: encontrado.estado,
      };
    }
  }
  return {
    negocio,
    funil: {
      id: funil.id,
      nome: funil.nome,
      estado: funil.estado,
      exigeMotivoPerda: funil.exigeMotivoPerda,
      exigeValorGanho: funil.exigeValorGanho,
    },
    etapa: { id: etapa.id, nome: etapa.nome, probabilidadePadrao: etapa.probabilidadePadrao },
    etapasDoFunil: etapas.map((candidata) => ({ id: candidata.id, nome: candidata.nome, ordem: candidata.ordem })),
    empresa,
    contato,
    probabilidadeEfetiva: probabilidadeEfetiva(negocio, etapa),
  };
}

export function criarServicoDeNegocios(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeNegocios {
  interface Contexto {
    readonly cliente: PoolClient;
    readonly repositorio: RepositorioDeNegocios;
    readonly negocio: Negocio;
  }

  /**
   * Papel primeiro (um Convidado nunca descobre se o corpo era válido); depois a validação
   * de forma, sem banco; depois a transação, com o Negócio carregado travado — ele tem de
   * existir NESTE Espaço. Em `reabrir`, o Papel é conferido DE NOVO com a situação lida do
   * banco (D-14): quem reabre `ganho` precisa administrar, e a situação nunca vem do corpo.
   */
  async function escrita<T>(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    corpo: (contexto: Contexto) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    const negado = await exigir(deps.acesso, membro, acao, "negocio");
    if (negado) return { ok: false, ...negado };
    const invalido = validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        const repositorio = criarRepositorioDeNegociosPg(cliente);
        const negocio = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!negocio) return naoEncontrado();
        if (acao === "reabrir") {
          const negadoPelaSituacao = await exigir(deps.acesso, membro, acao, "negocio", { situacao: negocio.situacao });
          if (negadoPelaSituacao) return { ok: false, ...negadoPelaSituacao };
        }
        return corpo({ cliente, repositorio, negocio });
      },
      FRASES,
    );
  }

  async function devolver(cliente: Cliente, membro: MembroDaSessao, negocio: Negocio | undefined): Promise<ResultadoCrm<NegocioDetalhado>> {
    if (!negocio) return naoEncontrado();
    return sucesso(await detalhar(cliente, membro.workspaceId, negocio));
  }

  /** Funil existente no Espaço (404 se não) e `ativo` (409 `FUNIL_INATIVO`, RN-FUN-14). */
  async function funilAtivo(cliente: Cliente, workspaceId: string, funilId: string): Promise<Achado<Funil, "funil">> {
    const funil = await criarRepositorioDeFunisPg(cliente).obter(workspaceId, funilId);
    if (!funil) return { falha: recusa<never>(404, "Funil não encontrado.", { codigo: "FUNIL_NAO_ENCONTRADO", campo: "funilId" }) };
    if (funil.estado !== "ativo") {
      return {
        falha: recusa<never>(409, "Um Funil arquivado ou na lixeira não recebe Negócios (RN-FUN-14).", {
          codigo: "FUNIL_INATIVO",
          campo: "funilId",
        }),
      };
    }
    return { funil };
  }

  /** Etapa existente no Espaço (404 se não) e do Funil dado (409 `ETAPA_INVALIDA`, INV-FUN-06). */
  async function etapaDoFunil(cliente: Cliente, workspaceId: string, funilId: string, etapaId: string): Promise<Achado<Etapa, "etapa">> {
    const etapa = await criarRepositorioDeFunisPg(cliente).obterEtapa(workspaceId, etapaId);
    if (!etapa) return { falha: recusa<never>(404, "Etapa não encontrada.", { codigo: "ETAPA_NAO_ENCONTRADA", campo: "etapaId" }) };
    if (etapa.funilId !== funilId) {
      return {
        falha: recusa<never>(409, "A Etapa de destino não é do Funil escolhido (INV-FUN-06).", {
          codigo: "ETAPA_INVALIDA",
          campo: "etapaId",
        }),
      };
    }
    return { etapa };
  }

  /** Muda de situação e devolve o detalhe. Compartilhado por `arquivar`, `restaurar` e `enviarParaLixeira`. */
  async function mudarEstado(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    alvo: EstadoCrm,
    conferir: (contexto: Contexto) => Promise<ResultadoCrm<never> | undefined>,
  ): Promise<ResultadoCrm<NegocioDetalhado>> {
    return escrita(membro, acao, id, async (contexto) => {
      const recusado = await conferir(contexto);
      if (recusado) return recusado;
      const atualizado = await contexto.repositorio.definirEstado(membro.workspaceId, contexto.negocio.id, alvo);
      return devolver(contexto.cliente, membro, atualizado);
    });
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "negocio");
      if (negado) return { ok: false, ...negado };
      const repositorio = criarRepositorioDeNegociosPg(deps.pool());
      return sucesso(
        await repositorio.listar(membro.workspaceId, {
          estado: filtro.estado,
          funilId: filtro.funilId,
          situacao: filtro.situacao,
          empresaId: filtro.empresaId,
          contatoId: filtro.contatoId,
          q: filtro.q,
          limite: filtro.limite,
          deslocamento: filtro.deslocamento,
        }),
      );
    },

    async obter(membro, id) {
      const negado = await exigir(deps.acesso, membro, "ler", "negocio");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const negocio = await criarRepositorioDeNegociosPg(cliente).obter(membro.workspaceId, id);
      if (!negocio) return naoEncontrado();
      return devolver(cliente, membro, negocio);
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "negocio");
      if (negado) return { ok: false, ...negado };

      const validacao = validarNovoNegocio(entrada);
      if (!validacao.ok) {
        return validacao.field === undefined
          ? recusa<never>(400, validacao.error, { codigo: "DONO_INVALIDO" })
          : valorInvalido(validacao);
      }
      const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
      if (!proprietario.ok) return proprietario;

      return comTransacao(
        deps.pool,
        async (cliente) => {
          const funis = criarRepositorioDeFunisPg(cliente);
          const ws = membro.workspaceId;

          // RN-NEG-03: sem Funil explícito, o Funil padrão do Espaço.
          let funilId = entrada.funilId;
          if (funilId === undefined) {
            const padrao = await funis.funilPadrao(ws);
            if (!padrao) {
              return recusa<never>(409, "Este Espaço de Trabalho não tem Funil padrão. Crie um Funil antes.", { codigo: "SEM_FUNIL_PADRAO" });
            }
            funilId = padrao.id;
          }
          const funil = await funilAtivo(cliente, ws, funilId);
          if (funil.falha) return funil.falha;

          // RN-FUN-06: sem Etapa explícita, a de menor ordem.
          let etapaId = entrada.etapaId;
          if (etapaId === undefined) {
            const inicial = etapaInicial(await funis.listarEtapas(ws, funil.funil.id));
            if (!inicial) return recusa<never>(409, "O Funil não tem Etapas.", { codigo: "ETAPA_INVALIDA" });
            etapaId = inicial.id;
          } else {
            const etapa = await etapaDoFunil(cliente, ws, funil.funil.id, etapaId);
            if (etapa.falha) return etapa.falha;
          }

          if (entrada.empresaId !== undefined) {
            const recusada = await conferirEmpresa(cliente, ws, entrada.empresaId);
            if (recusada) return recusada;
          }
          if (entrada.contatoId !== undefined) {
            const recusada = await conferirContato(cliente, ws, entrada.contatoId);
            if (recusada) return recusada;
          }

          const negocio = await criarRepositorioDeNegociosPg(cliente).inserir(ws, {
            titulo: entrada.titulo,
            objeto: entrada.objeto,
            descricao: entrada.descricao,
            empresaId: entrada.empresaId,
            contatoId: entrada.contatoId,
            funilId: funil.funil.id,
            etapaId,
            valor: entrada.valor,
            moeda: entrada.moeda,
            probabilidade: entrada.probabilidade,
            origem: entrada.origem,
            dataPrevistaFechamento: entrada.dataPrevistaFechamento,
            proprietarioId: proprietario.valor,
            criadoPor: membro.id,
          });
          return devolver(cliente, membro, negocio);
        },
        FRASES,
      );
    },

    async editar(membro, id, entrada) {
      return escrita(membro, "editar", id, async ({ cliente, repositorio, negocio }) => {
        if (negocio.estado !== "ativo") return negocioInativo(negocio);
        const validacao = validarEdicao(negocio, entrada);
        if (!validacao.ok) {
          return validacao.field === undefined
            ? recusa<never>(409, validacao.error, { codigo: "DONO_INVALIDO" })
            : valorInvalido(validacao);
        }
        const ws = membro.workspaceId;
        // RN-NEG-06: a Empresa só é conferida quando é definida ou trocada.
        if (entrada.empresaId != null && entrada.empresaId !== negocio.empresaId) {
          const recusada = await conferirEmpresa(cliente, ws, entrada.empresaId);
          if (recusada) return recusada;
        }
        if (entrada.contatoId != null && entrada.contatoId !== negocio.contatoId) {
          const recusada = await conferirContato(cliente, ws, entrada.contatoId);
          if (recusada) return recusada;
        }
        let proprietarioId: string | undefined;
        if (entrada.proprietarioId !== undefined) {
          const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
          if (!proprietario.ok) return proprietario;
          proprietarioId = proprietario.valor;
        }
        const atualizado = await repositorio.atualizar(ws, negocio.id, {
          ...entrada,
          ...(proprietarioId !== undefined ? { proprietarioId } : {}),
        });
        return devolver(cliente, membro, atualizado);
      });
    },

    async mover(membro, id, entrada) {
      return escrita(membro, "mover", id, async ({ cliente, repositorio, negocio }) => {
        const recusado = exigirAbertoEAtivo(negocio);
        if (recusado) return recusado;
        const ws = membro.workspaceId;
        const funil = await funilAtivo(cliente, ws, entrada.funilId ?? negocio.funilId);
        if (funil.falha) return funil.falha;
        const etapa = await etapaDoFunil(cliente, ws, funil.funil.id, entrada.etapaId);
        if (etapa.falha) return etapa.falha;
        const regra = validarMovimento({ negocio, funilDestino: funil.funil, etapaDestino: etapa.etapa });
        if (!regra.ok) return recusa<never>(409, regra.error, { codigo: "ETAPA_INVALIDA", ...(regra.field ? { campo: regra.field } : {}) });
        const movido = await repositorio.mover(ws, negocio.id, funil.funil.id, etapa.etapa.id);
        return devolver(cliente, membro, movido);
      });
    },

    async ganhar(membro, id, entrada) {
      return escrita(
        membro,
        "ganhar",
        id,
        async ({ cliente, repositorio, negocio }) => {
          const recusado = exigirAbertoEAtivo(negocio);
          if (recusado) return recusado;
          const ws = membro.workspaceId;
          // A Regra de encerramento é a do Funil NESTE instante, lida na transação (D-05, INV-NEG-05).
          const funil = await criarRepositorioDeFunisPg(cliente).obter(ws, negocio.funilId);
          if (!funil) return naoEncontrado();
          const regra = validarGanho({ negocio, funil, entrada });
          if (!regra.ok) {
            return recusa<never>(409, regra.error, { codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" });
          }
          const ganho = await repositorio.encerrar(ws, negocio.id, {
            situacao: "ganho",
            valor: entrada.valor,
            motivoGanho: entrada.motivoGanho,
            notaEncerramento: entrada.notaEncerramento,
          });
          return devolver(cliente, membro, ganho);
        },
        () => {
          if (entrada.valor === undefined) return undefined;
          const valor = validarValor(entrada.valor);
          return valor.ok ? undefined : valorInvalido(valor);
        },
      );
    },

    async perder(membro, id, entrada) {
      return escrita(membro, "perder", id, async ({ cliente, repositorio, negocio }) => {
        const recusado = exigirAbertoEAtivo(negocio);
        if (recusado) return recusado;
        const ws = membro.workspaceId;
        const funil = await criarRepositorioDeFunisPg(cliente).obter(ws, negocio.funilId);
        if (!funil) return naoEncontrado();
        const regra = validarPerda({ negocio, funil, entrada });
        if (!regra.ok) {
          return recusa<never>(409, regra.error, { codigo: "NEGOCIO_EXIGE_MOTIVO", campo: "motivoPerda" });
        }
        const perdido = await repositorio.encerrar(ws, negocio.id, {
          situacao: "perdido",
          motivoPerda: entrada.motivoPerda,
          notaEncerramento: entrada.notaEncerramento,
        });
        return devolver(cliente, membro, perdido);
      });
    },

    async reabrir(membro, id, entrada) {
      return escrita(membro, "reabrir", id, async ({ cliente, repositorio, negocio }) => {
        if (negocio.estado !== "ativo") return negocioInativo(negocio);
        if (negocio.situacao === "aberto") {
          return recusa<never>(409, "O Negócio já está aberto.", { codigo: "NEGOCIO_ABERTO" });
        }
        const ws = membro.workspaceId;
        const funis = criarRepositorioDeFunisPg(cliente);
        const funilAtual = await funis.obter(ws, negocio.funilId);
        if (!funilAtual) return naoEncontrado();

        // Sem destino, volta à última Etapa; com `funilId` e/ou `etapaId`, vai para a escolhida (RN-NEG-10, RN-FUN-14).
        let destino: { funilId: string; etapaId: string } | undefined;
        let dominio: Parameters<typeof validarReabertura>[0]["destino"];
        if (entrada.funilId !== undefined || entrada.etapaId !== undefined) {
          const funilDeDestino = await criarRepositorioDeFunisPg(cliente).obter(ws, entrada.funilId ?? negocio.funilId);
          if (!funilDeDestino) {
            return recusa<never>(404, "Funil não encontrado.", { codigo: "FUNIL_NAO_ENCONTRADO", campo: "funilId" });
          }
          if (entrada.etapaId === undefined) {
            return recusa<never>(409, "Para reabrir em outro Funil, escolha a Etapa de destino.", {
              codigo: "ETAPA_INVALIDA",
              campo: "etapaId",
            });
          }
          const etapa = await etapaDoFunil(cliente, ws, funilDeDestino.id, entrada.etapaId);
          if (etapa.falha) return etapa.falha;
          destino = { funilId: funilDeDestino.id, etapaId: etapa.etapa.id };
          dominio = { funil: funilDeDestino, etapa: etapa.etapa };
        }
        const regra = validarReabertura({ negocio, funil: funilAtual, destino: dominio });
        if (!regra.ok) {
          return recusa<never>(409, regra.error, {
            codigo: regra.field === "etapaId" ? "ETAPA_INVALIDA" : "FUNIL_INATIVO",
            ...(regra.field ? { campo: regra.field } : {}),
          });
        }
        const reaberto = await repositorio.reabrir(ws, negocio.id, destino);
        return devolver(cliente, membro, reaberto);
      });
    },

    async arquivar(membro, id) {
      return mudarEstado(membro, "arquivar", id, "arquivado", async ({ negocio }) =>
        negocio.estado === "ativo"
          ? undefined
          : recusa<never>(409, "Só um Negócio ativo pode ser arquivado.", { codigo: "TRANSICAO_INVALIDA" }),
      );
    },

    async restaurar(membro, id) {
      return mudarEstado(membro, "restaurar", id, "ativo", async ({ cliente, negocio }) => {
        if (negocio.estado === "ativo") return recusa<never>(409, "O Negócio já está ativo.", { codigo: "TRANSICAO_INVALIDA" });
        if (negocio.situacao !== "aberto") return undefined;
        // RN-NEG-18 / INV-NEG-07: Negócio aberto não volta apontando para Empresa na lixeira.
        if (negocio.empresaId !== null) {
          const empresa = await criarRepositorioDeEmpresasPg(cliente).obter(membro.workspaceId, negocio.empresaId);
          if (empresa?.estado === "na_lixeira") {
            return recusa<never>(409, "A Empresa deste Negócio está na lixeira. Restaure a Empresa ou troque a Empresa do Negócio antes.", {
              codigo: "EMPRESA_NA_LIXEIRA",
              campo: "empresaId",
            });
          }
        }
        // INV-NEG-03: nenhum Negócio aberto referencia Funil arquivado (RN-FUN-14).
        const funil = await criarRepositorioDeFunisPg(cliente).obter(membro.workspaceId, negocio.funilId);
        if (funil && funil.estado !== "ativo") {
          return recusa<never>(409, "O Funil deste Negócio está arquivado. Restaure o Funil antes.", { codigo: "FUNIL_INATIVO", campo: "funilId" });
        }
        return undefined;
      });
    },

    async enviarParaLixeira(membro, id) {
      return mudarEstado(membro, "enviar_para_lixeira", id, "na_lixeira", async ({ negocio }) =>
        negocio.estado === "na_lixeira"
          ? recusa<never>(409, "O Negócio já está na lixeira.", { codigo: "TRANSICAO_INVALIDA" })
          : undefined,
      );
    },

    async excluirPermanentemente(membro, id) {
      return escrita(membro, "excluir_permanentemente", id, async ({ repositorio, negocio }) => {
        if (negocio.estado !== "na_lixeira") {
          return recusa<never>(409, "Envie o Negócio à lixeira antes de excluí-lo permanentemente.", {
            codigo: "NEGOCIO_FORA_DA_LIXEIRA",
          });
        }
        if (!(await repositorio.excluir(membro.workspaceId, negocio.id))) return naoEncontrado();
        return sucesso({ id: negocio.id });
      });
    },
  };
}
