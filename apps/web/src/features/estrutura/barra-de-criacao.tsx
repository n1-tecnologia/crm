"use client";

/**
 * A barra principal da página da Lista, por lente (Fase 10, 2.1.6). Moveu-se
 * para fora de `page.tsx` sem mudar comportamento:
 *
 * - **comum:** seletor de Tipo, campo «Nova Tarefa», «Criar», «De modelo» e, no
 *   fim, o que a página puser em `fim` (o botão de seleção em lote e, até o
 *   10-16, o de rodar a agenda);
 * - **conversacional:** só «Nova Tarefa» (a Tarefa nasce do Contato, no diálogo)
 *   e o `fim`;
 * - **espelhoComercial** (Meus negócios no CRM): só «Iniciar conversa»;
 * - **financeira:** a `FinanceToolbar` sempre visível, com o `fim` no fim dela, e
 *   o campo de nova conta só sob demanda, com «Cancelar».
 *
 * A recusa de criar (`criacaoRecusada`, a do domínio) chega pronta da página e é
 * aplicada a todo botão de criação daqui; o domínio é a barreira de verdade.
 */

import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { useData } from "@/dados/store";
import { BarraDeFiltros, Button, Icone } from "@/features/shell/ui";
import { SeletorDeTipoDeTarefa } from "@/features/estrutura/seletor-de-tipo";
import {
  FinanceToolbar,
  type FinanceFilters,
} from "@/features/estrutura/financeiro/contas-view";
import type { FinanceProfile } from "@/features/estrutura/financeiro/lens";

export type LenteDaBarra = "comum" | "conversacional" | "espelhoComercial" | "financeira";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

/** O campo de título («Nova Tarefa» / «Nome da nova conta») e o que ele dispara. */
export interface CampoDeCriacao {
  /** Financeira: o campo só existe sob demanda («Nova conta» ou `?nova-tarefa=1`). */
  readonly aberto: boolean;
  readonly titulo: string;
  readonly aoMudarTitulo: (titulo: string) => void;
  readonly tipo: string | undefined;
  readonly aoMudarTipo: (taskTypeId: string) => void;
  readonly aoCriar: () => void;
  readonly aoCriarDeModelo: () => void;
  /** Esc e «Cancelar» (só na financeira). */
  readonly aoCancelar: () => void;
  readonly autoFocar: boolean;
}

/** O que a `FinanceToolbar` precisa da página. */
export interface BarraFinanceira {
  readonly perfil: FinanceProfile;
  readonly filtros: FinanceFilters;
  readonly aoFiltrar: (next: FinanceFilters) => void;
  readonly aoAbrirFiltros: () => void;
  readonly filtrosAvancados: number;
}

export function BarraDeCriacao({
  lente,
  listId,
  criacaoRecusada,
  fim,
  aoIniciarConversa,
  aoNovaConversacional,
  campo,
  financeiro,
  report,
}: {
  readonly lente: LenteDaBarra;
  readonly listId: string;
  readonly criacaoRecusada?: string;
  /** O fim da barra: o botão de seleção em lote (e o de rodar a agenda, até o 10-16). */
  readonly fim?: ReactNode;
  readonly aoIniciarConversa: () => void;
  readonly aoNovaConversacional: () => void;
  readonly campo: CampoDeCriacao;
  /** Obrigatório na lente financeira. */
  readonly financeiro?: BarraFinanceira;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const desligada = criacaoRecusada !== undefined;

  if (lente === "espelhoComercial") {
    return (
      <BarraDeFiltros>
        <Button
          size="sm"
          variant="primary"
          onClick={aoIniciarConversa}
          icon={<Icone de={MessageSquare} tamanho="xs" />}
          disabled={desligada}
          disabledReason={criacaoRecusada ?? ""}
        >
          Iniciar conversa
        </Button>
      </BarraDeFiltros>
    );
  }

  if (lente === "conversacional") {
    // C35 — sem campo de título: a Tarefa nasce do Contato, no diálogo.
    return (
      <BarraDeFiltros>
        <Button
          size="sm"
          variant="primary"
          onClick={aoNovaConversacional}
          icon={<Icone de={MessageSquare} tamanho="xs" />}
          disabled={desligada}
          disabledReason={criacaoRecusada ?? ""}
        >
          Nova Tarefa
        </Button>
        <span className="flex-1" />
        {fim}
      </BarraDeFiltros>
    );
  }

  const financeira = lente === "financeira";
  return (
    <>
      {!financeira || campo.aberto ? (
        <BarraDeFiltros>
          <label className="sr-only" htmlFor="nova-tarefa">
            {financeira ? "Nome da nova conta" : "Título da nova Tarefa"}
          </label>
          <SeletorDeTipoDeTarefa state={state} listId={listId} value={campo.tipo} onChange={campo.aoMudarTipo} />
          <input
            id="nova-tarefa"
            value={campo.titulo}
            onChange={(event) => campo.aoMudarTitulo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") campo.aoCriar();
              if (event.key === "Escape" && financeira) campo.aoCancelar();
            }}
            placeholder={financeiro ? financeiro.perfil.labels.novaPlaceholder : "Nova Tarefa"}
            // O "+" da árvore chega aqui com `?nova-tarefa=1`: o campo já
            // recebe o foco, senão o atalho para no meio do caminho.
            autoFocus={campo.autoFocar}
            className="campo min-w-48 flex-1"
            style={{ height: "var(--controle-h-sm)", maxWidth: "28rem" }}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={campo.aoCriar}
            disabled={!campo.titulo.trim() || desligada}
            disabledReason={criacaoRecusada ?? "Escreva o título da Tarefa."}
          >
            Criar
          </Button>
          <Button
            size="sm"
            onClick={campo.aoCriarDeModelo}
            disabled={desligada}
            disabledReason={criacaoRecusada ?? ""}
          >
            De modelo
          </Button>
          {financeira ? (
            <Button size="sm" variant="ghost" onClick={campo.aoCancelar}>
              Cancelar
            </Button>
          ) : (
            <>
              <span className="flex-1" />
              {fim}
            </>
          )}
        </BarraDeFiltros>
      ) : null}

      {financeira && financeiro ? (
        <BarraDeFiltros>
          <FinanceToolbar
            listId={listId}
            profile={financeiro.perfil}
            filters={financeiro.filtros}
            onFilters={financeiro.aoFiltrar}
            onOpenFilters={financeiro.aoAbrirFiltros}
            filtrosAvancados={financeiro.filtrosAvancados}
            fim={fim}
            report={report}
          />
        </BarraDeFiltros>
      ) : null}
    </>
  );
}
