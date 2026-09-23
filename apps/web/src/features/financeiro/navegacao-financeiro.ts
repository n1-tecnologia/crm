/**
 * O assunto "Financeiro" do trilho do CRM N1 (D4-08) — módulo de dados puro,
 * sem JSX e sem `"use client"`, para ser testado com Vitest sem jsdom.
 *
 * As oito leituras do financeiro-tria viram sub-rotas de `/financeiro`,
 * espelhando os caminhos de hoje. É assunto de primeiro nível do trilho, não
 * sub-item de outro assunto: quem opera o produto hoje é o Financeiro, e a
 * memória muscular dele é ativo.
 */

import {
  AlertTriangle,
  ClipboardCheck,
  LayoutDashboard,
  ListTree,
  Package,
  Receipt,
  Upload,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { memberReachesContainer } from "@n1/dominio/derive";
import { CP } from "@n1/dominio/operations/financeiro";
import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";

type Tela = {
  readonly href: string;
  readonly rotulo: string;
  readonly icone: LucideIcon;
  /** Casa também os descendentes: /financeiro/notas-fiscais/123 acenderia "Notas fiscais". */
  readonly prefixo?: boolean;
};

/**
 * As oito leituras, na ordem que o Financeiro já conhece. O Dashboard é a
 * raiz do assunto (`/financeiro`) e fica SEM `prefixo` — com `prefixo` ele
 * casaria todas as sub-rotas, o mesmo cuidado que o shell já registra para
 * `/ia/personalizar`.
 */
export const TELAS_DO_FINANCEIRO: ReadonlyArray<Tela> = [
  { href: "/financeiro", rotulo: "Dashboard", icone: LayoutDashboard },
  { href: "/financeiro/notas-fiscais", rotulo: "Notas fiscais", icone: Receipt, prefixo: true },
  { href: "/financeiro/produtos", rotulo: "Produtos", icone: Package, prefixo: true },
  { href: "/financeiro/plano-contas", rotulo: "Plano de contas", icone: ListTree, prefixo: true },
  { href: "/financeiro/extratos", rotulo: "Extratos do Marcos", icone: Upload, prefixo: true },
  { href: "/financeiro/workflows", rotulo: "Workflows", icone: Workflow, prefixo: true },
  { href: "/financeiro/problemas", rotulo: "Problemas", icone: AlertTriangle, prefixo: true },
  { href: "/financeiro/aprovacoes-pendentes", rotulo: "Aprovações pendentes", icone: ClipboardCheck, prefixo: true },
];

/** O sexto assunto do trilho (D4-08) — mesma forma de `Assunto` em `app-shell.tsx`. */
export const ASSUNTO_FINANCEIRO = {
  chave: "financeiro",
  rotulo: "Financeiro",
  icone: Wallet,
  telas: TELAS_DO_FINANCEIRO,
} as const;

/**
 * Decide só o que APARECE no trilho (D4-14): quem alcança a Pasta "Financeiro"
 * vê o assunto, quem não alcança não vê. Quem decide o que pode ser LIDO é o
 * 403 do `apps/api` em cada rota `/financeiro/*` — esconder o link aqui nunca
 * é controle de acesso, é só a consequência visual de um alcance que o
 * servidor já decidiu.
 */
export function vePastaFinanceiro(estado: DataState, memberId: Id | null | undefined): boolean {
  if (!memberId) return false;
  return memberReachesContainer(estado, memberId, "folder", CP.folderId);
}
