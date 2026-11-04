/**
 * O Contato do CRM novo: a pessoa. Tipos camelCase dos campos de
 * `plataforma.contatos` e `plataforma.contato_identificadores` (007), mais a
 * regra que vale dos dois lados da fronteira — a tela e o endpoint aplicam a
 * mesma `validarContato`, e não duas que divergem (CONTEXT.md raiz).
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10).
 */

import { fail, ok, type OperationResult } from "../state";
import { normalizarIdentificadorDeContato } from "./normalizacao";
import type { CivilDate } from "../types/primitives";
import { ESTADOS_CRM, type BloqueiosCrm, type CamposAdicionais, type Endereco, type EstadoCrm, type ModoDeCriacao } from "./comum";

/** Os tipos de Identificador de Contato (007:110). `telefone` é discável; `whatsapp` é a identidade que um Canal resolve. */
export const TIPOS_IDENTIFICADOR_CONTATO = ["telefone", "email", "whatsapp", "instagram"] as const;
export type TipoIdentificadorContato = (typeof TIPOS_IDENTIFICADOR_CONTATO)[number];

/**
 * O ciclo de vida do Contato: o de todo registro do CRM mais `mesclado` (011).
 * `mesclado` é terminal e somente leitura (RN-CON-14): o Contato absorvido fica
 * apontando o sobrevivente por `mescladoEmId`, e o sobrevivente nunca é `mesclado`
 * (sem cadeia). Só o Contato tem este estado, por isso `ESTADOS_CRM` não muda: ele
 * alimenta o filtro de lista de todos os recursos, e uma lista nunca traz `mesclado`.
 */
export const ESTADOS_DO_CONTATO = [...ESTADOS_CRM, "mesclado"] as const;
export type EstadoDoContato = EstadoCrm | "mesclado";

