/**
 * O mapeador de entidades (15-28, UCR-09): as linhas do CRM antigo viram as linhas das tabelas novas.
 *
 * Função PURA: `planejarMigracao` recebe as linhas antigas (como estão em `plataforma.registros`) e o que
 * o CRM novo do Espaço já tem, e devolve as linhas a inserir (com os nomes das colunas), o de-para e o
 * relatório de não migrados. Nada aqui toca em banco: tudo que o banco recusaria (uma constraint da
 * 007/008/011) é decidido AQUI e o item vai para o relatório, em vez de derrubar a transação do Espaço
 * no `commit`.
 *
 * Ids: o id antigo vira o id novo (as colunas são `text`), então Vínculos, `provenance` e escopos em
 * `registros` seguem achando o registro sem reescrita. As exceções são as de chave não única no Espaço:
 * o Identificador (de Contato e de Empresa) e o vínculo Contato-Empresa ganham id novo e uma linha de
 * `crm_de_para`; a Etapa já tem a dela (15-27).
 */

import { randomUUID } from "node:crypto";
import { normalizarIdentificadorDeContato } from "@n1/dominio/crm/normalizacao";
import { ehConversaDeGrupo } from "./colecoes";
import type { ContatoAntigo, IdentificadorAntigo, RegistroAntigo } from "./formatos-antigos";
import type { NaoMigrado } from "./nao-migrados";

// --- As linhas novas, com o nome das colunas ---

