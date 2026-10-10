/**
 * A Empresa do CRM novo: a organização, e o vínculo dela com os Contatos.
 * Tipos camelCase de `plataforma.empresas`, `empresa_identificadores` e
 * `contato_empresa` (007), mais as regras que valem dos dois lados da
 * fronteira — a tela e o endpoint aplicam as mesmas funções.
 *
 * Convive com `types/crm.ts` (modelo inglês) até a fase de unificação (D-01).
 * Nenhum tipo aqui carrega `workspaceId`: o Espaço de Trabalho vem da sessão,
 * nunca do corpo (D-10).
 */

import { fail, ok, type OperationResult } from "../state";
import type { CivilDate } from "../types/primitives";
import type { BloqueiosCrm, CamposAdicionais, Endereco, EstadoCrm } from "./comum";
import type { NovoContato } from "./contatos";
import { normalizarIdentificadorDeEmpresa } from "./normalizacao";

/** Os tipos de Identificador de Empresa (007:177). Nunca resolvem Mensagens. */
export const TIPOS_IDENTIFICADOR_EMPRESA = ["dominio", "documento_fiscal", "telefone"] as const;
export type TipoIdentificadorEmpresa = (typeof TIPOS_IDENTIFICADOR_EMPRESA)[number];

export interface Empresa {
  readonly id: string;
  readonly nomeFantasia: string | null;
  readonly razaoSocial: string | null;
  readonly descricao: string | null;
  readonly matrizId: string | null;
  readonly enderecos: readonly Endereco[];
  readonly camposAdicionais: CamposAdicionais;
  readonly origem: string | null;
  readonly estado: EstadoCrm;
  readonly proprietarioId: string;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface IdentificadorDeEmpresa {
  readonly id: string;
  readonly empresaId: string;
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais: string | null;
  readonly verificado: boolean;
  readonly principal: boolean;
  readonly criadoEm: string;
}

/** Um vínculo Contato-Empresa, vigente (`fim` nulo) ou encerrado (`contato_empresa`). */
export interface VinculoDaEmpresa {
  readonly id: string;
  readonly contatoId: string;
  readonly contatoNome: string;
  readonly contatoEstado: EstadoCrm;
  readonly cargo: string | null;
  readonly admin: boolean;
  readonly inicio: CivilDate | null;
  readonly fim: CivilDate | null;
}

/** O que a lista mostra por linha. O nome de exibição é derivado, nunca gravado. */
export interface EmpresaResumo {
  readonly id: string;
  readonly nomeDeExibicao: string;
  readonly dominioPrincipal: string | null;
  readonly documentoPrincipal: string | null;
  readonly matriz: { readonly id: string; readonly nome: string } | null;
  readonly proprietarioId: string;
  readonly estado: EstadoCrm;
  readonly atualizadoEm: string;
}

export interface EmpresaDetalhada {
  readonly empresa: Empresa;
  readonly identificadores: readonly IdentificadorDeEmpresa[];
  readonly vinculos: readonly VinculoDaEmpresa[];
  readonly matriz: { readonly id: string; readonly nome: string; readonly estado: EstadoCrm } | null;
  readonly filiais: readonly { readonly id: string; readonly nome: string; readonly estado: EstadoCrm }[];
}

export interface NovoIdentificadorDeEmpresa {
  readonly tipo: TipoIdentificadorEmpresa;
  readonly valor: string;
  readonly pais?: string;
}

export interface NovaEmpresa {
  readonly nomeFantasia?: string;
  readonly razaoSocial?: string;
  readonly descricao?: string;
  readonly matrizId?: string;
  readonly enderecos?: readonly Endereco[];
  readonly camposAdicionais?: CamposAdicionais;
  readonly origem?: string;
  readonly proprietarioId?: string;
  readonly identificadores?: readonly NovoIdentificadorDeEmpresa[];
}

export type EdicaoDeEmpresa = Partial<Omit<NovaEmpresa, "identificadores">>;

/** O admin que a Empresa nasce tendo (D-08): um Contato que já existe, ou um novo criado junto. */
export type AdminDaNovaEmpresa =
  | { readonly contatoId: string; readonly cargo?: string }
  | { readonly novoContato: NovoContato; readonly cargo?: string };

export interface NovoVinculo {
  readonly contatoId: string;
  readonly cargo?: string;
  readonly admin?: boolean;
  readonly inicio?: CivilDate;
}

export interface EdicaoDeVinculo {
  readonly cargo?: string;
  readonly admin?: boolean;
}

export interface TrocaDeAdmin {
  readonly vinculoAtualId: string;
  readonly novoAdmin: { readonly contatoId: string; readonly cargo?: string };
}

/** D-08: restaurar da lixeira pede quem volta a administrar a Empresa. */
export const FRASE_EMPRESA_SEM_ADMIN =
  "Uma Empresa precisa de ao menos um Contato admin. Indique quem volta a administrá-la.";

const textoOuVazio = (texto: string | null | undefined): string => (texto ?? "").trim();

/** Nome fantasia; sem ele, razão social; sem nenhum, "Empresa sem nome". Derivado a cada leitura. */
export function nomeDeExibicaoDaEmpresa(empresa: {
  readonly nomeFantasia?: string | null;
  readonly razaoSocial?: string | null;
}): string {
  const fantasia = textoOuVazio(empresa.nomeFantasia);
  if (fantasia !== "") return fantasia;
  const razao = textoOuVazio(empresa.razaoSocial);
  return razao !== "" ? razao : "Empresa sem nome";
}

/** INV-EMP-01 (`ontologia/03-crm/empresas.md`): uma Empresa precisa de nome fantasia ou de razão social. */
export function validarEmpresa(entrada: {
  readonly nomeFantasia?: string | null;
  readonly razaoSocial?: string | null;
}): OperationResult<void> {
  if (textoOuVazio(entrada.nomeFantasia) === "" && textoOuVazio(entrada.razaoSocial) === "") {
    return fail("Informe o nome fantasia ou a razão social da Empresa.", "nomeFantasia");
  }
  return ok(undefined);
}

/**
 * O Identificador de Empresa pronto para gravar: valor na forma canônica (a
 * chave de unicidade) e país em maiúsculas. Domínio de provedor público
 * (`gmail.com`) é recusado (RN-EMP-05); documento fiscal exige o país.
 */
export function validarIdentificadorDeEmpresa(
  entrada: NovoIdentificadorDeEmpresa,
): OperationResult<NovoIdentificadorDeEmpresa> {
  const canonico = normalizarIdentificadorDeEmpresa(entrada.tipo, entrada.valor, entrada.pais);
  if (!canonico.ok) return fail(canonico.error, canonico.field);
  const pais = textoOuVazio(entrada.pais).toUpperCase();
  return ok({
    tipo: entrada.tipo,
    valor: canonico.value,
    ...(pais !== "" ? { pais } : {}),
  });
}

/**
 * A matriz de uma Empresa: não pode ser ela mesma, nem uma descendente dela
 * (INV-EMP-05: a hierarquia não tem ciclo — `ancestraisDaMatriz` são os ids
 * acima da matriz candidata), e precisa estar `ativo` (RN-EMP-11).
 */
export function validarMatriz(entrada: {
  readonly empresaId?: string;
  readonly matriz: { readonly id: string; readonly estado: EstadoCrm };
  readonly ancestraisDaMatriz: readonly string[];
}): OperationResult<void> {
  const { empresaId, matriz, ancestraisDaMatriz } = entrada;
  if (empresaId !== undefined && matriz.id === empresaId) {
    return fail("Uma Empresa não pode ser a própria matriz.", "matrizId");
  }
  if (empresaId !== undefined && ancestraisDaMatriz.includes(empresaId)) {
    return fail("Esta matriz já é filial desta Empresa; a hierarquia não pode fazer um ciclo (INV-EMP-05).", "matrizId");
  }
  if (matriz.estado !== "ativo") {
    return fail("A matriz precisa estar ativa (RN-EMP-11). Restaure a Empresa ou escolha outra.", "matrizId");
  }
  return ok(undefined);
}

/** Os admins que valem: vínculo sem `fim`, marcado admin, de um Contato fora da lixeira. */
export function adminsVigentes(vinculos: readonly VinculoDaEmpresa[]): readonly VinculoDaEmpresa[] {
  return vinculos.filter((vinculo) => vinculo.admin && vinculo.fim === null && vinculo.contatoEstado !== "na_lixeira");
}

/**
 * D-08: rebaixar ou encerrar o último admin vigente é recusado — a Empresa nunca
 * fica sem Contato admin; a saída é "Trocar admin". Retirar um vínculo que não
 * é de admin vigente, ou um admin de quem sobra outro, passa.
 */
export function validarRetiradaDeAdmin(vinculos: readonly VinculoDaEmpresa[], vinculoId: string): OperationResult<void> {
  const admins = adminsVigentes(vinculos);
  if (!admins.some((admin) => admin.id === vinculoId)) return ok(undefined);
  if (admins.length > 1) return ok(undefined);
  return fail("Indique o novo admin antes de retirar o último.", "admin");
}

function listaEmFrase(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * RN-EMP-09: por que a Empresa não vai para a lixeira, e o que fazer. A tela
 * mostra esta frase literal e, abaixo, os links de `bloqueios`.
 */
export function fraseDeEmpresaBloqueada(bloqueios: BloqueiosCrm): string {
  const motivos: string[] = [];
  const acoes: string[] = [];
  const total = bloqueios.negocios?.total ?? 0;
  if (total > 0) {
    motivos.push(total === 1 ? "tem 1 Negócio aberto" : `tem ${total} Negócios abertos`);
    acoes.push(total === 1 ? "encerre ou mova o Negócio" : "encerre ou mova os Negócios");
  }
  const filiais = bloqueios.filiais ?? [];
  if (filiais.length > 0) {
    const nomes = listaEmFrase(filiais.map((filial) => filial.nome));
    motivos.push(filiais.length === 1 ? `tem a filial ${nomes}` : `tem as filiais ${nomes}`);
    acoes.push(filiais.length === 1 ? "troque a matriz da filial ou envie-a à lixeira" : "troque a matriz das filiais ou envie-as à lixeira");
  }
  return `Esta Empresa não pode ir para a lixeira: ${motivos.join(" e ")}. Antes, ${acoes.join(" e ")}.`;
}
