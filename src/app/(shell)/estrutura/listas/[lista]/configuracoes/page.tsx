"use client";

import { use } from "react";
import { ContainerSettings } from "@/features/estrutura/container-settings";

export default function ConfiguracoesPage({ params }: { params: Promise<{ lista: string }> }) {
  const { lista } = use(params);
  return <ContainerSettings kind="list" id={lista} />;
}
