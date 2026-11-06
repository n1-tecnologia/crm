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

/** A coleção cujas linhas se dividem em Conversa que fica (Grupo, Flow, Automação) e Conversa do CRM antigo (sai). */
export const COLECAO_DE_CONVERSAS = "conversations";

/** As oito coleções que saem INTEIRAS de `registros`: a nona (`conversations`) só sai quando é do CRM antigo. */
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

/**
 * A Conversa do CRM ANTIGO (a que o corte copia, migra e apaga de `registros`) — 15-44, H-02.
 *
 * Não basta "não é de Grupo": o modelo que continua vivo em `registros` (F14-D-05) também abre Conversa 1:1,
 * sem `groupIdentifier`, para o envio de Flow, a composição da Automação e o convite de Grupo
 * (`receiveMessage` e `startConversation`, em `conversa-de-grupo.ts`). O Contato dessas Conversas é um Contato de
 * `plataforma.contatos`, não da coleção `contacts` antiga. Por isso a Conversa só é do CRM antigo quando:
 *
 *   - NÃO é de Grupo; e
 *   - o `contactId` dela é um id da coleção `contacts` antiga do MESMO Espaço.
 *
 * O resto FICA em `registros`: Grupo, 1:1 de Flow/Automação/convite e qualquer Conversa que não dá para
 * classificar (`contactId` ausente, nulo, vazio ou que não é texto). Nunca se apaga o que não se sabe classificar.
 * Limitação conhecida: um Contato cujo id existe nas duas coleções antes do corte é tratado como antigo.
 *
 * O mesmo critério existe em SQL (`SQL_E_CONVERSA_DO_CRM_ANTIGO`) e é o ÚNICO usado por `--guardar`, `--migrar`,
 * `--seco` e `--verificar`; `colecoes.test.ts` confere que os dois concordam.
 */
export function ehConversaDoCrmAntigo(dados: unknown, idsDeContatosAntigos: ReadonlySet<string>): boolean {
  if (typeof dados !== "object" || dados === null || ehConversaDeGrupo(dados)) return false;
  const contato = (dados as { readonly contactId?: unknown }).contactId;
  return typeof contato === "string" && idsDeContatosAntigos.has(contato);
}

/**
 * O critério de `ehConversaDoCrmAntigo` em SQL, sobre a linha de alias `r` de `plataforma.registros`. O `exists`
 * olha só a coleção `contacts` do mesmo `workspace_id` (alias `ct`). Constante: nenhum valor entra aqui.
 *
 * Dentro de um `delete` da própria `registros`, a subconsulta enxerga os Contatos como estavam no início do
 * comando (snapshot), então as oito coleções e as Conversas saem numa instrução só sem mudar a conta.
 */
export const SQL_E_CONVERSA_DO_CRM_ANTIGO = `(not (${SQL_E_CONVERSA_DE_GRUPO})
  and jsonb_typeof(r.dados->'contactId') = 'string'
  and exists (select 1 from plataforma.registros ct
               where ct.workspace_id = r.workspace_id and ct.colecao = 'contacts' and ct.id = r.dados->>'contactId'))`;

/** A Conversa 1:1 que fica em `registros` (Flow, Automação, convite de Grupo ou sem classificação): nem Grupo nem do CRM antigo. */
export const SQL_E_CONVERSA_1A1_QUE_FICA = `(not (${SQL_E_CONVERSA_DE_GRUPO}) and not (${SQL_E_CONVERSA_DO_CRM_ANTIGO}))`;

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
