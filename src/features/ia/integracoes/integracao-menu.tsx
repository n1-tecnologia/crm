"use client";

/**
 * O MENU DE UMA INTEGRAÇÃO — Conectar e Desconectar, num lugar só para a
 * seção Integrações de Personalizar e a tela `/configuracoes/integracoes`
 * dizerem a mesma coisa (3.5).
 *
 * Conectar é ato direto. Desconectar passa por confirmação, porque a
 * ontologia liga efeitos ao estado da conexão: as Ferramentas expostas ficam
 * inoperantes sem deixar de estar permitidas (18, 7.4), as Concessões cuja
 * Ferramenta obrigatória é dela mudam de Disponibilidade (RN-HAB-18) e as
 * Fontes de Conhecimento que a referenciam passam a `com erro` (20.6). O
 * diálogo mostra a mesma contagem que o Registro de Atividade grava depois
 * (`impactoDaIntegracao`). Quem age é Administrador (B35): a recusa do
 * domínio é a razão do item desligado.
 *
 * Duas entradas: `useIntegracoesMenu()` para uma lista (um diálogo, itens por
 * cartão) e `useIntegracaoMenu(integration)` para uma Integração só.
 */

import { useState, type ReactNode } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { conectarIntegracao, desconectarIntegracao, impactoDaIntegracao, recusaDeAdministrarIntegracao, type ImpactoDaIntegracao } from "@/data/operations";
import type { Id, Integration } from "@/data/types";
import { useAvisos } from "@/features/shell/ficha";
import { ConfirmDialog } from "@/features/shell/ui";

export interface ItemDoMenuDaIntegracao {
  readonly label: string;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
  readonly disabledReason?: string;
}

const contagem = (n: number, singular: string, plural: string): string => (n === 1 ? `1 ${singular}` : `${n} ${plural}`);

/** A frase do impacto, para o diálogo e para o aviso — a mesma ordem do `detail` do Registro de Atividade. */
export function fraseDoImpacto(impacto: ImpactoDaIntegracao): string {
  return `${contagem(impacto.ferramentas.length, "Ferramenta fica inoperante", "Ferramentas ficam inoperantes")}; ${contagem(impacto.habilidades, "Habilidade fica indisponível", "Habilidades ficam indisponíveis")}; ${contagem(impacto.fontes.length, "Fonte de Conhecimento com erro", "Fontes de Conhecimento com erro")}.`;
}

/**
 * Para uma lista de Integrações: `itensDe(integration)` monta o menu de cada
 * cartão e `dialogo` é o único ConfirmDialog (mais os avisos do resultado),
 * renderizado uma vez fora da lista.
 */
export function useIntegracoesMenu(): {
  readonly itensDe: (integration: Integration) => readonly ItemDoMenuDaIntegracao[];
  readonly dialogo: ReactNode;
} {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const [desconectando, setDesconectando] = useState<Id | null>(null);

  const recusa = recusaDeAdministrarIntegracao(state, memberId);
  const alvo = desconectando ? state.integrations.find((i) => i.id === desconectando) : undefined;
  const impacto = alvo ? impactoDaIntegracao(state, alvo, "desconectada") : undefined;

  const itensDe = (integration: Integration): readonly ItemDoMenuDaIntegracao[] => {
    if (integration.state === "conectada") {
      return [
        {
          label: "Desconectar…",
          destructive: true,
          onSelect: () => setDesconectando(integration.id),
          ...(recusa ? { disabledReason: recusa } : {}),
        },
      ];
    }
    return [
      {
        label: integration.state === "comErro" ? "Reconectar" : "Conectar",
        onSelect: () => {
          const antes = impactoDaIntegracao(state, integration, "conectada");
          const result = run((data, me) => conectarIntegracao(data, me, integration.id));
          report(
            result,
            `Integração “${integration.name}” conectada: ${contagem(antes.ferramentas.length, "Ferramenta operante", "Ferramentas operantes")}; ${contagem(antes.habilidades, "Habilidade disponível de novo", "Habilidades disponíveis de novo")}; ${contagem(antes.fontes.length, "Fonte de Conhecimento reativada", "Fontes de Conhecimento reativadas")}.`,
          );
        },
        ...(recusa ? { disabledReason: recusa } : {}),
      },
    ];
  };

  const confirmar = () => {
    if (!alvo || !impacto) return;
    const result = run((data, me) => desconectarIntegracao(data, me, alvo.id));
    setDesconectando(null);
    report(result, `Integração “${alvo.name}” desconectada: ${fraseDoImpacto(impacto)}`);
  };

  const dialogo = (
    <>
      {avisos}
      <ConfirmDialog
        open={alvo !== undefined}
        title={alvo ? `Desconectar “${alvo.name}”?` : "Desconectar Integração?"}
        description="As Ferramentas que ela expõe seguem permitidas aos Agentes e ficam inoperantes até reconectar; nada é retirado em silêncio (18, 7.4)."
        confirmLabel="Desconectar"
        destructive
        {...(recusa ? { confirmDisabledReason: recusa } : {})}
        onConfirm={confirmar}
        onCancel={() => setDesconectando(null)}
      >
        {impacto ? (
          <div className="grid gap-2">
            <p className="app-base" style={{ color: "var(--texto)" }}>
              {fraseDoImpacto(impacto)}
            </p>
            {impacto.ferramentas.length > 0 ? (
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                Ferramentas: {impacto.ferramentas.map((t) => t.name).join(", ")}.
              </p>
            ) : null}
            {impacto.fontes.length > 0 ? (
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                Fontes: {impacto.fontes.map(({ colecao, fonte }) => `${fonte.name} (${colecao.name})`).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );

  return { itensDe, dialogo };
}

/** Para uma Integração só: os itens do menu dela e o diálogo de desconectar. */
export function useIntegracaoMenu(integration: Integration): {
  readonly itens: readonly ItemDoMenuDaIntegracao[];
  readonly dialogo: ReactNode;
} {
  const { itensDe, dialogo } = useIntegracoesMenu();
  return { itens: itensDe(integration), dialogo };
}
