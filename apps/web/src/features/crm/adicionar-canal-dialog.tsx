"use client";

/**
 * ADICIONAR CANAL (C36, D-15-12) — escolhe, entre os Canais ativos do Espaço de
 * Trabalho (`plataforma.canais`, por `useCanais`), uma conta para a Lista
 * conversacional atender por ela. O popup NÃO cria Canal: há um caminho só para
 * isso, a página de conectar (`/crm/caixa-de-entrada/configuracoes/canais/conectar`),
 * onde o Canal nasce `desconectada` e só conecta pelo "Simular conexão", sempre
 * marcado. O botão "Conectar um Canal novo" leva até lá.
 *
 * Aberto de dentro do diálogo de criação da Lista (que se apaga enquanto este
 * está no ar — os diálogos não empilham) e das Configurações da Lista. Com
 * `tipo`, a pessoa vê só as contas daquele tipo (a linha que pediu). Quem
 * chamou recebe o id escolhido em `onEscolher` e o marca na Lista; este
 * componente não grava nada. Volta sem escolha a cada abertura.
 *
 * A conta `desconectada` que a Lista ainda não usa aparece, mas não se escolhe:
 * a Conversa não nasceria por ela (a mesma regra da seção de Canais da Lista).
 */

import Link from "next/link";
import { useState } from "react";
import { useCanais } from "@/dados/crm/canais";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { CHANNEL_TYPE_LABEL } from "@/features/shell/format";
import { Button, ConditionMarker, ConfirmDialog } from "@/features/shell/ui";

const PAGINA_DE_CONECTAR = "/crm/caixa-de-entrada/configuracoes/canais/conectar";
const DESCONECTADO = "Desconectado — reconecte nas configurações da Caixa de Entrada.";

export function AdicionarCanalDialog({
  tipo,
  open,
  onClose,
  jaLigados,
  onEscolher,
}: {
  /** O tipo já escolhido (a linha que pediu); sem ele, todas as contas ativas. */
  readonly tipo?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Os ids que a Lista já usa: não se oferecem de novo. */
  readonly jaLigados: readonly string[];
  /** O id do Canal escolhido; quem chamou o marca na Lista. */
  readonly onEscolher: (canalId: string) => void;
}) {
  const canais = useCanais({ estado: "ativo", limite: 100 }, { pausado: !open });
  const recusaDeConectar = usePodeNoCrm("criar", "canal");
  const [escolhido, setEscolhido] = useState("");

  // Cada abertura parte sem escolha.
  const [abertoAntes, setAbertoAntes] = useState(open);
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setEscolhido("");
  }

  const ligados = new Set(jaLigados);
  const opcoes = (canais.data?.itens ?? []).filter((canal) => !ligados.has(canal.id) && (tipo === undefined || canal.tipo === tipo));
  const rotuloDoTipo = tipo ? (CHANNEL_TYPE_LABEL[tipo] ?? tipo) : "Canal";
  const escolhivel = (id: string) => opcoes.some((canal) => canal.id === id && canal.conexao !== "desconectada");

  const conectarNovo =
    recusaDeConectar === undefined ? (
      <Link href={PAGINA_DE_CONECTAR} className="btn btn-sutil btn-sm alvo-toque">
        Conectar um Canal novo
      </Link>
    ) : (
      <Button size="sm" variant="ghost" disabled disabledReason={recusaDeConectar}>
        Conectar um Canal novo
      </Button>
    );

  return (
    <ConfirmDialog
      open={open}
      title={tipo ? `Adicionar ${rotuloDoTipo}` : "Adicionar Canal"}
      description="Escolha uma conta já cadastrada no Espaço de Trabalho para esta Lista atender por ela. Para ligar uma conta nova, conecte-a primeiro na Caixa de Entrada."
      confirmLabel="Marcar nesta Lista"
      confirmDisabledReason={escolhivel(escolhido) ? undefined : "Escolha um Canal."}
      footerStart={conectarNovo}
      wide
      onConfirm={() => {
        if (escolhivel(escolhido)) onEscolher(escolhido);
      }}
      onCancel={onClose}
    >
      {canais.data === undefined ? (
        <p role="status" className="app-sm" style={{ color: "var(--texto-3)" }}>
          {canais.error ? "Não foi possível carregar os Canais. Tente de novo." : "Carregando os Canais…"}
        </p>
      ) : opcoes.length === 0 ? (
        <p role="status" className="app-sm" style={{ color: "var(--texto-3)" }}>
          Nenhum {tipo ? `Canal de ${rotuloDoTipo}` : "Canal"} disponível para marcar. Conecte um Canal novo para começar.
        </p>
      ) : (
        <ul className="pilha-solta" role="radiogroup" aria-label="Canais disponíveis">
          {opcoes.map((canal) => {
            const marcado = canal.id === escolhido;
            const desconectado = canal.conexao === "desconectada";
            return (
              <li key={canal.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  aria-disabled={desconectado}
                  title={desconectado ? DESCONECTADO : undefined}
                  onClick={() => {
                    if (!desconectado) setEscolhido(canal.id);
                  }}
                  className={`item-solto w-full text-left ${desconectado ? "opacity-60" : ""}`}
                  data-destacado={marcado ? "true" : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className="app-base flex flex-wrap items-center gap-2" style={{ color: "var(--texto)" }}>
                      {canal.nome}
                      {canal.conexao === "com_erro" ? <ConditionMarker tone="warning">Com erro</ConditionMarker> : null}
                      {desconectado ? <ConditionMarker tone="danger">Desconectado</ConditionMarker> : null}
                    </span>
                    <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
                      {CHANNEL_TYPE_LABEL[canal.tipo] ?? canal.tipo} · <span className="app-numero">{canal.identificadorExterno}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ConfirmDialog>
  );
}
