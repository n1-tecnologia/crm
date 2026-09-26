"use client";

/**
 * NOVA TAREFA CONVERSACIONAL — o diálogo de criação numa Lista de modelo
 * conversacional (C35). No lugar do título solto: o Membro escolhe o Contato,
 * o Canal por onde a conversa acontece, e opcionalmente o título, o Status
 * em que nasce, o Responsável e um Negócio do Contato. A Tarefa nasce com os
 * Vínculos e a Conversa (operations/tarefas-conversacionais).
 *
 * Serve à página da Lista (com `listId`) e à Caixa de Entrada / ficha do
 * Contato (sem `listId`, com o Contato e o Canal já dados): aí a Lista é a
 * primeira escolha — entre as conversacionais que NÃO espelham um Funil, porque
 * na cópia do Funil a Tarefa nasce pelo Negócio, por "Iniciar conversa".
 *
 * Quem hospeda renderiza sempre e controla por `open` (a saída de `--dur-1`
 * anima); cada abertura parte dos props de novo, derivado no render.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { LISTA_SEM_CANAIS, criarTarefaConversacional, funilDaLista } from "@n1/dominio/operations";
import { contactDisplayName, containerPath, effectiveListConfig, memberReachesContainer, tiposDaLista } from "@n1/dominio/derive";
import { canaisDaLista, canaisDaListaQueAlcancam, listaSemCanais } from "@n1/dominio/derive-conversacional";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

export function NovaTarefaConversacionalDialog({
  listId: listaFixa,
  open,
  statusId: statusInicial,
  contactId: contatoFixo,
  channelId: canalInicial,
  onClose,
  onDone,
}: {
  /** A Lista; ausente, o diálogo oferece as Listas conversacionais que o Membro alcança. */
  readonly listId?: string;
  /** Renderizado sempre; ao virar verdadeiro o formulário volta ao estado inicial dos props. */
  readonly open: boolean;
  /** O Status pré-escolhido (o "+" de um grupo ou coluna); ausente = o inicial. */
  readonly statusId?: string;
  /** O Contato já dado (Caixa de Entrada, ficha do Contato). */
  readonly contactId?: string;
  /** O Canal já dado (a Conversa aberta na Caixa de Entrada). */
  readonly channelId?: string;
  readonly onClose: () => void;
  readonly onDone: (message: string, taskId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();

  const [listId, setListId] = useState(listaFixa ?? "");
  const [contactId, setContactId] = useState(contatoFixo ?? "");
  const [channelId, setChannelId] = useState(canalInicial ?? "");
  const [titulo, setTitulo] = useState("");
  const [statusId, setStatusId] = useState(statusInicial ?? "");
  const [responsavelId, setResponsavelId] = useState(memberId);
  const [dealId, setDealId] = useState("");
  /** O Tipo da Tarefa; vazio = o padrão da Lista (o que o domínio faria sozinho). */
  const [taskTypeId, setTaskTypeId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Sem Lista dada: as conversacionais, ativas e ao alcance de quem cria —
  // menos as cópias do Funil, onde a Tarefa nasce do Negócio ("Iniciar conversa").
  const listas = listaFixa
    ? []
    : state.lists
        .filter((l) => l.lifecycle === "ativo" && l.modeloDeTarefa === "conversacional")
        .filter((l) => funilDaLista(state, l.id) === undefined)
        .filter((l) => memberReachesContainer(state, memberId, "list", l.id));
  // Só cópias do Funil ao alcance: a frase do campo desligado tem de dizer isso,
  // não mandar criar uma Lista que, aos olhos de quem lê, já existe.
  const soCopiasDoFunil =
    !listaFixa &&
    listas.length === 0 &&
    state.lists.some(
      (l) => l.lifecycle === "ativo" && l.modeloDeTarefa === "conversacional" && funilDaLista(state, l.id) !== undefined && memberReachesContainer(state, memberId, "list", l.id),
    );
  const contato = state.contacts.find((c) => c.id === contactId);
  // C36 — só os canais de atendimento DESTA Lista, e destes só os que alcançam o Contato.
  const canais = listId ? canaisDaListaQueAlcancam(state, listId, contato) : [];
  const semCanais = listId !== "" && listaSemCanais(state, listId);
  const config = listId ? effectiveListConfig(state, listId) : null;
  const statuses = config ? [...config.statusSet.definitions].sort((a, b) => a.order - b.order) : [];
  // Um Tipo só não é escolha: o campo some e a Tarefa nasce com ele.
  const tipos = listId ? tiposDaLista(state, listId) : [];
  const membros = state.members.filter((m) => m.state === "ativo");
  const negocios = contato
    ? state.deals.filter((d) => d.lifecycle === "ativo" && d.situation === "aberto" && d.contactLinks.some((l) => l.contactId === contato.id))
    : [];

  // Escolher o Contato traz o Canal quando só um o alcança; o Membro muda se souber melhor.
  const escolherContato = (id: string) => {
    setContactId(id);
    const alcancam = listId ? canaisDaListaQueAlcancam(state, listId, state.contacts.find((c) => c.id === id)) : [];
    setChannelId(alcancam.length === 1 && alcancam[0] ? alcancam[0].id : alcancam.some((ch) => ch.id === channelId) ? channelId : "");
    setDealId("");
  };
  // Trocar a Lista troca os canais possíveis: o Canal escolhido só fica se a Lista nova atende por ele.
  const escolherLista = (id: string) => {
    setListId(id);
    setStatusId("");
    const alcancam = canaisDaListaQueAlcancam(state, id, contato);
    setChannelId(alcancam.length === 1 && alcancam[0] ? alcancam[0].id : alcancam.some((ch) => ch.id === channelId) ? channelId : "");
  };
  const tiposDaListaEscolhida = (id: string) => [...new Set(canaisDaLista(state, id).map((ch) => CHANNEL_TYPE_LABEL[ch.channelType]))].join(" · ");

  const motivo = !listId ? "Escolha a Lista." : !contactId ? "Escolha o Contato." : !channelId ? "Escolha o Canal da conversa." : undefined;

  const reset = () => {
    setListId(listaFixa ?? "");
    setContactId(contatoFixo ?? "");
    setChannelId(canalInicial ?? "");
    setTitulo("");
    setStatusId(statusInicial ?? "");
    setResponsavelId(memberId);
    setDealId("");
    setTaskTypeId("");
    setErro(null);
  };

  // Cada abertura parte dos props (o Status do "+" do grupo, o Contato da
  // ficha, o Canal da Conversa): derivado no render quando `open` muda, como
  // `usePresenca` faz — nunca num efeito, que pintaria um quadro velho.
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) reset();
  }

  const confirmar = () => {
    const result = run((data, me) =>
      criarTarefaConversacional(data, me, {
        listId,
        contactId,
        channelId,
        ...(titulo.trim() ? { title: titulo.trim() } : {}),
        ...(statusId ? { statusId } : {}),
        ...(responsavelId ? { assignees: [{ kind: "member" as const, id: responsavelId }] } : {}),
        ...(dealId ? { dealId } : {}),
        ...(taskTypeId ? { taskTypeId } : {}),
      }),
    );
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    const criada = result.value.task;
    reset();
    onDone(`Tarefa criada: ${criada.title}.`, criada.id);
  };

  const caminhoDe = (id: string) =>
    containerPath(state, "list", id)
      .map((n) => n.name)
      .join(" › ");

  return (
    <ConfirmDialog
      open={open}
      title="Nova Tarefa"
      description="Escolha o Contato e o Canal — a Tarefa nasce com a conversa dele."
      confirmLabel="Criar"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        {listaFixa ? null : (
          <Field label="Lista" required hint="Só Listas conversacionais recebem esta Tarefa; numa cópia do Funil ela nasce pelo Negócio, em “Iniciar conversa”.">
            {(id) => (
              <Select
                id={id}
                value={listId}
                onChange={escolherLista}
                searchable
                placeholder={listas.length === 0 ? "Nenhuma Lista conversacional ao seu alcance" : "Escolher a Lista"}
                disabled={listas.length === 0}
                disabledReason={
                  soCopiasDoFunil
                    ? "Nas cópias do Funil a Tarefa nasce pelo Negócio, em “Iniciar conversa”: crie uma Lista conversacional própria."
                    : "Crie uma Lista com o modelo conversacional primeiro."
                }
                options={listas.map((l) => ({
                  value: l.id,
                  label: l.name,
                  // Por onde a Lista atende, dito antes de escolher; sem canais, não recebe Tarefa.
                  detail: listaSemCanais(state, l.id) ? `${caminhoDe(l.id)} · sem canais` : `${caminhoDe(l.id)} · ${tiposDaListaEscolhida(l.id)}`,
                  ...(listaSemCanais(state, l.id) ? { disabledReason: LISTA_SEM_CANAIS } : {}),
                }))}
              />
            )}
          </Field>
        )}

        <Field label="Contato" required hint="Com quem a conversa acontece.">
          {(id) => (
            <Select
              id={id}
              value={contactId}
              onChange={escolherContato}
              searchable
              placeholder="Escolher o Contato"
              disabled={contatoFixo !== undefined}
              disabledReason="O Contato é o desta conversa."
              options={state.contacts
                .filter((c) => c.lifecycle === "ativo")
                .map((c) => ({ value: c.id, label: contactDisplayName(c), detail: c.identifiers[0]?.displayValue ?? "" }))}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Canal" required hint="Por onde a conversa acontece.">
            {(id) => (
              <Select
                id={id}
                value={channelId}
                onChange={setChannelId}
                placeholder={
                  !listId
                    ? "Escolha a Lista primeiro"
                    : semCanais
                      ? "Esta Lista não tem canais de atendimento"
                      : contato && canais.length === 0
                        ? "Nenhum canal desta Lista alcança este Contato"
                        : "Escolher o Canal"
                }
                disabled={!listId || semCanais || (contato !== undefined && canais.length === 0)}
                disabledReason={
                  !listId
                    ? "Escolha a Lista primeiro."
                    : semCanais
                      ? LISTA_SEM_CANAIS
                      : "Nenhum canal desta Lista alcança este Contato: acrescente um Identificador a ele."
                }
                options={canais.map((c) => ({
                  value: c.id,
                  label: c.name,
                  detail: c.connection === "desconectada" ? "desconectado" : CHANNEL_TYPE_LABEL[c.channelType],
                }))}
              />
            )}
          </Field>
          <Field label="Título" hint={`Opcional. Vazio, fica “${contato ? contactDisplayName(contato) : "o nome do Contato"}”.`}>
            {(id) => <TextInput id={id} value={titulo} onChange={setTitulo} placeholder="Por exemplo: Enviar cronograma" />}
          </Field>
          {tipos.length > 1 ? (
            <Field label="Tipo de Tarefa" hint="O que esta Tarefa é. Sem escolher, nasce com o Tipo padrão da Lista.">
              {(id) => (
                <Select
                  id={id}
                  value={taskTypeId}
                  onChange={setTaskTypeId}
                  placeholder="O Tipo padrão da Lista"
                  options={[{ value: "", label: "O Tipo padrão da Lista" }, ...tipos.map((t) => ({ value: t.id, label: t.name }))]}
                />
              )}
            </Field>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" hint="Onde a Tarefa nasce.">
            {(id) => (
              <Select
                id={id}
                value={statusId}
                onChange={setStatusId}
                placeholder="O Status inicial da Lista"
                disabled={!listId}
                disabledReason="Escolha a Lista primeiro."
                options={[{ value: "", label: "O Status inicial da Lista" }, ...statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))]}
              />
            )}
          </Field>
          <Field label="Responsável">
            {(id) => (
              <Select
                id={id}
                value={responsavelId}
                onChange={setResponsavelId}
                searchable
                placeholder="Sem Responsável"
                options={[{ value: "", label: "Sem Responsável" }, ...membros.map((m) => ({ value: m.id, label: m.displayName }))]}
              />
            )}
          </Field>
        </div>

        <Field label="Negócio" hint="Opcional: um Negócio aberto deste Contato.">
          {(id) => (
            <Select
              id={id}
              value={dealId}
              onChange={setDealId}
              placeholder="Sem Negócio"
              disabled={!contato}
              disabledReason="Escolha o Contato primeiro."
              options={[{ value: "", label: "Sem Negócio" }, ...negocios.map((d) => ({ value: d.id, label: d.title }))]}
            />
          )}
        </Field>

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
