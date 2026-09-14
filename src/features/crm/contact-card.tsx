"use client";

/**
 * O cartão do Contato: identidade, ações rápidas, dados, resumo e tags.
 *
 * É o mesmo bloco na ficha do Contato e na ficha do Negócio — o Negócio mostra
 * o Contato principal, e mostrar a mesma pessoa de dois jeitos diferentes seria
 * pedir para as duas telas divergirem.
 *
 * Cada linha de "Dados de contato" é um Identificador, e o ÍCONE é o tipo: o
 * rótulo escrito ("Identidade de WhatsApp") ocupa a largura toda e não diz
 * nada que o ícone já não diga. O rótulo continua existindo para quem lê por
 * leitor de tela.
 */

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Flame,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  User,
} from "lucide-react";
import { useData, useRun } from "@/data/store";
import { contactDisplayName, contactDisplayRole, principalCompanyId } from "@/data/derive";
import { CHANNEL_CAPABILITIES, setContactCatalogValue } from "@/data/operations";
import { IDENTIFIER_TYPE_LABEL } from "@/features/shell/format";
import { Icone, Pilula, RecordPanel, Select, cn } from "@/features/shell/ui";
import { InstagramIcon, LinkedinIcon, TikTokIcon } from "@/features/crm/brand-icons";
import type { ChannelType, Contact, ContactIdentifierType } from "@/data/types";


/**
 * Os ícones de marca (Instagram, LinkedIn, TikTok) não são Lucide e só aceitam
 * `className`; por isso o mapa fala nessa interface mínima, e a medida deles
 * vem dos tokens `--icone-*` por classe, não pelo `Icone` da ui.
 */
type ComponenteDeIcone = (props: { readonly className?: string }) => ReactNode;

const ICONE_DO_IDENTIFICADOR: Record<ContactIdentifierType, ComponenteDeIcone> = {
  telefone: Phone,
  email: Mail,
  identidadeDeWhatsApp: MessageCircle,
  usuarioDeInstagram: InstagramIcon,
  identificadorDeChatDoSite: Globe,
  perfilDeLinkedIn: LinkedinIcon,
  perfilDeTikTok: TikTokIcon,
};

/** A ordem em que a pessoa procura: primeiro por onde se fala, depois onde ela existe. */
const ORDEM: readonly ContactIdentifierType[] = [
  "telefone",
  "email",
  "identidadeDeWhatsApp",
  "usuarioDeInstagram",
  "perfilDeLinkedIn",
  "perfilDeTikTok",
  "identificadorDeChatDoSite",
];

/**
 * O rosto do Contato. Enquanto não há arquivo de foto, são as iniciais no
 * gradiente da marca — e é o mesmo desenho na ficha e em cada Mensagem
 * recebida, porque a mesma pessoa não pode aparecer de dois jeitos.
 */
