"use client";

/**
 * /crm/meus-negocios — a Pasta "Meus negócios" vista do CRM: uma Lista por
 * Funil (SDR, Closer, Validação, Venda direta), cada uma com os Negócios
 * espelhados. A mesma estrutura de pastas da Estrutura, do lado do CRM.
 */

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { useData } from "@/data/store";
import { isTerminalCategory, statusCategory } from "@/data/derive";
import { MEUS_NEGOCIOS_ID } from "@/data/seed-comercial";
import { dealOfTask } from "@/features/estrutura/quadro-negocios";
import { useFormat } from "@/features/shell/use-format";
import { CorpoDeTela, EmptyState, Icone, PageHeader } from "@/features/shell/ui";
import { Selo } from "@/features/estrutura/icone-de-tipo";

export default function MeusNegociosPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const pasta = state.folders.find((f) => f.id === MEUS_NEGOCIOS_ID);
  const listas = state.lists
    .filter((l) => l.parentType === "folder" && l.parentId === MEUS_NEGOCIOS_ID && l.lifecycle === "ativo")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/crm/negocios" className="hover:underline">
            Negócios
          </Link>
        }
        title={pasta?.name ?? "Meus negócios"}
        meta={`${listas.length} ${listas.length === 1 ? "Funil" : "Funis"}`}
      />
      <CorpoDeTela>
        {listas.length === 0 ? (
          <EmptyState title="Nenhum Funil espelhado ainda." hint="As Listas de Meus negócios nascem com os Funis." />
        ) : (
          <ul className="pilha-solta">
            {listas.map((lista) => {
              const negocios = state.tasks.filter(
                (t) => t.listId === lista.id && t.parentTaskId === undefined && t.provenance?.kind === "deal" && t.lifecycle === "ativo",
              );
              const abertos = negocios.filter((t) => !isTerminalCategory(statusCategory(state, t)));
              const valor = abertos.reduce((sum, t) => sum + (dealOfTask(state, t)?.value?.amount ?? 0), 0);
              return (
                <li key={lista.id}>
                  <Link href={`/crm/meus-negocios/${lista.id}`} className="item-solto">
                    <Selo icone={Briefcase} cor="var(--acento)" lavado="var(--acento-lavado)" />
                    <span className="min-w-0 flex-1">
                      <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                        {lista.name}
                      </span>
                      <span className="app-meta block truncate">
                        {abertos.length} {abertos.length === 1 ? "aberto" : "abertos"} · {fmt.money({ amount: valor, currency: "BRL" })} em valor declarado
                      </span>
                    </span>
                    <span className="app-meta app-numero">{negocios.length}</span>
                    <Icone de={Briefcase} tamanho="xs" style={{ color: "var(--texto-4)" }} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CorpoDeTela>
    </div>
  );
}
