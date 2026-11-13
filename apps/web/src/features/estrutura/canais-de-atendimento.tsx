"use client";

/**
 * CANAIS DE ATENDIMENTO DA LISTA (C36) — a peça que a Lista conversacional
 * usa para dizer por onde atende, ao nascer (dentro do diálogo de criação) e
 * depois (nas Configurações dela, gravando na hora).
 *
 * Quatro linhas, uma por tipo — WhatsApp, E-mail, Instagram, LinkedIn —, cada
 * uma com o seu Toggle. Ligar a linha abre, embaixo dela, as CONTAS já
 * cadastradas a nível global daquele tipo (os Canais de `plataforma.canais`,
 * lidos por `useCanais`), para marcar as que esta Lista usa, e o botão
 * "Adicionar", que abre o popup de escolher uma conta — e de lá leva à página
 * de conectar, o único lugar onde um Canal nasce (D-15-12). Desligar a linha
 * desmarca as contas dela. A Lista
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
 * abrir a conversa. Quem não administra a Lista vê tudo desligado com o motivo
 * dela; quem não pode conectar Canal vê o link de conectar desligado no popup.
 *
 * 5.1.2 (A): um Canal atende em UMA Lista conversacional só, porque a mensagem que chega cria a Tarefa na Lista do
 * Canal. A conta que já atende em OUTRA Lista aparece desligada, com o nome da Lista (`ocupadoEm`); a que esta Lista
 * já marcou continua marcada e se desmarca. O servidor recusa o resto.
 */

import { Check, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useCanais } from "@/dados/crm/canais";
import { useData } from "@/dados/store";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import type { Canal } from "@n1/dominio/crm/canais";
import {
  FORMA_DO_IDENTIFICADOR,
  ROTULO_DO_TIPO_DE_CANAL,
  TIPOS_DE_ATENDIMENTO,
  canalJaAtendidoEmOutraLista,
  listaConversacionalQueAtendePeloCanal,
  type TipoDeAtendimento,
} from "@n1/dominio/operations/canais";
import type { DataState } from "@n1/dominio/state";
import type { Id } from "@n1/dominio/types";
import { Button, ConditionMarker, Icone, Toggle } from "@/features/shell/ui";

const DESCONECTADO = "Desconectado — reconecte nas configurações da Caixa de Entrada.";

/**
 * 5.1.2 (A): por que a conta não se marca nesta Lista — ela já atende em outra Lista conversacional ativa —, ou
 * `undefined` quando se marca. `listaAtualId` é a Lista que está sendo configurada (a que ainda não existe, no diálogo
 * de criar, fica de fora): o que ela mesma já atende não conta como "em outra".
 */
export function motivoDeCanalEmOutraLista(state: DataState, canal: Pick<Canal, "id" | "nome">, listaAtualId?: Id): string | undefined {
  const outra = listaConversacionalQueAtendePeloCanal(state, canal.id, listaAtualId);
  return outra ? canalJaAtendidoEmOutraLista(canal.nome, outra.name) : undefined;
}

const ULTIMO_CANAL = "A Lista precisa de ao menos um canal de atendimento.";

