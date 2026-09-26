import { redirect } from "next/navigation";

/** D2 — uma lista por entidade: a de Agentes é a seção de Personalizar. */
export default function AgentesListaRedirect() {
  redirect("/ia/personalizar/agente");
}
