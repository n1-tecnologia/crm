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
import { normalizarIdentificadorDeContato, normalizarIdentificadorDeEmpresa } from "@n1/dominio/crm/normalizacao";
import { PROVEDOR_PADRAO_DO_TIPO, PROVEDORES, type TipoComProvedor } from "@n1/dominio/provedores-de-canal";
import { ehConversaDeGrupo } from "./colecoes";
import type {
  AtorAntigo,
  CanalAntigo,
  ContatoAntigo,
  ConversaAntiga,
  EmpresaAntiga,
  EnderecoAntigo,
  FunilAntigo,
  IdentificadorAntigo,
  MensagemAntiga,
  NegocioAntigo,
  RegistroAntigo,
  ValorDeCampoAntigo,
  VinculoContatoEmpresaAntigo,
  VinculoSoComIdAntigo,
} from "./formatos-antigos";
import type { CategoriaNaoMigrada, NaoMigrado } from "./nao-migrados";

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
//
// O JSON de `registros` é de formato livre: um texto onde se espera data, um número negativo, uma lista
// onde se espera um valor. Cada leitura devolve um valor que o banco aceita, ou nulo.

const EPOCA = new Date(0).toISOString();

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

function lista<T>(valor: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(valor) ? valor : [];
}

function ms(valor: string | null): number {
  return valor === null ? 0 : Date.parse(valor);
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

const ESTADO_DE_CICLO: Readonly<Record<string, "ativo" | "arquivado" | "na_lixeira">> = {
  ativo: "ativo",
  arquivado: "arquivado",
  naLixeira: "na_lixeira",
};

const SEM_AUTOR = "migracao-crm-antigo";

/** O contexto que todas as etapas do mapeador compartilham: o que já existe, o que sai e o que fica de fora. */
interface Contexto {
  readonly crmNovo: CrmNovoDoEspaco;
  readonly gerarId: () => string;
  readonly linhas: LinhasPorTabela;
  readonly deParas: DeParaParaInserir[];
  readonly naoMigrados: NaoMigrado[];
  /** As chaves já relatadas: o mesmo (categoria, registro) entra uma vez só. */
  readonly relatados: Set<string>;
}

/** Registra um item no relatório; o mesmo (categoria, registro) entra uma vez só. */
function relatar(ctx: Contexto, categoria: CategoriaNaoMigrada, colecao: string, id: string): void {
  const chave = `${categoria}\u0000${colecao}\u0000${id}`;
  if (ctx.relatados.has(chave)) return;
  ctx.relatados.add(chave);
  ctx.naoMigrados.push({ categoria, colecao, id });
}

function dePara(ctx: Contexto, colecaoAntiga: string, idAntigo: string, tabelaNova: string, idNovo: string): void {
  ctx.deParas.push({ colecao_antiga: colecaoAntiga, id_antigo: idAntigo, tabela_nova: tabelaNova, id_novo: idNovo });
}

// --- Partes comuns a Contato e Empresa ---

const ROTULOS_DE_ENDERECO = new Set(["residencial", "comercial", "outro"]);

function enderecosNovos(enderecos: readonly EnderecoAntigo[] | undefined): Record<string, unknown>[] {
  return lista(enderecos).map((antigo) => {
    const novo: Record<string, unknown> = { rotulo: ROTULOS_DE_ENDERECO.has(antigo.kind ?? "") ? antigo.kind : "outro" };
    const pegar = (chave: string, valor: unknown) => {
      const t = texto(valor);
      if (t !== null) novo[chave] = t;
    };
    pegar("logradouro", antigo.street);
    pegar("numero", antigo.number);
    pegar("complemento", antigo.complement);
    pegar("bairro", antigo.district);
    pegar("cidade", antigo.city);
    pegar("estado", antigo.region);
    pegar("pais", antigo.country);
    pegar("codigoPostal", antigo.postalCode);
    novo.principal = antigo.principal === true;
    return novo;
  });
}

/**
 * Campos personalizados: no CRM novo são chave → texto, número ou sim/não. A chave é o id da Definição de
 * Campo (a definição mora em `registros`, não nestas tabelas). Valor de lista e campo arquivado ficam fora.
 */
function camposAdicionais(valores: readonly ValorDeCampoAntigo[] | undefined, ctx: Contexto, colecao: string, id: string): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const campo of lista(valores)) {
    const chave = texto(campo.definitionId);
    if (chave === null || campo.state === "arquivado" || campo.value === null || campo.value === undefined) continue;
    if (typeof campo.value === "string" || typeof campo.value === "number" || typeof campo.value === "boolean") campos[chave] = campo.value;
    else relatar(ctx, "campo-nao-simples", colecao, id);
  }
  return campos;
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

type TipoDeIdentificador = "telefone" | "email" | "whatsapp" | "instagram";

/** Tipo do Identificador antigo → tipo da 007. Os que não estão aqui (LinkedIn, TikTok, chat do site) não têm destino. */
const TIPO_DE_IDENTIFICADOR: Readonly<Record<string, TipoDeIdentificador>> = {
  telefone: "telefone",
  email: "email",
  identidadeDeWhatsApp: "whatsapp",
  usuarioDeInstagram: "instagram",
};

function valorCanonico(tipo: TipoDeIdentificador, bruto: string): string {
  const normalizado = normalizarIdentificadorDeContato(tipo, bruto);
  if (normalizado.ok) return normalizado.value;
  // O dado antigo já foi normalizado pelo modelo antigo; se a regra nova o recusa, o valor é preservado
  // (aparado, na caixa que o tipo usa) em vez de perder o Identificador: o relatório seria o lugar errado
  // para uma pessoa sumir.
  if (tipo === "email") return bruto.trim().toLowerCase();
  if (tipo === "instagram") return bruto.trim().replace(/^@/, "").toLowerCase();
  return bruto.trim();
}

