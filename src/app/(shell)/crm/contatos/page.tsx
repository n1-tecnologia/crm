"use client";

/**
 * T13 — Contatos.
 *
 * RN-CON-10 — a Suspeita de Duplicidade é derivada a cada leitura, nunca
 * gravada. Ela vive aqui, no índice, porque é onde se decide: ou o par é a
 * mesma pessoa (mesclar, D03) ou não é (Vínculo `distinto de`, que suprime a
 * suspeita para sempre). Sem este painel, mesclar exigiria adivinhar qual ficha
 * abrir.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { markContactsAsDistinct } from "@/data/operations";
import { Button, CorpoDeTela, EmptyState, PageHeader, Section, Toast } from "@/features/shell/ui";
import { useRouter } from "next/navigation";
import { CreateRecordDialog, useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import {
  ImportContactsDialog,
  useImportContactsDialog,
} from "@/features/crm/import-contacts-dialog";
import { ContactAvatar } from "@/features/crm/contact-card";
import { RecordList } from "@/features/shell/record-list";
import { StateSeal } from "@/features/shell/ui";
import {
  contactDisplayName,
  contactDisplayRole,
  duplicateSuspicions,
  principalCompanyId,
} from "@/data/derive";

export default function ContatosPage() {
  const state = useData((data) => data);
  const { importing, openImport, closeImport } = useImportContactsDialog();
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("contato");
  const router = useRouter();
  const run = useRun();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const suspicions = duplicateSuspicions(state);
  const items = state.contacts.filter((c) => c.lifecycle !== "naLixeira" && c.lifecycle !== "mesclado");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Contatos"
        meta={`${items.length} de ${state.workspace.limits.contacts} Contatos`}
        actions={
          <span className="flex items-center gap-2">
            <Button variant="secondary" onClick={openImport}>
              Importar Contatos
            </Button>
            <Button onClick={openCreate}>Novo Contato</Button>
          </span>
        }
      />

      <ImportContactsDialog open={importing} onClose={closeImport} onDone={setNotice} />
      <CreateRecordDialog
        family="contato"
        open={creating}
        onClose={closeCreate}
        onCreated={(rota) => router.push(rota)}
      />

      <CorpoDeTela semRespiro>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}

        <Section title="Suspeitas de Duplicidade" count={suspicions.length}>
          {suspicions.length === 0 ? (
            <EmptyState
              compact
              title="Nenhuma suspeita no momento."
              hint="A suspeita é calculada a cada leitura: nome idêntico, mesmo número em Tipos distintos, e-mail igual a menos de maiúsculas, ou rótulo de Canal igual ao Nome de outro Contato."
            />
          ) : (
            <ul className="pilha-solta">
              {suspicions.map((pair) => (
                /*
                  A peça não clica por inteiro: os nomes levam à ficha e os
                  botões decidem. O contorno na cor de atenção diz que é
                  suspeita, não fato.
                */
                <li
                  key={`${pair.a.id}-${pair.b.id}`}
                  className="item-solto"
                  data-bloco="true"
                  data-estatico="true"
                  style={{ borderColor: "var(--cor-atencao-traco)" }}
                >
                  <p className="app-base" style={{ color: "var(--texto)" }}>
                    <Link href={`/crm/contatos/${pair.a.id}`} className="app-md hover:underline">
                      {contactDisplayName(pair.a)}
                    </Link>{" "}
                    <span style={{ color: "var(--texto-3)" }}>e</span>{" "}
                    <Link href={`/crm/contatos/${pair.b.id}`} className="app-md hover:underline">
                      {contactDisplayName(pair.b)}
                    </Link>
                  </p>
                  <p className="app-meta mt-0.5">{pair.reasons.join(" · ")}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link href={`/crm/contatos/${pair.a.id}?mesclar=${pair.b.id}`} className="btn btn-contorno btn-sm">
                      Mesclar
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const result = run((data, memberId) =>
                          markContactsAsDistinct(data, memberId, pair.a.id, pair.b.id),
                        );
                        if (result.ok) {
                          setError(null);
                          setNotice(
                            `${contactDisplayName(pair.a)} e ${contactDisplayName(pair.b)} marcados como pessoas distintas. A suspeita não volta.`,
                          );
                        } else {
                          setNotice(null);
                          setError(result.error);
                        }
                      }}
                    >
                      Não são a mesma pessoa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <RecordList
          items={items}
          hrefOf={(item) => `/crm/contatos/${item.id}`}
          emptyTitle="Nenhum Contato ainda."
          emptyHint="Contatos também são criados automaticamente quando uma Mensagem chega por um Canal."
          columns={[
            {
              key: "nome",
              label: "Nome de exibição",
              // a foto vem junto do nome: é o que faz a linha ser reconhecida
              // de relance, antes de ler o texto
              render: (item) => (
                <span className="inline-flex min-w-0 items-center gap-2 align-middle">
                  <ContactAvatar contact={item} />
                  <span className="truncate">{contactDisplayName(item)}</span>
                </span>
              ),
            },
            { key: "cargo", label: "Cargo de exibição", render: (item) => contactDisplayRole(state, item.id) || "—" },
            { key: "empresa", label: "Empresa principal", render: (item) => state.companies.find((c) => c.id === principalCompanyId(state, item.id))?.tradeName ?? "—" },
            { key: "qualificacao", label: "Qualificação", render: (item) => state.catalog.find((c) => c.id === item.qualificationId)?.name ?? "—" },
            { key: "proprietario", label: "Proprietário", render: (item) => state.members.find((m) => m.id === item.ownerMemberId)?.displayName ?? "—" },
            { key: "estado", label: "Estado", render: (item) => <StateSeal state={item.lifecycle} /> },
          ]}
        />
      </CorpoDeTela>
    </div>
  );
}
