"use client";

/**
 * O CARTÃO DA TAREFA CONVERSACIONAL (C35) — no quadro padrão
 * (`features/shell/quadro.tsx`), com a anatomia do card de Negócio desde o fim
 * de 2026-09-23 ("tudo que for quadro, a visualização deve ser igual à da
 * segunda imagem"). O Negócio é dinheiro, probabilidade, dono e origem; aqui é
 * QUEM (o rosto e o nome do Contato), O QUÊ (a Tarefa, com a call numa
 * Reunião, e o Canal, em pílulas, com o selo do provedor), a ÚLTIMA COISA DITA
 * (o destaque) e COM QUEM / PARA QUANDO (o rodapé).
 *
 * Fase 14 (3.3.3): quem é o Contato, qual é o Canal e qual foi a última Mensagem
 * vêm do RESUMO da api (`useResumoDaTarefa`), não do estado em memória. O cartão
 * não cai para a leitura antiga quando o resumo vem vazio (D-01): sem Contato
 * no resumo ele diz "Contato indisponível". A Empresa e a temperatura do Contato
 * saíram do cartão: o resumo não as carrega, e ler `state.contacts` por id seria
 * a ponte que a D-01 proíbe. O Responsável e o Tipo seguem do estado (a Tarefa os
 * guarda).
 */

import { CalendarClock, MessageSquare, User as UserIcon } from "lucide-react";
import { vinculosDoCrmDaTarefa } from "@n1/dominio/derive-conversacional";
import type { ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { useResumoDaTarefa } from "@/dados/crm/tarefas-conversacionais";
import { SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { iconeDoTipoNoQuadro } from "@/features/estrutura/icone-de-tipo";
import { CartaoDeQuadro } from "@/features/shell/quadro";
import { ActorAvatar, Esqueleto, Icone, Pilula } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** O rosto do Contato quando só se sabe o nome: as iniciais no círculo da marca (o resumo não traz foto). O nome vem escrito ao lado, por isso o rosto é decorativo. */
export function RostoDoContato({ nome, tamanho = "grande" }: { readonly nome: string; readonly tamanho?: "normal" | "grande" }) {
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${tamanho === "grande" ? "ed-subtitulo size-16" : "app-xs size-7"}`}
      style={{ background: "var(--degrade-marca)", color: "var(--sobre-degrade)" }}
    >
      {iniciais || "?"}
    </span>
  );
}

/** O Canal do resumo em pílulas: o nome da conta e o selo do provedor ("oficial", "não oficial", "IMAP/SMTP"). */
export function PilulasDoCanal({ canal }: { readonly canal: NonNullable<ResumoDaTarefaConversacional["canal"]> }) {
  return (
    <>
      <Pilula tom="neutro" className="max-w-full">
        <span className="min-w-0 truncate">{canal.nome}</span>
      </Pilula>
      <SeloDoProvedor canal={{ channelType: canal.tipo, provider: canal.provedor }} />
    </>
  );
}

export interface DadosDoCartaoConversacional {
  readonly task: Task;
  readonly responsavelNome?: string;
  readonly responsavelFotoId?: string;
  /** O Tipo da Tarefa, para o ícone dela (o de Reunião é a call: `iconeDoTipoNoQuadro`). */
  readonly tipo?: { readonly name: string; readonly icon: string };
}

/**
 * O que o cartão lê do estado — `undefined` sem Contato (aí é o cartão de Tarefa).
 * "Tem Contato" é a Tarefa apontar para um: o id vem do Vínculo, e quem é o
 * Contato (e se ele ainda existe) é o que o resumo da api responde.
 */
export function dadosDoCartaoConversacional(state: DataState, task: Task): DadosDoCartaoConversacional | undefined {
  if (vinculosDoCrmDaTarefa(state, task).contatoId === undefined) return undefined;
  const responsavel = task.assignees.find((a) => a.kind === "member");
  const membro = responsavel ? state.members.find((m) => m.id === responsavel.id) : undefined;
  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
  return {
    task,
    ...(membro ? { responsavelNome: membro.displayName } : {}),
    ...(membro?.photoFileId ? { responsavelFotoId: membro.photoFileId } : {}),
    ...(tipo ? { tipo: { name: tipo.name, icon: tipo.icon } } : {}),
  };
}

export function CartaoConversacional({
  data,
  onOpen,
  onDragStart,
  onDragEnd,
  recente = false,
}: {
  readonly data: DadosDoCartaoConversacional;
  readonly onOpen: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  /** O cartão que acabou de nascer ou mudar de coluna: acende em `--acento-lavado` e apaga (`useRecente`). */
  readonly recente?: boolean;
}) {
  const fmt = useFormat();
  const { task, responsavelNome, responsavelFotoId, tipo } = data;
  const doTipo = iconeDoTipoNoQuadro(tipo);
  // `undefined` = a resposta da api ainda não chegou (o esqueleto); um resumo com `null` é "a api não achou".
  const resumo = useResumoDaTarefa(task.id);
  const canal = resumo?.canal ?? null;
  const ultimaMensagem = resumo?.ultimaMensagem ?? null;
  return (
    <CartaoDeQuadro
      onOpen={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      recente={recente}
      rosto={
        resumo === undefined ? (
          <Esqueleto largura="4rem" altura="4rem" redondo />
        ) : (
          <RostoDoContato nome={resumo.contato?.nome ?? "Contato indisponível"} />
        )
      }
      titulo={resumo === undefined ? <Esqueleto largura="9rem" altura="1.1rem" /> : (resumo.contato?.nome ?? "Contato indisponível")}
      pilulas={
        <>
          {/* O quê: a Tarefa, com o ícone do Tipo (a call, numa Reunião). */}
          <Pilula tom="neutro" contorno className="max-w-full">
            <Icone de={doTipo.icone} tamanho="xs" style={{ color: doTipo.cor }} />
            <span className="min-w-0 truncate">{task.title}</span>
          </Pilula>
          {canal ? <PilulasDoCanal canal={canal} /> : null}
        </>
      }
      destaque={
        resumo === undefined
          ? { icone: MessageSquare, rotulo: "Última mensagem", valor: <Esqueleto largura="70%" altura="1rem" />, vazio: true }
          : ultimaMensagem
            ? { icone: MessageSquare, rotulo: "Última mensagem", valor: ultimaMensagem.trecho, complemento: fmt.relative(ultimaMensagem.criadoEm) }
            : { icone: MessageSquare, rotulo: "Última mensagem", valor: "Sem mensagem trocada ainda.", vazio: true }
      }
      rodape={[
        responsavelNome
          ? {
              icone: UserIcon,
              rotulo: "Responsável",
              avatar: <ActorAvatar kind="member" name={responsavelNome} {...(responsavelFotoId ? { photoFileId: responsavelFotoId } : {})} />,
              valor: responsavelNome,
            }
          : { icone: UserIcon, rotulo: "Responsável", valor: "Sem Responsável", vazio: true },
        { icone: CalendarClock, rotulo: "Prazo", valor: task.dueDate ? fmt.taskDate(task.dueDate) : "sem data", vazio: !task.dueDate },
      ]}
    />
  );
}
