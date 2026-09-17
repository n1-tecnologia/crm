import { redirect } from "next/navigation";

/** Ferramentas abre em Grupos, a primeira tela do assunto. */
export default function FerramentasPage() {
  redirect("/ferramentas/grupos");
}
