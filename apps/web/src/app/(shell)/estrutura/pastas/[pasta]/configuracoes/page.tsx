"use client";

import { use } from "react";
import { ContainerSettings } from "@/features/estrutura/container-settings";

export default function ConfiguracoesPage({ params }: { params: Promise<{ pasta: string }> }) {
  const { pasta } = use(params);
  return <ContainerSettings kind="folder" id={pasta} />;
}
