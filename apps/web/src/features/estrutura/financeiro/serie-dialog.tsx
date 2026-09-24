"use client";

/**
 * R1 sem Gestão contratual: a série "Entrada + N parcelas" de um cliente,
 * criada de uma vez (seção 5 de contas-a-receber.md). O diálogo só monta o
 * pedido; as regras (RN-CR-01, RN-CR-07, alcance) vivem em
 * `createReceivableSeries`, e a recusa aparece dentro do diálogo.
 */

import { useState } from "react";
import { contactDisplayName } from "@n1/dominio/derive";
import { CP, CR, createReceivableSeries } from "@n1/dominio/operations";
import { useData, useRun } from "@/dados/store";
import { ConfirmDialog, Field, RecordRow, Select, TextInput } from "@/features/shell/ui";
import type { Task } from "@n1/dominio/types";

const fmtMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * A MESMA checagem de `parseCivil` em
 * `packages/dominio/src/operations/financeiro.ts`: rejeita um `AAAA-MM-DD`
 * que o calendário não tem (ex.: 2026-02-30), porque o construtor nativo de
 * `Date`/`Date.parse` "resolveria" isso rolando para o mês seguinte — e o
 * preview não pode mostrar uma parcela que `createReceivableSeries` recusaria.
 */
function parseCivilLocal(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}

/**
 * O MESMO algoritmo de `addMonths` em
 * `packages/dominio/src/operations/collaboration.ts`, aplicado do jeito que
 * `createReceivableSeries` de fato chama: a partir de uma cópia FRESCA do
 * vencimento da 1ª parcela a cada iteração (`new Date(primeiro.getTime())`
 * seguido de `addMonths(due, n - 1)`), nunca encadeado a partir da parcela
 * anterior. É por isso que o dia 31 VOLTA em março (31/01 → 28/02 → 31/03) —
 * ver 05-12-SUMMARY.md para a leitura completa das duas implementações.
 */
function vencimentoDaParcelaLocal(primeiro: Date, mesesAFrente: number): Date {
  const dia = primeiro.getDate();
  const d = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1);
  d.setMonth(d.getMonth() + mesesAFrente);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d;
}

const INICIAL = {
  contactId: "",
  centroDeCusto: "",
  empresa: "",
  produto: "",
  forma: "Pix",
  valorEntrada: "",
  vencimentoEntrada: "",
  valorParcela: "",
  parcelas: "1",
  primeiroVencimento: "",
};

