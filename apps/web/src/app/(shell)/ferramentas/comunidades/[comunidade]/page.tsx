"use client";

/** A Comunidade em página cheia: a mesma ficha do popup, com o cabeçalho de tela por cima. */

import Link from "next/link";
import { use } from "react";
import { Layers } from "lucide-react";
import { useData } from "@/dados/store";
import { ComunidadeCompleta } from "@/features/ferramentas/comunidade-popup";
import { Icone, PageHeader } from "@/features/shell/ui";

export default function ComunidadePage({ params }: { readonly params: Promise<{ comunidade: string }> }) {
  const { comunidade: comunidadeId } = use(params);
  const nome = useData((data) => data.comunidades.find((c) => c.id === comunidadeId)?.nome);
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <span>
            Ferramentas ›{" "}
            <Link href="/ferramentas/comunidades" className="hover:underline">
              Comunidades
            </Link>
          </span>
        }
        icon={<Icone de={Layers} tamanho="sm" />}
        title={nome ?? "Comunidade"}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <ComunidadeCompleta comunidadeId={comunidadeId} modo="pagina" />
      </div>
    </div>
  );
}
