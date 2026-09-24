"use client";

/**
 * NOVA HABILIDADE (18, 12.1): Nome e Descrição. Nasce ativa, com a Versão 1
 * em rascunho vazia — escrever as instruções, publicar e conceder são atos
 * seguintes, na ficha, para onde "Criar e abrir" leva.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { criarHabilidade, recusaDeConvidado } from "@/data/operations";
import { ConfirmDialog, Field, TextArea, TextInput } from "@/features/shell/ui";

export function NovaHabilidadeDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, skillId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // A mesma frase que a operação usaria: quem não pode criar sabe antes do clique.
  const motivo = recusaDeConvidado(state, memberId, "cria Habilidade") ?? (nome.trim() ? undefined : "Dê um nome à Habilidade.");

  const reset = () => {
    setNome("");
    setDescricao("");
    setErro(null);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Nova Habilidade"
      description="Nasce ativa, com a Versão 1 em rascunho: escreva as instruções, publique e conceda a um Agente."
      confirmLabel="Criar e abrir"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => criarHabilidade(data, me, { name: nome, description: descricao }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        reset();
        onDone(`Habilidade “${r.value.name}” criada, com a Versão 1 em rascunho.`, r.value.id);
      }}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <Field label="Nome" required hint="Único entre as Habilidades do Espaço de Trabalho (RN-HAB-02).">
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Sugerir próximo passo" />}
        </Field>
        <Field label="Descrição" hint="O que a Habilidade faz, para quem a concede.">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Uma competência reutilizável que um Agente exerce" />}
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
