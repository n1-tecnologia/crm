"use client";

import { INSTRUCTIONS_MAX } from "./state";

export function AgentInstructions({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor="agente-instrucoes" className="text-[13px] font-medium text-[var(--ab-texto-2)]">
        Instruções
      </label>
      <div className="relative">
        <textarea
          id="agente-instrucoes"
          value={value}
          maxLength={INSTRUCTIONS_MAX}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Descreva como o seu agente deve se comportar, o que ele pode fazer e quais são seus objetivos..."
          className="h-[135px] w-full resize-y rounded-[9px] border border-[var(--ab-borda)] bg-[var(--ab-campo)] px-[14px] py-3 pb-7 text-[14px] leading-relaxed text-[var(--ab-texto)] outline-none transition-colors placeholder:text-[var(--ab-texto-3)] focus:border-[var(--ab-roxo)]"
        />
        <span
          aria-live="polite"
          className="pointer-events-none absolute bottom-2.5 right-3 text-[12px] tabular-nums text-[var(--ab-texto-3)]"
        >
          {value.length}/{INSTRUCTIONS_MAX}
        </span>
      </div>
    </div>
  );
}
