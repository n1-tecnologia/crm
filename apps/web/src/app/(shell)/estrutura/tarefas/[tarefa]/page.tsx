"use client";

import { use } from "react";
import { TarefaCompleta } from "@/features/estrutura/tarefa-completa";

/** T12 — a página da Tarefa é a Tarefa completa, com a barra de 44px. */
export default function TarefaPage({
  params,
}: {
  params: Promise<{ tarefa: string }>;
}) {
  const { tarefa } = use(params);
  return <TarefaCompleta taskId={tarefa} modo="pagina" />;
}
