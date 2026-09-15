"use client";

/**
 * T — Agentes: o Construtor de Agentes.
 *
 * A listagem que vivia aqui continua em `/ia/agentes/lista`; cada Agente
 * publicado aqui aparece nela e tem a própria ficha em `/ia/agentes/[id]`.
 */

import { AgentBuilder } from "@/features/ia/agent-builder/agent-builder";

export default function AgentesPage() {
  return <AgentBuilder />;
}
