"use client";

import { use } from "react";
import { ContainerSettings } from "@/features/estrutura/container-settings";

export default function ConfiguracoesPage({ params }: { params: Promise<{ espaco: string }> }) {
  const { espaco } = use(params);
  return <ContainerSettings kind="space" id={espaco} />;
}
