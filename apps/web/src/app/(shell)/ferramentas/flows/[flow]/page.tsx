"use client";

/** O construtor do Flow: Telas, Componentes, Validação, Publicar e prévia. */

import { use } from "react";
import { FlowBuilder } from "@/features/ferramentas/flow-builder";

export default function FlowPage({ params }: { readonly params: Promise<{ flow: string }> }) {
  const { flow } = use(params);
  return <FlowBuilder flowId={flow} />;
}
