"use client";

/**
 * Negócios do CRM, lidos e gravados só por HTTP (D-04): cada função aqui é uma
 * rota de `apps/api` (`rotas/crm/negocios.ts`) atrás de `chamarCrm`. Nenhum
 * arquivo do web importa o workspace da api — o contrato é o JSON e os tipos
 * de `@n1/dominio/crm/negocios`.
 *
 * As chaves de SWR começam por `/negocios`. Depois de cada gravação com
 * sucesso invalidam-se quatro prefixos: `/negocios` (a lista do quadro e a
 * ficha), `/funis` (a ficha do Funil traz as contagens de Negócios por Etapa),
 * `/contatos` e `/empresas` (as fichas trazem os Negócios do registro). Numa
 * recusa a `ErroDeApi` sobe com `codigo` e `campo` (`NEGOCIO_EXIGE_VALOR`,
 * `NEGOCIO_EXIGE_MOTIVO`…) e nada é invalidado: o servidor é a fonte da
 * verdade e a tela segue como estava.
 */

import useSWR from "swr";
import { LIMITES_CRM, type EstadoCrm, type SituacaoNegocio } from "@n1/dominio/crm/comum";
import {
  VALOR_DECIMAL,
  type EdicaoDeNegocio,
  type Ganho,
  type Movimento,
  type NegocioDetalhado,
  type NegocioResumo,
  type NovoNegocio,
  type Perda,
  type Reabertura,
} from "@n1/dominio/crm/negocios";
import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";

export interface FiltroDeNegocios {
  readonly funilId?: string;
  readonly situacao?: SituacaoNegocio;
  readonly estado?: EstadoCrm;
  readonly empresaId?: string;
  readonly contatoId?: string;
  readonly q?: string;
  readonly limite?: number;
  readonly deslocamento?: number;
}

export interface RespostaDaListaDeNegocios {
  readonly ok: true;
  readonly itens: NegocioResumo[];
  readonly total: number;
}

/** `/negocios?estado=…&funilId=…&limite=…` — a mesma forma para a lista, o quadro e a invalidação. */
export function chaveDeNegocios(filtro: FiltroDeNegocios): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  if (filtro.funilId !== undefined) parametros.set("funilId", filtro.funilId);
  if (filtro.situacao !== undefined) parametros.set("situacao", filtro.situacao);
  if (filtro.empresaId !== undefined) parametros.set("empresaId", filtro.empresaId);
  if (filtro.contatoId !== undefined) parametros.set("contatoId", filtro.contatoId);
  const busca = (filtro.q ?? "").trim();
  if (busca !== "") parametros.set("q", busca);
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/negocios?${parametros.toString()}`;
}

/** `pausado` não lê nada (um painel fechado ou um Funil ainda não escolhido não vai à api). */
export function useNegocios(filtro: FiltroDeNegocios, opcoes: { readonly pausado?: boolean } = {}) {
  const chave = chaveDeNegocios(filtro);
  // `keepPreviousData`: trocar de Funil ou "Mostrar mais" muda a chave sem piscar o esqueleto.
  // Quem usa confere se os dados são do filtro pedido.
  return useSWR<RespostaDaListaDeNegocios, Error>(opcoes.pausado ? null : chave, (k: string) => chamarCrm<RespostaDaListaDeNegocios>(k), {
    keepPreviousData: true,
  });
}

export function chaveDoNegocio(id: string): string {
  return `/negocios/${id}`;
}

/** Recusa 4xx não melhora ao repetir (um 404 de Negócio do modelo antigo, por exemplo): só rede e 5xx tentam de novo. */
function valeRepetir(erro: Error): boolean {
  return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500;
}

/** A ficha. O 404 da api fica em `error` (`ErroDeApi`): a página decide o recuo para a ficha antiga (D-15). */
export function useNegocio(id: string | undefined) {
  return useSWR<NegocioDetalhado, Error>(
    id === undefined ? null : chaveDoNegocio(id),
    async (chave: string) => (await chamarCrm<{ ok: true; dados: NegocioDetalhado }>(chave)).dados,
    { shouldRetryOnError: valeRepetir },
  );
}

type Verbo = "POST" | "PATCH" | "DELETE";

async function gravar<T>(caminho: string, verbo: Verbo, corpo?: unknown): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, {
    method: verbo,
    ...(corpo !== undefined ? { corpo } : {}),
  });
  await invalidarCrm("/negocios");
  // As contagens de Negócios por Etapa moram na ficha do Funil; os Negócios do registro, nas fichas de Contato e Empresa.
  await invalidarCrm("/funis");
  await invalidarCrm("/contatos");
  await invalidarCrm("/empresas");
  return resposta.dados;
}

export function criarNegocio(entrada: NovoNegocio): Promise<NegocioDetalhado> {
  return gravar("/negocios", "POST", entrada);
}

export function editarNegocio(id: string, edicao: EdicaoDeNegocio): Promise<NegocioDetalhado> {
  return gravar(chaveDoNegocio(id), "PATCH", edicao);
}

/** D-05: soltar um cartão noutra coluna. Recusa (`NEGOCIO_ENCERRADO`, `FUNIL_INATIVO`…) devolve o cartão. */
export function moverNegocio(id: string, movimento: Movimento): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/mover`, "POST", movimento);
}

