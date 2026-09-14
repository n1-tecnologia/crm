"use client";

/**
 * T43 — Papéis.
 *
 * A9.4 — four system roles, immutable. B30 — a custom role declares one of them
 * as its base, and that base is a CEILING: the custom role never grants more
 * than it. The screen shows the ceiling next to every permission so the reading
 * is not "what I picked" but "what I am allowed to pick".
 */

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/data/store";
import { DeleteRoleDialog, useDeleteRoleDialog } from "@/features/configuracoes/delete-role-dialog";
import { Button, CorpoDeTela, EmptyState, PageHeader, Painel, Pilula, Section, Toast } from "@/features/shell/ui";

const ACTION_LABEL: Record<string, string> = {
  ver: "ver",
  comentar: "comentar",
  criar: "criar",
  editar: "editar",
  excluir: "excluir",
  administrar: "administrar",
  executar: "executar",
};

const SCOPE_LABEL: Record<string, string> = {
  registro: "registro",
  subarvore: "subárvore",
  proprios: "próprios",
};

const BASE_DESCRIPTION: Record<string, string> = {
  proprietario:
    "Um por Espaço de Trabalho, derivado de quem detém o Papel. Muda apenas por transferência de propriedade.",
  administrador: "Governa o Espaço de Trabalho: Membros, Papéis, Integrações e a lixeira.",
  membro: "Trabalha no que lhe é dado ver, cria dentro do que lhe é permitido.",
  convidado: "Acesso restrito ao que foi compartilhado com ele; não pode ser Proprietário de nada.",
};

export default function PapeisPage() {
  const state = useData((data) => data);
  const { deletingRoleId, openDeleteRole, closeDeleteRole } = useDeleteRoleDialog();
  const [notice, setNotice] = useState<string | null>(null);
  const system = state.roles.filter((role) => role.system);
  const custom = state.roles.filter((role) => !role.system);

  const holdersOf = (roleId: string): number =>
    state.members.filter((member) => member.roleId === roleId && member.state !== "removido").length;

  const renderRole = (role: (typeof state.roles)[number]) => (
    <li key={role.id}>
      <Painel>
        {/* O cabeçalho do painel é composto à mão porque carrega o selo do teto
            ao lado do nome — o CabecalhoDePainel só aceita título em texto. */}
        <div
          className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--linha)" }}
        >
          <div className="min-w-0">
            <h3 className="app-md flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
              {role.name}
              {role.system ? <Pilula tom="neutro">sistema</Pilula> : <Pilula tom="info">teto {role.base}</Pilula>}
            </h3>
            <p className="app-base mt-0.5" style={{ color: "var(--texto-3)" }}>
              {BASE_DESCRIPTION[role.base] ?? ""}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-3">
            <span className="app-meta app-numero">
              {holdersOf(role.id)} Membro(s) com este Papel
            </span>
            {!role.system ? (
              <Button variant="danger" size="sm" onClick={() => openDeleteRole(role.id)}>
                Excluir
              </Button>
            ) : null}
          </span>
        </div>

        <div className="p-3">
          {role.permissions.length === 0 ? (
            <EmptyState compact title="Nenhuma permissão declarada." />
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th className="app-coluna">Ação</th>
                  <th className="app-coluna">Tipo de Recurso</th>
                  <th className="app-coluna">Escopo</th>
                </tr>
              </thead>
              <tbody>
                {role.permissions.map((permission, index) => (
                  <tr key={`${permission.action}-${permission.resourceType}-${index}`}>
                    <td>{ACTION_LABEL[permission.action] ?? permission.action}</td>
                    <td>{permission.resourceType}</td>
                    <td>{SCOPE_LABEL[permission.scope] ?? permission.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {role.system ? (
            <p className="app-meta mt-2 px-1">
              Um Papel de sistema é imutável: nada aqui se edita.
            </p>
          ) : null}
        </div>
      </Painel>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Papéis"
        meta={`${system.length} de sistema · ${custom.length} personalizado(s)`}
      />

      <DeleteRoleDialog roleId={deletingRoleId} onClose={closeDeleteRole} onDone={setNotice} />

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}

        <Section title="Papéis de sistema" count={system.length}>
          <ul className="grid gap-3">{system.map(renderRole)}</ul>
        </Section>

        <Section title="Papéis personalizados" count={custom.length}>
          {custom.length === 0 ? (
            <EmptyState
              title="Nenhum Papel personalizado."
              hint="Um Papel personalizado declara um Papel de sistema como base e nunca ultrapassa o que essa base permite."
            />
          ) : (
            <ul className="grid gap-3">{custom.map(renderRole)}</ul>
          )}
        </Section>
      </CorpoDeTela>
    </div>
  );
}