export interface LinhaDeContato {
  readonly id: string;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  readonly data_nascimento: string | null;
  readonly idioma: string | null;
  readonly fuso_horario: string | null;
  readonly descricao: string | null;
  readonly enderecos: readonly unknown[];
  readonly campos_adicionais: Readonly<Record<string, unknown>>;
  readonly origem: string | null;
  readonly qualificacao: string | null;
  readonly modo_criacao: string;
  readonly estado: string;
  readonly mesclado_em_id: string | null;
  readonly mesclado_em: string | null;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeIdentificadorDeContato {
  readonly id: string;
  readonly contato_id: string;
  readonly tipo: string;
  readonly valor: string;
  readonly valor_exibido: string | null;
  readonly rotulo_canal: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criado_em: string | null;
}

/** Uma linha de `crm_de_para`: o livro-razão do que foi migrado. */
export interface DeParaParaInserir {
  readonly colecao_antiga: string;
  readonly id_antigo: string;
  readonly tabela_nova: string;
  readonly id_novo: string;
}

export interface LinhaDeEmpresa {
  readonly id: string;
  readonly nome_fantasia: string | null;
  readonly razao_social: string | null;
  readonly descricao: string | null;
  readonly matriz_id: string | null;
  readonly enderecos: readonly unknown[];
  readonly campos_adicionais: Readonly<Record<string, unknown>>;
  readonly origem: string | null;
  readonly estado: string;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeIdentificadorDeEmpresa {
  readonly id: string;
  readonly empresa_id: string;
  readonly tipo: string;
  readonly valor: string;
  readonly pais: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criado_em: string | null;
}

export interface LinhaDeVinculo {
  readonly id: string;
  readonly contato_id: string;
  readonly empresa_id: string;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeNegocio {
  readonly id: string;
  readonly titulo: string;
  readonly objeto: string | null;
  readonly descricao: string | null;
  readonly empresa_id: string | null;
  readonly contato_id: string | null;
  readonly funil_id: string;
  /** O id da Etapa no CRM ANTIGO: `inserirPlano` o troca pelo id novo, lendo o `crm_de_para` (`funnels/stages`). */
  readonly etapa_id_antiga: string;
  readonly valor: number | null;
  readonly moeda: string;
  readonly probabilidade: number | null;
  readonly situacao: string;
  readonly motivo_perda: string | null;
  readonly motivo_ganho: string | null;
  readonly nota_encerramento: string | null;
  readonly origem: string | null;
  readonly data_prevista_fechamento: string | null;
  readonly encerrado_em: string | null;
  readonly estado: string;
  readonly proprietario_id: string;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeCanal {
  readonly id: string;
  readonly nome: string;
  readonly tipo: string;
  readonly provedor: string;
  readonly identificador_externo: string;
  readonly estado: string;
  readonly arquivado_em: string | null;
  readonly configurado_por: string;
  readonly fila_padrao_id: string | null;
  readonly proprietario_padrao_id: string | null;
  readonly origem_padrao_id: string | null;
  readonly grupos_habilitados: boolean;
  readonly criado_por: string;
  readonly criado_em: string | null;
}

export interface LinhaDeConversa {
  readonly id: string;
  readonly canal_id: string;
  readonly contato_id: string;
  readonly titulo: string;
  readonly titulo_editado: boolean;
  readonly situacao: string;
  readonly estado: string;
  readonly fila_id: string | null;
  readonly atribuido_tipo: string | null;
  readonly atribuido_id: string | null;
  readonly adiada_ate: string | null;
  readonly adiamento_motivo: string | null;
  readonly participantes: readonly unknown[];
  readonly resolvida_em: string | null;
  readonly reaberta_em: string | null;
  readonly reaberturas: number;
  readonly criado_por_tipo: string;
  readonly criado_por_id: string;
  readonly criado_em: string | null;
  readonly na_lixeira_em: string | null;
}

export interface LinhaDeMensagem {
  readonly id: string;
  readonly conversa_id: string;
  readonly canal_id: string;
  readonly direcao: string;
  readonly ator_tipo: string;
  readonly ator_id: string;
  readonly delegante_tipo: string | null;
  readonly delegante_id: string | null;
  readonly remetente_participante_id: string | null;
  readonly identificador_id: string | null;
  readonly conteudo: string | null;
  readonly anexos: readonly unknown[];
  readonly assunto: string | null;
  readonly enderecos_adicionais: readonly unknown[];
  readonly em_resposta_a_id: string | null;
  readonly id_externo: string | null;
  readonly status_entrega: string | null;
  readonly motivo_falha: string | null;
  readonly leituras_internas: readonly unknown[];
  readonly reacoes: readonly unknown[];
  readonly marcacao_exclusao: unknown;
  readonly edicoes_externas: readonly unknown[];
  readonly anonimizada: boolean;
  readonly criado_em: string | null;
}

export interface LinhaDeNota {
  readonly contato_id: string;
  readonly conteudo: string;
  readonly autor_id: string;
  readonly criado_em: string | null;
}

export interface LinhaDeConsentimento {
  readonly contato_id: string;
  readonly finalidade_id: string;
  readonly tipo_de_canal: string;
  readonly decisao: string;
  readonly em: string;
  readonly origem: string;
  readonly evidencia_mensagem_id: string | null;
  readonly registrado_por: string;
  readonly registrado_em: string | null;
}

export interface LinhaDeMarcacao {
  readonly conversa_id: string;
  readonly membro_id: string;
  readonly estrela: boolean;
}

export interface LinhasPorTabela {
  /** Sobreviventes antes dos mesclados: a FK `contatos_mesclado_em_fk` não é adiável. */
  readonly contatos: LinhaDeContato[];
  readonly contato_identificadores: LinhaDeIdentificadorDeContato[];
  readonly empresas: LinhaDeEmpresa[];
  readonly empresa_identificadores: LinhaDeIdentificadorDeEmpresa[];
  readonly contato_empresa: LinhaDeVinculo[];
  readonly negocios: LinhaDeNegocio[];
  readonly canais: LinhaDeCanal[];
  readonly conversas: LinhaDeConversa[];
  /** Em ordem de `criadoEm`: a `seq` (identity) da Mensagem nasce na ordem da inserção. */
  readonly mensagens: LinhaDeMensagem[];
  readonly contato_notas: LinhaDeNota[];
  readonly contato_consentimentos: LinhaDeConsentimento[];
  readonly conversa_marcacoes: LinhaDeMarcacao[];
}

export interface PlanoDeMigracao {
  readonly linhasPorTabela: LinhasPorTabela;
  readonly deParas: DeParaParaInserir[];
  readonly naoMigrados: NaoMigrado[];
}

/** O que o CRM novo do Espaço já tem e o mapeador não pode repetir (colisões de unicidade e de id). */
export interface CrmNovoDoEspaco {
  readonly idsDeContato: ReadonlySet<string>;
  readonly identificadoresDeContato: ReadonlySet<string>;
  readonly idsDeEmpresa: ReadonlySet<string>;
  readonly identificadoresDeEmpresa: ReadonlySet<string>;
  readonly idsDeNegocio: ReadonlySet<string>;
  readonly idsDeCanal: ReadonlySet<string>;
  /** `lower(btrim(nome))` dos Canais ativos (`canais_nome_uq`). */
  readonly nomesDeCanalAtivo: ReadonlySet<string>;
  /** `tipo` + `identificador_externo` dos Canais ativos (`canais_conta_uq`). */
  readonly contasDeCanalAtivo: ReadonlySet<string>;
  readonly idsDeConversa: ReadonlySet<string>;
  /** `contato_id` + `canal_id` das Conversas aberta ou pendente e ativas (`conversas_nao_resolvida_uq`). */
  readonly conversasNaoResolvidas: ReadonlySet<string>;
  readonly idsDeMensagem: ReadonlySet<string>;
}

/** A chave de unicidade do Identificador de Contato no Espaço (`contato_identificadores_unico`). */
export function chaveDeIdentificadorDeContato(tipo: string, valor: string): string {
  return `${tipo}\u0000${valor}`;
}

/** A chave de unicidade do Identificador de Empresa no Espaço (`empresa_identificadores_unico`). */
export function chaveDeIdentificadorDeEmpresa(tipo: string, valor: string): string {
  return `${tipo}\u0000${valor}`;
}

/** A chave da conta de um Canal (`canais_conta_uq`). */
export function chaveDeContaDeCanal(tipo: string, identificador: string): string {
  return `${tipo}\u0000${identificador}`;
}

/** A chave do par Contato + Canal (`conversas_nao_resolvida_uq`). */
export function chaveDeParDeConversa(contatoId: string, canalId: string): string {
  return `${contatoId}\u0000${canalId}`;
}

export const CRM_NOVO_VAZIO: CrmNovoDoEspaco = {
  idsDeContato: new Set(),
  identificadoresDeContato: new Set(),
  idsDeEmpresa: new Set(),
  identificadoresDeEmpresa: new Set(),
  idsDeNegocio: new Set(),
  idsDeCanal: new Set(),
  nomesDeCanalAtivo: new Set(),
  contasDeCanalAtivo: new Set(),
  idsDeConversa: new Set(),
  conversasNaoResolvidas: new Set(),
  idsDeMensagem: new Set(),
};

export interface OpcoesDoMapeador {
  /** Gera o id novo de Identificador e de vínculo (UUID por padrão; os testes passam um contador). */
  readonly gerarId?: () => string;
  /**
   * Os Funis que PASSAM a existir no CRM novo (id antigo → ids antigos das Etapas dele): o Negócio só migra para
   * um Funil e uma Etapa desta lista. Ausente ou vazio (`--funil=guardar`), nenhum Negócio migra.
   */
  readonly funisMigrados?: ReadonlyMap<string, ReadonlySet<string>>;
}

// --- Leitura defensiva do JSON antigo ---

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

/** Um instante ISO válido, ou nulo: o `::timestamptz` do banco derrubaria a transação com um texto ruim. */
function instante(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Um dia civil `YYYY-MM-DD` que existe no calendário, ou nulo (o `::date` recusaria 2026-02-30). */
function dia(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(valor) ? valor : null;
}

function lista<T>(valor: readonly T[] | undefined): readonly T[] {
  return Array.isArray(valor) ? valor : [];
}

/** As linhas de cada coleção, na ordem de `ordem` (empate pelo id), como o CRM antigo as mostrava. */
function agruparPorColecao(linhas: readonly RegistroAntigo[]): Map<string, RegistroAntigo[]> {
  const porColecao = new Map<string, RegistroAntigo[]>();
  for (const linha of linhas) {
    let grupo = porColecao.get(linha.colecao);
    if (!grupo) porColecao.set(linha.colecao, (grupo = []));
    grupo.push(linha);
  }
  for (const grupo of porColecao.values()) {
    grupo.sort((a, b) => (a.ordem === b.ordem ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.ordem - b.ordem));
  }
  return porColecao;
}

/** `dados` de uma coleção, com o id da linha garantido (o JSON antigo sempre o traz, mas a linha manda). */
function dadosDe<T extends { id: string }>(porColecao: Map<string, RegistroAntigo[]>, colecao: string): T[] {
  return (porColecao.get(colecao) ?? []).map((l) => ({ ...(l.dados as object), id: l.id }) as T);
}

// --- Contato ---

const MODO_DE_CRIACAO: Readonly<Record<string, string>> = {
  manual: "manual",
  importacao: "importacao",
  automaticoPorMensagem: "automatico_mensagem",
  automaticoPorAutomacaoOuAgente: "automatico_automacao",
  automaticoPorGrupo: "automatico_automacao",
  // O Contato restaurado de uma cópia pré-mesclagem não tem modo próprio no CRM novo.
  desdobradoDeMesclagem: "manual",
};

const ESTADO_DE_CICLO: Readonly<Record<string, "ativo" | "arquivado" | "na_lixeira">> = {
  ativo: "ativo",
  arquivado: "arquivado",
  naLixeira: "na_lixeira",
};

/** Tipo do Identificador antigo → tipo da 007. Os que não estão aqui (LinkedIn, TikTok, chat do site) não têm destino. */
const TIPO_DE_IDENTIFICADOR: Readonly<Record<string, "telefone" | "email" | "whatsapp" | "instagram">> = {
  telefone: "telefone",
  email: "email",
  identidadeDeWhatsApp: "whatsapp",
  usuarioDeInstagram: "instagram",
};

function valorCanonico(tipo: "telefone" | "email" | "whatsapp" | "instagram", bruto: string): string {
  const normalizado = normalizarIdentificadorDeContato(tipo, bruto);
  // O dado antigo já foi normalizado pelo modelo antigo; se a regra nova o recusa, o valor é preservado como
  // veio (aparado) em vez de perder o Identificador: o relatório seria o lugar errado para uma pessoa sumir.
  return normalizado.ok ? normalizado.value : tipo === "email" ? bruto.trim().toLowerCase() : bruto.trim();
}

interface ContextoDoMapeador {
  readonly crmNovo: CrmNovoDoEspaco;
  readonly gerarId: () => string;
  readonly linhas: LinhasPorTabela;
  readonly deParas: DeParaParaInserir[];
  readonly naoMigrados: NaoMigrado[];
}

function mapearContatos(contatos: readonly ContatoAntigo[], ctx: ContextoDoMapeador): Set<string> {
  const migrados = new Set<string>();
  const novos: LinhaDeContato[] = [];
  const idsEmUso = new Set<string>();
  const chavesDeIdentificador = new Set(ctx.crmNovo.identificadoresDeContato);

  // Os Contatos que migram: o id não pode já existir no CRM novo.
  const candidatos = contatos.filter((c) => {
    if (ctx.crmNovo.idsDeContato.has(c.id) || idsEmUso.has(c.id)) {
      ctx.naoMigrados.push({ categoria: "id-ja-existe", colecao: "contacts", id: c.id });
      return false;
    }
    idsEmUso.add(c.id);
    return true;
  });
  const sobreviventes = new Set(candidatos.filter((c) => c.lifecycle !== "mesclado").map((c) => c.id));

  for (const antigo of candidatos) {
    const mesclado = antigo.lifecycle === "mesclado";
    const sobrevivente = texto(antigo.mergedIntoId);
    // Mesclado exige sobrevivente que exista (`contatos_mesclado_ck` + FK): sem ele o Contato entra arquivado.
    const absorvido = mesclado && sobrevivente !== null && sobreviventes.has(sobrevivente) && sobrevivente !== antigo.id;
    if (mesclado && !absorvido) ctx.naoMigrados.push({ categoria: "contato-mesclado-sem-sobrevivente", colecao: "contacts", id: antigo.id });
    const criadoEm = instante(antigo.createdAt);
    const dono = texto(antigo.ownerMemberId) ?? texto(antigo.createdBy?.id) ?? "migracao-crm-antigo";

    novos.push({
      id: antigo.id,
      nome: texto(antigo.firstName),
      sobrenome: texto(antigo.lastName),
      data_nascimento: dia(antigo.birthDate),
      idioma: texto(antigo.language),
      fuso_horario: texto(antigo.timezone),
      descricao: texto(antigo.description),
      enderecos: [],
      campos_adicionais: {},
      origem: texto(antigo.originId),
      qualificacao: texto(antigo.qualificationId),
      modo_criacao: MODO_DE_CRIACAO[antigo.creationMode ?? ""] ?? "manual",
      estado: absorvido ? "mesclado" : (ESTADO_DE_CICLO[antigo.lifecycle ?? ""] ?? "arquivado"),
      mesclado_em_id: absorvido ? sobrevivente : null,
      mesclado_em: absorvido ? (instante(antigo.mergedAt) ?? criadoEm ?? new Date(0).toISOString()) : null,
      proprietario_id: dono,
      criado_por: texto(antigo.createdBy?.id) ?? dono,
      criado_em: criadoEm,
    });
    migrados.add(antigo.id);
    ctx.deParas.push({ colecao_antiga: "contacts", id_antigo: antigo.id, tabela_nova: "contatos", id_novo: antigo.id });

    // Identificadores: o principal de cada tipo é o primeiro que vier marcado.
    const principalDoTipo = new Set<string>();
    for (const ident of lista<IdentificadorAntigo>(antigo.identifiers)) {
      const tipo = TIPO_DE_IDENTIFICADOR[ident.type ?? ""];
      const bruto = texto(ident.value);
      if (tipo === undefined) {
        ctx.naoMigrados.push({ categoria: "identificador-sem-destino", colecao: "contacts", id: antigo.id });
        continue;
      }
      if (bruto === null) continue;
      const valor = valorCanonico(tipo, bruto);
      const chave = chaveDeIdentificadorDeContato(tipo, valor);
      if (chavesDeIdentificador.has(chave)) {
        ctx.naoMigrados.push({ categoria: "identificador-repetido", colecao: "contacts", id: antigo.id });
        continue;
      }
      chavesDeIdentificador.add(chave);
      const principal = ident.principal === true && !principalDoTipo.has(tipo);
      if (principal) principalDoTipo.add(tipo);
      const idNovo = ctx.gerarId();
      ctx.linhas.contato_identificadores.push({
        id: idNovo,
        contato_id: antigo.id,
        tipo,
        valor,
        valor_exibido: texto(ident.displayValue),
        rotulo_canal: texto(ident.channelLabel),
        verificado: ident.verified === true,
        principal,
        criado_em: instante(ident.createdAt),
      });
      ctx.deParas.push({ colecao_antiga: "contacts/identifiers", id_antigo: `${antigo.id}/${ident.id}`, tabela_nova: "contato_identificadores", id_novo: idNovo });
    }
  }

  // Sobreviventes primeiro, absorvidos depois (a ordem relativa de cada grupo é a antiga).
  ctx.linhas.contatos.push(...novos.filter((c) => c.mesclado_em_id === null), ...novos.filter((c) => c.mesclado_em_id !== null));
  return migrados;
}

/**
 * Decide o que cada linha do CRM antigo vira. `linhasAntigas` são as linhas de `plataforma.registros` (ou da
 * fixture) das nove coleções; as Conversas de Grupo ficam em `registros` e não entram aqui (F14-D-05).
 */
export function planejarMigracao(
  linhasAntigas: readonly RegistroAntigo[],
  crmNovo: CrmNovoDoEspaco = CRM_NOVO_VAZIO,
  opcoes: OpcoesDoMapeador = {},
): PlanoDeMigracao {
  const semGrupo = linhasAntigas.filter((l) => !(l.colecao === "conversations" && ehConversaDeGrupo(l.dados)));
  const porColecao = agruparPorColecao(semGrupo);
  const ctx: ContextoDoMapeador = {
    crmNovo,
    gerarId: opcoes.gerarId ?? randomUUID,
    linhas: {
      contatos: [],
      contato_identificadores: [],
      empresas: [],
      empresa_identificadores: [],
      contato_empresa: [],
      negocios: [],
      canais: [],
      conversas: [],
      mensagens: [],
      contato_notas: [],
      contato_consentimentos: [],
      conversa_marcacoes: [],
    },
    deParas: [],
    naoMigrados: [],
  };

  mapearContatos(dadosDe<ContatoAntigo>(porColecao, "contacts"), ctx);

  return { linhasPorTabela: ctx.linhas, deParas: ctx.deParas, naoMigrados: ctx.naoMigrados };
}
