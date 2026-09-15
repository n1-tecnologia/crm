"use client";

import { use } from "react";
import { DealScreen } from "@/features/crm/deal-screen";

export default function NegocioPage({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = use(params);
  return <DealScreen dealId={negocio} />;
}
