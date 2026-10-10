/**
 * Serviço de Empresas e dos vínculos Contato-Empresa: a regra entre a rota e o
 * repositório.
 *
 * O Espaço de Trabalho e o autor vêm SEMPRE de `membro` (a sessão) — nada que
 * chegue no corpo os substitui (D-10, T-07-01/T-07-02). O Papel é exigido ANTES
 * de ler ou escrever (D-14). Sem Proprietário informado, o Proprietário é o
 * Membro da sessão; informado, tem de ser Membro ativo do mesmo Espaço (D-11).
 *
 * D-08 é o coração: toda Empresa tem ao menos um Contato admin vigente. Criar
 * grava Empresa, Contato novo (se houver) e vínculo admin numa transação só; a
 * lixeira encerra os vínculos vigentes e preserva os Contatos; restaurar da
 * lixeira exige indicar o admin; rebaixar ou encerrar o último admin é recusado.
 * O constraint trigger da 007 (corrigido em 07-05, D-12) é a rede no commit; o
 * serviço PRÉ-CHECA para dar a mensagem rica e o SQLSTATE traduzido por `FRASES`
 * cobre a corrida (T-07-17).
 *
 * Contato e matriz vêm lidos com o `workspace_id` da sessão: id de outro Espaço
 * é 404, e as FKs compostas da 007 são a segunda barreira (T-07-18).
 */

