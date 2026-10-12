/**
 * `/crm/caixa-de-entrada/configuracoes/canais/conectar/<provedor>` — a página
 * de orientação de um provedor (Fase 8, D-06, D-08). Server Component: valida o
 * slug da URL e entrega ao Client Component `ConectarProvedor` só um provedor
 * conhecido (T-08-08). Um slug que não é provedor nunca chega ao formulário:
 * `notFound()` — a doc desta versão do Next o lista para Server Components
 * (`04-functions/not-found.md`).
 *
 * Nada de estado nem de store aqui: o formulário, a chamada à api e a
 * re-hidratação moram em `features/crm/conectar-provedor.tsx`.
 */

import { notFound } from "next/navigation";
import { ehProvedorDeCanal } from "@n1/dominio/provedores-de-canal";
import { ConectarProvedor } from "@/features/crm/conectar-provedor";

export default async function ConectarProvedorPage({ params }: { params: Promise<{ provedor: string }> }) {
  const { provedor } = await params;
  if (!ehProvedorDeCanal(provedor)) notFound();
  return <ConectarProvedor provedor={provedor} />;
}
