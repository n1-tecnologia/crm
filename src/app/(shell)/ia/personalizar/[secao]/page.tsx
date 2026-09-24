"use client";

/**
 * Personalizar: a barra de seções no topo e, embaixo, o inventário da
 * entidade (D2) — cada seção é A lista de Agentes, Habilidades, Automações,
 * Coleções, Integrações e Ferramentas. As listas antigas em `/ia/*`
 * redirecionam para cá; o Construtor de Agentes continua em `/ia/agentes`.
 */

import { notFound } from "next/navigation";
import { use } from "react";
import { PersonalizarShell } from "@/features/ia/personalizar/personalizar-shell";
import { isSecao } from "@/features/ia/personalizar/secoes";
import {
  AgentesCatalogo,
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
      <AgentesCatalogo />
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
