"use client";

/**
 * O card de Negócio do quadro de `/crm/negocios`, e o que ele lê do Negócio
 * (rosto, empresa, temperatura, origem, dono). É o mesmo card nas Listas de
 * "Meus negócios": lá a Tarefa espelha um Negócio, e o card abre a Tarefa.
 *
 * É o MODELO do quadro padrão (`features/shell/quadro.tsx`): desde o fim de
 * 2026-09-23 todo quadro do app usa a anatomia dele ("tudo que for quadro, a
 * visualização deve ser igual à da segunda imagem").
 */

import { Briefcase, Flame, Link2, User as UserIcon, Wallet } from "lucide-react";
import { contactDisplayName, effectiveProbability } from "@n1/dominio/derive";
import type { DataState } from "@n1/dominio/state";
import type { Contact, Deal } from "@n1/dominio/types";
import { ContactAvatar } from "@/features/crm/contact-card";
import { CartaoDeQuadro } from "@/features/shell/quadro";
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
  const pilulas =
    deal.object || temperature ? (
      <>
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
      </>
    ) : null;
  return (
    <CartaoDeQuadro
      href={href}
      {...(onOpen ? { onOpen } : {})}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      recente={recente}
      rosto={contact ? <ContactAvatar contact={contact} size="grande" /> : undefined}
      titulo={contact ? contactDisplayName(contact) : deal.title}
      subtitulo={companyName}
      selo={<StateSeal state={deal.lifecycle} />}
      pilulas={pilulas}
      destaque={{
        icone: Wallet,
        rotulo: "Valor do negócio",
        valor: deal.value ? fmt.money(deal.value) : "sem valor declarado",
        complemento: `${probability}%`,
        vazio: !deal.value,
      }}
      rodape={[
        {
          icone: UserIcon,
          rotulo: "Proprietário",
          avatar: <ActorAvatar kind="member" name={ownerName} {...(ownerPhotoFileId ? { photoFileId: ownerPhotoFileId } : {})} />,
          valor: ownerName,
        },
        { icone: Link2, rotulo: "Origem", valor: originName ?? "—", vazio: !originName },
      ]}
    />
  );
}
