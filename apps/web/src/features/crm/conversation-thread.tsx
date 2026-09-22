"use client";

/**
 * A conversa de um Contato, por Canal, embutível em qualquer ficha.
 *
 * Existe como componente porque a mesma conversa precisa aparecer na ficha do
 * Contato e na do Negócio — e duas cópias divergiriam justamente nas regras do
 * Canal, que é onde errar custa uma Mensagem enviada fora da janela.
 *
 * As abas saem dos Identificadores do Contato: uma aba de Canal que ele não tem
 * é aba morta.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AudioLines,
  Eye,
  FileText,
  Globe,
  Image,
  Mail,
  MapPin,
  ListTodo,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  Send,
  Smile,
  Sparkles,
  StickyNote,
  Table,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { useRecente } from "@/features/shell/recente";
import {
  CHANNEL_CAPABILITIES,
  addContactNote,
  createTask,
  discardDraft,
  sendMessage,
  startConversation,
} from "@n1/dominio/operations";
import {
  contactDisplayName,
  marketingConsentMissing,
  responseWindowOpenUntil,
  statusCategory,
} from "@n1/dominio/derive";
import {
  CHANNEL_TYPE_LABEL,
  IDENTIFIER_TYPE_LABEL,
} from "@/features/shell/format";
import { ContactAvatar } from "@/features/crm/contact-card";
import { InstagramIcon, LinkedinIcon } from "@/features/crm/brand-icons";
import { useFormat } from "@/features/shell/use-format";
import {
  ActorAvatar,
  Button,
  ConfirmDialog,
  Divisor,
  EmptyState,
  Icone,
  Painel,
  Pilula,
  Select,
  cn,
} from "@/features/shell/ui";
import type {
  ActorRef,
  Attachment,
  ChannelType,
  Contact,
  ContactIdentifierType,
  Id,
  Task,
} from "@n1/dominio/types";

/** Documento 14, 7.1 — o Identificador que cada tipo de Canal resolve. */
const CHANNEL_OF_IDENTIFIER: Partial<
  Record<ContactIdentifierType, ChannelType>
> = {
  identidadeDeWhatsApp: "whatsapp",
  usuarioDeInstagram: "instagram",
  perfilDeLinkedIn: "linkedin",
  email: "email",
  identificadorDeChatDoSite: "chatDoSite",
};

export const CHANNEL_ICON: Record<
  ChannelType,
  (props: { readonly className?: string }) => ReactNode
> = {
  whatsapp: MessageCircle,
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  email: Mail,
  chatDoSite: Globe,
};

/**
 * A ordem das abas é da PLATAFORMA, não dos Identificadores do Contato: quem
 * atende usa sempre a mesma tela, e a aba do WhatsApp não pode mudar de lugar
 * porque este Contato tem e-mail e o outro não.
 */
const ORDEM_DOS_CANAIS: readonly ChannelType[] = [
  "whatsapp",
  "instagram",
  "linkedin",
  "email",
  "chatDoSite",
];

/** O Identificador que cada Canal exige, para a aba desligada dizer o que falta. */
const IDENTIFICADOR_DO_CANAL: Record<ChannelType, ContactIdentifierType> = {
  whatsapp: "identidadeDeWhatsApp",
  instagram: "usuarioDeInstagram",
  linkedin: "perfilDeLinkedIn",
  email: "email",
  chatDoSite: "identificadorDeChatDoSite",
};

/** O que cada tipo de mídia é, em palavras de quem atende. */
const MEDIA_TYPE_LABEL: Record<Attachment["mediaType"], string> = {
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  document: "Arquivo",
  spreadsheet: "Planilha",
  location: "Local",
  sticker: "Figurinha",
  flow: "Flow",
  other: "Outro",
};

const ICONE_DA_MIDIA: Record<Attachment["mediaType"], LucideIcon> = {
  image: Image,
  video: Video,
  audio: AudioLines,
  document: FileText,
  spreadsheet: Table,
  location: MapPin,
  sticker: Smile,
  flow: Workflow,
  other: Paperclip,
};

/** O alternador de anexo: aceso em acento lavado, apagado em cinza. */
function classeDoAlternador(ligado: boolean): string {
  return cn(
    "app-sm flex items-center gap-1 rounded-[var(--r-controle)] px-2 py-1 transition-colors",
    ligado
      ? "bg-[var(--acento-lavado)] text-[var(--acento)]"
      : "text-[var(--texto-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--texto)]",
  );
}

/* Os botões redondos da barra do compositor têm a altura do controle, e não a
   do botão nu (menor), para alinharem com a pílula de texto ao lado. */
const MEDIDA_DO_BOTAO_DO_COMPOSITOR = {
  width: "var(--controle-h)",
  height: "var(--controle-h)",
} as const;

/** Os Canais em que este Contato pode ser alcançado, na ordem da plataforma. */
export function channelsOf(contact: Contact): ChannelType[] {
  const tem = new Set(
    contact.identifiers
      .map((identificador) => CHANNEL_OF_IDENTIFIER[identificador.type])
      .filter((canal): canal is ChannelType => canal !== undefined),
  );
  return ORDEM_DOS_CANAIS.filter((canal) => tem.has(canal));
}

