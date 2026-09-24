"use client";

/**
 * CANAIS DE ATENDIMENTO DA LISTA (C36) — a peça que a Lista conversacional
 * usa para dizer por onde atende, ao nascer (dentro do diálogo de criação) e
 * depois (nas Configurações dela, gravando na hora).
 *
 * Quatro linhas, uma por tipo — WhatsApp, E-mail, Instagram, LinkedIn —, cada
 * uma com o seu Toggle. Ligar a linha abre, embaixo dela, as CONTAS já
 * conectadas a nível global daquele tipo (os Canais do Espaço de Trabalho),
 * para marcar as que esta Lista usa, e o botão "Adicionar" que conecta uma
 * conta nova ali mesmo. Desligar a linha desmarca as contas dela. A Lista
 * guarda só os ids dos Canais marcados; as linhas ligadas são derivadas deles
 * — mais o que a pessoa abriu para olhar e ainda não marcou.
 *
 * O desenho da linha é o da `CaixaDeConfiguracoes` (Selo, título, dica,
 * Toggle), reproduzido porque ela não aceita conteúdo sob a linha. As contas
 * são `role="checkbox"` com a `.caixa` do sistema — não há `<input>` de
 * checkbox como primitiva; a peça inteira (nome, identificador, setor e
 * origem) é o alvo do clique, como o `SeletorDeModelo`.
 *
 * Uma conta `desconectada` que ainda não está marcada não se marca aqui: a
 * conversa não nasceria por ela. Uma que JÁ está marcada e caiu continua
 * marcada, com o aviso — a conexão é transitória, e é o domínio quem recusa
 * abrir a conversa. Quem não administra o Espaço de Trabalho vê "Adicionar"
 * desligado com o motivo (B35); quem não administra a Lista vê tudo
 * desligado com o motivo dela.
 */

import { Check, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useData } from "@/data/store";
import { useSession } from "@/data/store";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { FORMA_DO_IDENTIFICADOR, ROTULO_DO_TIPO_DE_CANAL, TIPOS_DE_ATENDIMENTO, recusaDeGerirCanais, type TipoDeAtendimento } from "@/data/operations/canais";
import type { Channel, Id } from "@/data/types";
import { Button, ConditionMarker, Icone, Toggle } from "@/features/shell/ui";

const DESCONECTADO = "Desconectado — reconecte nas configurações da Caixa de Entrada.";
const ULTIMO_CANAL = "A Lista precisa de ao menos um canal de atendimento.";

