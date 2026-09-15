import { redirect } from "next/navigation";

/** Personalizar sem seção abre na primeira: Agente. */
export default function PersonalizarIndex() {
  redirect("/ia/personalizar/agente");
}
