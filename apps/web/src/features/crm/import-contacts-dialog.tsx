"use client";

/**
 * D15 — Importar Contatos, aberto por `?importar-contatos=`.
 *
 * Quatro passos, e o terceiro é o que a ontologia exige que seja explícito: o
 * que fazer com uma linha cujo Identificador já pertence a alguém. Não existe
 * padrão silencioso aqui — importar sem escolher criaria duplicatas ou
 * sobrescreveria dados sem que ninguém tivesse decidido.
 *
 * O resultado nunca é só um número: os rejeitados vêm com o motivo por linha,
 * porque uma importação que "quase deu certo" sem dizer o que caiu é pior que
 * uma que falhou inteira.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { importContacts, type ImportOutcome, type ImportRow } from "@n1/dominio/operations";
import { ConfirmDialog, EmptyState, Field, ReguaDeSecao, Select, TextArea } from "@/features/shell/ui";
import type { ContactIdentifierType } from "@n1/dominio/types";

export const IMPORT_CONTACTS_PARAM = "importar-contatos";

export function useImportContactsDialog(): {
  readonly importing: boolean;
  readonly openImport: () => void;
  readonly closeImport: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    importing: query.has(IMPORT_CONTACTS_PARAM),
    openImport: () => {
      const next = new URLSearchParams(query.toString());
      next.set(IMPORT_CONTACTS_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeImport: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(IMPORT_CONTACTS_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

const IDENTIFIER_TYPES: ReadonlyArray<{ readonly value: ContactIdentifierType; readonly label: string }> = [
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "identidadeDeWhatsApp", label: "Identidade de WhatsApp" },
  { value: "usuarioDeInstagram", label: "Usuário de Instagram" },
];

/** Nome, Sobrenome, Identificador — uma linha por Contato, separada por vírgula. */
function parseRows(text: string, identifierType: ContactIdentifierType | ""): readonly ImportRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [firstName = "", lastName = "", identifierValue = ""] = line.split(",").map((c) => c.trim());
      return {
        firstName,
        ...(lastName ? { lastName } : {}),
        ...(identifierValue && identifierType
          ? { identifierType, identifierValue }
          : {}),
      };
    });
}

