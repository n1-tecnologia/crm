"use client";

/**
 * NOVO FLOW (23, 12.1): Nome, Descrição, Categoria do provedor e o Canal
 * publicador. Nasce com a Versão 1 em rascunho e uma Tela; ao criar, a
 * pessoa vai direto ao construtor.
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { criarFlow } from "@n1/dominio/operations/ferramentas/flows";
import type { CategoriaDeFlow } from "@n1/dominio/types/ferramentas";
import { ConfirmDialog, Field, Select, TextArea, TextInput } from "@/features/shell/ui";
import { CATEGORIA_DE_FLOW_LABEL } from "./rotulos";

export function CriarFlowDialog({ open, onClose, onCreated }: { readonly open: boolean; readonly onClose: () => void; readonly onCreated: (flowId: string) => void }) {
  if (!open) return null;
  return <Formulario onClose={onClose} onCreated={onCreated} />;
}

function Formulario({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (flowId: string) => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDeFlow>("formularioDeCadastro");
  const [canalId, setCanalId] = useState(canais.find((c) => c.connection === "conectada")?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open
      title="Novo Flow"
      description="Um formulário que o Contato preenche dentro da conversa. Nasce em rascunho, com uma Tela; você monta o resto no construtor e publica pelo Canal."
      confirmLabel="Criar e abrir o construtor"
      {...(nome.trim() ? {} : { confirmDisabledReason: "Dê um nome ao Flow." })}
      onConfirm={() => {
        const r = run((data, me) => criarFlow(data, me, { nome, descricao, categoria, ...(canalId ? { canalId } : {}) }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        onCreated(r.value.id);
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Agendamento da consulta" />}
        </Field>
        <Field label="Descrição" hint="Uso interno.">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Para que serve este Flow" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" required hint="Exigida pelo provedor na publicação.">
            {(id) => <Select id={id} value={categoria} onChange={(v) => setCategoria(v as CategoriaDeFlow)} options={(Object.keys(CATEGORIA_DE_FLOW_LABEL) as CategoriaDeFlow[]).map((c) => ({ value: c, label: CATEGORIA_DE_FLOW_LABEL[c] }))} />}
          </Field>
          <Field label="Canal publicador" hint="Pode ficar para depois; publicar exige um Canal conectado (RN-FLW-06).">
            {(id) => <Select id={id} value={canalId} onChange={setCanalId} placeholder="Escolher depois" options={[{ value: "", label: "Escolher depois" }, ...canais.map((c) => ({ value: c.id, label: c.name, detail: c.connection }))]} />}
          </Field>
        </div>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
