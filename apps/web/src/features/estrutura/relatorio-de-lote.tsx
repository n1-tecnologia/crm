"use client";

/**
 * `RelatorioDeLotePainel` — os quatro resultados de `ItemDeLote`
 * (`alterada`/`jaEstava`/`recusada`/`parcial`) que `alterarStatusEmLote`
 * (Plan 03-12) devolve, com `parcial` num bloco próprio: nem sucesso nem
 * erro — a conta fechou e a ocorrência do mês seguinte não nasceu.
 *
 * **Arquivo separado de `bulk-status-bar.tsx`, e isso é a mitigação de
 * T-3-55, não organização.** Se este painel vivesse dentro da barra, ele
 * teria a lista de Tarefas ao alcance e uma busca por id ali dentro para
 * "melhorar" o rótulo — exatamente o que o código antigo fazia (a linha
 * que este plano removeu) e exatamente o que 03-12 proibiu ao omitir
 * `titulo`/`readableId` dos itens que o Membro não enxerga. Este componente
 * não recebe a coleção de Tarefas, não lê o estado do domínio, não tem como
 * procurar uma Tarefa pelo id — o atalho não existe aqui, e um `grep` prova
 * isso.
 *
 * O rótulo de cada item é `item.titulo ?? item.readableId ?? "Conta sem
 * acesso"`; o `motivo` é exibido LITERALMENTE, sem prefixo, sem reescrita —
 * já vem em pt-BR do domínio nomeando Campo e Membro, nunca valor.
 */

import { useState } from "react";
import { useLastResult } from "@/dados/store";
import { Button, CabecalhoDePainel, Painel, Pilula } from "@/features/shell/ui";
import type { ItemDeLote, RelatorioDeLote } from "@n1/dominio/operations/lote";

/** Quando os dois faltam é porque o domínio decidiu não contar a quem não
 * pode ver que a Tarefa existe e como ela se chama (T-3-45 de 03-12). */
function rotuloDoItem(item: ItemDeLote): string {
  return item.titulo ?? item.readableId ?? "Conta sem acesso";
}

export function RelatorioDeLotePainel({
  relatorio,
  nomeDoStatus,
  onFechar,
  onAbrirConta,
}: {
  readonly relatorio: RelatorioDeLote;
  readonly nomeDoStatus: string;
  readonly onFechar: () => void;
  readonly onAbrirConta?: (taskId: string) => void;
}) {
  // O instante em que ESTE relatório apareceu na tela — a âncora que decide
  // se um `lastResult` é uma resposta do servidor sobre ESTE lote (T-3-61) ou
  // um eco de uma operação anterior. `run()` devolve o resultado calculado
  // sobre a cópia local (D-05) e `enviar()` corre sem `await` (D-06): sem
  // este relógio, uma recusa do servidor ou um 409 depois de um lote de 61
  // não apareceria em lugar nenhum desta tela.
  const [mostradoEm] = useState(() => Date.now());
  const lastResult = useLastResult();
  const erroDoServidor = lastResult && !lastResult.ok && lastResult.at > mostradoEm ? lastResult.error : undefined;

  const parciais = relatorio.itens.filter((item) => item.resultado === "parcial");
  const recusadas = relatorio.itens.filter((item) => item.resultado === "recusada");

  return (
    <Painel>
      <CabecalhoDePainel titulo="Resultado do lote" contagem={`${relatorio.solicitadas} solicitada(s)`} />
      <div className="p-3 grid gap-3">
        {erroDoServidor ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            O servidor recusou depois: {erroDoServidor} — o relatório abaixo é o valor calculado localmente pelo
            domínio no momento do clique.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Pilula tom="sucesso" comPonto>
            {relatorio.alteradas} alterada(s)
          </Pilula>
          <Pilula cor="var(--texto-4)" comPonto>
            {relatorio.jaEstavam} já estava(m)
          </Pilula>
          <Pilula tom="erro" comPonto>
            {relatorio.recusadas} recusada(s)
          </Pilula>
          <Pilula tom="aviso" comPonto>
            {relatorio.parciais} parcial(is)
          </Pilula>
        </div>

        {relatorio.alteradas > 0 ? (
          <p className="app-base" style={{ color: "var(--texto-2)" }}>
            {relatorio.ocorrenciasCriadas} ocorrência(s) do mês seguinte criada(s).
          </p>
        ) : null}

        {relatorio.jaEstavam > 0 ? (
          <p className="app-base" style={{ color: "var(--texto-3)" }}>
            {relatorio.jaEstavam} já estava(m) em “{nomeDoStatus}” — nada foi alterado nelas: statusId, Registro e
            Automações de entrada não foram regravados.
          </p>
        ) : null}

        {parciais.length > 0 ? (
          <div className="grid gap-2 rounded-[var(--r-controle)] p-3" style={{ background: "var(--aviso-lavado)" }}>
            <p className="app-base" style={{ color: "var(--aviso)" }}>
              A conta mudou de Status; a ocorrência do mês seguinte não foi criada. Repetir o lote não a criaria — o
              conserto é abrir a conta e recriar a recorrência à mão.
            </p>
            <ul className="grid gap-1">
              {parciais.map((item) => (
                <li key={item.taskId} className="app-base flex flex-wrap items-baseline gap-2" style={{ color: "var(--texto)" }}>
                  <span style={{ color: "var(--texto-2)" }}>{rotuloDoItem(item)}</span>
                  <span>{item.motivo}</span>
                  {onAbrirConta ? (
                    <Button size="sm" variant="ghost" onClick={() => onAbrirConta(item.taskId)}>
                      Abrir conta
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {recusadas.length > 0 ? (
          <div className="grid gap-2">
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              Estas contas não mudaram e continuam selecionadas para corrigir e repetir.
            </p>
            <ul className="grid gap-1">
              {recusadas.map((item) => (
                <li key={item.taskId} className="app-base flex flex-wrap items-baseline gap-2" style={{ color: "var(--texto)" }}>
                  <span style={{ color: "var(--texto-2)" }}>{rotuloDoItem(item)}</span>
                  <span>{item.motivo}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Painel>
  );
}
