"use client";

import { use } from "react";
import { AgenteCompleto } from "@/features/ia/agentes/agente-completo";

/**
 * A ficha do Agente: Habilidades concedidas, Ferramentas permitidas,
 * Conhecimento acessível, Execuções, Memória e, ao lado, a Configuração, as
 * Versões e o que o Construtor gravou. O estado muda aqui (D1); o Construtor
 * (`/ia/agentes?editar=<id>`) grava Versões.
 */
export default function AgentePage({ params }: { params: Promise<{ agente: string }> }) {
  const { agente } = use(params);
  return <AgenteCompleto agentId={agente} />;
}
