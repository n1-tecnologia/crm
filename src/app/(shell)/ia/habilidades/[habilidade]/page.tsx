"use client";

import { use } from "react";
import { HabilidadeCompleta } from "@/features/ia/habilidades/habilidade-completa";

/** A ficha da Habilidade (T26): tudo — "não encontrada" inclusive — vive em `HabilidadeCompleta`. */
export default function HabilidadePage({ params }: { params: Promise<{ habilidade: string }> }) {
  const { habilidade } = use(params);
  return <HabilidadeCompleta skillId={habilidade} />;
}
