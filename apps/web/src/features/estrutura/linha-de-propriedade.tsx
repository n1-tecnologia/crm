"use client";

import { Check, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icone } from "@/features/shell/ui";
import { dentroDaModalDoTopo } from "@/design/components";

/**
 * A LINHA DE PROPRIEDADE da ficha, no molde do ClickUp: ícone, rótulo e o
 * valor numa linha compacta. Ela não é um cartão nem tem caixa de edição à
 * vista — o editor só aparece quando se clica na linha, no lugar do valor, e
 * fecha com "Pronto", Esc ou um clique fora. Um clique numa linha que não
 * edita não faz nada, e a linha não finge que faria.
 *
 * O editor recebido já grava ao mudar (é o que os editores da Tarefa fazem);
 * a linha só decide QUANDO ele existe.
 */
export function LinhaDeProp({
  icone,
  rotulo,
  valor,
  controle,
  editor,
  editavel = false,
  motivo,
  obrigatorio = false,
  cor,
}: {
  readonly icone: LucideIcon;
  readonly rotulo: string;
  readonly valor?: ReactNode;
  /** Um controle que já é o valor (um menu de Status): fica no lugar dele, sem abrir nada. */
  readonly controle?: ReactNode;
  /** O controle de edição, mostrado no lugar do valor enquanto a linha está aberta. */
  readonly editor?: ReactNode;
  readonly editavel?: boolean;
  /** Por que não edita — vira o `title` da linha (§11). */
  readonly motivo?: string;
  readonly obrigatorio?: boolean;
  readonly cor?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  // Esc e clique fora fecham. O listener só existe enquanto a linha está aberta.
  // Esc é capturado (fase de captura, no documento) para que, dentro de um
  // popup, feche só a linha — e não o popup, que escuta na fase de borbulha.
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = raiz.current;
      // Um menu aberto dentro da linha (Select) fecha primeiro, no seu próprio Esc;
      // e uma modal por cima da linha fica com o Esc dela.
      if (el?.querySelector("[role=listbox]") || !dentroDaModalDoTopo(el)) return;
      e.stopPropagation();
      setAberta(false);
    };
    const aoClicar = (e: PointerEvent) => {
      const el = raiz.current;
      // Menus flutuantes dos seletores são filhos da linha: clique neles não fecha.
      if (!el || el.contains(e.target as Node)) return;
      // O campo grava no blur — e um campo desmontado não recebe blur. Então
      // o foco sai ANTES de a linha fechar, e o que foi digitado fica.
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement && el.contains(ativo)) ativo.blur();
      setAberta(false);
    };
    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoClicar);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoClicar);
    };
  }, [aberta]);

  const podeAbrir = editavel && editor !== undefined;

  return (
    <div
      ref={raiz}
      className="flex min-h-[2.25rem] items-center gap-3 rounded-[var(--r-controle)] px-2 transition-colors"
      style={aberta ? { background: "var(--superficie-2)" } : undefined}
      title={!podeAbrir && motivo ? motivo : undefined}
    >
      <Icone de={icone} tamanho="xs" style={{ color: cor ?? "var(--texto-4)" }} />
      <span className="app-meta w-40 shrink-0 truncate" style={{ color: "var(--texto-3)" }}>
        {rotulo}
      </span>
      {controle !== undefined ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 px-1">
          {controle}
          {obrigatorio ? <span className="app-coluna shrink-0">obrigatório</span> : null}
        </span>
      ) : aberta ? (
        <>
          <span className="min-w-0 flex-1">{editor}</span>
          <button type="button" onClick={() => setAberta(false)} className="btn-icone btn-icone-nu shrink-0" aria-label="Pronto" title="Pronto">
            <Icone de={Check} tamanho="xs" style={{ color: "var(--sucesso)" }} />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => podeAbrir && setAberta(true)}
          className={`app-base flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-controle)] px-2 py-1 text-left ${podeAbrir ? "hover:bg-[var(--superficie-hover)]" : "cursor-default"}`}
          style={{ color: "var(--texto)" }}
          aria-disabled={!podeAbrir}
        >
          <span className="min-w-0 flex-1 truncate">{valor}</span>
          {obrigatorio ? <span className="app-coluna shrink-0">obrigatório</span> : null}
        </button>
      )}
    </div>
  );
}
