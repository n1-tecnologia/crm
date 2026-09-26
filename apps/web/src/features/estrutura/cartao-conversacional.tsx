"use client";

/**
 * O CARTÃO DA TAREFA CONVERSACIONAL (C35) — no quadro padrão
 * (`features/shell/quadro.tsx`), com a anatomia do card de Negócio desde o fim
 * de 2026-09-23 ("tudo que for quadro, a visualização deve ser igual à da
 * segunda imagem"). O Negócio é dinheiro, probabilidade, dono e origem; aqui é
 * QUEM (o rosto e a empresa do Contato — sem empresa, sem subtítulo), O QUÊ
 * (a Tarefa, com a call numa Reunião, e o Canal, em
 * pílulas, com a temperatura do Contato), a ÚLTIMA COISA DITA (o destaque) e
 * COM QUEM / PARA QUANDO (o rodapé). A Tarefa não guarda nada disso: tudo vem
 * dos Vínculos (derive-conversacional).
 */

import { CalendarClock, Flame, MessageSquare, User as UserIcon } from "lucide-react";
import { contactDisplayName, principalCompanyId } from "@n1/dominio/derive";
import { canalDaTarefa, contatoDaTarefa, ultimaMensagemDaTarefa } from "@n1/dominio/derive-conversacional";
import type { DataState } from "@n1/dominio/state";
import type { Channel, Contact, Message, Task } from "@n1/dominio/types";
import { ContactAvatar } from "@/features/crm/contact-card";
import { iconeDoTipoNoQuadro } from "@/features/estrutura/icone-de-tipo";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { CartaoDeQuadro } from "@/features/shell/quadro";
import { ActorAvatar, Icone, Pilula } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

export interface DadosDoCartaoConversacional {
  readonly task: Task;
  readonly contact: Contact;
  readonly empresa?: string;
  readonly channel?: Channel;
  readonly ultimaMensagem?: Message;
  readonly responsavelNome?: string;
  readonly responsavelFotoId?: string;
  /** O Tipo da Tarefa, para o ícone dela (o de Reunião é a call: `iconeDoTipoNoQuadro`). */
  readonly tipo?: { readonly name: string; readonly icon: string };
  readonly temperatura?: { readonly name: string; readonly color?: string };
}

/** Tudo o que o cartão mostra, lido uma vez do estado — `undefined` sem Contato (aí é o cartão de Tarefa). */
export function dadosDoCartaoConversacional(state: DataState, task: Task): DadosDoCartaoConversacional | undefined {
  const contact = contatoDaTarefa(state, task);
  if (!contact) return undefined;
  const channel = canalDaTarefa(state, task);
  const ultimaMensagem = ultimaMensagemDaTarefa(state, task);
  const responsavel = task.assignees.find((a) => a.kind === "member");
  const membro = responsavel ? state.members.find((m) => m.id === responsavel.id) : undefined;
  const empresaId = principalCompanyId(state, contact.id);
  const empresa = empresaId ? state.companies.find((c) => c.id === empresaId)?.tradeName : undefined;
  const temperatura = contact.temperatureId ? state.catalog.find((c) => c.id === contact.temperatureId) : undefined;
  const tipo = state.taskTypes.find((t) => t.id === task.taskTypeId);
  return {
    task,
    contact,
    ...(empresa ? { empresa } : {}),
    ...(channel ? { channel } : {}),
    ...(ultimaMensagem ? { ultimaMensagem } : {}),
    ...(membro ? { responsavelNome: membro.displayName } : {}),
    ...(membro?.photoFileId ? { responsavelFotoId: membro.photoFileId } : {}),
    ...(tipo ? { tipo: { name: tipo.name, icon: tipo.icon } } : {}),
    ...(temperatura ? { temperatura: { name: temperatura.name, ...(temperatura.color ? { color: temperatura.color } : {}) } } : {}),
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
  const { task, contact, empresa, channel, ultimaMensagem, responsavelNome, responsavelFotoId, tipo, temperatura } = data;
  const doTipo = iconeDoTipoNoQuadro(tipo);
  return (
    <CartaoDeQuadro
      onOpen={onOpen}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      recente={recente}
      rosto={<ContactAvatar contact={contact} size="grande" />}
      titulo={contactDisplayName(contact)}
      // A empresa DELE, como no card de Negócio — sem ela, nada: o nome do
      // Canal é a NOSSA conta (@institutoigoralves), e embaixo do nome do
      // Contato se leria como dele (achado da revisão); o Canal já está na pílula.
      subtitulo={empresa}
      pilulas={
        <>
          {/* O quê: a Tarefa, com o ícone do Tipo (a call, numa Reunião). */}
          <Pilula tom="neutro" contorno className="max-w-full">
            <Icone de={doTipo.icone} tamanho="xs" style={{ color: doTipo.cor }} />
            <span className="min-w-0 truncate">{task.title}</span>
          </Pilula>
          {channel ? <Pilula tom="neutro">{CHANNEL_TYPE_LABEL[channel.channelType] ?? channel.name}</Pilula> : null}
          {temperatura ? (
            <Pilula cor={temperatura.color ?? "var(--texto-3)"}>
              <Icone de={Flame} tamanho="xs" />
              {temperatura.name}
            </Pilula>
          ) : null}
        </>
      }
      destaque={
        ultimaMensagem
          ? { icone: MessageSquare, rotulo: "Última mensagem", valor: ultimaMensagem.content, complemento: fmt.relative(ultimaMensagem.createdAt) }
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
