"use client";

/**
 * SEGMENTOS — escolher UMA opção de poucas, lado a lado: o período das
 * estatísticas do Início (Semana, Mês, Trimestre, Ano). Botões com
 * `aria-pressed` num grupo rotulado — o mesmo contrato das Visualizações da
 * Lista (`features/estrutura/view-bar.tsx`) —, numa pílula só: o escolhido
 * acende no acento lavado com o aro do acento (a cor nunca é o único sinal:
 * `aria-pressed` e o aro dizem o mesmo). Trocar não anima nada.
 */

import { cn } from "./cn";

export type Segmento<T extends string> = { readonly valor: T; readonly rotulo: string };

export function Segmentos<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoTrocar,
  className,
}: {
  /** O nome do grupo, para leitor de tela ("Período das estatísticas"). */
  readonly rotulo: string;
  readonly opcoes: readonly Segmento<T>[];
  readonly valor: T;
  readonly aoTrocar: (valor: T) => void;
  readonly className?: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className={cn("segmentos", className)}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          aria-pressed={opcao.valor === valor}
          className="app-sm segmento"
          onClick={() => aoTrocar(opcao.valor)}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