export function ConversationThread({
  contact,
  canalSelecionado,
  onCanalChange,
  flush = false,
}: {
  readonly contact: Contact;
  /** Controlado quando a tela tem atalho de Canal fora da aba. */
  readonly canalSelecionado?: ChannelType | null;
  readonly onCanalChange?: (canal: ChannelType) => void;
  /** Sem moldura: o thread É o painel, como na Caixa de Entrada. */
  readonly flush?: boolean;
}) {
  const state = useData((data) => data);
  const run = useRun();
  // A Mensagem recém-enviada surge; as outras já estão (o fio não tem cascata).
  const recente = useRecente();
  const fmt = useFormat();
  const [canalAtivo, setCanalAtivo] = useState<ChannelType | null>(null);
  const [draft, setDraft] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [copia, setCopia] = useState("");
  const [copiaOculta, setCopiaOculta] = useState("");
  const [anexo, setAnexo] = useState<Attachment["mediaType"] | null>(null);
  const [anexando, setAnexando] = useState(false);
  const [visualizacaoUnica, setVisualizacaoUnica] = useState(false);
  const [registro, setRegistro] = useState<"nota" | "tarefa" | "meet" | null>(
    null,
  );
  const [textoDoRegistro, setTextoDoRegistro] = useState("");
  const [listaDaTarefa, setListaDaTarefa] = useState("");
  const [adotado, setAdotado] = useState<ActorRef | null>(null);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [descartando, setDescartando] = useState<ActorRef | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  const canais = channelsOf(contact);

  // Quem controla o Canal por fora (os atalhos da ficha) espera ver o chat ao
  // clicar. Ajuste de estado durante a renderização, o padrão do React para
  // "reagir a uma prop mudar" sem efeito nem renderização a mais.
  const [canalVisto, setCanalVisto] = useState(canalSelecionado);
  if (canalSelecionado !== canalVisto) {
    setCanalVisto(canalSelecionado);
    setRegistro(null);
  }

  /*
   * A Reunião do Contato: Tarefa de Tipo Reunião ligada a um Negócio em que ele
   * está vinculado. A que está em andamento ganha a vez; senão, a próxima.
   */
  const negociosDele = state.deals
    .filter((d) => d.lifecycle === "ativo")
    .filter((d) => d.contactLinks.some((l) => l.contactId === contact.id))
    .map((d) => d.id);
  const reunioes = state.tasks
    .filter((t) => t.lifecycle === "ativo")
    .filter(
      (t) =>
        state.taskTypes.find((tt) => tt.id === t.taskTypeId)?.name ===
        "Reunião",
    )
    .filter((t) =>
      state.links.some(
        (l) =>
          (l.fromId === t.id &&
            l.toType === "deal" &&
            negociosDele.includes(l.toId)) ||
          (l.toId === t.id &&
            l.fromType === "deal" &&
            negociosDele.includes(l.fromId)),
      ),
    );
  /** O Negócio ao qual a Reunião está ligada: é dele que sai o valor. */
  const negocioDaReuniao = (reuniaoId: Id) => {
    const vinculo = state.links.find(
      (l) =>
        (l.fromId === reuniaoId && l.toType === "deal") ||
        (l.toId === reuniaoId && l.fromType === "deal"),
    );
    if (!vinculo) return undefined;
    return state.deals.find(
      (d) =>
        d.id === (vinculo.fromId === reuniaoId ? vinculo.toId : vinculo.fromId),
    );
  };

  /* Em andamento primeiro, depois a mais próxima: a call de agora é a que o
     Closer veio abrir, e as outras são o contexto. */
  const agenda = [...reunioes].sort((a, b) => {
    const viva = (t: Task) =>
      statusCategory(state, t) === "emAndamento" ? 0 : 1;
    return (
      viva(a) - viva(b) ||
      String(a.dueDate?.value ?? "9").localeCompare(
        String(b.dueDate?.value ?? "9"),
      )
    );
  });

  const reuniao =
    reunioes.find((t) => statusCategory(state, t) === "emAndamento") ??
    reunioes
      .filter((t) => statusCategory(state, t) !== "concluido")
      .sort((a, b) =>
        String(a.dueDate?.value ?? "9").localeCompare(
          String(b.dueDate?.value ?? "9"),
        ),
      )[0];
  const reuniaoAoVivo =
    reuniao !== undefined && statusCategory(state, reuniao) === "emAndamento";

  const conversas = state.conversations.filter(
    (c) => c.contactId === contact.id && c.lifecycle === "ativo",
  );

  // A aba que abre é a da conversa mais recente, não a do primeiro
  // Identificador: abrir num Canal vazio enquanto existe conversa viva em outro
  // esconde justamente o que a pessoa veio ver.
  const ultimaMensagemEm = (tipo: ChannelType): string =>
    conversas
      .filter(
        (c) =>
          state.channels.find((ch) => ch.id === c.channelId)?.channelType ===
          tipo,
      )
      .flatMap((c) => c.messages.map((m) => m.createdAt))
      .sort()
      .at(-1) ?? "";
  const comAtividade = [...canais].sort((a, b) =>
    ultimaMensagemEm(b).localeCompare(ultimaMensagemEm(a)),
  );
  const canal = canalSelecionado ?? canalAtivo ?? comAtividade[0] ?? null;
  const doCanal = canal
    ? conversas.filter(
        (c) =>
          state.channels.find((ch) => ch.id === c.channelId)?.channelType ===
          canal,
      )
    : [];
  // A Conversa aberta é a que recebe resposta; as resolvidas ficam como histórico.
  const conversa = doCanal.find((c) => c.state !== "resolvida") ?? doCanal[0];
  const channel = conversa
    ? state.channels.find((ch) => ch.id === conversa.channelId)
    : undefined;

  const capacidades = canal ? CHANNEL_CAPABILITIES[canal] : undefined;
  const abertaAte = conversa
    ? responseWindowOpenUntil(
        state,
        conversa,
        (tipo) => CHANNEL_CAPABILITIES[tipo as ChannelType],
      )
    : null;
  const janelaFechada = abertaAte !== null && agora > abertaAte.getTime();
  /*
    RN-CXE-19 — fora da janela, o WhatsApp só aceita Mensagem de modelo
    aprovada pelo provedor. Em vez de deixar o envio falhar no clique, o
    compositor troca o texto livre pelo seletor de modelo.
  */
  const exigeModelo =
    janelaFechada && capacidades?.requiresTemplateOutsideWindow === true;
  const modelosAprovados = (channel?.messageTemplates ?? []).filter(
    (modelo) => modelo.approval === "aprovado",
  );
  const semConsentimento = conversa
    ? marketingConsentMissing(
        state,
        conversa,
        exigeModelo ? modeloId || undefined : undefined,
      )
    : false;

  const rascunho = conversa?.drafts.find((item) => item.origin !== "membro");

  const abrirAtendimento = () => {
    const channelId = canal
      ? state.channels.find(
          (ch) => ch.channelType === canal && ch.lifecycle === "ativo",
        )?.id
      : undefined;
    if (!channelId) {
      setAviso(null);
      setErro(
        `Nenhum Canal ativo de ${canal ? CHANNEL_TYPE_LABEL[canal] : "atendimento"}.`,
      );
      return;
    }
    const resultado = run((data, memberId) =>
      startConversation(data, memberId, channelId, contact.id),
    );
    if (resultado.ok) {
      setErro(null);
      setAviso("Atendimento aberto.");
    } else {
      setAviso(null);
      setErro(resultado.error);
    }
  };

  const bloqueio = !conversa
    ? "Abra o atendimento antes de escrever."
    : draft.trim() === ""
      ? "Escreva a mensagem antes de enviar."
      : exigeModelo && modelosAprovados.length === 0
        ? "Este Canal não tem Mensagem de modelo aprovada: não dá para enviar fora da janela."
        : exigeModelo && modeloId === ""
          ? "A janela de resposta expirou: escolha uma Mensagem de modelo aprovada."
          : janelaFechada && !exigeModelo
            ? "A janela de resposta expirou."
            : semConsentimento
              ? "Este Contato não tem consentimento vigente para marketing neste Canal."
              : channel?.connection === "comErro"
                ? "O Canal está com erro de conexão."
                : undefined;

  const enviar = () => {
    if (!conversa) return;
    const resultado = run((data, memberId) =>
      sendMessage(data, memberId, {
        conversationId: conversa.id,
        content: draft,
        ...(exigeModelo && modeloId ? { templateProviderId: modeloId } : {}),
        ...(adotado ? { adoptedDraftOf: adotado } : {}),
      }),
    );
    if (resultado.ok) {
      setDraft("");
      setModeloId("");
      setAdotado(null);
      setErro(null);
      setAviso("Mensagem enviada.");
    } else {
      setAviso(null);
      setErro(resultado.error);
    }
    setConfirmandoEnvio(false);
  };

  if (canais.length === 0) {
    return (
      <EmptyState
        title="Este Contato não tem Canal."
        hint="Sem Identificador de Canal não há por onde conversar."
      />
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", !flush && "painel")}>
      <ConfirmDialog
        open={confirmandoEnvio}
        title={`Enviar a ${contactDisplayName(contact)} por ${canal ? CHANNEL_TYPE_LABEL[canal] : ""}?`}
        description={`Esta Mensagem sai da plataforma.${
          adotado ? " O Rascunho adotado deixa de existir ao enviar." : ""
        } Depois de enviada, nada aqui a apaga do lado de quem recebeu.`}
        confirmLabel="Enviar"
        onConfirm={enviar}
        onCancel={() => setConfirmandoEnvio(false)}
      >
        <p
          className="app-base rounded-[var(--r-controle)] px-3 py-2"
          style={{ background: "var(--superficie-2)", color: "var(--texto)" }}
        >
          {draft}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={descartando !== null}
        title="Descartar este Rascunho?"
        description="O Rascunho nunca foi Mensagem: não há lixeira nem versão anterior para onde voltar."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          if (descartando && conversa) {
            const resultado = run((data, memberId) =>
              discardDraft(data, memberId, conversa.id, descartando),
            );
            if (resultado.ok) setAviso("Rascunho descartado.");
            else setErro(resultado.error);
          }
          setDescartando(null);
        }}
        onCancel={() => setDescartando(null)}
      />

      {/* ── abas de Canal ── */}
      <div
        role="tablist"
        aria-label="Canais de comunicação"
        className="flex shrink-0 flex-wrap items-center gap-1 px-2"
        style={{ borderBottom: "1px solid var(--linha)" }}
      >
        {/*
          A fileira mostra TODOS os Canais da plataforma, sempre na mesma ordem.
          Os que este Contato não alcança vêm desligados dizendo por quê, em vez
          de sumirem: uma barra que muda de tamanho a cada Contato faz procurar
          a aba, e some justamente com a informação de que falta um
          Identificador.
        */}
        {ORDEM_DOS_CANAIS.map((tipo) => {
          const IconeDoCanal = CHANNEL_ICON[tipo];
          const alcancavel = canais.includes(tipo);
          const quantas = conversas.filter(
            (c) =>
              state.channels.find((ch) => ch.id === c.channelId)
                ?.channelType === tipo,
          ).length;
          const ativa = canal === tipo;
          const motivo = alcancavel
            ? undefined
            : `Este Contato não tem ${IDENTIFIER_TYPE_LABEL[IDENTIFICADOR_DO_CANAL[tipo]] ?? "Identificador"}.`;
          return (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-disabled={!alcancavel}
              title={motivo}
              onClick={
                alcancavel
                  ? () => {
                      setCanalAtivo(tipo);
                      setRegistro(null);
                      onCanalChange?.(tipo);
                      setDraft("");
                      setAdotado(null);
                    }
                  : undefined
              }
              data-ativo={ativa && registro === null}
              className={cn(
                "app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
                ativa && registro === null
                  ? "sublinhado font-medium text-[var(--texto)]"
                  : alcancavel
                    ? "sublinhado text-[var(--texto-3)] hover:text-[var(--texto)]"
                    : "cursor-not-allowed text-[var(--texto-3)] opacity-40",
              )}
            >
              {/* Ícone de marca não é Lucide: recebe a medida do sistema pela classe. */}
              <IconeDoCanal className="size-[var(--icone-sm)] shrink-0" aria-hidden="true" />
              {CHANNEL_TYPE_LABEL[tipo]}
              {quantas > 0 ? <Contador valor={quantas} /> : null}
              {motivo ? <span className="sr-only">{motivo}</span> : null}
            </button>
          );
        })}

        {/*
          A Reunião fecha os Canais: ela também é falar com a pessoa, só que ao
          vivo. Não é Canal na ontologia (é Tarefa de Tipo Reunião), mas separá-la
          daqui faria o Closer procurar a call em outro lugar no meio do
          atendimento.
        */}
        {agenda.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={registro === "meet"}
            onClick={() => setRegistro(registro === "meet" ? null : "meet")}
            data-ativo={registro === "meet"}
            className={cn(
              "sublinhado app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
              registro === "meet"
                ? "font-medium text-[var(--texto)]"
                : reuniaoAoVivo
                  ? "font-medium text-[var(--sucesso)]"
                  : "text-[var(--texto-3)] hover:text-[var(--texto)]",
            )}
          >
            <Icone de={Video} />
            Meet
            {agenda.length > 1 ? <Contador valor={agenda.length} /> : null}
            {reuniaoAoVivo ? (
              <span
                aria-label="Reunião em andamento"
                className="pilula-ponto"
                style={{ background: "var(--sucesso)" }}
              />
            ) : null}
          </button>
        ) : (
          <span
            title="Este Contato não tem Reunião marcada."
            className="app-base flex cursor-not-allowed items-center gap-2 whitespace-nowrap px-3 py-2 text-[var(--texto-3)] opacity-40"
          >
            <Icone de={Video} />
            Meet
            <span className="sr-only">
              Este Contato não tem Reunião marcada.
            </span>
          </span>
        )}

        {/*
          Nota e Tarefa fecham a fileira, separadas por uma linha: as duas NÃO
          são Canais e nada sai da plataforma por elas. Estão aqui porque o
          gesto é o mesmo, registrar algo sobre esta pessoa, e separá-las em
          outro canto obrigaria a procurar em dois lugares.
        */}
        <Divisor vertical className="mx-1" />
        {[
          { aba: "nota" as const, rotulo: "Nota interna", icone: StickyNote },
          { aba: "tarefa" as const, rotulo: "Tarefa", icone: ListTodo },
        ].map(({ aba, rotulo, icone }) => (
          <button
            key={aba}
            type="button"
            role="tab"
            aria-selected={registro === aba}
            onClick={() => setRegistro(registro === aba ? null : aba)}
            data-ativo={registro === aba}
            className={cn(
              "sublinhado app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
              registro === aba
                ? "font-medium text-[var(--texto)]"
                : "text-[var(--texto-3)] hover:text-[var(--texto)]",
            )}
          >
            <Icone de={icone} />
            {rotulo}
          </button>
        ))}
      </div>

      {/* ── a regra do Canal, dita onde ela morde ── */}
      {capacidades && registro !== "meet" ? (
        <p
          className="app-sm shrink-0 px-3 py-2"
          style={
            janelaFechada || channel?.connection === "comErro"
              ? {
                  background: "var(--aviso-lavado)",
                  color: "var(--aviso)",
                  borderBottom: "1px solid var(--linha)",
                }
              : { color: "var(--texto-3)" }
          }
        >
          {channel ? `${channel.name} · ` : ""}
          {capacidades.responseWindowHours === undefined
            ? "sem janela de resposta"
            : janelaFechada && abertaAte
              ? `janela expirada em ${fmt.instant(abertaAte.toISOString())} — só Mensagem de modelo aprovada`
              : abertaAte
                ? `janela de resposta até ${fmt.instant(abertaAte.toISOString())}`
                : `janela de ${capacidades.responseWindowHours}h após a Mensagem recebida`}
          {channel?.connection === "comErro"
            ? " · Canal com erro de conexão"
            : ""}
        </p>
      ) : null}

      {registro !== null ? (
        <div className="relative min-h-0 flex-1 overflow-y-auto p-3">
          {registro === "meet" ? (
            /*
              A aba não pula direto para a call: uma reunião custa a hora do
              Closer e a do lead, e entrar sem saber o objetivo, quem estará na
              sala e quanto está em jogo é entrar despreparado. A lista diz isso
              antes, e a call fica a um clique.
            */
            <ul className="pilha-solta">
              {agenda.map((reuniaoDaLista) => {
                const negocio = negocioDaReuniao(reuniaoDaLista.id);
                const aoVivo =
                  statusCategory(state, reuniaoDaLista) === "emAndamento";
                const concluida =
                  statusCategory(state, reuniaoDaLista) === "concluido";
                const participantes = [
                  ...reuniaoDaLista.assignees
                    .filter((a) => a.kind === "member")
                    .map((a) => state.members.find((m) => m.id === a.id))
                    .filter((m) => m !== undefined)
                    .map((m) => ({ id: m.id, nome: m.displayName })),
                  { id: contact.id, nome: contactDisplayName(contact) },
                ];
                return (
                  <li key={reuniaoDaLista.id}>
                    <details
                      open={aoVivo}
                      className="item-solto"
                      data-bloco="true"
                      data-destacado={aoVivo ? "true" : undefined}
                      data-atenuado={concluida ? "true" : undefined}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                        <Icone de={Video} style={{ color: "var(--texto-3)" }} />
                        <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {reuniaoDaLista.title}
                        </span>
                        <Pilula tom={aoVivo ? "sucesso" : "neutro"} comPonto={aoVivo}>
                          {aoVivo
                            ? "Em andamento"
                            : concluida
                              ? "Encerrada"
                              : "Agendada"}
                        </Pilula>
                        <span className="app-sm app-numero" style={{ color: "var(--texto-3)" }}>
                          {reuniaoDaLista.dueDate
                            ? fmt.taskDate(reuniaoDaLista.dueDate)
                            : "sem horário"}
                        </span>
                      </summary>

                      <div className="mt-3 grid gap-2 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                        <p className="app-coluna">Objetivo</p>
                        <p className="app-base" style={{ color: "var(--texto)" }}>
                          {reuniaoDaLista.description?.trim() ||
                            reuniaoDaLista.title}
                        </p>

                        <p className="app-coluna">
                          Participantes ({participantes.length})
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {participantes.map(({ id, nome }) => (
                            <li key={id}>
                              <Pilula tom="neutro">{nome}</Pilula>
                            </li>
                          ))}
                        </ul>

                        <p className="app-coluna">Em negociação</p>
                        <p className="app-base" style={{ color: "var(--texto)" }}>
                          {negocio
                            ? `${negocio.title} · ${negocio.value ? fmt.money(negocio.value) : "sem valor declarado"}`
                            : "Sem Negócio vinculado."}
                        </p>

                        <span className="mt-1">
                          <Link
                            href={`/crm/reunioes/${reuniaoDaLista.id}`}
                            className="btn btn-solido btn-sm"
                          >
                            <Icone de={Video} tamanho="xs" />
                            {aoVivo
                              ? "Participar agora"
                              : concluida
                                ? "Ver a call"
                                : "Abrir a call"}
                          </Link>
                        </span>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : registro === "nota" ? (
            <form
              className="grid gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                const resultado = run((data, memberId) =>
                  addContactNote(data, memberId, contact.id, textoDoRegistro),
                );
                if (resultado.ok) {
                  setErro(null);
                  setAviso("Nota registrada no Contato.");
                  setTextoDoRegistro("");
                } else {
                  setAviso(null);
                  setErro(resultado.error);
                }
              }}
            >
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                A Nota é Comentário do registro: ela não sai da plataforma e o
                Contato nunca a vê.
              </p>
              <label className="sr-only" htmlFor="nota-da-conversa">
                Nota interna
              </label>
              <textarea
                id="nota-da-conversa"
                rows={4}
                value={textoDoRegistro}
                onChange={(evento) => setTextoDoRegistro(evento.target.value)}
                placeholder="O que ficou combinado, o que reparar na próxima conversa…"
                className="campo"
              />
              <span>
                <Button
                  type="submit"
                  disabled={textoDoRegistro.trim() === ""}
                  disabledReason="Escreva a nota antes de salvar."
                >
                  Registrar nota
                </Button>
              </span>
            </form>
          ) : (
            <form
              className="grid gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                const resultado = run((data, memberId) =>
                  createTask(data, memberId, {
                    listId: listaDaTarefa,
                    title: textoDoRegistro,
                    assignees: [{ kind: "member", id: memberId }],
                  }),
                );
                if (resultado.ok) {
                  setErro(null);
                  setAviso("Tarefa criada e atribuída a você.");
                  setTextoDoRegistro("");
                } else {
                  setAviso(null);
                  setErro(resultado.error);
                }
              }}
            >
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                A Tarefa nasce dentro de uma Lista, e é ela que define o Status
                inicial.
              </p>
              <label className="sr-only" htmlFor="titulo-da-tarefa">
                Título da Tarefa
              </label>
              <input
                id="titulo-da-tarefa"
                value={textoDoRegistro}
                onChange={(evento) => setTextoDoRegistro(evento.target.value)}
                placeholder={`Retomar com ${contact.firstName}…`}
                className="campo"
              />
              <label className="sr-only" htmlFor="lista-da-tarefa">
                Lista
              </label>
              <Select
                id="lista-da-tarefa"
                value={listaDaTarefa}
                onChange={setListaDaTarefa}
                searchable
                placeholder="Escolha a Lista"
                options={state.lists
                  .filter((lista) => lista.lifecycle === "ativo")
                  .map((lista) => ({ value: lista.id, label: lista.name }))}
              />
              <span>
                <Button
                  type="submit"
                  disabled={
                    textoDoRegistro.trim() === "" || listaDaTarefa === ""
                  }
                  disabledReason={
                    listaDaTarefa === ""
                      ? "Escolha a Lista."
                      : "Dê um título à Tarefa."
                  }
                >
                  Criar Tarefa
                </Button>
              </span>
            </form>
          )}

          {aviso ? (
            <p role="status" className="app-sm mt-2" style={{ color: "var(--sucesso)" }}>
              {aviso}
            </p>
          ) : null}
          {erro ? (
            <p role="alert" className="app-sm mt-2" style={{ color: "var(--erro)" }}>
              {erro}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {/* ── a conversa ── */}
          <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {!conversa ? (
              <EmptyState
                title={`Nenhuma Conversa em ${canal ? CHANNEL_TYPE_LABEL[canal] : ""}.`}
                hint="A Conversa nasce quando a Mensagem do Contato chega — ou agora, se você abrir o atendimento."
                action={
                  <Button
                    onClick={abrirAtendimento}
                    disabled={canal === null}
                    disabledReason="Este Contato não tem Canal."
                  >
                    Abrir atendimento
                  </Button>
                }
              />
            ) : (
              [...conversa.messages]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((mensagem) => {
                  const saiu = mensagem.direction === "enviada";
                  const interna = mensagem.direction === "interna";
                  /*
                   * O rosto de quem falou, dos dois lados: quem atendeu à direita,
                   * o Contato à esquerda. Sem isso, uma conversa em que três
                   * pessoas do time responderam parece ter uma voz só — e a
                   * Mensagem do Agente ficaria indistinguível da do Membro, que é
                   * exatamente o que B18 proíbe.
                   */
                  const quemFalou = state.members.find(
                    (m) => m.id === mensagem.actor.id,
                  );
                  const agente = state.agents.find(
                    (a) => a.id === mensagem.actor.id,
                  );
                  const avatar =
                    mensagem.direction === "recebida" ? (
                      <ContactAvatar contact={contact} />
                    ) : (
                      <ActorAvatar
                        kind={mensagem.actor.kind}
                        name={
                          quemFalou?.displayName ?? agente?.name ?? "Sistema"
                        }
                        size="grande"
                        {...(quemFalou?.photoFileId
                          ? { photoFileId: quemFalou.photoFileId }
                          : {})}
                      />
                    );

                  return (
                    <div
                      key={mensagem.id}
                      className={`flex items-end gap-2 ${saiu ? "justify-end" : "justify-start"}${mensagem.id === recente ? " surgir" : ""}`}
                    >
                      {!saiu ? avatar : null}
                      <div
                        className={cn(
                          "app-base max-w-[80%] rounded-[var(--r-painel)] px-3 py-2",
                          interna
                            ? "border border-[var(--cor-atencao-traco)] bg-[var(--cor-atencao-fraco)] text-[var(--cor-atencao-texto)]"
                            : saiu
                              ? "bg-[var(--acento)] text-[var(--sobre-acento)]"
                              : "bg-[var(--superficie-2)] text-[var(--texto)]",
                        )}
                      >
                        {interna ? (
                          <p className="app-sm mb-1 font-medium">
                            Nota interna — não foi enviada
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap">
                          {mensagem.content}
                        </p>
                        <p
                          className={cn(
                            "app-sm mt-1",
                            saiu && !interna ? "opacity-80" : "text-[var(--texto-3)]",
                          )}
                        >
                          {quemFalou?.displayName ?? agente?.name ?? ""}
                          {quemFalou || agente ? " · " : ""}
                          {fmt.instant(mensagem.createdAt)}
                          {mensagem.deliveryStatus
                            ? ` · ${mensagem.deliveryStatus}`
                            : ""}
                        </p>
                      </div>
                      {saiu ? avatar : null}
                    </div>
                  );
                })
            )}
          </div>

          {/* ── Rascunho de IA à espera de decisão humana (B66) ── */}
          {rascunho ? (
            <Painel
              className="mx-3 mb-3 shrink-0 p-3"
              style={{ borderColor: "color-mix(in srgb, var(--cor-dom-ia) 40%, transparent)" }}
            >
              <p className="app-sm flex items-center gap-2 font-medium" style={{ color: "var(--texto)" }}>
                <Icone de={Sparkles} tamanho="xs" style={{ color: "var(--cor-dom-ia)" }} />
                Rascunho de{" "}
                {state.agents.find((a) => a.id === rascunho.actor.id)?.name ??
                  "Agente"}{" "}
                · {adotado ? "carregado no compositor" : "não enviado"}
              </p>
              <p className="app-base mt-1" style={{ color: "var(--texto)" }}>
                {rascunho.content}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft(rascunho.content);
                    setAdotado(rascunho.actor);
                  }}
                >
                  Usar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDescartando(rascunho.actor)}
                >
                  Descartar
                </Button>
                {rascunho.executionId ? (
                  <Link
                    href={`/ia/execucoes/${rascunho.executionId}`}
                    className="app-sm text-[var(--texto-3)] hover:underline"
                  >
                    Ver a Execução
                  </Link>
                ) : null}
              </div>
            </Painel>
          ) : null}

          {/* ── compositor ── */}
          <div className="shrink-0" style={{ borderTop: "1px solid var(--linha)" }}>
            <div className="px-3 pt-3 empty:hidden">
              {aviso ? (
                <p role="status" className="app-sm mb-2" style={{ color: "var(--sucesso)" }}>
                  {aviso}
                </p>
              ) : null}
              {erro ? (
                <p role="alert" className="app-sm mb-2" style={{ color: "var(--erro)" }}>
                  {erro}
                </p>
              ) : null}
              {/*
          O e-mail é o único Canal com assunto e cópias (`hasSubjectAndCopies`).
          Mostrar esses campos nos outros seria prometer um envio que o Canal
          não tem como fazer.
        */}
              {capacidades?.hasSubjectAndCopies ? (
                <div className="mb-2 grid gap-1.5">
                  <label className="sr-only" htmlFor="assunto-mensagem">
                    Assunto
                  </label>
                  <input
                    id="assunto-mensagem"
                    value={assunto}
                    onChange={(evento) => setAssunto(evento.target.value)}
                    placeholder="Assunto"
                    className="campo"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className="min-w-0">
                      <label className="sr-only" htmlFor="copia-mensagem">
                        Cc
                      </label>
                      <input
                        id="copia-mensagem"
                        value={copia}
                        onChange={(evento) => setCopia(evento.target.value)}
                        placeholder="Cc"
                        className="campo"
                      />
                    </span>
                    <span className="min-w-0">
                      <label
                        className="sr-only"
                        htmlFor="copia-oculta-mensagem"
                      >
                        Cco
                      </label>
                      <input
                        id="copia-oculta-mensagem"
                        value={copiaOculta}
                        onChange={(evento) =>
                          setCopiaOculta(evento.target.value)
                        }
                        placeholder="Cco"
                        className="campo"
                      />
                    </span>
                  </div>
                </div>
              ) : null}

              {/*
          A barra de anexos é a do CANAL: cada um aceita uma coisa, e a lista
          sai de `sendableMediaTypes`, não de um menu fixo. Figurinha no e-mail
          e planilha no Instagram não existem.
        */}
              {capacidades && anexando ? (
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  {capacidades.sendableMediaTypes.map((tipo) => {
                    const IconeDaMidia = ICONE_DA_MIDIA[tipo];
                    return (
                      <button
                        key={tipo}
                        type="button"
                        title={`Anexar ${MEDIA_TYPE_LABEL[tipo]}`}
                        onClick={() => {
                          setAnexo(tipo);
                          setAnexando(false);
                        }}
                        aria-pressed={anexo === tipo}
                        className={classeDoAlternador(anexo === tipo)}
                      >
                        <Icone de={IconeDaMidia} />
                        {MEDIA_TYPE_LABEL[tipo]}
                      </button>
                    );
                  })}
                  {capacidades.viewOnce && anexo !== null ? (
                    <button
                      type="button"
                      onClick={() => setVisualizacaoUnica((atual) => !atual)}
                      aria-pressed={visualizacaoUnica}
                      title="A mídia some depois de vista uma vez"
                      className={classeDoAlternador(visualizacaoUnica)}
                    >
                      <Icone de={Eye} />
                      Visualização única
                    </button>
                  ) : null}
                </div>
              ) : null}

              {anexo ? (
                <p
                  className="item-solto app-sm mb-2"
                  data-estatico="true"
                  style={{ color: "var(--texto-3)" }}
                >
                  <Icone de={Paperclip} tamanho="xs" />
                  <span className="min-w-0 flex-1 truncate">
                    {MEDIA_TYPE_LABEL[anexo]} anexado
                    {visualizacaoUnica ? " · visualização única" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAnexo(null);
                      setVisualizacaoUnica(false);
                    }}
                    className="shrink-0 hover:text-[var(--texto)] hover:underline"
                  >
                    Remover
                  </button>
                </p>
              ) : null}

              {exigeModelo ? (
                <div className="mb-2">
                  <label htmlFor="modelo-da-mensagem" className="rotulo">
                    Mensagem de modelo aprovada pelo provedor
                  </label>
                  <Select
                    id="modelo-da-mensagem"
                    value={modeloId}
                    onChange={(valor) => {
                      setModeloId(valor);
                      const modelo = modelosAprovados.find(
                        (item) => item.providerId === valor,
                      );
                      if (modelo) setDraft(modelo.body);
                    }}
                    placeholder="Escolher modelo"
                    options={modelosAprovados.map((modelo) => ({
                      value: modelo.providerId,
                      label: `${modelo.name} · ${modelo.category}`,
                    }))}
                  />
                  {semConsentimento && modeloId !== "" ? (
                    <p
                      className="app-sm mt-1 rounded-[var(--r-controle)] px-2 py-1"
                      style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}
                    >
                      Este modelo é de marketing e {contactDisplayName(contact)}{" "}
                      não tem consentimento vigente para essa finalidade neste
                      Canal. Escolha um modelo de utilidade ou registre o
                      consentimento na ficha.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/*
              Modelo do WhatsApp: uma linha só. O "+" abre os anexos do Canal
              acima da barra; o campo é uma pílula que cresce até seis linhas;
              à direita fica o enviar — ou o microfone, enquanto não há texto,
              nos Canais que aceitam áudio. Enter envia, Shift+Enter quebra.
            */}
            <div className="flex items-end gap-2 px-3 py-2" style={{ background: "var(--superficie-2)" }}>
              {capacidades && capacidades.sendableMediaTypes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setAnexando((aberto) => !aberto)}
                  aria-expanded={anexando}
                  aria-label={anexando ? "Fechar anexos" : "Anexar"}
                  title={anexando ? "Fechar anexos" : "Anexar"}
                  disabled={!conversa}
                  className="btn-icone btn-icone-nu shrink-0 rounded-full"
                  style={MEDIDA_DO_BOTAO_DO_COMPOSITOR}
                >
                  {/* A rotação fica no SVG folha: transform num elemento com descendente prenderia um `fixed`. */}
                  <Icone
                    de={Plus}
                    tamanho="md"
                    className={cn("rotacao", anexando && "rotate-45")}
                  />
                </button>
              ) : null}

              <label className="sr-only" htmlFor="compositor-ficha">
                Escrever para {contactDisplayName(contact)}
              </label>
              <textarea
                id="compositor-ficha"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && bloqueio === undefined) {
                    event.preventDefault();
                    setConfirmandoEnvio(true);
                  }
                }}
                rows={1}
                disabled={!conversa}
                placeholder={conversa ? "Digite uma mensagem" : "Abra o atendimento para escrever"}
                className="app-base max-h-40 min-h-10 min-w-0 flex-1 resize-none border-0 bg-[var(--page)] px-4 py-2.5 outline-none [field-sizing:content] placeholder:text-[var(--texto-3)] disabled:opacity-50"
                style={{ borderRadius: "calc(var(--controle-h) / 2)" }}
              />

              {draft.trim() === "" && capacidades?.voiceNote && !anexo ? (
                <button
                  type="button"
                  title="Gravar áudio"
                  aria-label="Gravar áudio"
                  disabled={!conversa}
                  className="btn-icone btn-icone-nu shrink-0 rounded-full"
                  style={MEDIDA_DO_BOTAO_DO_COMPOSITOR}
                >
                  <Icone de={Mic} tamanho="md" />
                </button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setConfirmandoEnvio(true)}
                  disabled={bloqueio !== undefined}
                  disabledReason={bloqueio ?? ""}
                  icon={<Icone de={Send} />}
                >
                  <span className="sr-only">Enviar</span>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** O contador de uma aba, no mesmo desenho do das Abas do sistema. */
function Contador({ valor }: { readonly valor: number }) {
  return (
    <span
      className="app-xs app-numero rounded-full px-1.5"
      style={{ background: "var(--superficie-3)", color: "var(--texto-3)" }}
    >
      {valor}
    </span>
  );
}
