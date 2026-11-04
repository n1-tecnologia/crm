"use client";

/**
 * 12.4.4 — criar e editar Papel personalizado: nome, base e os seis módulos.
 *
 * Decisões 12.1.3 (A) e 12.1.4 (B): o Papel libera módulos e tem uma base como
 * teto; a lista de permissões por ação não é oferecida. A base não muda depois
 * de criada, e um Papel de sistema não se edita — quem recusa é o domínio
 * (`createRole`, `updateRole`); a tela só desliga o que ele recusaria.
 */

import { useId, useState } from "react";
import type { Modulo, Role, SystemRole } from "@n1/dominio";
import { MODULOS, ROTULO_DO_MODULO, modulosDoPapel } from "@n1/dominio/derive-modulos";
import { createRole, updateRole } from "@n1/dominio/operations";
import { useRun } from "@/dados/store";
import { ConfirmDialog, Field, Select, TextInput, Toggle } from "@/features/shell/ui";

const BASES: ReadonlyArray<{ readonly value: Exclude<SystemRole, "proprietario">; readonly label: string }> = [
  { value: "membro", label: "Membro" },
  { value: "administrador", label: "Administrador" },
  { value: "convidado", label: "Convidado" },
];

/** `papel` ausente = Papel novo. Monte com `key` diferente a cada abertura para o formulário nascer do Papel certo. */
export function PapelDialog({
  papel,
  onClose,
  onDone,
}: {
  readonly papel?: Role;
  readonly onClose: () => void;
  readonly onDone: (frase: string) => void;
}) {
  const run = useRun();
  const editando = papel !== undefined;
  const [nome, setNome] = useState(papel?.name ?? "");
  const [base, setBase] = useState<Exclude<SystemRole, "proprietario">>(
    papel && papel.base !== "proprietario" ? papel.base : "membro",
  );
  const [modulos, setModulos] = useState<readonly Modulo[]>(papel ? modulosDoPapel(papel) : MODULOS);
  const [erro, setErro] = useState<string | null>(null);
  const prefixo = useId();

  const alternar = (modulo: Modulo, ligado: boolean) =>
    setModulos((atuais) => MODULOS.filter((m) => (m === modulo ? ligado : atuais.includes(m))));

  const motivo = !nome.trim() ? "Dê um nome ao Papel." : modulos.length === 0 ? "Escolha ao menos um módulo." : undefined;

  const gravar = () => {
    const r = editando
      ? run((data, me) => updateRole(data, me, papel.id, { nome, modulos }))
      : run((data, me) => createRole(data, me, { nome, base, modulos }));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    onDone(editando ? `Papel ${r.value.name} alterado.` : `Papel ${r.value.name} criado.`);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      wide
      title={editando ? `Editar ${papel.name}` : "Novo Papel"}
      description="Um Papel personalizado declara uma base, que é o teto do que ele pode, e os módulos que libera no menu."
      confirmLabel={editando ? "Gravar" : "Criar Papel"}
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={gravar}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Comercial" required />}
        </Field>
        <Field
          label="Base"
          hint={editando ? "A base não muda depois de criada." : "O teto do Papel: ele nunca pode mais do que a base."}
        >
          {(id) => (
            <Select
              id={id}
              value={base}
              onChange={(valor) => setBase(valor as Exclude<SystemRole, "proprietario">)}
              options={BASES}
              disabled={editando}
              disabledReason="A base não muda depois de criada."
            />
          )}
        </Field>
        <fieldset>
          <legend className="rotulo">Módulos que o Papel libera</legend>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODULOS.map((modulo) => (
              <li key={modulo} className="flex items-center gap-3">
                <Toggle
                  checked={modulos.includes(modulo)}
                  onChange={(ligado) => alternar(modulo, ligado)}
                  labelledBy={`${prefixo}-${modulo}`}
                />
                <span id={`${prefixo}-${modulo}`} className="app-base">
                  {ROTULO_DO_MODULO[modulo]}
                </span>
              </li>
            ))}
          </ul>
          <p className="app-meta mt-2">No Financeiro, a pessoa também precisa alcançar a Pasta Financeiro.</p>
        </fieldset>
        {erro ? (
          <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
