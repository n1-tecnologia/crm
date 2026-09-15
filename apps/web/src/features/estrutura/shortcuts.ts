import type { SpaceShortcut } from "@n1/dominio/types";

/** Um atalho no nível das Listas: a Caixa de Entrada do CRM com o recorte do Membro. */
export function shortcutHref(shortcut: SpaceShortcut): string {
  return shortcut.scope === "minhas" ? "/crm/caixa-de-entrada?escopo=minhas" : "/crm/caixa-de-entrada";
}
