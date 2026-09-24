"use client";

/**
 * D4-09 — Empresa é um FILTRO de URL (`?empresa=`), nunca um trocador de
 * tenant. Confirmado pela pesquisa em uma única tela das oito: Plano de
 * contas (`conciliador_contas` filtrada por `metadata @> {empresa, tipo}`),
 * então este componente só é usado lá — não é o `EmpresaSwitcher` de hoje:
 * não muda tema, não muda sessão, não aparece na casca.
 *
 * Os seis valores TÉCNICOS são a allowlist fixa de
 * `EMPRESAS_PERMITIDAS` (`apps/api/src/rotas/financeiro.ts`); os rótulos
 * humanos vêm do único de-para real encontrado no repositório-irmão —
 * `ORGANIZATIONS` em `financeiro-tria/src/contexts/OrganizationContext.tsx`
 * — nenhum nome comercial foi inventado aqui.
 *
 * `router.replace` (nunca o outro método de navegação, para não encher o
 * histórico a cada troca de filtro) e nunca o marcador de navegação do shell
 * — filtro não é navegação de tela.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/features/shell/ui";

const EMPRESAS = [
  { value: "", label: "Todas as Empresas" },
  { value: "tria", label: "Tria" },
  { value: "finq", label: "FINQ / Konq" },
  { value: "pf", label: "Marcos Paulo" },
  { value: "exo_loteamentos", label: "EXO Loteamento" },
  { value: "exo_participacoes", label: "EXO Participações" },
  { value: "oliveira_participacoes", label: "Oliveira Participações" },
] as const;

export function FiltroDeEmpresa() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const empresa = searchParams.get("empresa") ?? "";

  function mudar(valor: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set("empresa", valor);
    else params.delete("empresa");
    const texto = params.toString();
    router.replace(texto ? `?${texto}` : "?", { scroll: false });
  }

  return <Select size="sm" placeholder="Empresa" value={empresa} onChange={mudar} options={EMPRESAS} />;
}
