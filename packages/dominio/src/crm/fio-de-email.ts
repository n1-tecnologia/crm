/**
 * O fio do e-mail (D-17-14, D-17-16): qual Mensagem um e-mail responde e quais
 * cabeçalhos a resposta leva. Regra pura, sem I/O: a busca da Mensagem pelo id
 * externo é injetada por quem chama (a api a restringe ao Canal e ao Espaço, e
 * é isso que impede um `In-Reply-To` forjado de cair numa Conversa alheia).
 *
 * Todo id (`Message-ID`, `In-Reply-To`, `References`) passa por `idLimpo`: a
 * mesma forma, sem `< >` e sem espaço, vira `id_externo` da Mensagem e `chave`
 * da fila, e é a que se compara na busca. O local-part é sensível a maiúsculas
 * pela RFC 5322, então nada além dos colchetes e dos espaços é normalizado.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/fio-de-email`.
 */

/** O que o e-mail recebido diz sobre o fio, já em listas de ids. */
export interface CabecalhosDoFio {
  readonly inReplyTo: readonly string[];
  readonly references: readonly string[];
  /**
   * O assunto NÃO é critério: "Re: Orçamento" sem cabeçalho de fio nunca junta e-mails na mesma Conversa (D-17-14). O campo
   * existe só para quem chama poder passar o e-mail inteiro e o teste provar que a busca ignora o assunto.
   */
  readonly assunto?: string | undefined;
}

/** A Mensagem que o e-mail responde e a Conversa dela. */
export interface MensagemDoFio {
  readonly mensagemId: string;
  readonly conversaId: string;
}

/** Só os 50 últimos ids de `References` entram na busca: um fio gigante não vira 500 consultas. */
export const MAX_REFERENCIAS_RECEBIDAS = 50;

/** RFC 5322 §3.6.4: a resposta leva no máximo 20 ids em `References` (o primeiro e os 19 últimos). */
export const MAX_REFERENCIAS_NA_SAIDA = 20;

/** O id sem `< >` e sem espaço, maiúsculas preservadas; vazio vira `undefined`. */
export function idLimpo(valor: string | null | undefined): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  const limpo = valor.replace(/[<>\s]/g, "");
  return limpo === "" ? undefined : limpo;
}

/**
 * Os ids de um cabeçalho (`References`, `In-Reply-To`), na ordem em que aparecem; um repetido fica na primeira posição. A
 * dobra de linha (`\r\n `) cai fora porque o id é lido entre `< >`; sem nenhum colchete (cliente descuidado), cada pedaço
 * separado por espaço é um id.
 */
export function idsDoCabecalho(valor: string | null | undefined): string[] {
  if (valor === undefined || valor === null) return [];
  const entreColchetes = valor.match(/<[^<>]*>/g);
  const brutos = entreColchetes ?? valor.split(/\s+/);
  return semRepetidos(brutos.map(idLimpo));
}

function semRepetidos(ids: readonly (string | undefined)[]): string[] {
  const vistos = new Set<string>();
  for (const id of ids) {
    if (id !== undefined) vistos.add(id);
  }
  return [...vistos];
}

/**
 * EML-04, D-17-14: a Mensagem que o e-mail responde. Tenta cada `In-Reply-To` na ordem dada e depois cada id de `References`
 * do último para o primeiro (o mais recente é o pai mais provável); o primeiro que a busca conhece vence, e cada id é
 * tentado uma vez. Sem cabeçalho de fio não há busca e o resultado é `undefined`: o assunto nunca decide.
 */
export async function mensagemRespondida(
  cabecalhos: CabecalhosDoFio,
  buscarPorIdExterno: (idExterno: string) => Promise<MensagemDoFio | null | undefined>,
): Promise<MensagemDoFio | undefined> {
  const recentesDeReferences = cabecalhos.references.slice(-MAX_REFERENCIAS_RECEBIDAS).reverse();
  const candidatos = semRepetidos([...cabecalhos.inReplyTo, ...recentesDeReferences].map(idLimpo));
  for (const candidato of candidatos) {
    const achada = await buscarPorIdExterno(candidato);
    if (achada) return achada;
  }
  return undefined;
}

/**
 * D-17-16, RFC 5322 §3.6.4: `In-Reply-To` e `References` da resposta. `idsDoFio` são os `id_externo` das Mensagens da Conversa,
 * do mais antigo ao mais novo; `respondida` é o id da Mensagem a que se responde (sem ele, o último do fio). Passando de 20
 * ids, leva o primeiro e os 19 últimos. Fio vazio e sem `respondida` não tem `In-Reply-To`.
 */
export function cabecalhosDaResposta(entrada: { idsDoFio: readonly string[]; respondida?: string | undefined }): {
  inReplyTo?: string;
  references: readonly string[];
} {
  const respondida = idLimpo(entrada.respondida);
  const ids = semRepetidos(entrada.idsDoFio.map(idLimpo));
  if (respondida !== undefined && !ids.includes(respondida)) ids.push(respondida);
  const references =
    ids.length > MAX_REFERENCIAS_NA_SAIDA ? [ids[0] as string, ...ids.slice(-(MAX_REFERENCIAS_NA_SAIDA - 1))] : ids;
  const inReplyTo = respondida ?? ids.at(-1);
  return inReplyTo === undefined ? { references } : { inReplyTo, references };
}

/** O assunto da resposta: `Re: ` na frente, sem empilhar (`RE:` e `re:` já valem); sem assunto, vazio. */
export function assuntoDaResposta(assunto: string | null | undefined): string {
  if (assunto === undefined || assunto === null || assunto.trim() === "") return "";
  return /^\s*re\s*:/i.test(assunto) ? assunto : `Re: ${assunto}`;
}

const DOMINIO_SEM_ENDERECO = "n1.invalid";

/**
 * O `Message-ID` nosso, sem os colchetes: `n1.<id da Mensagem>@<domínio do endereço do Canal>`. O id da Mensagem não é
 * sequencial, então quem escreve de fora não adivinha um id nosso para forjar `In-Reply-To` (A14). Caractere do id fora de
 * `[A-Za-z0-9._-]` vira `-`; endereço sem domínio usável cai em `n1.invalid`.
 */
export function messageIdDaMensagem(mensagemId: string, enderecoDoCanal: string): string {
  const local = mensagemId.replace(/[^A-Za-z0-9._-]/g, "-");
  const dominio = enderecoDoCanal.slice(enderecoDoCanal.lastIndexOf("@") + 1).trim().toLowerCase();
  const usavel = enderecoDoCanal.includes("@") && /^[a-z0-9.-]+$/.test(dominio) ? dominio : DOMINIO_SEM_ENDERECO;
  return `n1.${local}@${usavel}`;
}
