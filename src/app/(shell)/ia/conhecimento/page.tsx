import { redirect } from "next/navigation";

/** D2 — uma lista por entidade: a de Coleções é a seção de Personalizar. As fichas seguem em `/ia/conhecimento/[colecao]` e `/ia/conhecimento/documentos`. */
export default function ConhecimentoRedirect() {
  redirect("/ia/personalizar/conhecimento");
}
