"use client";

/**
 * NOVA FONTE (20, RN-CNH-04): URL ou Integração, adicionada por quem
 * administra a Coleção. A Envio manual ninguém adiciona — ela já veio com a
 * Coleção. Uma Fonte de Integração desconectada nasce `comErro` (20.6): o
 * diálogo avisa antes, não recusa.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { adicionarFonte, recusaNaColecao } from "@n1/dominio/operations";
import { CONNECTION_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

type Tipo = "url" | "integracao";
type Politica = "manual" | "periodica";

const ENDERECO_WEB = /^https?:\/\/\S+$/;

export function NovaFonteDialog({
  colecaoId,
  open,
  onClose,
  onDone,
}: {
  readonly colecaoId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, sourceId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [tipo, setTipo] = useState<Tipo>("url");
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [politica, setPolitica] = useState<Politica>("manual");
  const [intervalo, setIntervalo] = useState("24");
  const [erro, setErro] = useState<string | null>(null);

  const colecao = state.collections.find((c) => c.id === colecaoId);
  const integracao = state.integrations.find((i) => i.id === integrationId);
  const horas = Number(intervalo);

  const motivo = !colecao
    ? "Coleção não encontrada."
    : (recusaNaColecao(state, memberId, colecao, "administrar") ??
      (colecao.lifecycle !== "ativo"
        ? "Restaure a Coleção antes."
        : !nome.trim()
          ? "Dê um nome à Fonte."
          : tipo === "url" && !ENDERECO_WEB.test(endereco.trim())
            ? "O endereço da Fonte começa por http:// ou https://."
            : tipo === "integracao" && !integracao
              ? "Escolha a Integração."
              : politica === "periodica" && !(Number.isFinite(horas) && horas > 0)
                ? "A Política periódica precisa de um intervalo em horas maior que zero."
                : undefined));

  const reset = () => {
    setTipo("url");
    setNome("");
    setEndereco("");
    setIntegrationId("");
    setPolitica("manual");
    setIntervalo("24");
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, me) =>
      adicionarFonte(data, me, colecaoId, {
        kind: tipo,
        name: nome,
        config: tipo === "url" ? endereco : integrationId,
        updatePolicy: politica === "periodica" ? { kind: "periodica", intervalHours: horas } : { kind: "manual" },
      }),
    );
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(result.value.state === "comErro" ? `Fonte “${result.value.name}” adicionada com erro: ${result.value.lastUpdateResult ?? "Integração desconectada"}.` : `Fonte “${result.value.name}” adicionada.`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Nova Fonte"
      description="Uma Fonte alimenta a Coleção por Atualização; os Documentos que ela cria não são movidos para outra Coleção (RN-CNH-08). A Envio manual já existe e não se repete (RN-CNH-04)."
      confirmLabel="Adicionar Fonte"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" required>
            {(id) => (
              <Select
                id={id}
                value={tipo}
                onChange={(v) => setTipo(v as Tipo)}
                options={[
                  { value: "url", label: "Endereço web", detail: "captura periódica ou manual de uma página" },
                  { value: "integracao", label: "Integração", detail: "sincroniza o que a Integração expõe" },
                ]}
              />
            )}
          </Field>
          <Field label="Nome" required>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Documentação da API" />}
          </Field>
        </div>

        {tipo === "url" ? (
          <Field label="Endereço" required hint="Começa por http:// ou https://.">
            {(id) => <TextInput id={id} value={endereco} onChange={setEndereco} placeholder="https://…" />}
          </Field>
        ) : (
          <Field label="Integração" required hint="Uma Integração desconectada faz a Fonte nascer com erro (20.6); reconectar a reativa.">
            {(id) => (
              <Select
                id={id}
                value={integrationId}
                onChange={setIntegrationId}
                searchable
                placeholder="Escolher a Integração"
                options={state.integrations.map((i) => ({ value: i.id, label: i.name, detail: CONNECTION_LABEL[i.state] ?? i.state }))}
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Política de atualização" required>
            {(id) => (
              <Select
                id={id}
                value={politica}
                onChange={(v) => setPolitica(v as Politica)}
                options={[
                  { value: "manual", label: "Manual", detail: "atualiza quando alguém pede" },
                  { value: "periodica", label: "Periódica", detail: "atualiza a cada N horas" },
                ]}
              />
            )}
          </Field>
          {politica === "periodica" ? (
            <Field label="Intervalo em horas" required>
              {(id) => <TextInput id={id} type="number" value={intervalo} onChange={setIntervalo} placeholder="24" />}
            </Field>
          ) : null}
        </div>

        {tipo === "integracao" && integracao && integracao.state !== "conectada" ? (
          <p className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            A Integração {integracao.name} está {CONNECTION_LABEL[integracao.state] ?? integracao.state}: a Fonte nasce com erro e só volta a ativa quando a Integração reconectar (20.6).
          </p>
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