export interface Contato {
  readonly id: string;
  readonly nome: string | null;
  readonly sobrenome: string | null;
  readonly dataNascimento: CivilDate | null;
  readonly idioma: string | null;
  readonly fusoHorario: string | null;
  readonly fotoUrl: string | null;
  readonly descricao: string | null;
  readonly enderecos: readonly Endereco[];
  readonly camposAdicionais: CamposAdicionais;
  readonly origem: string | null;
  readonly qualificacao: string | null;
  readonly modoCriacao: ModoDeCriacao;
  readonly estado: EstadoDoContato;
  /** O sobrevivente, quando `estado` é `mesclado` (RN-CON-14); `null` em qualquer outro estado. */
  readonly mescladoEmId: string | null;
  /** Quando a mesclagem aconteceu (ISO 8601); anda junto com `mescladoEmId`. */
  readonly mescladoEm: string | null;
  readonly proprietarioId: string;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface IdentificadorDeContato {
  readonly id: string;
  readonly contatoId: string;
  readonly tipo: TipoIdentificadorContato;
  readonly valor: string;
  readonly valorExibido: string | null;
  readonly rotuloCanal: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criadoEm: string;
}

/** O vínculo vigente ou passado do Contato com uma Empresa (`contato_empresa`). */
export interface VinculoDoContato {
  readonly id: string;
  readonly empresaId: string;
  readonly empresaNome: string;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: CivilDate | null;
  readonly fim: CivilDate | null;
}

/** O que a lista mostra por linha. O nome de exibição é derivado, nunca gravado. */
export interface ContatoResumo {
  readonly id: string;
  readonly nomeDeExibicao: string;
  readonly estado: EstadoCrm;
  readonly proprietarioId: string;
  readonly emailPrincipal: string | null;
  readonly telefonePrincipal: string | null;
  readonly atualizadoEm: string;
}

export interface ContatoDetalhado {
  readonly contato: Contato;
  readonly identificadores: readonly IdentificadorDeContato[];
  readonly vinculos: readonly VinculoDoContato[];
}

export interface NovoIdentificadorDeContato {
  readonly tipo: TipoIdentificadorContato;
  readonly valor: string;
  readonly valorExibido?: string;
  readonly rotuloCanal?: string;
}

export interface NovoContato {
  readonly nome?: string;
  readonly sobrenome?: string;
  readonly dataNascimento?: CivilDate;
  readonly idioma?: string;
  readonly fusoHorario?: string;
  readonly fotoUrl?: string;
  readonly descricao?: string;
  readonly enderecos?: readonly Endereco[];
  readonly camposAdicionais?: CamposAdicionais;
  readonly origem?: string;
  readonly qualificacao?: string;
  readonly modoCriacao?: ModoDeCriacao;
  readonly proprietarioId?: string;
  readonly identificadores?: readonly NovoIdentificadorDeContato[];
}

export type EdicaoDeContato = Partial<Omit<NovoContato, "identificadores">>;

/** O que se muda num Identificador existente: o valor canônico nunca muda (seria outro Identificador). */
export interface EdicaoDeIdentificador {
  readonly principal?: boolean;
  readonly verificado?: boolean;
  readonly valorExibido?: string;
  readonly rotuloCanal?: string;
}

/**
 * "Nome Sobrenome" aparado; sem nome, o identificador principal; sem nada,
 * "Contato sem nome". É derivado a cada leitura — nunca gravado.
 */
export function nomeDeExibicaoDoContato(
  contato: { readonly nome?: string | null; readonly sobrenome?: string | null },
  identificadorPrincipal?: string | null,
): string {
  const completo = [contato.nome, contato.sobrenome]
    .map((parte) => (parte ?? "").trim())
    .filter((parte) => parte !== "")
    .join(" ");
  if (completo !== "") return completo;
  const identificador = (identificadorPrincipal ?? "").trim();
  return identificador !== "" ? identificador : "Contato sem nome";
}

/**
 * INV-CON-01 (`ontologia/03-crm/contatos.md:364`): um Contato precisa de Nome
 * ou de ao menos um Identificador. Sem nenhum dos dois ele não é ninguém.
 */
export function validarContato(entrada: {
  readonly nome?: string | null;
  readonly identificadores?: readonly unknown[];
}): OperationResult<void> {
  const temNome = (entrada.nome ?? "").trim() !== "";
  const temIdentificador = (entrada.identificadores?.length ?? 0) > 0;
  if (!temNome && !temIdentificador) {
    return fail(
      "Um Contato precisa de Nome ou de ao menos um Identificador (e-mail, telefone, WhatsApp ou Instagram).",
      "nome",
    );
  }
  return ok(undefined);
}

/** Como o tipo aparece em frases e na tela. */
export const ROTULO_DO_TIPO_DE_IDENTIFICADOR: Record<TipoIdentificadorContato, string> = {
  telefone: "Telefone",
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/**
 * O Identificador pronto para gravar: `valor` na forma canônica (a chave de
 * unicidade, INV-CON-02) e `valorExibido` com o que a pessoa digitou, quando
 * difere. A mesma função serve ao endpoint e à tela.
 */
export function validarIdentificadorDeContato(
  entrada: NovoIdentificadorDeContato,
): OperationResult<NovoIdentificadorDeContato> {
  const canonico = normalizarIdentificadorDeContato(entrada.tipo, entrada.valor);
  if (!canonico.ok) return fail(canonico.error, canonico.field);
  const informado = entrada.valor.trim();
  const exibido = (entrada.valorExibido ?? "").trim() !== "" ? entrada.valorExibido!.trim() : informado;
  return ok({
    tipo: entrada.tipo,
    valor: canonico.value,
    ...(exibido !== canonico.value ? { valorExibido: exibido } : {}),
    ...(entrada.rotuloCanal !== undefined ? { rotuloCanal: entrada.rotuloCanal } : {}),
  });
}

/** O primeiro Identificador de cada tipo nasce principal (INV-CON-03). */
export function primeiroDoTipo(
  existentes: readonly { readonly tipo: TipoIdentificadorContato }[],
  tipo: TipoIdentificadorContato,
): boolean {
  return !existentes.some((existente) => existente.tipo === tipo);
}

function listaEmFrase(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * D-09: por que o Contato não vai para a lixeira, e o que fazer. A tela mostra
 * esta frase literal e, abaixo, os links de `bloqueios`.
 */
export function fraseDeContatoBloqueado(bloqueios: BloqueiosCrm): string {
  const motivos: string[] = [];
  const acoes: string[] = [];
  const empresas = bloqueios.empresas ?? [];
  if (empresas.length > 0) {
    const nomes = listaEmFrase(empresas.map((empresa) => empresa.nome));
    motivos.push(
      empresas.length === 1 ? `é o único admin da Empresa ${nomes}` : `é o único admin das Empresas ${nomes}`,
    );
    acoes.push("nomeie outro admin");
  }
  const total = bloqueios.negocios?.total ?? 0;
  if (total > 0) {
    motivos.push(total === 1 ? "é o Contato de 1 Negócio" : `é o Contato de ${total} Negócios`);
    acoes.push(total === 1 ? "troque o Contato do Negócio" : "troque o Contato dos Negócios");
  }
  return `Este Contato não pode ir para a lixeira: ${motivos.join(" e ")}. Antes, ${acoes.join(" e ")}.`;
}

/** RN-CON-11: o Identificador já é de outro Contato do Espaço. */
export function fraseDeIdentificadorEmUso(tipo: TipoIdentificadorContato, valor: string, nomeDoDetentor: string): string {
  return `${ROTULO_DO_TIPO_DE_IDENTIFICADOR[tipo]} ${valor} já pertence ao Contato ${nomeDoDetentor}. Abra esse Contato ou use outro valor.`;
}

/**
 * DO-CON-12: transferir um Identificador de um Contato para outro. Só a resolução futura
 * muda de dono: as Conversas e as Mensagens passadas ficam com a origem. A regra recusa:
 *   - a origem `mesclado` (RN-CON-14: somente leitura);
 *   - o mesmo Contato como destino;
 *   - o destino `mesclado` (a frase manda para o Contato que ficou) ou na lixeira;
 *   - a origem que ficaria sem Nome e sem Identificador (INV-CON-01, `validarContato`).
 * O destino `arquivado` recebe, como já recebe Negócio. `field` é `paraContatoId` nas recusas
 * do destino, para a tela marcar o campo; a de INV-CON-01 traz o `field` de `validarContato`.
 */
export function validarTransferenciaDeIdentificador(entrada: {
  readonly origem: Pick<Contato, "id" | "estado" | "nome" | "sobrenome">;
  readonly destino: Pick<Contato, "id" | "estado">;
  readonly restantesDaOrigem: readonly Pick<IdentificadorDeContato, "tipo" | "valor">[];
}): OperationResult<void> {
  const { origem, destino, restantesDaOrigem } = entrada;
  if (origem.estado === "mesclado") {
    return fail("Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.");
  }
  if (destino.id === origem.id) return fail("Escolha outro Contato: o Identificador já é deste.", "paraContatoId");
  if (destino.estado === "mesclado") {
    return fail("Este Contato foi mesclado: transfira para o Contato que ficou.", "paraContatoId");
  }
  if (destino.estado === "na_lixeira") {
    return fail("O Contato de destino está na lixeira. Restaure-o ou escolha outro.", "paraContatoId");
  }
  return validarContato({ nome: origem.nome, identificadores: restantesDaOrigem });
}
