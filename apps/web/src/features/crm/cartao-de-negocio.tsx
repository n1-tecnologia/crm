"use client";

/**
 * O cartão de Negócio do quadro de `/crm/negocios` lido da api: o mesmo corpo
 * do `DealCard` (rosto, título, destaque com o valor e a probabilidade, rodapé
 * em duas colunas) sobre `CartaoDeQuadro`, mas alimentado por `NegocioResumo`
 * — o modelo novo — em vez do `Deal` do store. `DealCard` continua das Listas
 * conversacionais e da ficha antiga; este é o do quadro das Etapas do Funil.
 *
 * O `ActionMenu` mora FORA do link do cartão (um botão dentro de `<a>` não é
 * HTML válido): o cartão ocupa o espaço, o menu fica sobreposto no canto, e o
 * título reserva a largura dele. Tudo o que a api devolve entra como texto
 * React; nada vira HTML.
 */

import type { ComponentProps } from "react";
import { Briefcase, Building2, CalendarDays, User as UserIcon, Wallet } from "lucide-react";
import type { NegocioResumo } from "@n1/dominio/crm/negocios";
import { useNomeDoMembro } from "@/dados/crm/sessao";
import { CartaoDeQuadro, RostoDeIcone } from "@/features/shell/quadro";
import { ActionMenu, ActorAvatar } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** Um item do menu do cartão; o barril não exporta o tipo, deriva-se do componente. */
export type AcaoDoCartao = ComponentProps<typeof ActionMenu>["items"][number];

export function CartaoDeNegocio({
  negocio,
  href,
  recente = false,
  arrastavel,
  onDragStart,
  onDragEnd,
  acoes,
}: {
  readonly negocio: NegocioResumo;
  readonly href: string;
  /** O cartão que acabou de mudar de coluna: acende em `--acento-lavado` e apaga. */
  readonly recente?: boolean;
  /** D-14: quem só consulta (Convidado) não arrasta. */
  readonly arrastavel: boolean;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  /** Abrir, Ganhar, Perder e "Mover para …": o que o Papel alcança. */
  readonly acoes: ReadonlyArray<AcaoDoCartao>;
}) {
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  const dono = negocio.empresa ?? negocio.contato;
  const nomeDoProprietario = nomeDoMembro(negocio.proprietarioId);
  const valor = negocio.valor === null ? null : fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda });

  return (
    <div
      className="relative"
      // Sem permissão o cartão não arrasta: o `draggable` é do `CartaoDeQuadro`, o veto é daqui.
      onDragStartCapture={(evento) => {
        if (!arrastavel) evento.preventDefault();
      }}
    >
      <CartaoDeQuadro
        href={href}
        recente={recente}
        onDragStart={() => {
          if (arrastavel) onDragStart();
        }}
        onDragEnd={onDragEnd}
        rosto={
          <RostoDeIcone
            icone={negocio.empresa ? Building2 : negocio.contato ? UserIcon : Briefcase}
            cor="var(--acento)"
            lavado="var(--acento-lavado)"
          />
        }
        titulo={<span title={negocio.titulo}>{negocio.titulo}</span>}
        subtitulo={dono ? <span title={dono.nome}>{dono.nome}</span> : undefined}
        // Reserva o canto do menu: o título trunca antes dele.
        selo={acoes.length > 0 ? <span aria-hidden="true" className="block size-7 shrink-0" /> : undefined}
        destaque={{
          icone: Wallet,
          rotulo: "Valor do negócio",
          valor: valor ?? "sem valor declarado",
          complemento: `${negocio.probabilidadeEfetiva}%`,
          vazio: valor === null,
        }}
        rodape={[
          {
            icone: UserIcon,
            rotulo: "Proprietário",
            avatar: <ActorAvatar kind="member" name={nomeDoProprietario} />,
            valor: nomeDoProprietario,
            vazio: nomeDoProprietario === "—",
          },
          {
            icone: CalendarDays,
            rotulo: "Previsão",
            valor: negocio.dataPrevistaFechamento ? fmt.civilDate(negocio.dataPrevistaFechamento) : "sem data",
            vazio: !negocio.dataPrevistaFechamento,
          },
        ]}
      />
      {acoes.length > 0 ? (
        <div className="absolute right-2 top-2 z-10">
          <ActionMenu label={`Ações de ${negocio.titulo}`} items={acoes} />
        </div>
      ) : null}
    </div>
  );
}