import type { Pool, PoolClient } from "pg";
import type { BloqueiosCrm, EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import { LIMITES_CRM, validarCamposAdicionais, validarEnderecos } from "@n1/dominio/crm/comum";
import {
  fraseDeIdentificadorEmUso,
  validarContato,
  validarIdentificadorDeContato,
  type Contato,
  type NovoContato,
  type NovoIdentificadorDeContato,
} from "@n1/dominio/crm/contatos";
import {
  adminsVigentes,
  FRASE_EMPRESA_SEM_ADMIN,
  fraseDeEmpresaBloqueada,
  nomeDeExibicaoDaEmpresa,
  validarEmpresa,
  validarIdentificadorDeEmpresa,
  validarMatriz,
  validarRetiradaDeAdmin,
  type AdminDaNovaEmpresa,
  type EdicaoDeEmpresa,
  type EdicaoDeVinculo,
  type Empresa,
  type EmpresaDetalhada,
  type EmpresaResumo,
  type NovaEmpresa,
  type NovoIdentificadorDeEmpresa,
  type NovoVinculo,
  type TrocaDeAdmin,
} from "@n1/dominio/crm/empresas";
import type { AcaoCrm } from "@n1/dominio/crm/permissoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeContatosPg, type RepositorioDeContatos } from "../../repositorios/crm/contatos";
import { criarRepositorioDeEmpresasPg, type RepositorioDeEmpresas } from "../../repositorios/crm/empresas";
import {
  atualizarVinculo,
  encerrarVigentesDaEmpresa,
  encerrarVinculo,
  inserirVinculo,
  listarDaEmpresa,
  obterVinculo,
  vinculoVigente,
} from "../../repositorios/crm/vinculos";
import { exigir, resolverProprietario, type AcessoAoCrm } from "./acesso";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";

export interface FiltroDeEmpresas {
  readonly estado: EstadoCrm;
  readonly q?: string | undefined;
  readonly limite: number;
  readonly deslocamento: number;
}

/** `POST /empresas` (D-08): a Empresa e o admin que ela nasce tendo, no mesmo corpo. */
export interface EntradaDeCriacaoDeEmpresa {
  readonly empresa: NovaEmpresa;
  readonly admin: AdminDaNovaEmpresa;
}

export interface EdicaoDeIdentificadorDeEmpresa {
  readonly principal?: boolean;
  readonly verificado?: boolean;
  readonly pais?: string;
}

/** Restaurar da lixeira pede o Contato admin; de arquivada, não. */
export interface EntradaDeRestauracaoDeEmpresa {
  readonly admin?: { readonly contatoId: string; readonly cargo?: string };
}

export interface ServicoDeEmpresas {
  listar(membro: MembroDaSessao, filtro: FiltroDeEmpresas): Promise<ResultadoCrm<Pagina<EmpresaResumo>>>;
  obter(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  criar(membro: MembroDaSessao, entrada: EntradaDeCriacaoDeEmpresa): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editar(membro: MembroDaSessao, id: string, entrada: EdicaoDeEmpresa): Promise<ResultadoCrm<EmpresaDetalhada>>;
  adicionarIdentificador(
    membro: MembroDaSessao,
    id: string,
    entrada: NovoIdentificadorDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editarIdentificador(
    membro: MembroDaSessao,
    id: string,
    identificadorId: string,
    entrada: EdicaoDeIdentificadorDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  removerIdentificador(membro: MembroDaSessao, id: string, identificadorId: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  vincularContato(membro: MembroDaSessao, id: string, entrada: NovoVinculo): Promise<ResultadoCrm<EmpresaDetalhada>>;
  editarVinculo(
    membro: MembroDaSessao,
    id: string,
    vinculoId: string,
    entrada: EdicaoDeVinculo,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  encerrarVinculo(
    membro: MembroDaSessao,
    id: string,
    vinculoId: string,
    entrada: { readonly fim?: string },
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  trocarAdmin(membro: MembroDaSessao, id: string, entrada: TrocaDeAdmin): Promise<ResultadoCrm<EmpresaDetalhada>>;
  arquivar(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  restaurar(
    membro: MembroDaSessao,
    id: string,
    entrada: EntradaDeRestauracaoDeEmpresa,
  ): Promise<ResultadoCrm<EmpresaDetalhada>>;
  enviarParaLixeira(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<EmpresaDetalhada>>;
  excluirPermanentemente(membro: MembroDaSessao, id: string): Promise<ResultadoCrm<{ readonly id: string }>>;
}

/** Rede contra corrida: o constraint que segurou vira esta frase, sem o nome dele (T-07-06). */
const FRASES: FrasesDeRestricao = {
  empresa_exige_admin: { codigo: "EMPRESA_SEM_ADMIN", error: FRASE_EMPRESA_SEM_ADMIN },
  empresa_identificadores_unico: { codigo: "IDENTIFICADOR_EM_USO", error: "Este Identificador já pertence a outra Empresa." },
  empresa_identificadores_principal_uq: {
    codigo: "PRINCIPAL_DUPLICADO",
    error: "Esta Empresa já tem um Identificador principal desse tipo. Tente de novo.",
  },
  contato_identificadores_unico: { codigo: "IDENTIFICADOR_EM_USO", error: "Este Identificador já pertence a outro Contato." },
  contato_identificadores_principal_uq: {
    codigo: "PRINCIPAL_DUPLICADO",
    error: "Este Contato já tem um Identificador principal desse tipo. Tente de novo.",
  },
  contato_empresa_vigente_uq: { codigo: "VINCULO_JA_EXISTE", error: "Este Contato já tem um vínculo vigente com a Empresa." },
  contato_empresa_periodo_ck: { codigo: "PERIODO_INVALIDO", error: "O fim do vínculo não pode ser anterior ao início." },
  empresas_matriz_propria_ck: { codigo: "MATRIZ_INVALIDA", error: "Uma Empresa não pode ser a própria matriz." },
  negocios_workspace_id_empresa_id_fkey: {
    codigo: "EMPRESA_COM_NEGOCIOS",
    error: "Esta Empresa ainda tem Negócios. Mova ou exclua os Negócios antes.",
  },
  empresas_workspace_id_matriz_id_fkey: {
    codigo: "EMPRESA_COM_FILIAIS",
    error: "Esta Empresa ainda é matriz de outras. Troque a matriz das filiais antes.",
  },
};

/** RN-EMP-05 é regra de negócio (409); o resto de um Identificador mal formado é forma (400). */
const MARCA_DE_PROVEDOR_PUBLICO = "RN-EMP-05";

const naoEncontrada = () => recusa<never>(404, "Empresa não encontrada.", { codigo: "EMPRESA_NAO_ENCONTRADA" });
const vinculoNaoEncontrado = () => recusa<never>(404, "Vínculo não encontrado.", { codigo: "VINCULO_NAO_ENCONTRADO" });
const contatoNaoEncontrado = () => recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });

/** Valor mal formado (normalização, limites): 400 com o campo, para a tela marcar o `Field`. */
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}

function semNome(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(409, falha.error, {
    codigo: "EMPRESA_SEM_NOME",
    ...(falha.field !== undefined ? { campo: falha.field } : {}),
  });
}

function identificadorRecusado(falha: { readonly error: string; readonly field?: string | undefined }) {
  if (falha.error.includes(MARCA_DE_PROVEDOR_PUBLICO)) {
    return recusa<never>(409, falha.error, {
      codigo: "DOMINIO_PUBLICO",
      ...(falha.field !== undefined ? { campo: falha.field } : {}),
    });
  }
  return valorInvalido(falha);
}

function empresaInativa() {
  return recusa<never>(409, "Restaure a Empresa antes de editar.", { codigo: "EMPRESA_INATIVA" });
}

const transicaoInvalida = (frase: string) => recusa<never>(409, frase, { codigo: "TRANSICAO_INVALIDA" });

type Cliente = Pool | PoolClient;

async function detalhar(cliente: Cliente, workspaceId: string, empresa: Empresa): Promise<EmpresaDetalhada> {
  const repositorio = criarRepositorioDeEmpresasPg(cliente);
  // Em sequência: um PoolClient não deve receber consultas concorrentes.
  const identificadores = await repositorio.listarIdentificadores(workspaceId, empresa.id);
  const vinculos = await listarDaEmpresa(cliente, workspaceId, empresa.id);
  const filiais = await repositorio.filiaisDe(workspaceId, empresa.id);
  let matriz: EmpresaDetalhada["matriz"] = null;
  if (empresa.matrizId !== null) {
    const pai = await repositorio.obter(workspaceId, empresa.matrizId);
    if (pai) {
      matriz = { id: pai.id, nome: nomeDeExibicaoDaEmpresa(pai), estado: pai.estado };
    }
  }
  return { empresa, identificadores, vinculos, matriz, filiais };
}

/** O Contato do Espaço da sessão, fora da lixeira (admin e vínculo exigem um Contato que existe e vale). */
async function carregarContato(
  repositorio: RepositorioDeContatos,
  workspaceId: string,
  contatoId: string,
): Promise<ResultadoCrm<Contato>> {
  const contato = await repositorio.obter(workspaceId, contatoId);
  if (!contato) return contatoNaoEncontrado();
  if (contato.estado === "na_lixeira") {
    return recusa<never>(409, "O Contato está na lixeira. Restaure-o antes de vinculá-lo a uma Empresa.", {
      codigo: "CONTATO_INATIVO",
      campo: "contatoId",
    });
  }
  return sucesso(contato);
}

const textoVazio = (texto: string | undefined): boolean => texto === undefined || texto.trim() === "";

export function criarServicoDeEmpresas(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeEmpresas {
  /**
   * Papel primeiro (um Convidado nunca descobre se o corpo era válido); depois a validação
   * de forma, sem banco; depois a transação. A Empresa é carregada travada e tem de existir
   * NESTE Espaço.
   */
  async function escrita<T>(
    membro: MembroDaSessao,
    acao: AcaoCrm,
    id: string,
    corpo: (contexto: { cliente: PoolClient; repositorio: RepositorioDeEmpresas; empresa: Empresa }) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    const negado = await exigir(deps.acesso, membro, acao, "empresa");
    if (negado) return { ok: false, ...negado };
    const invalido = validar?.();
    if (invalido) return invalido;
    return comTransacao(
      deps.pool,
      async (cliente) => {
        const repositorio = criarRepositorioDeEmpresasPg(cliente);
        const empresa = await repositorio.obter(membro.workspaceId, id, { travar: true });
        if (!empresa) return naoEncontrada();
        return corpo({ cliente, repositorio, empresa });
      },
      FRASES,
    );
  }

  /** Edição de dados, de Identificadores e de vínculos: só de Empresa `ativo` (empresas.md, estados). */
  async function edicao<T>(
    membro: MembroDaSessao,
    id: string,
    corpo: (contexto: { cliente: PoolClient; repositorio: RepositorioDeEmpresas; empresa: Empresa }) => Promise<ResultadoCrm<T>>,
    validar?: () => ResultadoCrm<never> | undefined,
  ): Promise<ResultadoCrm<T>> {
    return escrita(
      membro,
      "editar",
      id,
      async (contexto) => {
        if (contexto.empresa.estado !== "ativo") return empresaInativa();
        return corpo(contexto);
      },
      validar,
    );
  }

  async function devolver(cliente: Cliente, membro: MembroDaSessao, empresa: Empresa): Promise<ResultadoCrm<EmpresaDetalhada>> {
    return sucesso(await detalhar(cliente, membro.workspaceId, empresa));
  }

  /** O (tipo, valor) já é de outra Empresa do Espaço — 409 nomeando a detentora. */
  async function conferirUnicidade(
    repositorio: RepositorioDeEmpresas,
    workspaceId: string,
    empresaId: string | undefined,
    identificador: NovoIdentificadorDeEmpresa,
  ): Promise<ResultadoCrm<never> | undefined> {
    const detentora = await repositorio.detentoraDoIdentificador(workspaceId, identificador.tipo, identificador.valor);
    if (!detentora) return undefined;
    if (detentora.empresaId === empresaId) {
      return recusa<never>(409, "Esta Empresa já tem este Identificador.", { codigo: "IDENTIFICADOR_EM_USO", campo: "valor" });
    }
    return recusa<never>(
      409,
      `${identificador.valor} já pertence à Empresa ${detentora.nome}. Abra essa Empresa ou use outro valor.`,
      {
        codigo: "IDENTIFICADOR_EM_USO",
        campo: "valor",
        bloqueios: { empresas: [{ id: detentora.empresaId, nome: detentora.nome }] },
      },
    );
  }

  /** A matriz candidata: existe neste Espaço, está ativa e não fecha ciclo (INV-EMP-05, RN-EMP-11). */
  async function conferirMatriz(
    repositorio: RepositorioDeEmpresas,
    workspaceId: string,
    empresaId: string | undefined,
    matrizId: string,
  ): Promise<ResultadoCrm<never> | undefined> {
    const matriz = await repositorio.obter(workspaceId, matrizId);
    if (!matriz) return recusa<never>(404, "Matriz não encontrada.", { codigo: "MATRIZ_NAO_ENCONTRADA", campo: "matrizId" });
    const ancestraisDaMatriz = await repositorio.ancestraisDe(workspaceId, matriz.id);
    const validacao = validarMatriz({
      ...(empresaId !== undefined ? { empresaId } : {}),
      matriz: { id: matriz.id, estado: matriz.estado },
      ancestraisDaMatriz,
    });
    if (validacao.ok) return undefined;
    return recusa<never>(409, validacao.error, { codigo: "MATRIZ_INVALIDA", campo: "matrizId" });
  }

  /** Normaliza e confere duplicata dentro do próprio corpo de uma lista de Identificadores de Empresa. */
  function prepararIdentificadoresDeEmpresa(
    brutos: readonly NovoIdentificadorDeEmpresa[] | undefined,
  ): ResultadoCrm<NovoIdentificadorDeEmpresa[]> {
    const identificadores: NovoIdentificadorDeEmpresa[] = [];
    const vistos = new Set<string>();
    for (const bruto of brutos ?? []) {
      const normalizado = validarIdentificadorDeEmpresa(bruto);
      if (!normalizado.ok) return identificadorRecusado({ error: normalizado.error, field: "identificadores" });
      const chave = `${normalizado.value.tipo}:${normalizado.value.valor}`;
      if (vistos.has(chave)) {
        return valorInvalido({ error: `${normalizado.value.valor} aparece mais de uma vez.`, field: "identificadores" });
      }
      vistos.add(chave);
      identificadores.push(normalizado.value);
    }
    return sucesso(identificadores);
  }

  /** O mesmo para o Contato novo do admin: INV-CON-01, endereços, campos e Identificadores normalizados. */
  function prepararNovoContato(
    novo: NovoContato,
  ): ResultadoCrm<{ dados: Omit<NovoContato, "identificadores" | "proprietarioId">; identificadores: NovoIdentificadorDeContato[] }> {
    const validacao = validarContato(novo);
    if (!validacao.ok) {
      return recusa<never>(409, validacao.error, {
        codigo: "CONTATO_SEM_NOME_NEM_IDENTIFICADOR",
        ...(validacao.field !== undefined ? { campo: validacao.field } : {}),
      });
    }
    const enderecos = validarEnderecos(novo.enderecos);
    if (!enderecos.ok) return valorInvalido(enderecos);
    const campos = validarCamposAdicionais(novo.camposAdicionais);
    if (!campos.ok) return valorInvalido(campos);
    const identificadores: NovoIdentificadorDeContato[] = [];
    const vistos = new Set<string>();
    for (const bruto of novo.identificadores ?? []) {
      const normalizado = validarIdentificadorDeContato(bruto);
      if (!normalizado.ok) return valorInvalido({ error: normalizado.error, field: "identificadores" });
      const chave = `${normalizado.value.tipo}:${normalizado.value.valor}`;
      if (vistos.has(chave)) {
        return valorInvalido({ error: `${normalizado.value.valor} aparece mais de uma vez.`, field: "identificadores" });
      }
      vistos.add(chave);
      identificadores.push(normalizado.value);
    }
    const { identificadores: _identificadores, proprietarioId: _proprietarioId, ...dados } = novo;
    return sucesso({ dados, identificadores });
  }

  return {
    async listar(membro, filtro) {
      const negado = await exigir(deps.acesso, membro, "ler", "empresa");
      if (negado) return { ok: false, ...negado };
      const repositorio = criarRepositorioDeEmpresasPg(deps.pool());
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
      const negado = await exigir(deps.acesso, membro, "ler", "empresa");
      if (negado) return { ok: false, ...negado };
      const cliente = deps.pool();
      const empresa = await criarRepositorioDeEmpresasPg(cliente).obter(membro.workspaceId, id);
      if (!empresa) return naoEncontrada();
      return devolver(cliente, membro, empresa);
    },

    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "empresa");
      if (negado) return { ok: false, ...negado };
      const comContatoNovo = "novoContato" in entrada.admin;
      if (comContatoNovo) {
        const negadoContato = await exigir(deps.acesso, membro, "criar", "contato");
        if (negadoContato) return { ok: false, ...negadoContato };
      }

      const nome = validarEmpresa(entrada.empresa);
      if (!nome.ok) return semNome(nome);
      const enderecos = validarEnderecos(entrada.empresa.enderecos);
      if (!enderecos.ok) return valorInvalido(enderecos);
      const campos = validarCamposAdicionais(entrada.empresa.camposAdicionais);
      if (!campos.ok) return valorInvalido(campos);
      if ((entrada.empresa.identificadores?.length ?? 0) > LIMITES_CRM.identificadoresMaximo) {
        return valorInvalido({
          error: `Uma Empresa tem no máximo ${LIMITES_CRM.identificadoresMaximo} Identificadores.`,
          field: "identificadores",
        });
      }
      const identificadores = prepararIdentificadoresDeEmpresa(entrada.empresa.identificadores);
      if (!identificadores.ok) return identificadores;
      const contatoNovo = "novoContato" in entrada.admin ? prepararNovoContato(entrada.admin.novoContato) : undefined;
      if (contatoNovo && !contatoNovo.ok) return contatoNovo;

      const proprietario = await resolverProprietario(deps.acesso, membro, entrada.empresa.proprietarioId);
      if (!proprietario.ok) return proprietario;
      let proprietarioDoContato = membro.id;
      if ("novoContato" in entrada.admin && entrada.admin.novoContato.proprietarioId !== undefined) {
        const dono = await resolverProprietario(deps.acesso, membro, entrada.admin.novoContato.proprietarioId);
        if (!dono.ok) return dono;
        proprietarioDoContato = dono.valor;
      }

      const { identificadores: _identificadores, proprietarioId: _proprietarioId, matrizId, ...dados } = entrada.empresa;
      return comTransacao(
        deps.pool,
        async (cliente) => {
          const empresas = criarRepositorioDeEmpresasPg(cliente);
          const repositorioDeContatos = criarRepositorioDeContatosPg(cliente);

          for (const identificador of identificadores.valor) {
            const emUso = await conferirUnicidade(empresas, membro.workspaceId, undefined, identificador);
            if (emUso) return emUso;
          }
          if (!textoVazio(matrizId)) {
            const invalida = await conferirMatriz(empresas, membro.workspaceId, undefined, matrizId!);
            if (invalida) return invalida;
          }

          // O admin: um Contato que já existe neste Espaço, ou um novo criado na mesma transação.
          let contatoId: string;
          if (contatoNovo?.ok) {
            for (const identificador of contatoNovo.valor.identificadores) {
              const detentor = await repositorioDeContatos.detentorDoIdentificador(
                membro.workspaceId,
                identificador.tipo,
                identificador.valor,
              );
              if (detentor) {
                return recusa<never>(409, fraseDeIdentificadorEmUso(identificador.tipo, identificador.valor, detentor.nome), {
                  codigo: "IDENTIFICADOR_EM_USO",
                  campo: "identificadores",
                  bloqueios: { contatos: [{ id: detentor.contatoId, nome: detentor.nome }] },
                });
              }
            }
          } else if ("contatoId" in entrada.admin) {
            const existente = await carregarContato(repositorioDeContatos, membro.workspaceId, entrada.admin.contatoId);
            if (!existente.ok) return existente;
            contatoId = existente.valor.id;
          }

          const empresa = await empresas.inserir(membro.workspaceId, {
            ...dados,
            ...(!textoVazio(matrizId) ? { matrizId: matrizId! } : {}),
            proprietarioId: proprietario.valor,
            criadoPor: membro.id,
          });
          const gravados: { tipo: NovoIdentificadorDeEmpresa["tipo"] }[] = [];
          for (const identificador of identificadores.valor) {
            await empresas.inserirIdentificador(membro.workspaceId, empresa.id, {
              ...identificador,
              principal: !gravados.some((g) => g.tipo === identificador.tipo),
            });
            gravados.push({ tipo: identificador.tipo });
          }

          if (contatoNovo?.ok) {
            const contato = await repositorioDeContatos.inserir(membro.workspaceId, {
              ...contatoNovo.valor.dados,
              modoCriacao: "manual",
              proprietarioId: proprietarioDoContato,
              criadoPor: membro.id,
            });
            const tipos: { tipo: NovoIdentificadorDeContato["tipo"] }[] = [];
            for (const identificador of contatoNovo.valor.identificadores) {
              await repositorioDeContatos.inserirIdentificador(membro.workspaceId, contato.id, {
                ...identificador,
                principal: !tipos.some((t) => t.tipo === identificador.tipo),
              });
              tipos.push({ tipo: identificador.tipo });
            }
            contatoId = contato.id;
          }

          await inserirVinculo(cliente, membro.workspaceId, {
            contatoId: contatoId!,
            empresaId: empresa.id,
            admin: true,
            cargo: entrada.admin.cargo,
            criadoPor: membro.id,
          });
          return devolver(cliente, membro, empresa);
        },
        FRASES,
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
        async ({ cliente, repositorio, empresa }) => {
          let proprietarioId: string | undefined;
          if (entrada.proprietarioId !== undefined) {
            const proprietario = await resolverProprietario(deps.acesso, membro, entrada.proprietarioId);
            if (!proprietario.ok) return proprietario;
            proprietarioId = proprietario.valor;
          }
          const validacao = validarEmpresa({
            nomeFantasia: entrada.nomeFantasia !== undefined ? entrada.nomeFantasia : empresa.nomeFantasia,
            razaoSocial: entrada.razaoSocial !== undefined ? entrada.razaoSocial : empresa.razaoSocial,
          });
          if (!validacao.ok) return semNome(validacao);

          // Matriz: só valida quando muda (a atual pode ter sido arquivada depois); vazio a remove.
          if (entrada.matrizId !== undefined && !textoVazio(entrada.matrizId) && entrada.matrizId !== empresa.matrizId) {
            const invalida = await conferirMatriz(repositorio, membro.workspaceId, empresa.id, entrada.matrizId);
            if (invalida) return invalida;
          }

          const atualizada = await repositorio.atualizar(membro.workspaceId, empresa.id, {
            ...entrada,
            ...(proprietarioId !== undefined ? { proprietarioId } : {}),
          });
          if (!atualizada) return naoEncontrada();
          return devolver(cliente, membro, atualizada);
        },
        validar,
      );
    },

    async adicionarIdentificador(membro, id, entrada) {
      const normalizado = validarIdentificadorDeEmpresa(entrada);
      return edicao(
        membro,
        id,
        async ({ cliente, repositorio, empresa }) => {
          if (!normalizado.ok) return identificadorRecusado(normalizado);
          const emUso = await conferirUnicidade(repositorio, membro.workspaceId, empresa.id, normalizado.value);
          if (emUso) return emUso;
          const existentes = await repositorio.listarIdentificadores(membro.workspaceId, empresa.id);
          if (existentes.length >= LIMITES_CRM.identificadoresMaximo) {
            return valorInvalido({
              error: `Uma Empresa tem no máximo ${LIMITES_CRM.identificadoresMaximo} Identificadores.`,
              field: "identificadores",
            });
          }
          await repositorio.inserirIdentificador(membro.workspaceId, empresa.id, {
            ...normalizado.value,
            principal: !existentes.some((existente) => existente.tipo === normalizado.value.tipo),
          });
          return devolver(cliente, membro, empresa);
        },
        () => (normalizado.ok ? undefined : identificadorRecusado(normalizado)),
      );
    },

    async editarIdentificador(membro, id, identificadorId, entrada) {
      return edicao(membro, id, async ({ cliente, repositorio, empresa }) => {
        const identificador = await repositorio.obterIdentificador(membro.workspaceId, empresa.id, identificadorId);
        if (!identificador) {
          return recusa<never>(404, "Identificador não encontrado.", { codigo: "IDENTIFICADOR_NAO_ENCONTRADO" });
        }
        if (entrada.principal === false && identificador.principal) {
          return recusa<never>(409, "Escolha outro Identificador desse tipo como principal; o principal troca quando outro é promovido.", {
            codigo: "PRINCIPAL_OBRIGATORIO",
            campo: "principal",
          });
        }
        let pais: string | undefined;
        if (entrada.pais !== undefined) {
          pais = entrada.pais.trim().toUpperCase();
          if (pais === "" && identificador.tipo === "documento_fiscal") {
            return valorInvalido({ error: "Documento fiscal exige o país de emissão.", field: "pais" });
          }
        }
        if (entrada.principal === true && !identificador.principal) {
          // Na mesma transação: rebaixa o atual antes de promover o novo.
          await repositorio.rebaixarPrincipal(membro.workspaceId, empresa.id, identificador.tipo);
        }
        await repositorio.atualizarIdentificador(membro.workspaceId, identificador.id, {
          principal: entrada.principal === true ? true : undefined,
          verificado: entrada.verificado,
          pais,
        });
        return devolver(cliente, membro, empresa);
      });
    },

    async removerIdentificador(membro, id, identificadorId) {
      return edicao(membro, id, async ({ cliente, repositorio, empresa }) => {
        const existentes = await repositorio.listarIdentificadores(membro.workspaceId, empresa.id);
        const alvo = existentes.find((identificador) => identificador.id === identificadorId);
        if (!alvo) return recusa<never>(404, "Identificador não encontrado.", { codigo: "IDENTIFICADOR_NAO_ENCONTRADO" });
        await repositorio.removerIdentificador(membro.workspaceId, alvo.id);
        if (alvo.principal) {
          // Promove o mais antigo do mesmo tipo (a lista já vem por `criado_em`).
          const proximo = existentes.find((identificador) => identificador.id !== alvo.id && identificador.tipo === alvo.tipo);
          if (proximo) await repositorio.atualizarIdentificador(membro.workspaceId, proximo.id, { principal: true });
        }
        return devolver(cliente, membro, empresa);
      });
    },

    async vincularContato(membro, id, entrada) {
      return edicao(membro, id, async ({ cliente, empresa }) => {
        const contato = await carregarContato(criarRepositorioDeContatosPg(cliente), membro.workspaceId, entrada.contatoId);
        if (!contato.ok) return contato;
        if (await vinculoVigente(cliente, membro.workspaceId, contato.valor.id, empresa.id)) {
          return recusa<never>(409, "Este Contato já tem um vínculo vigente com a Empresa.", {
            codigo: "VINCULO_JA_EXISTE",
            campo: "contatoId",
          });
        }
        await inserirVinculo(cliente, membro.workspaceId, {
          contatoId: contato.valor.id,
          empresaId: empresa.id,
          admin: entrada.admin === true,
          cargo: entrada.cargo,
          inicio: entrada.inicio,
          criadoPor: membro.id,
        });
        return devolver(cliente, membro, empresa);
      });
    },

    async editarVinculo(membro, id, vinculoId, entrada) {
      return edicao(membro, id, async ({ cliente, empresa }) => {
        const vinculo = await obterVinculo(cliente, membro.workspaceId, empresa.id, vinculoId);
        if (!vinculo) return vinculoNaoEncontrado();
        if (vinculo.fim !== null) {
          return recusa<never>(409, "Este vínculo já foi encerrado.", { codigo: "VINCULO_ENCERRADO" });
        }
        if (entrada.admin === false && vinculo.admin) {
          const retirada = validarRetiradaDeAdmin(await listarDaEmpresa(cliente, membro.workspaceId, empresa.id), vinculo.id);
          if (!retirada.ok) return recusa<never>(409, retirada.error, { codigo: "ULTIMO_ADMIN", campo: "admin" });
        }
        await atualizarVinculo(cliente, membro.workspaceId, vinculo.id, { cargo: entrada.cargo, admin: entrada.admin });
        return devolver(cliente, membro, empresa);
      });
    },

    async encerrarVinculo(membro, id, vinculoId, entrada) {
      return edicao(membro, id, async ({ cliente, empresa }) => {
        const vinculo = await obterVinculo(cliente, membro.workspaceId, empresa.id, vinculoId);
        if (!vinculo) return vinculoNaoEncontrado();
        if (vinculo.fim !== null) {
          return recusa<never>(409, "Este vínculo já foi encerrado.", { codigo: "VINCULO_ENCERRADO" });
        }
        if (vinculo.admin) {
          const retirada = validarRetiradaDeAdmin(await listarDaEmpresa(cliente, membro.workspaceId, empresa.id), vinculo.id);
          if (!retirada.ok) return recusa<never>(409, retirada.error, { codigo: "ULTIMO_ADMIN", campo: "admin" });
        }
        await encerrarVinculo(cliente, membro.workspaceId, vinculo.id, entrada.fim);
        return devolver(cliente, membro, empresa);
      });
    },

    async trocarAdmin(membro, id, entrada) {
      return edicao(membro, id, async ({ cliente, empresa }) => {
        const atual = await obterVinculo(cliente, membro.workspaceId, empresa.id, entrada.vinculoAtualId);
        if (!atual) return vinculoNaoEncontrado();
        if (!atual.admin || atual.fim !== null) {
          return recusa<never>(409, "Este vínculo não é de um admin vigente.", { codigo: "VINCULO_NAO_E_ADMIN" });
        }
        if (entrada.novoAdmin.contatoId === atual.contatoId) {
          return recusa<never>(409, "Escolha outro Contato: este já é o admin.", { codigo: "ADMIN_JA_E_ESTE", campo: "contatoId" });
        }
        const contato = await carregarContato(criarRepositorioDeContatosPg(cliente), membro.workspaceId, entrada.novoAdmin.contatoId);
        if (!contato.ok) return contato;
        // O novo admin primeiro; só então o atual deixa de ser (a Empresa nunca fica sem admin).
        const vigente = await vinculoVigente(cliente, membro.workspaceId, contato.valor.id, empresa.id);
        if (vigente) {
          await atualizarVinculo(cliente, membro.workspaceId, vigente.id, { admin: true, cargo: entrada.novoAdmin.cargo });
        } else {
          await inserirVinculo(cliente, membro.workspaceId, {
            contatoId: contato.valor.id,
            empresaId: empresa.id,
            admin: true,
            cargo: entrada.novoAdmin.cargo,
            criadoPor: membro.id,
          });
        }
        await atualizarVinculo(cliente, membro.workspaceId, atual.id, { admin: false });
        return devolver(cliente, membro, empresa);
      });
    },

    async arquivar(membro, id) {
      return escrita(membro, "arquivar", id, async ({ cliente, repositorio, empresa }) => {
        if (empresa.estado !== "ativo") return transicaoInvalida("Só uma Empresa ativa pode ser arquivada.");
        // Os vínculos não mudam: arquivada, a Empresa continua exigindo admin.
        const atualizada = await repositorio.definirEstado(membro.workspaceId, empresa.id, "arquivado");
        if (!atualizada) return naoEncontrada();
        return devolver(cliente, membro, atualizada);
      });
    },

    async restaurar(membro, id, entrada) {
      return escrita(membro, "restaurar", id, async ({ cliente, repositorio, empresa }) => {
        if (empresa.estado === "ativo") return transicaoInvalida("A Empresa já está ativa.");
        if (empresa.estado === "arquivado") {
          const atualizada = await repositorio.definirEstado(membro.workspaceId, empresa.id, "ativo");
          if (!atualizada) return naoEncontrada();
          return devolver(cliente, membro, atualizada);
        }

        // Da lixeira: os vínculos foram encerrados (D-08), então a Empresa volta com um admin indicado.
        const vinculos = await listarDaEmpresa(cliente, membro.workspaceId, empresa.id);
        const semAdmin = adminsVigentes(vinculos).length === 0;
        if (semAdmin && entrada.admin === undefined) {
          return recusa<never>(409, FRASE_EMPRESA_SEM_ADMIN, { codigo: "EMPRESA_SEM_ADMIN", campo: "admin" });
        }
        if (semAdmin && entrada.admin !== undefined) {
          const contato = await carregarContato(criarRepositorioDeContatosPg(cliente), membro.workspaceId, entrada.admin.contatoId);
          if (!contato.ok) return contato;
          // Os vínculos encerrados ficam como histórico; o admin é um vínculo NOVO.
          await inserirVinculo(cliente, membro.workspaceId, {
            contatoId: contato.valor.id,
            empresaId: empresa.id,
            admin: true,
            cargo: entrada.admin.cargo,
            criadoPor: membro.id,
          });
        }
        const atualizada = await repositorio.definirEstado(membro.workspaceId, empresa.id, "ativo");
        if (!atualizada) return naoEncontrada();
        return devolver(cliente, membro, atualizada);
      });
    },

    async enviarParaLixeira(membro, id) {
      return escrita(membro, "enviar_para_lixeira", id, async ({ cliente, repositorio, empresa }) => {
        if (empresa.estado === "na_lixeira") return transicaoInvalida("A Empresa já está na lixeira.");
        // RN-EMP-09: Negócio aberto fora da lixeira ou filial ativa/arquivada impedem a lixeira.
        const negocios = await repositorio.negociosDaEmpresa(membro.workspaceId, empresa.id, { apenasAbertosForaDaLixeira: true });
        const filiais = await repositorio.filiaisDe(membro.workspaceId, empresa.id, { apenasAtivasOuArquivadas: true });
        if (negocios.total > 0 || filiais.length > 0) {
          const bloqueios: BloqueiosCrm = {
            ...(negocios.total > 0 ? { negocios } : {}),
            ...(filiais.length > 0 ? { filiais: filiais.map(({ id: filialId, nome }) => ({ id: filialId, nome })) } : {}),
          };
          return recusa<never>(409, fraseDeEmpresaBloqueada(bloqueios), { codigo: "EMPRESA_BLOQUEADA", bloqueios });
        }
        // D-08: a lixeira encerra os vínculos vigentes e preserva os Contatos. O trigger corrigido
        // da 007 (D-12) aceita a Empresa na lixeira sem admin vigente no commit.
        const atualizada = await repositorio.definirEstado(membro.workspaceId, empresa.id, "na_lixeira");
        if (!atualizada) return naoEncontrada();
        await encerrarVigentesDaEmpresa(cliente, membro.workspaceId, empresa.id);
        return devolver(cliente, membro, atualizada);
      });
    },

    async excluirPermanentemente(membro, id) {
      return escrita(membro, "excluir_permanentemente", id, async ({ repositorio, empresa }) => {
        if (empresa.estado !== "na_lixeira") {
          return recusa<never>(409, "Envie a Empresa à lixeira antes de excluí-la permanentemente.", {
            codigo: "EMPRESA_FORA_DA_LIXEIRA",
          });
        }
        // RN-EMP-10: qualquer Negócio, de qualquer estado, e qualquer filial impedem a exclusão de vez.
        const negocios = await repositorio.negociosDaEmpresa(membro.workspaceId, empresa.id, { apenasAbertosForaDaLixeira: false });
        if (negocios.total > 0) {
          return recusa<never>(
            409,
            negocios.total === 1
              ? "Esta Empresa tem 1 Negócio. Mova ou exclua o Negócio antes de excluí-la."
              : `Esta Empresa tem ${negocios.total} Negócios. Mova ou exclua os Negócios antes de excluí-la.`,
            { codigo: "EMPRESA_COM_NEGOCIOS", bloqueios: { negocios } },
          );
        }
        const filiais = await repositorio.filiaisDe(membro.workspaceId, empresa.id);
        if (filiais.length > 0) {
          return recusa<never>(409, "Esta Empresa é matriz de outras. Troque a matriz das filiais antes de excluí-la.", {
            codigo: "EMPRESA_COM_FILIAIS",
            bloqueios: { filiais: filiais.map(({ id: filialId, nome }) => ({ id: filialId, nome })) },
          });
        }
        if (!(await repositorio.excluir(membro.workspaceId, empresa.id))) return naoEncontrada();
        return sucesso({ id: empresa.id });
      });
    },
  };
}