export function CanaisDeAtendimento({
  valor,
  onChange,
  onAdicionar,
  motivo,
  podeFicarVazio = true,
  recente = null,
}: {
  /** Os ids dos Canais marcados, na ordem em que foram marcados. */
  readonly valor: readonly Id[];
  readonly onChange: (ids: readonly Id[]) => void;
  /** Abre o popup de conectar uma conta nova daquele tipo. */
  readonly onAdicionar: (tipo: TipoDeAtendimento) => void;
  /** Por que nada aqui muda (quem não administra a Lista): desliga tudo e vira o `title`. */
  readonly motivo?: string;
  /** Nas Configurações, `false`: a última conta marcada não se desmarca. */
  readonly podeFicarVazio?: boolean;
  /** A conta recém-conectada acende como recente. */
  readonly recente?: Id | null;
}) {
  const state = useData((data) => data);
  const session = useSession();
  const canais = state.channels.filter((c) => c.lifecycle === "ativo");
  const marcados = new Set(valor);
  const recusaDeAdicionar = recusaDeGerirCanais(state, session.memberId);

  // As linhas abertas: as que têm conta marcada, mais as que a pessoa abriu
  // para olhar. Desligar fecha e desmarca; ligar abre.
  const [abertos, setAbertos] = useState<ReadonlySet<TipoDeAtendimento>>(() => new Set());
  const ligado = (tipo: TipoDeAtendimento) => abertos.has(tipo) || canais.some((c) => c.channelType === tipo && marcados.has(c.id));

  const ligar = (tipo: TipoDeAtendimento, proximo: boolean) => {
    if (proximo) {
      setAbertos((atual) => new Set([...atual, tipo]));
      return;
    }
    setAbertos((atual) => {
      const copia = new Set(atual);
      copia.delete(tipo);
      return copia;
    });
    const restantes = valor.filter((id) => canais.find((c) => c.id === id)?.channelType !== tipo);
    if (restantes.length !== valor.length) onChange(restantes);
  };

  const alternar = (canal: Channel) => {
    if (marcados.has(canal.id)) onChange(valor.filter((id) => id !== canal.id));
    else onChange([...valor, canal.id]);
  };

  return (
    <div className="grid gap-1.5" title={motivo}>
      <span className="rotulo">Canais de atendimento</span>
      <div className="painel">
        {TIPOS_DE_ATENDIMENTO.map((tipo, i) => (
          <LinhaDeTipo
            key={tipo}
            tipo={tipo}
            primeira={i === 0}
            ligada={ligado(tipo)}
            contas={canais.filter((c) => c.channelType === tipo)}
            marcados={marcados}
            onLigar={(proximo) => ligar(tipo, proximo)}
            onAlternar={alternar}
            onAdicionar={() => onAdicionar(tipo)}
            {...(motivo ? { motivo } : {})}
            {...(recusaDeAdicionar ? { motivoDeAdicionar: recusaDeAdicionar } : {})}
            ultimoNaoSai={!podeFicarVazio && valor.length === 1}
            recente={recente}
            filas={state.queues}
            origens={state.catalog}
          />
        ))}
      </div>
      <p className="ajuda">
        As contas são as conectadas no Espaço de Trabalho; o setor e a origem são de cada conta. Chat do site não atende Lista: ele nasce de visitante anônimo.
      </p>
    </div>
  );
}

