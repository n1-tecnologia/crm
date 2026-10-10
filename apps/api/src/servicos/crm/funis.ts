/**
 * Serviço de Funis e Etapas: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01). Funil não tem Proprietário
 * (INV-FUN-11): `criado_por` é o Membro da sessão, e só.
 *
 * Toda escrita exige o Papel de Administrador ou Proprietário (D-14) ANTES de
 * abrir a transação: `exigir(..., "funil")`. Ler é de todos. Funil de outro
 * Espaço é 404, nunca 403.
 *
 * Os serviços PRÉ-CHECAM as regras para dar a mensagem rica (D-07: quantos
 * Negócios, qual caminho resolve) e o SQLSTATE traduzido por `FRASES` é a rede
 * contra a corrida. Recusa de regra é valor (`recusa`), não exceção; a rota a
 * traduz em HTTP. Valor mal formado é 400 `VALOR_INVALIDO`; regra é 409.
 *
 * `privado` é só gravado (D-10): nenhuma leitura daqui o consulta.
 */

import type { Pool, PoolClient } from "pg";
import type { BloqueiosCrm, EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import {
  chaveDeNome,
  deveNascerPadrao,
  fraseEtapaComNegocios,
  fraseFunilComNegocios,
  fraseFunilComNegociosAbertos,
  LIMITE_DE_ETAPAS_POR_FUNIL,
  validarMigracao,
  validarMudancaDeEstado,
  validarNomeDeEtapa,
  validarNomeDeFunil,
  validarNovoFunil,
  validarNovoPadrao,
  validarPrivacidade,
  validarProbabilidadeDeEtapa,
  validarReordenacao,
  validarRemocaoDeEtapa,
  type EdicaoDeEtapa,
  type EdicaoDeFunil,
  type Etapa,
  type Funil,
  type FunilDetalhado,
  type FunilResumo,
  type MapeamentoDeEtapas,
  type NovaEtapa,
  type NovoFunil,
} from "@n1/dominio/crm/funis";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeFunisPg, type RepositorioDeFunis } from "../../repositorios/crm/funis";
import { exigir, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface FiltroDeFunis {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export type NovaEtapaNoFunil = NovaEtapa & { readonly posicao?: number | undefined };

export interface ServicoDeFunis {
  listar(membro: MembroDaSessao, filtro: FiltroDeFunis): Promise<ResultadoCrm<Pagina<FunilResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  criar(membro: MembroDaSessao, entrada: NovoFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  definirPadrao(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  adicionarEtapa(membro: MembroDaSessao, funilId: string, entrada: NovaEtapaNoFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  editarEtapa(membro: MembroDaSessao, etapaId: string, entrada: EdicaoDeEtapa): Promise<ResultadoCrm<FunilDetalhado>>;
  reordenarEtapas(membro: MembroDaSessao, funilId: string, etapaIds: readonly string[]): Promise<ResultadoCrm<FunilDetalhado>>;
  removerEtapa(membro: MembroDaSessao, etapaId: string): Promise<ResultadoCrm<FunilDetalhado>>;
  remapearEtapa(membro: MembroDaSessao, etapaId: string, paraEtapaId: string): Promise<ResultadoCrm<FunilDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<FunilDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
  migrarNegocios(
    membro: MembroDaSessao,
    id: string,
    entrada: { readonly paraFunilId: string; readonly mapeamento: MapeamentoDeEtapas },
  ): Promise<ResultadoCrm<{ readonly migrados: number }>>;
}

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-07-06). */
const FRASES: FrasesDeRestricao = {
  funis_nome_uq: { codigo: "FUNIL_NOME_EM_USO", error: "Já existe um Funil com este nome." },
  etapas_nome_uq: { codigo: "ETAPA_NOME_EM_USO", error: "Já existe uma Etapa com este nome neste Funil." },
  funis_padrao_uq: { codigo: "FUNIL_PADRAO", error: "O Funil padrão acabou de mudar. Tente de novo." },
  funis_padrao_ck: {
    codigo: "FUNIL_PADRAO",
    error: "O Funil padrão precisa estar ativo e não pode ser privado.",
  },
  etapas_ordem_uq: { codigo: "ORDEM_EM_CONFLITO", error: "A ordem das Etapas mudou enquanto você editava. Tente de novo." },
  negocios_workspace_id_funil_id_fkey: {
    codigo: "FUNIL_COM_NEGOCIOS",
    error: "Este Funil ainda tem Negócios. Migre os Negócios para outro Funil antes.",
  },
  negocios_workspace_id_funil_id_etapa_id_fkey: {
    codigo: "ETAPA_COM_NEGOCIOS",
    error: "Esta Etapa ainda tem Negócios. Remapeie os Negócios para outra Etapa antes.",
  },
};

const naoEncontrado = () => recusa<never>(404, "Funil não encontrado.", { codigo: "FUNIL_NAO_ENCONTRADO" });
const etapaNaoEncontrada = () => recusa<never>(404, "Etapa não encontrada.", { codigo: "ETAPA_NAO_ENCONTRADA" });

/** Valor mal formado (nome vazio, probabilidade fora de 0..100): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

const funilInativo = () => recusa<never>(409, "Restaure o Funil antes de editar.", { codigo: "FUNIL_INATIVO" });

const nomeDeFunilEmUso = () =>
  recusa<never>(409, "Já existe um Funil com este nome.", { codigo: "FUNIL_NOME_EM_USO", campo: "nome" });

const nomeDeEtapaEmUso = () =>
  recusa<never>(409, "Já existe uma Etapa com este nome neste Funil.", { codigo: "ETAPA_NOME_EM_USO", campo: "nome" });

type Cliente = Pool | PoolClient;

async function detalhar(cliente: Cliente, workspaceId: string, funil: Funil): Promise<FunilDetalhado> {
  return { funil, etapas: await criarRepositorioDeFunisPg(cliente).listarEtapas(workspaceId, funil.id) };
}

/** `bloqueios.negocios` de D-07: só a contagem; a tela lista os Negócios pela rota deles. */
function bloqueioDeNegocios(total: number): BloqueiosCrm {
  return { negocios: { total, itens: [] } };
}

export function criarServicoDeFunis(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeFunis {
  interface Contexto {
    readonly cliente: PoolClient;
    readonly repositorio: RepositorioDeFunis;
    readonly funil: Funil;
  }

  /**
   * Papel primeiro (um Membro nunca descobre se o corpo era válido); depois a
   * validação de forma, sem banco; depois a transação. O Funil é carregado
   * travado e tem de existir NESTE Espaço. Com `soAtivo`, Funil arquivado ou na
   * lixeira é 409 `FUNIL_INATIVO` (edição de atributos e de Etapas).
   */
  async function escrita<T>(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    corpo: (contexto: Contexto) => Promise<ResultadoCrm<T>>,
    opcoes: { readonly soAtivo?: boolean; readonly validar?: () => ResultadoCrm<never> | undefined } = {},
  ): Promise<ResultadoCrm<T>> {
    const negado = await exigir(deps.acesso, membro, acao, "funil");
    if (negado) return { ok: false, ...negado };
    const invalido = opcoes.validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        const repositorio = criarRepositorioDeFunisPg(cliente);
        const funil = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!funil) return naoEncontrado();
        if (opcoes.soAtivo && funil.estado !== "ativo") return funilInativo();
        return corpo({ cliente, repositorio, funil });
      },
      FRASES,
    );
  }

  /** O mesmo, partindo de uma Etapa: acha o Funil dela NESTE Espaço, trava e relê a Etapa. */
  async function escritaDeEtapa<T>(
    membro: MembroDaSessao,
    etapaId: string,
    corpo: (contexto: Contexto & { etapa: Etapa }) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    const negado = await exigir(deps.acesso, membro, "editar", "funil");
    if (negado) return { ok: false, ...negado };
    const invalido = validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        const repositorio = criarRepositorioDeFunisPg(cliente);
        const anterior = await repositorio.obterEtapa(membro.workspaceId, etapaId);
        if (!anterior) return etapaNaoEncontrada();
        const funil = await repositorio.obter(membro.workspaceId, anterior.funilId, { travar: true });
        if (!funil) return etapaNaoEncontrada();
        // Relida depois do travamento: outra requisição pode ter removido a Etapa no meio.
        const etapa = await repositorio.obterEtapa(membro.workspaceId, etapaId);
        if (!etapa) return etapaNaoEncontrada();
        if (funil.estado !== "ativo") return funilInativo();
        return corpo({ cliente, repositorio, funil, etapa });
      },
      FRASES,
    );
  }

  /** O nome (sem caixa nem espaços nas pontas) já é de outra Etapa do Funil? */
  function etapaComEsteNome(nome: string, etapas: readonly Etapa[], exceto?: string): boolean {
    const chave = chaveDeNome(nome);
    return etapas.some((etapa) => etapa.id !== exceto && chaveDeNome(etapa.nome) === chave);
  }

  async function devolver(cliente: Cliente, membro: MembroDaSessao, funil: Funil): Promise<ResultadoCrm<FunilDetalhado>> {
    return sucesso(await detalhar(cliente, membro.workspaceId, funil));
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "funil");
      if (negado) return { ok: false, ...negado };
      return sucesso(
        await criarRepositorioDeFunisPg(deps.pool()).listar(membro.workspaceId, {
          estado: filtro.estado,
          q: filtro.q,
          limite: filtro.limite,
          deslocamento: filtro.deslocamento,
        }),
      );
    },

    async obter(membro, id) {
      const negado = await exigir(deps.acesso, membro, "ler", "funil");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const funil = await criarRepositorioDeFunisPg(cliente).obter(membro.workspaceId, id);
      if (!funil) return naoEncontrado();
      return devolver(cliente, membro, funil);
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "funil");
      if (negado) return { ok: false, ...negado };
      const validacao = validarNovoFunil(entrada);
      if (!validacao.ok) return valorInvalido(validacao);

      return comTransacao(
        deps.pool,
        async (cliente) => {
          const repositorio = criarRepositorioDeFunisPg(cliente);
          // D-13: duas criações simultâneas não decidem o padrão ao mesmo tempo.
          await repositorio.travarPadrao(membro.workspaceId);
          if (await repositorio.nomeEmUso(membro.workspaceId, entrada.nome)) return nomeDeFunilEmUso();
          const privado = entrada.privado ?? false;
          const padrao = deveNascerPadrao(await repositorio.existePadrao(membro.workspaceId), privado);
          const funil = await repositorio.inserirFunil(membro.workspaceId, {
            nome: entrada.nome,
            descricao: entrada.descricao,
            cor: entrada.cor,
            privado,
            padrao,
            exigeMotivoPerda: entrada.exigeMotivoPerda ?? false,
            exigeValorGanho: entrada.exigeValorGanho ?? false,
            criadoPor: membro.id,
          });
          for (const [indice, etapa] of entrada.etapas.entries()) {
            await repositorio.inserirEtapa(membro.workspaceId, {
              funilId: funil.id,
              nome: etapa.nome,
              ordem: indice + 1,
              probabilidadePadrao: etapa.probabilidadePadrao ?? 0,
              cor: etapa.cor,
              descricao: etapa.descricao,
            });
          }
          return devolver(cliente, membro, funil);
        },
        FRASES,
      );
    },

    async editar(membro, id, entrada) {
      return escrita(
        membro,
        "editar",
        id,
        async ({ cliente, repositorio, funil }) => {
          if (entrada.privado === true) {
            const privacidade = validarPrivacidade(funil, true);
            if (!privacidade.ok) return recusa<never>(409, privacidade.error, { codigo: "FUNIL_PADRAO", campo: "privado" });
          }
          if (entrada.nome !== undefined && (await repositorio.nomeEmUso(membro.workspaceId, entrada.nome, funil.id))) {
            return nomeDeFunilEmUso();
          }
          const atualizado = await repositorio.atualizarFunil(membro.workspaceId, funil.id, entrada);
          if (!atualizado) return naoEncontrado();
          return devolver(cliente, membro, atualizado);
        },
        {
          soAtivo: true,
          validar: () => {
            if (entrada.nome === undefined) return undefined;
            const nome = validarNomeDeFunil(entrada.nome);
            return nome.ok ? undefined : valorInvalido(nome);
          },
        },
      );
    },

    async definirPadrao(membro, id) {
      return escrita(membro, "definir_padrao", id, async ({ cliente, repositorio, funil }) => {
        await repositorio.travarPadrao(membro.workspaceId);
        if (funil.padrao) return devolver(cliente, membro, funil);
        const elegivel = validarNovoPadrao(funil);
        if (!elegivel.ok) {
          return recusa<never>(409, elegivel.error, { codigo: funil.estado !== "ativo" ? "FUNIL_INATIVO" : "FUNIL_PRIVADO" });
        }
        // O índice parcial `funis_padrao_uq` não é deferrable: o antigo sai antes de o novo entrar.
        await repositorio.desmarcarPadrao(membro.workspaceId);
        const novo = await repositorio.marcarPadrao(membro.workspaceId, funil.id);
        if (!novo) return naoEncontrado();
        return devolver(cliente, membro, novo);
      });
    },

    async adicionarEtapa(membro, funilId, entrada) {
      return escrita(
        membro,
        "editar",
        funilId,
        async ({ cliente, repositorio, funil }) => {
          const etapas = await repositorio.listarEtapas(membro.workspaceId, funil.id);
          if (etapas.length >= LIMITE_DE_ETAPAS_POR_FUNIL) {
            return recusa<never>(409, `Um Funil tem no máximo ${LIMITE_DE_ETAPAS_POR_FUNIL} Etapas.`, { codigo: "LIMITE_DE_ETAPAS" });
          }
          if (etapaComEsteNome(entrada.nome, etapas)) return nomeDeEtapaEmUso();
          const posicao = Math.min(Math.max(entrada.posicao ?? etapas.length + 1, 1), etapas.length + 1);
          if (posicao <= etapas.length) await repositorio.deslocarOrdens(membro.workspaceId, funil.id, posicao);
          await repositorio.inserirEtapa(membro.workspaceId, {
            funilId: funil.id,
            nome: entrada.nome,
            ordem: posicao,
            probabilidadePadrao: entrada.probabilidadePadrao ?? 0,
            cor: entrada.cor,
            descricao: entrada.descricao,
          });
          return devolver(cliente, membro, funil);
        },
        { soAtivo: true, validar: () => validarEtapa(entrada) },
      );
    },

    async editarEtapa(membro, etapaId, entrada) {
      return escritaDeEtapa(
        membro,
        etapaId,
        async ({ cliente, repositorio, funil, etapa }) => {
          if (entrada.nome !== undefined) {
            const etapas = await repositorio.listarEtapas(membro.workspaceId, funil.id);
            if (etapaComEsteNome(entrada.nome, etapas, etapa.id)) return nomeDeEtapaEmUso();
          }
          const atualizada = await repositorio.atualizarEtapa(membro.workspaceId, etapa.id, entrada);
          if (!atualizada) return etapaNaoEncontrada();
          return devolver(cliente, membro, funil);
        },
        () => validarEtapa(entrada),
      );
    },

    async reordenarEtapas(membro, funilId, etapaIds) {
      return escrita(
        membro,
        "editar",
        funilId,
        async ({ cliente, repositorio, funil }) => {
          const etapas = await repositorio.listarEtapas(membro.workspaceId, funil.id);
          const ordem = validarReordenacao(
            etapas.map((etapa) => etapa.id),
            etapaIds,
          );
          if (!ordem.ok) return recusa<never>(409, ordem.error, { codigo: "ORDEM_INVALIDA", campo: "etapaIds" });
          // Pitfall 7: UM comando com a permutação completa; `etapas_ordem_uq` só é conferida no fim dele.
          await repositorio.reordenar(membro.workspaceId, funil.id, etapaIds);
          return devolver(cliente, membro, funil);
        },
        { soAtivo: true },
      );
    },

    async removerEtapa(membro, etapaId) {
      return escritaDeEtapa(membro, etapaId, async ({ cliente, repositorio, funil, etapa }) => {
        const etapas = await repositorio.listarEtapas(membro.workspaceId, funil.id);
        const ultima = validarRemocaoDeEtapa(etapas.length);
        if (!ultima.ok) return recusa<never>(409, ultima.error, { codigo: "ULTIMA_ETAPA" });
        // D-07: Negócio em qualquer situação e estado (inclusive a lixeira) segura a Etapa; a saída é remapear.
        const negocios = await repositorio.contarNegocios(membro.workspaceId, { funilId: funil.id, etapaId: etapa.id });
        if (negocios.total > 0) {
          return recusa<never>(409, fraseEtapaComNegocios(negocios.total), {
            codigo: "ETAPA_COM_NEGOCIOS",
            bloqueios: bloqueioDeNegocios(negocios.total),
          });
        }
        if (!(await repositorio.removerEtapa(membro.workspaceId, funil.id, etapa.id))) return etapaNaoEncontrada();
        return devolver(cliente, membro, funil);
      });
    },

    async remapearEtapa(membro, etapaId, paraEtapaId) {
      return escritaDeEtapa(membro, etapaId, async ({ cliente, repositorio, funil, etapa }) => {
        if (paraEtapaId === etapa.id) {
          return recusa<never>(409, "Escolha outra Etapa como destino.", { codigo: "ETAPA_DESTINO_INVALIDA", campo: "paraEtapaId" });
        }
        const destino = await repositorio.obterEtapa(membro.workspaceId, paraEtapaId);
        if (!destino) return recusa<never>(404, "Etapa de destino não encontrada.", { codigo: "ETAPA_NAO_ENCONTRADA" });
        if (destino.funilId !== funil.id) {
          return recusa<never>(409, "A Etapa de destino precisa ser do mesmo Funil.", {
            codigo: "ETAPA_DESTINO_INVALIDA",
            campo: "paraEtapaId",
          });
        }
        const etapas = await repositorio.listarEtapas(membro.workspaceId, funil.id);
        const ultima = validarRemocaoDeEtapa(etapas.length);
        if (!ultima.ok) return recusa<never>(409, ultima.error, { codigo: "ULTIMA_ETAPA" });
        // RN-FUN-08: remapear não avalia Requisitos nem Transições e não toca a probabilidade do Negócio.
        await repositorio.remapear(membro.workspaceId, funil.id, etapa.id, destino.id);
        if (!(await repositorio.removerEtapa(membro.workspaceId, funil.id, etapa.id))) return etapaNaoEncontrada();
        return devolver(cliente, membro, funil);
      });
    },

    async arquivar(membro, id) {
      return escrita(membro, "arquivar", id, async ({ cliente, repositorio, funil }) => {
        if (funil.estado !== "ativo") {
          return recusa<never>(409, "Só um Funil ativo pode ser arquivado.", { codigo: "TRANSICAO_INVALIDA" });
        }
        const estado = validarMudancaDeEstado(funil, "arquivado");
        if (!estado.ok) return recusa<never>(409, estado.error, { codigo: "FUNIL_PADRAO" });
        // RN-FUN-12: Negócio aberto, em qualquer estado, segura o arquivamento; ganho e perdido ficam no Funil arquivado.
        const abertos = await repositorio.contarNegocios(membro.workspaceId, { funilId: funil.id, apenasAbertos: true });
        if (abertos.total > 0) {
          return recusa<never>(409, fraseFunilComNegociosAbertos(abertos.total), {
            codigo: "FUNIL_COM_NEGOCIOS_ABERTOS",
            bloqueios: bloqueioDeNegocios(abertos.total),
          });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, funil.id, "arquivado");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async restaurar(membro, id) {
      return escrita(membro, "restaurar", id, async ({ cliente, repositorio, funil }) => {
        if (funil.estado === "ativo") {
          return recusa<never>(409, "O Funil já está ativo.", { codigo: "TRANSICAO_INVALIDA" });
        }
        // RN-FUN-02: na lixeira o nome estava livre; voltar com ele reusado é recusado até renomear.
        if (await repositorio.nomeEmUso(membro.workspaceId, funil.nome, funil.id)) {
          return recusa<never>(409, "Já existe outro Funil com este nome. Renomeie um dos dois antes de restaurar.", {
            codigo: "FUNIL_NOME_EM_USO",
            campo: "nome",
          });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, funil.id, "ativo");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async enviarParaLixeira(membro, id) {
      return escrita(membro, "enviar_para_lixeira", id, async ({ cliente, repositorio, funil }) => {
        if (funil.estado === "na_lixeira") {
          return recusa<never>(409, "O Funil já está na lixeira.", { codigo: "TRANSICAO_INVALIDA" });
        }
        const estado = validarMudancaDeEstado(funil, "na_lixeira");
        if (!estado.ok) return recusa<never>(409, estado.error, { codigo: "FUNIL_PADRAO" });
        // D-07 / RN-FUN-13: nenhum Negócio, de nenhuma situação nem estado, pode referenciar o Funil.
        const negocios = await repositorio.contarNegocios(membro.workspaceId, { funilId: funil.id });
        if (negocios.total > 0) {
          return recusa<never>(409, fraseFunilComNegocios(negocios.total), {
            codigo: "FUNIL_COM_NEGOCIOS",
            bloqueios: bloqueioDeNegocios(negocios.total),
          });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, funil.id, "na_lixeira");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async excluirPermanentemente(membro, id) {
      return escrita(membro, "excluir_permanentemente", id, async ({ repositorio, funil }) => {
        if (funil.estado !== "na_lixeira") {
          return recusa<never>(409, "Envie o Funil à lixeira antes de excluí-lo permanentemente.", {
            codigo: "FUNIL_FORA_DA_LIXEIRA",
          });
        }
        const negocios = await repositorio.contarNegocios(membro.workspaceId, { funilId: funil.id });
        if (negocios.total > 0) {
          return recusa<never>(409, fraseFunilComNegocios(negocios.total), {
            codigo: "FUNIL_COM_NEGOCIOS",
            bloqueios: bloqueioDeNegocios(negocios.total),
          });
        }
        // O `delete` cascateia as Etapas (composição, funis.md 12).
        if (!(await repositorio.excluir(membro.workspaceId, funil.id))) return naoEncontrado();
        return sucesso({ id: funil.id });
      });
    },

    async migrarNegocios(membro, id, entrada) {
      return escrita(membro, "mover", id, async ({ repositorio, funil }) => {
        // T-07-15: o destino é lido com o `workspace_id` da sessão; Funil de outro Espaço não existe aqui.
        const destino = await repositorio.obter(membro.workspaceId, entrada.paraFunilId, { travar: true });
        if (!destino) return recusa<never>(404, "Funil de destino não encontrado.", { codigo: "FUNIL_NAO_ENCONTRADO" });

        const etapasDeOrigem = await repositorio.listarEtapas(membro.workspaceId, funil.id);
        const etapasDoDestino = await repositorio.listarEtapas(membro.workspaceId, destino.id);
        const validacao = validarMigracao({
          origem: funil,
          destino,
          etapasDoDestino,
          etapasDeOrigemComNegocios: etapasDeOrigem.filter((etapa) => etapa.negocios.total > 0).map((etapa) => etapa.id),
          mapeamento: entrada.mapeamento,
        });
        if (!validacao.ok) {
          return recusa<never>(409, validacao.error, {
            codigo: "MIGRACAO_INVALIDA",
            ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
          });
        }
        // Só pares cuja origem é Etapa deste Funil: uma chave estranha não move nada.
        const daOrigem = new Set(etapasDeOrigem.map((etapa) => etapa.id));
        const mapeamento = Object.fromEntries(Object.entries(entrada.mapeamento).filter(([de]) => daOrigem.has(de)));
        const migrados = await repositorio.migrar(membro.workspaceId, funil.id, destino.id, mapeamento);
        return sucesso({ migrados });
      });
    },
  };
}

/** Nome e probabilidade de uma Etapa que chega do cliente: forma, sem banco. */
function validarEtapa(entrada: { readonly nome?: string | undefined; readonly probabilidadePadrao?: number | undefined }) {
  if (entrada.nome !== undefined) {
    const nome = validarNomeDeEtapa(entrada.nome, []);
    if (!nome.ok) return valorInvalido(nome);
  }
  const probabilidade = validarProbabilidadeDeEtapa(entrada.probabilidadePadrao);
  return probabilidade.ok ? undefined : valorInvalido(probabilidade);
}
