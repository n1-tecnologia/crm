"use client";

/** Os controles do Construtor, na paleta da tela. */

import type { ReactNode } from "react";

const CAMPO =
  "w-full rounded-[9px] border border-[var(--ab-borda)] bg-[var(--ab-campo)] px-[14px] text-[14px] text-[var(--ab-texto)] outline-none transition-colors placeholder:text-[var(--ab-texto-3)] focus:border-[var(--ab-roxo)] focus-visible:border-[var(--ab-roxo)]";

export function BuilderInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--ab-texto-2)]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-[44px] ${CAMPO}`}
      />
    </div>
  );
}

export function BuilderInlineInput({
  ariaLabel,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  readonly ariaLabel: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`h-[40px] ${CAMPO}`}
    />
  );
}

/** Uma linha de escolha (rádio ou caixa) no estilo dos cards. */
export function ChoiceRow({
  type,
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  readonly type: "radio" | "checkbox";
  readonly name: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly label: string;
  readonly hint?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2 transition-colors ${
        checked
          ? "border-[var(--ab-roxo)] bg-[var(--ab-roxo-translucido)]"
          : "border-[var(--ab-borda)] hover:bg-[var(--ab-elevado)]"
      }`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--ab-roxo)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-[var(--ab-texto)]">{label}</span>
        {hint ? <span className="block text-[12px] text-[var(--ab-texto-3)]">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SmallAction({
  onClick,
  children,
  tone = "neutro",
  ariaLabel,
  disabledReason,
}: {
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly tone?: "neutro" | "roxo" | "perigo";
  readonly ariaLabel?: string;
  /** Presente = desligado, e o motivo vai no `title` e para o leitor de tela. */
  readonly disabledReason?: string;
}) {
  const disabled = disabledReason !== undefined;
  return (
    <button
      type="button"
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick();
      }}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      title={disabledReason}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)] ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : tone === "roxo"
            ? "bg-[var(--ab-roxo-translucido)] text-[var(--ab-roxo)] hover:bg-[rgba(169,112,255,0.2)]"
            : tone === "perigo"
              ? "text-[var(--ab-texto-2)] hover:bg-[var(--cor-perigo-fraco)] hover:text-[var(--cor-perigo)]"
              : "text-[var(--ab-texto-2)] hover:bg-[var(--ab-elevado)] hover:text-[var(--ab-texto)]"
      } ${disabled && tone === "roxo" ? "bg-[var(--ab-roxo-translucido)] text-[var(--ab-roxo)]" : ""}`}
    >
      {children}
      {disabled ? <span className="sr-only">. {disabledReason}</span> : null}
    </button>
  );
}
