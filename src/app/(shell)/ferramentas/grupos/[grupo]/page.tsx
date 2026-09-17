"use client";

/**
 * O Grupo em página cheia: a mesma ficha do popup, com o cabeçalho de tela
 * por cima. É para onde o rodapé do popup leva.
 */

import Link from "next/link";
import { use } from "react";
import { Users } from "lucide-react";
import { useData } from "@/data/store";
import { GrupoCompleto } from "@/features/ferramentas/grupo-popup";
import { Icone, PageHeader } from "@/features/shell/ui";

export default function GrupoPage({ params }: { readonly params: Promise<{ grupo: string }> }) {
  const { grupo: grupoId } = use(params);
  const nome = useData((data) => data.grupos.find((g) => g.id === grupoId)?.nome);
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <span>
            Ferramentas ›{" "}
            <Link href="/ferramentas/grupos" className="hover:underline">
              Grupos
            </Link>
          </span>
        }
        icon={<Icone de={Users} tamanho="sm" />}
        title={nome ?? "Grupo"}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <GrupoCompleto grupoId={grupoId} modo="pagina" />
      </div>
    </div>
  );
}
