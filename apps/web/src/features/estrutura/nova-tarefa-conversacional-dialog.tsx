"use client";

/**
 * NOVA TAREFA CONVERSACIONAL — o diálogo de criação numa Lista de modelo
 * conversacional (C35). No lugar do título solto: o Membro escolhe o Contato,
 * o Canal por onde a conversa acontece, e opcionalmente o título, o Status
 * em que nasce, o Responsável e um Negócio do Contato.
 *
 * Fase 14 (3.3.4): a Tarefa nasce por `POST /tarefas-conversacionais`, com
 * ids das tabelas novas — o Contato vem do `SeletorDeRegistro`, o Canal de
 * `useCanais` e o Negócio de `useNegocios`, nada de `state.contacts`,
 * `state.channels` nem `state.deals`. D-07: sem Conversa aberta do Contato no
 * Canal escolhido a conversa nasce junto e pede a "Primeira Mensagem"; com uma
 * aberta, o campo some e a Tarefa a reaproveita (`conversaAbertaDoPar`, pelo
 * hook). A5: depois do sucesso a tela re-hidrata o store (`GET /estado` traz a
 * Tarefa) em vez de aplicar um diff à mão. Só vai ao ar no deploy da Fase 15.
 *
 * Serve à página da Lista (com `listId`) e à Caixa de Entrada / ficha do
 * Contato (sem `listId`, com o Contato e o Canal já dados): aí a Lista é a
 * primeira escolha. As cópias do Funil (Listas espelho) saíram na D-06: a
 * Tarefa de um Negócio não nasce por este diálogo.
 *
 * Quem hospeda renderiza sempre e controla por `open` (a saída de `--dur-1`
 * anima); cada abertura parte dos props de novo, derivado no render.
 */

