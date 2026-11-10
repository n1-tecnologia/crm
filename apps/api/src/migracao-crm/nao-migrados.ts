/**
 * O que o mapeador NÃO leva para as tabelas novas (15-28): o relatório "não migrados".
 *
 * Cada item é só uma coleção antiga e um id (nunca nome, telefone, e-mail ou texto de Mensagem, T-15-67),
 * numa categoria que diz por que ficou de fora. Tudo continua em `registros_crm_antigo`: não migrar não
 * apaga nada, só deixa de aparecer na tela nova.
 */

export const CATEGORIAS_NAO_MIGRADAS = {
  // Contato
  temperatura: "Temperatura do Contato (D-15-06: o CRM novo não tem temperatura)",
  tags: "Tags (o CRM novo não tem Tag)",
  foto: "Foto do Contato (arquivo do Espaço; a coluna nova é uma URL)",
  "historico-de-mesclagem": "Cópia de antes da mesclagem",
  "origem-da-copia": "Origem (proveniência) do registro",
  "identificador-sem-destino": "Identificadores de LinkedIn, TikTok e chat do site (nenhum Canal novo os resolve)",
  "identificador-repetido": "Identificador repetido no Espaço (a unicidade do CRM novo recusa o segundo)",
  "consentimento-sem-destino": "Consentimento que o CRM novo não guarda (canal LinkedIn ou chat do site, ou registro incompleto)",
  "campo-nao-simples": "Campo personalizado com lista de valores (o CRM novo guarda só texto, número ou sim/não)",
  "contato-mesclado-sem-sobrevivente": "Contato mesclado cujo sobrevivente não migrou (entrou como arquivado)",
  "comentario-apagado": "Comentário do Contato já apagado",
  "id-ja-existe": "O id já existe no CRM novo do Espaço",
  // Empresa
  "empresa-mesclada": "Empresa mesclada (o CRM novo não tem Empresa mesclada)",
  "empresa-sem-nome": "Empresa sem nome fantasia nem razão social",
  "empresa-sem-admin": "Empresa sem vínculo admin vigente (o CRM novo exige um)",
  "empresa-matriz-perdida": "Empresa cuja matriz não migrou (entrou sem matriz)",
  "identificador-de-empresa-sem-pais": "Documento fiscal de Empresa sem país",
  "identificador-de-empresa-repetido": "Identificador de Empresa repetido no Espaço",
  "anexos-e-comentarios": "Anexos e comentários da Empresa e do Negócio (sem tabela no CRM novo)",
  "vinculo-empresa-empresa": "Vínculo Empresa-Empresa (sem tabela no CRM novo)",
  "distinto-de": "Vínculo \"distinto de\" entre Contatos (sem tabela no CRM novo)",
  "vinculo-sem-ponta": "Vínculo Contato-Empresa cujo Contato ou Empresa não migrou",
  "vinculo-repetido": "Vínculo Contato-Empresa vigente repetido",
  "vinculo-principal-do-contato": "Marca de Empresa principal do Contato (o CRM novo não tem)",
  // Funil
  "regras-da-etapa": "Requisitos e transições permitidas da Etapa (F14-D-04)",
  // Negócio
  "negocio-sem-dono": "Negócio sem Empresa nem Contato que possa ser o dono",
  "negocio-sem-empresa-migrada": "Negócio de uma Empresa que não migrou",
  "negocio-sem-funil-migrado": "Negócio de um Funil ou Etapa que não migrou",
  "negocio-sem-titulo": "Negócio sem título",
  "negocio-detalhes": "Código legível, campos personalizados, histórico de Etapas e demais Contatos do Negócio",
  "valor-invalido": "Valor do Negócio negativo ou inválido (entrou sem valor)",
  // Canal
  "canal-sem-destino": "Canal de LinkedIn ou chat do site (o CRM novo só tem WhatsApp, Instagram e e-mail)",
  "canal-invalido": "Canal sem nome ou sem identificador externo",
  "canal-repetido": "Canal com nome ou conta repetidos entre os ativos",
  "modelos-de-mensagem": "Modelos de Mensagem do Canal",
  // Conversa e Mensagem
  "conversa-sem-contato": "Conversa sem Contato",
  "conversa-sem-canal-migrado": "Conversa de um Canal que não migrou",
  "conversa-repetida": "Conversa não resolvida repetida no mesmo Contato e Canal (a mais recente entra)",
  "conversa-detalhes": "Rascunhos (D-15-11), Tags e campos personalizados da Conversa",
  "mensagem-vazia": "Mensagem sem texto nem anexo",
  "mensagem-sem-id": "Mensagem sem id (o id é obrigatório no CRM novo; o id da Conversa é o que o relatório mostra)",
  "mensagem-flow": "Mensagem de Flow (Flow fica no modelo antigo)",
} as const;

export type CategoriaNaoMigrada = keyof typeof CATEGORIAS_NAO_MIGRADAS;

/** Um registro antigo que ficou de fora de alguma tabela, ou um pedaço dele. */
export interface NaoMigrado {
  readonly categoria: CategoriaNaoMigrada;
  /** A coleção antiga (`contacts`, `deals`...). */
  readonly colecao: string;
  /** O id do registro antigo que contém o item. */
  readonly id: string;
}

export interface GrupoDeNaoMigrados {
  readonly categoria: CategoriaNaoMigrada;
  readonly rotulo: string;
  readonly ids: readonly string[];
}

/** Agrupa por categoria, na ordem em que a tabela acima as declara; cada id aparece uma vez por categoria. */
export function agruparNaoMigrados(itens: readonly NaoMigrado[]): GrupoDeNaoMigrados[] {
  const porCategoria = new Map<CategoriaNaoMigrada, Set<string>>();
  for (const item of itens) {
    let ids = porCategoria.get(item.categoria);
    if (!ids) porCategoria.set(item.categoria, (ids = new Set()));
    ids.add(`${item.colecao}:${item.id}`);
  }
  const ordem = Object.keys(CATEGORIAS_NAO_MIGRADAS) as CategoriaNaoMigrada[];
  return ordem
    .filter((categoria) => porCategoria.has(categoria))
    .map((categoria) => ({ categoria, rotulo: CATEGORIAS_NAO_MIGRADAS[categoria], ids: [...porCategoria.get(categoria)!] }));
}
