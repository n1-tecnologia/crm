"use client";

/**
 * `?criar=<família>` — o parâmetro de URL que abre o diálogo de criação de
 * Contato, Empresa ou Negócio nas três listas do CRM.
 *
 * O diálogo em si de cada família mora no seu `formulario-de-*.tsx`
 * (`DialogoNovoContato`, `DialogoNovaEmpresa`, `DialogoNovoNegocio`), lendo e
 * gravando pela api (D-04). O que ficou aqui é só o gesto comum: abrir é pôr
 * `?criar=` na URL (o diálogo sobrevive a um recarregamento e entra no
 * histórico) e fechar é tirá-lo, preservando os outros parâmetros da tela.
 *
 * O `CreateRecordDialog` do modelo antigo (um formulário para as três
 * famílias sobre o store em memória) saiu quando a última lista passou a usar
 * o diálogo novo (07-11).
 */

import { useRouter, useSearchParams } from "next/navigation";

export const CREATE_PARAM = "criar";

export type CrmFamily = "contato" | "empresa" | "negocio";

export function useCreateRecordDialog(family: CrmFamily): {
  readonly creating: boolean;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    creating: query.get(CREATE_PARAM) === family,
    openCreate: () => {
      const next = new URLSearchParams(query.toString());
      next.set(CREATE_PARAM, family);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeCreate: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(CREATE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}
