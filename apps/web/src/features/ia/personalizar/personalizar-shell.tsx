"use client";

/**
 * A casca de Personalizar: as seções numa barra horizontal no topo, como abas,
 * e o conteúdo da seção escolhida embaixo, ocupando o resto. As telas de cada
 * seção são as que já existiam — a barra só as reúne num lugar.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { SECOES, type SecaoId } from "./secoes";

export function PersonalizarShell({
  secao,
  children,
}: {
  readonly secao: SecaoId;
  readonly children: ReactNode;
}) {
  const atual = SECOES.find((s) => s.id === secao);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--cor-traco)] bg-[var(--cor-superficie)] px-6 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[length:var(--texto-lg)] font-[var(--peso-forte)] text-[var(--cor-tinta)]">Personalizar</p>
          {atual ? (
            <p className="min-w-0 truncate text-[length:var(--texto-sm)] text-[var(--cor-tinta-fraca)]">{atual.descricao}</p>
          ) : null}
        </div>
        <nav aria-label="Seções de Personalizar" className="-mb-px mt-3 overflow-x-auto">
          <ul className="flex gap-1">
            {SECOES.map((item) => {
              const ativo = item.id === secao;
              return (
                <li key={item.id} className="shrink-0">
                  <Link
                    href={`/ia/personalizar/${item.id}`}
                    aria-current={ativo ? "page" : undefined}
                    className={`block border-b-2 px-3 py-2 text-[length:var(--texto-base)] ${
                      ativo
                        ? "border-[var(--cor-acento)] font-[var(--peso-medio)] text-[var(--cor-tinta)]"
                        : "border-transparent text-[var(--cor-tinta-fraca)] hover:text-[var(--cor-tinta)]"
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
