"use client";

/**
 * O CRM novo como as telas de Ferramentas (Grupos, Comunidades e Flows) o enxergam
 * (Fase 15, 3.4.8, UCR-08). Canal e Contato deixaram o store: as operações de Ferramentas
 * conferem os dois em `crm: CrmDasFerramentas`, o ÚLTIMO argumento (15-07), que o servidor
 * monta de `plataforma.canais` e `plataforma.contatos` e para o qual descarta o que o
 * navegador mandar. O navegador manda o que TEM, só para a aplicação otimista local não
 * recusar com "Canal não encontrado" (T-15-55: a tela não decide, o servidor relê).
 *
 * Os Canais vêm de `GET /canais` (ativos e arquivados: a recusa precisa dizer "arquivado",
 * não "não encontrado"); os Contatos, de quem chama (o seletor com `comIdentificador`).
 */

import { useMemo } from "react";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ContatoACriar, ContatoResumo } from "@n1/dominio/crm/contatos";
import type { ContatoDaFerramenta, CrmDasFerramentas } from "@n1/dominio/types";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { useCanais } from "@/dados/crm/canais";

const PAGINA_MAXIMA = LIMITES_CRM.paginaMaxima;
const SEM_CANAIS: readonly Canal[] = [];

export interface CanaisDasFerramentas {
  /** Os Canais de WhatsApp ativos — o que um Grupo, Comunidade ou Flow pode ter como administrador. */
  readonly canaisDeWhatsApp: readonly Canal[];
  /** Os Canais ativos e os arquivados, para conferir e nomear qualquer Canal que um ativo cite. */
  readonly todos: readonly Canal[];
  /** O nome do Canal (ativo ou arquivado); `undefined` se a api não o devolveu. */
  readonly nomeDoCanal: (id: string | undefined) => string | undefined;
  /** O Canal (ativo ou arquivado). */
  readonly canalPorId: (id: string | undefined) => Canal | undefined;
  /** A lista de ativos chegou. Antes disso as recusas de Canal ficam em silêncio (sem piscar "Canal não encontrado"). */
  readonly pronto: boolean;
}

/** Os Canais do CRM novo para as telas de Ferramentas. Um `GET /canais` para ativos e outro para arquivados. */
export function useCanaisDasFerramentas(): CanaisDasFerramentas {
  const ativos = useCanais({ estado: "ativo", limite: PAGINA_MAXIMA });
  const arquivados = useCanais({ estado: "arquivado", limite: PAGINA_MAXIMA });
  const listaAtiva = ativos.data?.itens ?? SEM_CANAIS;
  const listaArquivada = arquivados.data?.itens ?? SEM_CANAIS;

  return useMemo(() => {
    const todos = [...listaAtiva, ...listaArquivada];
    const porId = new Map(todos.map((c) => [c.id, c]));
    return {
      canaisDeWhatsApp: listaAtiva.filter((c) => c.tipo === "whatsapp"),
      todos,
      nomeDoCanal: (id) => (id === undefined ? undefined : porId.get(id)?.nome),
      canalPorId: (id) => (id === undefined ? undefined : porId.get(id)),
      pronto: ativos.data !== undefined,
    };
  }, [listaAtiva, listaArquivada, ativos.data]);
}

/** O Contato do seletor como a operação o confere: ativo e com o WhatsApp que a lista filtrou. */
export function contatoDaFerramenta(resumo: ContatoResumo): ContatoDaFerramenta {
  return {
    id: resumo.id,
    nome: resumo.nomeDeExibicao,
    estado: resumo.estado,
    // A lista não traz o número do WhatsApp (só o telefone principal). O seletor já filtrou por
    // Identificador `whatsapp`, então o número existe; o que vale aqui é só para a execução local não
    // recusar. O servidor relê o Contato e grava o número verdadeiro (T-15-55).
    whatsapp: resumo.telefonePrincipal ?? resumo.id,
  };
}

/** O `crm` que as operações de Ferramentas recebem como último argumento. */
export function montarCrmDasFerramentas(
  canais: CanaisDasFerramentas,
  contatos: readonly ContatoDaFerramenta[] = [],
  contatosACriar?: readonly ContatoACriar[],
): CrmDasFerramentas {
  return {
    canais: canais.todos.slice(0, PAGINA_MAXIMA),
    contatos: contatos.slice(0, PAGINA_MAXIMA),
    ...(contatosACriar && contatosACriar.length > 0 ? { contatosACriar } : {}),
  };
}

/** O `crm` da tela, memorizado pelos Canais e Contatos (muda só quando eles mudam). */
export function useCrmDasFerramentas(canais: CanaisDasFerramentas, contatos?: readonly ContatoDaFerramenta[]): CrmDasFerramentas {
  return useMemo(() => montarCrmDasFerramentas(canais, contatos), [canais, contatos]);
}

/**
 * Uma recusa de Canal só vale depois que os Canais chegaram: antes, a lista vazia faria toda
 * Ferramenta dizer "Canal não encontrado." num instante.
 */
export function recusaSePronta(canais: CanaisDasFerramentas, recusa: () => string | undefined): string | undefined {
  return canais.pronto ? recusa() : undefined;
}
