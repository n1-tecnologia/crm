"use client";

/**
 * COPIAR UMA HABILIDADE DA PLATAFORMA (DO-HAB-07): a única forma de partir
 * de uma. A cópia é Habilidade nova do Espaço de Trabalho — identificador
 * próprio, Versão 1 em rascunho idêntica à Versão escolhida (a corrente por
 * padrão) e Proveniência; sem vínculo vivo, e as Concessões não migram.
 * Nada é exercível sem publicar (RN-HAB-05).
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { copiarHabilidadeDaPlataforma, recusaDeConvidado } from "@/data/operations";
import { efeitoDeclarado, versaoCorrenteDaHabilidade } from "@/data/derive-ia";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";
import { EFEITO_LABEL } from "../rotulos";

export function CopiarDaPlataformaDialog({
  skillId: habilidadeInicial,
  open,
  onClose,
  onDone,
}: {
  /** Pré-seleciona a Habilidade — a ficha de uma da plataforma abre o diálogo já nela. */
  readonly skillId?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, skillId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [skillId, setSkillId] = useState(habilidadeInicial ?? "");
  const [versao, setVersao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Só as da plataforma com Versão corrente têm o que copiar.
  const daPlataforma = state.skills.filter((s) => s.ownership === "plataforma" && s.lifecycle === "ativo" && versaoCorrenteDaHabilidade(s) !== undefined);
  const origem = daPlataforma.find((s) => s.id === skillId);
  const corrente = origem ? versaoCorrenteDaHabilidade(origem) : undefined;
  const publicadas = origem ? origem.versions.filter((v) => v.state === "publicada").sort((a, b) => b.number - a.number) : [];
  const numero = versao ? Number(versao) : corrente?.number;

  const motivo = recusaDeConvidado(state, memberId, "cria Habilidade") ?? (origem ? undefined : "Escolha a Habilidade da plataforma.");

  const reset = () => {
    setSkillId(habilidadeInicial ?? "");
    setVersao("");
    setErro(null);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Copiar da plataforma"
      description="A cópia é uma Habilidade nova do Espaço de Trabalho: Versão 1 em rascunho idêntica à Versão escolhida, com Proveniência e sem vínculo vivo (DO-HAB-07). As Concessões não migram, e nada é exercível sem publicar (RN-HAB-05)."
      confirmLabel="Copiar e abrir"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => copiarHabilidadeDaPlataforma(data, me, skillId, numero));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        reset();
        onDone(`“${r.value.name}” criada a partir da v${numero ?? "?"} de “${origem?.name ?? ""}”, com a Versão 1 em rascunho.`, r.value.id);
      }}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <Field label="Habilidade" required hint="Só as da plataforma são copiadas; as do Espaço de Trabalho são editadas.">
          {(id) => (
            <Select
              id={id}
              value={skillId}
              onChange={(v) => {
                setSkillId(v);
                setVersao("");
              }}
              searchable
              placeholder="Escolher a Habilidade"
              options={daPlataforma.map((s) => {
                const c = versaoCorrenteDaHabilidade(s);
                return { value: s.id, label: s.name, detail: c ? `v${c.number} · ${EFEITO_LABEL[efeitoDeclarado(state, c)]}` : "" };
              })}
            />
          )}
        </Field>
        <Field label="Versão" hint="A corrente por padrão; qualquer publicada serve de origem.">
          {(id) => (
            <Select
              id={id}
              value={versao || (corrente ? String(corrente.number) : "")}
              onChange={setVersao}
              placeholder="A corrente"
              disabled={!origem}
              disabledReason="Escolha a Habilidade antes."
              options={publicadas.map((v) => ({ value: String(v.number), label: `Versão ${v.number}`, detail: v.number === corrente?.number ? "corrente" : "publicada" }))}
            />
          )}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
