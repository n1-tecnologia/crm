"use client";

/**
 * O CARTÃO DE TAREFA do quadro padrão (`features/shell/quadro.tsx`) — a Tarefa
 * que não é espelho de Negócio nem conversa com um Contato: as das Listas
 * operacionais, as das Contas (Financeiro) e, nas Listas conversacionais, a
 * Reunião ou a Tarefa à mão. Desde o fim de 2026-09-23, com a anatomia do card
 * de Negócio ("tudo que for quadro, a visualização deve ser igual à da segunda
 * imagem"): o rosto é o ícone do Tipo num círculo lavado (a call numa
 * Reunião; vermelho quando vencida, âmbar quando bloqueada); o título e o identificador; as pílulas da
 * prioridade, das Tags e dos alertas; o destaque — o PRAZO, ou numa Conta o
 * VALOR, com a contraparte no subtítulo —; e o rodapé — o responsável e o
 * progresso, ou numa Conta o vencimento e o responsável.
 */

import { CalendarClock, Flag, ListChecks, User as UserIcon, Users, Wallet } from "lucide-react";
import { checklistProgress, isBlocked, isOverdue, subtaskProgress } from "@/data/derive";
import { negocioDaTarefa } from "@/data/derive-conversacional";
import type { DataState } from "@/data/state";
import type { Task } from "@/data/types";
import { iconeDoTipoNoQuadro } from "@/features/estrutura/icone-de-tipo";
import type { FinanceProfile } from "@/features/estrutura/financeiro/lens";
import { valorDaConta } from "@/features/estrutura/financeiro/lens";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { CartaoDeQuadro, RostoDeIcone, type CampoDoCartao } from "@/features/shell/quadro";
import { ActorAvatar, ConditionMarker, Icone, Pilula, StateSeal } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

export function CartaoDeTarefa({
  state,
  task,
  financeiro,
  onOpen,
  onDragStart,
  onDragEnd,
  recente = false,
}: {
  readonly state: DataState;
  readonly task: Task;
  /** A lente financeira da Lista (Contas a pagar/receber): o subtítulo vira a contraparte, o destaque o valor, e o rodapé vencimento e responsável. */
  readonly financeiro?: FinanceProfile;
  readonly onOpen: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  readonly recente?: boolean;
}) {
  const fmt = useFormat();
  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
  const vencida = isOverdue(state, task, new Date());
  const bloqueada = isBlocked(state, task);
  const checklist = checklistProgress(task);
  const subtarefas = subtaskProgress(state, task.id);
  const negocio = tipo?.name === "Reunião" ? negocioDaTarefa(state, task) : undefined;
  const doTipo = iconeDoTipoNoQuadro(tipo);

  const membros = task.assignees.filter((a) => a.kind === "member");
  const primeiro = membros[0] ? state.members.find((m) => m.id === membros[0]!.id) : undefined;
  const responsavel: CampoDoCartao = primeiro
    ? {
        icone: membros.length > 1 ? Users : UserIcon,
        rotulo: membros.length > 1 ? "Responsáveis" : "Responsável",
        avatar: <ActorAvatar kind="member" name={primeiro.displayName} {...(primeiro.photoFileId ? { photoFileId: primeiro.photoFileId } : {})} />,
        valor: membros.length > 1 ? `${primeiro.displayName} +${membros.length - 1}` : primeiro.displayName,
      }
    : task.assignees.length > 0
      ? { icone: Users, rotulo: "Responsáveis", valor: `${task.assignees.length} responsável(is)` }
      : { icone: UserIcon, rotulo: "Responsável", valor: "Sem Responsável", vazio: true };

  // O progresso: as Subtarefas, senão o Checklist.
  const progresso: CampoDoCartao = subtarefas
    ? { icone: ListChecks, rotulo: "Subtarefas", valor: `${subtarefas.done} de ${subtarefas.total}` }
    : checklist
      ? { icone: ListChecks, rotulo: "Checklist", valor: `${checklist.done} de ${checklist.total}` }
      : { icone: ListChecks, rotulo: "Progresso", valor: "—", vazio: true };

  const prazo = task.dueDate ? fmt.taskDate(task.dueDate) : financeiro ? "sem vencimento" : "sem prazo";
  const tipoENome = [task.readableId, negocio ? `Reunião · ${negocio.title}` : tipo?.name].filter(Boolean).join(" · ");
  // A contraparte da Conta; o "—" do perfil (sem cliente) é marcador de TABELA,
  // não subtítulo — aí o cartão cai no identificador · Tipo (achado da revisão).
  const contraparte = financeiro?.counterpart(state, task).trim();
  const subtitulo = (financeiro && contraparte && contraparte !== "—" ? contraparte : tipoENome) || undefined;
  const temPilulas = task.priority !== "semPrioridade" || task.tagIds.length > 0 || vencida || bloqueada;

  return (
    <CartaoDeQuadro
      onOpen={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      recente={recente}
      rosto={
        <RostoDeIcone
          icone={doTipo.icone}
          cor={vencida ? "var(--erro)" : bloqueada ? "var(--aviso)" : doTipo.cor}
          lavado={vencida ? "var(--erro-lavado)" : bloqueada ? "var(--aviso-lavado)" : doTipo.lavado}
        />
      }
      titulo={task.title}
      subtitulo={subtitulo}
      selo={task.lifecycle !== "ativo" ? <StateSeal state={task.lifecycle} /> : undefined}
      pilulas={
        temPilulas ? (
          <>
            {task.priority !== "semPrioridade" ? (
              <Pilula tom="neutro" contorno>
                <Icone de={Flag} tamanho="xs" style={{ color: "var(--acento)" }} />
                {PRIORITY_LABEL[task.priority]}
              </Pilula>
            ) : null}
            {task.tagIds.map((id) => {
              const tag = state.tags.find((t) => t.id === id);
              return tag ? (
                <Pilula key={id} cor={tag.color}>
                  {tag.name}
                </Pilula>
              ) : null;
            })}
            {vencida ? <ConditionMarker tone="danger">Vencida</ConditionMarker> : null}
            {bloqueada ? <ConditionMarker tone="warning">Bloqueada</ConditionMarker> : null}
          </>
        ) : undefined
      }
      destaque={
        financeiro
          ? { icone: Wallet, rotulo: "Valor", valor: fmt.money({ amount: valorDaConta(task), currency: "BRL" }), cor: doTipo.cor }
          : {
              icone: CalendarClock,
              rotulo: "Prazo",
              valor: prazo,
              vazio: !task.dueDate,
              ...(vencida ? { cor: "var(--erro)", complemento: "vencida" } : {}),
            }
      }
      rodape={
        financeiro
          ? [{ icone: CalendarClock, rotulo: "Vencimento", valor: prazo, vazio: !task.dueDate }, responsavel]
          : [responsavel, progresso]
      }
    />
  );
}
