"use client";

import { use } from "react";
import { DocumentoCompleto } from "@/features/ia/conhecimento/documento-completo";

/** T31 — a ficha do Documento: Conteúdo da Versão corrente, Fragmentos, Versões, Comentários, Proveniência e Metadado. */
export default function DocumentoPage({ params }: { params: Promise<{ documento: string }> }) {
  const { documento } = use(params);
  return <DocumentoCompleto documentId={documento} />;
}
