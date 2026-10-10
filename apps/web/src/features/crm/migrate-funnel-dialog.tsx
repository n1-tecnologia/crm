"use client";

/**
 * D08 — Migrar Negócios de Funil, aberto por `?migrar-negocios=`.
 *
 * Cada Etapa de origem que tem Negócios escolhe, explicitamente, uma Etapa do
 * Funil de destino: dois Funis podem ter Etapas com o mesmo nome e
 * probabilidades opostas, e a api valida o mapeamento (`validarMigracao`, de
 * novo) antes de mover. A tela SUGERE a Etapa de mesmo nome (sem diferenciar
 * caixa) ou, na falta dela, a Etapa inicial do destino; a pessoa confere e
 * troca o que quiser. Nada é enviado sem o mapeamento completo.
 *
 * D-07: a fonte é a api. Origem e destino vêm de `GET /funis/:id`, o destino é
 * escolhido entre os Funis `ativo` (`GET /funis`) e o ato é
 * `POST /funis/:id/migrar-negocios`, que move TODOS os Negócios do Funil (não há
 * escopo "só os abertos" na api). A recusa aparece no próprio diálogo, que
 * continua aberto.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { chaveDeNome, etapaInicial, validarMigracao, type MapeamentoDeEtapas } from "@n1/dominio/crm/funis";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { migrarNegociosDoFunil, useFunil, useFunis } from "@/dados/crm/funis";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { CabecalhoDePainel, ConfirmDialog, Field, Painel, Select } from "@/features/shell/ui";

export const MIGRATE_DEALS_PARAM = "migrar-negocios";

export function useMigrateFunnelDialog(): {
  readonly migrating: boolean;
  readonly openMigrate: () => void;
  readonly closeMigrate: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    migrating: query.has(MIGRATE_DEALS_PARAM),
    openMigrate: () => {
      const next = new URLSearchParams(query.toString());
      next.set(MIGRATE_DEALS_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMigrate: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MIGRATE_DEALS_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

const plural = (n: number, singular: string, plurais: string): string => `${n} ${n === 1 ? singular : plurais}`;

/** A Etapa de mesmo nome (sem caixa) no destino, ou a inicial dele (RN-FUN-06). */
function sugerirMapeamento(
  comNegocios: ReadonlyArray<{ readonly id: string; readonly nome: string }>,
  etapasDoDestino: ReadonlyArray<{ readonly id: string; readonly nome: string; readonly ordem: number }>,
): MapeamentoDeEtapas {
  const inicial = etapaInicial(etapasDoDestino);
  const sugerido: Record<string, string> = {};
  for (const origem of comNegocios) {
    const igual = etapasDoDestino.find((candidata) => chaveDeNome(candidata.nome) === chaveDeNome(origem.nome));
    const escolhida = igual ?? inicial;
    if (escolhida) sugerido[origem.id] = escolhida.id;
  }
  return sugerido;
}

