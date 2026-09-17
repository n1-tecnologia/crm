"use client";

import type { CSSProperties } from "react";
import { Building2, Contact, Handshake, Home, LayoutDashboard, ListTodo, MessageSquare, Workflow } from "lucide-react";
import { cn } from "./cn";
import { Icone } from "./icone";

/**
 * CARREGADOR DE ÍCONES — a espera no centro da tela.
 *
 * Um aro cônico no acento gira devagar; dentro dele, os ícones dos objetos do
 * produto (Início, Contatos, Empresas, Negócios, Tarefas, Conversas, Flows,
 * Painéis) se revezam, um de cada vez, subindo e saindo por cima — a
 * plataforma "passando as páginas" enquanto a tela não chega. Tudo CSS
 * (`.carregador*` em componentes.css): sem hooks, sem store, e é módulo de
 * CLIENTE só porque passa componentes de ícone (funções) ao `Icone` — um
 * módulo de servidor não pode fazê-lo, e o fallback do layout o renderiza no
 * servidor. O ciclo é `--carregador-n` × `--dur-icone`.
 *
 * Onde entra: no carregamento duro (dentro da casca em silhueta), na espera
 * da hidratação (sobre o esqueleto da família) e numa navegação que passa da
 * carência (`tardio`: só aparece depois de `--dur-1`, sem escurecer a tela
 * velha e sem tomar o ponteiro). Movimento reduzido: aro parado e o primeiro
 * ícone fixo — o rótulo `role=status` continua dizendo o estado.
 */

const ICONES = [Home, Contact, Building2, Handshake, ListTodo, MessageSquare, Workflow, LayoutDashboard] as const;

export function CarregadorDeIcones({
  rotulo = "Carregando…",
  tardio = false,
  className,
}: {
  readonly rotulo?: string;
  /** Espera a carência de `--dur-1` antes de aparecer: uma navegação curta nunca o mostra. */
  readonly tardio?: boolean;
  readonly className?: string;
}) {
  return (
    <div className={cn("carregador", className)} data-tardio={tardio ? "true" : undefined} role="status">
      <span className="carregador-aro" aria-hidden="true">
        <span className="carregador-icones">
          {ICONES.map((de, i) => (
            <Icone key={i} de={de} tamanho="md" className="carregador-icone" style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      </span>
      <span className="app-meta carregador-rotulo">{rotulo}</span>
    </div>
  );
}