export function SerieDeParcelasDialog({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** As contas nasceram: quem chamou decide como mostrá-las (aviso com link, filtros). */
  readonly onCreated: (tasks: readonly Task[], clientName: string) => void;
}) {
  const run = useRun();
  const contatos = useData((data) =>
    data.contacts
      .filter((c) => c.lifecycle === "ativo")
      .map((c) => ({ value: c.id, label: contactDisplayName(c) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  );
  const opcoes = useData((data) => ({
    centro: data.fieldDefinitions.find((d) => d.id === CP.fields.centroDeCusto)?.options ?? [],
    empresa: data.fieldDefinitions.find((d) => d.id === CP.fields.empresa)?.options ?? [],
    produto: data.fieldDefinitions.find((d) => d.id === CR.fields.produto)?.options ?? [],
    forma: data.fieldDefinitions.find((d) => d.id === CR.fields.forma)?.options ?? [],
  }));
  const [form, setForm] = useState(INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const set = (patch: Partial<typeof INICIAL>) => {
    setForm((atual) => ({ ...atual, ...patch }));
    setErro(null);
  };
  const fechar = () => {
    setForm(INICIAL);
    setErro(null);
    onClose();
  };

  const parcelas = Number(form.parcelas);
  const valorParcela = Number(form.valorParcela.replace(",", "."));
  const valorEntrada = form.valorEntrada.trim() === "" ? undefined : Number(form.valorEntrada.replace(",", "."));
  const hoje = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const primeiroVencimentoData = form.primeiroVencimento ? parseCivilLocal(form.primeiroVencimento) : undefined;
  const vencimentoEntradaData = form.vencimentoEntrada ? parseCivilLocal(form.vencimentoEntrada) : undefined;
  const primeiroVencimentoInvalido = !!form.primeiroVencimento && (!primeiroVencimentoData || primeiroVencimentoData < hoje);
  const vencimentoEntradaInvalido = valorEntrada !== undefined && !!form.vencimentoEntrada && (!vencimentoEntradaData || vencimentoEntradaData < hoje);
  const vencimentoInvalido = primeiroVencimentoInvalido || vencimentoEntradaInvalido;
  const faltando = !form.contactId
    ? "Escolha o cliente."
    : !form.centroDeCusto
      ? "Escolha o Centro de Custo (RN-CR-01)."
      : !(valorParcela > 0)
        ? "Informe o valor da parcela."
        : !(Number.isInteger(parcelas) && parcelas >= 1)
          ? "Informe quantas parcelas."
          : !form.primeiroVencimento
            ? "Informe o vencimento da 1ª parcela."
            : valorEntrada !== undefined && !(valorEntrada > 0)
              ? "O valor da entrada precisa ser maior que zero, ou fique em branco."
              : valorEntrada !== undefined && !form.vencimentoEntrada
                ? "Informe o vencimento da entrada."
                : vencimentoInvalido
                  ? "Vencimento inválido: a 1ª parcela precisa vencer numa data real."
                  : undefined;
  const total = (valorEntrada ?? 0) + (valorParcela > 0 && parcelas > 0 ? valorParcela * parcelas : 0);
  const podeMostrarPreview = valorParcela > 0 && Number.isInteger(parcelas) && parcelas >= 1 && !!primeiroVencimentoData;
  const parcelasPreview =
    podeMostrarPreview && primeiroVencimentoData
      ? Array.from({ length: parcelas }, (_, indice) => ({
          numero: indice + 1,
          data: vencimentoDaParcelaLocal(primeiroVencimentoData, indice),
          valor: valorParcela,
        }))
      : [];
  const entradaPreview =
    podeMostrarPreview && valorEntrada !== undefined && valorEntrada > 0 && vencimentoEntradaData
      ? { data: vencimentoEntradaData, valor: valorEntrada }
      : undefined;

  return (
    <ConfirmDialog
      open={open}
      title="Nova série de parcelas"
      description="Cria de uma vez a Entrada (se houver) e cada parcela como contas “para receber”, com Vínculo ao cliente e o Financeiro como Responsável. Uma série sobre outra do mesmo cliente é recusada (RN-CR-07)."
      confirmLabel={parcelas >= 1 ? `Criar ${valorEntrada !== undefined ? "entrada + " : ""}${parcelas} parcela(s)` : "Criar série"}
      {...(faltando ? { confirmDisabledReason: faltando } : {})}
      onConfirm={() => {
        const result = run((data, me) =>
          createReceivableSeries(data, me, {
            contactId: form.contactId,
            centroDeCusto: form.centroDeCusto,
            ...(form.empresa ? { empresa: form.empresa } : {}),
            ...(form.produto ? { produto: form.produto } : {}),
            ...(form.forma ? { forma: form.forma } : {}),
            ...(valorEntrada !== undefined ? { valorEntrada, vencimentoEntrada: form.vencimentoEntrada } : {}),
            valorParcela,
            parcelas,
            primeiroVencimento: form.primeiroVencimento,
          }),
        );
        if (result.ok) {
          onCreated(result.value, contatos.find((c) => c.value === form.contactId)?.label ?? "o cliente");
          fechar();
        } else {
          setErro(result.error);
        }
      }}
      onCancel={fechar}
      wide
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
        <Field label="Cliente (Contato do CRM)">
          {(id) => <Select id={id} value={form.contactId} onChange={(contactId) => set({ contactId })} placeholder="Escolher cliente" options={contatos} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Centro de Custo">
            {(id) => <Select id={id} value={form.centroDeCusto} onChange={(centroDeCusto) => set({ centroDeCusto })} placeholder="Quem vendeu" options={opcoes.centro.map((o) => ({ value: o, label: o }))} />}
          </Field>
          <Field label="Empresa">
            {(id) => <Select id={id} value={form.empresa} onChange={(empresa) => set({ empresa })} placeholder="Quem fatura" options={opcoes.empresa.map((o) => ({ value: o, label: o }))} />}
          </Field>
          <Field label="Produto">
            {(id) => <Select id={id} value={form.produto} onChange={(produto) => set({ produto })} placeholder="Opcional" options={opcoes.produto.map((o) => ({ value: o, label: o }))} />}
          </Field>
          <Field label="Forma de recebimento">
            {(id) => <Select id={id} value={form.forma} onChange={(forma) => set({ forma })} placeholder="Opcional" options={opcoes.forma.map((o) => ({ value: o, label: o }))} />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor da entrada (R$)">
            {(id) => <TextInput id={id} value={form.valorEntrada} onChange={(valorEntrada) => set({ valorEntrada })} placeholder="Em branco: sem entrada" type="number" />}
          </Field>
          <Field label="Vencimento da entrada">
            {(id) => <input id={id} type="date" value={form.vencimentoEntrada} onChange={(event) => set({ vencimentoEntrada: event.target.value })} className="campo" />}
          </Field>
          <Field label="Valor de cada parcela (R$)">
            {(id) => <TextInput id={id} value={form.valorParcela} onChange={(valorParcela) => set({ valorParcela })} placeholder="Ex.: 20000" type="number" />}
          </Field>
          <Field label="Número de parcelas">
            {(id) => <TextInput id={id} value={form.parcelas} onChange={(parcelas) => set({ parcelas })} type="number" />}
          </Field>
          <Field label="Vencimento da 1ª parcela">
            {(id) => <input id={id} type="date" value={form.primeiroVencimento} onChange={(event) => set({ primeiroVencimento: event.target.value })} className="campo" />}
          </Field>
        </div>
        {podeMostrarPreview ? (
          <div className="max-h-48 overflow-y-auto rounded-[var(--r-controle)] px-3" style={{ background: "var(--superficie-1)" }}>
            <dl>
              {entradaPreview ? (
                <RecordRow label={`Entrada · ${fmtDataCurta.format(entradaPreview.data)}`}>
                  <span className="app-numero">{fmtMoeda.format(entradaPreview.valor)}</span>
                </RecordRow>
              ) : null}
              {parcelasPreview.map((parcela) => (
                <RecordRow key={parcela.numero} label={`${parcela.numero}ª parcela · ${fmtDataCurta.format(parcela.data)}`}>
                  <span className="app-numero">{fmtMoeda.format(parcela.valor)}</span>
                </RecordRow>
              ))}
            </dl>
          </div>
        ) : null}
        <p className="app-sm" style={{ color: "var(--texto-3)" }}>
          As parcelas seguintes vencem no mesmo dia dos meses seguintes. Total da série:{" "}
          <strong className="app-numero" style={{ color: "var(--texto)", fontWeight: 600 }}>
            {fmtMoeda.format(total)}
          </strong>
          .
        </p>
      </div>
    </ConfirmDialog>
  );
}
