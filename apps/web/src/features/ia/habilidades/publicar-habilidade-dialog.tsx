"use client";

/**
 * PUBLICAR UMA VERSÃO DE HABILIDADE (18, 12.2): a confirmação diz o que muda
 * — a nova passa a ser a corrente; a publicada anterior PERMANECE publicada,
 * exercível pelas Concessões que a fixaram, até ser obsoletada (B71) — e
 * mostra o Efeito declarado a quem publica (RN-HAB-11). Com problemas de
 * validação (RN-HAB-06) o botão fica desligado e os lista: publicar
 * recusaria sem efeito.
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { publicarVersaoDaHabilidade, validarRascunhoDaHabilidade } from "@n1/dominio/operations";
import { efeitoDeclarado, versaoCorrenteDaHabilidade } from "@n1/dominio/derive-ia";
import type { Skill, SkillVersion } from "@n1/dominio/types";
import { ConditionMarker, ConfirmDialog, Pilula } from "@/features/shell/ui";
import { EFEITO_LABEL, EFEITO_TOM } from "../rotulos";

export function PublicarHabilidadeDialog({
  skill,
  rascunho,
  recusa,
  open,
  onClose,
  onDone,
}: {
  readonly skill: Skill;
  readonly rascunho: SkillVersion;
  /** A recusa de `administrar`, quando há: o diálogo espelha a mesma frase. */
  readonly recusa: string | undefined;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [erro, setErro] = useState<string | null>(null);
  const problemas = validarRascunhoDaHabilidade(state, skill, rascunho);
  const anterior = versaoCorrenteDaHabilidade(skill);
  const efeito = efeitoDeclarado(state, rascunho);
  const n = problemas.length;
  const motivo = recusa ?? (n > 0 ? `${n} problema${n > 1 ? "s" : ""} de validação (RN-HAB-06): ${problemas.map((p) => p.mensagem).join(" · ")}` : undefined);

  return (
    <ConfirmDialog
      open={open}
      title={`Publicar a Versão ${rascunho.number}?`}
      description={
        anterior
          ? `A v${rascunho.number} passa a ser a corrente: as Concessões que a seguem passam a exercê-la a partir do próximo exercício. A v${anterior.number} permanece publicada, exercível pelas Concessões que a fixaram, até ser obsoletada (B71).`
          : `A v${rascunho.number} passa a ser a corrente: as Concessões que seguem a corrente passam a exercê-la a partir do próximo exercício (B71). Uma Versão publicada não é editada: mudar é criar outro rascunho.`
      }
      confirmLabel={`Publicar v${rascunho.number}`}
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => publicarVersaoDaHabilidade(data, me, skill.id));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        setErro(null);
        onDone(`v${r.value.number} publicada.${anterior ? ` A v${anterior.number} permanece publicada (B71).` : ""}`);
      }}
      onCancel={() => {
        setErro(null);
        onClose();
      }}
    >
      <div className="grid gap-3">
        <p className="app-base flex flex-wrap items-center gap-2" style={{ color: "var(--texto-2)" }}>
          Efeito declarado
          <Pilula tom={EFEITO_TOM[efeito]}>{EFEITO_LABEL[efeito]}</Pilula>
          <span className="app-meta">— a aprovação em tempo de exercício segue por Ferramenta (B22).</span>
        </p>
        {n > 0 ? (
          <ol className="grid gap-2">
            {problemas.map((p, i) => (
              <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--texto-2)" }}>
                <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
                <span className="min-w-0 flex-1">{p.mensagem}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
