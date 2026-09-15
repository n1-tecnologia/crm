"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

/**
 * ÍCONE — embrulho do Lucide fixando o traço do sistema.
 *
 * O design system inicializa o Lucide com `stroke-width: 1.5` e usa quatro
 * tamanhos. Passar isso em cada uso seria repetição garantida de errar; aqui
 * fica num lugar só.
 *
 * O `size` do Lucide fica sendo o piso; quem manda é o token, porque ele cresce
 * nos degraus de tela. Sem isto o ícone continuaria em 16px num monitor onde o
 * texto ao lado já está em 16px, e ficaria pequeno demais ao lado dele.
 */

export type TamanhoIcone = "xs" | "sm" | "md" | "lg";

const TAMANHOS: Record<TamanhoIcone, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 48,
};

const MEDIDA: Record<TamanhoIcone, string> = {
  xs: "var(--icone-xs)",
  sm: "var(--icone-sm)",
  md: "var(--icone-md)",
  lg: "var(--icone-lg)",
};

export function Icone({
  de: Componente,
  tamanho = "sm",
  className,
  ...resto
}: {
  readonly de: LucideIcon;
  readonly tamanho?: TamanhoIcone;
  readonly className?: string;
} & Omit<React.ComponentProps<LucideIcon>, "size" | "strokeWidth">) {
  const px = TAMANHOS[tamanho];
  const { style, ...outros } = resto;
  return (
    <Componente
      size={px}
      strokeWidth={1.5}
      aria-hidden
      className={cn("shrink-0", className)}
      style={{ width: MEDIDA[tamanho], height: MEDIDA[tamanho], ...style }}
      {...outros}
    />
  );
}
