"use client";

import { use } from "react";
import { ColecaoCompleta } from "@/features/ia/conhecimento/colecao-completa";

/** T30 — a ficha da Coleção: Documentos, Fontes, Acesso (Concessões a Agentes) e Retenção. */
export default function ColecaoPage({ params }: { params: Promise<{ colecao: string }> }) {
  const { colecao } = use(params);
  return <ColecaoCompleta colecaoId={colecao} />;
}
