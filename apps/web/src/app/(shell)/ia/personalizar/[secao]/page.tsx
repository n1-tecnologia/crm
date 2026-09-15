"use client";

/**
 * Personalizar: o submenu à esquerda e, à direita, a tela da seção — as
 * mesmas páginas que já existem em `/ia/*` e `/configuracoes/integracoes`,
 * reunidas sob um só lugar. As rotas antigas continuam valendo.
 */

import { notFound } from "next/navigation";
import { use } from "react";
import { PersonalizarShell } from "@/features/ia/personalizar/personalizar-shell";
import { isSecao } from "@/features/ia/personalizar/secoes";
import AgentesPage from "@/app/(shell)/ia/agentes/page";
import {
  AutomacoesCatalogo,
  ConectoresCatalogo,
  ConhecimentoCatalogo,
  HabilidadesCatalogo,
  PluginsCatalogo,
} from "@/features/ia/personalizar/secoes-catalogo";

export default function PersonalizarPage({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = use(params);
  if (!isSecao(secao)) notFound();

  const conteudo =
    secao === "agente" ? (
      <AgentesPage />
    ) : secao === "habilidades" ? (
      <HabilidadesCatalogo />
    ) : secao === "automacao" ? (
      <AutomacoesCatalogo />
    ) : secao === "conhecimento" ? (
      <ConhecimentoCatalogo />
    ) : secao === "conectores" ? (
      <ConectoresCatalogo />
    ) : (
      <PluginsCatalogo />
    );

  return <PersonalizarShell secao={secao}>{conteudo}</PersonalizarShell>;
}
