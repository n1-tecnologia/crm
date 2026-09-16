"use client";

import Image from "next/image";

/**
 * Base components.
 *
 * As primitivas que as 61 telas consomem pelo barril `features/shell/ui`. A API
 * de cada uma é a de sempre; o DESENHO é o do design system do CRM-COMPLETO,
 * escrito nas classes de `estilos/controles.css` (`.btn`, `.campo`, `.pilula`,
 * `.flutuante`, `.item-menu`…) e nas escalas de `estilos/tipografia.css`.
 *
 * Toda cor aqui lê um token. Um hex, uma função de cor crua ou um raio literal quebra o
 * teste de `tokens.test.ts` — de propósito, porque o degrau de tela deixaria de
 * alcançá-lo e ninguém perceberia até abrir num monitor grande.
 *
 * Três regras dos PADRÕES TRANSVERSAIS são impostas pela estrutura, não por
 * convenção, porque convenção deriva em 61 telas:
 *   §2  — um SELO de ciclo de vida e um MARCADOR de condição derivada têm
 *         formas diferentes.
 *   §11 — um controle desligado SEMPRE diz por quê.
 *   §14 — "vazio" e "sem acesso" são componentes diferentes, de propósito.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Info,
  Lock,
  Maximize2,
  Minimize2,
  Search,
  X,
} from "lucide-react";
import { cn } from "./cn";
import { Icone } from "./icone";
import { Pilula } from "./basicos";

/* ------------------------------------------------------------------ button */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-solido",
  secondary: "btn-fantasma",
  danger: "btn-perigo",
  ghost: "btn-sutil",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  disabledReason,
  type = "button",
  icon,
  full = false,
  size = "md",
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  /** §11 — required whenever `disabled` can be true, or the user is left guessing. */
  readonly disabledReason?: string;
  readonly type?: "button" | "submit";
  readonly icon?: ReactNode;
  readonly full?: boolean;
  readonly size?: "sm" | "md";
}) {
  const reasonId = useId();
  /**
   * §11 — a disabled control ALWAYS says why, and `title` alone says it only to
   * a mouse. A natively disabled button takes no focus and announces no tooltip,
   * so the reason is kept reachable: the button stays focusable via
   * `aria-disabled`, the click is swallowed, and the text is announced through
   * `aria-describedby`.
   *
   * Swallowing `onClick` NÃO basta num `type="submit"`: sem `onClick` o clique
   * ainda submete o `<form>` pelo comportamento nativo do botão. Por isso o
   * evento é interceptado e cancelado.
   */
  return (
    <>
      <button
        type={type}
        onClick={
          disabled
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
              }
            : onClick
        }
        aria-disabled={disabled}
        {...(disabled && disabledReason ? { "aria-describedby": reasonId } : {})}
        title={disabled ? disabledReason : undefined}
        className={cn("btn alvo-toque", BUTTON_CLASS[variant], size === "sm" && "btn-sm", full && "w-full")}
      >
        {icon}
        {children}
      </button>
      {/*
        `hidden` e não `sr-only`: o `sr-only` do Tailwind é `position: absolute`,
        e sem ancestral posicionado ele se ancora no documento inteiro. Um nó
        `display: none` continua sendo lido pelo `aria-describedby`.
      */}
      {disabled && disabledReason ? (
        <span id={reasonId} hidden>
          {disabledReason}
        </span>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  /** Marca o campo como obrigatório antes do clique, não depois da recusa. */
  readonly required?: boolean;
  readonly children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      {/* ui-ptbr.md — every input has a visible label, never a placeholder standing in for one. */}
      <label htmlFor={id} className="rotulo">
        {label}
        {required ? (
          <span style={{ color: "var(--acento)" }} title="Obrigatório" aria-hidden>
            {" *"}
          </span>
        ) : null}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="ajuda" data-erro="true">
          {error}
        </p>
      ) : hint ? (
        <p className="ajuda">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  invalid = false,
  type = "text",
  disabled = false,
  disabledReason,
  size = "md",
}: {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly type?: "text" | "email" | "search" | "number";
  readonly disabled?: boolean;
  /** §11 — um controle desligado sempre diz por quê. */
  readonly disabledReason?: string;
  /** Numa barra de filtros todo controle tem a altura pequena; fora dela, a cheia. */
  readonly size?: "sm" | "md";
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid}
      readOnly={disabled}
      aria-disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className="campo alvo-toque"
      style={size === "sm" ? { height: "var(--controle-h-sm)" } : undefined}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled = false,
  disabledReason,
  autoGrow = false,
  maxHeight = 240,
}: {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly rows?: number;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** §11 — um controle desligado sempre diz por quê. */
  readonly disabledReason?: string;
  /** Cresce com o texto em vez de cortá-lo em `rows` linhas. */
  readonly autoGrow?: boolean;
  /** Teto em pixels: passado dele o campo rola por dentro. */
  readonly maxHeight?: number;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);

  /*
   * `field-sizing: content` resolve isto sem JavaScript, mas ainda não está em
   * todo navegador. Sem o reset para "auto" antes de medir, o campo só cresce e
   * nunca volta a encolher ao apagar texto.
   */
  useLayoutEffect(() => {
    const elemento = campo.current;
    if (!elemento || !autoGrow) return;
    if (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content")) return;
    elemento.style.height = "auto";
    elemento.style.height = `${Math.min(elemento.scrollHeight, maxHeight)}px`;
  }, [value, autoGrow, maxHeight]);

  return (
    <textarea
      ref={campo}
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      readOnly={disabled}
      aria-disabled={disabled}
      title={disabled ? disabledReason : undefined}
      style={autoGrow ? ({ fieldSizing: "content", maxHeight } as CSSProperties) : undefined}
      className="campo"
    />
  );
}

/* ------------------------------------------------- select, single and multi */

export interface Option {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly color?: string;
  /** §11 — an option that cannot be picked says why, instead of vanishing. */
  readonly disabledReason?: string;
}

function BuscaDeOpcoes({ query, onChange }: { readonly query: string; readonly onChange: (q: string) => void }) {
  return (
    <div className="relative" style={{ borderBottom: "1px solid var(--linha)" }}>
      <Icone de={Search} tamanho="xs" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--texto-4)" }} />
      <input
        autoFocus
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar"
        aria-label="Buscar opção"
        className="app-base w-full bg-transparent py-2 pl-9 pr-3 outline-none"
        style={{ color: "var(--texto)" }}
      />
    </div>
  );
}