function LinhaDeTipo({
  tipo,
  primeira,
  ligada,
  contas,
  marcados,
  onLigar,
  onAlternar,
  onAdicionar,
  motivo,
  motivoDeAdicionar,
  ultimoNaoSai,
  recente,
  filas,
  origens,
}: {
  readonly tipo: TipoDeAtendimento;
  readonly primeira: boolean;
  readonly ligada: boolean;
  readonly contas: readonly Channel[];
  readonly marcados: ReadonlySet<Id>;
  readonly onLigar: (proximo: boolean) => void;
  readonly onAlternar: (canal: Channel) => void;
  readonly onAdicionar: () => void;
  readonly motivo?: string;
  readonly motivoDeAdicionar?: string;
  readonly ultimoNaoSai: boolean;
  readonly recente: Id | null;
  readonly filas: ReadonlyArray<{ readonly id: Id; readonly name: string }>;
  readonly origens: ReadonlyArray<{ readonly id: Id; readonly name: string; readonly kind: string }>;
}) {
  const labelId = useId();
  const hintId = useId();
  const rotulo = ROTULO_DO_TIPO_DE_CANAL[tipo];
  const IconeDoTipo = CHANNEL_ICON[tipo];
  const quantas = contas.filter((c) => marcados.has(c.id)).length;
  const dica = ligada
    ? quantas === 0
      ? `Marque as contas de ${rotulo} por onde esta Lista atende.`
      : `${quantas} ${quantas === 1 ? "conta marcada" : "contas marcadas"}.`
    : `Atender por ${rotulo}.`;
  // A linha não desliga se levaria embora o último canal da Lista.
  const motivoDeDesligar = ligada && ultimoNaoSai && quantas === 1 ? ULTIMO_CANAL : undefined;
  const travada = motivo ?? motivoDeDesligar;

  return (
    <div style={primeira ? undefined : { borderTop: "1px solid var(--linha)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5" title={travada}>
        {/* O selo à mão: os ícones de Canal (Instagram, LinkedIn) não são do Lucide, e o `Selo` só aceita esses. */}
        <span
          aria-hidden="true"
          className="grid shrink-0 place-items-center rounded-[var(--r-controle)]"
          style={{ width: "var(--controle-h-sm)", height: "var(--controle-h-sm)", background: ligada ? "var(--acento-lavado)" : "var(--superficie-2)", color: ligada ? "var(--acento)" : "var(--texto-2)" }}
        >
          <IconeDoTipo className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span id={labelId} className="app-base block" style={{ color: "var(--texto)" }}>
            {rotulo}
          </span>
          <span id={hintId} className="app-sm block" style={{ color: "var(--texto-3)" }}>
            {travada ?? dica}
          </span>
        </span>
        <Toggle checked={ligada} onChange={onLigar} labelledBy={labelId} describedBy={hintId} disabled={travada !== undefined} />
      </div>

      {ligada ? (
        <div className="grid gap-2 px-3 pb-3">
          {contas.length === 0 ? (
            <p className="app-sm" style={{ color: "var(--texto-3)" }}>
              Nenhuma conta de {rotulo} conectada.
            </p>
          ) : (
            <ul className="pilha-solta" role="group" aria-label={`Contas de ${rotulo}`}>
              {contas.map((canal) => {
                const marcado = marcados.has(canal.id);
                const desconectada = canal.connection === "desconectada" && !marcado;
                const motivoDaConta = motivo ?? (desconectada ? DESCONECTADO : marcado && ultimoNaoSai ? ULTIMO_CANAL : undefined);
                const fila = canal.defaultQueueId ? filas.find((f) => f.id === canal.defaultQueueId)?.name : undefined;
                const origem = canal.defaultOriginId ? origens.find((o) => o.id === canal.defaultOriginId)?.name : undefined;
                return (
                  <li key={canal.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={marcado}
                      aria-disabled={motivoDaConta !== undefined}
                      onClick={() => {
                        if (motivoDaConta === undefined) onAlternar(canal);
                      }}
                      title={motivoDaConta}
                      className={`item-solto w-full text-left ${motivoDaConta ? "opacity-60" : ""}`}
                      data-destacado={marcado ? "true" : undefined}
                      data-recente={recente === canal.id ? "true" : undefined}
                    >
                      <span className="caixa" data-state={marcado ? "checked" : "unchecked"} {...(motivoDaConta ? { "data-disabled": "true" } : {})} aria-hidden="true">
                        {marcado ? <Icone de={Check} tamanho="xs" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="app-base flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
                          {canal.name}
                          {canal.connection === "comErro" ? <ConditionMarker tone="warning">Com erro</ConditionMarker> : null}
                          {canal.connection === "desconectada" ? <ConditionMarker tone="danger">Desconectado</ConditionMarker> : null}
                        </span>
                        <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
                          {/* O identificador só aparece quando diz algo que o nome não disse. */}
                          {canal.externalId !== canal.name ? (
                            <>
                              <span className="app-numero">{canal.externalId}</span>
                              {" · "}
                            </>
                          ) : null}
                          Setor: {fila ?? "nenhum"} · Origem: {origem ?? "nenhuma"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <span>
            <Button
              size="sm"
              variant="ghost"
              icon={<Icone de={Plus} tamanho="xs" />}
              onClick={onAdicionar}
              disabled={(motivo ?? motivoDeAdicionar) !== undefined}
              disabledReason={motivo ?? motivoDeAdicionar ?? ""}
            >
              Adicionar {rotulo}
            </Button>
            <span className="app-sm ml-2" style={{ color: "var(--texto-4)" }}>
              {FORMA_DO_IDENTIFICADOR[tipo].rotulo.toLocaleLowerCase("pt-BR")}: {FORMA_DO_IDENTIFICADOR[tipo].exemplo}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