export function ImportContactsDialog({
  open,
  onClose,
  onDone,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [raw, setRaw] = useState("");
  const [identifierType, setIdentifierType] = useState<ContactIdentifierType | "">("telefone");
  const [onCollision, setOnCollision] = useState<"" | "rejeitar" | "atualizar">("");
  const [ownerMemberId, setOwnerMemberId] = useState("");
  const [originId, setOriginId] = useState("");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = parseRows(raw, identifierType);
  const room = state.workspace.limits.contacts - state.contacts.filter((c) => c.lifecycle !== "mesclado").length;

  const blockedReason =
    rows.length === 0
      ? "Cole ao menos uma linha."
      : onCollision === ""
        ? "Escolha o que fazer com as linhas que colidem — não há padrão."
        : undefined;

  const reset = () => {
    setRaw("");
    setOnCollision("");
    setOwnerMemberId("");
    setOriginId("");
    setOutcome(null);
    setError(null);
  };

  const confirm = () => {
    if (onCollision === "") return;
    const result = run((data, memberId) =>
      importContacts(data, memberId, rows, {
        onCollision,
        ...(ownerMemberId ? { ownerMemberId } : {}),
        ...(originId ? { originId } : {}),
      }),
    );
    if (result.ok) {
      setOutcome(result.value);
      setError(null);
      onDone(
        `Importação concluída: ${result.value.created} criados · ${result.value.updated} tratados como atualização · ${result.value.rejected.length} rejeitados.`,
      );
    } else {
      setError(result.error);
    }
  };

  // After running, the dialog stays open showing the balance — closing it on
  // success would throw away the list of rejected lines.
  if (outcome) {
    return (
      <ConfirmDialog
        open={open}
        title="Resultado da importação"
        description={`${outcome.created} criados · ${outcome.updated} tratados como atualização · ${outcome.rejected.length} rejeitados.`}
        confirmLabel="Concluir"
        cancelLabel="Importar mais"
        onConfirm={() => {
          reset();
          onClose();
        }}
        onCancel={reset}
      >
        <div className="grid gap-3">
          {outcome.stoppedAtLimit ? (
            <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
              A importação parou no Limite imposto de {state.workspace.limits.contacts} Contatos do Espaço
              de Trabalho. O balanço acima é parcial.
            </p>
          ) : null}

          {outcome.rejected.length === 0 ? (
            <EmptyState compact title="Nenhuma linha rejeitada." />
          ) : (
            <div>
              <ReguaDeSecao rotulo="Linhas rejeitadas, com o motivo" contagem={outcome.rejected.length} />
              {/* A lista rola junto com o corpo do diálogo: um segundo rolo aqui cortaria a sombra das peças. */}
              <ul className="pilha-solta">
                {outcome.rejected.map((rejection) => (
                  <li
                    key={`${rejection.line}-${rejection.value}`}
                    className="item-solto"
                    data-estatico="true"
                    data-alinhamento="topo"
                    style={{ paddingBlock: "var(--e-2)" }}
                  >
                    <span className="app-meta app-numero shrink-0">Linha {rejection.line}</span>
                    <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto-1)" }}>
                      {rejection.value} — {rejection.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      title="Importar Contatos"
      description="Cada linha é um Contato. Uma linha cujo Identificador já pertence a alguém nunca cria duplicata: ou é rejeitada, ou é tratada como atualização — e a escolha é sua."
      confirmLabel={`Importar ${rows.length} linha(s)`}
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field
          label="1 · Linhas"
          hint="Uma por linha: Nome, Sobrenome, Identificador — separados por vírgula."
        >
          {(id) => (
            <TextArea
              id={id}
              value={raw}
              onChange={setRaw}
              rows={5}
              placeholder={"Marina, Alves, +55 11 98888-0000\nJoão, Prado, joao@empresa.com.br"}
            />
          )}
        </Field>

        <Field label="Tipo do Identificador da terceira coluna">
          {(id) => (
            <Select
              id={id}
              value={identifierType}
              onChange={(value) => setIdentifierType(value as ContactIdentifierType | "")}
              placeholder="Sem Identificador"
              options={IDENTIFIER_TYPES.map((type) => ({ value: type.value, label: type.label }))}
            />
          )}
        </Field>

        <Field
          label="2 · Quando o Identificador já pertence a alguém"
          hint="Não há padrão: rejeitar perde a linha, atualizar sobrescreve o nome do Contato existente."
        >
          {(id) => (
            <Select
              id={id}
              value={onCollision}
              onChange={(value) => setOnCollision(value as "rejeitar" | "atualizar")}
              placeholder="Escolher"
              options={[
                { value: "rejeitar", label: "Rejeitar a linha", detail: "nada muda no existente" },
                {
                  value: "atualizar",
                  label: "Tratar como atualização",
                  detail: "sobrescreve o nome do existente",
                },
              ]}
            />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="3 · Proprietário dos criados" hint="Padrão: você.">
            {(id) => (
              <Select
                id={id}
                value={ownerMemberId}
                onChange={setOwnerMemberId}
                searchable
                placeholder="Você"
                options={state.members
                  .filter((member) => member.state === "ativo")
                  .map((member) => ({ value: member.id, label: member.displayName }))}
              />
            )}
          </Field>
          <Field label="Origem a atribuir">
            {(id) => (
              <Select
                id={id}
                value={originId}
                onChange={setOriginId}
                placeholder="Nenhuma"
                options={state.catalog
                  .filter((item) => item.kind === "origem" && item.lifecycle === "ativo")
                  .map((item) => ({ value: item.id, label: item.name }))}
              />
            )}
          </Field>
        </div>

        {rows.length > 0 ? (
          <div>
            <p className="rotulo">
              4 · Pré-visualização — {rows.length} linha(s), {room} vaga(s) no Limite do Espaço de
              Trabalho
            </p>
            {/* Prévia é grade colada, não peça solta: a densidade compacta da .tabela. */}
            <table className="tabela" data-densidade="compacta">
              <thead>
                <tr>
                  <th className="app-coluna">Nome</th>
                  <th className="app-coluna">Sobrenome</th>
                  <th className="app-coluna">Identificador</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, index) => (
                  <tr key={`${row.firstName}-${index}`}>
                    <td>{row.firstName}</td>
                    <td>{row.lastName ?? ""}</td>
                    <td>{row.identifierValue ?? <span style={{ color: "var(--texto-4)" }}>sem Identificador</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 3 ? (
              <p className="app-meta app-numero px-1 pt-2">… e mais {rows.length - 3} linha(s).</p>
            ) : null}
            {rows.length > room ? (
              <p className="app-base mt-2 rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
                Há mais linhas do que vagas: a importação para ao atingir o limite e devolve o balanço
                parcial.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