export function Select({
  id,
  value,
  options,
  onChange,
  placeholder = "Escolher",
  searchable = false,
  disabled = false,
  disabledReason,
  size = "md",
}: {
  readonly id?: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /** Numa barra de filtros todo controle tem a altura pequena; fora dela, a cheia. */
  readonly size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(root, () => setOpen(false), open);

  const chosen = options.find((option) => option.value === value);
  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())) : options;

  const choose = (index: number) => {
    const option = shown[index];
    if (!option || option.disabledReason !== undefined) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };
  const { activeIndex, setActiveIndex, onKeyDown } = useListKeys(open, shown.length, choose);

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onKeyDown={onKeyDown}
        onClick={() => setOpen((current) => !current)}
        className="campo alvo-toque flex items-center justify-between gap-2 text-left"
        style={size === "sm" ? { height: "var(--controle-h-sm)" } : undefined}
      >
        <span className="flex min-w-0 items-center gap-2">
          {chosen?.color ? <span aria-hidden="true" className="pilula-ponto" style={{ background: chosen.color }} /> : null}
          <span className="truncate" style={{ color: chosen ? "var(--texto)" : "var(--texto-4)" }}>
            {chosen?.label ?? placeholder}
          </span>
        </span>
        <Icone de={ChevronDown} tamanho="xs" style={{ color: "var(--texto-4)" }} />
      </button>

      {open ? (
        <div className="flutuante surgir absolute z-20 mt-1 w-full overflow-hidden" style={{ minWidth: "12rem" }}>
          {searchable ? <BuscaDeOpcoes query={query} onChange={setQuery} /> : null}
          <ul id={listId} role="listbox" className="relative max-h-64 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <li className="app-meta px-2 py-3 text-center">Nenhuma opção corresponde a “{query}”.</li>
            ) : (
              shown.map((option, index) => (
                // role="none" — an `option` must be owned by the `listbox`; a
                // plain `li` in between breaks that relation.
                <li key={option.value} role="none">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${index}`}
                    tabIndex={-1}
                    aria-selected={option.value === value}
                    aria-disabled={option.disabledReason !== undefined}
                    title={option.disabledReason}
                    data-highlighted={index === activeIndex ? "" : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className="item-menu w-full"
                  >
                    {option.color ? <span aria-hidden="true" className="pilula-ponto" style={{ background: option.color }} /> : null}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.detail ? <span className="app-meta shrink-0">{option.detail}</span> : null}
                    {option.value === value ? <Icone de={Check} tamanho="xs" style={{ color: "var(--acento)" }} /> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function MultiSelect({
  id,
  values,
  options,
  onChange,
  placeholder = "Escolher",
  abrirParaCima = false,
}: {
  /** Required whenever a `Field` wraps it, or its `htmlFor` points at nothing. */
  readonly id?: string;
  readonly values: readonly string[];
  readonly options: readonly Option[];
  readonly onChange: (values: readonly string[]) => void;
  readonly placeholder?: string;
  /** Num compositor preso à base da tela o menu não tem para onde descer. */
  readonly abrirParaCima?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(root, () => setOpen(false), open);

  const shown = query ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())) : options;

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };
  const { activeIndex, setActiveIndex, onKeyDown } = useListKeys(open, shown.length, (index) => {
    const option = shown[index];
    if (option) toggle(option.value);
  });

  return (
    <div ref={root} className="relative">
      <div className="campo flex h-auto min-h-[var(--controle-h)] flex-wrap items-center gap-1 py-1">
        {values.length === 0 ? (
          <span className="app-base px-0.5" style={{ color: "var(--texto-4)" }}>
            {placeholder}
          </span>
        ) : (
          values.map((value) => {
            const option = options.find((o) => o.value === value);
            return (
              <Chip key={value} onRemove={() => toggle(value)} color={option?.color}>
                {option?.label ?? value}
              </Chip>
            );
          })
        )}
        <button
          id={id}
          type="button"
          onClick={() => setOpen((current) => !current)}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          onKeyDown={onKeyDown}
          aria-label="Abrir opções"
          className="ml-auto shrink-0 px-1"
        >
          <Icone de={ChevronDown} tamanho="xs" style={{ color: "var(--texto-4)" }} />
        </button>
      </div>

      {open ? (
        <div className={cn("flutuante surgir absolute z-20 w-full overflow-hidden", abrirParaCima ? "bottom-full mb-1" : "mt-1")}>
          <BuscaDeOpcoes query={query} onChange={setQuery} />
          <ul id={listId} role="listbox" aria-multiselectable="true" className="relative max-h-64 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <li className="app-meta px-2 py-3 text-center">Nenhuma opção corresponde a “{query}”.</li>
            ) : (
              shown.map((option, index) => {
                const marcada = values.includes(option.value);
                return (
                  <li key={option.value} role="none">
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-${index}`}
                      tabIndex={-1}
                      aria-selected={marcada}
                      data-highlighted={index === activeIndex ? "" : undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => toggle(option.value)}
                      className="item-menu w-full"
                    >
                      <span aria-hidden="true" className="caixa" data-state={marcada ? "checked" : undefined}>
                        {marcada ? <Icone de={Check} tamanho="xs" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- chip and seals */

export function Chip({
  children,
  onRemove,
  color,
}: {
  readonly children: ReactNode;
  readonly onRemove?: () => void;
  readonly color?: string;
}) {
  return (
    <Pilula {...(color ? { cor: color } : {})} className="gap-1.5">
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label="Remover" className="ml-0.5 opacity-60 hover:opacity-100">
          <Icone de={X} tamanho="xs" />
        </button>
      ) : null}
    </Pilula>
  );
}

const SEAL_TOKEN: Record<string, { readonly cor: string; readonly fundo: string; readonly rotulo: string }> = {
  arquivado: { cor: "var(--cor-selo-arquivado)", fundo: "var(--cor-selo-arquivado-fundo)", rotulo: "arquivado" },
  naLixeira: { cor: "var(--cor-selo-lixeira)", fundo: "var(--cor-selo-lixeira-fundo)", rotulo: "na lixeira" },
  mesclado: { cor: "var(--cor-selo-mesclado)", fundo: "var(--cor-selo-mesclado-fundo)", rotulo: "mesclado" },
  rascunho: { cor: "var(--cor-selo-rascunho)", fundo: "var(--cor-selo-rascunho-fundo)", rotulo: "rascunho" },
  pausado: { cor: "var(--cor-selo-pausado)", fundo: "var(--cor-selo-pausado-fundo)", rotulo: "pausado" },
  suspenso: { cor: "var(--cor-selo-pausado)", fundo: "var(--cor-selo-pausado-fundo)", rotulo: "suspenso" },
  encerrado: { cor: "var(--cor-selo-lixeira)", fundo: "var(--cor-selo-lixeira-fundo)", rotulo: "encerrado" },
  pendente: { cor: "var(--cor-selo-pendente)", fundo: "var(--cor-selo-pendente-fundo)", rotulo: "pendente" },
  removido: { cor: "var(--cor-selo-rascunho)", fundo: "var(--cor-selo-rascunho-fundo)", rotulo: "removido" },
};

/**
 * §2 — the record IS this. Rectangular, next to the name, and it only changes
 * by an act. `ativo` renders nothing: a seal on every record is a seal nobody
 * reads.
 */
export function StateSeal({ state }: { readonly state: string }) {
  if (state === "ativo") return null;
  const token = SEAL_TOKEN[state];
  if (!token) return null;
  return (
    <span
      className="selo"
      style={{ color: token.cor, background: token.fundo, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${token.cor} 20%, transparent)` }}
    >
      {token.rotulo}
    </span>
  );
}

/**
 * §2 — the record IS LIKE THIS NOW, and it clears itself when the cause ceases.
 * Deliberately a different shape from the seal.
 */
export function ConditionMarker({
  children,
  tone = "neutral",
  title,
}: {
  readonly children: ReactNode;
  readonly tone?: "neutral" | "warning" | "danger";
  readonly title?: string;
}) {
  // Uma caixa colorida, não um ponto: o estado se lê de longe, como uma Tag.
  const cor = tone === "danger" ? "var(--erro)" : tone === "warning" ? "var(--aviso)" : "var(--texto-3)";
  return (
    <Pilula cor={cor} title={title}>
      {children}
    </Pilula>
  );
}

/* ---------------------------------------------------- panel, dialog, toast */

export function SidePanel({
  title,
  open,
  onClose,
  children,
  footer,
  wide = false,
  bare = false,
  semRespiro = false,
}: {
  readonly title: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** O conteúdo distribui e rola por conta própria (a Tarefa completa): sem padding nem rolagem aqui. */
  readonly semRespiro?: boolean;
  /**
   * Mantido pela compatibilidade das chamadas: hoje todo popup de conteúdo
   * tem o mesmo tamanho, 80% da tela nos dois eixos, como no CRM-COMPLETO.
   */
  readonly wide?: boolean;
  /** O conteúdo traz o próprio cabeçalho e o botão de fechar. */
  readonly bare?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  // Tela cheia: o popup ocupa a janela inteira até ser restaurado (ou fechado).
  const [cheio, setCheio] = useState(false);
  useModal(open, onClose, panel, semRespiro ? "raiz" : "campo");
  void wide;
  if (!open) return null;
  /*
    POPUP DE CONTEÚDO, não gaveta. O registro (Conta, Tarefa, Negócio) abre no
    centro, em 80% da tela nos dois eixos — o mesmo popup do CRM-COMPLETO. A
    altura é FIXA, e não "até o conteúdo": um registro curto abriria uma casca
    de 80% com o rodapé colado no título, e um longo mudaria de tamanho ao
    trocar de aba. Quem chama distribui o conteúdo em colunas; a largura é
    para ser usada.

    Continua `fixed` sem portal: nenhum ancestral pode ter `transform` em
    repouso, senão o popup fica preso dentro dele.
  */
  return (
    <div className={cn("fixed inset-0 grid place-items-center", !cheio && "p-4")} style={{ zIndex: "var(--z-gaveta)" }}>
      <div className="veu absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("flutuante surgir relative flex w-full flex-col overflow-hidden", cheio && "rounded-none")}
        style={
          cheio
            ? { maxWidth: "100vw", height: "100vh", maxHeight: "100vh", background: "var(--card)" }
            : {
                maxWidth: "min(var(--popup-w), 96rem)",
                height: "var(--popup-h)",
                maxHeight: "calc(100vh - var(--e-8))",
                background: "var(--card)",
              }
        }
      >
        {bare ? null : (
          <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: "1px solid var(--linha)" }}>
            <h2 className="ed-subtitulo truncate">{title}</h2>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setCheio((atual) => !atual)}
                aria-label={cheio ? "Restaurar o tamanho" : "Tela cheia"}
                title={cheio ? "Restaurar o tamanho" : "Tela cheia"}
                aria-pressed={cheio}
                className="btn-icone btn-icone-nu"
              >
                <Icone de={cheio ? Minimize2 : Maximize2} />
              </button>
              <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar" className="btn-icone btn-icone-nu">
                <Icone de={X} />
              </button>
            </span>
          </header>
        )}
        <div className={cn("relative min-h-0 flex-1", semRespiro ? "flex flex-col" : "overflow-y-auto", !bare && !semRespiro && "px-6 py-5")}>{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--linha)" }}>
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * ux-flows.md — one confirmation mechanism in the whole product. `window.confirm`
 * here and a modal there is an inconsistency bug, so this component is the only
 * way a destructive action is confirmed.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  confirmDisabledReason,
  onConfirm,
  onCancel,
  footerStart,
  wide = false,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  /** When set, confirming is blocked and this says why. */
  readonly confirmDisabledReason?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Ação secundária à esquerda do rodapé — usar Template, por exemplo. */
  readonly footerStart?: ReactNode;
  /** Formulários com seções pedem mais largura que uma confirmação de uma frase. */
  readonly wide?: boolean;
  readonly children?: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModal(open, onCancel, dialog);
  if (!open) return null;
  return (
    <div className="fixed inset-0 grid place-items-center p-4" style={{ zIndex: "var(--z-modal)" }}>
      <div className="veu" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flutuante surgir relative flex max-h-[calc(100vh-2rem)] w-full flex-col"
        style={{ maxWidth: wide ? "var(--modal-lg)" : "var(--modal-sm)" }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ borderBottom: "1px solid var(--linha)" }}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="ed-subtitulo">
              {title}
            </h2>
            <p id={descriptionId} className="app-base mt-1" style={{ color: "var(--texto-2)" }}>
              {description}
            </p>
          </div>
          {/* Fechar no canto: o X é onde a mão vai primeiro, e Esc nem todo mundo tenta. */}
          <button type="button" onClick={onCancel} aria-label="Fechar" title="Fechar" className="btn-icone btn-icone-nu shrink-0">
            <Icone de={X} />
          </button>
        </div>

        {children ? <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}

        <div className="flex items-center justify-between gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--linha)" }}>
          <span className="min-w-0">{footerStart}</span>
          <span className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={confirmDisabledReason !== undefined}
              {...(confirmDisabledReason ? { disabledReason: confirmDisabledReason } : {})}
            >
              {confirmLabel}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

export type ToastTone = "success" | "error" | "neutral";

const TOAST_ICON: Record<ToastTone, typeof Check> = {
  success: CheckCircle2,
  error: AlertTriangle,
  neutral: Info,
};

const TOAST_COLOR: Record<ToastTone, string> = {
  success: "var(--sucesso)",
  error: "var(--erro)",
  neutral: "var(--info)",
};

export function Toast({
  tone,
  children,
  onDismiss,
}: {
  readonly tone: ToastTone;
  readonly children: ReactNode;
  readonly onDismiss?: () => void;
}) {
  return (
    <div
      // An error must interrupt the screen reader; a success must not.
      role={tone === "error" ? "alert" : "status"}
      // Sticky: the action that produced it may live far below the fold, and a
      // toast the person cannot see is no feedback at all.
      className="flutuante surgir sticky top-2 z-20 mb-3 flex items-center gap-3 px-4 py-3"
    >
      <Icone de={TOAST_ICON[tone]} style={{ color: TOAST_COLOR[tone] }} />
      <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
        {children}
      </span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dispensar aviso" className="shrink-0" style={{ color: "var(--texto-4)" }}>
          <Icone de={X} tamanho="xs" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------- empty / no access */

/** §14 — says WHAT this is and WHAT the next step is. Never a blank area. */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  compact = false,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
  readonly compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 py-6" : "gap-2 py-10")}>
      {icon ? (
        <span aria-hidden style={{ color: "var(--texto-4)", opacity: 0.6 }}>
          {icon}
        </span>
      ) : null}
      <p className={compact ? "app-base" : "app-md"} style={{ color: "var(--texto-1)" }}>
        {title}
      </p>
      {hint ? (
        <p className="app-meta" style={{ maxWidth: "28rem" }}>
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * §14 — "sem acesso" is NOT an empty state. The distinction has to be visual,
 * because the shape is read before the text: uma caixa fechada com cadeado, e
 * não um vazio centrado.
 */
export function NoAccessState({ what }: { readonly what: string }) {
  return (
    <div className="painel flex items-center gap-3 px-4 py-3">
      <Icone de={Lock} style={{ color: "var(--texto-4)" }} />
      <p className="app-base" style={{ color: "var(--texto-3)" }}>
        {what} · sem acesso
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ action menu */

export function ActionMenu({
  label = "Ações",
  trigger,
  items,
}: {
  readonly label?: string;
  /**
   * O que se clica para abrir. Sem isto o gatilho é o "⋯" padrão; com isto,
   * quem chama fornece o conteúdo do botão. Continua sendo UM `<button>`.
   */
  readonly trigger?: ReactNode;
  readonly items: ReadonlyArray<{
    readonly label: string;
    readonly onSelect: () => void;
    readonly destructive?: boolean;
    readonly disabledReason?: string;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(root, () => setOpen(false), open);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={trigger ? undefined : label}
        className={trigger ? "rounded-[var(--r-controle)]" : "btn-icone btn-icone-nu"}
      >
        {trigger ?? <Icone de={Ellipsis} />}
      </button>
      {open ? (
        <ul role="menu" className="flutuante surgir absolute right-0 z-30 mt-1 min-w-48 p-1">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabledReason !== undefined}
                title={item.disabledReason}
                data-destrutivo={item.destructive ? "true" : undefined}
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className="item-menu w-full"
              >
                <span className="min-w-0 flex-1">
                  <span className="block">{item.label}</span>
                  {item.disabledReason ? <span className="app-meta block">{item.disabledReason}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- avatar */

export type ActorKind = "member" | "agent" | "automation" | "integration" | "system";

const ACTOR_TOKEN: Record<
  ActorKind,
  { readonly cor: string; readonly tinta: string; readonly forma: string; readonly rotulo: string }
> = {
  member: { cor: "var(--cor-ator-membro)", tinta: "var(--cor-ator-texto)", forma: "rounded-full", rotulo: "Membro" },
  // B18 — an Agent acting "em nome de" a Member must never be mistaken for the
  // Member. The Agent gets a different SHAPE, not only a different colour.
  agent: { cor: "var(--cor-ator-agente)", tinta: "var(--cor-ator-texto)", forma: "rounded-[var(--r-caixa)]", rotulo: "Agente" },
  automation: { cor: "var(--cor-ator-automacao)", tinta: "var(--cor-ator-texto)", forma: "rounded-[var(--r-caixa)]", rotulo: "Automação" },
  integration: { cor: "var(--cor-ator-integracao)", tinta: "var(--cor-ator-texto)", forma: "rounded-[var(--r-caixa)]", rotulo: "Integração" },
  system: { cor: "var(--cor-ator-sistema)", tinta: "var(--cor-ator-sistema-texto)", forma: "rounded-[var(--r-caixa)]", rotulo: "Sistema" },
};

export function ActorAvatar({
  kind,
  name,
  size = "normal",
  photoFileId,
}: {
  readonly kind: ActorKind;
  readonly name: string;
  readonly size?: "normal" | "grande";
  /** Retrato em `public/membros/<id>.jpg`; sem ele ficam as iniciais. */
  readonly photoFileId?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const token = ACTOR_TOKEN[kind];
  const lado = size === "grande" ? "var(--avatar-md)" : "var(--avatar-sm)";

  /*
   * Só o Membro ganha retrato. B18 — um Agente não pode ser confundido com a
   * pessoa em nome de quem age, e a forma diferente é o que separa os dois.
   */
  if (kind === "member" && photoFileId && !falhou) {
    return (
      <Image
        src={`/membros/${photoFileId}.jpg`}
        alt={name}
        width={size === "grande" ? 36 : 24}
        height={size === "grande" ? 36 : 24}
        onError={() => setFalhou(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: lado, height: lado }}
      />
    );
  }
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      title={`${name} · ${token.rotulo}`}
      className={cn("grid shrink-0 place-items-center font-semibold", token.forma, size === "grande" ? "app-sm" : "app-xs")}
      style={{ background: token.cor, color: token.tinta, width: lado, height: lado }}
    >
      <span aria-hidden="true">{initials || "?"}</span>
      <span className="sr-only">
        {name}, {token.rotulo}
      </span>
    </span>
  );
}

/* -------------------------------------------------------- rich text editor */

/**
 * A deliberately small rich text editor: bold, italic and list, nothing more.
 * A Comment in this product is a paragraph.
 */
export function RichText({
  value,
  onChange,
  placeholder = "Escreva um comentário",
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}) {
  const wrap = (before: string, after: string) => onChange(`${value}${before}texto${after}`);
  return (
    <div className="rounded-[var(--r-controle)]" style={{ border: "1px solid var(--linha)", background: "var(--superficie-2)" }}>
      <div className="flex items-center gap-0.5 px-1 py-1" style={{ borderBottom: "1px solid var(--linha)" }}>
        <ToolbarButton label="Negrito" onClick={() => wrap("**", "**")}>
          <strong>N</strong>
        </ToolbarButton>
        <ToolbarButton label="Itálico" onClick={() => wrap("_", "_")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Lista" onClick={() => onChange(`${value}\n- item`)}>
          ≔
        </ToolbarButton>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={placeholder}
        aria-label={placeholder}
        className="app-base w-full resize-y bg-transparent px-3 py-2 outline-none"
        style={{ color: "var(--texto)" }}
      />
    </div>
  );
}

function ToolbarButton({ label, onClick, children }: { readonly label: string; readonly onClick: () => void; readonly children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn-icone btn-icone-nu app-sm">
      {children}
    </button>
  );
}

/* -------------------------------------------------------- activity timeline */

export interface ActivityEntry {
  readonly id: string;
  readonly at: string;
  readonly actorName: string;
  readonly actorKind: ActorKind;
  /** A6.2 — "em nome de", any actor kind (B18). */
  readonly delegateName?: string;
  readonly action: string;
  readonly before?: string;
  readonly after?: string;
  readonly detail?: string;
}

export function ActivityTimeline({ entries }: { readonly entries: readonly ActivityEntry[] }) {
  if (entries.length === 0) return <EmptyState compact title="Nenhum Registro de Atividade." />;
  return (
    <ol className="pilha-solta">
      {entries.map((entry) => (
        <li key={entry.id} className="item-solto" data-bloco="true" data-estatico="true">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 shrink-0 rounded-full"
              style={{ width: "0.5rem", height: "0.5rem", background: ACTOR_TOKEN[entry.actorKind].cor }}
            />
            <div className="min-w-0 flex-1">
              <p className="app-base" style={{ color: "var(--texto-1)" }}>
                <span style={{ fontWeight: 500, color: "var(--texto)" }}>{entry.actorName}</span>
                {entry.delegateName ? <span style={{ color: "var(--texto-3)" }}> em nome de {entry.delegateName}</span> : null}{" "}
                {entry.action}
                {entry.before || entry.after ? (
                  <span style={{ color: "var(--texto-3)" }}>
                    {" "}
                    ({entry.before ?? "—"} → {entry.after ?? "—"})
                  </span>
                ) : null}
              </p>
              <p className="app-meta">
                {entry.at}
                {entry.detail ? ` · ${entry.detail}` : ""}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------------------------- status / stage pickers */

export type StatusCategory = "naoIniciado" | "emAndamento" | "concluido" | "fechado";

export const CATEGORY_COLOR: Record<StatusCategory, string> = {
  naoIniciado: "var(--cor-cat-nao-iniciado)",
  emAndamento: "var(--cor-cat-em-andamento)",
  concluido: "var(--cor-cat-concluido)",
  fechado: "var(--cor-cat-fechado)",
};

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  naoIniciado: "não iniciado",
  emAndamento: "em andamento",
  concluido: "concluído",
  fechado: "fechado",
};

/**
 * A4.3 — the CATEGORY decides the closing, not the name, so the picker groups
 * by category and never hides it. §10 — a terminal status the List already
 * reproves comes disabled WITH the reason.
 */
export function StatusPicker({
  options,
  value,
  onChange,
  terminalBlockReason,
  readOnly = false,
  readOnlyReason,
  optionBlockReason,
}: {
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly category: StatusCategory;
    readonly color: string;
  }>;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly terminalBlockReason?: string;
  readonly readOnly?: boolean;
  readonly readOnlyReason?: string;
  /** Por opção: por que ESTA não pode ser escolhida agora. */
  readonly optionBlockReason?: (optionId: string) => string | undefined;
}) {
  // Um MENU, não uma parede de chips: o Status atual na sua caixa colorida e,
  // ao abrir, as opções na ordem do Conjunto, cada uma com a categoria. As que
  // não podem ser escolhidas continuam na lista e dizem por quê (§11).
  const isTerminal = (category: StatusCategory) => category === "concluido" || category === "fechado";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(root, () => setOpen(false), open);

  const current = options.find((option) => option.id === value);
  const reasonOf = (option: (typeof options)[number]): string | undefined => {
    if (option.id === value) return undefined;
    if (readOnly) return readOnlyReason || "Somente leitura.";
    const porOpcao = optionBlockReason?.(option.id);
    if (porOpcao !== undefined) return porOpcao;
    if (isTerminal(option.category) && terminalBlockReason !== undefined) return terminalBlockReason;
    return undefined;
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.id === value) {
      setOpen(false);
      return;
    }
    if (reasonOf(option) !== undefined) return;
    onChange(option.id);
    setOpen(false);
  };
  const { activeIndex, setActiveIndex, onKeyDown } = useListKeys(open, options.length, choose);

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        aria-disabled={readOnly}
        title={readOnly ? readOnlyReason || undefined : "Mudar o Status"}
        onKeyDown={readOnly ? undefined : onKeyDown}
        onClick={readOnly ? undefined : () => setOpen((atual) => !atual)}
        className={cn("flex items-center gap-1.5 rounded-[var(--r-controle)] py-0.5 pl-0.5 pr-1 transition-colors", !readOnly && "hover:bg-[var(--superficie-hover)]")}
      >
        {current ? (
          <Pilula cor={current.color}>{current.name}</Pilula>
        ) : (
          <span className="app-base" style={{ color: "var(--texto-4)" }}>
            sem Status
          </span>
        )}
        {!readOnly ? <Icone de={ChevronDown} tamanho="xs" style={{ color: "var(--texto-4)" }} /> : null}
      </button>

      {open ? (
        <div className="flutuante surgir absolute left-0 z-20 mt-1 overflow-hidden" style={{ minWidth: "16rem" }}>
          <ul id={listId} role="listbox" className="relative max-h-72 overflow-y-auto p-1">
            {options.map((option, index) => {
              const reason = reasonOf(option);
              const selected = option.id === value;
              return (
                <li key={option.id} role="none">
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-${index}`}
                    tabIndex={-1}
                    aria-selected={selected}
                    aria-disabled={reason !== undefined}
                    title={reason}
                    data-highlighted={index === activeIndex ? "" : undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                    className={cn("item-menu w-full", reason !== undefined && !selected && "opacity-50")}
                  >
                    <Pilula cor={option.color}>{option.name}</Pilula>
                    <span className="app-meta min-w-0 flex-1 truncate">{CATEGORY_LABEL[option.category]}</span>
                    {selected ? <Icone de={Check} tamanho="xs" style={{ color: "var(--acento)" }} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ hooks */

/** Verdadeiro se não há modal aberta, ou se `el` está dentro da modal mais interna. */
export function dentroDaModalDoTopo(el: Element | null): boolean {
  const modais = document.querySelectorAll('[aria-modal="true"]');
  const topo = modais[modais.length - 1];
  return !topo || (el !== null && topo.contains(el));
}

function useDismiss(ref: React.RefObject<HTMLElement | null>, close: () => void, open = true) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    // Na fase de CAPTURA: um menu aberto dentro de um popup fecha só o menu
    // com Esc — o popup (que escuta na fase de borbulha) não vê a tecla.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Se há uma modal por cima deste menu, o Esc é dela.
      if (!dentroDaModalDoTopo(ref.current)) return;
      event.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [ref, close, open]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * `aria-modal="true"` promises the screen reader that everything outside is
 * unreachable. Without focus management that promise is a lie.
 * So this moves focus in on open, keeps Tab inside, and gives focus back to
 * whatever opened it — plus Escape to close.
 */
function useModal(
  active: boolean,
  close: () => void,
  ref: React.RefObject<HTMLElement | null>,
  /** "campo": o 1º campo (um formulário). "raiz": o próprio diálogo (um registro
   *  inteiro, onde o 1º campo pode estar lá embaixo e rolaria tudo até ele). */
  focoInicial: "campo" | "raiz" = "campo",
) {
  // `close` costuma ser uma arrow nova a cada render. Ela vive num ref para que
  // o efeito abaixo rode UMA vez por abertura — se rodasse a cada render, cada
  // tecla digitada num campo devolveria o foco ao primeiro focável do diálogo.
  const fechar = useRef(close);
  useEffect(() => {
    fechar.current = close;
  }, [close]);
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // O foco inicial vai para o primeiro campo, se houver; senão para o primeiro
    // focável que não seja o "Fechar" do canto; senão para o próprio diálogo.
    const itens = focusables();
    const first =
      focoInicial === "raiz"
        ? undefined
        : (itens.find((el) => el.matches("input, textarea, select, [contenteditable]")) ??
          itens.find((el) => el.getAttribute("aria-label") !== "Fechar") ??
          itens[0]);
    if (first) first.focus({ preventScroll: true });
    else node?.focus({ preventScroll: true });
    // Só o diálogo MAIS INTERNO responde: o último `aria-modal` na ordem do
    // documento (um ConfirmDialog dentro do popup vem depois dele). A ordem de
    // montagem não serve — efeitos de filhos rodam antes dos de pais.
    const noTopo = () => {
      const abertos = document.querySelectorAll('[aria-modal="true"]');
      return abertos[abertos.length - 1] === node;
    };
    const onKey = (event: KeyboardEvent) => {
      if (!noTopo()) return;
      if (event.key === "Escape") {
        fechar.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      // Do próprio diálogo (foco na raiz), Tab vai ao primeiro e Shift+Tab ao último.
      if (document.activeElement === node) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [active, ref, focoInicial]);
}

/**
 * Arrow-key navigation for a popup list. The handler is attached to the
 * TRIGGER, not to `document`: focus stays on the trigger (that is what
 * `aria-activedescendant` is for).
 */
function useListKeys(
  open: boolean,
  count: number,
  onChoose: (index: number) => void,
): {
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  readonly onKeyDown: (event: React.KeyboardEvent) => void;
} {
  // Derived during render: an effect that only mirrors `open` into state would
  // cause a cascading render for nothing.
  const [highlight, setHighlight] = useState({ forOpen: false, index: 0 });
  const activeIndex = highlight.forOpen === open ? highlight.index : 0;
  const put = (index: number) => setHighlight({ forOpen: open, index });

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      put(count === 0 ? 0 : (activeIndex + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      put(count === 0 ? 0 : (activeIndex - 1 + count) % count);
    } else if (event.key === "Home") {
      event.preventDefault();
      put(0);
    } else if (event.key === "End") {
      event.preventDefault();
      put(Math.max(0, count - 1));
    } else if (event.key === "Enter" || event.key === " ") {
      if (count === 0) return;
      event.preventDefault();
      onChoose(activeIndex);
    }
  };

  return { activeIndex, setActiveIndex: put, onKeyDown };
}

/* ------------------------------------------------------------------ toggle */

/**
 * Interruptor. É um `<button role="switch">`, não uma caixa de seleção: a caixa
 * diz "vou marcar isto ao salvar", o interruptor diz "isto muda agora".
 */
export function Toggle({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="chave"
    >
      <span aria-hidden="true" className="chave-polegar" />
    </button>
  );
}

/* ------------------------------------------------------- linha de ajuste */

/**
 * Uma configuração que se lê fechada e se ajusta aberta: título, o valor
 * vigente por extenso, e o conteúdo que aparece ao expandir.
 */
export function SettingRow({
  icon,
  title,
  value,
  children,
}: {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly value: string;
  readonly children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="painel">
      <button
        type="button"
        onClick={() => children && setOpen((current) => !current)}
        aria-expanded={children ? open : undefined}
        aria-controls={children ? panelId : undefined}
        disabled={!children}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
      >
        {icon ? (
          <span
            className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
            style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)", background: "var(--superficie-3)", color: "var(--texto-3)" }}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="app-base block" style={{ color: "var(--texto)" }}>
            {title}
          </span>
          <span className="app-meta block truncate">{value}</span>
        </span>
        {children ? (
          <span className="seta-recolhe" data-aberto={open ? "true" : "false"}>
            <Icone de={ChevronDown} tamanho="xs" style={{ color: "var(--texto-4)", transform: "rotate(-90deg)" }} />
          </span>
        ) : null}
      </button>
      {children && open ? (
        <div id={panelId} className="px-3 py-3" style={{ borderTop: "1px solid var(--linha)" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------- painéis de ficha */

/**
 * Bloco de uma ficha: um título curto, a contagem e o conteúdo. A ficha do
 * Contato, a do Negócio e a da Empresa têm o mesmo esqueleto.
 */
export function RecordPanel({
  title,
  icon,
  count,
  action,
  defaultOpen = true,
  children,
}: {
  readonly title: string;
  /** O ícone identifica a caixa antes de a pessoa ler o título. */
  readonly icon?: ReactNode;
  readonly count?: number;
  readonly action?: ReactNode;
  /** Caixa auxiliar começa fechada; a principal, aberta. */
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="painel min-w-0">
      <div className="flex items-center gap-2 pr-2">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((atual) => !atual)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
          >
            {icon ? (
              <span className="shrink-0" style={{ color: "var(--acento)" }}>
                {icon}
              </span>
            ) : null}
            <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
              {title}
              {count !== undefined ? <span className="app-meta app-numero"> {count}</span> : null}
            </span>
            <Icone de={open ? ChevronUp : ChevronDown} tamanho="xs" style={{ color: "var(--texto-4)" }} />
          </button>
        </h2>
        {/* A ação fica FORA do botão que abre e fecha: um link dentro de um
            botão não é clicável de forma confiável. */}
        {action ? <span className="shrink-0">{action}</span> : null}
      </div>
      {open ? (
        <div id={bodyId} className="px-4 py-3" style={{ borderTop: "1px solid var(--linha)" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Uma linha rótulo→valor dentro de um `RecordPanel`. */
export function RecordRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="app-meta shrink-0">{label}</dt>
      <dd className="app-base min-w-0 truncate text-right" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}
