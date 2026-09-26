"use client";

/**
 * DAR ACESSO A UM AGENTE (20, 17.3): a Concessão vive na Coleção, e o Agente
 * a exibe como "Conhecimento acessível" — visão derivada (DO-CNH-12). Um dos
 * dois lados vem fixo: da ficha da Coleção, a Coleção; da ficha do Agente, o
 * Agente. `ver` é obrigatória; `criar` e `editar` são o que o produto pedir.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { concederColecao, recusaNaColecao, type AcaoDaConcessao } from "@n1/dominio/operations";
import { LIFECYCLE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, MultiSelect, Select } from "@/features/shell/ui";
import { GRANT_ACTION_LABEL } from "./rotulos";

const ACOES: readonly AcaoDaConcessao[] = ["ver", "criar", "editar"];

const DETALHE_DA_ACAO: Record<AcaoDaConcessao, string> = {
  ver: "consultar os Fragmentos em Contexto — obrigatória",
  criar: "adicionar Documentos por Ferramenta",
  editar: "criar Versões por Ferramenta",
};

export function ConcederColecaoDialog({
  colecaoId: colecaoFixa,
  agentId: agenteFixo,
  open,
  onClose,
  onDone,
}: {
  readonly colecaoId?: string;
  readonly agentId?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, grantId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [colecaoId, setColecaoId] = useState(colecaoFixa ?? "");
  const [agentId, setAgentId] = useState(agenteFixo ?? "");
  const [acoes, setAcoes] = useState<readonly string[]>(["ver"]);
  const [erro, setErro] = useState<string | null>(null);

  const colecoes = state.collections.filter((c) => c.lifecycle !== "naLixeira");
  const colecao = state.collections.find((c) => c.id === colecaoId);
  // Quem decide é quem administra a Coleção, não quem governa o Agente (17.3):
  // qualquer Agente fora da lixeira recebe acesso.
  const agentes = state.agents.filter((a) => a.lifecycle !== "naLixeira");
  const agente = state.agents.find((a) => a.id === agentId);
  const jaTem = colecao !== undefined && agente !== undefined && state.collectionGrants.some((g) => g.collectionId === colecao.id && g.agentId === agente.id);

  const recusaDaColecao = (c: (typeof colecoes)[number]): string | undefined => recusaNaColecao(state, memberId, c, "administrar");

  const motivo = !colecao
    ? "Escolha a Coleção."
    : (recusaDaColecao(colecao) ??
      (!agente
        ? "Escolha o Agente."
        : agente.lifecycle === "naLixeira"
          ? "Um Agente na lixeira não recebe acesso."
          : jaTem
            ? "Este Agente já tem acesso a esta Coleção: revogue e conceda de novo para mudar as ações."
            : !acoes.includes("ver")
              ? "Toda concessão a Agente inclui ver (17.3)."
              : undefined));

  const reset = () => {
    setColecaoId(colecaoFixa ?? "");
    setAgentId(agenteFixo ?? "");
    setAcoes(["ver"]);
    setErro(null);
  };

  const confirmar = () => {
    const actions = ACOES.filter((a) => acoes.includes(a));
    const result = run((data, me) => concederColecao(data, me, colecaoId, { agentId, actions }));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Acesso a “${colecao?.name ?? colecaoId}” concedido a ${agente?.name ?? agentId}.`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Dar acesso a um Agente"
      description="A Concessão é gravada na Coleção; no Agente ela aparece como Conhecimento acessível, visão derivada (DO-CNH-12). Na consulta, vale a interseção com quem delega (A9.3), avaliada a cada Ferramenta (B23)."
      confirmLabel="Conceder"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Coleção" required>
          {(id) => (
            <Select
              id={id}
              value={colecaoId}
              onChange={setColecaoId}
              searchable
              placeholder="Escolher a Coleção"
              disabled={colecaoFixa !== undefined}
              disabledReason="A Coleção é a desta ficha."
              options={colecoes.map((c) => {
                const recusa = recusaDaColecao(c);
                return {
                  value: c.id,
                  label: c.name,
                  detail: c.isPrivate ? "privada" : (LIFECYCLE_LABEL[c.lifecycle] ?? c.lifecycle),
                  ...(recusa ? { disabledReason: recusa } : {}),
                };
              })}
            />
          )}
        </Field>
        <Field label="Agente" required>
          {(id) => (
            <Select
              id={id}
              value={agentId}
              onChange={setAgentId}
              searchable
              placeholder="Escolher o Agente"
              disabled={agenteFixo !== undefined}
              disabledReason="O Agente é o desta ficha."
              options={agentes.map((a) => {
                const jaConcedido = colecao !== undefined && state.collectionGrants.some((g) => g.collectionId === colecao.id && g.agentId === a.id);
                return {
                  value: a.id,
                  label: a.name,
                  detail: LIFECYCLE_LABEL[a.lifecycle] ?? a.lifecycle,
                  ...(jaConcedido ? { disabledReason: "Já tem acesso a esta Coleção." } : {}),
                };
              })}
            />
          )}
        </Field>
        <Field label="Ações" required hint="Ver é obrigatória: sem ela não há consulta. Criar e editar só valem por Ferramenta com permissão.">
          {(id) => (
            <MultiSelect
              id={id}
              values={acoes}
              onChange={setAcoes}
              placeholder="Escolher as ações"
              options={ACOES.map((a) => ({ value: a, label: GRANT_ACTION_LABEL[a], detail: DETALHE_DA_ACAO[a] }))}
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
