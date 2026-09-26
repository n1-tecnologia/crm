import { redirect } from "next/navigation";

/** D2 — uma lista por entidade: a de Automações é a seção de Personalizar. Os editores seguem em `/ia/automacoes/[automacao]`. */
export default function AutomacoesRedirect() {
  redirect("/ia/personalizar/automacao");
}