export function MigrateFunnelDialog({
  funilId,
  open,
  onClose,
  onDone,
}: {
  readonly funilId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (mensagem: string) => void;
}) {
  // Fechado, o diálogo não lê nada da api.
  const { data: origem } = useFunil(open ? funilId : undefined);
  const { data: lista } = useFunis({ estado: "ativo", limite: 200 }, { pausado: !open });
  const [destinoId, setDestinoId] = useState("");
  // O que a pessoa trocou à mão; o resto vem da sugestão. Recomeça a cada destino.
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { data: destino } = useFunil(open && destinoId !== "" ? destinoId : undefined);

  if (!open || !origem) return null;

  const comNegocios = origem.etapas.filter((etapa) => etapa.negocios.total > 0).sort((a, b) => a.ordem - b.ordem);
  const totais = origem.etapas.reduce(
    (soma, etapa) => ({
      total: soma.total + etapa.negocios.total,
      abertos: soma.abertos + etapa.negocios.abertos,
      ganhos: soma.ganhos + etapa.negocios.ganhos,
      perdidos: soma.perdidos + etapa.negocios.perdidos,
      arquivados: soma.arquivados + etapa.negocios.arquivados,
      naLixeira: soma.naLixeira + etapa.negocios.naLixeira,
    }),
    { total: 0, abertos: 0, ganhos: 0, perdidos: 0, arquivados: 0, naLixeira: 0 },
  );

  const destinos = (lista?.itens ?? []).filter((item) => item.funil.id !== funilId && item.funil.estado === "ativo");
  const etapasDoDestino = destino?.etapas ?? [];
  const mapeamento: MapeamentoDeEtapas = { ...sugerirMapeamento(comNegocios, etapasDoDestino), ...trocas };

  const validacao = destino
    ? validarMigracao({
        origem: origem.funil,
        destino: destino.funil,
        etapasDoDestino,
        etapasDeOrigemComNegocios: comNegocios.map((etapa) => etapa.id),
        mapeamento,
      })
    : undefined;
  const motivo = enviando
    ? "Gravando a migração…"
    : totais.total === 0
      ? "Este Funil não tem Negócios."
      : destinoId === "" || !destino
        ? "Escolha o Funil de destino."
        : validacao && !validacao.ok
          ? validacao.error
          : undefined;

  const limpar = () => {
    setDestinoId("");
    setTrocas({});
    setRecusa(null);
  };

  const confirmar = async () => {
    if (!destino) return;
    setRecusa(null);
    setEnviando(true);
    try {
      // Só as Etapas de origem com Negócios entram no corpo.
      const corpo = Object.fromEntries(comNegocios.map((etapa) => [etapa.id, mapeamento[etapa.id]] as const)) as Record<string, string>;
      const { migrados } = await migrarNegociosDoFunil(funilId, { paraFunilId: destino.funil.id, mapeamento: corpo });
      onDone(`${plural(migrados, "Negócio migrado", "Negócios migrados")} para “${destino.funil.nome}”.`);
      limpar();
      onClose();
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível migrar os Negócios. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Migrar Negócios de “${origem.funil.nome}”`}
      description="Cada Etapa de origem precisa de uma Etapa de destino. Sugerimos a de mesmo nome."
      confirmLabel="Migrar Negócios"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void confirmar()}
      onCancel={() => {
        limpar();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />

        <Painel>
          <CabecalhoDePainel titulo={`${plural(totais.total, "Negócio", "Negócios")} no Funil`} />
          <ul className="app-base app-numero space-y-0.5 px-4 py-3" style={{ color: "var(--texto-3)" }}>
            <li>
              {totais.abertos} {totais.abertos === 1 ? "aberto" : "abertos"} · {totais.ganhos} {totais.ganhos === 1 ? "ganho" : "ganhos"} ·{" "}
              {totais.perdidos} {totais.perdidos === 1 ? "perdido" : "perdidos"}
            </li>
            {totais.arquivados > 0 ? <li>{totais.arquivados} {totais.arquivados === 1 ? "arquivado" : "arquivados"}</li> : null}
            {totais.naLixeira > 0 ? <li>{totais.naLixeira} na Lixeira</li> : null}
          </ul>
        </Painel>

        <Field label="Funil de destino" hint="Só Funis ativos recebem Negócios.">
          {(id) => (
            <Select
              id={id}
              value={destinoId}
              onChange={(valor) => {
                setDestinoId(valor);
                setTrocas({});
              }}
              searchable
              placeholder="Escolher Funil"
              options={destinos.map((item) => ({
                value: item.funil.id,
                label: item.funil.nome,
                detail: `${item.totalEtapas} ${item.totalEtapas === 1 ? "Etapa" : "Etapas"}`,
              }))}
            />
          )}
        </Field>

        {destino ? (
          <div className="grid gap-2">
            {comNegocios.map((etapa) => (
              <Field key={etapa.id} label={`${etapa.nome} · ${plural(etapa.negocios.total, "Negócio", "Negócios")} → destino`}>
                {(id) => (
                  <Select
                    id={id}
                    value={mapeamento[etapa.id] ?? ""}
                    onChange={(valor) => setTrocas((atual) => ({ ...atual, [etapa.id]: valor }))}
                    placeholder="Escolher Etapa"
                    options={[...etapasDoDestino]
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((opcao) => ({
                        value: opcao.id,
                        label: opcao.nome,
                        detail: `${opcao.probabilidadePadrao}%`,
                        ...(opcao.cor ? { color: opcao.cor } : {}),
                      }))}
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
