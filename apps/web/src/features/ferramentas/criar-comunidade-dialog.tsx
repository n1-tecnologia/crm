"use client";

/**
 * NOVA COMUNIDADE — a Ferramenta `criar Comunidade` (25, 12.1): Nome,
 * Descrição, Canal e as duas Configurações. O provedor cria a comunidade E
 * o grupo de avisos; a plataforma grava os dois.
 */

import { useState } from "react";
import { Layers, UserPlus } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { CONFIGURACOES_PADRAO_DA_COMUNIDADE, criarComunidade, recusaDoCanal } from "@n1/dominio/operations";
import type { ConfiguracoesDaComunidade } from "@n1/dominio/types";
import { ConfirmDialog, Field, Select, TextArea, TextInput } from "@/features/shell/ui";
import { CaixaDeConfiguracoes } from "./caixa-de-configuracoes";
import { CONFIGURACAO_DA_COMUNIDADE_LABEL } from "./rotulos";

export function CriarComunidadeDialog({ open, onClose, onCreated }: { readonly open: boolean; readonly onClose: () => void; readonly onCreated: (comunidadeId: string) => void }) {
  if (!open) return null;
  return <Formulario onClose={onClose} onCreated={onCreated} />;
}

const ICONE = { somenteAdministradoresAdicionamGrupos: Layers, somenteAdministradoresAdicionamParticipantes: UserPlus } as const;

function Formulario({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (comunidadeId: string) => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const canais = state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [canalId, setCanalId] = useState(canais.find((c) => c.connection === "conectada")?.id ?? "");
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesDaComunidade>(CONFIGURACOES_PADRAO_DA_COMUNIDADE);
  const [erro, setErro] = useState<string | null>(null);
  const recusaCanal = recusaDoCanal(state, canalId || undefined, "comunidades");
  const motivo = !nome.trim() ? "Dê um nome à Comunidade." : recusaCanal;

  return (
    <ConfirmDialog
      open
      title="Nova Comunidade"
      description="O provedor cria a comunidade e o Grupo de avisos juntos; a plataforma grava os dois. Depois, vincule Grupos existentes ou crie Grupos já dentro dela."
      confirmLabel="Criar Comunidade"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        const r = run((data, me) => criarComunidade(data, me, { nome, descricao, canalId, configuracoes }));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        onCreated(r.value.comunidade.id);
      }}
      onCancel={onClose}
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Alunos Full Face" />}
          </Field>
          <Field label="Canal administrador" required>
            {(id) => (
              <Select
                id={id}
                value={canalId}
                onChange={setCanalId}
                placeholder="Escolher o Canal"
                options={canais.map((c) => {
                  const r = recusaDoCanal(state, c.id, "comunidades");
                  return { value: c.id, label: c.name, detail: c.connection === "conectada" ? "conectado" : c.connection, ...(r ? { disabledReason: r } : {}) };
                })}
              />
            )}
          </Field>
        </div>
        <Field label="Descrição">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} rows={2} placeholder="Para que serve esta Comunidade" />}
        </Field>
        <CaixaDeConfiguracoes
          rotulo="Configurações da Comunidade"
          linhas={(Object.keys(CONFIGURACAO_DA_COMUNIDADE_LABEL) as Array<keyof ConfiguracoesDaComunidade>).map((chave) => ({
            chave,
            titulo: CONFIGURACAO_DA_COMUNIDADE_LABEL[chave].titulo,
            dica: CONFIGURACAO_DA_COMUNIDADE_LABEL[chave].dica,
            icone: ICONE[chave],
            ligado: configuracoes[chave],
            onChange: (v) => setConfiguracoes((atual) => ({ ...atual, [chave]: v })),
          }))}
          ajuda="Valem no provedor; a plataforma não as copia para os Grupos (RN-COM-10)."
        />
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
