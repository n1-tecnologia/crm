import { redirect } from "next/navigation";

/** D2 — uma lista por entidade: a de Habilidades é a seção de Personalizar. As fichas seguem em `/ia/habilidades/[habilidade]`. */
export default function HabilidadesRedirect() {
  redirect("/ia/personalizar/habilidades");
}
