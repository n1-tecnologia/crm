"use client";

/**
 * Logs e Dashboard do Agente: leitura das Execuções que ele já fez. São dos
 * registros, não do rascunho — por isso só têm conteúdo quando o Construtor
 * está editando um Agente publicado; um Agente que ainda não existe não tem
 * histórico, e a tela diz isso em vez de mostrar zeros.
 */

import Link from "next/link";
import { useData } from "@/data/store";
import { EXECUTION_ORIGIN_LABEL, EXECUTION_STATE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";

const ESTADO_COR: Record<string, string> = {
  concluida: "bg-[var(--cor-sucesso)]",
  falhou: "bg-[var(--cor-perigo)]",
  cancelada: "bg-[var(--ab-texto-3)]",
  aguardandoAprovacao: "bg-[var(--ab-alteracao)]",
  executando: "bg-[var(--ab-roxo)]",
  pendente: "bg-[var(--ab-texto-3)]",
};

function useExecucoes(agentId: string | null) {
  const execucoes = useData((data) => data.agentExecutions);
  return agentId
    ? execucoes.filter((e) => e.agentId === agentId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    : [];
}

export function AgentLogs({ agentId }: { readonly agentId: string | null }) {
  const fmt = useFormat();
  const execucoes = useExecucoes(agentId);

  if (!agentId) {
    return (
      <p className="text-[13px] text-[var(--ab-texto-3)]">
        Os logs aparecem depois de publicar: cada resposta do agente vira uma Execução registrada aqui.
      </p>
    );
  }
  if (execucoes.length === 0) {
    return <p className="text-[13px] text-[var(--ab-texto-3)]">Nenhuma Execução deste agente ainda.</p>;
  }
  const visiveis = execucoes.slice(0, 8);
  return (
    <div className="grid gap-2">
      <ol className="grid gap-1.5">
        {visiveis.map((execucao) => (
          <li key={execucao.id}>
            <Link
              href={`/ia/execucoes/${execucao.id}`}
              className="flex items-center gap-3 rounded-[8px] border border-[var(--ab-borda)] px-3 py-2 transition-colors hover:bg-[var(--ab-elevado)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${ESTADO_COR[execucao.state] ?? "bg-[var(--ab-texto-3)]"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[var(--ab-texto)]">{execucao.input}</span>
                <span className="block text-[12px] text-[var(--ab-texto-3)]">
                  {EXECUTION_STATE_LABEL[execucao.state] ?? execucao.state} · {EXECUTION_ORIGIN_LABEL[execucao.origin] ?? execucao.origin} · v{execucao.agentVersion}
                  {execucao.rehearsal ? " · ensaio" : ""}
                </span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-[var(--ab-texto-3)]">
                {fmt.instant(execucao.startedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {execucoes.length > visiveis.length ? (
        <p className="text-[12px] text-[var(--ab-texto-3)]">
          As {visiveis.length} mais recentes de {execucoes.length}.{" "}
          <Link href={`/ia/agentes/${agentId}`} className="text-[var(--ab-roxo)] hover:underline">
            Ver todas na ficha
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

export function AgentDashboard({ agentId }: { readonly agentId: string | null }) {
  const fmt = useFormat();
  const execucoes = useExecucoes(agentId);
  const sessoes = useData((data) => data.chatSessions).filter(
    (s) => agentId !== null && s.mainAgentId === agentId && s.lifecycle !== "naLixeira",
  );

  if (!agentId) {
    return (
      <p className="text-[13px] text-[var(--ab-texto-3)]">
        O dashboard mede o agente publicado: Execuções, resultados, Ferramentas usadas e Sessões de Chat.
      </p>
    );
  }

  const total = execucoes.length;
  const concluidas = execucoes.filter((e) => e.state === "concluida").length;
  const falhas = execucoes.filter((e) => e.state === "falhou").length;
  const aguardando = execucoes.filter((e) => e.state === "aguardandoAprovacao").length;
  const chamadas = execucoes.reduce((soma, e) => soma + e.cost.toolCalls, 0);
  const unidades = execucoes.reduce((soma, e) => soma + e.cost.modelUnits, 0);
  const duracaoMedia = total > 0 ? Math.round(execucoes.reduce((s, e) => s + e.cost.durationMs, 0) / total / 100) / 10 : 0;
  const ultima = execucoes[0];

  const cartoes = [
    { rotulo: "Execuções", valor: fmt.number(total) },
    { rotulo: "Concluídas", valor: total > 0 ? `${Math.round((concluidas / total) * 100)}%` : "—", detalhe: `${concluidas} de ${total}` },
    { rotulo: "Falhas", valor: fmt.number(falhas) },
    { rotulo: "Aguardando aprovação", valor: fmt.number(aguardando) },
    { rotulo: "Chamadas de Ferramenta", valor: fmt.number(chamadas) },
    { rotulo: "Unidades de Modelo", valor: fmt.number(unidades) },
    { rotulo: "Duração média", valor: total > 0 ? `${fmt.number(duracaoMedia)} s` : "—" },
    { rotulo: "Sessões de Chat", valor: fmt.number(sessoes.length) },
  ];

  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-2 gap-2">
        {cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="rounded-[8px] border border-[var(--ab-borda)] bg-[var(--ab-campo)] px-3 py-2">
            <dt className="text-[12px] text-[var(--ab-texto-3)]">{cartao.rotulo}</dt>
            <dd className="text-[18px] font-semibold tabular-nums text-[var(--ab-texto)]">{cartao.valor}</dd>
            {cartao.detalhe ? <dd className="text-[11px] text-[var(--ab-texto-3)]">{cartao.detalhe}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-[var(--ab-texto-3)]">
        {ultima
          ? `Última Execução ${fmt.relative(ultima.startedAt)} (${EXECUTION_STATE_LABEL[ultima.state] ?? ultima.state}).`
          : "Nenhuma Execução ainda: os números acima nascem da primeira."}
      </p>
    </div>
  );
}
