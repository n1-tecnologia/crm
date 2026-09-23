"use client";

/**
 * A composição do UI-SPEC §"1 · Dashboard": grid de 4 métricas neutras
 * (nenhuma compete por atenção com cor de severidade) e duas seções de até
 * 3/2 itens cada, sem link — não há tela de detalhe para Solicitação nem
 * para Problema dentro das oito leituras (dado não modelado na ontologia,
 * DEC-16).
 */

import type { DashboardFinanceiro } from "../dados/dashboard";
import { EmptyState, Painel, Pilula, Section, type TomPilula } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

const TOM_DA_SEVERIDADE: Record<"alta" | "media" | "baixa", TomPilula> = {
  alta: "erro",
  media: "aviso",
  baixa: "neutro",
};

export function PainelDoDashboard({ dashboard }: { readonly dashboard: DashboardFinanceiro }) {
  const fmt = useFormat();

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {dashboard.metricas.map((metrica) => (
          <Painel key={metrica.chave} className="p-4">
            <p className="ed-secao" style={{ color: "var(--texto-3)" }}>
              {metrica.rotulo}
            </p>
            <p className="ed-titulo app-numero" style={{ color: "var(--texto)" }}>
              {metrica.valor}
            </p>
          </Painel>
        ))}
      </div>

      <Section title="Precisa da sua atenção" count={dashboard.atencao.length}>
        {dashboard.atencao.length === 0 ? (
          <EmptyState compact title="Nenhuma solicitação aguarda atenção." />
        ) : (
          <ul className="pilha-solta">
            {dashboard.atencao.slice(0, 3).map((item) => (
              <li key={item.id} className="item-solto" data-estatico="true">
                <div className="flex items-center justify-between gap-3">
                  <p className="app-base" style={{ color: "var(--texto-1)" }}>
                    {item.titulo}
                  </p>
                  <div className="flex items-center gap-2">
                    <Pilula tom={TOM_DA_SEVERIDADE[item.severidade]}>{item.severidade}</Pilula>
                    <span className="app-meta">{fmt.relative(item.idade)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Problemas abertos" count={dashboard.problemas.length}>
        {dashboard.problemas.length === 0 ? (
          <EmptyState compact title="Nenhum problema em aberto." />
        ) : (
          <ul className="pilha-solta">
            {dashboard.problemas.slice(0, 2).map((item) => (
              <li key={item.id} className="item-solto" data-estatico="true">
                <div className="flex items-center justify-between gap-3">
                  <p className="app-base" style={{ color: "var(--texto-1)" }}>
                    {item.titulo}
                  </p>
                  <div className="flex items-center gap-2">
                    <Pilula tom={TOM_DA_SEVERIDADE[item.severidade]}>{item.severidade}</Pilula>
                    <span className="app-meta">{fmt.relative(item.idade)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