/** O servidor aplica a Regra "exigir valor" do Funil (409 `NEGOCIO_EXIGE_VALOR`); a tela já pré-valida. */
export function ganharNegocio(id: string, ganho?: Ganho): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/ganhar`, "POST", ganho);
}

/** O servidor aplica a Regra "exigir Motivo de Perda" do Funil (409 `NEGOCIO_EXIGE_MOTIVO`). */
export function perderNegocio(id: string, perda?: Perda): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/perder`, "POST", perda);
}

/** Sem destino vai sem corpo e sem `content-type` (a Etapa atual); D-14: reabrir `ganho` é de quem administra. */
export function reabrirNegocio(id: string, destino?: Reabertura): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/reabrir`, "POST", destino);
}

export function arquivarNegocio(id: string): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/arquivar`, "POST");
}

export function restaurarNegocio(id: string): Promise<NegocioDetalhado> {
  return gravar(`${chaveDoNegocio(id)}/restaurar`, "POST");
}

/** D-06: "Excluir" na interface manda para a Lixeira. */
export function enviarNegocioParaLixeira(id: string): Promise<NegocioDetalhado> {
  return gravar(chaveDoNegocio(id), "DELETE");
}

/** Só parte da Lixeira; o corpo da resposta é `{ id }`, não o Negócio. */
export function excluirNegocioPermanentemente(id: string): Promise<{ readonly id: string }> {
  return gravar(`${chaveDoNegocio(id)}/permanente`, "DELETE");
}

const COM_VIRGULA = /^(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/;
const MILHARES = /^\d{1,3}(\.\d{3})+$/;
const COM_PONTO = /^\d+(\.\d{1,2})?$/;

/**
 * O que a pessoa digitou → o texto decimal que a api guarda (`numeric(15,2)`,
 * nunca `number`). Aceita "1.234,56", "1234,5", "1234.50" e "R$ 2.500"; com
 * vírgula, os pontos são separadores de milhar; sem vírgula, três dígitos
 * depois do ponto também são milhar ("2.500" = 2500). Devolve `undefined`
 * quando não cabe em `VALOR_DECIMAL` (vazio, sinal, letras, 3 casas, 14 dígitos).
 */
export function valorDigitadoParaDecimal(texto: string): string | undefined {
  const limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  let decimal: string;
  if (COM_VIRGULA.test(limpo)) decimal = limpo.replace(/\./g, "").replace(",", ".");
  else if (MILHARES.test(limpo)) decimal = limpo.replace(/\./g, "");
  else if (COM_PONTO.test(limpo)) decimal = limpo;
  else return undefined;
  return VALOR_DECIMAL.test(decimal) ? decimal : undefined;
}
