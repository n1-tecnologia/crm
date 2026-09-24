"use client";

/**
 * PUBLICAR A VERSÃO EM RASCUNHO (19, 12.2): a confirmação diz o que a Versão
 * faz — Gatilho, Condições, Ações — e, se a validação ainda aponta problemas,
 * lista-os e desliga o botão com o mesmo motivo que `publishAutomation`
 * responderia (RN-AUT-07). A vigente passa a obsoleta no mesmo ato; uma
 * Automação em rascunho passa a ativa.
 */

import { useState } from "react";
import { useRun } from "@/data/store";
import { publishAutomation, type ProblemaDeAutomacao } from "@/data/operations";
import type { Automation, AutomationVersion } from "@/data/types";
import type { Report } from "@/features/shell/ficha";
import { ConditionMarker, ConfirmDialog } from "@/features/shell/ui";
import { resumoDoGatilho } from "./automacao-spec";

const contagem = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;

export function PublicarAutomacaoDialog({
  automation,
  rascunho,
  vigente,
  problemas,
  onClose,
  report,
}: {
  readonly automation: Automation;
  readonly rascunho: AutomationVersion;
  readonly vigente: AutomationVersion | undefined;
  readonly problemas: readonly ProblemaDeAutomacao[];
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const run = useRun();
  const [erro, setErro] = useState<string | null>(null);
  const motivo = problemas.length === 0 ? undefined : problemas.length === 1 ? problemas[0]?.mensagem : `${problemas.length} problemas de validação (RN-AUT-07).`;
  return (
    <ConfirmDialog
      open
      title={`Publicar a Versão ${rascunho.number}?`}
      description={
        vigente
          ? `A Versão ${vigente.number}, hoje publicada, passa a obsoleta no mesmo ato. Execuções já em curso seguem na Versão que as iniciou.`
          : automation.lifecycle === "rascunho"
            ? "Esta passa a ser a Versão vigente e a Automação passa a ativa: a partir daqui o Gatilho dispara Execuções reais."
            : "Esta passa a ser a Versão vigente: a partir daqui o Gatilho dispara Execuções reais."
      }
      confirmLabel="Publicar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => publishAutomation(data, me, automation.id));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, vigente ? `Versão ${r.value.number} publicada. A Versão ${vigente.number} passou a obsoleta.` : `Versão ${r.value.number} publicada.`);
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-3">
        <p className="app-base" style={{ color: "var(--texto)" }}>
          Gatilho {resumoDoGatilho(rascunho.trigger)} · {contagem(rascunho.conditions.length, "Condição", "Condições")} · {contagem(rascunho.actions.length, "Ação", "Ações")}
        </p>
        {problemas.length > 0 ? (
          <ol className="grid gap-1.5">
            {problemas.map((p, i) => (
              <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--texto-2)" }}>
                <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
                <span className="min-w-0 flex-1">{p.mensagem}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="app-sm" style={{ color: "var(--sucesso)" }}>
            Nenhum problema. A Versão pode ser publicada.
          </p>
        )}
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
