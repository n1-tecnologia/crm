"use client";

/**
 * O par "Atualizado há…" + botão "Atualizar" (D4-15) — sem Realtime, sem
 * cache, recarregar é sempre um gesto explícito. Chama `useRevalidarAoFocar`
 * uma vez, para que toda tela do Financeiro que usa este botão ganhe a
 * revalidação por foco de graça, sem precisar lembrar de chamar o hook por
 * conta própria.
 */

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Icone } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";
import { useRevalidarAoFocar } from "../dados/usar-revalidar-ao-focar";

export function BotaoAtualizar({ lidoEm }: { readonly lidoEm: string }) {
  const router = useRouter();
  const fmt = useFormat();
  useRevalidarAoFocar();

  return (
    <span className="flex items-center gap-2">
      <span className="app-meta app-numero" style={{ color: "var(--texto-4)" }}>
        Atualizado {fmt.relative(lidoEm)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        icon={<Icone de={RefreshCw} tamanho="xs" />}
        onClick={() => router.refresh()}
      >
        Atualizar
      </Button>
    </span>
  );
}