import { useState } from "react";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { containerPath, effectiveListConfig, memberReachesContainer, tiposDaLista } from "@n1/dominio/derive";
import { canaisDaListaNasTabelas, canaisDaListaQueAlcancamNasTabelas, listaSemCanaisNasTabelas } from "@n1/dominio/derive-conversacional";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useCanais } from "@/dados/crm/canais";
import { useContato } from "@/dados/crm/contatos";
import { useNegocios } from "@/dados/crm/negocios";
import { criarTarefaConversacional, useConversaAbertaDoPar } from "@/dados/crm/tarefas-conversacionais";
import { useData, useRehidratar, useSession } from "@/dados/store";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Select, TextArea, TextInput } from "@/features/shell/ui";

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
  const rehidratar = useRehidratar();
  const { memberId } = useSession();

  const [listId, setListId] = useState(listaFixa ?? "");
  /** O Contato escolhido no seletor; com `contatoFixo` não há escolha, o Contato é o da conversa. */
  const [escolhido, setEscolhido] = useState<RegistroEscolhido | null>(null);
  const [canalEscolhido, setCanalEscolhido] = useState(canalInicial ?? "");
  const [titulo, setTitulo] = useState("");
  const [statusId, setStatusId] = useState(statusInicial ?? "");
  const [responsavelId, setResponsavelId] = useState(memberId);
  const [negocioId, setNegocioId] = useState("");
  /** O Tipo da Tarefa; vazio = o padrão da Lista (o que o domínio faria sozinho). */
  const [taskTypeId, setTaskTypeId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ readonly texto: string; readonly campo: string | undefined } | null>(null);

  const contactId = contatoFixo ?? escolhido?.id ?? "";

  // Sem Lista dada: as conversacionais, ativas e ao alcance de quem cria.
  const listas = listaFixa
    ? []
    : state.lists.filter((l) => l.lifecycle === "ativo" && l.modeloDeTarefa === "conversacional").filter((l) => memberReachesContainer(state, memberId, "list", l.id));
  const lista = listId ? state.lists.find((l) => l.id === listId) : undefined;

  // O Contato e os Canais vêm da api; um diálogo fechado não vai a ela.
  const detalhe = useContato(open && contactId ? contactId : undefined);
  const todosOsCanais = useCanais({ estado: "ativo", limite: LIMITES_CRM.paginaMaxima }, { pausado: !open });
  const canaisDasTabelas = todosOsCanais.data?.itens ?? [];
  const carregandoCanais = open && todosOsCanais.data === undefined && !todosOsCanais.error;
  const identificadores = detalhe.data?.identificadores;
  const nomeDoContato = detalhe.data ? nomeDeExibicaoDoContato(detalhe.data.contato, detalhe.data.identificadores.find((i) => i.principal)?.valor) : (escolhido?.nome ?? "");

  // C36 — só os canais de atendimento DESTA Lista, e destes só os que alcançam o Contato.
  // Sem o Contato lido ainda a lista fica vazia: mostrar todos e depois tirar pisca uma escolha que não vale.
  const canais = lista && (contactId === "" || identificadores !== undefined) ? canaisDaListaQueAlcancamNasTabelas(lista, canaisDasTabelas, identificadores) : [];
  const semCanais = lista !== undefined && !carregandoCanais && listaSemCanaisNasTabelas(lista, canaisDasTabelas);
  // O Canal escolhido só vale se esta Lista o atende e ele alcança o Contato; com um só possível, ele é o Canal.
  const canalId = canais.some((c) => c.id === canalEscolhido) ? canalEscolhido : canais.length === 1 && canais[0] ? canais[0].id : "";

  const config = listId ? effectiveListConfig(state, listId) : null;
  const statuses = config ? [...config.statusSet.definitions].sort((a, b) => a.order - b.order) : [];
  // Um Tipo só não é escolha: o campo some e a Tarefa nasce com ele.
  const tipos = listId ? tiposDaLista(state, listId) : [];
  const membros = state.members.filter((m) => m.state === "ativo");
  const negocios = useNegocios({ contatoId: contactId, situacao: "aberto", limite: LIMITES_CRM.paginaMaxima }, { pausado: !open || contactId === "" });

  // D-07 — a Primeira Mensagem só existe quando a Conversa nasce com a Tarefa.
  // Se a conferência falhar o campo aparece: com Conversa aberta a api o ignora, sem ela o exige.
  const conversaAberta = useConversaAbertaDoPar(contactId, canalId, { pausado: !open });
  const parCompleto = contactId !== "" && canalId !== "";
  const verificando = parCompleto && conversaAberta.conversa === undefined && conversaAberta.erro === undefined;
  const pedeMensagem = parCompleto && (conversaAberta.conversa === null || conversaAberta.erro !== undefined);

  const tiposDaListaEscolhida = (id: string) =>
    [...new Set(canaisDaListaNasTabelas(state.lists.find((l) => l.id === id), canaisDasTabelas).map((ch) => CHANNEL_TYPE_LABEL[ch.tipo]))].join(" · ");

  const motivo = enviando
    ? "Criando…"
    : !listId
      ? "Escolha a Lista."
      : !contactId
        ? "Escolha o Contato."
        : !canalId
          ? "Escolha o Canal da conversa."
          : verificando
            ? "Conferindo a conversa deste Contato…"
            : pedeMensagem && mensagem.trim() === ""
              ? "Escreva a primeira Mensagem."
              : undefined;

  const reset = () => {
    setListId(listaFixa ?? "");
    setEscolhido(null);
    setCanalEscolhido(canalInicial ?? "");
    setTitulo("");
    setStatusId(statusInicial ?? "");
    setResponsavelId(memberId);
    setNegocioId("");
    setTaskTypeId("");
    setMensagem("");
    setEnviando(false);
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

  const confirmar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      const { task } = await criarTarefaConversacional({
        listId,
        contatoId: contactId,
        canalId,
        // O campo só aparece sem Conversa aberta; com ela o corpo não leva a Mensagem.
        ...(pedeMensagem && mensagem.trim() ? { mensagem: { conteudo: mensagem.trim() } } : {}),
        ...(titulo.trim() ? { title: titulo.trim() } : {}),
        ...(statusId ? { statusId } : {}),
        ...(responsavelId ? { assignees: [{ kind: "member" as const, id: responsavelId }] } : {}),
        ...(negocioId ? { negocioId } : {}),
        ...(taskTypeId ? { taskTypeId } : {}),
      });
      // A5: o `GET /estado` traz a Tarefa nova. Se ele falhar a Tarefa já existe: o aviso de sucesso vale, e a revisão do Espaço alcança o store na próxima conferência.
      await rehidratar().catch(() => undefined);
      reset();
      onDone(`Tarefa criada: ${task.title}.`, task.id);
    } catch (e) {
      setErro({ texto: e instanceof ErroDeApi ? e.message : "Não foi possível criar a Tarefa. Tente de novo.", campo: e instanceof ErroDeApi ? e.campo : undefined });
      setEnviando(false);
    }
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
      confirmCarregando={enviando}
      onConfirm={() => void confirmar()}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        {listaFixa ? null : (
          <Field label="Lista" required hint="Só Listas conversacionais recebem esta Tarefa.">
            {(id) => (
              <Select
                id={id}
                value={listId}
                onChange={setListId}
                searchable
                placeholder={listas.length === 0 ? "Nenhuma Lista conversacional ao seu alcance" : "Escolher a Lista"}
                disabled={listas.length === 0}
                disabledReason="Crie uma Lista com o modelo conversacional primeiro."
                options={listas.map((l) => {
                  const sem = !carregandoCanais && listaSemCanaisNasTabelas(l, canaisDasTabelas);
                  return {
                    value: l.id,
                    label: l.name,
                    // Por onde a Lista atende, dito antes de escolher; sem canais, não recebe Tarefa.
                    detail: sem ? `${caminhoDe(l.id)} · sem canais` : `${caminhoDe(l.id)} · ${tiposDaListaEscolhida(l.id)}`,
                    ...(sem ? { disabledReason: LISTA_SEM_CANAIS } : {}),
                  };
                })}
              />
            )}
          </Field>
        )}

        <Field label="Contato" required hint="Com quem a conversa acontece.">
          {(id) =>
            contatoFixo !== undefined ? (
              <TextInput id={id} value={nomeDoContato} onChange={() => undefined} disabled disabledReason="O Contato é o desta conversa." />
            ) : (
              <SeletorDeRegistro
                id={id}
                recurso="contatos"
                rotulo="Buscar Contato"
                valor={escolhido}
                onChange={(registro) => {
                  setEscolhido(registro);
                  setNegocioId("");
                }}
              />
            )
          }
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Canal" required hint="Por onde a conversa acontece.">
            {(id) => (
              <Select
                id={id}
                value={canalId}
                onChange={setCanalEscolhido}
                placeholder={
                  !listId
                    ? "Escolha a Lista primeiro"
                    : carregandoCanais
                      ? "Carregando os Canais…"
                      : semCanais
                        ? "Esta Lista não tem canais de atendimento"
                        : contactId !== "" && identificadores === undefined
                          ? "Lendo o Contato…"
                          : contactId !== "" && canais.length === 0
                            ? "Nenhum canal desta Lista alcança este Contato"
                            : "Escolher o Canal"
                }
                disabled={!listId || carregandoCanais || semCanais || (contactId !== "" && canais.length === 0)}
                disabledReason={
                  !listId
                    ? "Escolha a Lista primeiro."
                    : carregandoCanais || (contactId !== "" && identificadores === undefined)
                      ? "Carregando…"
                      : semCanais
                        ? LISTA_SEM_CANAIS
                        : "Nenhum canal desta Lista alcança este Contato: acrescente um Identificador a ele."
                }
                options={canais.map((c) => ({
                  value: c.id,
                  label: c.nome,
                  detail: c.conexao === "desconectada" ? "desconectado" : CHANNEL_TYPE_LABEL[c.tipo],
                }))}
              />
            )}
          </Field>
          <Field label="Título" hint={`Opcional. Vazio, fica “${nomeDoContato || "o nome do Contato"}”.`}>
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

        {pedeMensagem ? (
          <Field
            label="Primeira Mensagem"
            required
            hint="Este Contato não tem conversa aberta neste Canal: a conversa nasce com esta Mensagem."
            {...(erro?.campo === "mensagem" ? { error: erro.texto } : {})}
          >
            {(id) => <TextArea id={id} value={mensagem} onChange={setMensagem} rows={3} required placeholder="O que você quer dizer ao Contato" />}
          </Field>
        ) : null}

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
              value={negocioId}
              onChange={setNegocioId}
              placeholder="Sem Negócio"
              disabled={contactId === ""}
              disabledReason="Escolha o Contato primeiro."
              options={[{ value: "", label: "Sem Negócio" }, ...(negocios.data?.itens ?? []).map((n) => ({ value: n.id, label: n.titulo }))]}
            />
          )}
        </Field>

        {erro && (erro.campo !== "mensagem" || !pedeMensagem) ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro.texto}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
