/**
 * Serviço de Contatos: a regra entre a rota e o repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01/T-07-02). O Papel é exigido
 * ANTES de ler ou escrever (D-14). Sem Proprietário informado, o Proprietário
 * é o Membro da sessão; informado, tem de ser Membro ativo do mesmo Espaço
 * (D-11). O `criado_por` é sempre o Membro da sessão.
 *
 * Toda escrita roda em `comTransacao`. O serviço PRÉ-CHECA as regras para dar
 * a mensagem rica (RN-CON-11, D-09) e o SQLSTATE traduzido por `FRASES_DE_CONTATOS` é a
 * rede contra a corrida. Registro de outro Espaço é 404, nunca 403 (D-10).
 * Recusa de regra é valor (`recusa`), não exceção; a rota a traduz em HTTP.
 */

import type { Pool, PoolClient } from "pg";
import type { BloqueiosCrm, EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import { LIMITES_CRM, validarCamposAdicionais, validarEnderecos } from "@n1/dominio/crm/comum";
import {
  fraseDeContatoBloqueado,
  fraseDeIdentificadorEmUso,
  primeiroDoTipo,
  validarContato,
  validarIdentificadorDeContato,
  type Contato,
  type ContatoDetalhado,
  type ContatoResumo,
  type EdicaoDeContato,
  type EdicaoDeIdentificador,
  type NovoContato,
  type NovoIdentificadorDeContato,
} from "@n1/dominio/crm/contatos";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg, type RepositorioDeContatos } from "../../repositorios/crm/contatos";
import { empresasEmQueEhUnicoAdmin, listarDoContato } from "../../repositorios/crm/vinculos";
import { exigir, resolverProprietario, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface FiltroDeContatos {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

export interface ServicoDeContatos {
  listar(membro: MembroDaSessao, filtro: FiltroDeContatos): Promise<ResultadoCrm<Pagina<ContatoResumo>>>;
  criar(membro: MembroDaSessao, entrada: NovoContato): Promise<ResultadoCrm<ContatoDetalhado>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeContato): Promise<ResultadoCrm<ContatoDetalhado>>;
  adicionarIdentificador(
    membro: MembroDaSessao,
    id: string,
    entrada: NovoIdentificadorDeContato,
  ): Promise<ResultadoCrm<ContatoDetalhado>>;
  editarIdentificador(
    membro: MembroDaSessao,
    id: string,
    identificadorId: string,
    entrada: EdicaoDeIdentificador,
  ): Promise<ResultadoCrm<ContatoDetalhado>>;
  removerIdentificador(membro: MembroDaSessao, id: string, identificadorId: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  restaurar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<ContatoDetalhado>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-07-06). */
export const FRASES_DE_CONTATOS: FrasesDeRestricao = {
  contato_identificadores_unico: { codigo: "IDENTIFICADOR_EM_USO", error: "Este Identificador já pertence a outro Contato." },
  contato_identificadores_principal_uq: {
    codigo: "PRINCIPAL_DUPLICADO",
    error: "Este Contato já tem um Identificador principal desse tipo. Tente de novo.",
  },
  empresa_exige_admin: {
    codigo: "CONTATO_BLOQUEADO",
    error: "Este Contato é o único admin de uma Empresa. Nomeie outro admin antes.",
  },
  negocios_workspace_id_contato_id_fkey: {
    codigo: "CONTATO_COM_NEGOCIOS",
    error: "Este Contato ainda tem Negócios. Troque o Contato deles antes.",
  },
  // 008: a Conversa referencia o Contato; a pré-checagem dá a frase rica, esta é a rede contra corrida.
  conversas_workspace_id_contato_id_fkey: {
    codigo: "CONTATO_COM_CONVERSAS",
    error: "Este Contato tem Conversas na Caixa de Entrada e não pode ser excluído permanentemente.",
  },
};

const naoEncontrado = () => recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });

