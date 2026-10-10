"use client";

/**
 * O que o CRM novo ainda lê do store antigo: os Membros e o Papel de quem está
 * na sessão. Os ids de Membro são os mesmos de `plataforma.registros` (D-11),
 * então o Proprietário escolhido aqui é o que o backend valida.
 *
 * `usePodeNoCrm` só ESCONDE: a tela consulta a mesma `podeNoCrm` do domínio que
 * `apps/api` aplica, mas quem barra de verdade é o backend (D-14) — um botão
 * forçado no DevTools recebe 403.
 */

import type { SituacaoNegocio } from "@n1/dominio/crm/comum";
import { podeNoCrm, type AcaoCrm, type RecursoCrm } from "@n1/dominio/crm/permissoes";
import { useCurrentMember, useData } from "@/dados/store";

/** Os Membros `ativo` do Espaço, para o seletor de Proprietário (D-11). Nunca pendentes nem removidos. */
export function useMembrosAtivos(): ReadonlyArray<{ readonly id: string; readonly nome: string }> {
  const membros = useData((data) => data.members);
  return membros.filter((membro) => membro.state === "ativo").map((membro) => ({ id: membro.id, nome: membro.displayName }));
}

/** O nome do Membro, ou "—" quando o id é desconhecido ou ausente (nunca célula vazia). */
export function useNomeDoMembro(): (id: string | null | undefined) => string {
  const membros = useData((data) => data.members);
  return (id) => (id ? (membros.find((membro) => membro.id === id)?.displayName ?? "—") : "—");
}

/** `undefined` quando o Membro da sessão pode; a frase de recusa, em português, quando não pode. */
export function usePodeNoCrm(acao: AcaoCrm, recurso: RecursoCrm, contexto?: { readonly situacao?: SituacaoNegocio }): string | undefined {
  const membro = useCurrentMember();
  const base = useData((data) => data.roles.find((papel) => papel.id === membro?.roleId)?.base);
  return podeNoCrm(base, membro?.state, acao, recurso, contexto);
}
