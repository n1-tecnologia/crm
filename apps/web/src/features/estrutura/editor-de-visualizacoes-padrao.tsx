"use client";

/**
 * 2.6.2, D-07 — a aba "Visualizações" das Configurações de um Espaço, Pasta ou
 * Lista: quais tipos as Listas abaixo oferecem e qual abre primeiro. Grava na
 * hora, como o `FeaturesEditor`: cada mudança é um `setContainerDefaultViews`.
 *
 * A tela não deixa formar um valor que o domínio recusaria: o tipo que é o
 * INICIAL não se desmarca (a caixa fica desligada, com o motivo à vista), então
 * `disponiveis` nunca esvazia e `inicial` nunca fica fora dele. O que o domínio
 * ainda recusar (permissão, contêiner inativo, ancestral que bloqueia) desliga
 * o editor inteiro com o mesmo motivo.
 */

import { useId, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { setContainerDefaultViews } from "@n1/dominio/operations";
import { blockedAbove } from "@n1/dominio/operations/configuration";
import { containerAdminRefusal, effectiveContainerConfig } from "@n1/dominio/derive";
import { ReadOnlyNote } from "@/features/estrutura/configuration-editors";
import { Button, Toast } from "@/features/shell/ui";
import { ORDEM_DAS_ABAS, ROTULO_DA_ABA, kindDaAba, type TipoDeAba } from "@/features/estrutura/tipo-de-visualizacao";
import type { Id, TipoDeVisualizacao, VisualizacoesPadrao } from "@n1/dominio/types";

type TipoDeConteiner = "space" | "folder" | "list";

const MOTIVO_DO_INICIAL = "É a Visualização inicial. Escolha outra antes de desmarcar.";
const MOTIVO_CONVERSACIONAL = "Não existe em Listas conversacionais.";

const NOME_DO_NIVEL: Record<TipoDeConteiner, { readonly nome: string; readonly arquivado: string }> = {
  space: { nome: "Espaço", arquivado: "arquivado" },
  folder: { nome: "Pasta", arquivado: "arquivada" },
  list: { nome: "Lista", arquivado: "arquivada" },
};

export function EditorDeVisualizacoesPadrao({
  tipo,
  id,
  conversacional,
  desligadoPor,
}: {
  readonly tipo: TipoDeConteiner;
  readonly id: Id;
  /** A Lista conversacional não tem Linha do tempo (a lente da página). No Espaço e na Pasta é sempre `false`. */
  readonly conversacional: boolean;
  /** O motivo de a tela inteira estar desligada, quando o chamador já o conhece. */
  readonly desligadoPor?: string;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const ids = useId();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const container =
    tipo === "space"
      ? state.spaces.find((s) => s.id === id)
      : tipo === "folder"
        ? state.folders.find((f) => f.id === id)
        : state.lists.find((l) => l.id === id);
  const config = effectiveContainerConfig(state, tipo, id);
  if (!container || !config) return null;

  const efetivo: VisualizacoesPadrao = config.views;
  const propria = container.defaultViews !== undefined;
  const nivel = NOME_DO_NIVEL[tipo];
  const bloqueadoAcima = blockedAbove(state, tipo, id, "defaultViews");
  const recusa =
    desligadoPor ??
    containerAdminRefusal(state, memberId, tipo, id) ??
    (container.lifecycle === "arquivado"
      ? `${nivel.nome} ${nivel.arquivado}: desarquive antes de editar.`
      : container.lifecycle === "naLixeira"
        ? `${nivel.nome} na lixeira: restaure antes de editar.`
        : undefined);
  const desligado = recusa ?? bloqueadoAcima;

  const gravar = (valor: VisualizacoesPadrao | null, sucesso: string): void => {
    const resultado = run((data, me) => setContainerDefaultViews(data, me, tipo, id, valor));
    if (resultado.ok) {
      setErro(null);
      setAviso(sucesso);
    } else {
      setAviso(null);
      setErro(resultado.error);
    }
  };

  const disponivel = (aba: TipoDeAba): boolean => efetivo.disponiveis.includes(kindDaAba(aba));
  const ehInicial = (aba: TipoDeAba): boolean => efetivo.inicial === kindDaAba(aba);

  const alternar = (aba: TipoDeAba, ligar: boolean): void => {
    const kind = kindDaAba(aba);
    const disponiveis: TipoDeVisualizacao[] = ORDEM_DAS_ABAS.map(kindDaAba).filter((outro) =>
      outro === kind ? ligar : efetivo.disponiveis.includes(outro),
    );
    gravar({ disponiveis, inicial: efetivo.inicial }, "Visualizações padrão alteradas.");
  };

  const escolherInicial = (aba: TipoDeAba): void => {
    gravar({ disponiveis: [...efetivo.disponiveis], inicial: kindDaAba(aba) }, "Visualizações padrão alteradas.");
  };

  return (
    <div className="grid gap-2">
      {aviso ? (
        <Toast tone="success" onDismiss={() => setAviso(null)}>
          {aviso}
        </Toast>
      ) : null}
      {erro ? (
        <Toast tone="error" onDismiss={() => setErro(null)}>
          {erro}
        </Toast>
      ) : null}
      {/* O motivo de um ancestral bloquear mora na linha de origem da aba (CabecalhoDoAspecto): repeti-lo aqui seria a mesma frase duas vezes. */}
      <ReadOnlyNote reason={recusa} />

      <div role="radiogroup" aria-label="Visualização inicial">
        <div className="app-sm flex items-center gap-2 px-3 pb-1" style={{ color: "var(--texto-3)" }} aria-hidden="true">
          <span className="min-w-0 flex-1" />
          <span className="w-24 text-center">Disponível</span>
          <span className="w-24 text-center">Inicial</span>
        </div>
        <ul className="pilha-solta">
          {ORDEM_DAS_ABAS.map((aba) => {
            const rotulo = ROTULO_DA_ABA[aba];
            const foraDaLente = conversacional && aba === "linha";
            const inicial = ehInicial(aba);
            const marcada = disponivel(aba);
            const motivo = foraDaLente ? MOTIVO_CONVERSACIONAL : inicial ? MOTIVO_DO_INICIAL : undefined;
            const idCaixa = `${ids}-caixa-${aba}`;
            const idMotivo = `${ids}-motivo-${aba}`;
            return (
              <li key={aba} className="item-solto flex-wrap" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                <label htmlFor={idCaixa} className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }} title={rotulo}>
                  {rotulo}
                </label>
                <span className="flex w-24 justify-center">
                  <input
                    id={idCaixa}
                    type="checkbox"
                    checked={marcada}
                    disabled={desligado !== undefined || foraDaLente || inicial}
                    {...(motivo ? { "aria-describedby": idMotivo } : {})}
                    onChange={(event) => alternar(aba, event.target.checked)}
                    className="size-4 accent-[var(--acento)]"
                  />
                </span>
                <span className="flex w-24 justify-center">
                  <input
                    type="radio"
                    name={`${ids}-inicial`}
                    aria-label={`Inicial: ${rotulo}`}
                    checked={inicial}
                    disabled={desligado !== undefined || foraDaLente || !marcada}
                    onChange={() => escolherInicial(aba)}
                    className="size-4 accent-[var(--acento)]"
                  />
                </span>
                {motivo ? (
                  <span id={idMotivo} className="app-sm basis-full" style={{ color: "var(--texto-3)" }}>
                    {motivo}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {propria && desligado === undefined ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => gravar(null, "Visualizações padrão voltaram a ser herdadas.")}>
            Voltar a herdar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