/** Valor mal formado (normalização, limites): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

function semNomeNemIdentificador(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(409, falha.error, {
    codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR",
    ...(falha.field !== undefined ? { campo: falha.field } : {}),
  });
}

function contatoInativo() {
  return recusa<never>(409, "Restaure o Contato antes de editar.", { codigo: "CONTATO_INATIVO" });
}

type Cliente = Pool | PoolClient;

async function detalhar(cliente: Cliente, workspaceId: string, contato: Contato): Promise<ContatoDetalhado> {
  const repositorio = criarRepositorioDeContatosPg(cliente);
  // Em sequência: um PoolClient não deve receber consultas concorrentes.
  const identificadores = await repositorio.listarIdentificadores(workspaceId, contato.id);
  const vinculos = await listarDoContato(cliente, workspaceId, contato.id);
  return { contato, identificadores, vinculos };
}

export function criarServicoDeContatos(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeContatos {
  /**
   * Papel primeiro (um Convidado nunca descobre se o corpo era válido); depois a validação
   * de forma, sem banco; depois a transação. O Contato é carregado travado e tem de existir
   * NESTE Espaço.
   */
  async function escrita<T>(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    corpo: (contexto: { cliente: PoolClient; repositorio: RepositorioDeContatos; contato: Contato }) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    const negado = await exigir(deps.acesso, membro, acao, "contato");
    if (negado) return { ok: false, ...negado };
    const invalido = validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        const repositorio = criarRepositorioDeContatosPg(cliente);
        const contato = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!contato) return naoEncontrado();
        return corpo({ cliente, repositorio, contato });
      },
      FRASES_DE_CONTATOS,
    );
  }

  /** Edição de dados e de Identificadores: só de Contato `ativo` (contatos.md, estados). */
  async function edicao<T>(
    membro: MembroDaSessao,
    id: string,
    corpo: (contexto: { cliente: PoolClient; repositorio: RepositorioDeContatos; contato: Contato }) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    return escrita(
      membro,
      "editar",
      id,
      async (contexto) => {
        if (contexto.contato.estado !== "ativo") return contatoInativo();
        return corpo(contexto);
      },
      validar,
    );
  }

  async function devolver(cliente: Cliente, membro: MembroDaSessao, contato: Contato): Promise<ResultadoCrm<ContatoDetalhado>> {
    return sucesso(await detalhar(cliente, membro.workspaceId, contato));
  }

  /** RN-CON-11: o (tipo, valor) já é de outro Contato do Espaço — 409 nomeando o detentor. */
  async function conferirUnicidade(
    repositorio: RepositorioDeContatos,
    workspaceId: string,
    contatoId: string | undefined,
    identificador: NovoIdentificadorDeContato,
  ): Promise<ResultadoCrm<never> | undefined> {
    const detentor = await repositorio.detentorDoIdentificador(workspaceId, identificador.tipo, identificador.valor);
    if (!detentor) return undefined;
    if (detentor.contatoId === contatoId) {
      return recusa<never>(409, "Este Contato já tem este Identificador.", { codigo: "IDENTIFICADOR_EM_USO", campo: "valor" });
    }
    return recusa<never>(409, fraseDeIdentificadorEmUso(identificador.tipo, identificador.valor, detentor.nome), {
      codigo: "IDENTIFICADOR_EM_USO",
      campo: "valor",
      bloqueios: { contatos: [{ id: detentor.contatoId, nome: detentor.nome }] },
    });
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "contato");
      if (negado) return { ok: false, ...negado };
      const repositorio = criarRepositorioDeContatosPg(deps.pool());
      return sucesso(
        await repositorio.listar(membro.workspaceId, {
          estado: filtro.estado,
          q: filtro.q,
          limite: filtro.limite,
          deslocamento: filtro.deslocamento,
        }),
      );
    },

    async obter(membro, id) {
      const negado = await exigir(deps.acesso, membro, "ler", "contato");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, id);
      if (!contato) return naoEncontrado();
      return devolver(cliente, membro, contato);
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "contato");
      if (negado) return { ok: false, ...negado };

      const validacao = validarContato(entrada);
      if (!validacao.ok) return semNomeNemIdentificador(validacao);
      const enderecos = validarEnderecos(entrada.enderecos);
      if (!enderecos.ok) return valorInvalido(enderecos);
      const campos = validarCamposAdicionais(entrada.camposAdicionais);
      if (!campos.ok) return valorInvalido(campos);

      const identificadores: NovoIdentificadorDeContato[] = [];
      const vistos = new Set<string>();
      for (const bruto of entrada.identificadores ?? []) {
        const normalizado = validarIdentificadorDeContato(bruto);
        if (!normalizado.ok) return valorInvalido({ error: normalizado.error, field: "identificadores" });
        const chave = `${normalizado.value.tipo}:${normalizado.value.valor}`;
        if (vistos.has(chave)) {
          return valorInvalido({ error: `${normalizado.value.valor} aparece mais de uma vez.`, field: "identificadores" });
        }
        vistos.add(chave);
        identificadores.push(normalizado.value);
      }

      const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
      if (!proprietario.ok) return proprietario;

      const { identificadores: _identificadores, proprietarioId: _proprietarioId, ...dados } = entrada;
      return comTransacao(
        deps.pool,
        async (cliente) => {
          const repositorio = criarRepositorioDeContatosPg(cliente);
          for (const identificador of identificadores) {
            const emUso = await conferirUnicidade(repositorio, membro.workspaceId, undefined, identificador);
            if (emUso) return emUso;
          }
          // `modo_criacao` é sempre `manual` aqui; os outros modos nascem de importação e de Mensagem.
          const contato = await repositorio.inserir(membro.workspaceId, {
            ...dados,
            modoCriacao: "manual",
            proprietarioId: proprietario.valor,
            criadoPor: membro.id,
          });
          const gravados: { tipo: NovoIdentificadorDeContato["tipo"] }[] = [];
          for (const identificador of identificadores) {
            await repositorio.inserirIdentificador(membro.workspaceId, contato.id, {
              ...identificador,
              principal: primeiroDoTipo(gravados, identificador.tipo),
            });
            gravados.push({ tipo: identificador.tipo });
          }
          return devolver(cliente, membro, contato);
        },
        FRASES_DE_CONTATOS,
      );
    },

    async editar(membro, id, entrada) {
      const validar = () => {
        const enderecos = validarEnderecos(entrada.enderecos);
        if (!enderecos.ok) return valorInvalido(enderecos);
        const campos = validarCamposAdicionais(entrada.camposAdicionais);
        if (!campos.ok) return valorInvalido(campos);
        return undefined;
      };
      return edicao(
        membro,
        id,
        async ({ cliente, repositorio, contato }) => {
          let proprietarioId: string | undefined;
          if (entrada.proprietarioId !== undefined) {
            const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
            if (!proprietario.ok) return proprietario;
            proprietarioId = proprietario.valor;
          }
          const identificadores = await repositorio.listarIdentificadores(membro.workspaceId, contato.id);
          const nomeFinal = entrada.nome !== undefined ? entrada.nome : contato.nome;
          const validacao = validarContato({ nome: nomeFinal, identificadores });
          if (!validacao.ok) return semNomeNemIdentificador(validacao);

          const atualizado = await repositorio.atualizar(membro.workspaceId, contato.id, {
            ...entrada,
            ...(proprietarioId !== undefined ? { proprietarioId } : {}),
          });
          if (!atualizado) return naoEncontrado();
          return devolver(cliente, membro, atualizado);
        },
        validar,
      );
    },

    async adicionarIdentificador(membro, id, entrada) {
      const normalizado = validarIdentificadorDeContato(entrada);
      return edicao(
        membro,
        id,
        async ({ cliente, repositorio, contato }) => {
          if (!normalizado.ok) return valorInvalido(normalizado);
          const emUso = await conferirUnicidade(repositorio, membro.workspaceId, contato.id, normalizado.value);
          if (emUso) return emUso;
          const existentes = await repositorio.listarIdentificadores(membro.workspaceId, contato.id);
          if (existentes.length >= LIMITES_CRM.identificadoresMaximo) {
            return valorInvalido({
              error: `Um Contato tem no máximo ${LIMITES_CRM.identificadoresMaximo} Identificadores.`,
              field: "identificadores",
            });
          }
          await repositorio.inserirIdentificador(membro.workspaceId, contato.id, {
            ...normalizado.value,
            principal: primeiroDoTipo(existentes, normalizado.value.tipo),
          });
          return devolver(cliente, membro, contato);
        },
        () => (normalizado.ok ? undefined : valorInvalido(normalizado)),
      );
    },

    async editarIdentificador(membro, id, identificadorId, entrada) {
      return edicao(membro, id, async ({ cliente, repositorio, contato }) => {
        const identificador = await repositorio.obterIdentificador(membro.workspaceId, contato.id, identificadorId);
        if (!identificador) {
          return recusa<never>(404, "Identificador não encontrado.", { codigo: "IDENTIFICADOR_NAO_ENCONTRADO" });
        }
        if (entrada.principal === false && identificador.principal) {
          return recusa<never>(409, "Escolha outro Identificador desse tipo como principal; o principal troca quando outro é promovido.", {
            codigo: "PRINCIPAL_OBRIGATORIO",
            campo: "principal",
          });
        }
        if (entrada.principal === true && !identificador.principal) {
          // INV-CON-03, na mesma transação: rebaixa o atual antes de promover o novo.
          await repositorio.rebaixarPrincipal(membro.workspaceId, contato.id, identificador.tipo);
        }
        await repositorio.atualizarIdentificador(membro.workspaceId, identificador.id, {
          principal: entrada.principal === true ? true : undefined,
          verificado: entrada.verificado,
          valorExibido: entrada.valorExibido,
          rotuloCanal: entrada.rotuloCanal,
        });
        return devolver(cliente, membro, contato);
      });
    },

    async removerIdentificador(membro, id, identificadorId) {
      return edicao(membro, id, async ({ cliente, repositorio, contato }) => {
        const existentes = await repositorio.listarIdentificadores(membro.workspaceId, contato.id);
        const alvo = existentes.find((identificador) => identificador.id === identificadorId);
        if (!alvo) return recusa<never>(404, "Identificador não encontrado.", { codigo: "IDENTIFICADOR_NAO_ENCONTRADO" });
        const restantes = existentes.filter((identificador) => identificador.id !== alvo.id);
        const validacao = validarContato({ nome: contato.nome, identificadores: restantes });
        if (!validacao.ok) return semNomeNemIdentificador(validacao);

        await repositorio.removerIdentificador(membro.workspaceId, alvo.id);
        if (alvo.principal) {
          // Promove o mais antigo do mesmo tipo (a lista já vem por `criado_em`).
          const proximo = restantes.find((identificador) => identificador.tipo === alvo.tipo);
          if (proximo) await repositorio.atualizarIdentificador(membro.workspaceId, proximo.id, { principal: true });
        }
        return devolver(cliente, membro, contato);
      });
    },

    async arquivar(membro, id) {
      return escrita(membro, "arquivar", id, async ({ cliente, repositorio, contato }) => {
        if (contato.estado !== "ativo") {
          return recusa<never>(409, "Só um Contato ativo pode ser arquivado.", { codigo: "TRANSICAO_INVALIDA" });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, contato.id, "arquivado");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async restaurar(membro, id) {
      return escrita(membro, "restaurar", id, async ({ cliente, repositorio, contato }) => {
        if (contato.estado === "ativo") {
          return recusa<never>(409, "O Contato já está ativo.", { codigo: "TRANSICAO_INVALIDA" });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, contato.id, "ativo");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async enviarParaLixeira(membro, id) {
      return escrita(membro, "enviar_para_lixeira", id, async ({ cliente, repositorio, contato }) => {
        if (contato.estado === "na_lixeira") {
          return recusa<never>(409, "O Contato já está na lixeira.", { codigo: "TRANSICAO_INVALIDA" });
        }
        // D-09: a lixeira não toca `contato_empresa`, então o trigger da 007 não protege — a checagem é daqui.
        const empresas = await empresasEmQueEhUnicoAdmin(cliente, membro.workspaceId, contato.id);
        const negocios = await repositorio.negociosDoContato(membro.workspaceId, contato.id, { incluirLixeira: false });
        if (empresas.length > 0 || negocios.total > 0) {
          const bloqueios: BloqueiosCrm = {
            ...(empresas.length > 0 ? { empresas } : {}),
            ...(negocios.total > 0 ? { negocios } : {}),
          };
          return recusa<never>(409, fraseDeContatoBloqueado(bloqueios), { codigo: "CONTATO_BLOQUEADO", bloqueios });
        }
        const atualizado = await repositorio.definirEstado(membro.workspaceId, contato.id, "na_lixeira");
        if (!atualizado) return naoEncontrado();
        return devolver(cliente, membro, atualizado);
      });
    },

    async excluirPermanentemente(membro, id) {
      return escrita(membro, "excluir_permanentemente", id, async ({ cliente, repositorio, contato }) => {
        if (contato.estado !== "na_lixeira") {
          return recusa<never>(409, "Envie o Contato à lixeira antes de excluí-lo permanentemente.", {
            codigo: "CONTATO_FORA_DA_LIXEIRA",
          });
        }
        const negocios = await repositorio.negociosDoContato(membro.workspaceId, contato.id, { incluirLixeira: true });
        if (negocios.total > 0) {
          return recusa<never>(
            409,
            negocios.total === 1
              ? "Este Contato tem 1 Negócio. Troque o Contato do Negócio antes de excluí-lo."
              : `Este Contato tem ${negocios.total} Negócios. Troque o Contato deles antes de excluí-lo.`,
            { codigo: "CONTATO_COM_NEGOCIOS", bloqueios: { negocios } },
          );
        }
        const conversas = await repositorio.conversasDoContato(membro.workspaceId, contato.id);
        if (conversas.total > 0) {
          return recusa<never>(
            409,
            conversas.total === 1
              ? "Este Contato tem 1 Conversa na Caixa de Entrada e não pode ser excluído permanentemente."
              : `Este Contato tem ${conversas.total} Conversas na Caixa de Entrada e não pode ser excluído permanentemente.`,
            { codigo: "CONTATO_COM_CONVERSAS", bloqueios: { conversas } },
          );
        }
        // O `delete` cascateia o vínculo e o trigger recusaria no commit; antecipar dá a mensagem rica.
        const empresas = await empresasEmQueEhUnicoAdmin(cliente, membro.workspaceId, contato.id);
        if (empresas.length > 0) {
          const bloqueios: BloqueiosCrm = { empresas };
          return recusa<never>(409, fraseDeContatoBloqueado(bloqueios), { codigo: "CONTATO_BLOQUEADO", bloqueios });
        }
        if (!(await repositorio.excluir(membro.workspaceId, contato.id))) return naoEncontrado();
        return sucesso({ id: contato.id });
      });
    },
  };
}
