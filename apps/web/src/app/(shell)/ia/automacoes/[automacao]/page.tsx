"use client";

/** O editor da Automação: Gatilho, Condições, Ações, Validação, Publicar, Execuções e Versões. */

import { use } from "react";
import { EditorDeAutomacao } from "@/features/ia/automacoes/editor-de-automacao";

export default function AutomacaoPage({ params }: { readonly params: Promise<{ automacao: string }> }) {
  const { automacao } = use(params);
  return <EditorDeAutomacao automationId={automacao} />;
}
