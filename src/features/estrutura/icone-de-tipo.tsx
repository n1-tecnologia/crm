"use client";

import {
  AtSign,
  Bot,
  Briefcase,
  CircleCheck,
  FileCheck,
  Flag,
  Layers,
  MessageSquare,
  Receipt,
  TriangleAlert,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";
import { Icone } from "@/features/shell/ui";

/**
 * O ÍCONE DE CADA TIPO — o mesmo em todo lugar.
 *
 * Um Tipo de Tarefa carrega o nome do seu ícone (`circle-check`, `receipt`,
 * `users`…) como dado. Aqui esse nome vira o componente do Lucide, num mapa só:
 * a ficha da Tarefa, a lista do Início e as Notificações mostram o mesmo
 * desenho para a mesma coisa, e um tipo novo com ícone desconhecido cai no
 * padrão em vez de sumir.
 */
const POR_NOME: Record<string, LucideIcon> = {
  "circle-check": CircleCheck,
  receipt: Receipt,
  users: Users,
  flag: Flag,
  "triangle-alert": TriangleAlert,
  briefcase: Briefcase,
};

export function iconeDeTipo(nome: string | undefined): LucideIcon {
  return (nome && POR_NOME[nome]) || CircleCheck;
}

export function iconeDaTarefa(state: DataState, task: Task): LucideIcon {
  return iconeDeTipo(state.taskTypes.find((t) => t.id === task.taskTypeId)?.icon);
}

/** A cor do ícone acompanha o que o tipo significa: conta é dinheiro, incidente é alerta. */
export function corDeTipo(nome: string | undefined): string {
  switch (nome) {
    case "receipt":
      return "var(--sucesso)";
    case "triangle-alert":
      return "var(--erro)";
    case "users":
      return "var(--info)";
    case "flag":
      return "var(--aviso)";
    default:
      return "var(--acento)";
  }
}

/** O fundo lavado da mesma família da cor — o ladrilho atrás do ícone. */
export function corLavadaDeTipo(nome: string | undefined): string {
  switch (nome) {
    case "receipt":
      return "var(--sucesso-lavado)";
    case "triangle-alert":
      return "var(--erro-lavado)";
    case "users":
      return "var(--info-lavado)";
    case "flag":
      return "var(--aviso-lavado)";
    default:
      return "var(--acento-lavado)";
  }
}

/** Os outros objetos que aparecem em listas mistas (Notificações, Início). */
export const ICONE_DE_OBJETO = {
  aprovacao: FileCheck,
  conversa: MessageSquare,
  negocio: Briefcase,
  mencao: AtSign,
  execucao: Bot,
  grupo: Users,
  comunidade: Layers,
  flow: Workflow,
} as const;

/**
 * O SELO: o ícone num ladrilho lavado, à esquerda de uma linha. É o que faz
 * uma lista mista (Notificações, Início) se ler de relance — uma Conta tem o
 * recibo verde, um Incidente o alerta vermelho, uma Conversa o balão.
 */
export function Selo({ icone, cor, lavado }: { readonly icone: LucideIcon; readonly cor: string; readonly lavado: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
      style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)", background: lavado, color: cor }}
    >
      <Icone de={icone} tamanho="sm" />
    </span>
  );
}

/** O Selo de uma Tarefa: o ícone e a cor do Tipo dela. Um tom de alerta sobrepõe a cor. */
export function SeloDaTarefa({ state, task, tom }: { readonly state: DataState; readonly task: Task; readonly tom?: "erro" | "aviso" }) {
  const nome = state.taskTypes.find((t) => t.id === task.taskTypeId)?.icon;
  const cor = tom === "erro" ? "var(--erro)" : tom === "aviso" ? "var(--aviso)" : corDeTipo(nome);
  const lavado = tom === "erro" ? "var(--erro-lavado)" : tom === "aviso" ? "var(--aviso-lavado)" : corLavadaDeTipo(nome);
  return <Selo icone={iconeDeTipo(nome)} cor={cor} lavado={lavado} />;
}