export function ContactAvatar({
  contact,
  size = "normal",
}: {
  readonly contact: Contact;
  readonly size?: "normal" | "grande";
}) {
  /*
   * A foto some se o arquivo não estiver lá, e as iniciais assumem. Um retrato
   * quebrado é pior que iniciais: mostra que falta alguma coisa sem dizer o
   * quê, e aparece em cada Mensagem da conversa.
   */
  const [falhou, setFalhou] = useState(false);
  const nome = contactDisplayName(contact);
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
  const lado = size === "grande" ? 64 : 28;

  if (contact.photoFileId && !falhou) {
    return (
      <Image
        src={`/contatos/${contact.photoFileId}.jpg`}
        alt={nome}
        width={lado}
        height={lado}
        onError={() => setFalhou(true)}
        className={`shrink-0 rounded-full object-cover ${
          size === "grande" ? "size-16" : "size-7"
        }`}
      />
    );
  }

  // O gradiente da marca é roxo ESCURO: a tinta sobre ele é a mesma do botão sólido.
  return (
    <span
      title={nome}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${
        size === "grande" ? "ed-subtitulo size-16" : "app-xs size-7"
      }`}
      style={{ background: "var(--degrade-marca)", color: "var(--sobre-degrade)" }}
    >
      <span aria-hidden="true">{iniciais || "?"}</span>
      <span className="sr-only">{nome}</span>
    </span>
  );
}

/* -------------------------------------------------------------- identidade */

export function ContactIdentity({
  contact,
  editavel = true,
  abaixo,
}: {
  readonly contact: Contact;
  readonly editavel?: boolean;
  /** Controle da tela que vem logo abaixo da Qualificação e da Temperatura. */
  readonly abaixo?: ReactNode;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [erro, setErro] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  const empresaId = principalCompanyId(state, contact.id);
  const empresa = state.companies.find((c) => c.id === empresaId);
  const qualificacoes = state.catalog.filter(
    (c) => c.kind === "qualificacao" && c.lifecycle === "ativo",
  );
  const temperaturas = state.catalog.filter(
    (c) => c.kind === "temperatura" && c.lifecycle === "ativo",
  );
  const temperatura = state.catalog.find((c) => c.id === contact.temperatureId);

  /*
   * O ponto verde não é presença: ninguém aqui sabe se a pessoa está online. Ele
   * diz que existe Canal com a JANELA DE RESPOSTA aberta — a única coisa que
   * realmente muda o que dá para fazer agora.
   */
  const alcancavel = state.conversations.some((conversa) => {
    if (conversa.contactId !== contact.id || conversa.lifecycle !== "ativo") return false;
    const tipo = state.channels.find((ch) => ch.id === conversa.channelId)?.channelType;
    if (!tipo) return false;
    const horas = CHANNEL_CAPABILITIES[tipo].responseWindowHours;
    if (horas === undefined) return true;
    const ultimaRecebida = [...conversa.messages]
      .filter((m) => m.direction === "recebida")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1);
    if (!ultimaRecebida) return false;
    return agora - Date.parse(ultimaRecebida.createdAt) <= horas * 3_600_000;
  });

  const definir = (kind: "qualificacao" | "temperatura", valor: string) => {
    const resultado = run((data, memberId) =>
      setContactCatalogValue(data, memberId, contact.id, kind, valor === "" ? undefined : valor),
    );
    setErro(resultado.ok ? null : resultado.error);
  };

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          <ContactAvatar contact={contact} size="grande" />
          {alcancavel ? (
            <span
              title="Há Canal com a janela de resposta aberta."
              className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2"
              style={{ borderColor: "var(--page)", background: "var(--sucesso)" }}
            >
              <span className="sr-only">Janela de resposta aberta</span>
            </span>
          ) : null}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="ed-subtitulo min-w-0 truncate">
              {contactDisplayName(contact)}
            </span>
            <Icone de={Star} tamanho="sm" style={{ color: "var(--texto-3)" }} />
          </span>
          <span className="app-base block truncate" style={{ color: "var(--texto-3)" }}>
            {contactDisplayRole(state, contact.id) || "sem cargo"}
          </span>
          {empresa ? (
            <Link
              href={`/crm/empresas/${empresa.id}`}
              className="app-base block truncate hover:underline"
              style={{ color: "var(--texto-3)" }}
            >
              {empresa.tradeName || empresa.legalName}
            </Link>
          ) : null}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="min-w-0">
          <label className="sr-only" htmlFor={`qualificacao-${contact.id}`}>
            Qualificação
          </label>
          <Select
            id={`qualificacao-${contact.id}`}
            value={contact.qualificationId ?? ""}
            onChange={(valor) => definir("qualificacao", valor)}
            disabled={!editavel}
            placeholder="Sem Qualificação"
            options={qualificacoes.map((item) => ({ value: item.id, label: item.name }))}
          />
        </span>
        <span className="min-w-0">
          <label className="sr-only" htmlFor={`temperatura-${contact.id}`}>
            Temperatura
          </label>
          <span
            className="block rounded-[var(--r-controle)]"
            style={
              temperatura?.color
                ? {
                    background: `color-mix(in srgb, ${temperatura.color} 18%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${temperatura.color} 45%, transparent)`,
                  }
                : undefined
            }
          >
            <span className="flex items-center gap-1.5 pl-2">
              <Icone de={Flame} tamanho="sm" style={{ color: temperatura?.color ?? "var(--texto-3)" }} />
              <span className="min-w-0 flex-1">
                <Select
                  id={`temperatura-${contact.id}`}
                  value={contact.temperatureId ?? ""}
                  onChange={(valor) => definir("temperatura", valor)}
                  disabled={!editavel}
                  placeholder="Sem Temperatura"
                  options={temperaturas.map((item) => ({ value: item.id, label: item.name }))}
                />
              </span>
            </span>
          </span>
        </span>
      </div>

      {abaixo ? <div className="mt-2">{abaixo}</div> : null}

      {erro ? (
        <p role="alert" className="app-sm mt-2" style={{ color: "var(--erro)" }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- ações rápidas */

export function ContactQuickActions({
  contact,
  onCanal,
  onNota,
}: {
  readonly contact: Contact;
  /** Leva à aba do Canal na conversa; ausente quando a tela não tem conversa. */
  readonly onCanal?: (canal: ChannelType) => void;
  readonly onNota?: () => void;
}) {
  const acoes: Array<{
    readonly chave: string;
    readonly rotulo: string;
    readonly icone: ReactNode;
    readonly href?: string;
    readonly onClick?: () => void;
    readonly indisponivel?: string;
  }> = [];

  const porTipo = (tipo: ContactIdentifierType) =>
    contact.identifiers.find((i) => i.type === tipo);

  const telefone = porTipo("telefone") ?? porTipo("identidadeDeWhatsApp");
  acoes.push({
    chave: "ligar",
    rotulo: "Ligar",
    icone: <Icone de={Phone} tamanho="md" />,
    ...(telefone
      ? { href: `tel:${telefone.value}` }
      : { indisponivel: "Este Contato não tem telefone." }),
  });

  const whatsapp = porTipo("identidadeDeWhatsApp");
  acoes.push({
    chave: "whatsapp",
    rotulo: "WhatsApp",
    icone: <Icone de={MessageCircle} tamanho="md" />,
    ...(whatsapp && onCanal
      ? { onClick: () => onCanal("whatsapp") }
      : { indisponivel: "Este Contato não tem WhatsApp." }),
  });

  const email = porTipo("email");
  acoes.push({
    chave: "email",
    rotulo: "E-mail",
    icone: <Icone de={Mail} tamanho="md" />,
    ...(email && onCanal
      ? { onClick: () => onCanal("email") }
      : { indisponivel: "Este Contato não tem e-mail." }),
  });

  const linkedin = porTipo("perfilDeLinkedIn");
  acoes.push({
    chave: "linkedin",
    rotulo: "LinkedIn",
    icone: <LinkedinIcon className="h-[var(--icone-md)] w-[var(--icone-md)] shrink-0" />,
    // LinkedIn não é Canal: abre o perfil, não uma Conversa.
    ...(linkedin
      ? { href: `https://${linkedin.value.replace(/^https?:\/\//, "")}` }
      : { indisponivel: "Este Contato não tem perfil de LinkedIn." }),
  });

  acoes.push({
    chave: "nota",
    rotulo: "Nota",
    icone: <Icone de={StickyNote} tamanho="md" />,
    ...(onNota ? { onClick: onNota } : { href: `/crm/contatos/${contact.id}` }),
  });

  acoes.push({
    chave: "tarefa",
    rotulo: "Tarefa",
    icone: <Icone de={Sparkles} tamanho="md" />,
    href: "/estrutura/tarefas",
  });

  return (
    <ul className="grid grid-cols-6 gap-1">
      {acoes.map((acao) => {
        /*
          O aro é o botão de ícone do sistema. A ação indisponível não sobe no
          hover: prometeria um clique que não existe.
        */
        const conteudo = (
          <>
            <span
              className={cn("btn-icone alvo-toque", acao.indisponivel && "pointer-events-none opacity-40")}
              style={{ color: acao.indisponivel ? "var(--texto-4)" : "var(--acento)" }}
            >
              {acao.icone}
            </span>
            <span className="app-meta block truncate text-center">
              {acao.rotulo}
            </span>
          </>
        );
        return (
          <li key={acao.chave} className="grid justify-items-center gap-1">
            {acao.indisponivel ? (
              <span title={acao.indisponivel} className="grid justify-items-center gap-1">
                {conteudo}
                <span className="sr-only">{acao.indisponivel}</span>
              </span>
            ) : acao.href ? (
              <a
                href={acao.href}
                {...(acao.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                className="grid justify-items-center gap-1"
              >
                {conteudo}
              </a>
            ) : (
              <button type="button" onClick={acao.onClick} className="grid justify-items-center gap-1">
                {conteudo}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------- dados, resumo */

export function ContactDataPanel({
  contact,
  acao,
  onTransferir,
}: {
  readonly contact: Contact;
  readonly acao?: ReactNode;
  /** Transferir o Identificador para outro Contato (RN-CON-11). */
  readonly onTransferir?: (identifierId: string) => void;
}) {
  const state = useData((data) => data);
  const endereco = contact.addresses.find((a) => a.principal) ?? contact.addresses[0];
  const proprietario = state.members.find((m) => m.id === contact.ownerMemberId);
  const identificadores = [...contact.identifiers].sort(
    (a, b) => ORDEM.indexOf(a.type) - ORDEM.indexOf(b.type),
  );

  return (
    <RecordPanel title="Dados de contato" icon={<Icone de={Star} tamanho="sm" />}>
      <ul className="grid gap-2">
        {identificadores.map((identificador) => {
          const IconeDoTipo = ICONE_DO_IDENTIFICADOR[identificador.type];
          const rotulo = IDENTIFIER_TYPE_LABEL[identificador.type] ?? identificador.type;
          const externo =
            identificador.type === "perfilDeLinkedIn"
              ? `https://${identificador.value.replace(/^https?:\/\//, "")}`
              : identificador.type === "usuarioDeInstagram"
                ? `https://instagram.com/${identificador.value.replace(/^@/, "")}`
                : undefined;
          return (
            <li key={identificador.id} className="flex min-w-0 items-center gap-2.5">
              <IconeDoTipo className="h-[var(--icone-sm)] w-[var(--icone-sm)] shrink-0 text-[var(--acento)]" aria-hidden="true" />
              <span className="sr-only">{rotulo}:</span>
              {externo ? (
                <a
                  href={externo}
                  target="_blank"
                  rel="noreferrer"
                  className="identificador min-w-0 flex-1 truncate hover:underline"
                  style={{ color: "var(--acento)" }}
                >
                  {identificador.displayValue}
                </a>
              ) : (
                <span className="identificador min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                  {identificador.displayValue}
                </span>
              )}
              {onTransferir ? (
                <button
                  type="button"
                  onClick={() => onTransferir(identificador.id)}
                  title={`Transferir ${rotulo} para outro Contato`}
                  className="app-sm shrink-0 text-[var(--texto-3)] hover:text-[var(--texto)] hover:underline"
                >
                  Transferir
                </button>
              ) : null}
            </li>
          );
        })}

        {endereco ? (
          <li className="flex min-w-0 items-center gap-2.5">
            <Icone de={MapPin} tamanho="sm" style={{ color: "var(--acento)" }} />
            <span className="sr-only">Endereço:</span>
            <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
              {[endereco.city, endereco.region].filter(Boolean).join(", ")}
            </span>
          </li>
        ) : null}

        <li className="flex min-w-0 items-center gap-2.5">
          <Icone de={User} tamanho="sm" style={{ color: "var(--acento)" }} />
          <span className="sr-only">Proprietário:</span>
          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
            {proprietario?.displayName ?? "—"}
          </span>
        </li>
      </ul>
      {acao}
    </RecordPanel>
  );
}

export function ContactSummary({ contact }: { readonly contact: Contact }) {
  const resumo = contact.fieldValues.find((v) => v.definitionId === "fd_resumo_perfil")?.value;
  return (
    <RecordPanel title="Resumo do contato" icon={<Icone de={Sparkles} tamanho="sm" />}>
      <p className="app-base" style={{ color: "var(--texto-3)" }}>
        {typeof resumo === "string" && resumo.trim() !== ""
          ? resumo
          : "Ainda sem resumo. O Agente Enriquecedor escreve este campo quando analisa o perfil público."}
      </p>
    </RecordPanel>
  );
}

export function ContactTags({
  contact,
  acao,
}: {
  readonly contact: Contact;
  readonly acao?: ReactNode;
}) {
  const state = useData((data) => data);
  return (
    <RecordPanel title="Tags e interesses" icon={<Icone de={Tag} tamanho="sm" />}>
      <ul className="flex flex-wrap items-center gap-1.5">
        {contact.tagIds.length === 0 ? (
          <li className="app-base" style={{ color: "var(--texto-3)" }}>
            Nenhuma Tag.
          </li>
        ) : (
          contact.tagIds.map((tagId) => {
            const tag = state.tags.find((t) => t.id === tagId);
            // A cor da Tag é DADO: vem do registro, não de um tom do sistema.
            return (
              <li key={tagId}>
                <Pilula {...(tag?.color ? { cor: tag.color } : {})}>{tag?.name ?? tagId}</Pilula>
              </li>
            );
          })
        )}
        {acao ? <li>{acao}</li> : null}
      </ul>
    </RecordPanel>
  );
}

export { Plus as IconePlus };