export function CanaisDeAtendimento({
  valor,
  onChange,
  onAdicionar,
  motivo,
  podeFicarVazio = true,
  recente = null,
  ocupadoEm,
}: {
  /** Os ids dos Canais marcados, na ordem em que foram marcados. */
  readonly valor: readonly Id[];
  readonly onChange: (ids: readonly Id[]) => void;
  /** Abre o popup de escolher uma conta daquele tipo. */
  readonly onAdicionar: (tipo: TipoDeAtendimento) => void;
  /** Por que nada aqui muda (quem não administra a Lista): desliga tudo e vira o `title`. */
  readonly motivo?: string;
  /** Nas Configurações, `false`: a última conta marcada não se desmarca. */
  readonly podeFicarVazio?: boolean;
  /** A conta recém-conectada acende como recente. */
  readonly recente?: Id | null;
  /** 5.1.2: o motivo de a conta não se marcar aqui (já atende em outra Lista), ou `undefined`. Ver `motivoDeCanalEmOutraLista`. */
  readonly ocupadoEm?: (canal: Canal) => string | undefined;
}) {
  // Setor e Origem continuam configuração do Espaço (store); a conta em si vem da tabela (D-15-12).
  const filas = useData((data) => data.queues);
  const origens = useData((data) => data.catalog);
  const canaisDaTabela = useCanais({ estado: "ativo", limite: 100 });
  const canais: readonly Canal[] = canaisDaTabela.data?.itens ?? [];
  const marcados = new Set(valor);

  // As linhas abertas: as que têm conta marcada, mais as que a pessoa abriu
  // para olhar. Desligar fecha e desmarca; ligar abre.
  const [abertos, setAbertos] = useState<ReadonlySet<TipoDeAtendimento>>(() => new Set());
  const ligado = (tipo: TipoDeAtendimento) => abertos.has(tipo) || canais.some((c) => c.tipo === tipo && marcados.has(c.id));

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
    const restantes = valor.filter((id) => canais.find((c) => c.id === id)?.tipo !== tipo);
    if (restantes.length !== valor.length) onChange(restantes);
  };

  const alternar = (canal: Canal) => {
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
            contas={canais.filter((c) => c.tipo === tipo)}
            marcados={marcados}
            onLigar={(proximo) => ligar(tipo, proximo)}
            onAlternar={alternar}
            onAdicionar={() => onAdicionar(tipo)}
            {...(motivo ? { motivo } : {})}
            ultimoNaoSai={!podeFicarVazio && valor.length === 1}
            recente={recente}
            {...(ocupadoEm ? { ocupadoEm } : {})}
            filas={filas}
            origens={origens}
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
  ultimoNaoSai,
  recente,
  ocupadoEm,
  filas,
  origens,
}: {
  readonly tipo: TipoDeAtendimento;
  readonly primeira: boolean;
  readonly ligada: boolean;
  readonly contas: readonly Canal[];
  readonly marcados: ReadonlySet<Id>;
  readonly onLigar: (proximo: boolean) => void;
  readonly onAlternar: (canal: Canal) => void;
  readonly onAdicionar: () => void;
  readonly motivo?: string;
  readonly ultimoNaoSai: boolean;
  readonly recente: Id | null;
  readonly ocupadoEm?: (canal: Canal) => string | undefined;
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
                const desconectada = canal.conexao === "desconectada" && !marcado;
                // 5.1.2: a que esta Lista já marcou se desmarca mesmo que o dado antigo a tenha em outra Lista também.
                const emOutraLista = marcado ? undefined : ocupadoEm?.(canal);
                const motivoDaConta = motivo ?? emOutraLista ?? (desconectada ? DESCONECTADO : marcado && ultimoNaoSai ? ULTIMO_CANAL : undefined);
                const fila = canal.filaPadraoId ? filas.find((f) => f.id === canal.filaPadraoId)?.name : undefined;
                const origem = canal.origemPadraoId ? origens.find((o) => o.id === canal.origemPadraoId)?.name : undefined;
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
                          {canal.nome}
                          {canal.conexao === "com_erro" ? <ConditionMarker tone="warning">Com erro</ConditionMarker> : null}
                          {canal.conexao === "desconectada" ? <ConditionMarker tone="danger">Desconectado</ConditionMarker> : null}
                          {emOutraLista ? <ConditionMarker tone="warning">Em outra Lista</ConditionMarker> : null}
                        </span>
                        <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
                          {/* O identificador só aparece quando diz algo que o nome não disse. */}
                          {canal.identificadorExterno !== canal.nome ? (
                            <>
                              <span className="app-numero">{canal.identificadorExterno}</span>
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
              disabled={motivo !== undefined}
              disabledReason={motivo ?? ""}
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
