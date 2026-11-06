/**
 * As nove coleções do CRM antigo e as regras de Espaço do script `migrar:crm-antigo` (15-27).
 *
 * Os nomes são os de `plataforma.registros.colecao` (inglês, como o modelo antigo os gravou). Ficam
 * aqui como TEXTO e não como tipos do domínio: o script tem de sobreviver à remoção do modelo
 * antigo (3.5.4) sem mudar uma linha.
 */

/** As nove coleções que o corte tira de `plataforma.registros`. */
export const COLECOES_DO_CRM_ANTIGO = [
  "contacts",
  "companies",
  "contactCompanyLinks",
  "companyCompanyLinks",
  "distinctFromLinks",
  "funnels",
  "deals",
  "channels",
  "conversations",
] as const;

/** A coleção cujas linhas se dividem em Conversa de Grupo (fica) e Conversa comum (sai). */
export const COLECAO_DE_CONVERSAS = "conversations";

/** As oito coleções que saem INTEIRAS de `registros`: a nona (`conversations`) só sai sem Grupo. */
export const COLECOES_SEM_GRUPO: readonly string[] = COLECOES_DO_CRM_ANTIGO.filter((c) => c !== COLECAO_DE_CONVERSAS);

/**
 * Conversa de Grupo: o JSON traz `groupIdentifier` como objeto. Grupo e Flow ficam no modelo antigo
 * até as Sessões 6 e 7 (F14-D-05), então estas linhas são copiadas mas NÃO apagadas.
 *
 * O mesmo critério existe em SQL (`SQL_E_CONVERSA_DE_GRUPO`): os dois têm de concordar, porque o
 * script conta e apaga por SQL e o teste confere por esta função.
 */
export function ehConversaDeGrupo(dados: unknown): boolean {
  if (typeof dados !== "object" || dados === null) return false;
  const grupo = (dados as { readonly groupIdentifier?: unknown }).groupIdentifier;
  return typeof grupo === "object" && grupo !== null && !Array.isArray(grupo);
}

/** O critério de `ehConversaDeGrupo` em SQL, sobre a linha de alias `r`. Constante: nenhum valor entra aqui. */
export const SQL_E_CONVERSA_DE_GRUPO = "coalesce(jsonb_typeof(r.dados->'groupIdentifier'), 'null') = 'object'";

/** Um erro de uso do script (argumento, Espaço, recusa antes de escrever): a CLI sai com 2. */
export class ErroDeUso extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeUso";
  }
}

const FORMATO_DO_ESPACO = /^ws_[a-z0-9_]+$/;

/** `--espaco` só aceita o formato `ws_…`: o id entra em SQL só por `$n`, mas a recusa cedo evita digitação errada. */
export function validarEspaco(espaco: string): string {
  if (!FORMATO_DO_ESPACO.test(espaco)) {
    throw new ErroDeUso(`Espaço inválido: "${espaco}". O id tem a forma ws_… (letras minúsculas, números e _).`);
  }
  return espaco;
}
