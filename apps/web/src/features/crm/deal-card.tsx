"use client";

/**
 * O card de Negócio do quadro de `/crm/negocios`, e o que ele lê do Negócio
 * (rosto, empresa, temperatura, origem, dono). É o mesmo card nas Listas de
 * "Meus negócios": lá a Tarefa espelha um Negócio, e o card abre a Tarefa.
 */

import Link from "next/link";
import { Briefcase, Flame, Link2, User as UserIcon, Wallet } from "lucide-react";
import { contactDisplayName, effectiveProbability } from "@n1/dominio/derive";
import type { DataState } from "@n1/dominio/state";
import type { Contact, Deal } from "@n1/dominio/types";
import { ContactAvatar } from "@/features/crm/contact-card";
import { ActorAvatar, Icone, Pilula, StateSeal } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

export interface DealCardData {
  readonly deal: Deal;
  readonly probability: number;
  readonly ownerName: string;
  readonly ownerPhotoFileId?: string;
  readonly companyName?: string;
  readonly contact?: Contact;
  readonly temperature?: { readonly name: string; readonly color?: string };
  readonly originName?: string;
}

/** Tudo o que o card mostra, lido uma vez do estado. */
export function dealCardData(state: DataState, deal: Deal): DealCardData {
  const dono = state.members.find((m) => m.id === deal.ownerMemberId);
  const vinculo = deal.contactLinks.find((l) => l.principal) ?? deal.contactLinks[0];
  const contact = vinculo ? state.contacts.find((c) => c.id === vinculo.contactId) : undefined;
  const temperatura = state.catalog.find((c) => c.id === contact?.temperatureId);
  const origem = state.catalog.find((c) => c.id === deal.originId)?.name;
  const companyName = state.companies.find((c) => c.id === deal.companyId)?.tradeName;
  return {
    deal,
    probability: effectiveProbability(state, deal),
    ownerName: dono?.displayName ?? "—",
    ...(dono?.photoFileId ? { ownerPhotoFileId: dono.photoFileId } : {}),
    ...(companyName ? { companyName } : {}),
    ...(contact ? { contact } : {}),
    ...(temperatura ? { temperature: { name: temperatura.name, ...(temperatura.color ? { color: temperatura.color } : {}) } } : {}),
    ...(origem ? { originName: origem } : {}),
  };
}

export function DealCard({
  data,
  href,
  onOpen,
  onDragStart,
  onDragEnd,
  recente = false,
}: {
  readonly data: DealCardData;
  readonly href: string;
  /** Quando dado, o clique abre aqui (painel) em vez de navegar; o `href` fica para o meio-clique e o leitor de tela. */
  readonly onOpen?: () => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  /** O cartão que acabou de nascer ou mudar de coluna: acende em `--acento-lavado` e apaga (`useRecente`). */
  readonly recente?: boolean;
}) {
  const fmt = useFormat();
  const { deal, probability, ownerName, ownerPhotoFileId, companyName, contact, temperature, originName } = data;
  return (
    // `card-negocio`, não `item-solto`: o arraste briga com o lift do hover.
    <Link
      href={href}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      {...(onOpen
        ? {
            onClick: (event: React.MouseEvent) => {
              if (event.metaKey || event.ctrlKey || event.button !== 0) return;
              event.preventDefault();
              onOpen();
            },
          }
        : {})}
      className="card-negocio block cursor-grab p-3 active:cursor-grabbing"
      data-recente={recente ? "true" : undefined}
    >
      {/*
        O rosto primeiro, depois o que a pessoa é para o Negócio, depois o
        dinheiro, depois quem responde. Cada bloco é separado por linha porque
        são perguntas diferentes: quem é, o quê, quanto, com quem.
      */}
      <div className="flex items-start gap-2.5">
        {contact ? <ContactAvatar contact={contact} size="grande" /> : null}
        <div className="min-w-0 flex-1">
          <p className="ed-subtitulo truncate">
            {contact ? contactDisplayName(contact) : deal.title}
          </p>
          {companyName ? (
            <p className="app-base truncate" style={{ color: "var(--texto-3)" }}>
              {companyName}
            </p>
          ) : null}
        </div>
        <StateSeal state={deal.lifecycle} />
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2">
        {deal.object ? (
          <Pilula tom="neutro" contorno>
            <Icone de={Briefcase} tamanho="xs" style={{ color: "var(--acento)" }} />
            {deal.object}
          </Pilula>
        ) : null}
        {temperature ? (
          <Pilula cor={temperature.color ?? "var(--texto-3)"}>
            <Icone de={Flame} tamanho="xs" />
            {temperature.name}
          </Pilula>
        ) : null}
      </p>

      <div className="mt-3 flex items-center gap-2.5 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
        <span
          aria-hidden="true"
          className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
          style={{
            width: "var(--controle-h-sm)",
            height: "var(--controle-h-sm)",
            background: "var(--superficie-2)",
            color: "var(--acento)",
          }}
        >
          <Icone de={Wallet} tamanho="sm" />
        </span>
        <span className="min-w-0">
          <span className="app-meta block">Valor do negócio</span>
          <span className="app-md app-numero block truncate" style={{ color: "var(--texto)" }}>
            {deal.value ? fmt.money(deal.value) : "sem valor declarado"}
            <span className="ml-1.5" style={{ fontWeight: 400, color: "var(--texto-3)" }}>
              {probability}%
            </span>
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
        <span className="min-w-0">
          <span className="app-meta flex items-center gap-1.5">
            <Icone de={UserIcon} tamanho="xs" />
            Proprietário
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <ActorAvatar
              kind="member"
              name={ownerName}
              {...(ownerPhotoFileId ? { photoFileId: ownerPhotoFileId } : {})}
            />
            <span className="app-base min-w-0 truncate" style={{ color: "var(--texto)" }}>
              {ownerName}
            </span>
          </span>
        </span>
        <span className="min-w-0 pl-2" style={{ borderLeft: "1px solid var(--linha)" }}>
          <span className="app-meta flex items-center gap-1.5">
            <Icone de={Link2} tamanho="xs" />
            Origem
          </span>
          <span className="app-base mt-1 block truncate" style={{ color: "var(--texto)" }}>
            {originName ?? "—"}
          </span>
        </span>
      </div>
    </Link>
  );
}
