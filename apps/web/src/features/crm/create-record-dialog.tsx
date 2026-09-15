"use client";

/**
 * Criar Contato, Empresa e Negócio — aberto por `?criar=`.
 *
 * Um diálogo só para as três famílias porque o formulário é o mesmo gesto e as
 * três telas de listagem chamam do mesmo jeito. O que muda entre elas é o
 * conjunto de campos, não o fluxo.
 *
 * Nenhuma validação mora aqui: o botão só sabe dizer o que falta preencher. Se
 * a criação é legítima quem decide é a operação — ela é a mesma para a
 * importação, para a Mensagem recebida e para este formulário.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { createCompany, createContact, createDeal } from "@n1/dominio/operations";
import { contactDisplayName } from "@n1/dominio/derive";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";
import { IDENTIFIER_TYPE_LABEL } from "@/features/shell/format";
import type { ContactIdentifierType } from "@n1/dominio/types";

export const CREATE_PARAM = "criar";

export type CrmFamily = "contato" | "empresa" | "negocio";

export function useCreateRecordDialog(family: CrmFamily): {
  readonly creating: boolean;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    creating: query.get(CREATE_PARAM) === family,
    openCreate: () => {
      const next = new URLSearchParams(query.toString());
      next.set(CREATE_PARAM, family);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeCreate: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(CREATE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

const IDENTIFIER_TYPES: readonly ContactIdentifierType[] = [
  "email",
  "telefone",
  "identidadeDeWhatsApp",
  "usuarioDeInstagram",
];

const TITULO: Record<CrmFamily, string> = {
  contato: "Novo Contato",
  empresa: "Nova Empresa",
  negocio: "Novo Negócio",
};

const DESCRICAO: Record<CrmFamily, string> = {
  contato:
    "Nome ou Identificador — um dos dois basta, e sem nenhum dos dois o Contato não é ninguém.",
  empresa: "Nome fantasia ou razão social — um dos dois basta.",
  negocio:
    "O Negócio nasce na primeira Etapa do Funil escolhido, e os Requisitos de entrada dessa Etapa valem já na criação.",
};

export function CreateRecordDialog({
  family,
  open,
  onClose,
  onCreated,
}: {
  readonly family: CrmFamily;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (id: string, message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [identifierType, setIdentifierType] = useState<ContactIdentifierType>("email");
  const [identifierValue, setIdentifierValue] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [valor, setValor] = useState("");
  const [originId, setOriginId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const empresasAtivas = state.companies.filter((c) => c.lifecycle === "ativo");
  const contatosAtivos = state.contacts.filter((c) => c.lifecycle === "ativo");
  const funisAtivos = state.funnels.filter((f) => f.lifecycle === "ativo");
  const origens = state.catalog.filter((c) => c.kind === "origem");
  const funil = funisAtivos.find((f) => f.id === funnelId);
  const primeiraEtapa = funil ? [...funil.stages].sort((a, b) => a.order - b.order)[0] : undefined;

  const limpar = () => {
    setNome("");
    setSobrenome("");
    setIdentifierValue("");
    setRazaoSocial("");
    setEmpresaId("");
    setContatoId("");
    setFunnelId("");
    setValor("");
    setOriginId("");
    setErro(null);
  };

  const faltando =
    family === "contato"
      ? nome.trim() === "" && identifierValue.trim() === ""
        ? "Informe o nome ou um Identificador."
        : undefined
      : family === "empresa"
        ? nome.trim() === "" && razaoSocial.trim() === ""
          ? "Informe o nome fantasia ou a razão social."
          : undefined
        : nome.trim() === ""
          ? "Dê um título ao Negócio."
          : funnelId === ""
            ? "Escolha o Funil."
            : undefined;

  const confirmar = () => {
    const resultado =
      family === "contato"
        ? run((data, memberId) =>
            createContact(data, memberId, {
              firstName: nome,
              lastName: sobrenome,
              identifierType,
              identifierValue,
              ...(empresaId ? { companyId: empresaId } : {}),
            }),
          )
        : family === "empresa"
          ? run((data, memberId) =>
              createCompany(data, memberId, { tradeName: nome, legalName: razaoSocial }),
            )
          : run((data, memberId) =>
              createDeal(data, memberId, {
                title: nome,
                funnelId,
                ...(empresaId ? { companyId: empresaId } : {}),
                ...(contatoId ? { contactId: contatoId } : {}),
                ...(valor.trim() ? { value: { amount: Number(valor), currency: "BRL" } } : {}),
                ...(originId ? { originId } : {}),
              }),
            );

    if (!resultado.ok) {
      setErro(resultado.error);
      return;
    }
    const criado = resultado.value;
    const rota =
      family === "contato"
        ? `/crm/contatos/${criado.id}`
        : family === "empresa"
          ? `/crm/empresas/${criado.id}`
          : `/crm/negocios/${criado.id}`;
    limpar();
    onCreated(rota, `${TITULO[family].replace("Novo ", "").replace("Nova ", "")} criado.`);
  };

  return (
    <ConfirmDialog
      open={open}
      title={TITULO[family]}
      description={DESCRICAO[family]}
      confirmLabel="Criar"
      {...(faltando ? { confirmDisabledReason: faltando } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        limpar();
        onClose();
      }}
    >
      <div className="grid gap-3">
        {erro ? (
          <p
            role="alert"
            className="app-base rounded-[var(--r-controle)] px-3 py-2"
            style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}
          >
            {erro}
          </p>
        ) : null}

        <Field
          label={
            family === "contato" ? "Nome" : family === "empresa" ? "Nome fantasia" : "Título"
          }
        >
          {(id) => <TextInput id={id} value={nome} onChange={setNome} />}
        </Field>

        {family === "contato" ? (
          <>
            <Field label="Sobrenome">
              {(id) => <TextInput id={id} value={sobrenome} onChange={setSobrenome} />}
            </Field>
            <Field label="Tipo de Identificador">
              {(id) => (
                <Select
                  id={id}
                  value={identifierType}
                  onChange={(v) => setIdentifierType(v as ContactIdentifierType)}
                  options={IDENTIFIER_TYPES.map((t) => ({
                    value: t,
                    label: IDENTIFIER_TYPE_LABEL[t] ?? t,
                  }))}
                />
              )}
            </Field>
            <Field
              label="Identificador"
              hint="Sem ele o Contato existe, mas não recebe nem envia Mensagem."
            >
              {(id) => (
                <TextInput id={id} value={identifierValue} onChange={setIdentifierValue} />
              )}
            </Field>
          </>
        ) : null}

        {family === "empresa" ? (
          <Field label="Razão social">
            {(id) => <TextInput id={id} value={razaoSocial} onChange={setRazaoSocial} />}
          </Field>
        ) : null}

        {family === "negocio" ? (
          <>
            <Field
              label="Funil"
              required
              {...(primeiraEtapa
                ? { hint: `O Negócio nasce na Etapa ${primeiraEtapa.name}.` }
                : {})}
            >
              {(id) => (
                <Select
                  id={id}
                  value={funnelId}
                  onChange={setFunnelId}
                  placeholder="Escolha o Funil"
                  options={funisAtivos.map((f) => ({ value: f.id, label: f.name }))}
                />
              )}
            </Field>
            <Field label="Contato" hint="Algumas Etapas exigem Contato já na entrada.">
              {(id) => (
                <Select
                  id={id}
                  value={contatoId}
                  onChange={setContatoId}
                  searchable
                  placeholder="Sem Contato"
                  options={contatosAtivos.map((c) => ({
                    value: c.id,
                    label: contactDisplayName(c),
                  }))}
                />
              )}
            </Field>
            <Field label="Valor em reais" hint="A Etapa Negociação exige valor.">
              {(id) => (
                <TextInput id={id} value={valor} onChange={setValor} type="number" />
              )}
            </Field>
            <Field label="Origem">
              {(id) => (
                <Select
                  id={id}
                  value={originId}
                  onChange={setOriginId}
                  placeholder="Sem Origem"
                  options={origens.map((o) => ({ value: o.id, label: o.name }))}
                />
              )}
            </Field>
          </>
        ) : null}

        {family !== "empresa" ? (
          <Field label="Empresa">
            {(id) => (
              <Select
                id={id}
                value={empresaId}
                onChange={setEmpresaId}
                searchable
                placeholder="Sem Empresa"
                options={empresasAtivas.map((c) => ({
                  value: c.id,
                  label: c.tradeName || c.legalName,
                }))}
              />
            )}
          </Field>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
