"use client";

/**
 * D02 — Remover Etapa com remapeamento, aberto por `?remapear-etapa=<etapa>`.
 *
 * RN-FUN-10 — remover uma Etapa exige remapear TODO Negócio que a referencia,
 * em qualquer situação e estado, inclusive os que estão na lixeira. O
 * remapeamento preserva a probabilidade ajustada à mão de cada Negócio
 * (RN-FUN-08, DO-NEG-05).
 *
 * D-07: a fonte é a api. A Etapa e as contagens vêm de `GET /funis/:id`
 * (`useFunil`), o ato é `POST /etapas/:id/remapear` e a recusa aparece no
 * próprio diálogo, que continua aberto. Sem Negócio na Etapa não há o que
 * mover: a remoção é `DELETE /etapas/:id`.
 *
 * A contagem por situação e por estado aparece antes do ato porque é ela que
 * mostra o tamanho real do que se está mexendo: um Funil "vazio" pode ter
 * dezenas de Negócios encerrados apontando para a Etapa.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { remapearEtapa, removerEtapa, useFunil } from "@/dados/crm/funis";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { CabecalhoDePainel, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";

export const REMOVE_STAGE_PARAM = "remapear-etapa";

export function useRemoveStageDialog(): {
  readonly removingStageId: string | null;
  readonly openRemoveStage: (stageId: string) => void;
  readonly closeRemoveStage: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    removingStageId: query.get(REMOVE_STAGE_PARAM),
    openRemoveStage: (stageId) => {
      const next = new URLSearchParams(query.toString());
      next.set(REMOVE_STAGE_PARAM, stageId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeRemoveStage: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(REMOVE_STAGE_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

const plural = (n: number, singular: string, plurais: string): string => `${n} ${n === 1 ? singular : plurais}`;

export function RemoveStageDialog({
  funilId,
  etapaId,
  onClose,
  onDone,
}: {
  readonly funilId: string;
  readonly etapaId: string | null;
  readonly onClose: () => void;
  readonly onDone: (mensagem: string) => void;
}) {
  // Aberto só com uma Etapa na URL: fechado, o diálogo não lê nada da api.
  const { data } = useFunil(etapaId === null ? undefined : funilId);
  const [destinoId, setDestinoId] = useState("");
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const etapa = data?.etapas.find((candidata) => candidata.id === etapaId);
  if (!data || !etapa) return null;

  // RN-NEG-17: todo Negócio conta, inclusive os da lixeira. As contagens vêm da api.
  const { abertos, ganhos, perdidos, arquivados, naLixeira, total } = etapa.negocios;
  const outras = data.etapas.filter((opcao) => opcao.id !== etapa.id).sort((a, b) => a.ordem - b.ordem);
  const ultima = data.etapas.length <= 1;
  const destino = outras.find((opcao) => opcao.id === destinoId);
  const motivo = enviando
    ? "Gravando a Etapa…"
    : ultima
      ? "Um Funil precisa de ao menos uma Etapa."
      : total > 0 && destino === undefined
        ? "Escolha a Etapa de destino dos Negócios."
        : undefined;

  const limpar = () => {
    setDestinoId("");
    setRecusa(null);
  };

  const confirmar = async () => {
    setRecusa(null);
    setEnviando(true);
    try {
      if (total > 0 && destino) {
        await remapearEtapa(etapa.id, destino.id);
        onDone(`${plural(total, "Negócio remapeado", "Negócios remapeados")} para “${destino.nome}” e a Etapa foi removida.`);
      } else {
        await removerEtapa(etapa.id);
        onDone(`Etapa ${etapa.nome} removida.`);
      }
      limpar();
      onClose();
    } catch (falha) {
      // Diálogo aberto, escolha preservada: a pessoa corrige e tenta de novo.
      setRecusa(comoErroDeApi(falha, "Não foi possível remover a Etapa. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Remover a Etapa “${etapa.nome}”?`}
      description={
        total === 0
          ? "Nenhum Negócio ocupa esta Etapa; a remoção não move nada."
          : `${plural(total, "Negócio está", "Negócios estão")} nela. Escolha para qual Etapa eles vão antes de removê-la.`
      }
      confirmLabel={total > 0 ? "Remapear e remover" : "Remover Etapa"}
      destructive
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void confirmar()}
      onCancel={() => {
        limpar();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />

        {total > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="O que referencia esta Etapa" />
            <ul className="app-base space-y-0.5 px-4 py-3" style={{ color: "var(--texto-3)" }}>
              <li>
                {abertos} {abertos === 1 ? "aberto" : "abertos"} · {ganhos} {ganhos === 1 ? "ganho" : "ganhos"} · {perdidos}{" "}
                {perdidos === 1 ? "perdido" : "perdidos"}
              </li>
              <li>Negócios encerrados preservam a situação que tinham.</li>
              {arquivados > 0 ? <li>{arquivados} {arquivados === 1 ? "arquivado" : "arquivados"}</li> : null}
              {naLixeira > 0 ? <li>{naLixeira} na Lixeira — também precisam de destino</li> : null}
            </ul>
          </Painel>
        ) : null}

        {total > 0 ? (
          <Field label="Etapa de destino" hint="Sem mapeamento por nome nem por posição: a escolha é explícita.">
            {(id) => (
              <Select
                id={id}
                value={destinoId}
                onChange={setDestinoId}
                placeholder="Escolher Etapa"
                disabled={ultima}
                disabledReason="Um Funil precisa de ao menos uma Etapa."
                options={outras.map((opcao) => ({
                  value: opcao.id,
                  label: opcao.nome,
                  detail: `${opcao.probabilidadePadrao}%`,
                  ...(opcao.cor ? { color: opcao.cor } : {}),
                }))}
              />
            )}
          </Field>
        ) : null}

        {total > 0 ? (
          <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            A probabilidade ajustada à mão de cada Negócio é preservada.
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