const CANAIS_DE_CONSENTIMENTO = new Set(["whatsapp", "instagram", "email", "todos"]);
const ORIGENS_DE_CONSENTIMENTO = new Set(["mensagem", "formulario", "verbal", "importacao", "automacao"]);

interface ContatosMapeados {
  readonly migrados: ReadonlySet<string>;
  /** `<contato>/<identificador antigo>` → id novo do Identificador. */
  readonly identificadores: ReadonlyMap<string, string>;
}

function mapearContatos(contatos: readonly ContatoAntigo[], ctx: Contexto): ContatosMapeados {
  const migrados = new Set<string>();
  const identificadores = new Map<string, string>();
  const novos: LinhaDeContato[] = [];
  const chavesDeIdentificador = new Set(ctx.crmNovo.identificadoresDeContato);

  // Os Contatos que migram: o id não pode já existir no CRM novo nem repetir no CRM antigo.
  const candidatos = contatos.filter((c) => {
    if (ctx.crmNovo.idsDeContato.has(c.id) || migrados.has(c.id)) {
      relatar(ctx, "id-ja-existe", "contacts", c.id);
      return false;
    }
    migrados.add(c.id);
    return true;
  });
  const sobreviventes = new Set(candidatos.filter((c) => c.lifecycle !== "mesclado").map((c) => c.id));

  for (const antigo of candidatos) {
    const mesclado = antigo.lifecycle === "mesclado";
    const sobrevivente = texto(antigo.mergedIntoId);
    // Mesclado exige sobrevivente que exista (`contatos_mesclado_ck` + FK): sem ele o Contato entra arquivado.
    const absorvido = mesclado && sobrevivente !== null && sobreviventes.has(sobrevivente) && sobrevivente !== antigo.id;
    if (mesclado && !absorvido) relatar(ctx, "contato-mesclado-sem-sobrevivente", "contacts", antigo.id);
    const criadoEm = instante(antigo.createdAt);
    const dono = texto(antigo.ownerMemberId) ?? texto(antigo.createdBy?.id) ?? SEM_AUTOR;

    novos.push({
      id: antigo.id,
      nome: texto(antigo.firstName),
      sobrenome: texto(antigo.lastName),
      data_nascimento: dia(antigo.birthDate),
      idioma: texto(antigo.language),
      fuso_horario: texto(antigo.timezone),
      descricao: texto(antigo.description),
      enderecos: enderecosNovos(antigo.addresses),
      campos_adicionais: camposAdicionais(antigo.fieldValues, ctx, "contacts", antigo.id),
      origem: texto(antigo.originId),
      qualificacao: texto(antigo.qualificationId),
      modo_criacao: MODO_DE_CRIACAO[antigo.creationMode ?? ""] ?? "manual",
      estado: absorvido ? "mesclado" : (ESTADO_DE_CICLO[antigo.lifecycle ?? ""] ?? "arquivado"),
      mesclado_em_id: absorvido ? sobrevivente : null,
      mesclado_em: absorvido ? (instante(antigo.mergedAt) ?? criadoEm ?? EPOCA) : null,
      proprietario_id: dono,
      criado_por: texto(antigo.createdBy?.id) ?? dono,
      criado_em: criadoEm,
    });
    dePara(ctx, "contacts", antigo.id, "contatos", antigo.id);

    // O que o CRM novo não tem: vai para o relatório e continua só na cópia.
    if (texto(antigo.temperatureId) !== null) relatar(ctx, "temperatura", "contacts", antigo.id);
    if (lista(antigo.tagIds).length > 0) relatar(ctx, "tags", "contacts", antigo.id);
    if (texto(antigo.photoFileId) !== null) relatar(ctx, "foto", "contacts", antigo.id);
    if (antigo.preMergeState !== undefined && antigo.preMergeState !== null) relatar(ctx, "historico-de-mesclagem", "contacts", antigo.id);
    if (antigo.provenance !== undefined && antigo.provenance !== null) relatar(ctx, "origem-da-copia", "contacts", antigo.id);

    // Identificadores: o principal de cada tipo é o primeiro que vier marcado (índice único parcial da 007).
    const principalDoTipo = new Set<string>();
    for (const ident of lista<IdentificadorAntigo>(antigo.identifiers)) {
      const tipo = TIPO_DE_IDENTIFICADOR[ident.type ?? ""];
      const bruto = texto(ident.value);
      if (tipo === undefined) {
        relatar(ctx, "identificador-sem-destino", "contacts", antigo.id);
        continue;
      }
      if (bruto === null) continue;
      const valor = valorCanonico(tipo, bruto);
      const chave = chaveDeIdentificadorDeContato(tipo, valor);
      if (chavesDeIdentificador.has(chave)) {
        relatar(ctx, "identificador-repetido", "contacts", antigo.id);
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
      identificadores.set(`${antigo.id}/${ident.id}`, idNovo);
      dePara(ctx, "contacts/identifiers", `${antigo.id}/${ident.id}`, "contato_identificadores", idNovo);
    }

    // Comentários viram Notas (só inserção); o apagado não vai.
    for (const comentario of lista(antigo.comments)) {
      const conteudo = texto(comentario.content);
      if (typeof comentario.deletedAt === "string" && comentario.deletedAt !== "") {
        relatar(ctx, "comentario-apagado", "contacts", antigo.id);
        continue;
      }
      if (conteudo === null) continue;
      ctx.linhas.contato_notas.push({
        contato_id: antigo.id,
        conteudo,
        autor_id: texto(comentario.author?.id) ?? SEM_AUTOR,
        criado_em: instante(comentario.createdAt),
      });
    }

    // Consentimentos: histórico só de inserção; o canal precisa existir na 011.
    for (const consentimento of lista(antigo.consents)) {
      const finalidade = texto(consentimento.purposeId);
      const canal = texto(consentimento.channelType);
      const decisao = consentimento.decision;
      if (finalidade === null || canal === null || !CANAIS_DE_CONSENTIMENTO.has(canal) || (decisao !== "concedido" && decisao !== "revogado")) {
        relatar(ctx, "consentimento-sem-destino", "contacts", antigo.id);
        continue;
      }
      ctx.linhas.contato_consentimentos.push({
        contato_id: antigo.id,
        finalidade_id: finalidade,
        tipo_de_canal: canal,
        decisao,
        em: instante(consentimento.at) ?? instante(consentimento.recordedAt) ?? criadoEm ?? EPOCA,
        origem: ORIGENS_DE_CONSENTIMENTO.has(consentimento.origin ?? "") ? consentimento.origin! : "importacao",
        evidencia_mensagem_id: texto(consentimento.evidenceMessageId),
        registrado_por: texto(consentimento.recordedBy?.id) ?? SEM_AUTOR,
        registrado_em: instante(consentimento.recordedAt),
      });
    }
  }

  // Sobreviventes primeiro, absorvidos depois (a ordem relativa de cada grupo é a antiga).
  ctx.linhas.contatos.push(...novos.filter((c) => c.mesclado_em_id === null), ...novos.filter((c) => c.mesclado_em_id !== null));
  return { migrados, identificadores };
}

// --- Empresa e vínculo Contato-Empresa ---

const TIPO_DE_IDENTIFICADOR_DE_EMPRESA: Readonly<Record<string, "dominio" | "documento_fiscal" | "telefone">> = {
  dominio: "dominio",
  documentoFiscal: "documento_fiscal",
  telefone: "telefone",
};

function valorCanonicoDeEmpresa(tipo: "dominio" | "documento_fiscal" | "telefone", bruto: string, pais: string | null): string {
  const normalizado = normalizarIdentificadorDeEmpresa(tipo, bruto, pais ?? undefined);
  if (normalizado.ok) return normalizado.value;
  // Identificador de Empresa nunca resolve Mensagem (007): preservar o valor é inofensivo.
  return tipo === "dominio" ? bruto.trim().toLowerCase() : bruto.trim();
}

interface VinculoValido {
  readonly antigo: VinculoContatoEmpresaAntigo;
  readonly contatoId: string;
  readonly empresaId: string;
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly vigente: boolean;
}

function mapearEmpresas(
  empresas: readonly EmpresaAntiga[],
  vinculos: readonly VinculoContatoEmpresaAntigo[],
  contatosMigrados: ReadonlySet<string>,
  ctx: Contexto,
): Set<string> {
  // 1) As Empresas que podem migrar por si: id livre, não mesclada, com algum nome.
  const candidatas = new Map<string, EmpresaAntiga>();
  for (const empresa of empresas) {
    if (ctx.crmNovo.idsDeEmpresa.has(empresa.id) || candidatas.has(empresa.id)) {
      relatar(ctx, "id-ja-existe", "companies", empresa.id);
    } else if (empresa.lifecycle === "mesclado") {
      relatar(ctx, "empresa-mesclada", "companies", empresa.id);
    } else if (texto(empresa.tradeName) === null && texto(empresa.legalName) === null) {
      relatar(ctx, "empresa-sem-nome", "companies", empresa.id);
    } else {
      candidatas.set(empresa.id, empresa);
    }
  }

  // 2) Os vínculos cujas duas pontas existem; só um vigente por par (`contato_empresa_vigente_uq`).
  const validos: VinculoValido[] = [];
  const paresVigentes = new Set<string>();
  for (const antigo of vinculos) {
    const contatoId = texto(antigo.contactId);
    const empresaId = texto(antigo.companyId);
    if (contatoId === null || empresaId === null || !contatosMigrados.has(contatoId) || !candidatas.has(empresaId)) {
      relatar(ctx, "vinculo-sem-ponta", "contactCompanyLinks", antigo.id);
      continue;
    }
    const inicio = dia(antigo.start);
    // Um `end` preenchido sempre encerra o vínculo; se a data é impossível, encerra no dia do início.
    const encerrado = texto(antigo.end) !== null;
    let fim = encerrado ? (dia(antigo.end) ?? inicio ?? "1970-01-01") : null;
    if (fim !== null && inicio !== null && fim < inicio) fim = inicio;
    const vigente = fim === null;
    if (vigente) {
      const par = `${contatoId}\u0000${empresaId}`;
      if (paresVigentes.has(par)) {
        relatar(ctx, "vinculo-repetido", "contactCompanyLinks", antigo.id);
        continue;
      }
      paresVigentes.add(par);
    }
    validos.push({ antigo, contatoId, empresaId, inicio, fim, vigente });
  }

  // 3) Toda Empresa fora da lixeira precisa de um vínculo admin vigente (`empresa_exige_admin`, no commit).
  const comAdmin = new Set(validos.filter((v) => v.vigente && v.antigo.principalForCompany === true).map((v) => v.empresaId));
  const migradas = new Set<string>();
  for (const empresa of candidatas.values()) {
    if (ESTADO_DE_CICLO[empresa.lifecycle ?? ""] !== "na_lixeira" && !comAdmin.has(empresa.id)) {
      relatar(ctx, "empresa-sem-admin", "companies", empresa.id);
    } else {
      migradas.add(empresa.id);
    }
  }

  // 4) As linhas da Empresa, com a matriz antes da filial (a FK da matriz não é adiável em pedaços separados).
  const linhas = new Map<string, LinhaDeEmpresa>();
  const chavesDeIdentificador = new Set(ctx.crmNovo.identificadoresDeEmpresa);
  for (const empresa of candidatas.values()) {
    if (!migradas.has(empresa.id)) continue;
    const matriz = texto(empresa.parentCompanyId);
    const matrizMigrou = matriz !== null && matriz !== empresa.id && migradas.has(matriz);
    if (matriz !== null && !matrizMigrou) relatar(ctx, "empresa-matriz-perdida", "companies", empresa.id);
    const dono = texto(empresa.ownerMemberId) ?? texto(empresa.createdBy?.id) ?? SEM_AUTOR;
    linhas.set(empresa.id, {
      id: empresa.id,
      nome_fantasia: texto(empresa.tradeName),
      razao_social: texto(empresa.legalName),
      descricao: texto(empresa.description),
      matriz_id: matrizMigrou ? matriz : null,
      enderecos: enderecosNovos(empresa.addresses),
      campos_adicionais: camposAdicionais(empresa.fieldValues, ctx, "companies", empresa.id),
      origem: texto(empresa.originId),
      estado: ESTADO_DE_CICLO[empresa.lifecycle ?? ""] ?? "arquivado",
      proprietario_id: dono,
      criado_por: texto(empresa.createdBy?.id) ?? dono,
      criado_em: instante(empresa.createdAt),
    });
    dePara(ctx, "companies", empresa.id, "empresas", empresa.id);
    if (lista(empresa.tagIds).length > 0) relatar(ctx, "tags", "companies", empresa.id);
    if (lista(empresa.attachments).length > 0 || lista(empresa.comments).length > 0) relatar(ctx, "anexos-e-comentarios", "companies", empresa.id);

    const principalDoTipo = new Set<string>();
    for (const ident of lista(empresa.identifiers)) {
      const tipo = TIPO_DE_IDENTIFICADOR_DE_EMPRESA[ident.type ?? ""];
      const bruto = texto(ident.value);
      if (tipo === undefined || bruto === null) continue;
      const pais = texto(ident.country);
      if (tipo === "documento_fiscal" && pais === null) {
        relatar(ctx, "identificador-de-empresa-sem-pais", "companies", empresa.id);
        continue;
      }
      const valor = valorCanonicoDeEmpresa(tipo, bruto, pais);
      const chave = chaveDeIdentificadorDeEmpresa(tipo, valor);
      if (chavesDeIdentificador.has(chave)) {
        relatar(ctx, "identificador-de-empresa-repetido", "companies", empresa.id);
        continue;
      }
      chavesDeIdentificador.add(chave);
      const principal = ident.principal === true && !principalDoTipo.has(tipo);
      if (principal) principalDoTipo.add(tipo);
      const idNovo = ctx.gerarId();
      ctx.linhas.empresa_identificadores.push({
        id: idNovo,
        empresa_id: empresa.id,
        tipo,
        valor,
        pais: tipo === "documento_fiscal" ? pais : null,
        verificado: ident.verified === true,
        principal,
        criado_em: instante(ident.createdAt),
      });
      dePara(ctx, "companies/identifiers", `${empresa.id}/${ident.id}`, "empresa_identificadores", idNovo);
    }
  }
  // Matriz antes da filial: emite cada Empresa depois da matriz dela.
  const emitidas = new Set<string>();
  const emitir = (id: string): void => {
    if (emitidas.has(id)) return;
    emitidas.add(id);
    const linha = linhas.get(id)!;
    if (linha.matriz_id !== null) emitir(linha.matriz_id);
    ctx.linhas.empresas.push(linha);
  };
  for (const id of linhas.keys()) emitir(id);

  // 5) Os vínculos das Empresas que migraram.
  for (const vinculo of validos) {
    if (!migradas.has(vinculo.empresaId)) {
      relatar(ctx, "vinculo-sem-ponta", "contactCompanyLinks", vinculo.antigo.id);
      continue;
    }
    const idNovo = ctx.gerarId();
    ctx.linhas.contato_empresa.push({
      id: idNovo,
      contato_id: vinculo.contatoId,
      empresa_id: vinculo.empresaId,
      cargo: texto(vinculo.antigo.role),
      admin: vinculo.antigo.principalForCompany === true,
      inicio: vinculo.inicio,
      fim: vinculo.fim,
      criado_por: texto(vinculo.antigo.createdBy?.id) ?? SEM_AUTOR,
      criado_em: instante(vinculo.antigo.createdAt),
    });
    dePara(ctx, "contactCompanyLinks", vinculo.antigo.id, "contato_empresa", idNovo);
    if (vinculo.antigo.principalForContact === true) relatar(ctx, "vinculo-principal-do-contato", "contactCompanyLinks", vinculo.antigo.id);
  }
  return migradas;
}

// --- Funil (só o que a Etapa perde) e Negócio ---

function relatarRegrasDaEtapa(funis: readonly FunilAntigo[], funisMigrados: ReadonlyMap<string, ReadonlySet<string>>, ctx: Contexto): void {
  for (const funil of funis) {
    if (!funisMigrados.has(funil.id)) continue;
    const comRegra = lista(funil.stages).some((etapa) => {
      const e = etapa as { requirements?: unknown[]; allowedTransitionStageIds?: unknown[] };
      return lista(e.requirements).length > 0 || lista(e.allowedTransitionStageIds).length > 0;
    });
    if (comRegra) relatar(ctx, "regras-da-etapa", "funnels", funil.id);
  }
}

const SITUACOES_DE_NEGOCIO = new Set(["aberto", "ganho", "perdido"]);
const LIMITE_DO_VALOR = 9_999_999_999_999;

function mapearNegocios(
  negocios: readonly NegocioAntigo[],
  empresasMigradas: ReadonlySet<string>,
  contatosMigrados: ReadonlySet<string>,
  funisMigrados: ReadonlyMap<string, ReadonlySet<string>>,
  ctx: Contexto,
): void {
  const vistos = new Set<string>();
  for (const antigo of negocios) {
    if (ctx.crmNovo.idsDeNegocio.has(antigo.id) || vistos.has(antigo.id)) {
      relatar(ctx, "id-ja-existe", "deals", antigo.id);
      continue;
    }
    const titulo = texto(antigo.title);
    if (titulo === null) {
      relatar(ctx, "negocio-sem-titulo", "deals", antigo.id);
      continue;
    }

    // O dono: a Empresa, se tem; senão o Contato principal; senão o primeiro Contato que migrou.
    const empresaId = texto(antigo.companyId);
    const ligacoes = lista(antigo.contactLinks).filter((l) => texto(l.contactId) !== null && contatosMigrados.has(l.contactId!));
    let donoEmpresa: string | null = null;
    let donoContato: string | null = null;
    if (empresaId !== null) {
      if (!empresasMigradas.has(empresaId)) {
        relatar(ctx, "negocio-sem-empresa-migrada", "deals", antigo.id);
        continue;
      }
      donoEmpresa = empresaId;
    } else {
      const escolhido = ligacoes.find((l) => l.principal === true) ?? ligacoes[0];
      if (escolhido === undefined) {
        relatar(ctx, "negocio-sem-dono", "deals", antigo.id);
        continue;
      }
      donoContato = escolhido.contactId!;
    }

    const funilId = texto(antigo.funnelId);
    const etapaId = texto(antigo.stageId);
    if (funilId === null || etapaId === null || !(funisMigrados.get(funilId)?.has(etapaId) ?? false)) {
      relatar(ctx, "negocio-sem-funil-migrado", "deals", antigo.id);
      continue;
    }
    vistos.add(antigo.id);

    // O que o Negócio novo não guarda.
    const todosOsContatos = lista(antigo.contactLinks).length;
    const outrosContatos = donoEmpresa !== null ? todosOsContatos : todosOsContatos - 1;
    if (
      outrosContatos > 0 ||
      texto(antigo.readableId) !== null ||
      lista(antigo.fieldValues).length > 0 ||
      lista(antigo.stageHistory).length > 0
    ) {
      relatar(ctx, "negocio-detalhes", "deals", antigo.id);
    }
    if (lista(antigo.tagIds).length > 0) relatar(ctx, "tags", "deals", antigo.id);
    if (lista(antigo.attachments).length > 0 || lista(antigo.comments).length > 0) relatar(ctx, "anexos-e-comentarios", "deals", antigo.id);

    // Valor: numeric(15,2) e não negativo (`negocios_valor_ck`).
    let valor: number | null = null;
    const quantia = antigo.value?.amount;
    if (quantia !== undefined && quantia !== null) {
      if (typeof quantia === "number" && Number.isFinite(quantia) && quantia >= 0 && quantia <= LIMITE_DO_VALOR) valor = Math.round(quantia * 100) / 100;
      else relatar(ctx, "valor-invalido", "deals", antigo.id);
    }
    const moeda = texto(antigo.value?.currency)?.toUpperCase();
    const situacao = SITUACOES_DE_NEGOCIO.has(antigo.situation ?? "") ? antigo.situation! : "aberto";
    const probabilidade = typeof antigo.overriddenProbability === "number" && Number.isFinite(antigo.overriddenProbability) ? Math.min(100, Math.max(0, Math.round(antigo.overriddenProbability))) : null;
    const dono = texto(antigo.ownerMemberId) ?? texto(antigo.createdBy?.id) ?? SEM_AUTOR;
    const criadoEm = instante(antigo.createdAt);

    ctx.linhas.negocios.push({
      id: antigo.id,
      titulo,
      objeto: texto(antigo.object),
      descricao: texto(antigo.description),
      empresa_id: donoEmpresa,
      contato_id: donoContato,
      funil_id: funilId,
      etapa_id_antiga: etapaId,
      valor,
      moeda: moeda !== undefined && /^[A-Z]{3}$/.test(moeda) ? moeda : "BRL",
      probabilidade,
      situacao,
      motivo_perda: situacao === "perdido" ? texto(antigo.lossReasonId) : null,
      motivo_ganho: situacao === "ganho" ? texto(antigo.winReasonId) : null,
      nota_encerramento: texto(antigo.closingNote),
      origem: texto(antigo.originId),
      data_prevista_fechamento: dia(antigo.expectedCloseDate),
      // `(situacao = 'aberto') = (encerrado_em is null)`: encerrado sempre tem data, aberto nunca.
      encerrado_em: situacao === "aberto" ? null : (instante(antigo.closedAt) ?? criadoEm ?? EPOCA),
      estado: ESTADO_DE_CICLO[antigo.lifecycle ?? ""] ?? "ativo",
      proprietario_id: dono,
      criado_por: texto(antigo.createdBy?.id) ?? dono,
      criado_em: criadoEm,
    });
    dePara(ctx, "deals", antigo.id, "negocios", antigo.id);
  }
}

// --- Canal ---

function mapearCanais(canais: readonly CanalAntigo[], ctx: Contexto): Map<string, TipoComProvedor> {
  const migrados = new Map<string, TipoComProvedor>();
  const nomes = new Set(ctx.crmNovo.nomesDeCanalAtivo);
  const contas = new Set(ctx.crmNovo.contasDeCanalAtivo);
  for (const antigo of canais) {
    const tipo = antigo.channelType;
    if (tipo !== "whatsapp" && tipo !== "instagram" && tipo !== "email") {
      relatar(ctx, "canal-sem-destino", "channels", antigo.id);
      continue;
    }
    if (ctx.crmNovo.idsDeCanal.has(antigo.id) || migrados.has(antigo.id)) {
      relatar(ctx, "id-ja-existe", "channels", antigo.id);
      continue;
    }
    const nome = texto(antigo.name);
    const identificador = texto(antigo.externalId);
    if (nome === null || identificador === null) {
      relatar(ctx, "canal-invalido", "channels", antigo.id);
      continue;
    }
    const arquivado = antigo.lifecycle === "arquivado";
    if (!arquivado) {
      // `canais_nome_uq` e `canais_conta_uq` só valem entre os Canais ativos.
      const chaveDoNome = nome.toLowerCase();
      const conta = chaveDeContaDeCanal(tipo, identificador);
      if (nomes.has(chaveDoNome) || contas.has(conta)) {
        relatar(ctx, "canal-repetido", "channels", antigo.id);
        continue;
      }
      nomes.add(chaveDoNome);
      contas.add(conta);
    }
    // O provedor explícito vale só se for do tipo do Canal (`canais_provedor_tipo_ck`).
    const explicito = texto(antigo.provider);
    const provedor = explicito !== null && Object.prototype.hasOwnProperty.call(PROVEDORES, explicito) && PROVEDORES[explicito as keyof typeof PROVEDORES].tipo === tipo ? explicito : PROVEDOR_PADRAO_DO_TIPO[tipo];
    const criadoPor = texto(antigo.createdBy?.id) ?? SEM_AUTOR;
    ctx.linhas.canais.push({
      id: antigo.id,
      nome,
      tipo,
      provedor,
      identificador_externo: identificador,
      estado: arquivado ? "arquivado" : "ativo",
      arquivado_em: arquivado ? (instante(antigo.archivedAt) ?? instante(antigo.createdAt) ?? EPOCA) : null,
      configurado_por: texto(antigo.configuredByMemberId) ?? criadoPor,
      fila_padrao_id: texto(antigo.defaultQueueId),
      proprietario_padrao_id: texto(antigo.defaultContactOwnerMemberId),
      origem_padrao_id: texto(antigo.defaultOriginId),
      grupos_habilitados: antigo.groupsEnabled === true,
      criado_por: criadoPor,
      criado_em: instante(antigo.createdAt),
    });
    migrados.set(antigo.id, tipo);
    dePara(ctx, "channels", antigo.id, "canais", antigo.id);
    if (lista(antigo.messageTemplates).length > 0) relatar(ctx, "modelos-de-mensagem", "channels", antigo.id);
  }
  return migrados;
}

// --- Conversa e Mensagem ---

const SITUACOES_DE_CONVERSA = new Set(["aberta", "pendente", "resolvida"]);
const PAPEIS_DE_PARTICIPANTE = new Set(["contato", "atendente", "agente", "observador"]);
const SUJEITO_DO_PARTICIPANTE: Readonly<Record<string, string>> = { contact: "contato", member: "membro", agent: "agente" };
const ATORES_DE_MENSAGEM = new Set(["member", "agent", "automation", "integration", "system"]);
const DIRECOES = new Set(["recebida", "enviada", "interna"]);
const STATUS_DE_ENTREGA = new Set(["pendente", "enviada", "entregue", "lida", "falhou"]);
const TIPOS_DE_ENDERECO_ADICIONAL = new Set(["para", "copia", "copiaOculta"]);

function atorDaMensagem(ator: AtorAntigo | undefined): { tipo: string; id: string } {
  return { tipo: ATORES_DE_MENSAGEM.has(ator?.kind ?? "") ? ator!.kind! : "system", id: texto(ator?.id) ?? "sistema" };
}

interface ConversaCandidata {
  readonly antiga: ConversaAntiga;
  readonly linha: LinhaDeConversa;
  readonly ordem: number;
  readonly par: string | null;
}

function mapearConversas(
  conversas: readonly ConversaAntiga[],
  canaisMigrados: ReadonlyMap<string, TipoComProvedor>,
  contatosMigrados: ReadonlySet<string>,
  identificadores: ReadonlyMap<string, string>,
  ctx: Contexto,
): void {
  // 1) O que cada Conversa vira, sem olhar ainda para a colisão de par.
  const candidatas: ConversaCandidata[] = [];
  const vistas = new Set<string>();
  conversas.forEach((antiga, ordem) => {
    const contatoId = texto(antiga.contactId);
    const canalId = texto(antiga.channelId);
    if (ctx.crmNovo.idsDeConversa.has(antiga.id) || vistas.has(antiga.id)) {
      relatar(ctx, "id-ja-existe", "conversations", antiga.id);
      return;
    }
    if (contatoId === null || !contatosMigrados.has(contatoId)) {
      relatar(ctx, "conversa-sem-contato", "conversations", antiga.id);
      return;
    }
    if (canalId === null || !canaisMigrados.has(canalId)) {
      relatar(ctx, "conversa-sem-canal-migrado", "conversations", antiga.id);
      return;
    }
    vistas.add(antiga.id);

    const criadoEm = instante(antiga.createdAt);
    const naLixeira = antiga.lifecycle === "naLixeira";
    // Conversa na lixeira entra resolvida (`conversas_lixeira_ck`) e com a data (`conversas_na_lixeira_em_ck`).
    const situacao = naLixeira ? "resolvida" : SITUACOES_DE_CONVERSA.has(antiga.state ?? "") ? antiga.state! : "aberta";
    const ativa = !naLixeira;
    const atribuidoTipo = antiga.assignee?.kind === "member" ? "membro" : antiga.assignee?.kind === "agent" ? "agente" : null;
    const atribuidoId = texto(antiga.assignee?.id);
    const atribuir = atribuidoTipo !== null && atribuidoId !== null;
    const adiadaAte = situacao === "pendente" ? instante(antiga.snooze?.until) : null;

    const participantes = lista(antiga.participants).flatMap((p) => {
      const tipo = SUJEITO_DO_PARTICIPANTE[p.subject?.kind ?? ""];
      const sujeito = texto(p.subject?.id);
      if (tipo === undefined || sujeito === null) return [];
      return [
        {
          id: texto(p.id) ?? ctx.gerarId(),
          sujeito: { tipo, id: sujeito },
          papel: PAPEIS_DE_PARTICIPANTE.has(p.role ?? "") ? p.role! : "observador",
          principal: p.principal === true,
          entrouEm: instante(p.enteredAt) ?? criadoEm ?? EPOCA,
          saiuEm: instante(p.leftAt),
        },
      ];
    });
    if (lista(antiga.drafts).length > 0 || lista(antiga.tagIds).length > 0 || lista(antiga.fieldValues).length > 0) {
      relatar(ctx, "conversa-detalhes", "conversations", antiga.id);
    }
    const reaberturas = typeof antiga.reopenCount === "number" && Number.isFinite(antiga.reopenCount) ? Math.max(0, Math.trunc(antiga.reopenCount)) : 0;

    const linha: LinhaDeConversa = {
      id: antiga.id,
      canal_id: canalId,
      contato_id: contatoId,
      titulo: texto(antiga.title) ?? "Conversa",
      titulo_editado: antiga.titleEdited === true,
      situacao,
      estado: ativa ? "ativo" : "na_lixeira",
      fila_id: texto(antiga.queueId),
      atribuido_tipo: atribuir ? atribuidoTipo : null,
      atribuido_id: atribuir ? atribuidoId : null,
      adiada_ate: adiadaAte,
      adiamento_motivo: adiadaAte !== null ? texto(antiga.snooze?.reason) : null,
      participantes,
      resolvida_em: instante(antiga.resolvedAt),
      reaberta_em: instante(antiga.reopenedAt),
      reaberturas,
      criado_por_tipo: texto(antiga.createdBy?.kind) ?? "system",
      criado_por_id: texto(antiga.createdBy?.id) ?? "sistema",
      criado_em: criadoEm,
      na_lixeira_em: naLixeira ? (instante(antiga.trashedAt) ?? instante(antiga.resolvedAt) ?? criadoEm ?? EPOCA) : null,
    };
    // `conversas_nao_resolvida_uq`: uma aberta ou pendente e ativa por (Contato, Canal).
    const par = ativa && situacao !== "resolvida" ? chaveDeParDeConversa(contatoId, canalId) : null;
    candidatas.push({ antiga, linha, ordem, par });
  });

  // 2) Colisão de par: a mais recente entra (empate: a que vem depois); o CRM novo já ocupando o par vence todas.
  const vencedora = new Map<string, ConversaCandidata>();
  for (const candidata of candidatas) {
    if (candidata.par === null) continue;
    const atual = vencedora.get(candidata.par);
    if (atual === undefined || ms(candidata.linha.criado_em) >= ms(atual.linha.criado_em)) vencedora.set(candidata.par, candidata);
  }
  const migradas: ConversaCandidata[] = [];
  for (const candidata of candidatas) {
    const perde = candidata.par !== null && (ctx.crmNovo.conversasNaoResolvidas.has(candidata.par) || vencedora.get(candidata.par) !== candidata);
    if (perde) relatar(ctx, "conversa-repetida", "conversations", candidata.antiga.id);
    else migradas.push(candidata);
  }

  // 3) As linhas da Conversa, as marcações e as Mensagens.
  const todasAsMensagens: Array<{ mensagem: MensagemAntiga; conversa: ConversaCandidata; ordem: number; instante: number }> = [];
  for (const candidata of migradas) {
    const { antiga, linha } = candidata;
    ctx.linhas.conversas.push(linha);
    dePara(ctx, "conversations", antiga.id, "conversas", antiga.id);
    for (const membro of new Set(lista(antiga.starredBy).map(texto).filter((m): m is string => m !== null))) {
      ctx.linhas.conversa_marcacoes.push({ conversa_id: antiga.id, membro_id: membro, estrela: true });
    }
    for (const mensagem of lista(antiga.messages)) {
      todasAsMensagens.push({ mensagem, conversa: candidata, ordem: todasAsMensagens.length, instante: ms(instante(mensagem.createdAt) ?? linha.criado_em) });
    }
  }
  // A `seq` da Mensagem é uma identity: nasce na ordem da inserção, então a ordem de createdAt é a do envio.
  todasAsMensagens.sort((a, b) => a.instante - b.instante || a.ordem - b.ordem);
  mapearMensagens(todasAsMensagens, identificadores, ctx);
}

function mapearMensagens(
  mensagens: ReadonlyArray<{ mensagem: MensagemAntiga; conversa: ConversaCandidata; ordem: number; instante: number }>,
  identificadores: ReadonlyMap<string, string>,
  ctx: Contexto,
): void {
  const idsEmitidos = new Set<string>();
  const idsPorConversa = new Map<string, Set<string>>();
  const idsExternos = new Set<string>();
  for (const { mensagem: antiga, conversa } of mensagens) {
    const { linha: daConversa, antiga: conversaAntiga } = conversa;
    if (ctx.crmNovo.idsDeMensagem.has(antiga.id) || idsEmitidos.has(antiga.id)) {
      relatar(ctx, "id-ja-existe", "conversations", conversaAntiga.id);
      continue;
    }
    if (antiga.flow !== undefined && antiga.flow !== null) relatar(ctx, "mensagem-flow", "conversations", conversaAntiga.id);
    if (antiga.respostaDeFlow !== undefined && antiga.respostaDeFlow !== null) relatar(ctx, "mensagem-flow", "conversations", conversaAntiga.id);

    const direcao = DIRECOES.has(antiga.direction ?? "") ? antiga.direction! : "interna";
    const conteudo = typeof antiga.content === "string" ? antiga.content : null;
    const anexos = lista(antiga.attachments).map((a) => ({
      tipoDeMidia: texto(a.mediaType) ?? "other",
      nome: texto(a.displayName) ?? "",
      ...(texto(a.fileId) !== null ? { referenciaExterna: texto(a.fileId) } : {}),
    }));
    const anonimizada = antiga.anonymized === true;
    const exclusao = antiga.deletionMark !== undefined && antiga.deletionMark !== null ? antiga.deletionMark : null;
    // INV-CXE-07 (`mensagens_conteudo_ck`): texto ou anexo, salvo anonimizada ou com marca de exclusão.
    if (!anonimizada && exclusao === null && (conteudo === null || conteudo.trim() === "") && anexos.length === 0) {
      relatar(ctx, "mensagem-vazia", "conversations", conversaAntiga.id);
      continue;
    }

    const ator = direcao === "recebida" ? { tipo: "integration", id: daConversa.canal_id } : atorDaMensagem(antiga.actor);
    const delegante = antiga.delegate?.kind !== undefined && ATORES_DE_MENSAGEM.has(antiga.delegate.kind) && texto(antiga.delegate.id) !== null ? atorDaMensagem(antiga.delegate) : null;

    // Id externo: obrigatório na recebida, ausente na interna, único por Canal (`mensagens_id_externo_uq`).
    let idExterno: string | null = null;
    if (direcao !== "interna") {
      const informado = texto(antiga.externalId);
      const chave = (id: string) => `${daConversa.canal_id}\u0000${id}`;
      if (informado !== null && !idsExternos.has(chave(informado))) idExterno = informado;
      else if (direcao === "recebida") idExterno = `migrado:${antiga.id}`;
      if (idExterno !== null) idsExternos.add(chave(idExterno));
    }

    const status = direcao === "enviada" ? (STATUS_DE_ENTREGA.has(antiga.deliveryStatus ?? "") ? antiga.deliveryStatus! : "enviada") : null;
    const resposta = texto(antiga.inReplyToMessageId);
    // A resposta só aponta para uma Mensagem já inserida da MESMA Conversa (`INV-CXE-10`).
    const respostaValida = resposta !== null && (idsPorConversa.get(daConversa.id)?.has(resposta) ?? false) ? resposta : null;

    ctx.linhas.mensagens.push({
      id: antiga.id,
      conversa_id: daConversa.id,
      canal_id: daConversa.canal_id,
      direcao,
      ator_tipo: ator.tipo,
      ator_id: ator.id,
      delegante_tipo: delegante?.tipo ?? null,
      delegante_id: delegante?.id ?? null,
      remetente_participante_id: texto(antiga.senderParticipantId),
      identificador_id: identificadores.get(`${daConversa.contato_id}/${texto(antiga.viaIdentifierId)}`) ?? null,
      conteudo,
      anexos,
      assunto: texto(antiga.subject),
      enderecos_adicionais: lista(antiga.additionalAddresses).flatMap((e) =>
        texto(e.address) !== null && TIPOS_DE_ENDERECO_ADICIONAL.has(e.kind ?? "")
          ? [{ tipo: e.kind, endereco: texto(e.address), ...(texto(e.displayName) !== null ? { nomeExibido: texto(e.displayName) } : {}) }]
          : [],
      ),
      em_resposta_a_id: respostaValida,
      id_externo: idExterno,
      status_entrega: status,
      motivo_falha: status === "falhou" ? texto(antiga.deliveryFailureReason) : null,
      leituras_internas: lista(antiga.internalReads),
      reacoes: lista(antiga.reactions),
      marcacao_exclusao: exclusao,
      edicoes_externas: lista(antiga.externalEdits),
      anonimizada,
      criado_em: instante(antiga.createdAt) ?? daConversa.criado_em,
    });
    idsEmitidos.add(antiga.id);
    let daqui = idsPorConversa.get(daConversa.id);
    if (!daqui) idsPorConversa.set(daConversa.id, (daqui = new Set()));
    daqui.add(antiga.id);
    dePara(ctx, "conversations/messages", `${conversaAntiga.id}/${antiga.id}`, "mensagens", antiga.id);
  }
}

/**
 * Decide o que cada linha do CRM antigo vira. `linhasAntigas` são as linhas de `plataforma.registros` (ou da
 * fixture) das nove coleções; as Conversas de Grupo ficam em `registros` e não entram aqui (F14-D-05).
 *
 * A ordem das etapas é a das dependências: Contato → Empresa e vínculo → Canal → Negócio → Conversa e Mensagem.
 */
export function planejarMigracao(
  linhasAntigas: readonly RegistroAntigo[],
  crmNovo: CrmNovoDoEspaco = CRM_NOVO_VAZIO,
  opcoes: OpcoesDoMapeador = {},
): PlanoDeMigracao {
  const semGrupo = linhasAntigas.filter((l) => !(l.colecao === "conversations" && ehConversaDeGrupo(l.dados)));
  const porColecao = agruparPorColecao(semGrupo);
  const funisMigrados = opcoes.funisMigrados ?? new Map<string, ReadonlySet<string>>();
  const ctx: Contexto = {
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
    relatados: new Set(),
  };

  const contatos = mapearContatos(dadosDe<ContatoAntigo>(porColecao, "contacts"), ctx);
  const empresasMigradas = mapearEmpresas(dadosDe<EmpresaAntiga>(porColecao, "companies"), dadosDe<VinculoContatoEmpresaAntigo>(porColecao, "contactCompanyLinks"), contatos.migrados, ctx);
  for (const vinculo of dadosDe<VinculoSoComIdAntigo>(porColecao, "companyCompanyLinks")) relatar(ctx, "vinculo-empresa-empresa", "companyCompanyLinks", vinculo.id);
  for (const vinculo of dadosDe<VinculoSoComIdAntigo>(porColecao, "distinctFromLinks")) relatar(ctx, "distinto-de", "distinctFromLinks", vinculo.id);
  relatarRegrasDaEtapa(dadosDe<FunilAntigo>(porColecao, "funnels"), funisMigrados, ctx);
  mapearNegocios(dadosDe<NegocioAntigo>(porColecao, "deals"), empresasMigradas, contatos.migrados, funisMigrados, ctx);
  const canais = mapearCanais(dadosDe<CanalAntigo>(porColecao, "channels"), ctx);
  mapearConversas(dadosDe<ConversaAntiga>(porColecao, "conversations"), canais, contatos.migrados, contatos.identificadores, ctx);

  return { linhasPorTabela: ctx.linhas, deParas: ctx.deParas, naoMigrados: ctx.naoMigrados };
}
